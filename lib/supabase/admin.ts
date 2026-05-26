import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables, TablesUpdate } from "./database.types"

/**
 * Lazily instantiated service-role client.
 *
 * We defer instantiation until first use so that `next build` can collect
 * page data without needing `NEXT_PUBLIC_SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` to be present in the build environment.
 * Page-level try/catch around the helper calls then renders empty state.
 */
let _adminClient: SupabaseClient<Database> | null = null

function adminClient(): SupabaseClient<Database> {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase admin client unavailable: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    )
  }
  _adminClient = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}

export type Profile = Tables<"profiles">
export type PlanType = Database["public"]["Enums"]["plan_type"]
export type LanguageType = Database["public"]["Enums"]["language_type"]

export type StatusFilter = "all" | "active" | "banned" | "admin"

export async function getUsers(
  page: number,
  search: string,
  status: StatusFilter = "all",
  plan: PlanType | "all" = "all",
) {
  const pageSize = 20
  const from = (page - 1) * pageSize

  let query = adminClient()
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, plan, language, timezone, is_admin, banned_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)

  if (search) {
    query = query.ilike("email", `%${search}%`)
  }

  if (status === "active") {
    query = query.is("banned_at", null)
  } else if (status === "banned") {
    query = query.not("banned_at", "is", null)
  } else if (status === "admin") {
    query = query.eq("is_admin", true)
  }

  if (plan !== "all") {
    query = query.eq("plan", plan)
  }

  return query
}

export async function updateUserPlan(userId: string, plan: PlanType) {
  return adminClient()
    .from("profiles")
    .update({ plan })
    .eq("id", userId)
}

type UpdateProfilePatch = Pick<
  TablesUpdate<"profiles">,
  "full_name" | "language" | "is_admin"
>

export async function updateUserProfile(userId: string, patch: UpdateProfilePatch) {
  return adminClient()
    .from("profiles")
    .update(patch)
    .eq("id", userId)
}

export async function banUser(userId: string) {
  return adminClient()
    .from("profiles")
    .update({ banned_at: new Date().toISOString() })
    .eq("id", userId)
}

export async function unbanUser(userId: string) {
  return adminClient()
    .from("profiles")
    .update({ banned_at: null })
    .eq("id", userId)
}

export async function deleteUser(userId: string) {
  return adminClient().auth.admin.deleteUser(userId)
}

export async function inviteUser(email: string, redirectTo?: string) {
  return adminClient().auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  )
}

export async function countAdmins() {
  const { count } = await adminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", true)
  return count ?? 0
}

/* ─────────────────────────────────────────────────────────
 * User Detail – profile, topics (schedules), reports
 * ───────────────────────────────────────────────────────── */

export type MonitoringSchedule = Tables<"monitoring_schedules">
export type VisibilityReport = Tables<"visibility_reports">
export type QueryResult = Tables<"query_results">
export type FrequencyType = Database["public"]["Enums"]["frequency_type"]

export async function getUserById(userId: string) {
  return adminClient()
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, plan, language, timezone, is_admin, banned_at, created_at, updated_at",
    )
    .eq("id", userId)
    .single()
}

export async function getSchedulesForProfile(profileId: string) {
  return adminClient()
    .from("monitoring_schedules")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true })
}

export async function getReportsForProfile(profileId: string, limit = 25) {
  return adminClient()
    .from("visibility_reports")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit)
}

export async function getReportWithQueryResults(reportId: string) {
  const [reportRes, qrRes] = await Promise.all([
    adminClient()
      .from("visibility_reports")
      .select("*")
      .eq("id", reportId)
      .single(),
    adminClient()
      .from("query_results")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
  ])
  return {
    report: reportRes.data,
    reportError: reportRes.error,
    queryResults: qrRes.data ?? [],
    queryResultsError: qrRes.error,
  }
}

export async function updateSchedule(
  scheduleId: string,
  patch: { frequency?: FrequencyType; is_active?: boolean; next_run_at?: string },
) {
  return adminClient()
    .from("monitoring_schedules")
    .update(patch)
    .eq("id", scheduleId)
}

export async function getScheduleById(scheduleId: string) {
  return adminClient()
    .from("monitoring_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single()
}

/** Returns the underlying admin client for code that needs raw access
 *  (e.g. the manual-analysis runner that performs multiple writes). */
export function getAdminClient() {
  return adminClient()
}

/* ─────────────────────────────────────────────────────────
 * Stats / Observability
 * ───────────────────────────────────────────────────────── */

export type StatsSnapshot = {
  users: {
    total: number
    banned: number
    admins: number
    byPlan: Record<PlanType, number>
  }
  schedules: {
    total: number
    active: number
    overdueCount: number
    /** ISO timestamp of the most recent successful run across all schedules, or null. */
    lastRunAt: string | null
  }
  reports: {
    total: number
    last7d: number
    /** Day buckets oldest → newest. Keys are ISO yyyy-mm-dd. */
    dailyLast7d: { date: string; count: number }[]
  }
}

export type OverdueSchedule = {
  id: string
  name: string
  profile_id: string
  profile_email: string | null
  frequency: FrequencyType
  next_run_at: string
  last_run_at: string | null
  hours_overdue: number
}

const PLAN_VALUES: PlanType[] = ["free", "starter", "pro", "enterprise"]

export async function getStats(): Promise<StatsSnapshot> {
  const client = adminClient()

  // ── Users ───────────────────────────────────────────────────────────
  const [totalUsers, bannedUsers, adminUsers] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }),
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("banned_at", "is", null),
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true),
  ])

  // plan distribution – one query per plan (cheap, very few plans)
  const planCounts = await Promise.all(
    PLAN_VALUES.map(p =>
      client.from("profiles").select("id", { count: "exact", head: true }).eq("plan", p),
    ),
  )
  const byPlan = PLAN_VALUES.reduce<Record<PlanType, number>>((acc, p, i) => {
    acc[p] = planCounts[i].count ?? 0
    return acc
  }, { free: 0, starter: 0, pro: 0, enterprise: 0 })

  // ── Schedules ───────────────────────────────────────────────────────
  const [totalSchedules, activeSchedules, lastRunRow] = await Promise.all([
    client.from("monitoring_schedules").select("id", { count: "exact", head: true }),
    client
      .from("monitoring_schedules")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    client
      .from("monitoring_schedules")
      .select("last_run_at")
      .not("last_run_at", "is", null)
      .order("last_run_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const overdueRes = await client
    .from("monitoring_schedules")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .lt("next_run_at", sixHoursAgo)

  // ── Reports ─────────────────────────────────────────────────────────
  const totalReports = await client
    .from("visibility_reports")
    .select("id", { count: "exact", head: true })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const reportsLast7dRows = await client
    .from("visibility_reports")
    .select("created_at")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true })

  // Build day buckets (oldest → newest, 7 days)
  const buckets: { date: string; count: number }[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    buckets.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  ;(reportsLast7dRows.data ?? []).forEach(r => {
    const day = r.created_at.slice(0, 10)
    const bucket = buckets.find(b => b.date === day)
    if (bucket) bucket.count++
  })

  return {
    users: {
      total: totalUsers.count ?? 0,
      banned: bannedUsers.count ?? 0,
      admins: adminUsers.count ?? 0,
      byPlan,
    },
    schedules: {
      total: totalSchedules.count ?? 0,
      active: activeSchedules.count ?? 0,
      overdueCount: overdueRes.count ?? 0,
      lastRunAt: lastRunRow.data?.last_run_at ?? null,
    },
    reports: {
      total: totalReports.count ?? 0,
      last7d: reportsLast7dRows.data?.length ?? 0,
      dailyLast7d: buckets,
    },
  }
}

export async function getOverdueSchedules(limit = 20): Promise<OverdueSchedule[]> {
  const client = adminClient()
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: schedules, error } = await client
    .from("monitoring_schedules")
    .select("id, name, profile_id, frequency, next_run_at, last_run_at")
    .eq("is_active", true)
    .lt("next_run_at", sixHoursAgo)
    .order("next_run_at", { ascending: true })
    .limit(limit)

  if (error || !schedules) return []

  // Resolve emails in a single batch query
  const profileIds = Array.from(new Set(schedules.map(s => s.profile_id)))
  const { data: profiles } = await client
    .from("profiles")
    .select("id, email")
    .in("id", profileIds)
  const emailById = new Map((profiles ?? []).map(p => [p.id, p.email]))

  const now = Date.now()
  return schedules.map(s => ({
    id: s.id,
    name: s.name,
    profile_id: s.profile_id,
    profile_email: emailById.get(s.profile_id) ?? null,
    frequency: s.frequency,
    next_run_at: s.next_run_at,
    last_run_at: s.last_run_at,
    hours_overdue: Math.round((now - new Date(s.next_run_at).getTime()) / 3600_000),
  }))
}

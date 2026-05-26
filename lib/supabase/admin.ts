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

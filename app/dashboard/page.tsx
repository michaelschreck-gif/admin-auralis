import { getUsers, type Profile, type PlanType, type StatusFilter } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import UserTable from "./UserTable"

export const dynamic = "force-dynamic"

const STATUS_VALUES = ["all", "active", "banned", "admin"] as const satisfies readonly StatusFilter[]
const PLAN_VALUES = ["all", "free", "starter", "pro", "enterprise"] as const

function parseStatus(raw: string | undefined): StatusFilter {
  return (STATUS_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as StatusFilter)
    : "all"
}

function parsePlan(raw: string | undefined): PlanType | "all" {
  return (PLAN_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as PlanType | "all")
    : "all"
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    plan?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1"))
  const search = params.q ?? ""
  const status = parseStatus(params.status)
  const plan = parsePlan(params.plan)

  // Capture current admin's ID so the UI can disable self-targeting actions.
  // The layout already enforces auth + is_admin; we only need the ID here.
  // Wrap in try/catch so `next build` page-data collection doesn't crash
  // when Supabase env vars / cookies aren't available.
  let currentAdminId = ""
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    currentAdminId = user?.id ?? ""
  } catch {
    // build-time render; auth will be enforced by layout at request time
  }

  let users: Profile[] = []
  let totalCount = 0

  try {
    const { data, count } = await getUsers(page, search, status, plan)
    users = data ?? []
    totalCount = count ?? 0
  } catch {
    // service role key unavailable at build time — render empty table
  }

  return (
    <UserTable
      users={users}
      totalCount={totalCount}
      page={page}
      search={search}
      status={status}
      plan={plan}
      currentAdminId={currentAdminId}
    />
  )
}

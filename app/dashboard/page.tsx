import { getUsers, type Profile, type PlanType, type StatusFilter } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import UserTable from "./UserTable"
import { redirect } from "next/navigation"

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
  let currentAdminId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    currentAdminId = user.id
  } catch {
    redirect("/login")
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
      currentAdminId={currentAdminId ?? ""}
    />
  )
}

import { getUsers, type Profile } from "@/lib/supabase/admin"
import UserTable from "./UserTable"

export const dynamic = "force-dynamic"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1"))
  const search = params.q ?? ""

  let users: Profile[] = []
  let totalCount = 0

  try {
    const { data, count } = await getUsers(page, search)
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
    />
  )
}

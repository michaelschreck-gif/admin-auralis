import { getUsers } from "@/lib/supabase/admin"
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

  const { data: users, count } = await getUsers(page, search)

  return (
    <UserTable
      users={users ?? []}
      totalCount={count ?? 0}
      page={page}
      search={search}
    />
  )
}

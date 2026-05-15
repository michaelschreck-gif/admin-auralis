import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export type Profile = {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  is_admin: boolean
  banned_at: string | null
}

export async function getUsers(page: number, search: string) {
  const pageSize = 20
  const from = (page - 1) * pageSize

  let query = adminClient
    .from("profiles")
    .select("id, email, full_name, plan, created_at, is_admin, banned_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)

  if (search) {
    query = query.ilike("email", `%${search}%`)
  }

  return query
}

export async function updateUserPlan(userId: string, plan: string) {
  return adminClient
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ plan } as any)
    .eq("id", userId)
}

export async function banUser(userId: string) {
  return adminClient
    .from("profiles")
    .update({ banned_at: new Date().toISOString() })
    .eq("id", userId)
}

export async function unbanUser(userId: string) {
  return adminClient
    .from("profiles")
    .update({ banned_at: null })
    .eq("id", userId)
}

export async function deleteUser(userId: string) {
  return adminClient.auth.admin.deleteUser(userId)
}

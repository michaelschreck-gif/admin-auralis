"use server"

import { updateUserPlan, banUser, unbanUser, deleteUser } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/login")
}

export async function actionUpdatePlan(userId: string, plan: string) {
  await assertAdmin()
  await updateUserPlan(userId, plan)
  revalidatePath("/dashboard")
}

export async function actionBanUser(userId: string) {
  await assertAdmin()
  await banUser(userId)
  revalidatePath("/dashboard")
}

export async function actionUnbanUser(userId: string) {
  await assertAdmin()
  await unbanUser(userId)
  revalidatePath("/dashboard")
}

export async function actionDeleteUser(userId: string) {
  await assertAdmin()
  await deleteUser(userId)
  revalidatePath("/dashboard")
}

export async function actionSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

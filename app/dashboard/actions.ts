"use server"

import {
  updateUserPlan,
  updateUserProfile,
  banUser,
  unbanUser,
  deleteUser,
  inviteUser,
  countAdmins,
  type PlanType,
  type LanguageType,
} from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

/** Returns the current admin's user ID or redirects to /login. */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/login")
  return user.id
}

export async function actionUpdatePlan(userId: string, plan: PlanType) {
  await requireAdmin()
  const { error } = await updateUserPlan(userId, plan)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function actionUpdateProfile(
  userId: string,
  patch: {
    full_name?: string | null
    language?: LanguageType
    is_admin?: boolean
  },
) {
  const actorId = await requireAdmin()

  // Self-demotion guard: an admin cannot remove their own admin flag
  if (patch.is_admin === false && userId === actorId) {
    throw new Error("Du kannst dir nicht selbst die Admin-Rechte entziehen.")
  }

  // Last-admin guard: prevent demoting the last admin in the system
  if (patch.is_admin === false) {
    const remaining = await countAdmins()
    if (remaining <= 1) {
      throw new Error("Mindestens ein Admin muss erhalten bleiben.")
    }
  }

  const { error } = await updateUserProfile(userId, patch)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function actionBanUser(userId: string) {
  const actorId = await requireAdmin()
  if (userId === actorId) {
    throw new Error("Du kannst dich nicht selbst sperren.")
  }
  const { error } = await banUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function actionUnbanUser(userId: string) {
  await requireAdmin()
  const { error } = await unbanUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function actionDeleteUser(userId: string) {
  const actorId = await requireAdmin()
  if (userId === actorId) {
    throw new Error("Du kannst dich nicht selbst löschen.")
  }
  const { error } = await deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

/**
 * Invites a new user via Supabase Magic-Link.
 * The user receives an email with a link to set their password.
 * After the user signs up, the `handle_new_user` trigger automatically
 * creates the `profiles` row.
 */
export async function actionInviteUser(email: string) {
  await requireAdmin()
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) throw new Error("E-Mail darf nicht leer sein.")
  // Naive email check; Supabase will reject invalid ones anyway.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Ungültige E-Mail-Adresse.")
  }

  // Redirect users to the main app after they accept the invite, not the admin panel.
  const redirectTo = process.env.NEXT_PUBLIC_MAIN_APP_URL
    ? `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/auth/callback`
    : undefined

  const { error } = await inviteUser(trimmed, redirectTo)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
}

export async function actionSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

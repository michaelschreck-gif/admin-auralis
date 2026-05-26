"use server"

import {
  updateUserPlan,
  updateUserProfile,
  banUser,
  unbanUser,
  deleteUser,
  inviteUser,
  countAdmins,
  updateSchedule,
  logAudit,
  type PlanType,
  type LanguageType,
  type FrequencyType,
} from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type ActorContext = { id: string; email: string | null }

/** Returns the current admin's identity or redirects to /login. */
async function requireAdmin(): Promise<ActorContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/login")
  return { id: user.id, email: profile.email ?? user.email ?? null }
}

export async function actionUpdatePlan(userId: string, plan: PlanType) {
  const actor = await requireAdmin()
  const { error } = await updateUserPlan(userId, plan)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.plan.update", {
    targetType: "user",
    targetId: userId,
    payload: { plan },
  })
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
  const actor = await requireAdmin()

  // Self-demotion guard: an admin cannot remove their own admin flag
  if (patch.is_admin === false && userId === actor.id) {
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
  await logAudit(actor.id, actor.email, "user.profile.update", {
    targetType: "user",
    targetId: userId,
    payload: patch as Record<string, unknown>,
  })
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/users/${userId}`)
}

export async function actionBanUser(userId: string) {
  const actor = await requireAdmin()
  if (userId === actor.id) {
    throw new Error("Du kannst dich nicht selbst sperren.")
  }
  const { error } = await banUser(userId)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.ban", {
    targetType: "user",
    targetId: userId,
  })
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/users/${userId}`)
}

export async function actionUnbanUser(userId: string) {
  const actor = await requireAdmin()
  const { error } = await unbanUser(userId)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.unban", {
    targetType: "user",
    targetId: userId,
  })
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/users/${userId}`)
}

export async function actionDeleteUser(userId: string) {
  const actor = await requireAdmin()
  if (userId === actor.id) {
    throw new Error("Du kannst dich nicht selbst löschen.")
  }
  const { error } = await deleteUser(userId)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.delete", {
    targetType: "user",
    targetId: userId,
  })
  revalidatePath("/dashboard")
}

/**
 * Invites a new user via Supabase Magic-Link.
 * The user receives an email with a link to set their password.
 * After the user signs up, the `handle_new_user` trigger automatically
 * creates the `profiles` row.
 */
export async function actionInviteUser(email: string) {
  const actor = await requireAdmin()
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) throw new Error("E-Mail darf nicht leer sein.")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Ungültige E-Mail-Adresse.")
  }

  const redirectTo = process.env.NEXT_PUBLIC_MAIN_APP_URL
    ? `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/auth/callback`
    : undefined

  const { data, error } = await inviteUser(trimmed, redirectTo)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.invite", {
    targetType: "user",
    targetId: data?.user?.id ?? undefined,
    payload: { email: trimmed },
  })
  revalidatePath("/dashboard")
}

export async function actionSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/* ─────────────────────────────────────────────────────────
 * Schedule (Topic) actions – used on user detail page
 * ───────────────────────────────────────────────────────── */

export async function actionUpdateScheduleFrequency(
  scheduleId: string,
  frequency: FrequencyType,
  profileId: string,
) {
  const actor = await requireAdmin()
  const { error } = await updateSchedule(scheduleId, { frequency })
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "schedule.frequency.update", {
    targetType: "schedule",
    targetId: scheduleId,
    payload: { frequency, profile_id: profileId },
  })
  revalidatePath(`/dashboard/users/${profileId}`)
}

export async function actionToggleSchedule(
  scheduleId: string,
  isActive: boolean,
  profileId: string,
) {
  const actor = await requireAdmin()
  // Re-activating? Set next_run_at to now so the next cron pass picks it up.
  const patch: Parameters<typeof updateSchedule>[1] = { is_active: isActive }
  if (isActive) patch.next_run_at = new Date().toISOString()
  const { error } = await updateSchedule(scheduleId, patch)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "schedule.toggle", {
    targetType: "schedule",
    targetId: scheduleId,
    payload: { is_active: isActive, profile_id: profileId },
  })
  revalidatePath(`/dashboard/users/${profileId}`)
}

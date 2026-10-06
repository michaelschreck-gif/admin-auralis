"use server"

import {
  updateUserPlan,
  updateUserProfile,
  banUser,
  unbanUser,
  deleteUser,
  inviteUser,
  countAdmins,
  createAccount,
  setUserPassword,
  setUserParent,
  getProfileByEmail,
  getProfilesByIds,
  getTeamMembers,
  updateSchedule,
  logAudit,
  type PlanType,
  type LanguageType,
  type FrequencyType,
} from "@/lib/supabase/admin"
import { EMAIL_RE, validatePassword } from "@/lib/accounts"
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
  const [target] = await getProfilesByIds([userId])
  if (target?.is_admin && (await countAdmins()) <= 1) {
    throw new Error("Mindestens ein Admin muss erhalten bleiben.")
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

/* ─────────────────────────────────────────────────────────
 * Kontenverwaltung: Nutzer anlegen, Passwort, Teams
 * ───────────────────────────────────────────────────────── */

function cleanEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) throw new Error("Ungültige E-Mail-Adresse.")
  return email
}

function cleanName(raw: string, label = "Name"): string {
  const name = raw.trim()
  if (!name) throw new Error(`${label} fehlt.`)
  if (name.length > 120) throw new Error(`${label} ist zu lang (max. 120 Zeichen).`)
  return name
}

function cleanPassword(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const err = validatePassword(raw)
  if (err) throw new Error(err)
  return raw
}

/** Legt einen Einzelnutzer direkt an (mit Passwort, ohne Einladungs-Mail). */
export async function actionCreateUser(input: {
  email: string
  fullName: string
  password: string
  plan: PlanType
  language: LanguageType
  isAdmin?: boolean
}) {
  const actor = await requireAdmin()
  const email = cleanEmail(input.email)
  const fullName = cleanName(input.fullName)
  const password = cleanPassword(input.password)
  if (!password) throw new Error("Bitte ein Passwort vergeben.")

  const res = await createAccount({
    email,
    fullName,
    password,
    plan: input.plan,
    language: input.language,
    isAdmin: !!input.isAdmin,
  })
  if (!res.ok) throw new Error(res.message)
  await logAudit(actor.id, actor.email, "user.create", {
    targetType: "user",
    targetId: res.id,
    payload: { email, plan: input.plan, is_admin: !!input.isAdmin },
  })
  revalidatePath("/dashboard")
}

/** Setzt für ein beliebiges Konto direkt ein neues Passwort. */
export async function actionSetPassword(userId: string, password: string) {
  const actor = await requireAdmin()
  const err = validatePassword(password)
  if (err) throw new Error(err)
  const { error } = await setUserPassword(userId, password)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "user.password.set", {
    targetType: "user",
    targetId: userId,
  })
}

/** Legt ein Team an: Enterprise-Konto als Inhaber, mit Login. */
export async function actionCreateTeam(input: {
  teamName: string
  ownerEmail: string
  password: string
  language: LanguageType
}) {
  const actor = await requireAdmin()
  const teamName = cleanName(input.teamName, "Teamname")
  const email = cleanEmail(input.ownerEmail)
  const password = cleanPassword(input.password)
  if (!password) throw new Error("Bitte ein Passwort für den Team-Inhaber vergeben.")

  const res = await createAccount({
    email,
    fullName: teamName,
    password,
    plan: "enterprise",
    language: input.language,
  })
  if (!res.ok) throw new Error(res.message)
  await logAudit(actor.id, actor.email, "team.create", {
    targetType: "team",
    targetId: res.id,
    payload: { name: teamName, owner_email: email },
  })
  revalidatePath("/dashboard/teams")
  return { id: res.id }
}

export async function actionRenameTeam(teamId: string, name: string) {
  const actor = await requireAdmin()
  const teamName = cleanName(name, "Teamname")
  const { error } = await updateUserProfile(teamId, { full_name: teamName })
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "team.rename", {
    targetType: "team",
    targetId: teamId,
    payload: { name: teamName },
  })
  revalidatePath("/dashboard/teams")
  revalidatePath(`/dashboard/teams/${teamId}`)
}

/**
 * Legt ein neues Teammitglied an. Ohne Passwort entsteht ein verwaltetes
 * Konto ohne eigenen Login (wie im Haupt-Tool); mit Passwort kann sich die
 * Person selbst anmelden.
 */
export async function actionCreateTeamMember(
  teamId: string,
  input: { fullName: string; email: string; password?: string; language: LanguageType },
) {
  const actor = await requireAdmin()
  const [owner] = await getProfilesByIds([teamId])
  if (!owner) throw new Error("Team nicht gefunden.")
  if (owner.parent_account_id) throw new Error("Dieses Konto ist selbst Teammitglied.")

  const email = cleanEmail(input.email)
  const fullName = cleanName(input.fullName)
  const password = cleanPassword(input.password || undefined)

  const res = await createAccount({
    email,
    fullName,
    password,
    plan: "pro",
    language: input.language,
    parentId: teamId,
  })
  if (!res.ok) throw new Error(res.message)
  await logAudit(actor.id, actor.email, "team.member.add", {
    targetType: "team",
    targetId: teamId,
    payload: { member_id: res.id, email, created: true, managed: res.managed },
  })
  revalidatePath(`/dashboard/teams/${teamId}`)
  revalidatePath("/dashboard/teams")
}

/** Hängt ein bereits bestehendes Konto (per E-Mail) an ein Team. */
export async function actionAddExistingToTeam(teamId: string, rawEmail: string) {
  const actor = await requireAdmin()
  const email = cleanEmail(rawEmail)
  const [owner] = await getProfilesByIds([teamId])
  if (!owner) throw new Error("Team nicht gefunden.")
  if (owner.parent_account_id) throw new Error("Dieses Konto ist selbst Teammitglied.")

  const { data: person } = await getProfileByEmail(email)
  if (!person) throw new Error("Kein Konto mit dieser E-Mail gefunden.")
  if (person.id === teamId) throw new Error("Der Inhaber gehört bereits zum Team.")
  if (person.is_admin) throw new Error("Admin-Konten können keinem Team zugeordnet werden.")
  if (person.parent_account_id === teamId) throw new Error("Diese Person ist bereits im Team.")
  if (person.plan === "enterprise") {
    const members = await getTeamMembers(person.id)
    if (members.length > 0) {
      throw new Error("Dieses Konto ist Inhaber eines eigenen Teams mit Mitgliedern.")
    }
  }

  const { error } = await setUserParent(person.id, teamId)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "team.member.add", {
    targetType: "team",
    targetId: teamId,
    payload: { member_id: person.id, email, created: false },
  })
  revalidatePath(`/dashboard/teams/${teamId}`)
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
}

/** Löst die Person aus dem Team; das Konto bleibt als Einzelperson bestehen. */
export async function actionRemoveFromTeam(userId: string, teamId: string) {
  const actor = await requireAdmin()
  const { error } = await setUserParent(userId, null)
  if (error) throw new Error(error.message)
  await logAudit(actor.id, actor.email, "team.member.remove", {
    targetType: "team",
    targetId: teamId,
    payload: { member_id: userId },
  })
  revalidatePath(`/dashboard/teams/${teamId}`)
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
}

/**
 * Löscht ein Team. withMembers=true löscht auch alle Mitglieder samt Daten,
 * sonst bleiben sie als Einzelpersonen bestehen. Der Inhaber wird immer gelöscht.
 */
export async function actionDeleteTeam(teamId: string, withMembers: boolean) {
  const actor = await requireAdmin()
  const members = await getTeamMembers(teamId)
  const [owner] = await getProfilesByIds([teamId])
  if (!owner) throw new Error("Team nicht gefunden.")

  const doomed = withMembers ? [owner, ...members] : [owner]
  if (doomed.some(p => p.id === actor.id)) {
    throw new Error("Du kannst dein eigenes Konto nicht über ein Team löschen.")
  }
  if (doomed.some(p => p.is_admin)) {
    throw new Error("Das Team enthält ein Admin-Konto. Bitte zuerst die Admin-Rechte entziehen.")
  }

  let deletedMembers = 0
  for (const m of withMembers ? members : []) {
    const { error } = await deleteUser(m.id)
    if (error) throw new Error(`${m.email}: ${error.message}`)
    deletedMembers++
  }
  const { error } = await deleteUser(teamId)
  if (error) throw new Error(error.message)

  await logAudit(actor.id, actor.email, "team.delete", {
    targetType: "team",
    targetId: teamId,
    payload: {
      name: owner.full_name,
      owner_email: owner.email,
      members_deleted: deletedMembers,
      members_kept: withMembers ? 0 : members.length,
    },
  })
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
}

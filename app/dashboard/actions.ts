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
  getProfilesByIds,
  searchProfiles,
  getTeamsForProfiles,
  getTeam,
  getTeamMembers,
  createTeamRow,
  renameTeamRow,
  deleteTeamRow,
  addTeamMembers,
  removeTeamMember,
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


type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * In Produktion maskiert Next.js die Meldung geworfener Fehler aus Server
 * Actions ("An error occurred in the Server Components render…"). Deshalb
 * geben alle Actions ein Ergebnisobjekt zurück; app/dashboard/api.ts wirft
 * daraus clientseitig wieder einen Error mit der echten Meldung.
 */
async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    const digest = (e as { digest?: unknown } | null)?.digest
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e // redirect / notFound
    console.error("[admin action]", e)
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler." }
  }
}

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

async function impl_actionUpdatePlan(userId: string, plan: PlanType) {
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

async function impl_actionUpdateProfile(
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

async function impl_actionBanUser(userId: string) {
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

async function impl_actionUnbanUser(userId: string) {
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

async function impl_actionDeleteUser(userId: string) {
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
async function impl_actionInviteUser(email: string) {
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

async function impl_actionUpdateScheduleFrequency(
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

async function impl_actionToggleSchedule(
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
async function impl_actionCreateUser(input: {
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
async function impl_actionSetPassword(userId: string, password: string) {
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

/** Legt ein Team an und fügt direkt beliebig viele bestehende Personen hinzu. */
async function impl_actionCreateTeam(input: { name: string; memberIds: string[] }) {
  const actor = await requireAdmin()
  const name = cleanName(input.name, "Teamname")
  const team = await createTeamRow(name)
  let added = 0
  try {
    if (input.memberIds.length > 0) added = (await addTeamMembers(team.id, input.memberIds)).length
  } catch (e) {
    await deleteTeamRow(team.id).catch(() => {})
    throw e
  }
  await logAudit(actor.id, actor.email, "team.create", {
    targetType: "team",
    targetId: team.id,
    payload: { name, members: added },
  })
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
  return { id: team.id }
}

export type PickerUser = {
  id: string
  email: string
  full_name: string | null
  plan: PlanType
  is_admin: boolean
  teams: string[]
  teamIds: string[]
}

/** Nutzersuche für die Auswahllisten (Name oder E-Mail). */
async function impl_actionSearchUsers(query: string): Promise<PickerUser[]> {
  await requireAdmin()
  const people = await searchProfiles(query, 12)
  const teams = await getTeamsForProfiles(people.map(p => p.id))
  return people.map(p => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    plan: p.plan,
    is_admin: p.is_admin,
    teams: (teams[p.id] ?? []).map(t => t.name),
    teamIds: (teams[p.id] ?? []).map(t => t.id),
  }))
}

async function impl_actionRenameTeam(teamId: string, name: string) {
  const actor = await requireAdmin()
  const teamName = cleanName(name, "Teamname")
  await renameTeamRow(teamId, teamName)
  await logAudit(actor.id, actor.email, "team.rename", {
    targetType: "team",
    targetId: teamId,
    payload: { name: teamName },
  })
  revalidatePath("/dashboard/teams")
  revalidatePath(`/dashboard/teams/${teamId}`)
}

/**
 * Legt ein neues Konto an und nimmt es ins Team auf. Ohne Passwort entsteht
 * ein verwaltetes Konto ohne eigenen Login; mit Passwort kann sich die Person
 * selbst anmelden.
 */
async function impl_actionCreateTeamMember(
  teamId: string,
  input: { fullName: string; email: string; password?: string; language: LanguageType },
) {
  const actor = await requireAdmin()
  if (!(await getTeam(teamId))) throw new Error("Team nicht gefunden.")

  const email = cleanEmail(input.email)
  const fullName = cleanName(input.fullName)
  const password = cleanPassword(input.password || undefined)

  const res = await createAccount({
    email,
    fullName,
    password,
    plan: "pro",
    language: input.language,
  })
  if (!res.ok) throw new Error(res.message)
  await addTeamMembers(teamId, [res.id])
  await logAudit(actor.id, actor.email, "team.member.add", {
    targetType: "team",
    targetId: teamId,
    payload: { member_id: res.id, email, created: true, managed: res.managed },
  })
  revalidatePath(`/dashboard/teams/${teamId}`)
  revalidatePath("/dashboard/teams")
}

/** Ordnet bestehende Konten einem Team zu (Mehrfachauswahl, auch Mehrfach-Teams). */
async function impl_actionAddUsersToTeam(teamId: string, userIds: string[]) {
  const actor = await requireAdmin()
  if (userIds.length === 0) throw new Error("Bitte mindestens eine Person auswählen.")
  if (!(await getTeam(teamId))) throw new Error("Team nicht gefunden.")

  const added = await addTeamMembers(teamId, userIds)
  if (added.length > 0) {
    await logAudit(actor.id, actor.email, "team.member.add", {
      targetType: "team",
      targetId: teamId,
      payload: { member_ids: added, created: false },
    })
  }
  revalidatePath(`/dashboard/teams/${teamId}`)
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
  return { added: added.length }
}

/** Entfernt die Person aus diesem Team; das Konto und andere Teams bleiben. */
async function impl_actionRemoveFromTeam(userId: string, teamId: string) {
  const actor = await requireAdmin()
  await removeTeamMember(teamId, userId)
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
 * Löscht ein Team. withMembers=true löscht zusätzlich die Konten aller
 * Mitglieder samt Daten, sonst bleiben sie als Personen bestehen.
 */
async function impl_actionDeleteTeam(teamId: string, withMembers: boolean) {
  const actor = await requireAdmin()
  const team = await getTeam(teamId)
  if (!team) throw new Error("Team nicht gefunden.")
  const members = await getTeamMembers(teamId)

  if (withMembers) {
    if (members.some(m => m.id === actor.id)) {
      throw new Error("Du bist selbst Mitglied dieses Teams und kannst dich nicht mitlöschen.")
    }
    if (members.some(m => m.is_admin)) {
      throw new Error("Das Team enthält ein Admin-Konto. Bitte zuerst die Admin-Rechte entziehen oder die Person aus dem Team nehmen.")
    }
    for (const m of members) {
      const { error } = await deleteUser(m.id)
      if (error) throw new Error(`${m.email}: ${error.message}`)
    }
  }
  await deleteTeamRow(teamId)
  await logAudit(actor.id, actor.email, "team.delete", {
    targetType: "team",
    targetId: teamId,
    payload: {
      name: team.name,
      members_deleted: withMembers ? members.length : 0,
      members_kept: withMembers ? 0 : members.length,
    },
  })
  revalidatePath("/dashboard/teams")
  revalidatePath("/dashboard")
}

/* ───────── Öffentliche Actions (Ergebnisobjekte) ───────── */

export async function actionUpdatePlan(...args: Parameters<typeof impl_actionUpdatePlan>) {
  return guard(() => impl_actionUpdatePlan(...args))
}

export async function actionUpdateProfile(...args: Parameters<typeof impl_actionUpdateProfile>) {
  return guard(() => impl_actionUpdateProfile(...args))
}

export async function actionBanUser(...args: Parameters<typeof impl_actionBanUser>) {
  return guard(() => impl_actionBanUser(...args))
}

export async function actionUnbanUser(...args: Parameters<typeof impl_actionUnbanUser>) {
  return guard(() => impl_actionUnbanUser(...args))
}

export async function actionDeleteUser(...args: Parameters<typeof impl_actionDeleteUser>) {
  return guard(() => impl_actionDeleteUser(...args))
}

export async function actionInviteUser(...args: Parameters<typeof impl_actionInviteUser>) {
  return guard(() => impl_actionInviteUser(...args))
}

export async function actionUpdateScheduleFrequency(...args: Parameters<typeof impl_actionUpdateScheduleFrequency>) {
  return guard(() => impl_actionUpdateScheduleFrequency(...args))
}

export async function actionToggleSchedule(...args: Parameters<typeof impl_actionToggleSchedule>) {
  return guard(() => impl_actionToggleSchedule(...args))
}

export async function actionCreateUser(...args: Parameters<typeof impl_actionCreateUser>) {
  return guard(() => impl_actionCreateUser(...args))
}

export async function actionSetPassword(...args: Parameters<typeof impl_actionSetPassword>) {
  return guard(() => impl_actionSetPassword(...args))
}

export async function actionCreateTeam(...args: Parameters<typeof impl_actionCreateTeam>) {
  return guard(() => impl_actionCreateTeam(...args))
}

export async function actionRenameTeam(...args: Parameters<typeof impl_actionRenameTeam>) {
  return guard(() => impl_actionRenameTeam(...args))
}

export async function actionCreateTeamMember(...args: Parameters<typeof impl_actionCreateTeamMember>) {
  return guard(() => impl_actionCreateTeamMember(...args))
}

export async function actionAddUsersToTeam(...args: Parameters<typeof impl_actionAddUsersToTeam>) {
  return guard(() => impl_actionAddUsersToTeam(...args))
}

export async function actionSearchUsers(...args: Parameters<typeof impl_actionSearchUsers>) {
  return guard(() => impl_actionSearchUsers(...args))
}

export async function actionRemoveFromTeam(...args: Parameters<typeof impl_actionRemoveFromTeam>) {
  return guard(() => impl_actionRemoveFromTeam(...args))
}

export async function actionDeleteTeam(...args: Parameters<typeof impl_actionDeleteTeam>) {
  return guard(() => impl_actionDeleteTeam(...args))
}

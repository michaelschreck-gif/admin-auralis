"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition, useState, useEffect } from "react"
import type { Profile, PlanType, StatusFilter, KindFilter, LanguageType, TeamInfo } from "@/lib/supabase/admin"
import { ModalShell, Field, SetPasswordModal, PasswordField, ErrorBox, extractError, inputCls, btnPrimary, btnGhost } from "./ui"
import { validatePassword } from "@/lib/accounts"
import {
  actionCreateUser,
  actionUpdatePlan,
  actionUpdateProfile,
  actionBanUser,
  actionUnbanUser,
  actionDeleteUser,
  actionInviteUser,
} from "./actions"

const PLANS = ["free", "starter", "pro", "enterprise"] as const satisfies readonly PlanType[]
const LANGUAGES: { code: LanguageType; label: string; flag: string }[] = [
  { code: "de", label: "Deutsch",   flag: "🇩🇪" },
  { code: "en", label: "English",   flag: "🇬🇧" },
  { code: "fr", label: "Français",  flag: "🇫🇷" },
  { code: "es", label: "Español",   flag: "🇪🇸" },
  { code: "it", label: "Italiano",  flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",    label: "Alle" },
  { value: "active", label: "Aktiv" },
  { value: "banned", label: "Gesperrt" },
  { value: "admin",  label: "Admins" },
]

const PLAN_FILTERS: { value: PlanType | "all"; label: string }[] = [
  { value: "all",        label: "Alle Tarife" },
  { value: "free",       label: "Free" },
  { value: "starter",    label: "Starter" },
  { value: "pro",        label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
]

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all",    label: "Alle" },
  { value: "single", label: "Einzelpersonen" },
  { value: "member", label: "Teammitglieder" },
]

export default function UserTable({
  users,
  totalCount,
  page,
  search,
  status,
  plan,
  kind,
  teamInfo,
  currentAdminId,
}: {
  users: Profile[]
  totalCount: number
  page: number
  search: string
  status: StatusFilter
  plan: PlanType | "all"
  kind: KindFilter
  teamInfo: TeamInfo
  currentAdminId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editUser, setEditUser]   = useState<Profile | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Clear error when modals open/close.
  useEffect(() => { if (!editUser && !inviteOpen && !createOpen) setActionError(null) }, [editUser, inviteOpen, createOpen])

  const totalPages = Math.ceil(totalCount / 20)

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== "all") sp.set(k, v)
      else sp.delete(k)
    })
    router.push(`/dashboard?${sp.toString()}`)
  }

  function handleSearch(q: string) {
    navigate({ q, page: "1" })
  }

  function handleKind(k: KindFilter) {
    navigate({ kind: k, page: "1" })
  }

  function handleStatus(s: StatusFilter) {
    navigate({ status: s, page: "1" })
  }

  function handlePlanFilter(p: PlanType | "all") {
    navigate({ plan: p, page: "1" })
  }

  function handlePlanChange(userId: string, newPlan: PlanType) {
    setActionError(null)
    startTransition(async () => {
      try { await actionUpdatePlan(userId, newPlan) }
      catch (e) { setActionError(extractError(e)) }
    })
  }

  function handleBan(userId: string, banned: boolean) {
    setActionError(null)
    startTransition(async () => {
      try {
        if (banned) await actionUnbanUser(userId)
        else await actionBanUser(userId)
      } catch (e) { setActionError(extractError(e)) }
    })
  }

  function handleDelete(userId: string) {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId)
      return
    }
    setActionError(null)
    startTransition(async () => {
      try {
        await actionDeleteUser(userId)
        setConfirmDelete(null)
      } catch (e) {
        setActionError(extractError(e))
        setConfirmDelete(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* ──────────── Toolbar (Search + Invite + Filters) ──────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          defaultValue={search}
          placeholder="Nach E-Mail oder Name filtern…"
          onChange={e => handleSearch(e.target.value)}
          className="bg-white border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-sm text-[var(--foreground)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 w-72 transition-colors"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
          disabled={isPending}
        >
          + Nutzer anlegen
        </button>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-white text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          disabled={isPending}
        >
          Per E-Mail einladen
        </button>
        <span className="text-sm text-[var(--text-muted)]">
          {totalCount} Nutzer{search || status !== "all" || plan !== "all" || kind !== "all" ? " (gefiltert)" : " gesamt"}
        </span>
        {isPending && (
          <span className="text-xs text-[var(--accent)] flex items-center gap-1.5">
            <span className="w-3 h-3 border border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
            Wird gespeichert…
          </span>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mr-1">Typ</span>
        {KIND_FILTERS.map(k => (
          <FilterPill key={k.value} active={kind === k.value} onClick={() => handleKind(k.value)}>
            {k.label}
          </FilterPill>
        ))}
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mx-1 ml-4">Status</span>
        {STATUS_FILTERS.map(s => (
          <FilterPill
            key={s.value}
            active={status === s.value}
            onClick={() => handleStatus(s.value)}
          >
            {s.label}
          </FilterPill>
        ))}
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mx-1 ml-4">Tarif</span>
        {PLAN_FILTERS.map(p => (
          <FilterPill
            key={p.value}
            active={plan === p.value}
            onClick={() => handlePlanFilter(p.value)}
          >
            {p.label}
          </FilterPill>
        ))}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)]/20 px-4 py-3 flex items-start gap-3">
          <p className="text-xs text-[var(--danger)] font-medium flex-1">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-[var(--danger)] hover:text-[var(--danger)]"
          >
            ✕
          </button>
        </div>
      )}

      {/* ──────────── Table ──────────── */}
      <div className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Nutzer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sprache</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Erstellt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[var(--text-faint)] text-sm">
                  Keine Nutzer gefunden.
                </td>
              </tr>
            )}
            {users.map((user, idx) => {
              const initials = (user.full_name ?? user.email)
                .split(" ").map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2)
              const isBanned = !!user.banned_at
              const isSelf = user.id === currentAdminId
              const rowNum = (page - 1) * 20 + idx + 1
              const lang = LANGUAGES.find(l => l.code === user.language)

              return (
                <tr key={user.id} className={`hover:bg-[var(--surface-muted)] transition-colors ${isBanned ? "opacity-60" : ""}`}>
                  {/* # */}
                  <td className="px-4 py-3 text-[var(--text-faint)]">{rowNum}</td>

                  {/* Nutzer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-[var(--accent)]">{initials}</span>
                      </div>
                      <Link
                        href={`/dashboard/users/${user.id}`}
                        className="group"
                        title="Detail-Ansicht öffnen"
                      >
                        <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                          {user.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                          {user.email}
                        </p>
                      </Link>
                      {user.is_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] font-medium">
                          Admin
                        </span>
                      )}
                      {(teamInfo.memberCountByOwner[user.id] ?? 0) > 0 && (
                        <Link
                          href={`/dashboard/teams/${user.id}`}
                          className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-100 hover:underline"
                        >
                          Team · {teamInfo.memberCountByOwner[user.id]}
                        </Link>
                      )}
                      {user.parent_account_id && (
                        <Link
                          href={`/dashboard/teams/${user.parent_account_id}`}
                          className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-100 hover:underline"
                          title="Zum Team"
                        >
                          Mitglied · {teamInfo.teamNameById[user.parent_account_id] ?? "Team"}
                        </Link>
                      )}
                      {isSelf && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                          Du
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <select
                      value={user.plan}
                      onChange={e => handlePlanChange(user.id, e.target.value as PlanType)}
                      disabled={isPending}
                      className="bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors capitalize cursor-pointer"
                    >
                      {PLANS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>

                  {/* Sprache */}
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                    {lang ? <>{lang.flag} {lang.code.toUpperCase()}</> : user.language}
                  </td>

                  {/* Erstellt */}
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                    {new Date(user.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {isBanned ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] font-medium border border-[var(--danger)]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger-soft)]0"/>
                        Gesperrt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]"/>
                        Aktiv
                      </span>
                    )}
                  </td>

                  {/* Aktionen */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditUser(user)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setPasswordUser(user)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Passwort
                      </button>
                      <button
                        onClick={() => handleBan(user.id, isBanned)}
                        disabled={isPending || isSelf}
                        title={isSelf ? "Du kannst dich nicht selbst sperren" : undefined}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={isBanned
                          ? { borderColor: "var(--success-soft)", background: "var(--success-soft)", color: "var(--success)" }
                          : { borderColor: "var(--danger-soft)", background: "var(--danger-soft)", color: "var(--danger)" }
                        }
                      >
                        {isBanned ? "Entsperren" : "Sperren"}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isPending || isSelf}
                        title={isSelf ? "Du kannst dich nicht selbst löschen" : "Konto samt allen Daten endgültig löschen"}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          confirmDelete === user.id
                            ? "bg-[var(--danger-soft)]0 text-white border-[var(--danger)]"
                            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--danger)]/25 hover:text-[var(--danger)]"
                        }`}
                      >
                        {confirmDelete === user.id ? "Bestätigen" : "Löschen"}
                      </button>
                      {confirmDelete === user.id && (
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ page: String(page - 1) })}
            disabled={page <= 1}
            className="text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Zurück
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Seite {page} von {totalPages}
          </span>
          <button
            onClick={() => navigate({ page: String(page + 1) })}
            disabled={page >= totalPages}
            className="text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Weiter →
          </button>
        </div>
      )}

      {/* ──────────── Modals ──────────── */}
      {editUser && (
        <EditUserModal
          user={editUser}
          isSelf={editUser.id === currentAdminId}
          onClose={() => setEditUser(null)}
          onError={(msg) => setActionError(msg)}
        />
      )}
      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
        />
      )}
      {passwordUser && (
        <SetPasswordModal
          userId={passwordUser.id}
          label={passwordUser.full_name ? `${passwordUser.full_name} (${passwordUser.email})` : passwordUser.email}
          onClose={() => setPasswordUser(null)}
        />
      )}
      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onError={(msg) => setActionError(msg)}
        />
      )}
    </div>
  )
}

/* ───────────────────────── Sub-Components ───────────────────────── */

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-white text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  )
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onError,
}: {
  user: Profile
  isSelf: boolean
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [fullName, setFullName] = useState(user.full_name ?? "")
  const [language, setLanguage] = useState<LanguageType>(user.language)
  const [isAdmin, setIsAdmin]   = useState(user.is_admin)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      try {
        await actionUpdateProfile(user.id, {
          full_name: fullName.trim() || null,
          language,
          is_admin: isAdmin,
        })
        onClose()
      } catch (e) {
        onError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Nutzer bearbeiten">
      <div className="space-y-4">
        <ReadonlyRow label="E-Mail" value={user.email} />

        <Field label="Voller Name">
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="z.B. Max Mustermann"
            className="w-full bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
          />
        </Field>

        <Field label="Sprache">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as LanguageType)}
            className="w-full bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Admin-Status">
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border-subtle)] rounded-lg hover:border-[var(--accent)] transition-colors">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              disabled={isSelf && user.is_admin}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--foreground)]">
              Dieser Nutzer ist Admin
            </span>
            {isSelf && user.is_admin && (
              <span className="text-xs text-[var(--text-faint)] ml-auto">
                Du kannst dich nicht selbst entziehen
              </span>
            )}
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
        >
          {isPending ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </ModalShell>
  )
}

function InviteUserModal({
  onClose,
  onError,
}: {
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState<string | null>(null)

  function handleInvite() {
    startTransition(async () => {
      try {
        await actionInviteUser(email)
        setSuccess(`Einladung an ${email} verschickt.`)
        setEmail("")
      } catch (e) {
        onError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Neuen Nutzer einladen">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Der Nutzer erhält eine E-Mail mit einem Link, um sein Passwort zu setzen.
          Anschließend kann er sich im Haupt-Tool anmelden.
        </p>

        <Field label="E-Mail">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            autoFocus
            className="w-full bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
          />
        </Field>

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3">
            <p className="text-xs text-green-600 font-medium">{success}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          Schließen
        </button>
        <button
          type="button"
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
        >
          {isPending ? "Einladung wird verschickt…" : "Einladen"}
        </button>
      </div>
    </ModalShell>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--text-faint)] font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm text-[var(--foreground)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
        {value}
      </p>
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [plan, setPlan] = useState<PlanType>("free")
  const [language, setLanguage] = useState<LanguageType>("de")
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    const v = validatePassword(password)
    if (v) { setError(v); return }
    setError(null)
    startTransition(async () => {
      try {
        await actionCreateUser({ email, fullName, password, plan, language, isAdmin })
        setCreated({ email: email.trim().toLowerCase(), password })
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Nutzer anlegen">
      {created ? (
        <>
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 space-y-1">
            <p className="text-xs text-green-700 font-medium">Konto angelegt. Zugangsdaten, werden nicht noch einmal angezeigt:</p>
            <p className="text-sm text-green-800 break-all">{created.email}</p>
            <p className="text-sm font-mono text-green-800 select-all break-all">{created.password}</p>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className={btnPrimary}>Fertig</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Legt das Konto sofort mit Passwort an, ohne Einladungs-Mail. Die Person kann sich direkt anmelden.
          </p>
          <Field label="Name">
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="z.B. Max Mustermann" autoFocus className={inputCls} />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className={inputCls} />
          </Field>
          <PasswordField value={password} onChange={setPassword} hint="Mindestens 10 Zeichen." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tarif">
              <select value={plan} onChange={e => setPlan(e.target.value as PlanType)} className={inputCls}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Sprache">
              <select value={language} onChange={e => setLanguage(e.target.value as LanguageType)} className={inputCls}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border-subtle)] rounded-lg hover:border-[var(--accent)] transition-colors">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            <span className="text-sm text-[var(--foreground)]">Admin-Rechte vergeben</span>
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
            <button type="button" onClick={save} disabled={isPending || !email.trim() || !fullName.trim() || !password} className={btnPrimary}>
              {isPending ? "Legt an…" : "Anlegen"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

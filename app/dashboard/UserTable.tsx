"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition, useState, useEffect } from "react"
import type { Profile, PlanType, StatusFilter, LanguageType } from "@/lib/supabase/admin"
import {
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

export default function UserTable({
  users,
  totalCount,
  page,
  search,
  status,
  plan,
  currentAdminId,
}: {
  users: Profile[]
  totalCount: number
  page: number
  search: string
  status: StatusFilter
  plan: PlanType | "all"
  currentAdminId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editUser, setEditUser]   = useState<Profile | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Clear error when modals open/close.
  useEffect(() => { if (!editUser && !inviteOpen) setActionError(null) }, [editUser, inviteOpen])

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
          placeholder="Nach E-Mail filtern…"
          onChange={e => handleSearch(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7]/20 w-72 transition-colors"
        />
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="text-sm px-4 py-2 rounded-lg bg-[#4F6EF7] text-white font-medium hover:bg-[#3b5bd9] transition-colors disabled:opacity-50"
          disabled={isPending}
        >
          + User einladen
        </button>
        <span className="text-sm text-[#64748b]">
          {totalCount} Nutzer{search || status !== "all" || plan !== "all" ? " (gefiltert)" : " gesamt"}
        </span>
        {isPending && (
          <span className="text-xs text-[#4F6EF7] flex items-center gap-1.5">
            <span className="w-3 h-3 border border-blue-200 border-t-[#4F6EF7] rounded-full animate-spin" />
            Wird gespeichert…
          </span>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8] mr-1">Status</span>
        {STATUS_FILTERS.map(s => (
          <FilterPill
            key={s.value}
            active={status === s.value}
            onClick={() => handleStatus(s.value)}
          >
            {s.label}
          </FilterPill>
        ))}
        <span className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8] mx-1 ml-4">Tarif</span>
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
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-3">
          <p className="text-xs text-red-600 font-medium flex-1">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* ──────────── Table ──────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f8f9fb] border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Nutzer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Sprache</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Erstellt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[#94a3b8] text-sm">
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
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${isBanned ? "opacity-60" : ""}`}>
                  {/* # */}
                  <td className="px-4 py-3 text-[#94a3b8]">{rowNum}</td>

                  {/* Nutzer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-[#4F6EF7]">{initials}</span>
                      </div>
                      <div>
                        <p className="font-medium text-[#0f172a]">{user.full_name ?? "—"}</p>
                        <p className="text-xs text-[#64748b]">{user.email}</p>
                      </div>
                      {user.is_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[#64748b] font-medium">
                          Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#4F6EF7] font-medium border border-blue-100">
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
                      className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#4F6EF7] transition-colors capitalize cursor-pointer"
                    >
                      {PLANS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>

                  {/* Sprache */}
                  <td className="px-4 py-3 text-[#64748b] text-xs">
                    {lang ? <>{lang.flag} {lang.code.toUpperCase()}</> : user.language}
                  </td>

                  {/* Erstellt */}
                  <td className="px-4 py-3 text-[#64748b] text-xs">
                    {new Date(user.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {isBanned ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium border border-red-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                        Gesperrt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
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
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-[#64748b] hover:border-[#4F6EF7] hover:text-[#4F6EF7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleBan(user.id, isBanned)}
                        disabled={isPending || isSelf}
                        title={isSelf ? "Du kannst dich nicht selbst sperren" : undefined}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={isBanned
                          ? { borderColor: "#d1fae5", background: "#f0fdf4", color: "#16a34a" }
                          : { borderColor: "#fee2e2", background: "#fff5f5", color: "#dc2626" }
                        }
                      >
                        {isBanned ? "Entsperren" : "Sperren"}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isPending || isSelf}
                        title={isSelf ? "Du kannst dich nicht selbst löschen" : undefined}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          confirmDelete === user.id
                            ? "bg-red-500 text-white border-red-500"
                            : "border-gray-200 text-[#64748b] hover:border-red-200 hover:text-red-500"
                        }`}
                      >
                        {confirmDelete === user.id ? "Bestätigen" : "Löschen"}
                      </button>
                      {confirmDelete === user.id && (
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-[#94a3b8] hover:text-[#64748b] transition-colors"
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
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Zurück
          </button>
          <span className="text-sm text-[#64748b]">
            Seite {page} von {totalPages}
          </span>
          <button
            onClick={() => navigate({ page: String(page + 1) })}
            disabled={page >= totalPages}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          ? "bg-[#4F6EF7] text-white border-[#4F6EF7]"
          : "bg-white text-[#64748b] border-gray-200 hover:border-[#4F6EF7] hover:text-[#4F6EF7]"
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
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7]/20"
          />
        </Field>

        <Field label="Sprache">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as LanguageType)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7]/20"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Admin-Status">
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:border-[#4F6EF7] transition-colors">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              disabled={isSelf && user.is_admin}
              className="w-4 h-4 accent-[#4F6EF7]"
            />
            <span className="text-sm text-[#0f172a]">
              Dieser Nutzer ist Admin
            </span>
            {isSelf && user.is_admin && (
              <span className="text-xs text-[#94a3b8] ml-auto">
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
          className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg bg-[#4F6EF7] text-white font-medium hover:bg-[#3b5bd9] transition-colors disabled:opacity-50"
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
        <p className="text-xs text-[#64748b]">
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
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7]/20"
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
          className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors"
        >
          Schließen
        </button>
        <button
          type="button"
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="text-sm px-4 py-2 rounded-lg bg-[#4F6EF7] text-white font-medium hover:bg-[#3b5bd9] transition-colors disabled:opacity-50"
        >
          {isPending ? "Einladung wird verschickt…" : "Einladen"}
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0f172a]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] text-lg leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[#64748b] font-medium uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm text-[#0f172a] bg-[#f8f9fb] border border-gray-100 rounded-lg px-3 py-2">
        {value}
      </p>
    </div>
  )
}

function extractError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  return "Unbekannter Fehler."
}

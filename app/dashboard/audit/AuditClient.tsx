"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Fragment, useState } from "react"
import type { AuditEntry, AuditActionName, AuditTargetType } from "@/lib/supabase/admin"

const ACTION_LABEL: Record<AuditActionName, string> = {
  "user.invite":               "User eingeladen",
  "user.plan.update":          "Plan geändert",
  "user.profile.update":       "Profil bearbeitet",
  "user.ban":                  "User gesperrt",
  "user.unban":                "User entsperrt",
  "user.delete":               "User gelöscht",
  "schedule.frequency.update": "Topic-Frequency geändert",
  "schedule.toggle":           "Topic aktiviert/deaktiviert",
  "schedule.analyze.manual":   "Analyse manuell getriggert",
}

const ACTION_FILTERS: { value: AuditActionName | "all"; label: string }[] = [
  { value: "all",                          label: "Alle Aktionen" },
  { value: "user.invite",                  label: "User-Invite" },
  { value: "user.plan.update",             label: "Plan-Update" },
  { value: "user.profile.update",          label: "Profil-Update" },
  { value: "user.ban",                     label: "Ban" },
  { value: "user.unban",                   label: "Unban" },
  { value: "user.delete",                  label: "Delete" },
  { value: "schedule.frequency.update",    label: "Frequency-Update" },
  { value: "schedule.toggle",              label: "Schedule-Toggle" },
  { value: "schedule.analyze.manual",      label: "Manual-Analyse" },
]

const TARGET_FILTERS: { value: AuditTargetType | "all"; label: string }[] = [
  { value: "all",      label: "Alle" },
  { value: "user",     label: "User" },
  { value: "schedule", label: "Schedule" },
]

const WITHIN_FILTERS: { value: string; label: string }[] = [
  { value: "24",  label: "24h" },
  { value: "168", label: "7 Tage" },
  { value: "720", label: "30 Tage" },
  { value: "all", label: "Alle" },
]

export default function AuditClient({
  entries,
  totalCount,
  page,
  action,
  targetType,
  within,
  loadError,
}: {
  entries: AuditEntry[]
  totalCount: number
  page: number
  action: AuditActionName | "all"
  targetType: AuditTargetType | "all"
  within: number | "all"
  loadError: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openPayloadId, setOpenPayloadId] = useState<string | null>(null)

  const pageSize = 50
  const totalPages = Math.ceil(totalCount / pageSize)
  const filtered = action !== "all" || targetType !== "all" || within !== "all"

  function navigate(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "all") sp.delete(k)
      else sp.set(k, v)
    })
    router.push(`/dashboard/audit?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-base font-semibold text-[var(--foreground)]">Audit-Log</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Unveränderbares Protokoll aller Admin-Aktionen ·{" "}
          {totalCount} Einträge{filtered ? " (gefiltert)" : ""}
        </p>
      </header>

      {/* Filter pills */}
      <div className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm p-4 space-y-3">
        <FilterRow label="Aktion">
          {ACTION_FILTERS.map(f => (
            <FilterPill
              key={f.value}
              active={action === f.value}
              onClick={() => navigate({ action: f.value, page: "1" })}
            >
              {f.label}
            </FilterPill>
          ))}
        </FilterRow>
        <FilterRow label="Typ">
          {TARGET_FILTERS.map(f => (
            <FilterPill
              key={f.value}
              active={targetType === f.value}
              onClick={() => navigate({ target: f.value, page: "1" })}
            >
              {f.label}
            </FilterPill>
          ))}
        </FilterRow>
        <FilterRow label="Zeitraum">
          {WITHIN_FILTERS.map(f => (
            <FilterPill
              key={f.value}
              active={String(within) === f.value}
              onClick={() => navigate({ within: f.value, page: "1" })}
            >
              {f.label}
            </FilterPill>
          ))}
        </FilterRow>
      </div>

      {loadError && (
        <div className="rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)]/20 px-4 py-3">
          <p className="text-xs text-[var(--danger)] font-medium">{loadError}</p>
        </div>
      )}

      {/* Audit table */}
      <div className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Wann</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Aktion</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ziel</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[var(--text-faint)] text-sm">
                  Keine Audit-Einträge gefunden.
                </td>
              </tr>
            )}
            {entries.map(e => {
              const payloadStr = e.payload ? JSON.stringify(e.payload, null, 2) : null
              const open = openPayloadId === e.id
              return (
                <Fragment key={e.id}>
                  <tr className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground)]">
                      {e.actor_email ?? <span className="text-[var(--text-faint)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={e.action as AuditActionName} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {renderTarget(e)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payloadStr && (
                        <button
                          type="button"
                          onClick={() => setOpenPayloadId(open ? null : e.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        >
                          {open ? "Hide" : "Payload"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && payloadStr && (
                    <tr className="bg-[var(--surface-muted)]">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-[10px] text-[var(--foreground)] bg-white border border-[var(--border-subtle)] rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                          {payloadStr}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
    </div>
  )
}

function renderTarget(e: AuditEntry) {
  if (!e.target_type || !e.target_id) {
    return <span className="text-[var(--text-faint)]">—</span>
  }
  if (e.target_type === "user") {
    return (
      <Link
        href={`/dashboard/users/${e.target_id}`}
        className="text-[var(--accent)] hover:underline"
      >
        user / {e.target_id.slice(0, 8)}…
      </Link>
    )
  }
  if (e.target_type === "schedule") {
    // Try to extract profile_id from payload for deep-linking, else just show schedule id
    const payload = e.payload as Record<string, unknown> | null
    const profileId =
      payload && typeof payload === "object" && "profile_id" in payload && typeof payload.profile_id === "string"
        ? (payload.profile_id as string)
        : null
    if (profileId) {
      return (
        <Link
          href={`/dashboard/users/${profileId}`}
          className="text-[var(--accent)] hover:underline"
        >
          schedule / {e.target_id.slice(0, 8)}…
        </Link>
      )
    }
    return <span>schedule / {e.target_id.slice(0, 8)}…</span>
  }
  return <span>{e.target_type} / {e.target_id.slice(0, 8)}…</span>
}

function ActionBadge({ action }: { action: AuditActionName }) {
  // Color by family
  const family = action.split(".")[0]
  const styles: Record<string, string> = {
    user:     "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20",
    schedule: "bg-amber-50 text-amber-700 border-amber-100",
  }
  const cls = styles[family] ?? "bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]"
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {ACTION_LABEL[action] ?? action}
      <code className="text-[9px] opacity-60">{action}</code>
    </span>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] w-20">{label}</span>
      {children}
    </div>
  )
}

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

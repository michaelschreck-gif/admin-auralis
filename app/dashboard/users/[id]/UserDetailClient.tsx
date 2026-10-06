"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import type {
  Profile,
  MonitoringSchedule,
  VisibilityReport,
  FrequencyType,
  TeamRef,
} from "@/lib/supabase/admin"
import Link from "next/link"
import {
  actionUpdateScheduleFrequency,
  actionToggleSchedule,
  actionDeleteUser,
} from "@/app/dashboard/api"
import { SetPasswordModal, btnSmall } from "@/app/dashboard/ui"

const FREQUENCIES: { value: FrequencyType; label: string }[] = [
  { value: "daily",   label: "Täglich" },
  { value: "weekly",  label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
]

const LANG_FLAG: Record<string, string> = {
  de: "🇩🇪", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸", it: "🇮🇹", nl: "🇳🇱", pt: "🇵🇹",
}

export default function UserDetailClient({
  profile,
  schedules,
  reports,
  teams,
  currentAdminId,
}: {
  profile: Profile
  schedules: MonitoringSchedule[]
  reports: VisibilityReport[]
  teams: TeamRef[]
  currentAdminId: string
}) {
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)
  const [openReportId, setOpenReportId] = useState<string | null>(null)
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null)
  const [runSuccess, setRunSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDeleteAccount() {
    setActionError(null)
    startTransition(async () => {
      try {
        await actionDeleteUser(profile.id)
        router.push("/dashboard")
      } catch (e) {
        setActionError(extractError(e))
        setConfirmDelete(false)
      }
    })
  }

  const isSelf = profile.id === currentAdminId

  const initials = (profile.full_name ?? profile.email)
    .split(" ").map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2)

  const isBanned = !!profile.banned_at

  function handleFrequencyChange(scheduleId: string, frequency: FrequencyType) {
    setActionError(null)
    startTransition(async () => {
      try { await actionUpdateScheduleFrequency(scheduleId, frequency, profile.id) }
      catch (e) { setActionError(extractError(e)) }
    })
  }

  function handleToggleSchedule(scheduleId: string, isActive: boolean) {
    setActionError(null)
    startTransition(async () => {
      try { await actionToggleSchedule(scheduleId, isActive, profile.id) }
      catch (e) { setActionError(extractError(e)) }
    })
  }

  async function handleRunAnalysis(scheduleId: string, scheduleName: string) {
    setActionError(null)
    setRunSuccess(null)
    setRunningScheduleId(scheduleId)
    try {
      const res = await fetch(`/api/admin/run-analysis/${scheduleId}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? data.detail ?? "Analyse fehlgeschlagen")
      }
      setRunSuccess(
        `„${scheduleName}" analysiert · Score ${data.score}/100 · ${data.queryCount} Queries`,
      )
      router.refresh()
    } catch (e) {
      setActionError(extractError(e))
    } finally {
      setRunningScheduleId(null)
    }
  }

  const reportInDrawer = reports.find(r => r.id === openReportId) ?? null

  return (
    <div className="space-y-6">
      {/* ───────────── Action banners ───────────── */}
      {actionError && (
        <Banner kind="error" onClose={() => setActionError(null)}>{actionError}</Banner>
      )}
      {runSuccess && (
        <Banner kind="success" onClose={() => setRunSuccess(null)}>{runSuccess}</Banner>
      )}

      {/* ───────────── Profile Header ───────────── */}
      <section className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-semibold text-[var(--accent)]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {profile.full_name ?? "—"}
              </h1>
              {profile.is_admin && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] font-medium">
                  Admin
                </span>
              )}
              {isSelf && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                  Du
                </span>
              )}
              {isBanned && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] font-medium border border-[var(--danger)]/20">
                  Gesperrt
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{profile.email}</p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button type="button" onClick={() => setPasswordOpen(true)} disabled={isPending} className={btnSmall}>
                Passwort setzen
              </button>
              {teams.map(t => (
                <Link key={t.id} href={`/dashboard/teams/${t.id}`} className={btnSmall}>
                  Team: {t.name} →
                </Link>
              ))}
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isPending || isSelf}
                    className="text-xs px-3 py-1.5 rounded-lg border bg-[var(--danger)] text-white border-[var(--danger)] disabled:opacity-40"
                  >
                    Konto samt Daten endgültig löschen
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-[var(--text-faint)]">✕</button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending || isSelf}
                  title={isSelf ? "Du kannst dich nicht selbst löschen" : undefined}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--danger)]/25 hover:text-[var(--danger)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Konto löschen
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <KV label="Tarif" value={<span className="capitalize">{profile.plan}</span>} />
              <KV
                label="Sprache"
                value={<>{LANG_FLAG[profile.language] ?? "🏳️"} {profile.language.toUpperCase()}</>}
              />
              <KV
                label="Erstellt"
                value={new Date(profile.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              />
              <KV
                label="Zuletzt aktualisiert"
                value={new Date(profile.updated_at).toLocaleDateString("de-DE", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              />
            </div>
          </div>
        </div>
      </section>

      {passwordOpen && (
        <SetPasswordModal
          userId={profile.id}
          label={profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email}
          onClose={() => setPasswordOpen(false)}
        />
      )}

      {/* ───────────── Topics (monitoring_schedules) ───────────── */}
      <section className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm">
        <header className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Themen / Monitoring-Schedules</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {schedules.length === 0
                ? "Keine Themen angelegt."
                : `${schedules.filter(s => s.is_active).length} aktiv · ${schedules.length} gesamt`}
            </p>
          </div>
        </header>

        {schedules.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-faint)]">
            Dieser Nutzer hat noch keine Themen angelegt.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {schedules.map(s => {
              const overdue = new Date(s.next_run_at) < new Date() && s.is_active
              const running = runningScheduleId === s.id
              return (
                <li key={s.id} className="px-6 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-[var(--foreground)]">{s.name}</p>
                        {!s.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)] font-medium">
                            Inaktiv
                          </span>
                        )}
                        {overdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">
                            Überfällig
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{s.query}</p>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-faint)] mt-2 flex-wrap">
                        <span>{LANG_FLAG[s.language] ?? "🏳️"} {s.language.toUpperCase()}</span>
                        <span>
                          Letzter Run:{" "}
                          {s.last_run_at
                            ? new Date(s.last_run_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </span>
                        <span>
                          Nächster Run:{" "}
                          {new Date(s.next_run_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={s.frequency}
                        onChange={e => handleFrequencyChange(s.id, e.target.value as FrequencyType)}
                        disabled={isPending || running}
                        className="bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
                      >
                        {FREQUENCIES.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleToggleSchedule(s.id, !s.is_active)}
                        disabled={isPending || running}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      >
                        {s.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunAnalysis(s.id, s.name)}
                        disabled={running || isPending}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {running ? (
                          <>
                            <span className="w-3 h-3 border border-[var(--accent)]/30 border-t-white rounded-full animate-spin" />
                            Läuft…
                          </>
                        ) : (
                          "Jetzt analysieren"
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ───────────── Reports (visibility_reports) ───────────── */}
      <section className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm">
        <header className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Letzte Analysen</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {reports.length === 0
              ? "Noch keine Reports vorhanden."
              : `${reports.length} Reports (max. 25 angezeigt)`}
          </p>
        </header>

        {reports.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-faint)]">
            Noch keine Analysen. Trigger eine über „Jetzt analysieren" oben.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)]">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Trigger</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sentiment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Summary</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                  <td className="px-6 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <TriggerBadge trigger={r.trigger} />
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {r.visibility_score != null ? `${r.visibility_score}/100` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SentimentBadge sentiment={r.sentiment} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] truncate max-w-md">
                    {r.summary ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenReportId(r.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ───────────── Report Drawer ───────────── */}
      {reportInDrawer && (
        <ReportDrawer
          report={reportInDrawer}
          onClose={() => setOpenReportId(null)}
        />
      )}
    </div>
  )
}

/* ─────────────────────── Sub-components ─────────────────────── */

function ReportDrawer({
  report,
  onClose,
}: {
  report: VisibilityReport
  onClose: () => void
}) {
  const [queryResults, setQueryResults] = useState<QueryResultLite[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch query_results on mount via the admin-only API route
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/report/${report.id}/query-results`)
      .then(async r => {
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) throw new Error(data.error ?? "Fehler beim Laden")
        setQueryResults(data.queryResults ?? [])
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Fehler") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [report.id])

  const rawDataPretty = (() => {
    try { return JSON.stringify(report.raw_data, null, 2) }
    catch { return String(report.raw_data) }
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white shadow-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 bg-white border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">Report-Details</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {new Date(report.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} ·{" "}
              <TriggerBadge trigger={report.trigger} />
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--foreground)] text-lg leading-none"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-4 space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Score" value={report.visibility_score != null ? `${report.visibility_score}/100` : "—"} />
            <Metric label="Sentiment" value={<SentimentBadge sentiment={report.sentiment} />} />
            <Metric label="Report-ID" value={<code className="text-[10px]">{report.id.slice(0, 8)}…</code>} />
          </div>

          {report.summary && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mb-1.5">Summary</p>
              <p className="text-sm text-[var(--foreground)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                {report.summary}
              </p>
            </div>
          )}

          {/* Query Results */}
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mb-1.5">
              Query-Ergebnisse pro LLM-Call
            </p>
            {loading && (
              <p className="text-xs text-[var(--text-muted)]">Lade Query-Results…</p>
            )}
            {error && (
              <p className="text-xs text-[var(--danger)]">{error}</p>
            )}
            {queryResults && queryResults.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">Keine Query-Results für diesen Report.</p>
            )}
            {queryResults && queryResults.length > 0 && (
              <ul className="space-y-3">
                {queryResults.map((q, idx) => (
                  <li key={q.id} className="border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--surface-muted)]">
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span className="font-medium text-[var(--foreground)]">#{idx + 1}</span>
                      <span className="text-[var(--text-muted)]">{q.model}</span>
                      {q.brand_mentioned && (
                        <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 font-medium">
                          Erwähnt
                        </span>
                      )}
                      {q.position != null && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] font-medium">
                          Position {q.position}
                        </span>
                      )}
                      <SentimentBadge sentiment={q.sentiment} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mb-1.5">
                      <span className="font-semibold uppercase tracking-wider mr-1">Prompt:</span>
                      {q.prompt}
                    </p>
                    {q.response && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[var(--accent)] hover:underline">
                          Response anzeigen
                        </summary>
                        <pre className="mt-1.5 whitespace-pre-wrap text-[var(--foreground)] bg-white border border-[var(--border-subtle)] rounded p-2">
                          {q.response}
                        </pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Raw data */}
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)] mb-1.5">Raw Data (jsonb)</p>
            <pre className="text-[10px] text-[var(--foreground)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg p-3 overflow-x-auto max-h-96 overflow-y-auto">
              {rawDataPretty}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

type QueryResultLite = {
  id: string
  model: string
  prompt: string
  response: string | null
  brand_mentioned: boolean
  sentiment: "positive" | "neutral" | "negative" | null
  position: number | null
}

function TriggerBadge({ trigger }: { trigger: "scheduled" | "manual" | "webhook" }) {
  const styles: Record<string, string> = {
    scheduled: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20",
    manual:    "bg-amber-50 text-amber-700 border-amber-100",
    webhook:   "bg-purple-50 text-purple-700 border-purple-100",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[trigger] ?? ""}`}>
      {trigger}
    </span>
  )
}

function SentimentBadge({ sentiment }: { sentiment: "positive" | "neutral" | "negative" | null }) {
  if (!sentiment) {
    return <span className="text-xs text-[var(--text-faint)]">—</span>
  }
  const styles: Record<string, string> = {
    positive: "bg-green-50 text-green-600 border-green-100",
    neutral:  "bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]",
    negative: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[sentiment] ?? ""}`}>
      {sentiment}
    </span>
  )
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-faint)] mb-0.5">{label}</p>
      <p className="text-sm text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-[var(--border-subtle)] rounded-lg px-3 py-2 bg-[var(--surface-muted)]">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-faint)]">{label}</p>
      <p className="text-sm text-[var(--foreground)] mt-0.5">{value}</p>
    </div>
  )
}

function Banner({
  kind,
  onClose,
  children,
}: {
  kind: "error" | "success"
  onClose: () => void
  children: React.ReactNode
}) {
  const styles = kind === "error"
    ? "bg-[var(--danger-soft)] border-[var(--danger)]/20 text-[var(--danger)]"
    : "bg-green-50 border-green-100 text-green-700"
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${styles}`}>
      <p className="text-xs font-medium flex-1">{children}</p>
      <button type="button" onClick={onClose} className="text-xs">✕</button>
    </div>
  )
}

function extractError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  return "Unbekannter Fehler."
}

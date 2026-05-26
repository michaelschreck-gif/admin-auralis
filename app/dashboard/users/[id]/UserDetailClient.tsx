"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import type {
  Profile,
  MonitoringSchedule,
  VisibilityReport,
  FrequencyType,
} from "@/lib/supabase/admin"
import {
  actionUpdateScheduleFrequency,
  actionToggleSchedule,
} from "@/app/dashboard/actions"

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
  currentAdminId,
}: {
  profile: Profile
  schedules: MonitoringSchedule[]
  reports: VisibilityReport[]
  currentAdminId: string
}) {
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)
  const [openReportId, setOpenReportId] = useState<string | null>(null)
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null)
  const [runSuccess, setRunSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-semibold text-[#4F6EF7]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-[#0f172a] truncate">
                {profile.full_name ?? "—"}
              </h1>
              {profile.is_admin && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[#64748b] font-medium">
                  Admin
                </span>
              )}
              {isSelf && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#4F6EF7] font-medium border border-blue-100">
                  Du
                </span>
              )}
              {isBanned && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium border border-red-100">
                  Gesperrt
                </span>
              )}
            </div>
            <p className="text-sm text-[#64748b] mt-0.5">{profile.email}</p>

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

      {/* ───────────── Topics (monitoring_schedules) ───────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a]">Themen / Monitoring-Schedules</h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              {schedules.length === 0
                ? "Keine Themen angelegt."
                : `${schedules.filter(s => s.is_active).length} aktiv · ${schedules.length} gesamt`}
            </p>
          </div>
        </header>

        {schedules.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#94a3b8]">
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
                        <p className="font-medium text-[#0f172a]">{s.name}</p>
                        {!s.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[#94a3b8] font-medium">
                            Inaktiv
                          </span>
                        )}
                        {overdue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">
                            Überfällig
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748b] mt-1 truncate">{s.query}</p>
                      <div className="flex items-center gap-4 text-xs text-[#94a3b8] mt-2 flex-wrap">
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
                        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#4F6EF7] transition-colors cursor-pointer"
                      >
                        {FREQUENCIES.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleToggleSchedule(s.id, !s.is_active)}
                        disabled={isPending || running}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-[#64748b] hover:border-[#4F6EF7] hover:text-[#4F6EF7] transition-colors disabled:opacity-40"
                      >
                        {s.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunAnalysis(s.id, s.name)}
                        disabled={running || isPending}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#4F6EF7] text-white font-medium hover:bg-[#3b5bd9] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {running ? (
                          <>
                            <span className="w-3 h-3 border border-blue-200 border-t-white rounded-full animate-spin" />
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
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <header className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#0f172a]">Letzte Analysen</h2>
          <p className="text-xs text-[#64748b] mt-0.5">
            {reports.length === 0
              ? "Noch keine Reports vorhanden."
              : `${reports.length} Reports (max. 25 angezeigt)`}
          </p>
        </header>

        {reports.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#94a3b8]">
            Noch keine Analysen. Trigger eine über „Jetzt analysieren" oben.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f8f9fb] border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Trigger</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Sentiment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Summary</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-xs text-[#64748b] whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <TriggerBadge trigger={r.trigger} />
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0f172a]">
                    {r.visibility_score != null ? `${r.visibility_score}/100` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SentimentBadge sentiment={r.sentiment} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748b] truncate max-w-md">
                    {r.summary ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenReportId(r.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-[#64748b] hover:border-[#4F6EF7] hover:text-[#4F6EF7] transition-colors"
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
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#0f172a]">Report-Details</h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              {new Date(report.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} ·{" "}
              <TriggerBadge trigger={report.trigger} />
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] text-lg leading-none"
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
              <p className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8] mb-1.5">Summary</p>
              <p className="text-sm text-[#0f172a] bg-[#f8f9fb] border border-gray-100 rounded-lg px-3 py-2">
                {report.summary}
              </p>
            </div>
          )}

          {/* Query Results */}
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8] mb-1.5">
              Query-Ergebnisse pro LLM-Call
            </p>
            {loading && (
              <p className="text-xs text-[#64748b]">Lade Query-Results…</p>
            )}
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            {queryResults && queryResults.length === 0 && (
              <p className="text-xs text-[#64748b]">Keine Query-Results für diesen Report.</p>
            )}
            {queryResults && queryResults.length > 0 && (
              <ul className="space-y-3">
                {queryResults.map((q, idx) => (
                  <li key={q.id} className="border border-gray-100 rounded-lg p-3 bg-[#f8f9fb]">
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span className="font-medium text-[#0f172a]">#{idx + 1}</span>
                      <span className="text-[#64748b]">{q.model}</span>
                      {q.brand_mentioned && (
                        <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 font-medium">
                          Erwähnt
                        </span>
                      )}
                      {q.position != null && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[#64748b] font-medium">
                          Position {q.position}
                        </span>
                      )}
                      <SentimentBadge sentiment={q.sentiment} />
                    </div>
                    <p className="text-xs text-[#64748b] mb-1.5">
                      <span className="font-semibold uppercase tracking-wider mr-1">Prompt:</span>
                      {q.prompt}
                    </p>
                    {q.response && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[#4F6EF7] hover:underline">
                          Response anzeigen
                        </summary>
                        <pre className="mt-1.5 whitespace-pre-wrap text-[#0f172a] bg-white border border-gray-100 rounded p-2">
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
            <p className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8] mb-1.5">Raw Data (jsonb)</p>
            <pre className="text-[10px] text-[#0f172a] bg-[#f8f9fb] border border-gray-100 rounded-lg p-3 overflow-x-auto max-h-96 overflow-y-auto">
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
    scheduled: "bg-blue-50 text-[#4F6EF7] border-blue-100",
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
    return <span className="text-xs text-[#94a3b8]">—</span>
  }
  const styles: Record<string, string> = {
    positive: "bg-green-50 text-green-600 border-green-100",
    neutral:  "bg-gray-100 text-[#64748b] border-gray-200",
    negative: "bg-red-50 text-red-600 border-red-100",
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
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94a3b8] mb-0.5">{label}</p>
      <p className="text-sm text-[#0f172a]">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg px-3 py-2 bg-[#f8f9fb]">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94a3b8]">{label}</p>
      <p className="text-sm text-[#0f172a] mt-0.5">{value}</p>
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
    ? "bg-red-50 border-red-100 text-red-600"
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

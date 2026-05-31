import Link from "next/link"
import { getStats, getOverdueSchedules, getIntegrityScan, type StatsSnapshot, type IntegrityScan } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

const CODE_LABELS: Record<string, string> = {
  MENTION_WITHOUT_NAME: "Treffer ohne Namensbeleg",
  PERFECT_SCORE_NO_EVIDENCE: "Top-Score ohne Beleg",
  MENTIONRATE_PRESENCE_MISMATCH: "Rate/Präsenz-Widerspruch",
  SCORE_OUT_OF_RANGE: "Score außerhalb 0–100",
}

export default async function StatsPage() {
  let stats: StatsSnapshot | null = null
  let overdue: Awaited<ReturnType<typeof getOverdueSchedules>> = []
  let integrity: IntegrityScan = { scannedCount: 0, flagged: [] }
  let loadError: string | null = null

  try {
    const [s, o, i] = await Promise.all([getStats(), getOverdueSchedules(20), getIntegrityScan(100)])
    stats = s
    overdue = o
    integrity = i
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Unbekannter Fehler"
  }

  if (loadError) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
        <p className="text-xs text-red-600 font-medium">{loadError}</p>
      </div>
    )
  }
  if (!stats) {
    return <p className="text-sm text-[#64748b]">Lade Statistiken…</p>
  }

  const totalUsers = stats.users.total
  const activeUsers = totalUsers - stats.users.banned

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-base font-semibold text-[#0f172a]">Statistiken</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Live-Snapshot · zuletzt aktualisiert {new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </header>

      {/* ───────── Top KPI cards ───────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Nutzer (gesamt)" value={totalUsers} sub={`${activeUsers} aktiv · ${stats.users.banned} gesperrt`} />
        <Kpi label="Admins" value={stats.users.admins} sub="mit is_admin=true" />
        <Kpi label="Aktive Topics" value={stats.schedules.active} sub={`${stats.schedules.total} gesamt`} />
        <Kpi label="Reports (gesamt)" value={stats.reports.total} sub={`${stats.reports.last7d} in den letzten 7 Tagen`} />
      </div>

      {/* ───────── Score-Integrität ───────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a]">Score-Integrität</h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Automatische Plausibilitätsprüfung der letzten {integrity.scannedCount} Reports (validateReportIntegrity)
            </p>
          </div>
          {integrity.flagged.length === 0 ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium whitespace-nowrap">
              ✓ keine Auffälligkeiten
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 font-medium whitespace-nowrap">
              {integrity.flagged.length} auffällig
            </span>
          )}
        </div>

        {integrity.flagged.length === 0 ? (
          <p className="text-sm text-[#64748b] mt-4">
            Alle geprüften Reports sind plausibel: markierte Treffer enthalten den Namen im Antworttext,
            Scores liegen im gültigen Bereich.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 mt-4">
            {integrity.flagged.map((f) => (
              <div key={f.reportId} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0f172a]">{f.name}</p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    {new Date(f.date).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                    {f.score !== null && ` · Score ${f.score}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {f.codes.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                        {CODE_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-red-600 font-medium tabular-nums flex-shrink-0">
                  {f.violationCount} Verstöße
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[#94a3b8] mt-4">
          Auffällige Reports sollten neu analysiert oder gelöscht werden. Wettbewerber-Reports werden bereits
          zur Schreibzeit im Haupt-Tool durch dieselbe Invariante geprüft.
        </p>
      </section>

      {/* ───────── Plan distribution ───────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-[#0f172a]">Tarif-Verteilung</h2>
        <p className="text-xs text-[#64748b] mt-0.5 mb-4">Nutzer pro Plan</p>
        <PlanDistribution byPlan={stats.users.byPlan} total={totalUsers} />
      </section>

      {/* ───────── Reports per day (7d) ───────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-[#0f172a]">Reports pro Tag</h2>
        <p className="text-xs text-[#64748b] mt-0.5 mb-4">
          Letzte 7 Tage · {stats.reports.last7d} Reports gesamt
        </p>
        <DailyBarChart data={stats.reports.dailyLast7d} />
      </section>

      {/* ───────── Cron Health ───────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-[#0f172a]">Cron-Health</h2>
        <p className="text-xs text-[#64748b] mt-0.5 mb-4">
          Status des täglichen Cron-Jobs (/api/cron/run-scheduled-checks im Haupt-Projekt)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <HealthCard
            label="Letzter Cron-Run"
            ok={isCronHealthy(stats.schedules.lastScheduledRunAt)}
            value={stats.schedules.lastScheduledRunAt ? new Date(stats.schedules.lastScheduledRunAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"}
            sub={stats.schedules.lastScheduledRunAt ? relativeTime(stats.schedules.lastScheduledRunAt) : "Cron hat noch nie gelaufen"}
          />
          <HealthCard
            label="Letzte Aktivität"
            ok
            value={stats.schedules.lastActivityAt ? new Date(stats.schedules.lastActivityAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"}
            sub={stats.schedules.lastActivityAt ? `inkl. manuelle Runs · ${relativeTime(stats.schedules.lastActivityAt)}` : "Noch nie ausgeführt"}
          />
          <HealthCard
            label="Überfällige Topics"
            ok={stats.schedules.overdueCount === 0}
            value={stats.schedules.overdueCount}
            sub={stats.schedules.overdueCount === 0 ? "Alle Schedules pünktlich" : "next_run_at liegt > 6h in der Vergangenheit"}
          />
          <HealthCard
            label="Aktive vs. Inaktiv"
            ok
            value={`${stats.schedules.active}/${stats.schedules.total}`}
            sub={`${stats.schedules.total - stats.schedules.active} inaktiv`}
          />
        </div>
      </section>

      {/* ───────── Overdue list ───────── */}
      {overdue.length > 0 && (
        <section className="bg-white rounded-xl border border-amber-100 shadow-sm">
          <header className="px-6 py-4 border-b border-amber-100 bg-amber-50/30">
            <h2 className="text-sm font-semibold text-[#0f172a]">Überfällige Schedules</h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Aktive Topics mit next_run_at &gt; 6h in der Vergangenheit (Top {overdue.length})
            </p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-[#f8f9fb] border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Topic</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Nutzer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Cadence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Nächster Run</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Überfällig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overdue.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-[#0f172a]">{s.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {s.profile_email ? (
                      <Link href={`/dashboard/users/${s.profile_id}`} className="text-[#4F6EF7] hover:underline">
                        {s.profile_email}
                      </Link>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748b] capitalize">{s.frequency}</td>
                  <td className="px-4 py-3 text-xs text-[#64748b]">
                    {new Date(s.next_run_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">
                      {s.hours_overdue}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

/* ──────────────────────────── Subcomponents ──────────────────────────── */

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94a3b8]">{label}</p>
      <p className="text-2xl font-semibold text-[#0f172a] mt-1">{value}</p>
      {sub && <p className="text-xs text-[#64748b] mt-1">{sub}</p>}
    </div>
  )
}

function HealthCard({ label, value, sub, ok }: { label: string; value: number | string; sub?: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${ok ? "border-gray-100 bg-[#f8f9fb]" : "border-amber-100 bg-amber-50/30"}`}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94a3b8]">{label}</p>
      </div>
      <p className="text-base font-semibold text-[#0f172a] mt-1">{value}</p>
      {sub && <p className="text-xs text-[#64748b] mt-0.5">{sub}</p>}
    </div>
  )
}

function PlanDistribution({ byPlan, total }: { byPlan: Record<string, number>; total: number }) {
  const plans = Object.entries(byPlan)
  if (total === 0) {
    return <p className="text-xs text-[#94a3b8]">Keine Nutzer.</p>
  }
  return (
    <div className="space-y-2">
      {plans.map(([plan, count]) => {
        const pct = total === 0 ? 0 : Math.round((count / total) * 100)
        return (
          <div key={plan} className="flex items-center gap-3 text-xs">
            <span className="w-20 text-[#64748b] capitalize">{PLAN_LABEL[plan] ?? plan}</span>
            <div className="flex-1 h-5 bg-[#f8f9fb] rounded-md overflow-hidden border border-gray-100">
              <div className="h-full bg-[#4F6EF7] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-16 text-right text-[#0f172a] font-medium">
              {count} <span className="text-[#94a3b8]">({pct}%)</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DailyBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const width = 700
  const height = 180
  const padding = { left: 32, right: 12, top: 12, bottom: 28 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const barWidth = innerW / data.length - 8

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet" className="block">
      {[0, 0.5, 1].map((t) => {
        const y = padding.top + innerH - innerH * t
        const value = Math.round(max * t)
        return (
          <g key={t}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="2 3" />
            <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{value}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const x = padding.left + i * (innerW / data.length) + 4
        const barH = (d.count / max) * innerH
        const y = padding.top + innerH - barH
        const isToday = i === data.length - 1
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barWidth} height={barH} fill={isToday ? "#4F6EF7" : "#A5B4FC"} rx="3" />
            {d.count > 0 && (
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="600">{d.count}</text>
            )}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function isCronHealthy(iso: string | null): boolean {
  if (!iso) return false
  const ageMs = Date.now() - new Date(iso).getTime()
  return ageMs < 26 * 60 * 60 * 1000
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "gerade eben"
  if (minutes < 60) return `vor ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} h`
  const days = Math.round(hours / 24)
  return `vor ${days} Tagen`
}

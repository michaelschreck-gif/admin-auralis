"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import type { TeamRow } from "@/lib/supabase/admin"
import { actionCreateTeam } from "../api"
import {
  ModalShell, Field, ErrorBox, UserPicker, extractError,
  inputCls, btnPrimary, btnGhost,
} from "../ui"

export default function TeamsClient({
  teams,
  loadError,
}: {
  teams: TeamRow[]
  loadError: string | null
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const shown = q ? teams.filter(t => t.name.toLowerCase().includes(q)) : teams
  const totalMembers = teams.reduce((n, t) => n + t.memberCount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Team suchen…"
          className="bg-white border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:border-[var(--accent)]"
        />
        <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}>
          + Team anlegen
        </button>
        <span className="text-sm text-[var(--text-muted)]">
          {teams.length} Teams · {totalMembers} Zuordnungen
        </span>
      </div>

      {loadError && <ErrorBox>{loadError}</ErrorBox>}

      <div className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)]">
            <tr>
              {["Team", "Mitglieder", "Erstellt"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{h}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[var(--text-faint)] text-sm">
                  {teams.length === 0 ? "Noch keine Teams. Lege das erste mit „+ Team anlegen“ an." : "Kein Team gefunden."}
                </td>
              </tr>
            )}
            {shown.map(t => (
              <tr key={t.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/teams/${t.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{t.memberCount}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {new Date(t.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/teams/${t.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    Verwalten
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateTeamModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await actionCreateTeam({ name, memberIds })
        router.push(`/dashboard/teams/${res.id}`)
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Team anlegen">
      <Field label="Teamname / Firma">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Muster GmbH" autoFocus className={inputCls} />
      </Field>
      <Field
        label={`Mitglieder auswählen (${memberIds.length})`}
        hint="Beliebig viele. Eine Person kann in mehreren Teams sein. Neue Konten legst du danach in der Teamansicht an."
      >
        <UserPicker
          mode="multi"
          selected={memberIds}
          onChange={setMemberIds}
          disabledReason={() => null}
          noteFor={u => (u.teams.length ? `in: ${u.teams.join(", ")}` : null)}
        />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
        <button type="button" onClick={save} disabled={isPending || !name.trim()} className={btnPrimary}>
          {isPending ? "Legt an…" : memberIds.length ? `Team mit ${memberIds.length} Mitgliedern anlegen` : "Team anlegen"}
        </button>
      </div>
    </ModalShell>
  )
}

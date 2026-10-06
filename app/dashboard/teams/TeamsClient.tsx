"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import type { TeamRow, LanguageType } from "@/lib/supabase/admin"
import { validatePassword } from "@/lib/accounts"
import { actionCreateTeam } from "../actions"
import {
  ModalShell, Field, PasswordField, ErrorBox, extractError,
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
  const shown = q
    ? teams.filter(t =>
        (t.owner.full_name ?? "").toLowerCase().includes(q) || t.owner.email.toLowerCase().includes(q))
    : teams
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
          {teams.length} Teams · {totalMembers} Mitglieder
        </span>
      </div>

      {loadError && <ErrorBox>{loadError}</ErrorBox>}

      <div className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)]">
            <tr>
              {["Team", "Inhaber", "Mitglieder", "Tarif", "Erstellt"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{h}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[var(--text-faint)] text-sm">
                  {teams.length === 0 ? "Noch keine Teams. Lege das erste mit „+ Team anlegen“ an." : "Kein Team gefunden."}
                </td>
              </tr>
            )}
            {shown.map(t => (
              <tr key={t.owner.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/teams/${t.owner.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
                    {t.owner.full_name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{t.owner.email}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{t.memberCount}</td>
                <td className="px-4 py-3 text-xs capitalize text-[var(--text-muted)]">{t.owner.plan}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {new Date(t.owner.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/teams/${t.owner.id}`}
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
  const [teamName, setTeamName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [password, setPassword] = useState("")
  const [language, setLanguage] = useState<LanguageType>("de")
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; email: string; password: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    const v = validatePassword(password)
    if (v) { setError(v); return }
    setError(null)
    startTransition(async () => {
      try {
        const res = await actionCreateTeam({ teamName, ownerEmail, password, language })
        setCreated({ id: res.id, email: ownerEmail.trim().toLowerCase(), password })
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Team anlegen">
      {created ? (
        <>
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 space-y-1">
            <p className="text-xs text-green-700 font-medium">Team angelegt. Zugangsdaten des Inhabers, werden nicht noch einmal angezeigt:</p>
            <p className="text-sm text-green-800 break-all">{created.email}</p>
            <p className="text-sm font-mono text-green-800 select-all break-all">{created.password}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnGhost}>Schließen</button>
            <button type="button" onClick={() => router.push(`/dashboard/teams/${created.id}`)} className={btnPrimary}>
              Mitglieder hinzufügen →
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Ein Team besteht aus einem Inhaber (Enterprise-Konto mit Login) und beliebig vielen Mitgliedern, die du danach anlegst.
          </p>
          <Field label="Teamname / Firma">
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="z.B. Muster GmbH" autoFocus className={inputCls} />
          </Field>
          <Field label="E-Mail des Inhabers">
            <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="inhaber@firma.de" className={inputCls} />
          </Field>
          <PasswordField value={password} onChange={setPassword} hint="Mindestens 10 Zeichen." />
          <Field label="Sprache">
            <select value={language} onChange={e => setLanguage(e.target.value as LanguageType)} className={inputCls}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="it">Italiano</option>
              <option value="nl">Nederlands</option>
              <option value="pt">Português</option>
            </select>
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
            <button type="button" onClick={save} disabled={isPending || !teamName.trim() || !ownerEmail.trim() || !password} className={btnPrimary}>
              {isPending ? "Legt an…" : "Team anlegen"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

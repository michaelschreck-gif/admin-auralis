"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import type { Profile, LanguageType, Team } from "@/lib/supabase/admin"
import { validatePassword } from "@/lib/accounts"
import {
  actionRenameTeam,
  actionCreateTeamMember,
  actionAddUsersToTeam,
  actionRemoveFromTeam,
  actionDeleteUser,
  actionDeleteTeam,
  actionBanUser,
  actionUnbanUser,
} from "@/app/dashboard/api"
import {
  ModalShell, Field, PasswordField, SetPasswordModal, ErrorBox, UserPicker, extractError,
  inputCls, btnPrimary, btnGhost, btnSmall,
} from "@/app/dashboard/ui"

export default function TeamDetailClient({
  team,
  members,
  currentAdminId,
}: {
  team: Team
  members: Profile[]
  currentAdminId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(team.name)
  const [passwordFor, setPasswordFor] = useState<Profile | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [existingOpen, setExistingOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteTeamOpen, setDeleteTeamOpen] = useState(false)

  function run(fn: () => Promise<void>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        after?.()
        router.refresh()
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  const label = (p: Profile) => (p.full_name ? `${p.full_name} (${p.email})` : p.email)

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3">
          <div className="flex-1"><ErrorBox>{error}</ErrorBox></div>
          <button type="button" onClick={() => setError(null)} className="text-xs text-[var(--danger)]">✕</button>
        </div>
      )}

      {/* Team / Inhaber */}
      <section className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem] space-y-1.5">
            <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Teamname</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <button
            type="button"
            disabled={isPending || !name.trim() || name.trim() === team.name}
            onClick={() => run(() => actionRenameTeam(team.id, name))}
            className={btnPrimary}
          >
            Umbenennen
          </button>
        </div>
      </section>

      {/* Mitglieder */}
      <section className="bg-white rounded-xl border border-[var(--border-subtle)] shadow-sm">
        <header className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Mitglieder</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{members.length} im Team</p>
          </div>
          <button type="button" onClick={() => setExistingOpen(true)} className={btnSmall}>Bestehende Konten hinzufügen</button>
          <button type="button" onClick={() => setAddOpen(true)} className={btnPrimary}>+ Mitglied anlegen</button>
        </header>

        {members.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-faint)]">Noch keine Mitglieder.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {members.map(m => {
              const isSelf = m.id === currentAdminId
              const banned = !!m.banned_at
              return (
                <li key={m.id} className={`px-6 py-3 flex flex-wrap items-center gap-3 ${banned ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/dashboard/users/${m.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
                      {m.full_name ?? "—"}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
                  </div>
                  {banned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] font-medium border border-[var(--danger)]/20">Gesperrt</span>
                  )}
                  <button type="button" disabled={isPending} onClick={() => setPasswordFor(m)} className={btnSmall}>Passwort</button>
                  <button
                    type="button"
                    disabled={isPending || isSelf}
                    onClick={() => run(() => (banned ? actionUnbanUser(m.id) : actionBanUser(m.id)))}
                    className={btnSmall}
                  >
                    {banned ? "Entsperren" : "Sperren"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => actionRemoveFromTeam(m.id, team.id))}
                    className={btnSmall}
                    title="Konto und andere Teams bleiben bestehen"
                  >
                    Aus Team entfernen
                  </button>
                  {confirmDelete === m.id ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending || isSelf}
                        onClick={() => run(() => actionDeleteUser(m.id), () => setConfirmDelete(null))}
                        className="text-xs px-3 py-1.5 rounded-lg border bg-[var(--danger)] text-white border-[var(--danger)]"
                      >
                        Endgültig löschen
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-[var(--text-faint)]">✕</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending || isSelf}
                      onClick={() => setConfirmDelete(m.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--danger)]/25 hover:text-[var(--danger)] transition-colors disabled:opacity-40"
                    >
                      Löschen
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Gefahrenzone */}
      <section className="bg-white rounded-xl border border-[var(--danger)]/20 shadow-sm p-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[16rem]">
          <h2 className="text-sm font-semibold text-[var(--danger)]">Team löschen</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Löscht das Team. Die Konten der Mitglieder kannst du dabei behalten oder mitlöschen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteTeamOpen(true)}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded-lg border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
        >
          Team löschen…
        </button>
      </section>

      {passwordFor && (
        <SetPasswordModal userId={passwordFor.id} label={label(passwordFor)} onClose={() => setPasswordFor(null)} />
      )}
      {addOpen && (
        <AddMemberModal teamId={team.id} onClose={() => { setAddOpen(false); router.refresh() }} />
      )}
      {existingOpen && (
        <AddExistingModal teamId={team.id} memberIds={members.map(m => m.id)} onClose={() => { setExistingOpen(false); router.refresh() }} />
      )}
      {deleteTeamOpen && (
        <DeleteTeamModal
          teamId={team.id}
          name={team.name}
          memberCount={members.length}
          onClose={() => setDeleteTeamOpen(false)}
          onDone={() => router.push("/dashboard/teams")}
        />
      )}
    </div>
  )
}

function AddMemberModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [language, setLanguage] = useState<LanguageType>("de")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string; password: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    if (password) {
      const v = validatePassword(password)
      if (v) { setError(v); return }
    }
    setError(null)
    startTransition(async () => {
      try {
        await actionCreateTeamMember(teamId, { fullName, email, password: password || undefined, language })
        setDone({ email: email.trim().toLowerCase(), password })
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Mitglied anlegen">
      {done ? (
        <>
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 space-y-1">
            <p className="text-xs text-green-700 font-medium">
              {done.password ? "Mitglied angelegt. Zugangsdaten, werden nicht noch einmal angezeigt:" : "Mitglied angelegt (verwaltetes Konto ohne eigenen Login)."}
            </p>
            <p className="text-sm text-green-800 break-all">{done.email}</p>
            {done.password && <p className="text-sm font-mono text-green-800 select-all break-all">{done.password}</p>}
          </div>
          <div className="flex justify-end pt-2"><button type="button" onClick={onClose} className={btnPrimary}>Fertig</button></div>
        </>
      ) : (
        <>
          <Field label="Name">
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus className={inputCls} />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <PasswordField
            value={password}
            onChange={setPassword}
            optional
            hint="Leer lassen = verwaltetes Konto ohne eigenen Login (wie im Team-Bereich des Tools). Mit Passwort kann sich die Person selbst anmelden."
          />
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
            <button type="button" onClick={save} disabled={isPending || !fullName.trim() || !email.trim()} className={btnPrimary}>
              {isPending ? "Legt an…" : "Anlegen"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

function AddExistingModal({
  memberIds,
  teamId,
  onClose,
}: {
  teamId: string
  memberIds: string[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await actionAddUsersToTeam(teamId, selected)
        setAdded(res.added)
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Bestehende Konten hinzufügen">
      {added !== null ? (
        <>
          <p className="text-sm text-green-700">{added} {added === 1 ? "Konto wurde" : "Konten wurden"} dem Team zugeordnet.</p>
          <div className="flex justify-end pt-2"><button type="button" onClick={onClose} className={btnPrimary}>Fertig</button></div>
        </>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">Wähle beliebig viele Personen aus. Sie können gleichzeitig in anderen Teams bleiben.</p>
          <UserPicker
            mode="multi"
            selected={selected}
            onChange={setSelected}
            disabledReason={u => (memberIds.includes(u.id) ? "Schon im Team" : null)}
            noteFor={u => {
              const others = u.teams.filter((_, i) => u.teamIds[i] !== teamId)
              return others.length ? `auch in: ${others.join(", ")}` : null
            }}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
            <button type="button" onClick={save} disabled={isPending || selected.length === 0} className={btnPrimary}>
              {isPending ? "Fügt hinzu…" : `Hinzufügen (${selected.length})`}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

function DeleteTeamModal({
  teamId, name, memberCount, onClose, onDone,
}: {
  teamId: string
  name: string
  memberCount: number
  onClose: () => void
  onDone: () => void
}) {
  const [withMembers, setWithMembers] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        await actionDeleteTeam(teamId, withMembers)
        onDone()
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Team löschen">
      <p className="text-sm text-[var(--foreground)]">
        Das Team <span className="font-semibold">{name}</span> wird endgültig gelöscht.
      </p>
      {memberCount > 0 && (
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border border-[var(--border-subtle)] rounded-lg cursor-pointer">
            <input type="radio" checked={!withMembers} onChange={() => setWithMembers(false)} className="mt-0.5 accent-[var(--accent)]" />
            <span className="text-sm">Alle {memberCount} Mitglieder behalten (nur das Team verschwindet)</span>
          </label>
          <label className="flex items-start gap-3 p-3 border border-[var(--danger)]/30 rounded-lg cursor-pointer">
            <input type="radio" checked={withMembers} onChange={() => setWithMembers(true)} className="mt-0.5 accent-[var(--danger)]" />
            <span className="text-sm text-[var(--danger)]">Auch die Konten aller {memberCount} Mitglieder samt Daten löschen (auch wenn sie in anderen Teams sind)</span>
          </label>
        </div>
      )}
      <Field label={`Zur Bestätigung „${name}“ eintippen`}>
        <input type="text" value={typed} onChange={e => setTyped(e.target.value)} className={inputCls} />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending || typed.trim() !== name}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--danger)] text-white font-medium disabled:opacity-40"
        >
          {isPending ? "Löscht…" : "Endgültig löschen"}
        </button>
      </div>
    </ModalShell>
  )
}

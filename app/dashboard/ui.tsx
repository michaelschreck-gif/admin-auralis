"use client"

import { useEffect, useState, useTransition } from "react"
import { actionSetPassword, actionSearchUsers } from "./api"
import type { PickerUser } from "./actions"
import { generatePassword, validatePassword } from "@/lib/accounts"

export const inputCls =
  "w-full bg-white border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"

export const btnPrimary =
  "text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"

export const btnGhost =
  "text-sm px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50"

export const btnSmall =
  "text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

export function extractError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  return "Unbekannter Fehler."
}

export function ModalShell({
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
        className="w-full max-w-md bg-white rounded-2xl border border-[var(--border-subtle)] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--foreground)] text-lg leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
    </div>
  )
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)]/20 px-4 py-3">
      <p className="text-xs text-[var(--danger)] font-medium">{children}</p>
    </div>
  )
}

/** Passwortfeld mit Generator, Anzeigen und Kopieren. */
export function PasswordField({
  value,
  onChange,
  optional,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  optional?: boolean
  hint?: string
}) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  return (
    <Field label={optional ? "Passwort (optional)" : "Passwort"} hint={hint}>
      <div className="flex gap-2">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => { onChange(generatePassword()); setVisible(true) }}
          className={btnSmall + " whitespace-nowrap"}
        >
          Erzeugen
        </button>
      </div>
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => setVisible(v => !v)} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          {visible ? "Verbergen" : "Anzeigen"}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          className="text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-40"
        >
          {copied ? "Kopiert ✓" : "Kopieren"}
        </button>
      </div>
    </Field>
  )
}

/** Neues Passwort für ein bestehendes Konto setzen. */
export function SetPasswordModal({
  userId,
  label,
  onClose,
}: {
  userId: string
  label: string
  onClose: () => void
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    const v = validatePassword(password)
    if (v) { setError(v); return }
    setError(null)
    startTransition(async () => {
      try {
        await actionSetPassword(userId, password)
        setDone(password)
      } catch (e) {
        setError(extractError(e))
      }
    })
  }

  return (
    <ModalShell onClose={onClose} title="Neues Passwort setzen">
      <p className="text-xs text-[var(--text-muted)]">
        Konto: <span className="font-medium text-[var(--foreground)]">{label}</span>. Das alte Passwort ist danach sofort ungültig.
      </p>
      {done ? (
        <>
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 space-y-1">
            <p className="text-xs text-green-700 font-medium">Passwort wurde gesetzt. Gib es jetzt weiter, es wird nicht noch einmal angezeigt:</p>
            <p className="text-sm font-mono text-green-800 select-all break-all">{done}</p>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={onClose} className={btnPrimary}>Fertig</button>
          </div>
        </>
      ) : (
        <>
          <PasswordField value={password} onChange={setPassword} hint="Mindestens 10 Zeichen." />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isPending} className={btnGhost}>Abbrechen</button>
            <button type="button" onClick={save} disabled={isPending || !password} className={btnPrimary}>
              {isPending ? "Speichert…" : "Passwort setzen"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

/**
 * Suchliste für bestehende Nutzer. `disabledReason` liefert pro Person einen
 * Grund, warum sie nicht wählbar ist (oder null).
 */
export function UserPicker({
  mode,
  selected,
  onChange,
  disabledReason,
  noteFor,
}: {
  mode: "single" | "multi"
  selected: string[]
  onChange: (ids: string[]) => void
  disabledReason: (u: PickerUser) => string | null
  noteFor?: (u: PickerUser) => string | null
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickerUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [known, setKnown] = useState<Record<string, PickerUser>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await actionSearchUsers(query)
        if (cancelled) return
        setResults(r)
        setKnown(k => ({ ...k, ...Object.fromEntries(r.map(u => [u.id, u])) }))
        setError(null)
      } catch (e) {
        if (!cancelled) setError(extractError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  function toggle(id: string) {
    if (mode === "single") onChange(selected[0] === id ? [] : [id])
    else onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Name oder E-Mail suchen…"
        className={inputCls}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(id => {
            const u = known[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="text-xs px-2 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20"
                title="Auswahl entfernen"
              >
                {u ? (u.full_name || u.email) : id.slice(0, 8)} ✕
              </button>
            )
          })}
        </div>
      )}
      <div className="border border-[var(--border-subtle)] rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-50">
        {error && <p className="p-3 text-xs text-[var(--danger)]">{error}</p>}
        {!error && results.length === 0 && (
          <p className="p-3 text-xs text-[var(--text-faint)]">{loading ? "Sucht…" : "Keine Treffer."}</p>
        )}
        {results.map(u => {
          const reason = disabledReason(u)
          const note = reason ?? noteFor?.(u) ?? null
          const checked = selected.includes(u.id)
          return (
            <label
              key={u.id}
              className={`flex items-center gap-3 px-3 py-2 text-sm ${reason ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--surface-muted)]"}`}
            >
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                checked={checked}
                disabled={!!reason}
                onChange={() => toggle(u.id)}
                className="accent-[var(--accent)]"
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[var(--foreground)]">{u.full_name || "—"}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">{u.email}</span>
              </span>
              {note && <span className="text-xs text-[var(--text-faint)] text-right">{note}</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

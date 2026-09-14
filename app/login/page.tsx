"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Verify admin status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("email", email)
      .single()

    if (!profile?.is_admin) {
      await supabase.auth.signOut()
      setError("Kein Admin-Zugang für diesen Account.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  const inputCls =
    "w-full bg-white border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"

  return (
    <div className="min-h-screen bg-[var(--surface-muted)] flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] shadow-sm p-8 space-y-6">

          {/* Branding */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center">
              <img src="/brand/combinationmark-black.svg" alt="DigitalHalo" className="h-7 w-auto" />
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium bg-[var(--surface-sunken)] inline-block px-3 py-1 rounded-full">
              Admin Panel
            </p>
            <div className="pt-2">
              <h1 className="text-xl font-semibold text-[var(--foreground)]">Admin-Login</h1>
              <p className="text-[var(--text-muted)] text-sm mt-1">Nur für autorisierte Administratoren</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputCls}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)]/20 px-4 py-3">
                <p className="text-xs text-[var(--danger)] font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--foreground)] hover:bg-[var(--accent-strong)] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border border-[var(--text-faint)] border-t-white rounded-full animate-spin" />
                  Anmelden…
                </span>
              ) : (
                "Anmelden"
              )}
            </button>
          </form>

          <p className="text-xs text-[var(--text-faint)] text-center">
            Noch kein Passwort? Setze es im Supabase Dashboard unter Authentication → Users.
          </p>
        </div>
      </div>
    </div>
  )
}

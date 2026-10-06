import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { actionSignOut } from "./actions"
import { NavLink, UsersIcon, TeamsIcon, StatsIcon, AuditIcon, HeaderTitle } from "./NavLink"
import type { ReactNode } from "react"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // createClient uses cookies() — wrap so build doesn't crash without env vars
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return redirect("/login")
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let profile: { full_name: string | null; email: string; is_admin: boolean } | null = null
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, is_admin")
      .eq("id", user.id)
      .single()
    profile = data
  } catch {
    return redirect("/login")
  }

  if (!profile?.is_admin) redirect("/login")

  return (
    <div className="flex h-screen bg-[var(--surface-muted)] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-[var(--border-subtle)] flex flex-col">
        <div className="h-[60px] flex items-center px-5 border-b border-[var(--border-subtle)] gap-2.5">
          <img src="/brand/combinationmark-black.svg" alt="DigitalHalo" className="h-5 w-auto flex-shrink-0" />
          <span className="text-[10px] text-[var(--text-faint)] bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded font-medium">
            Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink href="/dashboard" icon={<UsersIcon />}>
            Nutzer
          </NavLink>
          <NavLink href="/dashboard/teams" icon={<TeamsIcon />}>
            Teams
          </NavLink>
          <NavLink href="/dashboard/stats" icon={<StatsIcon />}>
            Statistiken
          </NavLink>
          <NavLink href="/dashboard/audit" icon={<AuditIcon />}>
            Audit-Log
          </NavLink>
        </nav>

        <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-2">
          <p className="text-xs text-[var(--text-muted)] truncate">{profile?.email ?? ""}</p>
          <form action={actionSignOut}>
            <button
              type="submit"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Abmelden →
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-[60px] flex-shrink-0 bg-white border-b border-[var(--border-subtle)] flex items-center px-6 gap-4">
          <HeaderTitle />
          <div className="flex-1" />
          <span className="text-xs text-[var(--text-faint)]">
            Angemeldet als{" "}
            <span className="text-[var(--text-muted)] font-medium">{profile?.email ?? ""}</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

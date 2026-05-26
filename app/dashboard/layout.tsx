import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { actionSignOut } from "./actions"
import { NavLink, UsersIcon, StatsIcon, HeaderTitle } from "./NavLink"
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
    <div className="flex h-screen bg-[#f8f9fb] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="h-[60px] flex items-center px-5 border-b border-gray-100 gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0f172a] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div>
            <span className="text-[#0f172a] font-semibold text-sm tracking-tight">Auralis</span>
            <span className="ml-2 text-[10px] text-[#94a3b8] bg-gray-100 px-1.5 py-0.5 rounded font-medium">
              Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink href="/dashboard" icon={<UsersIcon />}>
            Nutzer
          </NavLink>
          <NavLink href="/dashboard/stats" icon={<StatsIcon />}>
            Statistiken
          </NavLink>
        </nav>

        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <p className="text-xs text-[#64748b] truncate">{profile?.email ?? ""}</p>
          <form action={actionSignOut}>
            <button
              type="submit"
              className="text-xs text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Abmelden →
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-[60px] flex-shrink-0 bg-white border-b border-gray-100 flex items-center px-6 gap-4">
          <HeaderTitle />
          <div className="flex-1" />
          <span className="text-xs text-[#94a3b8]">
            Angemeldet als{" "}
            <span className="text-[#64748b] font-medium">{profile?.email ?? ""}</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

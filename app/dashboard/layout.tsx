import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { actionSignOut } from "./actions"
import type { ReactNode } from "react"

export const dynamic = "force-dynamic"

const NAV = [
  { href: "/dashboard", label: "Nutzer", icon: "users" },
] as const

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Verify admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/login")

  return (
    <div className="flex h-screen bg-[#f8f9fb] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-50 text-[#4F6EF7]"
            >
              <UsersIcon />
              {item.label}
            </a>
          ))}
        </nav>

        {/* User + Signout */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <p className="text-xs text-[#64748b] truncate">{profile.email}</p>
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
        {/* Topbar */}
        <header className="h-[60px] flex-shrink-0 bg-white border-b border-gray-100 flex items-center px-6 gap-4">
          <span className="text-sm font-semibold text-[#0f172a]">Nutzerverwaltung</span>
          <div className="flex-1" />
          <span className="text-xs text-[#94a3b8]">
            Angemeldet als <span className="text-[#64748b] font-medium">{profile.email}</span>
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 13c0-2.485 2.015-4.5 4.5-4.5S10 10.515 10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M10.5 6.5a2 2 0 1 0 0-4M14 13c0-2-1.343-3.5-3-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

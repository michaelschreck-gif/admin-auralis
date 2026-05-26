"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  // `/dashboard` matches /dashboard exactly and /dashboard/users/* (default page)
  // `/dashboard/stats` matches only /dashboard/stats
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/dashboard/users")
      : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-50 text-[#4F6EF7]"
          : "text-[#64748b] hover:bg-gray-50 hover:text-[#0f172a]"
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}

export function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 13c0-2.485 2.015-4.5 4.5-4.5S10 10.515 10 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M10.5 6.5a2 2 0 1 0 0-4M14 13c0-2-1.343-3.5-3-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function StatsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5"  y="9"  width="2.5" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6.25" y="6"  width="2.5" height="7.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="11"   y="3"  width="2.5" height="10.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

/** Reactive page title rendered in the header. */
export function HeaderTitle() {
  const pathname = usePathname()
  let title = "Auralis Admin"
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/users")) {
    title = "Nutzerverwaltung"
  } else if (pathname.startsWith("/dashboard/stats")) {
    title = "Statistiken"
  } else if (pathname.startsWith("/dashboard/audit")) {
    title = "Audit-Log"
  }
  return <span className="text-sm font-semibold text-[#0f172a]">{title}</span>
}

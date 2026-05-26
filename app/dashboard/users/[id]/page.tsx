import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  getUserById,
  getSchedulesForProfile,
  getReportsForProfile,
  type Profile,
  type MonitoringSchedule,
  type VisibilityReport,
} from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import UserDetailClient from "./UserDetailClient"

export const dynamic = "force-dynamic"

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Current admin's ID for self-action guards (layout already verified is_admin).
  let currentAdminId = ""
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    currentAdminId = user?.id ?? ""
  } catch {
    // build-time render
  }

  let profile: Profile | null = null
  let schedules: MonitoringSchedule[] = []
  let reports: VisibilityReport[] = []
  let loadError: string | null = null

  try {
    const [profileRes, schedulesRes, reportsRes] = await Promise.all([
      getUserById(id),
      getSchedulesForProfile(id),
      getReportsForProfile(id, 25),
    ])

    // Destructure first so TS narrows each piece independently
    const profileError = profileRes.error
    const profileData = profileRes.data

    if (profileError) {
      if (profileError.code === "PGRST116") notFound() // row not found
      throw new Error(profileError.message)
    }
    if (!profileData) {
      notFound()
    }

    profile = profileData
    schedules = schedulesRes.data ?? []
    reports = reportsRes.data ?? []
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Unbekannter Fehler beim Laden"
  }

  // Fallback redirect if profile is null but no notFound was thrown
  // (e.g. build-time render without service-role key)
  if (!profile && !loadError) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#64748b]">
        <Link href="/dashboard" className="hover:text-[#0f172a] transition-colors">
          Nutzerverwaltung
        </Link>
        <span className="text-[#cbd5e1]">›</span>
        <span className="text-[#0f172a] font-medium">
          {profile?.full_name ?? profile?.email ?? "Nutzer"}
        </span>
      </nav>

      {loadError && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-xs text-red-600 font-medium">{loadError}</p>
        </div>
      )}

      {profile && (
        <UserDetailClient
          profile={profile}
          schedules={schedules}
          reports={reports}
          currentAdminId={currentAdminId}
        />
      )}
    </div>
  )
}

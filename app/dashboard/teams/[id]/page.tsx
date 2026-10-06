import { notFound } from "next/navigation"
import Link from "next/link"
import { getTeam, getTeamMembers, type Team, type Profile } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import TeamDetailClient from "./TeamDetailClient"

export const dynamic = "force-dynamic"

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let currentAdminId = ""
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    currentAdminId = user?.id ?? ""
  } catch {
    // build-time render
  }

  let team: Team | null = null
  let members: Profile[] = []
  let loadError: string | null = null
  try {
    team = await getTeam(id)
    if (team) members = await getTeamMembers(id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Team konnte nicht geladen werden."
  }
  if (!team && !loadError) notFound()

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/teams" className="hover:text-[var(--foreground)] transition-colors">Teams</Link>
        <span className="text-[var(--border-subtle)]">›</span>
        <span className="text-[var(--foreground)] font-medium">{team?.name ?? "Team"}</span>
      </nav>
      {loadError && (
        <div className="rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)]/20 px-4 py-3">
          <p className="text-xs text-[var(--danger)] font-medium">{loadError}</p>
        </div>
      )}
      {team && <TeamDetailClient team={team} members={members} currentAdminId={currentAdminId} />}
    </div>
  )
}

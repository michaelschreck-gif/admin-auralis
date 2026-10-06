import { notFound } from "next/navigation"
import Link from "next/link"
import { getProfilesByIds, getTeamMembers, type Profile } from "@/lib/supabase/admin"
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

  let owner: Profile | null = null
  let members: Profile[] = []
  try {
    const [o] = await getProfilesByIds([id])
    owner = o ?? null
    members = await getTeamMembers(id)
  } catch {
    // service role unavailable at build time
  }
  if (!owner) notFound()

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/teams" className="hover:text-[var(--foreground)] transition-colors">Teams</Link>
        <span className="text-[var(--border-subtle)]">›</span>
        <span className="text-[var(--foreground)] font-medium">{owner.full_name ?? owner.email}</span>
      </nav>
      <TeamDetailClient owner={owner} members={members} currentAdminId={currentAdminId} />
    </div>
  )
}

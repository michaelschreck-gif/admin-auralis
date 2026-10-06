import { getTeams, type TeamRow } from "@/lib/supabase/admin"
import TeamsClient from "./TeamsClient"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  let teams: TeamRow[] = []
  let loadError: string | null = null
  try {
    teams = await getTeams()
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Teams konnten nicht geladen werden."
  }
  return <TeamsClient teams={teams} loadError={loadError} />
}

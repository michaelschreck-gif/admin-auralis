import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getReportWithQueryResults } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request

  // Admin auth gate
  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    return NextResponse.json(
      { error: "Auth client unavailable", detail: e instanceof Error ? e.message : "" },
      { status: 500 },
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden – admin required" }, { status: 403 })
  }

  const { id } = await params
  const { queryResults, queryResultsError } = await getReportWithQueryResults(id)

  if (queryResultsError) {
    return NextResponse.json(
      { error: "Failed to load query results", detail: queryResultsError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    queryResults: queryResults.map(q => ({
      id: q.id,
      model: q.model,
      prompt: q.prompt,
      response: q.response,
      brand_mentioned: q.brand_mentioned,
      sentiment: q.sentiment,
      position: q.position,
    })),
  })
}

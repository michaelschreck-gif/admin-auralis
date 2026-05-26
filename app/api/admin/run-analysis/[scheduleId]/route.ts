import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient, getScheduleById } from "@/lib/supabase/admin"
import { runAnalysisForSchedule } from "@/lib/auralis/runner"

// Anthropic fan-out can take 20–40s; give it some headroom on Vercel Hobby.
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  void request

  // 1. Auth: cookie session must belong to an admin
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

  // 2. Validate schedule
  const { scheduleId } = await params
  const { data: schedule, error: scheduleError } = await getScheduleById(scheduleId)
  if (scheduleError || !schedule) {
    return NextResponse.json(
      { error: "Schedule not found", detail: scheduleError?.message },
      { status: 404 },
    )
  }

  // 3. Run via the runner
  try {
    const result = await runAnalysisForSchedule(scheduleId, getAdminClient(), {
      trigger: "manual",
      advanceNextRunAt: false, // manual runs must NOT touch the cron schedule
    })
    return NextResponse.json({
      success: true,
      reportId: result.reportId,
      score: result.score,
      sentiment: result.sentiment,
      mentionRate: result.mentionRate,
      queryCount: result.queryCount,
    })
  } catch (e) {
    console.error(`Manual run-analysis failed for schedule ${scheduleId}:`, e)
    return NextResponse.json(
      {
        error: "Analysis failed",
        detail: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 },
    )
  }
}

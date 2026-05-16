import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return NextResponse.redirect(`${origin}/login?error=server_error`)
  }

  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .single()

  if (!profile?.is_admin) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=no_admin`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}

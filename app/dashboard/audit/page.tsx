import { getAuditLog, type AuditEntry, type AuditActionName, type AuditTargetType } from "@/lib/supabase/admin"
import AuditClient from "./AuditClient"

export const dynamic = "force-dynamic"

const ACTION_VALUES: AuditActionName[] = [
  "user.invite",
  "user.plan.update",
  "user.profile.update",
  "user.ban",
  "user.unban",
  "user.delete",
  "schedule.frequency.update",
  "schedule.toggle",
  "schedule.analyze.manual",
]

const TARGET_VALUES: AuditTargetType[] = ["user", "schedule"]
const WITHIN_VALUES = ["24", "168", "720", "all"] as const // hours

function parseAction(raw: string | undefined): AuditActionName | "all" {
  return (ACTION_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as AuditActionName)
    : "all"
}

function parseTargetType(raw: string | undefined): AuditTargetType | "all" {
  return (TARGET_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as AuditTargetType)
    : "all"
}

function parseWithin(raw: string | undefined): number | "all" {
  if (raw === "all") return "all"
  if ((WITHIN_VALUES as readonly string[]).includes(raw ?? "")) {
    return parseInt(raw!, 10)
  }
  return 168 // default: last 7d
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    action?: string
    target?: string
    within?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1"))
  const action = parseAction(params.action)
  const targetType = parseTargetType(params.target)
  const within = parseWithin(params.within)

  let entries: AuditEntry[] = []
  let totalCount = 0
  let loadError: string | null = null

  try {
    const { data, count } = await getAuditLog({
      page,
      pageSize: 50,
      action,
      targetType,
      withinHours: within,
    })
    entries = data ?? []
    totalCount = count ?? 0
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Unbekannter Fehler"
  }

  return (
    <AuditClient
      entries={entries}
      totalCount={totalCount}
      page={page}
      action={action}
      targetType={targetType}
      within={within}
      loadError={loadError}
    />
  )
}

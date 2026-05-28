/**
 * Analysis Runner – shared logic for triggering a visibility analysis on a single
 * schedule. Used by:
 *   - the daily cron (`trigger: "scheduled"`, advanceNextRunAt: true)
 *   - the user-facing manual trigger at /dashboard/analyze (`trigger: "manual"`)
 *   - the admin's "Analyse jetzt triggern" button (`trigger: "manual"`)
 *
 * Sprint 14 — Multi-Model: jeder Lauf fragt N Provider parallel (siehe providers.ts).
 * Der visibility_reports.visibility_score ist der Mean über alle Provider-Reports.
 * raw_data.perModelBreakdown enthält die per-Provider-Details für UI-Rendering.
 *
 * NOTE: keep this file logic-only (no Next.js imports) so it stays usable from
 * cron, API routes, server actions, and edge functions alike.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateVisibilityQueries, type QueryConfig } from "./queries"
import {
  extractMentionSignal,
  buildVisibilityReport,
  type QueryResult,
  type VisibilityReport,
} from "./analyzer"
import {
  providersForPlan,
  claudeProvider,
  type LLMProvider,
  type ProviderId,
} from "./providers"
import type { Database, Json } from "@/lib/supabase/database.types"

type SentimentType = Database["public"]["Enums"]["sentiment_type"]
type FrequencyType = Database["public"]["Enums"]["frequency_type"]
type TriggerType = Database["public"]["Enums"]["trigger_type"]
type PlanType = Database["public"]["Enums"]["plan_type"]

const AI_SIMULATION_SYSTEM_PROMPT = `You are a helpful AI assistant with broad knowledge about professionals, thought leaders, and experts across industries. When asked about experts in a field, you draw on your training knowledge to provide balanced, informative answers. You mention real people you have knowledge about. You respond naturally and helpfully, as you normally would to any user question. Do not add caveats about your knowledge cutoff unless directly relevant. Respond in the same language as the question.`

export function calcNextRunAt(frequency: FrequencyType, from: Date = new Date()): string {
  const d = new Date(from)
  if (frequency === "daily") d.setDate(d.getDate() + 1)
  else if (frequency === "weekly") d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

function deriveSentiment(sentiments: string[]): SentimentType | null {
  const active = sentiments.filter(s => s !== "not_mentioned")
  if (active.length === 0) return null
  const pos = active.filter(s => s === "positive").length
  const neg = active.filter(s => s === "negative").length
  if (pos > active.length / 2) return "positive"
  if (neg > active.length / 2) return "negative"
  return "neutral"
}

// ─── Multi-Model: Per-Provider Breakdown im raw_data ────────────────────────

export type PerModelBreakdown = {
  provider: ProviderId
  label: string
  modelTag: string
  overallScore: number
  mentionRate: number
  averagePosition: number | null
  scoreBreakdown: VisibilityReport["scoreBreakdown"]
  /** Anzahl der Anfragen, die für diesen Provider tatsächlich erfolgreich liefen. */
  successfulQueries: number
  /** Wenn dieser Provider gefailed ist, enthält das Feld den Fehler. */
  error?: string
}

/**
 * Erweiterte Form der VisibilityReport mit Multi-Modell-Aufschlüsselung.
 * Wird als raw_data in visibility_reports gespeichert.
 */
export type MultiModelVisibilityReport = VisibilityReport & {
  perModelBreakdown?: PerModelBreakdown[]
  /** Welche Provider erfolgreich gelaufen sind. */
  providersUsed?: ProviderId[]
}

/**
 * Berechnet den Mean-Report aus mehreren Provider-Reports.
 * Numerische Felder werden gemittelt, Topics + Narrativen werden gemerged.
 */
function aggregateReports(
  personName: string,
  topics: string[],
  reports: VisibilityReport[],
  allQueryResults: QueryResult[],
): VisibilityReport {
  if (reports.length === 0) {
    // Fallback: leerer Report (sollte nie passieren wenn min. 1 Provider erfolgreich war)
    return buildVisibilityReport(personName, topics, [])
  }
  if (reports.length === 1) {
    return reports[0]
  }

  const meanRound = (vals: number[]) =>
    Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)

  const meanOrNull = (vals: (number | null)[]) => {
    const filtered = vals.filter((v): v is number => v !== null)
    if (filtered.length === 0) return null
    return Math.round((filtered.reduce((a, b) => a + b, 0) / filtered.length) * 100) / 100
  }

  // Topics + Narratives mergen
  const dominantTopicsSet = new Set<string>()
  const narrativesSet = new Set<string>()
  reports.forEach(r => {
    r.dominantTopics.forEach(t => dominantTopicsSet.add(t))
    r.narratives.forEach(n => narrativesSet.add(n))
  })

  return {
    personName,
    topics,
    queriedAt: new Date().toISOString(),
    overallScore:   meanRound(reports.map(r => r.overallScore)),
    mentionRate:    meanRound(reports.map(r => r.mentionRate)),
    averagePosition: meanOrNull(reports.map(r => r.averagePosition)),
    dominantTopics: Array.from(dominantTopicsSet).slice(0, 8),
    narratives:     Array.from(narrativesSet).slice(0, 10),
    queryResults:   allQueryResults,
    scoreBreakdown: {
      presenceScore:       meanRound(reports.map(r => r.scoreBreakdown.presenceScore)),
      positionScore:       meanRound(reports.map(r => r.scoreBreakdown.positionScore)),
      contextScore:        meanRound(reports.map(r => r.scoreBreakdown.contextScore)),
      topicAlignmentScore: meanRound(reports.map(r => r.scoreBreakdown.topicAlignmentScore)),
    },
  }
}

/**
 * Führt die N Queries gegen einen Provider aus und gibt die QueryResults zurück.
 * Wirft NICHT — gibt stattdessen ein Result-Objekt mit `error` zurück, damit
 * ein Provider-Fehler nicht den ganzen Run killt.
 */
async function runProvider(
  provider: LLMProvider,
  queries: ReturnType<typeof generateVisibilityQueries>,
  targetName: string,
): Promise<{ queryResults: QueryResult[]; error?: string }> {
  try {
    const queryResults = await Promise.all(
      queries.map(async (query) => {
        const rawResponse = await provider.call(
          query.prompt,
          AI_SIMULATION_SYSTEM_PROMPT,
        )
        const qr = extractMentionSignal(
          rawResponse,
          targetName,
          query.id,
          query.weight,
          query.prompt,
          query.type,
        )
        return qr
      }),
    )
    return { queryResults }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[runner] provider ${provider.id} failed:`, message)
    return { queryResults: [], error: message }
  }
}

export type RunAnalysisResult = {
  reportId: string
  score: number
  sentiment: SentimentType | null
  mentionRate: number
  queryCount: number
  providersUsed: ProviderId[]
}

export type RunAnalysisOptions = {
  /** "scheduled" (cron) or "manual" (admin or user trigger) */
  trigger: TriggerType
  /** When true, also advance `next_run_at` after successful run (cron-only). */
  advanceNextRunAt?: boolean
  /** Optional override of which providers to use. Defaults to providersForPlan(profile.plan). */
  providerOverride?: LLMProvider[]
}

/**
 * Runs a single visibility analysis for the given schedule across all enabled providers.
 * Writes one `visibility_reports` row (with per-model breakdown in raw_data) and
 * N×M `query_results` rows (where N=queries, M=providers).
 *
 * Throws on any failure that prevents persisting at all — provider-level failures
 * are absorbed and reported via perModelBreakdown.error.
 */
export async function runAnalysisForSchedule(
  scheduleId: string,
  supabase: SupabaseClient<Database>,
  options: RunAnalysisOptions,
): Promise<RunAnalysisResult> {
  // 1. Load the schedule + owning profile (to determine plan + provider set)
  const { data: schedule, error: scheduleError } = await supabase
    .from("monitoring_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single()
  if (scheduleError || !schedule) {
    throw new Error(`Schedule ${scheduleId} not found: ${scheduleError?.message ?? "unknown"}`)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", schedule.profile_id)
    .single()
  const plan = (profile?.plan ?? "free") as PlanType

  // 2. Pick providers (plan-gated, env-var-gated)
  const providers = options.providerOverride ?? providersForPlan(plan)
  if (providers.length === 0) {
    throw new Error("No LLM providers configured. Set ANTHROPIC_API_KEY at minimum.")
  }

  // 3. Generate the standard 7 queries
  const config: QueryConfig = {
    name: schedule.name,
    topics: [schedule.query],
    language: schedule.language === "en" ? "en" : "de",
  }
  const queries = generateVisibilityQueries(config)

  // 4. Fan-out per provider, in parallel
  const providerOutcomes = await Promise.all(
    providers.map(async (provider) => {
      const { queryResults, error } = await runProvider(provider, queries, schedule.name)
      const report = error
        ? null
        : buildVisibilityReport(schedule.name, [schedule.query], queryResults)
      return { provider, queryResults, report, error }
    }),
  )

  const successfulProviders = providerOutcomes.filter(o => o.report !== null && !o.error)
  if (successfulProviders.length === 0) {
    const errors = providerOutcomes.map(o => `${o.provider.id}: ${o.error ?? "no report"}`).join("; ")
    throw new Error(`All providers failed: ${errors}`)
  }

  // 5. Build per-model breakdown for raw_data
  const perModelBreakdown: PerModelBreakdown[] = providerOutcomes.map(o => {
    if (!o.report || o.error) {
      return {
        provider: o.provider.id,
        label: o.provider.label,
        modelTag: o.provider.modelTag,
        overallScore: 0,
        mentionRate: 0,
        averagePosition: null,
        scoreBreakdown: { presenceScore: 0, positionScore: 0, contextScore: 0, topicAlignmentScore: 0 },
        successfulQueries: 0,
        error: o.error ?? "no report",
      }
    }
    return {
      provider: o.provider.id,
      label: o.provider.label,
      modelTag: o.provider.modelTag,
      overallScore: o.report.overallScore,
      mentionRate: o.report.mentionRate,
      averagePosition: o.report.averagePosition,
      scoreBreakdown: o.report.scoreBreakdown,
      successfulQueries: o.queryResults.length,
    }
  })

  // 6. Aggregate across successful providers (mean of per-model scores)
  const allQueryResults = providerOutcomes.flatMap(o => o.queryResults)
  const aggregateReport = aggregateReports(
    schedule.name,
    [schedule.query],
    successfulProviders.map(o => o.report!),
    allQueryResults,
  )

  // 7. Sentiment over all signals from all providers
  const sentiment = deriveSentiment(allQueryResults.map(r => r.signal.sentiment))

  // 8. Persist the consolidated report
  const finalRawData: MultiModelVisibilityReport = {
    ...aggregateReport,
    perModelBreakdown,
    providersUsed: successfulProviders.map(o => o.provider.id),
  }

  const { data: savedReport, error: reportError } = await supabase
    .from("visibility_reports")
    .insert({
      profile_id: schedule.profile_id,
      schedule_id: schedule.id,
      trigger: options.trigger,
      visibility_score: aggregateReport.overallScore,
      sentiment,
      summary: `Score: ${aggregateReport.overallScore}/100 (Mean über ${successfulProviders.length} Modelle). Erwähnt in ${aggregateReport.mentionRate}% der Abfragen.`,
      raw_data: finalRawData as unknown as Json,
    })
    .select("id")
    .single()

  if (reportError || !savedReport) {
    throw new Error(`Report save failed: ${reportError?.message ?? "unknown"}`)
  }

  // 9. Persist granular query_results (one row per (query × provider))
  if (allQueryResults.length > 0) {
    const queryResultRows = providerOutcomes.flatMap(o =>
      o.queryResults.map(r => ({
        profile_id: schedule.profile_id,
        report_id: savedReport.id,
        model: o.provider.modelTag,
        prompt: r.prompt,
        response: r.rawResponse,
        brand_mentioned: r.signal.mentioned,
        sentiment:
          r.signal.sentiment === "not_mentioned"
            ? null
            : (r.signal.sentiment as SentimentType),
        position: r.signal.position,
      })),
    )
    const { error: qrError } = await supabase.from("query_results").insert(queryResultRows)
    if (qrError) {
      console.error("query_results insert failed:", qrError)
    }
  }

  // 10. Touch schedule timestamps
  const scheduleUpdate: Database["public"]["Tables"]["monitoring_schedules"]["Update"] = {
    last_run_at: new Date().toISOString(),
  }
  if (options.advanceNextRunAt) {
    scheduleUpdate.next_run_at = calcNextRunAt(schedule.frequency)
  }
  await supabase
    .from("monitoring_schedules")
    .update(scheduleUpdate)
    .eq("id", schedule.id)

  return {
    reportId: savedReport.id,
    score: aggregateReport.overallScore,
    sentiment,
    mentionRate: aggregateReport.mentionRate,
    queryCount: allQueryResults.length,
    providersUsed: successfulProviders.map(o => o.provider.id),
  }
}

// ─── Competitor Analysis ─────────────────────────────────────────────────────

export type RunCompetitorAnalysisResult = {
  reportId: string
  score: number
  sentiment: SentimentType | null
  mentionRate: number
  queryCount: number
  providersUsed: ProviderId[]
}

/**
 * Wettbewerber-Analyse — Sprint 14: nutzt jetzt auch alle freigeschalteten
 * Provider, sofern der Owner ein Pro-Tarif hat (canAnalyzeCompetitors gated
 * ohnehin auf nicht-free).
 */
export async function runCompetitorAnalysis(
  competitorId: string,
  supabase: SupabaseClient<Database>,
  options: RunAnalysisOptions,
): Promise<RunCompetitorAnalysisResult> {
  // 1. Load the competitor row
  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("id, profile_id, name, topics, language")
    .eq("id", competitorId)
    .single()
  if (competitorError || !competitor) {
    throw new Error(`Competitor ${competitorId} not found: ${competitorError?.message ?? "unknown"}`)
  }

  // 2. Determine plan -> providers
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", competitor.profile_id)
    .single()
  const plan = (profile?.plan ?? "free") as PlanType
  const providers = options.providerOverride ?? providersForPlan(plan)
  if (providers.length === 0) {
    throw new Error("No LLM providers configured.")
  }

  // 3. Generate queries (per-competitor language from Sprint 12)
  const topics = (competitor.topics && competitor.topics.length > 0)
    ? competitor.topics
    : ["expertise"]
  const lang: "de" | "en" = competitor.language === "de" ? "de" : "en"
  const config: QueryConfig = {
    name: competitor.name,
    topics,
    language: lang,
  }
  const queries = generateVisibilityQueries(config)

  // 4. Fan-out
  const providerOutcomes = await Promise.all(
    providers.map(async (provider) => {
      const { queryResults, error } = await runProvider(provider, queries, competitor.name)
      const report = error
        ? null
        : buildVisibilityReport(competitor.name, topics, queryResults)
      return { provider, queryResults, report, error }
    }),
  )
  const successfulProviders = providerOutcomes.filter(o => o.report !== null && !o.error)
  if (successfulProviders.length === 0) {
    const errors = providerOutcomes.map(o => `${o.provider.id}: ${o.error ?? "no report"}`).join("; ")
    throw new Error(`All providers failed: ${errors}`)
  }

  // 5. Per-model breakdown
  const perModelBreakdown: PerModelBreakdown[] = providerOutcomes.map(o => {
    if (!o.report || o.error) {
      return {
        provider: o.provider.id,
        label: o.provider.label,
        modelTag: o.provider.modelTag,
        overallScore: 0,
        mentionRate: 0,
        averagePosition: null,
        scoreBreakdown: { presenceScore: 0, positionScore: 0, contextScore: 0, topicAlignmentScore: 0 },
        successfulQueries: 0,
        error: o.error ?? "no report",
      }
    }
    return {
      provider: o.provider.id,
      label: o.provider.label,
      modelTag: o.provider.modelTag,
      overallScore: o.report.overallScore,
      mentionRate: o.report.mentionRate,
      averagePosition: o.report.averagePosition,
      scoreBreakdown: o.report.scoreBreakdown,
      successfulQueries: o.queryResults.length,
    }
  })

  // 6. Aggregate
  const allQueryResults = providerOutcomes.flatMap(o => o.queryResults)
  const aggregateReport = aggregateReports(
    competitor.name,
    topics,
    successfulProviders.map(o => o.report!),
    allQueryResults,
  )
  const sentiment = deriveSentiment(allQueryResults.map(r => r.signal.sentiment))

  const finalRawData: MultiModelVisibilityReport = {
    ...aggregateReport,
    perModelBreakdown,
    providersUsed: successfulProviders.map(o => o.provider.id),
  }

  // 7. Persist competitor_reports row
  const { data: savedReport, error: reportError } = await supabase
    .from("competitor_reports")
    .insert({
      competitor_id: competitor.id,
      profile_id: competitor.profile_id,
      trigger: options.trigger,
      visibility_score: aggregateReport.overallScore,
      sentiment,
      summary: `${competitor.name}: Score ${aggregateReport.overallScore}/100 (Mean über ${successfulProviders.length} Modelle), erwähnt in ${aggregateReport.mentionRate}% der Abfragen.`,
      raw_data: finalRawData as unknown as Json,
    })
    .select("id")
    .single()

  if (reportError || !savedReport) {
    throw new Error(`Competitor report save failed: ${reportError?.message ?? "unknown"}`)
  }

  // 8. Update competitor's last_score
  await supabase
    .from("competitors")
    .update({
      last_score: aggregateReport.overallScore,
      last_analyzed_at: new Date().toISOString(),
    })
    .eq("id", competitor.id)

  return {
    reportId: savedReport.id,
    score: aggregateReport.overallScore,
    sentiment,
    mentionRate: aggregateReport.mentionRate,
    queryCount: allQueryResults.length,
    providersUsed: successfulProviders.map(o => o.provider.id),
  }
}

// ─── Plan-Limit ───────────────────────────────────────────────────────────────

export { type PlanType }

/** How many manual analyses each plan can trigger per rolling 30-day window. */
export const MANUAL_LIMIT_PER_30D: Record<PlanType, number | null> = {
  free:       1,
  starter:    null, // unlimited
  pro:        null,
  enterprise: null,
}

export type LimitCheckResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; reason: string; resetAt: string | null }

export async function checkManualAnalysisLimit(
  profileId: string,
  plan: PlanType,
  supabase: SupabaseClient<Database>,
): Promise<LimitCheckResult> {
  const limit = MANUAL_LIMIT_PER_30D[plan]
  if (limit === null) {
    return { allowed: true, remaining: null }
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data, error } = await supabase
    .from("visibility_reports")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("trigger", "manual")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })

  if (error) {
    console.error("limit check failed:", error)
    return { allowed: true, remaining: null }
  }

  const used = data?.length ?? 0
  if (used < limit) {
    return { allowed: true, remaining: limit - used }
  }

  const oldest = data?.[0]?.created_at
  const resetAt = oldest
    ? new Date(new Date(oldest).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return {
    allowed: false,
    reason: `Free-Tarif: ${limit} manuelle Analyse pro 30 Tage. Upgrade für unbegrenzt.`,
    resetAt,
  }
}

/**
 * Competitor analyses are Pro-only (Starter+). Free users can add competitors
 * but cannot trigger analyses on them.
 */
export function canAnalyzeCompetitors(plan: PlanType): boolean {
  return plan !== "free"
}

// Re-exports for backward-compatibility with old imports
export { claudeProvider }

// lib/auralis/analyzer.ts
// Takes a raw AI response + the target person's name and extracts
// structured visibility signals: was the person mentioned, how prominently,
// in what context, with what topics and sentiment?

export interface MentionSignal {
  mentioned: boolean
  position: number | null       // rank in the list (1 = first mentioned)
  contextSnippet: string | null // the sentence(s) surrounding the mention
  associatedTopics: string[]    // topics linked to the person in the response
  sentiment: "positive" | "neutral" | "negative" | "not_mentioned"
  citedSources: string[]        // any URLs or sources the AI referenced
}

export interface QueryResult {
  queryId: string
  queryType: string
  prompt: string
  rawResponse: string
  signal: MentionSignal
  weight: number
}

export interface VisibilityReport {
  personName: string
  topics: string[]
  queriedAt: string
  overallScore: number          // 0–100 composite visibility score
  mentionRate: number           // % of queries where person was mentioned
  averagePosition: number | null
  dominantTopics: string[]      // topics most associated with person across queries
  narratives: string[]          // key phrases used to describe the person
  queryResults: QueryResult[]
  scoreBreakdown: {
    presenceScore: number       // was the person mentioned at all?
    positionScore: number       // how early / prominently?
    contextScore: number        // how positively / authoritatively framed?
    topicAlignmentScore: number // do associated topics match desired topics?
  }
}

/**
 * Parses a single AI response to extract mention signals for a target person.
 * Uses simple but robust string matching — no AI needed for this step.
 */
export function extractMentionSignal(
  response: string,
  personName: string,
  queryId: string,
  weight: number,
  prompt: string,
  queryType: string
): QueryResult {
  const lowerResponse = response.toLowerCase()
  const lowerName = personName.toLowerCase()

  // Split name into parts for partial matching (first name, last name)
  const nameParts = personName.trim().split(/\s+/)
  const lastName = nameParts[nameParts.length - 1].toLowerCase()
  const firstName = nameParts[0].toLowerCase()

  // Check for full name match first, then last name
  const fullNameIndex = lowerResponse.indexOf(lowerName)
  const lastNameIndex = lowerResponse.indexOf(lastName)
  const mentioned = fullNameIndex !== -1 || lastNameIndex !== -1
  const matchIndex = fullNameIndex !== -1 ? fullNameIndex : lastNameIndex

  // Estimate position in a list (count how many names appear before this one)
  let position: number | null = null
  if (mentioned && matchIndex !== -1) {
    // Heuristic: count numbered list items or bullet points before the match
    const beforeMatch = response.substring(0, matchIndex)
    const listItemsBefore = (beforeMatch.match(/\d+\.|^-|\n-|\n\*/gm) ?? []).length
    position = listItemsBefore + 1
    if (position < 1) position = 1
    if (position > 20) position = null // too far down to be meaningful
  }

  // Extract context snippet (2 sentences around the mention)
  let contextSnippet: string | null = null
  if (mentioned && matchIndex !== -1) {
    const start = Math.max(0, matchIndex - 120)
    const end = Math.min(response.length, matchIndex + 300)
    contextSnippet = response.substring(start, end).trim()
    // Clean up: remove leading partial sentence
    const firstPeriod = contextSnippet.indexOf(". ")
    if (firstPeriod > 0 && firstPeriod < 60) {
      contextSnippet = contextSnippet.substring(firstPeriod + 2)
    }
  }

  // Simple sentiment heuristic based on surrounding words
  let sentiment: MentionSignal["sentiment"] = "not_mentioned"
  if (mentioned && contextSnippet) {
    const ctx = contextSnippet.toLowerCase()
    const positiveSignals = ["führend", "bekannt", "experte", "anerkannt", "empfehle", "herausragend", "authority", "leading", "renowned", "expert", "recommend", "top", "best"]
    const negativeSignals = ["kritisch", "umstritten", "problematisch", "controversial", "criticized"]
    const posCount = positiveSignals.filter(w => ctx.includes(w)).length
    const negCount = negativeSignals.filter(w => ctx.includes(w)).length
    if (negCount > posCount) sentiment = "negative"
    else if (posCount > 0) sentiment = "positive"
    else sentiment = "neutral"
  }

  // Extract associated topics (look for topic keywords near the name mention)
  const topicKeywords = [
    "AI", "KI", "Artificial Intelligence", "Strategie", "Strategy",
    "Leadership", "Transformation", "Digital", "Innovation", "Automation",
    "Machine Learning", "ChatGPT", "Prompt", "Beratung", "Consulting",
    "Speaker", "Autor", "Author", "LinkedIn", "Personal Brand",
    "Future of Work", "Change Management", "Entrepreneurship"
  ]
  const associatedTopics: string[] = []
  if (contextSnippet) {
    topicKeywords.forEach(topic => {
      if (contextSnippet!.toLowerCase().includes(topic.toLowerCase())) {
        associatedTopics.push(topic)
      }
    })
  }

  // Extract any URLs mentioned as sources
  const urlRegex = /https?:\/\/[^\s)]+/g
  const citedSources = response.match(urlRegex) ?? []

  return {
    queryId,
    queryType,
    prompt,
    rawResponse: response,
    weight,
    signal: {
      mentioned,
      position,
      contextSnippet,
      associatedTopics,
      sentiment,
      citedSources,
    },
  }
}

/**
 * Aggregates multiple query results into a single VisibilityReport
 * with a composite Aura Score.
 */
export function buildVisibilityReport(
  personName: string,
  topics: string[],
  queryResults: QueryResult[]
): VisibilityReport {
  const mentionedResults = queryResults.filter(r => r.signal.mentioned)
  const mentionRate = queryResults.length > 0
    ? mentionedResults.length / queryResults.length
    : 0

  // PRESENCE SCORE: weighted mention rate (0–100)
  const presenceScore = Math.round(
    queryResults.reduce((acc, r) => {
      return acc + (r.signal.mentioned ? r.weight * 100 : 0)
    }, 0)
  )

  // POSITION SCORE: how early in lists (0–100, lower position = higher score)
  const positions = mentionedResults
    .map(r => r.signal.position)
    .filter((p): p is number => p !== null)
  const avgPosition = positions.length > 0
    ? positions.reduce((a, b) => a + b, 0) / positions.length
    : null
  const positionScore = avgPosition !== null
    ? Math.max(0, Math.round(100 - (avgPosition - 1) * 15))
    : 0

  // CONTEXT SCORE: sentiment quality (0–100)
  const contextScore = Math.round(
    mentionedResults.reduce((acc, r) => {
      const s = r.signal.sentiment
      const sentimentValue = s === "positive" ? 100 : s === "neutral" ? 60 : s === "negative" ? 20 : 0
      return acc + (sentimentValue * r.weight) / mentionRate || 0
    }, 0)
  )

  // TOPIC ALIGNMENT SCORE: do mentioned topics match desired topics? (0–100)
  const allMentionedTopics = mentionedResults.flatMap(r => r.signal.associatedTopics)
  const desiredTopicsLower = topics.map(t => t.toLowerCase())
  const alignedTopics = allMentionedTopics.filter(t =>
    desiredTopicsLower.some(dt => t.toLowerCase().includes(dt) || dt.includes(t.toLowerCase()))
  )
  const topicAlignmentScore = Math.min(100, Math.round((alignedTopics.length / Math.max(topics.length, 1)) * 80 + (mentionRate * 20)))

  // COMPOSITE AURA SCORE
  const overallScore = Math.round(
    presenceScore * 0.35 +
    positionScore * 0.25 +
    contextScore * 0.25 +
    topicAlignmentScore * 0.15
  )

  // DOMINANT TOPICS: frequency count across all results
  const topicFrequency: Record<string, number> = {}
  allMentionedTopics.forEach(t => {
    topicFrequency[t] = (topicFrequency[t] ?? 0) + 1
  })
  const dominantTopics = Object.entries(topicFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic)

  // NARRATIVES: extract key descriptive phrases from context snippets
  const narrativePatterns = [
    /(?:ist|ist ein|gilt als|bekannt als|einer der|eine der)\s+([^.,\n]{8,60})/gi,
    /(?:is a|is an|known as|considered a|one of the)\s+([^.,\n]{8,60})/gi,
  ]
  const narratives: string[] = []
  mentionedResults.forEach(r => {
    if (r.signal.contextSnippet) {
      narrativePatterns.forEach(pattern => {
        const matches = r.signal.contextSnippet!.matchAll(pattern)
        for (const match of matches) {
          if (match[1] && match[1].length > 8) {
            narratives.push(match[1].trim())
          }
        }
      })
    }
  })

  return {
    personName,
    topics,
    queriedAt: new Date().toISOString(),
    overallScore,
    mentionRate: Math.round(mentionRate * 100),
    averagePosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
    dominantTopics,
    narratives: [...new Set(narratives)].slice(0, 6),
    queryResults,
    scoreBreakdown: {
      presenceScore,
      positionScore,
      contextScore,
      topicAlignmentScore,
    },
  }
}

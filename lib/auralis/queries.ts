// lib/auralis/queries.ts
// Generates structured query sets for AI Visibility analysis.
// Each query simulates how a real user would ask an AI system
// about experts in a given field — without mentioning the target
// person by name. This avoids bias in the AI's response.

export interface VisibilityQuery {
  id: string
  type: "expert_discovery" | "topic_authority" | "recommendation" | "comparison"
  prompt: string
  weight: number // contribution to final visibility score (0–1, sum = 1)
}

export interface QueryConfig {
  name: string
  topics: string[]
  region?: string
  language?: "de" | "en"
}

/**
 * Generates a set of queries that probe AI visibility from multiple angles.
 * The mix of query types mirrors how real users actually discover experts:
 * - Who's the best at X? (expert_discovery)
 * - What does X person think about Y? (topic_authority)
 * - Who should I follow/read for Z? (recommendation)
 * - X vs Y — who is more relevant? (comparison)
 */
export function generateVisibilityQueries(config: QueryConfig): VisibilityQuery[] {
  const { topics, region = "deutschsprachigen Raum", language = "de" } = config
  const primaryTopic = topics[0]
  const secondaryTopics = topics.slice(1, 3)

  if (language === "de") {
    return [
      {
        id: "expert_discovery_1",
        type: "expert_discovery",
        prompt: `Wer sind die führenden Experten und Thought Leader für ${primaryTopic} im ${region}? Nenne die wichtigsten 5–10 Personen mit einer kurzen Einschätzung ihrer Stärken.`,
        weight: 0.30,
      },
      {
        id: "expert_discovery_2",
        type: "expert_discovery",
        prompt: `Welche deutschsprachigen Experten, Speaker oder Autoren zum Thema ${primaryTopic} sollte ich kennen? Ich suche jemanden mit strategischer Perspektive und digitaler Präsenz.`,
        weight: 0.20,
      },
      {
        id: "topic_authority_1",
        type: "topic_authority",
        prompt: `Wer schreibt oder spricht am kompetentesten über ${primaryTopic} in Verbindung mit ${secondaryTopics[0] ?? "digitaler Transformation"}? Welche Stimmen sind in diesem Bereich besonders glaubwürdig?`,
        weight: 0.20,
      },
      {
        id: "recommendation_1",
        type: "recommendation",
        prompt: `Ich bin ein B2B-Entscheider und möchte mehr über ${primaryTopic} lernen. Wen sollte ich auf LinkedIn folgen? Welche Experten produzieren wirklich wertvolle Inhalte dazu?`,
        weight: 0.15,
      },
      {
        id: "recommendation_2",
        type: "recommendation",
        prompt: `Gibt es im ${region} anerkannte Experten für ${primaryTopic}, die auch als Berater oder Speaker engagiert werden? Wen würdest du empfehlen?`,
        weight: 0.15,
      },
    ]
  }

  // English queries
  return [
    {
      id: "expert_discovery_1",
      type: "expert_discovery",
      prompt: `Who are the leading experts and thought leaders in ${primaryTopic}? List the top 5–10 people with a brief assessment of their expertise.`,
      weight: 0.30,
    },
    {
      id: "expert_discovery_2",
      type: "expert_discovery",
      prompt: `Which experts, speakers or authors on ${primaryTopic} should I know about? I'm looking for someone with a strategic perspective and strong digital presence.`,
      weight: 0.20,
    },
    {
      id: "topic_authority_1",
      type: "topic_authority",
      prompt: `Who writes or speaks most authoritatively about ${primaryTopic} combined with ${secondaryTopics[0] ?? "digital transformation"}? Which voices are most credible in this space?`,
      weight: 0.20,
    },
    {
      id: "recommendation_1",
      type: "recommendation",
      prompt: `I'm a B2B decision-maker looking to learn more about ${primaryTopic}. Who should I follow on LinkedIn? Which experts produce genuinely valuable content on this topic?`,
      weight: 0.15,
    },
    {
      id: "recommendation_2",
      type: "recommendation",
      prompt: `Are there recognized experts in ${primaryTopic} who are also engaged as consultants or speakers? Who would you recommend?`,
      weight: 0.15,
    },
  ]
}

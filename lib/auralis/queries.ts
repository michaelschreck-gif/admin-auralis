// lib/auralis/queries.ts
// Generates structured query sets for AI Visibility analysis.
// Each query simulates how a real user would ask an AI system
// about experts in a given field — without mentioning the target
// person by name. This avoids bias in the AI's response.
//
// MIRROR of auralis/lib/auralis/queries.ts (Sprint 11). Keep in sync.

export interface VisibilityQuery {
  id: string
  type:
    | "expert_discovery"
    | "topic_authority"
    | "recommendation"
    | "comparison"
    | "leadership"      // founders/CEOs/pioneers in the field (Sprint 11)
    | "popular_figures" // public figures associated with the topic (Sprint 11)
  prompt: string
  weight: number // contribution to final visibility score (0–1, sum ≈ 1)
}

export interface QueryConfig {
  name: string
  topics: string[]
  region?: string
  language?: "de" | "en"
}

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
        weight: 0.21,
      },
      {
        id: "expert_discovery_2",
        type: "expert_discovery",
        prompt: `Welche deutschsprachigen Experten, Speaker oder Autoren zum Thema ${primaryTopic} sollte ich kennen? Ich suche jemanden mit strategischer Perspektive und digitaler Präsenz.`,
        weight: 0.14,
      },
      {
        id: "topic_authority_1",
        type: "topic_authority",
        prompt: `Wer schreibt oder spricht am kompetentesten über ${primaryTopic} in Verbindung mit ${secondaryTopics[0] ?? "digitaler Transformation"}? Welche Stimmen sind in diesem Bereich besonders glaubwürdig?`,
        weight: 0.14,
      },
      {
        id: "recommendation_1",
        type: "recommendation",
        prompt: `Ich bin ein B2B-Entscheider und möchte mehr über ${primaryTopic} lernen. Wen sollte ich auf LinkedIn folgen? Welche Experten produzieren wirklich wertvolle Inhalte dazu?`,
        weight: 0.11,
      },
      {
        id: "recommendation_2",
        type: "recommendation",
        prompt: `Gibt es im ${region} anerkannte Experten für ${primaryTopic}, die auch als Berater oder Speaker engagiert werden? Wen würdest du empfehlen?`,
        weight: 0.11,
      },
      {
        id: "leadership_1",
        type: "leadership",
        prompt: `Wer sind die führenden Gründer, CEOs oder Pioniere im Bereich ${primaryTopic}? Welche Unternehmer haben die Branche maßgeblich geprägt? Nenne 5–10 zentrale Persönlichkeiten.`,
        weight: 0.15,
      },
      {
        id: "popular_figures_1",
        type: "popular_figures",
        prompt: `Welche bekannten Persönlichkeiten werden am häufigsten mit ${primaryTopic} in Verbindung gebracht? Nenne sowohl Forscher als auch Unternehmer und CEOs, die in der öffentlichen Wahrnehmung dieses Thema repräsentieren.`,
        weight: 0.14,
      },
    ]
  }

  // English queries
  return [
    {
      id: "expert_discovery_1",
      type: "expert_discovery",
      prompt: `Who are the leading experts and thought leaders in ${primaryTopic}? List the top 5–10 people with a brief assessment of their expertise.`,
      weight: 0.21,
    },
    {
      id: "expert_discovery_2",
      type: "expert_discovery",
      prompt: `Which experts, speakers or authors on ${primaryTopic} should I know about? I'm looking for someone with a strategic perspective and strong digital presence.`,
      weight: 0.14,
    },
    {
      id: "topic_authority_1",
      type: "topic_authority",
      prompt: `Who writes or speaks most authoritatively about ${primaryTopic} combined with ${secondaryTopics[0] ?? "digital transformation"}? Which voices are most credible in this space?`,
      weight: 0.14,
    },
    {
      id: "recommendation_1",
      type: "recommendation",
      prompt: `I'm a B2B decision-maker looking to learn more about ${primaryTopic}. Who should I follow on LinkedIn? Which experts produce genuinely valuable content on this topic?`,
      weight: 0.11,
    },
    {
      id: "recommendation_2",
      type: "recommendation",
      prompt: `Are there recognized experts in ${primaryTopic} who are also engaged as consultants or speakers? Who would you recommend?`,
      weight: 0.11,
    },
    {
      id: "leadership_1",
      type: "leadership",
      prompt: `Who are the leading founders, CEOs, or pioneers in ${primaryTopic}? Which entrepreneurs have shaped the industry most significantly? Name 5–10 central figures.`,
      weight: 0.15,
    },
    {
      id: "popular_figures_1",
      type: "popular_figures",
      prompt: `Which well-known public figures are most associated with ${primaryTopic}? Include both researchers and entrepreneurs/CEOs who represent this topic in the public eye.`,
      weight: 0.14,
    },
  ]
}

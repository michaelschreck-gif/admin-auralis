/**
 * LLM-Provider-Abstraktion (Sprint 14).
 *
 * Vereinheitlicht 4 verschiedene KI-Anbieter hinter einer gemeinsamen `call()`-API:
 *   - Anthropic Claude Sonnet (via @anthropic-ai/sdk)
 *   - OpenAI GPT-4o (via fetch, OpenAI HTTP-API)
 *   - Perplexity Sonar (via fetch, OpenAI-kompatibel)
 *   - Google Gemini 2.5 Flash (via fetch, Generative Language API)
 *
 * Wir verwenden bewusst die "Consumer-Default"-Modelle pro Anbieter, weil wir
 * messen wollen, was ein durchschnittlicher Endnutzer in den Antworten zu sehen
 * bekommt — nicht die Premium-Modelle.
 *
 * Jeder Provider ist optional: wenn der zugehörige API-Key fehlt, wird der
 * Provider gegenüber dem Runner als "nicht verfügbar" gemeldet und übersprungen.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { Database } from "@/lib/supabase/database.types"

type PlanType = Database["public"]["Enums"]["plan_type"]

export type ProviderId = "claude-sonnet" | "gpt-4o" | "perplexity-sonar" | "gemini-flash"

export type LLMProvider = {
  id: ProviderId
  /** Display-Name in UI + DB-Spalte query_results.model */
  label: string
  /** Genaues Modell-Tag des Anbieters (z.B. "gpt-4o", "sonar", "gemini-2.5-flash"). */
  modelTag: string
  /**
   * Führt einen einzelnen Prompt aus. Wirft bei Netzwerk-/Auth-Fehlern;
   * Caller fängt + loggt, damit ein einzelner Provider-Fehler nicht den
   * gesamten Analyse-Lauf killt.
   */
  call(prompt: string, systemPrompt: string, maxTokens?: number): Promise<string>
  /** Prüft ob der nötige API-Key gesetzt ist. */
  isConfigured(): boolean
}

const DEFAULT_MAX_TOKENS = 600

// ─── Anthropic Claude Sonnet ────────────────────────────────────────────────

export const claudeProvider: LLMProvider = {
  id: "claude-sonnet",
  label: "Claude Sonnet",
  modelTag: "claude-sonnet-4-5",
  isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
  async call(prompt, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing")
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
    return message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n")
  },
}

// ─── OpenAI GPT-4o ──────────────────────────────────────────────────────────

export const openaiProvider: LLMProvider = {
  id: "gpt-4o",
  label: "GPT-4o",
  modelTag: "gpt-4o",
  isConfigured: () => !!process.env.OPENAI_API_KEY,
  async call(prompt, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY missing")
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const json = await res.json() as {
      choices?: { message?: { content?: string } }[]
    }
    return json.choices?.[0]?.message?.content ?? ""
  },
}

// ─── Perplexity Sonar ───────────────────────────────────────────────────────

export const perplexityProvider: LLMProvider = {
  id: "perplexity-sonar",
  label: "Perplexity",
  modelTag: "sonar",
  isConfigured: () => !!process.env.PERPLEXITY_API_KEY,
  async call(prompt, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS) {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY missing")
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`Perplexity API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const json = await res.json() as {
      choices?: { message?: { content?: string } }[]
    }
    return json.choices?.[0]?.message?.content ?? ""
  },
}

// ─── Google Gemini 2.5 Flash ────────────────────────────────────────────────

export const geminiProvider: LLMProvider = {
  id: "gemini-flash",
  label: "Gemini",
  modelTag: "gemini-2.5-flash",
  isConfigured: () => !!process.env.GOOGLE_AI_API_KEY,
  async call(prompt, systemPrompt, maxTokens = DEFAULT_MAX_TOKENS) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY missing")
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          { role: "user", parts: [{ text: prompt }] },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const json = await res.json() as {
      candidates?: {
        content?: { parts?: { text?: string }[] }
      }[]
    }
    return json.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("\n") ?? ""
  },
}

// ─── Registry ───────────────────────────────────────────────────────────────

export const ALL_PROVIDERS: LLMProvider[] = [
  claudeProvider,
  openaiProvider,
  perplexityProvider,
  geminiProvider,
]

export function providerById(id: string): LLMProvider | undefined {
  return ALL_PROVIDERS.find(p => p.id === id || p.modelTag === id)
}

// ─── Plan-Gating ────────────────────────────────────────────────────────────

/**
 * Plan-Staffelung (Sprint 14):
 *   - free       → nur Claude
 *   - starter+   → alle 4 (sofern API-Keys konfiguriert)
 *
 * Wenn ein Anbieter keinen API-Key hat, fällt er stillschweigend raus —
 * so können wir Provider schrittweise aktivieren, ohne Code-Änderungen.
 */
export function providersForPlan(plan: PlanType): LLMProvider[] {
  if (plan === "free") {
    return [claudeProvider].filter(p => p.isConfigured())
  }
  // starter / pro / enterprise: alles was konfiguriert ist
  return ALL_PROVIDERS.filter(p => p.isConfigured())
}

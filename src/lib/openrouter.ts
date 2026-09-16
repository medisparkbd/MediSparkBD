// src/lib/openrouter.ts — OpenRouter free models (verified 2026-09-16)
// Best working free model with user key: nvidia/nemotron-3-ultra-550b-a55b:free (1M ctx, hybrid Mamba-MoE)
// Fallbacks: nemotron-3-super, openrouter/free router
// Key stored in local.env / deploy.env / Vercel env as OPENROUTER_API_KEY (never commit)

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Verified best free models (live check 2026-09-16, is_free_tier=true, 50 req/day)
export const BEST_FREE_MODELS = {
  primary: "nvidia/nemotron-3-ultra-550b-a55b:free", // 1M ctx, most reliable
  fast: "nvidia/nemotron-3-super-120b-a12b:free", // 262K, faster
  router: "openrouter/free", // auto-picks free with capability filter
  vision: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  json: "google/gemma-4-31b-it:free", // rate-limited but best for structured output when available
} as const;

export const FREE_FALLBACK_CHAIN = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "inclusionai/ling-3.0-flash-vl:free",
] as const;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatWithFallback(
  messages: ChatMessage[],
  opts?: { model?: string; maxTokens?: number; temperature?: number }
) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing (set in local.env / Vercel)");

  const chain = opts?.model ? [opts.model, ...FREE_FALLBACK_CHAIN.filter((m) => m !== opts.model)] : [...FREE_FALLBACK_CHAIN];

  let lastErr: string | null = null;
  for (const model of chain) {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://medisparkbd.com",
          "X-Title": "MediSparkBD",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts?.maxTokens ?? 1024,
          temperature: opts?.temperature ?? 0.7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        lastErr = `${model}: ${data?.error?.message ?? res.statusText}`;
        // 429 / 403 -> try next fallback
        if (res.status === 429 || res.status === 403) continue;
        throw new Error(lastErr);
      }
      return { model, data };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      continue;
    }
  }
  throw new Error(`All free models failed. Last: ${lastErr}`);
}

import { BULK_WORDPRESS_POST_TITLE_RULE, TITLE_WELL_KNOWN_ACRONYMS_RULE } from "@/lib/prompt-builders/system-user";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

/**
 * One-shot SAP page title from keyword + entity (Local Analysis wand).
 */

function extractJsonObject(text: string): unknown {
  return JSON.parse(text.trim());
}

export async function suggestSapPageTitle(params: {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  keyword: string;
  entityHint: string;
  siteName: string;
  /** Full grid scan markdown for context (optional). */
  gridSummaryMarkdown?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const {
    apiKey,
    model,
    temperature,
    maxTokens,
    topP,
    keyword,
    entityHint,
    siteName,
    gridSummaryMarkdown,
    signal,
  } = params;

  const kw = keyword.trim();
  if (!kw) {
    throw new Error("Add a keyword first.");
  }

  const gridBlock =
    gridSummaryMarkdown && gridSummaryMarkdown.length > 0
      ? `\n--- Grid scan (full markdown) ---\n${gridSummaryMarkdown}`
      : "";

  const system = `You write one SEO page title for a local service business SAP (service-area page).
Rules:
- Output JSON only: {"title":"..."} - one key "title", string value.
- Title must include the exact primary keyword substring and the location; "near" or "in" allowed in the title only.
- Max ~70 characters; no em-dash or en-dash between parts.
- No pipe suffix with brand name; no " | Company" at the end.
${BULK_WORDPRESS_POST_TITLE_RULE}`;

  const user = `Site name: ${siteName}
Primary keyword: ${kw}
Entity / place label: ${entityHint.trim() || "(use market from grid or infer from keyword)"}
${gridBlock}

Return {"title":"Your single title here"}.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ],
      temperature,
      max_tokens: Math.min(256, Math.max(64, maxTokens)),
      top_p: topP,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      /* ignore */
    }
    throw new Error(`OpenRouter error (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("Empty response from model.");
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(content);
  } catch {
    throw new Error("Model did not return valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON from model.");
  }

  const title = String((parsed as Record<string, unknown>).title ?? "").trim();
  if (!title) {
    throw new Error("Model returned an empty title.");
  }

  return title;
}

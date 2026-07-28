import { loadApiKey, streamChatCompletion } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { normalizeFocusKeywordPhrase } from "@/lib/seo-redirect-csv";

/**
 * OpenRouter writes a focus keyword when ACF keyword_focus is missing.
 * Used by Content Optimizer bulk so rows are never skipped for a blank keyword.
 */
export async function writeMissingFocusKeywordWithAi(input: {
  url: string;
  title?: string;
  meta?: string;
  siteId?: string;
}): Promise<string> {
  const apiKey = loadApiKey()?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is required to write a missing focus keyword.");
  }

  const url = (input.url || "").trim();
  if (!url) {
    throw new Error("URL is required to write a missing focus keyword.");
  }

  const title = (input.title || "").trim() || "(none)";
  const meta = (input.meta || "").trim() || "(none)";

  const systemPrompt =
    "You are a senior local SEO keyword specialist. Output ONLY the focus keyword phrase. No quotes, no labels, no explanation.";

  const userPrompt = `Write one primary ACF focus keyword for this page.

URL
${url}

Title
${title}

Meta
${meta}

Rules
- 2-6 words, spaces only (no hyphens/underscores).
- Match the page topic from the URL slug and title.
- Include place/entity when the URL or title is a local / SAP landing page.
- No brand or site name.
- Return only the keyword text.`;

  let raw = "";
  await streamChatCompletion({
    apiKey,
    model: getResearchModel(input.siteId),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 64,
    topP: 0.9,
    onContentChunk: (chunk) => {
      raw += chunk;
    },
  });

  const keyword = normalizeFocusKeywordPhrase(raw.replace(/^["'\s]+|["'\s]+$/g, "").trim());
  if (!keyword) {
    throw new Error(`OpenRouter returned an empty focus keyword for ${url}`);
  }
  return keyword;
}

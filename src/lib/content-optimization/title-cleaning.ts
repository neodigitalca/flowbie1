import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";

/**
 * Cleans location mentions and placeholders from title when entity is N/A (no entity).
 * AI-driven: single Open Router call to remove [city], [location], placeholders, and "in [Location]" patterns.
 * Fallback on API failure: returns original title.
 *
 * @param title - The title to clean
 * @param entity - Entity value ("N/A" means no entity, any other value means entity exists)
 * @returns Cleaned title without location mentions if entity is N/A, original title otherwise
 */
export async function cleanTitleForNonEntityAsync(
  title: string,
  entity: string | "N/A" | undefined,
  apiKey?: string
): Promise<string> {
  if (entity && entity !== "N/A" && entity.trim() !== "") return title;
  if (!title?.trim()) return title;
  const key = apiKey || loadApiKey();
  if (!key?.trim()) return title;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://agent-blueprint-builder.com",
        "X-Title": "Agent Blueprint Builder",
      },
      body: JSON.stringify({
        model: getResearchModel(),
        messages: [
          {
            role: "system",
            content:
              "You are an SEO copy editor. Given a title and that the page has no geographic entity, return the title with [city], [location], placeholders, and trailing \"in [Location]\" or \"in CityName\" removed. Output only the cleaned title, nothing else. Preserve the rest of the wording.",
          },
          { role: "user", content: `Title: ${title}\n\nEntity: N/A` },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });
    if (!res.ok) return title;
    const data = await res.json();
    const out = (data.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "").trim();
    return out || title;
  } catch {
    return title;
  }
}

/**
 * Synchronous version: cleans title with lightweight regex when entity is N/A.
 * Use when you cannot await (e.g. in non-async callers). For AI-based cleaning use cleanTitleForNonEntityAsync.
 */
export function cleanTitleForNonEntity(title: string, entity: string | "N/A" | undefined): string {
  if (entity && entity !== "N/A" && entity.trim() !== "") return title;
  if (!title?.trim()) return title;
  let cleaned = title;
  const placeholderPatterns = [
    /\s*\[\s*city\s*\]/gi,
    /\s*\[\s*location\s*\]/gi,
    /\s*\[\s*area\s*\]/gi,
    /\s*\[\s*state\s*\]/gi,
    /\s*\[\s*entity\s*\]/gi,
    /\s*<\s*city\s*>/gi,
    /\s*<\s*location\s*>/gi,
    /\s*\{\s*city\s*\}/gi,
    /\s*\{\s*location\s*\}/gi,
    /\s*\[\s*[^\]]+\s*\]/g,
  ];
  placeholderPatterns.forEach((p) => (cleaned = cleaned.replace(p, "")));
  cleaned = cleaned
    .replace(/\s+in\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[,:;.]*$/gi, "")
    .replace(/\s+in\s+\[[^\]]+\]\s*[,:;.]*$/gi, "")
    .replace(/\s+in\s+<[^>]+>\s*[,:;.]*$/gi, "")
    .replace(/\s+in\s+\{[^}]+\}\s*[,:;.]*$/gi, "")
    .replace(/\s+(?:in|at|for|near)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/g, "")
    .replace(/^\s*in\s+/gi, "")
    .replace(/\s+in\s*$/gi, "")
    .replace(/\s*,\s*$/, "")
    .trim();
  return cleaned;
}

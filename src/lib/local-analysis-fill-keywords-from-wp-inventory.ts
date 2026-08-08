/**
 * When Local Analysis target keywords are empty: one OpenRouter pass maps WordPress post
 * inventory JSON to geography-free service keywords per grid row (by row id).
 */

import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import {
  appendMasterInstructionsToSystemPrompt,
  buildSapMasterRulesWorkflowPrefix,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

const OR = "https://openrouter.ai/api/v1/chat/completions";
const MAX_POSTS_IN_PROMPT = 120;

const SYSTEM = `You fill empty Local Analysis **target keyword** cells from a WordPress post library.

Return **only** one JSON object: {"fills":[{"rowId":"string","keyword":"string"},...]}

Rules:
- There must be **exactly one** \`fills\` entry for **every** \`rowId\` listed under **rowsNeedingKeywords**. No extras, no omissions.
- Each \`keyword\` is **short-tail service / commercial intent** (about **2–4 words**). **Never** put city, neighbourhood, province, region, street names, landmarks, or postal codes in \`keyword\`. Geography stays in **entityHint** only.

**UNIQUE KEYWORDS (NON-NEGOTIABLE when there are 2+ rows):**
- **Every row must get a different \`keyword\` string** (case-insensitive uniqueness). **Forbidden:** pasting the **same** keyword on multiple rows (e.g. identical "event tent rental" on every line).
- Use **rowsNeedingKeywords[].entityHint** as the **market / service-area anchor**: pick a keyword that **fits that row's place** in a *business* sense (climate, venue type, seasonality, urban vs outdoor events, etc.) while keeping **place names out of \`keyword\`**.
- Vary **intent and wording** across rows using **only** angles supported by **postInventoryRows** (equipment, audience, service type, product names) — still **one industry**. **Do not** tack on generic transactional filler (buy, online, cost, installation, packages, financing, reviews) unless that exact wording appears in the inventory.

- Ground themes in **postInventoryRows**. **Do not** invent unrelated industries.
- No markdown, no commentary outside JSON.`;

export type WpInventoryKeywordFillRow = {
  id: string;
  entityHint: string;
  sapPages: number;
  clusterRole?: "seed" | "member";
  clusterId?: string;
};

export type FillKeywordsFromWpInventoryArgs = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  siteUrl: string;
  posts: SitePostInventoryRow[];
  rowsToFill: WpInventoryKeywordFillRow[];
  temperature?: number;
  topP?: number;
};

/** Normalize keyword for duplicate detection (case-insensitive, collapsed whitespace). */
export function keywordUniquenessKey(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * When 2+ rows, every fill keyword must differ (after uniqueness key). Exported for tests.
 */
export function assertDistinctFillKeywords(
  map: Map<string, string>,
  requiredRowIds: readonly string[],
): void {
  if (requiredRowIds.length <= 1) return;
  const seen = new Map<string, string>();
  for (const id of requiredRowIds) {
    const kw = map.get(id)?.trim() ?? "";
    const key = keywordUniquenessKey(kw);
    if (key.length === 0) continue;
    const firstId = seen.get(key);
    if (firstId !== undefined) {
      throw new Error(
        `Duplicate keyword "${kw}" for rows "${firstId}" and "${id}". Output a **different** geography-free service keyword per row, tailored to each row's entityHint.`,
      );
    }
    seen.set(key, id);
  }
}

/**
 * Parse model JSON and ensure every required row id has a non-empty keyword.
 * Exported for unit tests.
 */
export function keywordFillsMapFromParsedJson(
  o: unknown,
  requiredRowIds: readonly string[],
): Map<string, string> {
  if (!o || typeof o !== "object") {
    throw new Error('Keyword fill model returned invalid JSON (expected an object with "fills").');
  }
  const fillsRaw = (o as Record<string, unknown>).fills;
  if (!Array.isArray(fillsRaw)) {
    throw new Error('Keyword fill model JSON must include a "fills" array.');
  }
  const map = new Map<string, string>();
  for (const item of fillsRaw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const rowId = String(rec.rowId ?? "").trim();
    const keyword = String(rec.keyword ?? "").trim();
    if (rowId.length > 0 && keyword.length > 0) {
      map.set(rowId, keyword);
    }
  }
  for (const id of requiredRowIds) {
    const kw = map.get(id);
    if (kw == null || kw.length === 0) {
      throw new Error(
        `Keyword fill model did not return a keyword for row "${id}". Every rowsNeedingKeywords rowId must appear in fills.`,
      );
    }
  }
  assertDistinctFillKeywords(map, requiredRowIds);
  return map;
}

/** @internal Exported for tests. */
export function parseKeywordFillsAssistantContent(
  content: string,
  requiredRowIds: readonly string[],
): Map<string, string> {
  const o = parseAssistantJsonObject(content);
  return keywordFillsMapFromParsedJson(o, requiredRowIds);
}

async function postOpenRouter(args: {
  apiKey: string;
  model: string;
  siteId: string | undefined;
  messages: { role: string; content: string }[];
  temperature: number;
  topP: number;
}): Promise<string> {
  const res = await fetch(OR, {
    method: "POST",
    headers: openRouterWebAppHeaders(args.apiKey),
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature,
      max_tokens: 4096,
      top_p: args.topP,
      stream: false,
      response_format: { type: "json_object" },
    }),
  });
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: unknown };
  if (!res.ok) {
    const detail = j.error != null ? JSON.stringify(j.error) : res.statusText;
    throw new Error(`OpenRouter error (${res.status}): ${detail}`);
  }
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("Keyword fill model returned no content.");
  }
  return content;
}

/**
 * Fetches nothing — caller supplies `posts` from getSitePostInventory.
 * Returns row id → keyword for every id in rowsToFill.
 */
export async function fillKeywordsFromWpInventoryPosts(
  args: FillKeywordsFromWpInventoryArgs,
): Promise<Map<string, string>> {
  const {
    apiKey,
    model,
    siteId,
    siteName,
    siteUrl,
    posts,
    rowsToFill,
    temperature = 0.2,
    topP = 1,
  } = args;

  if (rowsToFill.length === 0) {
    throw new Error("No rows need keyword fill.");
  }
  await ensureMasterInstructionsInMemory(siteId);
  const requiredIds = rowsToFill.map((r) => r.id);
  const fillTemperature = rowsToFill.length >= 2 ? Math.max(temperature, 0.45) : temperature;

  const postInventoryRows = posts.slice(0, MAX_POSTS_IN_PROMPT).map((p) => ({
    title: p.fields.title ?? "",
    keyword: p.fields.keyword ?? "",
  }));

  const payload = {
    siteName,
    siteUrl,
    postInventoryRows,
    rowsNeedingKeywords: rowsToFill.map((r) => ({
      rowId: r.id,
      entityHint: r.entityHint,
      sapPages: r.sapPages,
      ...(r.clusterRole ? { clusterRole: r.clusterRole } : {}),
      ...(r.clusterId ? { clusterId: r.clusterId } : {}),
    })),
  };

  const multiRow = rowsToFill.length >= 2;

  const user = `${JSON.stringify(payload, null, 2)}

Return {"fills":[{"rowId":"<id from rowsNeedingKeywords>","keyword":"..."},...]} with one object per rowId, all non-empty keywords, no geography in keyword strings.${
    multiRow
      ? `

**Mandatory:** ${rowsToFill.length} rows → **${rowsToFill.length} different** \`keyword\` strings. Read each row's \`entityHint\` and assign a **unique** service phrase per row (same business, different wording / intent angle). Never repeat the same keyword text on two rows.`
      : ""
  }`;

  const systemForModel = appendMasterInstructionsToSystemPrompt(
    `${buildSapMasterRulesWorkflowPrefix(siteId ?? null)}${SYSTEM}`,
    siteId ?? null,
  );

  const parseAndValidate = (raw: string): Map<string, string> =>
    parseKeywordFillsAssistantContent(raw, requiredIds);

  let content = await postOpenRouter({
    apiKey,
    model,
    siteId,
    messages: [
      { role: "system", content: systemForModel },
      { role: "user", content: user },
    ],
    temperature: fillTemperature,
    topP,
  });

  const retryFix = async (assistantSoFar: string, fixHint: string): Promise<string> =>
    postOpenRouter({
      apiKey,
      model,
      siteId,
      messages: [
        { role: "system", content: systemForModel },
        { role: "user", content: user },
        { role: "assistant", content: assistantSoFar },
        { role: "user", content: fixHint },
      ],
      temperature: fillTemperature,
      topP,
    });

  try {
    return parseAndValidate(content);
  } catch (firstErr) {
    const fix =
      `Your previous reply was invalid. ${firstErr instanceof Error ? firstErr.message : String(firstErr)}

Return ONLY valid JSON: {"fills":[{"rowId":"string","keyword":"string"},...]} with **every** rowId from rowsNeedingKeywords exactly once and non-empty geography-free keywords.${
        rowsToFill.length >= 2
          ? ` **Each keyword must be unique** across rows (case-insensitive); vary wording per entityHint.`
          : ""
      }`;

    content = await retryFix(content, fix);
    try {
      return parseAndValidate(content);
    } catch (secondErr) {
      content = await retryFix(
        content,
        `Still invalid: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}. Return ONLY the JSON object with fills; ${
          rowsToFill.length >= 2
            ? "every keyword string must be **different**; use distinct service-intent phrases from the post inventory for each entityHint."
            : ""
        }`,
      );
      return parseAndValidate(content);
    }
  }
}

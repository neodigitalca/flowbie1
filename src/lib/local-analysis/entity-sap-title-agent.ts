import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  appendMasterInstructionsToSystemPrompt,
  buildSapMasterRulesWorkflowPrefix,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";
import { BULK_WORDPRESS_POST_TITLE_RULE } from "@/lib/prompt-builders/system-user";
import { entityTypeFocusWantsNeighbourhoods } from "@/lib/entity-geographic-level";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import { aiRejectBrandOrBlockedTexts } from "@/lib/content-brand-ai-gate";
import { collapseRepeatedPlaceSegmentsInKeyword } from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import { buildSapSlugFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";

const SAP_TITLE_AGENT_SYSTEM = `You are a **local SEO title agent** for **transactional service-area (SAP) landing pages** — product/service pages for customers ready to buy or book, **not** blog posts.

Output **only** valid JSON: {"titles":["..."]} with **exactly one** title per input row in \`rows[]\`, same order.

**Grid constraint (mandatory):** Each title must use a place consistent with \`gridLocations\` (parsed cities from the grid CSV). Forbidden: provinces, states, or cities not in those locations.

Each input row has:
- \`keyword\` — product or service focus keyword (Rank Math focus keyword)
- \`entity\` — neighbourhood or district place label
- \`path\` — URL path context only

**Title rules (per row):**
- One natural **commercial SAP headline**: product or service offer + place (not the connected site's company name).
- **Forbidden:** blog angles (guides, levels, opacity, comparisons, competitors, how-to, educational framing).
- **Forbidden:** leading with or centering the connected site's own trading name (fuzzy / word-reorder: "Blind Magic" ↔ "Magic Blinds"). Product-line brands the dealer sells (Hunter Douglas, Alta) are allowed when they fit the keyword. Use product/service wording for generic rows.
- Include the **entity** place label in the headline.
- **Do not** repeat the city when the neighbourhood or district name already contains it (e.g. \`West Edmonton, AB\` not \`West Edmonton, Edmonton, AB\`).
- Connect service and place with **"in"**, **"near"**, or **"for"**.
- No pipe suffixes, brand/site name, em dash.
- Vary phrasing across rows in the batch.

${BULK_WORDPRESS_POST_TITLE_RULE}`;

export type FillSapRowTitlesOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  gridLocations: string[];
  entityTypeFocus?: string[];
  onProgress?: (done: number, total: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

/** @deprecated Use {@link fillSapRowTitlesFromOpenRouter} */
export type EntitySapTitleAgentOptions = FillSapRowTitlesOptions;

type TitleAgentResponse = {
  titles?: unknown;
};

type TitleFillRow = {
  keyword: string;
  entity: string;
  path: string;
};

function titlesFromOpenRouterContent(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as TitleAgentResponse;
    if (!Array.isArray(parsed.titles)) return [];
    return parsed.titles.map((t) => String(t ?? "").trim());
  } catch {
    throw new Error(`Title agent returned invalid JSON: ${raw.slice(0, 160)}`);
  }
}

function sapRowPath(row: CSVRow): string {
  const slug =
    row.target_slug?.trim() || buildSapSlugFromKeywordEntity(row.keyword, row.entity ?? "");
  return slug ? `/${slug}/` : "";
}

function buildTitleFillPayload(rows: CSVRow[]): TitleFillRow[] {
  return rows.map((row) => ({
    keyword: (row.keyword ?? "").trim(),
    entity: normalizeEntityHintCommaLabel(row.entity ?? ""),
    path: sapRowPath(row),
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTitlesBatch(
  apiKey: string,
  model: string,
  siteId: string | undefined,
  siteName: string,
  rows: CSVRow[],
  gridLocations: string[],
  entityTypeFocus: string[] | undefined,
): Promise<string[]> {
  if (rows.length === 0) return [];
  await ensureMasterInstructionsInMemory(siteId);
  const payload = buildTitleFillPayload(rows);
  const neighbourhoodRule = entityTypeFocusWantsNeighbourhoods(entityTypeFocus)
    ? " Entity focus is neighbourhoods only — never use street names in any title."
    : "";
  const systemForModel = appendMasterInstructionsToSystemPrompt(
    `${buildSapMasterRulesWorkflowPrefix(siteId ?? null)}${SAP_TITLE_AGENT_SYSTEM}${neighbourhoodRule}`,
    siteId ?? null,
  );

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemForModel },
        {
          role: "user",
          content: JSON.stringify({
            siteName,
            rows: payload,
            gridLocations,
            titleBan: `Never put "${siteName}" or a shortened company/brand form of that name in any title.`,
          }),
        },
      ],
      temperature: 0.35,
      max_tokens: Math.min(8192, Math.max(1024, rows.length * 80)),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Title agent failed (${response.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) {
    throw new Error("Title agent returned empty content.");
  }

  const titles = titlesFromOpenRouterContent(raw).map((t) => collapseRepeatedPlaceSegmentsInKeyword(t));
  if (titles.length !== rows.length) {
    throw new Error(`Title agent returned ${titles.length} title(s) for ${rows.length} row(s).`);
  }
  if (titles.some((t) => !t)) {
    throw new Error("Title agent returned one or more empty titles.");
  }
  return titles;
}

function applyTitlesAtIndices(out: CSVRow[], indices: number[], titles: string[]): void {
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!;
    if (idx < 0 || idx >= out.length) continue;
    out[idx] = { ...out[idx]!, title: titles[i] ?? "" };
  }
}

/** One OpenRouter call for all rows: keywords + entities → titles JSON. */
export async function fillSapRowTitlesFromOpenRouter(
  rows: CSVRow[],
  options: FillSapRowTitlesOptions,
): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const siteId = options.siteId;
  const gridLocations = options.gridLocations;
  const entityTypeFocus = options.entityTypeFocus;
  const out = rows.map((r) => ({ ...r }));
  const total = out.length;

  const pendingIndices = out
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.title?.trim())
    .map(({ index }) => index);

  if (pendingIndices.length === 0) {
    options.onProgress?.(total, total);
    return out;
  }

  const pendingRows = pendingIndices.map((i) => out[i]!);
  let attempt = 0;

  while (pendingIndices.some((i) => !out[i]!.title?.trim())) {
    attempt++;
    try {
      const titles = await fetchTitlesBatch(
        apiKey,
        model,
        siteId,
        options.siteName,
        pendingRows,
        gridLocations,
        entityTypeFocus,
      );
      applyTitlesAtIndices(out, pendingIndices, titles);
      const titled = pendingIndices
        .map((i) => ({ i, title: out[i]!.title?.trim() ?? "" }))
        .filter((x) => x.title);
      if (titled.length > 0 && options.siteName.trim()) {
        const rejected = await aiRejectBrandOrBlockedTexts({
          apiKey,
          model,
          companyName: options.siteName,
          candidates: titled.map((x) => x.title),
          kind: "title",
        });
        if (rejected.length > 0) {
          const rejectKeys = new Set(
            rejected.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")),
          );
          for (const { i, title } of titled) {
            const key = title.toLowerCase().replace(/\s+/g, " ");
            if (rejectKeys.has(key)) {
              out[i] = { ...out[i]!, title: "" };
            }
          }
        }
      }
    } catch {
      await delay(Math.min(10_000, 1_000 * attempt));
    }
    options.onRowsUpdate?.(out.map((row) => ({ ...row })));
    options.onProgress?.(
      out.filter((r) => r.title?.trim()).length,
      total,
    );
  }

  options.onProgress?.(total, total);
  return out;
}

/** @deprecated Use {@link fillSapRowTitlesFromOpenRouter} */
export async function rewriteEntitySapTitlesWithOpenRouter(
  rows: CSVRow[],
  options: EntitySapTitleAgentOptions,
): Promise<CSVRow[]> {
  return fillSapRowTitlesFromOpenRouter(rows, options);
}

import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";
import { appendMasterInstructionsToSystemPrompt } from "@/lib/master-instructions-storage";
import { postOpenRouterAppChatFetch } from "@/lib/openrouter-app-api";
import type { GridLocationBucket } from "@/lib/local-analysis/grid-location-buckets";
import type { LocalDominatorRow } from "@/lib/local-dominator-csv";

const SUMMARY_BUCKET_SYSTEM = `You pick geographic locations for local SEO entity pages from a Local Dominator grid scan summary.

The CSV Address column may contain phone numbers only. Infer real geography from:
- Business and competitor names in the summary (city, suburb, corridor, region hints)
- Any full street addresses in the summary
- Grid rank patterns (higher rank number = weaker visibility = higher priority for new entity pages)

Output JSON only: {"buckets":[{"placeLabel":"string","priorityWeight":number,"sampleAddresses":["string"]},...]}

Rules:
- Return exactly bucketCount distinct placeLabel values.
- When wantsNeighbourhoods is false: placeLabel = street corridor or named district with City, ST (e.g. "Whyte Ave NW, Edmonton, AB").
- When wantsNeighbourhoods is true: placeLabel = City, ST only (e.g. "Edmonton, AB", "St. Albert, AB").
- priorityWeight: positive number 1-20; higher = weaker grid / more SEO opportunity.
- sampleAddresses: up to 3 short evidence strings copied from the summary (competitor lines, addresses).
- Ground every pick in the grid summary markdown. Do not invent cities outside the scan market.
- Prefer areas where the client's business has weak rank or competitors dominate.`;

export type PickGridLocationBucketsFromSummaryArgs = {
  apiKey: string;
  siteId?: string;
  gridSummaryMarkdown: string;
  gridRows: LocalDominatorRow[];
  bucketCount: number;
  wantsNeighbourhoods: boolean;
  businessName?: string;
  clientAudienceContextMarkdown?: string;
  entityTypeFocus?: readonly string[];
};

type ParsedSummaryBucket = {
  placeLabel: string;
  priorityWeight: number;
  sampleAddresses: string[];
};

/** @internal Exported for tests. */
export function parseGridLocationBucketsFromSummaryJson(
  content: string,
  bucketCount: number,
): GridLocationBucket[] {
  const sub = extractFirstBalancedJsonValue(content);
  if (!sub) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(sub);
  } catch {
    return [];
  }
  const rec = parsed as { buckets?: unknown };
  if (!rec || typeof rec !== "object" || !Array.isArray(rec.buckets)) return [];

  const out: GridLocationBucket[] = [];
  const seen = new Set<string>();
  for (const item of rec.buckets) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      placeLabel?: unknown;
      priorityWeight?: unknown;
      sampleAddresses?: unknown;
    };
    const placeLabel = String(row.placeLabel ?? "").trim();
    if (!placeLabel) continue;
    const key = placeLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const weight = Math.max(1, Number(row.priorityWeight) || 10);
    const avgRank = Math.max(4, Math.min(21, 22 - weight));
    const sampleAddresses = Array.isArray(row.sampleAddresses)
      ? row.sampleAddresses
          .map((a) => String(a ?? "").trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    out.push({
      bucketId: `summary-${out.length}`,
      placeLabel,
      weight,
      avgRank,
      rowCount: 1,
      sampleAddresses,
    });
    if (out.length >= bucketCount) break;
  }
  return out;
}

function buildSummaryBucketUserMessage(args: PickGridLocationBucketsFromSummaryArgs): string {
  const blocks: string[] = [
    `bucketCount: ${Math.max(1, Math.floor(args.bucketCount))}`,
    `wantsNeighbourhoods: ${args.wantsNeighbourhoods}`,
  ];
  if (args.businessName?.trim()) {
    blocks.push(`clientBusinessName: ${args.businessName.trim()}`);
  }
  if (args.clientAudienceContextMarkdown?.trim()) {
    blocks.push(`--- Client & site context ---\n${args.clientAudienceContextMarkdown.trim()}`);
  }
  if (args.entityTypeFocus?.length) {
    blocks.push(`entityTypeFocus: ${args.entityTypeFocus.join("; ")}`);
  }
  blocks.push(`--- Grid scan summary (read fully before picking) ---\n${args.gridSummaryMarkdown.trim()}`);
  return blocks.join("\n\n");
}

export async function pickGridLocationBucketsFromSummary(
  args: PickGridLocationBucketsFromSummaryArgs,
): Promise<GridLocationBucket[]> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is required to pick grid locations from summary.");
  }
  const bucketCount = Math.max(1, Math.floor(args.bucketCount));
  const summary = args.gridSummaryMarkdown.trim();
  if (!summary) {
    throw new Error("Grid summary markdown is required to pick locations.");
  }

  const model = getResearchModel(args.siteId);
  const system = appendMasterInstructionsToSystemPrompt(SUMMARY_BUCKET_SYSTEM, args.siteId);
  const user = buildSummaryBucketUserMessage({ ...args, bucketCount });

  const res = await postOpenRouterAppChatFetch({
    method: "POST",
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter grid location pick failed (${res.status}). ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const buckets = parseGridLocationBucketsFromSummaryJson(content, bucketCount);
  if (buckets.length === 0) {
    throw new Error("Could not infer grid locations from scan summary.");
  }
  return buckets;
}

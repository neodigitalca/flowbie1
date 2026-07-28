import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  appendMasterInstructionsToSystemPrompt,
  buildSapMasterRulesWorkflowPrefix,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";

const META_FILL_CHUNK = 10;

const SAP_META_AGENT_SYSTEM = `You are a **local SEO meta description agent** for service-area (SAP) landing pages.

Output **only** valid JSON: {"metas":["..."]} with **exactly one** meta description per input row in \`rows[]\`, same order.

Each input row has:
- \`title\` — the page headline (do **not** copy verbatim)
- \`keyword\` — focus keyword (includes entity place name; include this phrase **exactly once** in the meta)
- \`entity\` — full place label (include every comma-separated segment in keyword and meta)

**Meta rules (mandatory):**
- **130-150 characters** per meta (count spaces; stay in range).
- One natural, high-CTR sentence inviting the click.
- Weave \`keyword\` and the **full \`entity\`** string — **not** a repeat of \`title\`.
- **Forbidden:** duplicating the title string, pipe suffixes, brand/site name, em dash.
- Vary phrasing across rows in the batch.`;

type MetaAgentResponse = {
  metas?: unknown;
};

function metasFromOpenRouterContent(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as MetaAgentResponse;
    if (!Array.isArray(parsed.metas)) return [];
    return parsed.metas.map((m) => String(m ?? "").trim());
  } catch {
    return [];
  }
}

function buildMetaFillPayload(rows: CSVRow[]): { title: string; keyword: string; entity: string }[] {
  return rows.map((row) => ({
    title: (row.title ?? "").trim(),
    keyword: (row.keyword ?? "").trim(),
    entity: (row.entity ?? "").trim(),
  }));
}

async function fetchMetasBatch(
  apiKey: string,
  model: string,
  siteId: string | undefined,
  rows: CSVRow[],
): Promise<string[]> {
  if (rows.length === 0) return [];
  await ensureMasterInstructionsInMemory(siteId);
  const payload = buildMetaFillPayload(rows);
  const systemForModel = appendMasterInstructionsToSystemPrompt(
    `${buildSapMasterRulesWorkflowPrefix(siteId ?? null)}${SAP_META_AGENT_SYSTEM}`,
    siteId ?? null,
  );

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://flowbie.app",
      "X-Title": "Flowbie Entity SAP Meta Agent",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemForModel },
        { role: "user", content: JSON.stringify({ rows: payload }) },
      ],
      temperature: 0.35,
      max_tokens: Math.min(8192, Math.max(1024, rows.length * 80)),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Meta description agent failed (${response.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const metas = metasFromOpenRouterContent(raw);
  if (metas.length >= rows.length) return metas.slice(0, rows.length);
  return [...metas, ...Array.from({ length: rows.length - metas.length }, () => "")];
}

function applyMetasAtIndices(out: CSVRow[], indices: number[], metas: string[]): void {
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!;
    if (idx < 0 || idx >= out.length) continue;
    out[idx] = { ...out[idx]!, meta_description: metas[i] ?? "" };
  }
}

export type FillSapRowMetaOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  onProgress?: (done: number, total: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

/** OpenRouter meta descriptions for SAP rows (after titles exist). */
export async function fillSapRowMetaFromOpenRouter(
  rows: CSVRow[],
  options: FillSapRowMetaOptions,
): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const siteId = options.siteId;
  const out = rows.map((r) => ({ ...r }));
  const total = out.length;

  const pendingIndices = out
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !(row.meta_description ?? "").trim())
    .map(({ index }) => index);

  if (pendingIndices.length === 0) {
    options.onProgress?.(total, total);
    return out;
  }

  const chunkStarts: number[] = [];
  for (let chunkStart = 0; chunkStart < pendingIndices.length; chunkStart += META_FILL_CHUNK) {
    chunkStarts.push(chunkStart);
  }

  await Promise.all(
    chunkStarts.map(async (chunkStart) => {
      const chunkIndices = pendingIndices.slice(chunkStart, chunkStart + META_FILL_CHUNK);
      const chunkRows = chunkIndices.map((i) => out[i]!);
      try {
        const metas = await fetchMetasBatch(apiKey, model, siteId, chunkRows);
        applyMetasAtIndices(out, chunkIndices, metas);
      } catch {
        // Keep static rows; skip failed chunk
      }
      options.onRowsUpdate?.(out.map((row) => ({ ...row })));
      options.onProgress?.(
        out.filter((r) => (r.meta_description ?? "").trim().length > 0).length,
        total,
      );
    }),
  );

  return out;
}

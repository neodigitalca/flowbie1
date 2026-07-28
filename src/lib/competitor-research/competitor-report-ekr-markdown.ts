import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import { formatCompetitorMetricCell } from "@/lib/competitor-research/competitor-report-number-format";
import type { CompetitorReportWirePayload } from "@/lib/competitor-research/competitor-report-wire";

/** Escape pipe so Markdown pipe tables stay valid. */
function escapePipeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function renderKeywordTableBlock(rows: CompetitorReportWirePayload["ekr"]): string {
  const lines = [
    "| Keyword phrase | Volume | Traffic | Position |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const [, phrase, vol, tr, pos] of rows) {
    lines.push(
      `| ${escapePipeCell(phrase)} | ${formatCompetitorMetricCell(vol)} | ${formatCompetitorMetricCell(tr)} | ${formatCompetitorMetricCell(pos)} |`,
    );
  }
  return lines.join("\n");
}

function renderSkTableBlock(sk: CompetitorReportWirePayload["sk"]): string {
  const lines = [
    "| Keyword phrase | Volume | Traffic | Position |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const [phrase, vol, tr, pos] of sk) {
    lines.push(
      `| ${escapePipeCell(phrase)} | ${formatCompetitorMetricCell(vol)} | ${formatCompetitorMetricCell(tr)} | ${formatCompetitorMetricCell(pos)} |`,
    );
  }
  return lines.join("\n");
}

/** Cluster appendix: label row + aggregated metrics + member phrases (when skM has any members). */
function renderSkClusterTableBlock(
  sk: CompetitorReportWirePayload["sk"],
  skM: string[][] | undefined,
): string {
  const m = skM ?? sk.map(() => []);
  const hasMembers = m.some((row) => row.length > 0);
  if (!hasMembers) return renderSkTableBlock(sk);

  const lines = [
    "| Cluster | Σ Volume | Σ Traffic | Best position | Member phrases (Semrush) |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  for (let i = 0; i < sk.length; i++) {
    const [phrase, vol, tr, pos] = sk[i];
    const mem = m[i] ?? [];
    lines.push(
      `| ${escapePipeCell(phrase)} | ${formatCompetitorMetricCell(vol)} | ${formatCompetitorMetricCell(tr)} | ${formatCompetitorMetricCell(pos)} | ${escapePipeCell(mem.join("; "))} |`,
    );
  }
  return lines.join("\n");
}

function renderEkrClusterTableBlock(
  kwRows: CompetitorReportWirePayload["ekr"],
  membersParallel: string[][],
): string {
  const hasMembers = membersParallel.some((row) => row.length > 0);
  if (!hasMembers) return renderKeywordTableBlock(kwRows);

  const lines = [
    "| Cluster | Σ Volume | Σ Traffic | Best position | Member phrases (Semrush) |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  for (let i = 0; i < kwRows.length; i++) {
    const [, phrase, vol, tr, pos] = kwRows[i];
    const mem = membersParallel[i] ?? [];
    lines.push(
      `| ${escapePipeCell(phrase)} | ${formatCompetitorMetricCell(vol)} | ${formatCompetitorMetricCell(tr)} | ${formatCompetitorMetricCell(pos)} | ${escapePipeCell(mem.join("; "))} |`,
    );
  }
  return lines.join("\n");
}

function emitDomainKeywordSection(
  displayDom: string,
  kwRows: CompetitorReportWirePayload["ekr"],
  membersByRow: string[][],
): string[] {
  return [
    `### **${escapePipeCell(displayDom)}**`,
    "",
    renderEkrClusterTableBlock(kwRows, membersByRow),
    "",
  ];
}

/**
 * Semantic cluster appendix: seed + competitor domains with aggregated Σ Vol / Σ Tr / best position and member phrases when `skM`/`ekrM` are present.
 */
export function renderKeywordsTheyOwnAppendix(wire: CompetitorReportWirePayload): string {
  const { sr, ekr, sk, sd, skM, ekrM, dm } = wire;
  if (!ekr.length && !sk.length) return "";

  const ekrMembers = ekrM ?? ekr.map(() => []);
  const zipped = ekr.map((row, i) => ({
    row,
    mem: ekrMembers[i] ?? [],
  }));

  const byDomain = new Map<string, typeof zipped>();
  for (const z of zipped) {
    const di = z.row[0];
    const domStr = typeof di === "number" && dm[di] != null ? dm[di] : "";
    const dk = normalizeCompetitorDomainKey(domStr);
    if (!byDomain.has(dk)) byDomain.set(dk, []);
    byDomain.get(dk)!.push(z);
  }

  const out: string[] = [
    "## **Keywords They Own**",
    "",
    "*Semrush domain_organic phrases grouped into **semantic clusters** by the research model. Σ Volume and Σ Traffic are summed from Semrush rows in each cluster; Best position is the best (lowest) rank among members. Member phrases are exact Semrush strings.*",
    "",
  ];

  if (sk.length > 0 && sd) {
    out.push(
      "### **Seed site**",
      "",
      `*${escapePipeCell(sd)}*`,
      "",
      renderSkClusterTableBlock(sk, skM),
      "",
    );
  }

  if (!ekr.length) {
    return `${out.join("\n").trimEnd()}\n`;
  }

  const emitted = new Set<string>();

  for (const row of sr) {
    const dk = normalizeCompetitorDomainKey(row[0]);
    const zs = byDomain.get(dk);
    if (!zs?.length) continue;
    emitted.add(dk);
    const kwRows = zs.map((z) => z.row);
    const mems = zs.map((z) => z.mem);
    out.push(...emitDomainKeywordSection(String(row[0]).trim(), kwRows, mems));
  }

  const rest = [...byDomain.keys()]
    .filter((d) => !emitted.has(d))
    .sort((a, b) => a.localeCompare(b));
  for (const dk of rest) {
    const zs = byDomain.get(dk)!;
    const kwRows = zs.map((z) => z.row);
    const mems = zs.map((z) => z.mem);
    const di0 = kwRows[0]?.[0];
    const displayDom =
      typeof di0 === "number" && dm[di0] != null ? String(dm[di0]).trim() : String(dk).trim();
    out.push(...emitDomainKeywordSection(displayDom, kwRows, mems));
  }

  return `${out.join("\n").trimEnd()}\n`;
}

/** Keyword tables only (no H2), grouped by domain. */
export function renderAttackableKeywordsFromEkr(
  ekr: CompetitorReportWirePayload["ekr"],
  dm: string[],
): string {
  if (!ekr.length) return "";
  const byDomain = new Map<string, CompetitorReportWirePayload["ekr"]>();
  for (const row of ekr) {
    const di = row[0];
    const domStr = typeof di === "number" && dm[di] != null ? dm[di] : "";
    const k = normalizeCompetitorDomainKey(domStr);
    if (!byDomain.has(k)) byDomain.set(k, []);
    byDomain.get(k)!.push(row);
  }
  const sorted = [...byDomain.keys()].sort((a, b) => a.localeCompare(b));
  const blocks: string[] = [];
  for (const dk of sorted) {
    const rows = byDomain.get(dk)!;
    const di0 = rows[0]?.[0];
    const displayDom =
      typeof di0 === "number" && dm[di0] != null ? String(dm[di0]).trim() : String(dk).trim();
    blocks.push(`### **${escapePipeCell(displayDom)}**`, "", renderKeywordTableBlock(rows), "");
  }
  return blocks.join("\n").trimEnd() + "\n";
}

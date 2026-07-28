/** Sheet2-style redirect map: GSC page column + planned new_url (+ optional metrics). */
export const GSC_REDIRECT_MAP_TEMPLATE_HEADERS = [
  "Top pages",
  "new_url",
  "Clicks",
  "Impressions",
  "CTR",
  "Position",
] as const;

const EXAMPLE_ROWS: readonly string[][] = [
  [
    "https://www.example.com/2022/10/12/old-blog-slug/",
    "https://www.example.com/blog/canadian-digital-adoption-program/",
    "0",
    "7525",
    "0%",
    "44.12",
  ],
  [
    "https://www.example.com/2023/04/05/another-old-post/",
    "https://www.example.com/blog/accounting-for-auto-repair/",
    "0",
    "1271",
    "0%",
    "68.33",
  ],
  [
    "https://www.example.com/blog/legacy-profit-post/",
    "https://www.example.com/blog/auto-repair-profitability/",
    "0",
    "500",
    "0%",
    "35",
  ],
  [
    "https://www.example.com/blog/legacy-profit-improvement/",
    "https://www.example.com/blog/auto-repair-profitability/",
    "0",
    "400",
    "0%",
    "40",
  ],
];

function csvEsc(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Downloadable template matching Sheet2 (Top pages → new_url) with optional GSC metrics. */
export function buildGscRedirectMapTemplateCsv(): string {
  const lines = [GSC_REDIRECT_MAP_TEMPLATE_HEADERS.join(",")];
  for (const row of EXAMPLE_ROWS) {
    lines.push(row.map(csvEsc).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function isRedirectMapUpload(rows: readonly { redirectFromUrl?: string }[]): boolean {
  return rows.length > 0 && rows.every((r) => Boolean(r.redirectFromUrl?.trim()));
}

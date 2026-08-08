import type { ApiDocFrontmatter, TocEntry } from "./types";

export function parseFrontmatter(raw: string): { frontmatter: ApiDocFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: { title: "Untitled", slug: "", section: "" },
      body: raw,
    };
  }

  const block = match[1];
  const body = match[2];
  /** @type {Record<string, string | string[]>} */
  const data: Record<string, string | string[]> = {};

  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key === "related") continue;
    data[key] = value;
  }

  const relatedMatch = block.match(/related:\s*\n((?:\s+-\s+.+\n?)+)/);
  const related = relatedMatch
    ? relatedMatch[1]
        .split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean)
    : undefined;

  const frontmatter: ApiDocFrontmatter = {
    title: String(data.title ?? "Untitled"),
    slug: String(data.slug ?? ""),
    section: String(data.section ?? ""),
    method: data.method ? String(data.method) : undefined,
    path: data.path ? String(data.path) : undefined,
    auth: data.auth ? String(data.auth) : undefined,
    order: data.order ? Number(data.order) : undefined,
    related,
  };

  return { frontmatter, body };
}

export function slugToHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractToc(body: string): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const line of body.split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const text = h2[1].trim();
      entries.push({ id: slugToHeadingId(text), text, level: 2 });
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const text = h3[1].trim();
      entries.push({ id: slugToHeadingId(text), text, level: 3 });
    }
  }
  return entries;
}

import manifestJson from "../../../docs/api/_manifest.json";
import { extractToc, parseFrontmatter } from "./parse-frontmatter";
import type { ApiDocArticle, ApiDocManifest, TocEntry } from "./types";

const rawModules = import.meta.glob("../../../docs/api/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const articlesBySlug = new Map<string, ApiDocArticle>();

for (const raw of Object.values(rawModules)) {
  const { frontmatter, body } = parseFrontmatter(raw);
  if (!frontmatter.slug) continue;
  articlesBySlug.set(frontmatter.slug, {
    ...frontmatter,
    body,
    raw,
  });
}

export const apiDocsManifest = manifestJson as ApiDocManifest;

export function getApiDocArticle(slug: string): ApiDocArticle | undefined {
  const normalized = slug.replace(/^\/+|\/+$/g, "") || "getting-started";
  return articlesBySlug.get(normalized);
}

export function getDefaultApiDocSlug(): string {
  return "getting-started";
}

export function getArticleToc(slug: string): TocEntry[] {
  const article = getApiDocArticle(slug);
  if (!article) return [];
  return extractToc(article.body);
}

export function getAllApiDocSlugs(): string[] {
  return [...articlesBySlug.keys()];
}

export function authLabel(auth?: string): string {
  const map: Record<string, string> = {
    public: "Public",
    session: "Session required",
    "session-team": "Session + team member",
    "team-rbac-communication": "Session + communication permission",
    open: "Open (server credentials)",
  };
  return auth ? (map[auth] ?? auth) : "Open (server credentials)";
}

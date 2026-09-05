import { extractToc, parseFrontmatter } from "./parse-frontmatter";
import { getAllManifestSlugs } from "./api-docs-manifest";
import type { ApiDocArticle, TocEntry } from "./types";

export { apiDocsManifest, getAllManifestSlugs } from "./api-docs-manifest";
export { getDefaultApiDocSlug, DEFAULT_API_DOC_SLUG } from "./api-docs-constants";

const rawModules = import.meta.glob("../../../docs/api/**/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const modulePaths = Object.keys(rawModules);

const articlesBySlug = new Map<string, ApiDocArticle>();
const loadingBySlug = new Map<string, Promise<ApiDocArticle | undefined>>();

function normalizeSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "") || "getting-started";
}

/** Resolve a manifest slug to a Vite glob path without fetching file contents. */
function findModulePathForSlug(slug: string): string | undefined {
  const normalized = normalizeSlug(slug);
  const lastSeg = normalized.split("/").pop() ?? normalized;
  const dashForm = normalized.replace(/\//g, "-");

  const relCandidates = [
    `${normalized}.md`,
    `${normalized}/index.md`,
  ];
  const parts = normalized.split("/");
  if (parts.length >= 2) {
    relCandidates.push(`${parts[0]}/${parts[0]}-${lastSeg}.md`);
    relCandidates.push(`${parts[0]}/${parts[0]}.md`);
  }

  for (const rel of relCandidates) {
    const hit = modulePaths.find((p) => p.replace(/\\/g, "/").endsWith(`/docs/api/${rel}`));
    if (hit) return hit;
  }

  const basenameMatches = modulePaths.filter((p) => {
    const base = p.split("/").pop()?.replace(/\.md$/i, "") ?? "";
    return base === dashForm || base === lastSeg || base.endsWith(`-${lastSeg}`);
  });
  if (basenameMatches.length === 1) return basenameMatches[0];
  if (basenameMatches.length > 1) {
    const nested = basenameMatches.find((p) => p.replace(/\\/g, "/").includes(`/${normalized}/`));
    if (nested) return nested;
    return basenameMatches[0];
  }

  return undefined;
}

async function parseModulePath(modulePath: string): Promise<ApiDocArticle | undefined> {
  const loader = rawModules[modulePath];
  if (!loader) return undefined;
  const raw = await loader();
  const { frontmatter, body } = parseFrontmatter(raw);
  if (!frontmatter.slug) return undefined;
  const article: ApiDocArticle = { ...frontmatter, body, raw };
  articlesBySlug.set(frontmatter.slug, article);
  return article;
}

export async function loadApiDocArticle(slug: string): Promise<ApiDocArticle | undefined> {
  const normalized = normalizeSlug(slug);
  const cached = articlesBySlug.get(normalized);
  if (cached) return cached;

  const pending = loadingBySlug.get(normalized);
  if (pending) return pending;

  const promise = (async () => {
    const modulePath = findModulePathForSlug(normalized);
    if (!modulePath) return undefined;
    const article = await parseModulePath(modulePath);
    if (article && article.slug !== normalized) {
      articlesBySlug.set(normalized, article);
    }
    return articlesBySlug.get(normalized);
  })();

  loadingBySlug.set(normalized, promise);
  try {
    return await promise;
  } finally {
    loadingBySlug.delete(normalized);
  }
}

/** Sequential preload for tests and validation only. */
export async function loadAllApiDocArticles(): Promise<void> {
  for (const slug of getAllManifestSlugs()) {
    await loadApiDocArticle(slug);
  }
}

export function getApiDocArticle(slug: string): ApiDocArticle | undefined {
  return articlesBySlug.get(normalizeSlug(slug));
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

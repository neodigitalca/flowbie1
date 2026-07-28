import { fetchOnPageContentParsing } from "@/lib/backlink-research/fetch-on-page-content-parsing";
import {
  extractPageTitleFromOnPageDfsResponse,
  extractPlainTextFromOnPageDfsResponse,
} from "@/lib/backlink-research/on-page-dfs-extract-text";
import {
  extractImportedDraftLinksFromMarkdown,
  normalizeImportedDraftUrl,
} from "@/lib/bulk/blog-import-draft-links";

export type ModifierExternalLink = {
  url: string;
  anchorText: string;
  pageTitle?: string;
  excerpt?: string;
};

const TRAILING_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "}", "]", "'", '"']);
const LEADING_PUNCT = new Set(["(", "{", "[", "<", "'", '"']);

function stripEdgePunctuation(token: string): string {
  let s = token;
  while (s.length > 0 && TRAILING_PUNCT.has(s[s.length - 1]!)) {
    s = s.slice(0, -1);
  }
  while (s.length > 0 && LEADING_PUNCT.has(s[0]!)) {
    s = s.slice(1);
  }
  return s;
}

function anchorFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export function extractUrlsFromModifierText(text: string | undefined): string[] {
  const raw = text?.trim();
  if (!raw) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  const add = (candidate: string) => {
    const url = normalizeImportedDraftUrl(stripEdgePunctuation(candidate));
    if (!url) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url);
  };

  for (const link of extractImportedDraftLinksFromMarkdown(raw)) {
    add(link.url);
  }

  for (const token of raw.split(/\s+/)) {
    add(token);
  }

  return out;
}

export async function researchModifierExternalLinks(
  urls: string[],
  signal?: AbortSignal,
): Promise<ModifierExternalLink[]> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const results = await Promise.all(
    unique.map(async (url): Promise<ModifierExternalLink> => {
      try {
        const response = await fetchOnPageContentParsing({ url, signal });
        const pageTitle = extractPageTitleFromOnPageDfsResponse(response).trim();
        const excerpt = extractPlainTextFromOnPageDfsResponse(response, 600).trim();
        const anchorText = pageTitle || anchorFromUrl(url);
        return {
          url,
          anchorText,
          ...(pageTitle ? { pageTitle } : {}),
          ...(excerpt ? { excerpt } : {}),
        };
      } catch {
        return { url, anchorText: anchorFromUrl(url) };
      }
    }),
  );

  return results;
}

export function formatModifierExternalLinksForPrompt(links: ModifierExternalLink[]): string {
  if (links.length === 0) return "";
  const lines = links.map((link, i) => {
    const title = link.pageTitle ? ` | title: ${link.pageTitle}` : "";
    const excerpt = link.excerpt ? `\n   Excerpt: ${link.excerpt}` : "";
    return `${i + 1}. [${link.anchorText}](${link.url})${title}${excerpt}`;
  });
  return `
=== MODIFIER EXTERNAL LINKS (MANDATORY — COPY EXACTLY) ===
The user pasted these URLs in the Modifications field. Every link MUST appear in the final article using the **exact** URL below. Use markdown \`[anchor](url)\`. Include **all** of them at least once. Do not substitute, shorten, or omit any href.

${lines.join("\n")}

Checklist: include \`[MODIFIER_EXTERNAL_LINK]\` with the exact markdown for each URL above.
Blueprint: include \`[MODIFIER_EXTERNAL_LINK]\` in features with the exact markdown.
=== END MODIFIER EXTERNAL LINKS ===
`;
}

export function injectModifierExternalLinksIntoChecklist(
  checklist: string[],
  links: ModifierExternalLink[],
): string[] {
  if (links.length === 0) return checklist;
  const next = [...checklist];
  for (const link of links) {
    const line = `[MODIFIER_EXTERNAL_LINK]: Include exact markdown [${link.anchorText}](${link.url}) in body copy at least once. Use exact href: ${link.url}`;
    if (next.some((item) => item.includes(link.url))) continue;
    next.push(line);
  }
  return next;
}

type BlueprintAgent = {
  step?: number;
  title?: string;
  features?: string[];
};

export function injectModifierExternalLinksIntoBlueprintAgents<T extends BlueprintAgent>(
  agents: T[],
  links: ModifierExternalLink[],
): T[] {
  if (links.length === 0 || agents.length === 0) return agents;

  const introIdx = agents.findIndex((a) => a.step === 1);
  const targetIndices = new Set<number>();
  if (introIdx >= 0) {
    targetIndices.add(introIdx);
  } else {
    targetIndices.add(0);
  }
  const bodyIdx = introIdx >= 0 ? introIdx + 1 : 1;
  if (bodyIdx < agents.length) {
    targetIndices.add(bodyIdx);
  }

  return agents.map((agent, index) => {
    if (!targetIndices.has(index)) return agent;
    const features = Array.isArray(agent.features) ? [...agent.features] : [];
    for (const link of links) {
      const feature = `[MODIFIER_EXTERNAL_LINK]: [${link.anchorText}](${link.url})`;
      if (features.some((f) => f.includes(link.url))) continue;
      features.push(feature);
    }
    return { ...agent, features };
  });
}

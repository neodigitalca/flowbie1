/**
 * Detect SAP entity page collisions against live inventory (published + scheduled)
 * and resolve duplicates via OpenRouter keyword variation.
 */

import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import { keywordUniquenessKey } from "@/lib/local-analysis-fill-keywords-from-wp-inventory";
import {
  normalizeSapKeywordWithPlaceSuffix,
  sapKeywordFromShortBaseAndEntity,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import { buildEntityAdGroupSections } from "@/lib/local-analysis/sap-entity-ad-groups";
import { resolveEntitySapTitleFromTemplate } from "@/lib/local-analysis/entity-sap-title-agent";
import { filterSapInventoryRows } from "@/lib/local-analysis/entity-generator-keyword-inventory";
import { sanitizeWordPressSlugSegment } from "@/lib/rank-math-redirect-csv";
import { buildSapSlugFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";
import {
  aiRejectBrandOrBlockedTexts,
} from "@/lib/content-brand-ai-gate";
import {
  GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK,
} from "@/lib/content-topic-blocklist";
import { isOffensiveGscQuery } from "@/lib/gsc-offensive-word-blocklist";
import { postOpenRouterAppChatFetch } from "@/lib/openrouter-app-api";

const MAX_COLLISION_RESOLVE_ATTEMPTS = 3;

/** Uniqueness key for a full entity focus keyword (keyword + entity → slug). */
export function entityKeywordPairKey(keyword: string, entity: string): string {
  const ent = normalizeEntityHintCommaLabel(entity.trim());
  const kw = keyword.trim();
  if (!ent || !kw) return "";
  const slug = buildSapSlugFromKeywordEntity(kw, ent);
  return slug || `${keywordUniquenessKey(kw)}::${ent.toLowerCase()}`;
}

function pickGscKeywordForEntityRow(args: {
  entity: string;
  gscKeywords: readonly string[];
  gridLocations: readonly string[];
  usedInGroup: Set<string>;
  occupancy: EntitySapOccupancy;
  reservedInGroup: Set<string>;
  titleTemplate?: string;
  skipInventoryCollision?: boolean;
}): string | null {
  for (const base of args.gscKeywords) {
    const trimmed = base.trim();
    if (!trimmed || isOffensiveGscQuery(trimmed)) continue;
    const keyword = sapKeywordFromShortBaseAndEntity(trimmed, args.entity, args.gridLocations);
    if (!keyword || isOffensiveGscQuery(keyword)) continue;
    const pairKey = entityKeywordPairKey(keyword, args.entity);
    if (!pairKey || args.usedInGroup.has(pairKey)) continue;
    if (!args.skipInventoryCollision) {
      const collision = findEntitySapRowCollision(
        { keyword, entity: args.entity, titleTemplate: args.titleTemplate },
        args.occupancy,
        args.reservedInGroup,
      );
      if (collision) continue;
    }
    return keyword;
  }
  return null;
}

export type EntitySapExistingPage = {
  slug: string;
  title: string;
  keyword: string;
  entity: string;
  url: string;
};

export type EntitySapOccupancy = {
  slugKeys: Set<string>;
  byEntity: Map<string, EntitySapExistingPage[]>;
};

export type EntitySapRowCollision = {
  kind: "slug" | "keyword" | "title";
  existing: EntitySapExistingPage;
};

export type EntitySapBlockedForEntity = {
  slugs: string[];
  keywords: string[];
  titles: string[];
  existingPages: EntitySapExistingPage[];
};

function normalizeTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function entityKey(entity: string): string {
  return normalizeEntityHintCommaLabel(entity.trim()).toLowerCase();
}

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url.trim()).pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    return sanitizeWordPressSlugSegment(parts[parts.length - 1] ?? "");
  } catch {
    return "";
  }
}

function keywordFromInventoryRow(row: SiteInventoryBulkRow): string {
  const acf =
    row.acf && typeof row.acf === "object" ? (row.acf as Record<string, unknown>) : {};
  const fromAcf = typeof acf.keyword_focus === "string" ? acf.keyword_focus.trim() : "";
  return fromAcf || (row.fields?.keyword ?? "").trim();
}

/** Parse entity place from SAP title pattern "{service} Near {entity}". */
export function parseEntityFromSapTitle(title: string): string | null {
  const m = title.trim().match(/\bnear\s+(.+)$/i);
  if (!m?.[1]) return null;
  const parsed = normalizeEntityHintCommaLabel(m[1].trim());
  return parsed || null;
}

function inventoryRowToExistingPage(row: SiteInventoryBulkRow): EntitySapExistingPage | null {
  const url = row.url?.trim();
  if (!url) return null;
  const title = (row.fields?.title ?? "").trim();
  const keyword = keywordFromInventoryRow(row);
  const slug = sanitizeWordPressSlugSegment(row.slug?.trim() ?? "") || slugFromUrl(url);
  const entity =
    parseEntityFromSapTitle(title) ||
    (keyword ? null : null);
  if (!entity) return null;
  return { slug, title, keyword, entity, url };
}

export function buildEntitySapOccupancy(rows: SiteInventoryBulkRow[]): EntitySapOccupancy {
  const slugKeys = new Set<string>();
  const byEntity = new Map<string, EntitySapExistingPage[]>();
  for (const row of filterSapInventoryRows(rows)) {
    const page = inventoryRowToExistingPage(row);
    if (!page) continue;
    if (page.slug) slugKeys.add(page.slug);
    const key = entityKey(page.entity);
    const list = byEntity.get(key) ?? [];
    list.push(page);
    byEntity.set(key, list);
  }
  return { slugKeys, byEntity };
}

export function collectBlockedForEntity(
  occupancy: EntitySapOccupancy,
  entity: string,
): EntitySapBlockedForEntity {
  const pages = occupancy.byEntity.get(entityKey(entity)) ?? [];
  const slugs = new Set<string>();
  const keywords = new Set<string>();
  const titles = new Set<string>();
  for (const page of pages) {
    if (page.slug) slugs.add(page.slug);
    const kwKey = keywordUniquenessKey(page.keyword);
    if (kwKey) keywords.add(kwKey);
    const titleKey = normalizeTitleKey(page.title);
    if (titleKey) titles.add(titleKey);
  }
  return {
    slugs: [...slugs],
    keywords: [...keywords],
    titles: [...titles],
    existingPages: pages,
  };
}

export function predictedEntitySapTitle(
  keyword: string,
  entity: string,
  titleTemplate?: string,
): string {
  return resolveEntitySapTitleFromTemplate(keyword, entity, titleTemplate);
}

export function findEntitySapRowCollision(
  row: {
    keyword: string;
    entity: string;
    title?: string;
    titleTemplate?: string;
  },
  occupancy: EntitySapOccupancy,
  reservedSlugsInRun?: Set<string>,
): EntitySapRowCollision | null {
  const entity = normalizeEntityHintCommaLabel(row.entity.trim());
  const keyword = row.keyword.trim();
  if (!entity || !keyword) return null;

  const slug = buildSapSlugFromKeywordEntity(keyword, entity);
  const kwKey = keywordUniquenessKey(keyword);
  const title =
    row.title?.trim() ||
    predictedEntitySapTitle(keyword, entity, row.titleTemplate);
  const titleKey = normalizeTitleKey(title);
  const entKey = entityKey(entity);
  const existingForEntity = occupancy.byEntity.get(entKey) ?? [];

  if (slug && (occupancy.slugKeys.has(slug) || reservedSlugsInRun?.has(slug))) {
    const existing =
      existingForEntity.find((p) => p.slug === slug) ??
      ({ slug, title: "", keyword: "", entity, url: "" } as EntitySapExistingPage);
    return { kind: "slug", existing };
  }

  for (const page of existingForEntity) {
    if (kwKey && keywordUniquenessKey(page.keyword) === kwKey) {
      return { kind: "keyword", existing: page };
    }
    if (titleKey && normalizeTitleKey(page.title) === titleKey) {
      return { kind: "title", existing: page };
    }
  }

  return null;
}

export function reserveEntitySapSlug(
  reservedSlugsInRun: Set<string>,
  keyword: string,
  entity: string,
): void {
  const slug = buildSapSlugFromKeywordEntity(keyword, entity);
  if (slug) reservedSlugsInRun.add(slug);
}

const VARIATION_KEYWORD_SYSTEM = `You assign one alternate focus keyword for a **service-area (SAP) landing page** when the proposed keyword would duplicate an existing page for the same place.

Return **only** valid JSON: {"keyword":"..."}

Rules:
- **2–3 word** service / product phrase only. Do **not** append city, neighbourhood, or province — code appends the entity afterward.
- Must differ from \`blockedKeywords\` and must not produce the same intent as \`collidingKeyword\`.
- Base on unused \`gscKeywords\` first; otherwise invent a distinct product/service angle for the dealer's industry.
- **NEVER** use the site's own trading name from \`siteName\` as the keyword.
${GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK}
No markdown outside JSON.`;

async function postOpenRouterJson(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const res = await postOpenRouterAppChatFetch( {
    method: "POST",
    headers: openRouterWebAppHeaders(args.apiKey),
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      temperature: args.temperature,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });
  const j = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) return "";
  const content = j.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function inventAlternateKeywordViaOpenRouter(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  entity: string;
  collidingKeyword: string;
  collision: EntitySapRowCollision;
  blocked: EntitySapBlockedForEntity;
  gscKeywords: string[];
  seedKeywords: string[];
  gridLocations: string[];
  temperature: number;
}): Promise<string | null> {
  const user = JSON.stringify({
    siteName: args.siteName,
    siteUrl: args.siteUrl,
    entity: args.entity,
    collidingKeyword: args.collidingKeyword,
    collisionKind: args.collision.kind,
    existingPage: args.collision.existing,
    blockedKeywords: args.blocked.keywords,
    blockedSlugs: args.blocked.slugs,
    blockedTitles: args.blocked.titles,
    existingSapPagesForEntity: args.blocked.existingPages.map((p) => ({
      title: p.title,
      keyword: p.keyword,
      slug: p.slug,
    })),
    gscKeywords: args.gscKeywords,
    seedKeywords: args.seedKeywords,
    gridLocations: args.gridLocations,
  });
  const raw = await postOpenRouterJson({
    apiKey: args.apiKey,
    model: args.model,
    system: VARIATION_KEYWORD_SYSTEM,
    user,
    temperature: args.temperature,
  });
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { keyword?: unknown };
    const base = String(parsed.keyword ?? "").trim();
    if (!base || isOffensiveGscQuery(base)) return null;
    const normalized = normalizeSapKeywordWithPlaceSuffix(
      base,
      args.entity,
      args.gridLocations,
    );
    if (!normalized || isOffensiveGscQuery(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

export type ResolveEntitySapRowCollisionsArgs = {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  rows: CSVRow[];
  occupancy: EntitySapOccupancy;
  gscKeywords: string[];
  seedKeywords: string[];
  gridLocations: string[];
  titleTemplate?: string;
  reservedSlugsInRun?: Set<string>;
  temperature?: number;
};

/** Reassign keywords for rows that still collide with inventory. Uniqueness is per ad group only. */
export async function resolveEntitySapRowCollisionsViaOpenRouter(
  args: ResolveEntitySapRowCollisionsArgs,
): Promise<CSVRow[]> {
  const {
    apiKey,
    model,
    siteName,
    siteUrl,
    rows,
    occupancy,
    gscKeywords,
    seedKeywords,
    gridLocations,
    titleTemplate,
    temperature = 0.45,
  } = args;
  const out = rows.map((r) => ({ ...r }));
  const sections = buildEntityAdGroupSections(out);

  for (const section of sections) {
    const reservedInGroup = new Set<string>();
    const usedInGroup = new Set<string>();

    for (const globalIdx of section.rowIndices) {
      const row = out[globalIdx]!;
      const entity = normalizeEntityHintCommaLabel((row.entity ?? section.entity).trim());
      let currentKeyword = (row.keyword ?? "").trim();
      if (!entity) continue;

      if (currentKeyword) {
        const pairKey = entityKeywordPairKey(currentKeyword, entity);
        if (pairKey) usedInGroup.add(pairKey);
        reserveEntitySapSlug(reservedInGroup, currentKeyword, entity);
      }

      if (!currentKeyword) {
        const picked = pickGscKeywordForEntityRow({
          entity,
          gscKeywords,
          gridLocations,
          usedInGroup,
          occupancy,
          reservedInGroup,
          titleTemplate,
        });
        if (picked) {
          currentKeyword = picked;
          out[globalIdx] = { ...row, keyword: currentKeyword };
          const pairKey = entityKeywordPairKey(currentKeyword, entity);
          if (pairKey) usedInGroup.add(pairKey);
          reserveEntitySapSlug(reservedInGroup, currentKeyword, entity);
        }
        continue;
      }

      let collision = findEntitySapRowCollision(
        { keyword: currentKeyword, entity, titleTemplate },
        occupancy,
        reservedInGroup,
      );
      if (!collision) continue;

      const blocked = collectBlockedForEntity(occupancy, entity);
      const collidingPairKey = entityKeywordPairKey(currentKeyword, entity);
      if (collidingPairKey) usedInGroup.delete(collidingPairKey);

      const gscAlternate = pickGscKeywordForEntityRow({
        entity,
        gscKeywords,
        gridLocations,
        usedInGroup,
        occupancy,
        reservedInGroup,
        titleTemplate,
      });
      if (gscAlternate) {
        currentKeyword = gscAlternate;
        collision = findEntitySapRowCollision(
          { keyword: currentKeyword, entity, titleTemplate },
          occupancy,
          reservedInGroup,
        );
      }

      for (let attempt = 0; attempt < MAX_COLLISION_RESOLVE_ATTEMPTS && collision; attempt++) {
        const alternate = await inventAlternateKeywordViaOpenRouter({
          apiKey,
          model,
          siteName,
          siteUrl,
          entity,
          collidingKeyword: currentKeyword,
          collision,
          blocked,
          gscKeywords,
          seedKeywords,
          gridLocations,
          temperature: Math.min(temperature + 0.1 * attempt, 0.75),
        });
        if (!alternate) continue;

        const rejected = await aiRejectBrandOrBlockedTexts({
          apiKey,
          model,
          companyName: siteName,
          candidates: [alternate],
          kind: "keyword",
        });
        if (rejected.length > 0) continue;

        currentKeyword = alternate;
        collision = findEntitySapRowCollision(
          { keyword: currentKeyword, entity, titleTemplate },
          occupancy,
          reservedInGroup,
        );
      }

      if (collision) {
        const fallback = pickGscKeywordForEntityRow({
          entity,
          gscKeywords,
          gridLocations,
          usedInGroup,
          occupancy,
          reservedInGroup,
          titleTemplate,
          skipInventoryCollision: true,
        });
        if (fallback) {
          currentKeyword = fallback;
          collision = null;
        }
      }

      out[globalIdx] = { ...row, keyword: currentKeyword };
      const resolvedPairKey = entityKeywordPairKey(currentKeyword, entity);
      if (resolvedPairKey) usedInGroup.add(resolvedPairKey);
      reserveEntitySapSlug(reservedInGroup, currentKeyword, entity);
    }
  }

  return out;
}

export function titleCollidesWithEntityInventory(
  title: string,
  entity: string,
  occupancy: EntitySapOccupancy,
): boolean {
  const key = normalizeTitleKey(title);
  if (!key) return false;
  const pages = occupancy.byEntity.get(entityKey(entity)) ?? [];
  return pages.some((p) => normalizeTitleKey(p.title) === key);
}

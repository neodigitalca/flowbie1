import type { WordPressSite } from "@/components/integrations/types";
import { cityTokenFromLocation } from "@/lib/content-optimization/topic-research-fanout";
import {
  parseEntityPlaceParts,
  resolveServiceTopicKeyword,
} from "@/lib/entity-place-reference";
import { stripAllPlaceTokensFromKeyword } from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import { resolveSiteLocationLabel } from "@/lib/llm-audit/resolve-site-location-label";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";

export type PageLocalContext = {
  /** Site default city/state (e.g. Edmonton, AB). */
  primaryCity: string;
  /** Product/service topic with geo stripped — not a place name. */
  serviceTopic: string;
  /** SAP comma entity when present; empty on standard posts. */
  placeEntity: string;
  /** Entity prose label or primary city for scenario phrasing. */
  prosePlaceLabel: string;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPrimaryCityFromKeyword(keyword: string, primaryCity: string): string {
  const kw = keyword.trim();
  const city = primaryCity.trim();
  if (!kw || !city) return kw;
  const cityToken = cityTokenFromLocation(city);
  const province = city.includes(",") ? city.split(",").slice(1).join(",").trim() : "";
  const parts = [cityToken, city.replace(/,/g, " ").trim(), province].filter(Boolean);
  let out = kw;
  for (const part of parts) {
    const re = new RegExp(`\\b${escapeRegExp(part)}\\b`, "gi");
    out = out.replace(re, " ");
  }
  out = out.replace(/\s+/g, " ").trim();
  return out || kw;
}

export function resolvePageLocalContext(input: {
  keyword: string;
  site?: WordPressSite | null;
  entity?: string;
}): PageLocalContext {
  const keyword = input.keyword.trim();
  const entityRaw = input.entity?.trim() ?? "";
  const site = input.site ?? null;

  const primaryCity =
    getPrimaryCityStateLabel(site ?? ({} as WordPressSite))
    ?? resolveSiteLocationLabel(site, keyword)
    ?? "";

  let serviceTopic = keyword;
  if (entityRaw) {
    serviceTopic = resolveServiceTopicKeyword(keyword, entityRaw) || keyword;
  } else if (primaryCity) {
    serviceTopic = stripPrimaryCityFromKeyword(keyword, primaryCity);
  }

  const placeEntity = entityRaw ? parseEntityPlaceParts(entityRaw).canonical : "";
  const prosePlaceLabel = placeEntity
    ? parseEntityPlaceParts(entityRaw).proseLabel
    : primaryCity;

  return {
    primaryCity,
    serviceTopic: serviceTopic.trim(),
    placeEntity,
    prosePlaceLabel: prosePlaceLabel.trim(),
  };
}

export function formatPageLocalContextPromptBlock(ctx: PageLocalContext): string {
  const lines = ["--- PRIMARY LOCAL CONTEXT (MANDATORY) ---"];
  if (ctx.primaryCity) {
    lines.push(`Primary service city (mandatory for all local examples): ${ctx.primaryCity}`);
    lines.push(
      "Cost bands, scenarios, and typical project examples must use the primary service city only.",
    );
    lines.push(
      "Discard research snippets that cite other cities unless this page explicitly targets that market.",
    );
  } else {
    lines.push(
      "National article: no site city. Forbidden: inventing a city, state, or \"homeowners here in {place}\".",
    );
  }
  if (ctx.serviceTopic) {
    lines.push(`Service topic (product or brand names — never a city): ${ctx.serviceTopic}`);
    lines.push(
      "City comes only from the site profile line above. Brand words in the service topic are products, not towns.",
    );
  }
  if (ctx.placeEntity) {
    lines.push(`Place entity (SAP — comma label): ${ctx.placeEntity}`);
    lines.push(`Prose place label: ${ctx.prosePlaceLabel}`);
  } else if (ctx.prosePlaceLabel && ctx.primaryCity) {
    lines.push(`Scenario place label: ${ctx.prosePlaceLabel}`);
  }
  lines.push("--- END PRIMARY LOCAL CONTEXT ---");
  return lines.join("\n");
}

/** Fail fast when persona scenarioQuestion treats a product as a town or invents a place. */
export function validateIllustrativeScenarioGeo(
  scenarioQuestion: string | undefined,
  ctx: PageLocalContext,
): void {
  const q = scenarioQuestion?.trim() ?? "";
  if (!q) {
    throw new Error("Illustrative persona extract returned empty scenarioQuestion.");
  }

  const topic = ctx.serviceTopic.trim();
  const cityToken = cityTokenFromLocation(ctx.primaryCity);
  if (topic && cityToken) {
    const inTopic = new RegExp(`\\bin\\s+${escapeRegExp(topic)}\\b`, "i");
    if (inTopic.test(q)) {
      throw new Error(
        `Illustrative scenarioQuestion treats service topic as place ("in ${topic}").`,
      );
    }
    if (bareProductTokenUsedAsPlace(q, topic, cityToken)) {
      throw new Error(
        `Illustrative scenarioQuestion treats service topic as place ("in ${topic.split(/\s+/)[0]}").`,
      );
    }
  }

  if (!cityToken && scenarioQuestionCitesInventedPlace(q, topic)) {
    throw new Error(
      `Illustrative scenarioQuestion invented a place on a national article. Got: ${q.slice(0, 120)}`,
    );
  }
}

/** True when "in Duette" uses the first product word as a town, not "in Hunter Douglas" as the brand. */
function bareProductTokenUsedAsPlace(question: string, serviceTopic: string, cityToken: string): boolean {
  const firstToken = serviceTopic.split(/\s+/)[0]?.trim() ?? "";
  const secondToken = serviceTopic.split(/\s+/)[1]?.trim() ?? "";
  if (firstToken.length < 3 || firstToken.toLowerCase() === cityToken.toLowerCase()) return false;
  if (secondToken) {
    const brand = new RegExp(
      `\\bin\\s+${escapeRegExp(firstToken)}\\s+${escapeRegExp(secondToken)}\\b`,
      "i",
    );
    if (brand.test(question)) return false;
  }
  return new RegExp(`\\bin\\s+${escapeRegExp(firstToken)}\\b`, "i").test(question);
}

/** National articles: fail if the question names a place that is not the service topic. */
function scenarioQuestionCitesInventedPlace(question: string, serviceTopic: string): boolean {
  const topic = serviceTopic.toLowerCase();
  if (/homeowners here\b/i.test(question)) return true;
  if (/,\s*[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/.test(question)) return true;
  const matches = question.match(/\b(?:in|near|here in)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/g);
  if (!matches) return false;
  return matches.some((match) => {
    const place = match.replace(/^(?:in|near|here in)\s+/i, "").toLowerCase();
    return Boolean(place) && !topic.includes(place);
  });
}

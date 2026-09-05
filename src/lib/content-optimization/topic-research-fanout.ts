import type { WordPressSite } from "@/components/integrations/types";
import pLimit from "p-limit";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { fetchChatGptCompanyAuthority } from "@/lib/llm-audit/llm-audit-dataforseo";
import { fetchSerpOrganicForQuery } from "@/lib/llm-audit/fetch-seo-content-brief-wave";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import type {
  FirstPartyClaim,
  IllustrativeExample,
  QueryFanout,
  QueryFanoutSerpRow,
  SeoContentBriefV1,
  SerpOrganicTopEntry,
  VerifiedFact,
} from "@/lib/overview-seo-content-brief";
import { extractDataForSeoSerpBrief } from "@/lib/overview-seo-content-brief";
import { resolveSiteLocationLabel } from "@/lib/llm-audit/resolve-site-location-label";
import {
  formatPageLocalContextPromptBlock,
  resolvePageLocalContext,
  validateIllustrativeScenarioGeo,
  type PageLocalContext,
} from "@/lib/content-optimization/page-local-context";
import { formatAnswerTopicContractForIllustrativeExtract } from "@/lib/content-optimization/defensible-specificity-prompt";
import { buildLlmAuditOfficialVerificationPrompt } from "@/lib/llm-audit/llm-audit-prompts";
import { fetchUrlTextViaApi } from "@/lib/proxy-fetch-text";
import { postOpenRouterAppChat } from "@/lib/openrouter-app-api";
import { TOPIC_RESEARCH_VERIFICATION_SERP_CONCURRENCY } from "@/lib/overview/overview-research-batch-constants";

export const TOPIC_RESEARCH_FANOUT_MIN_QUERIES = 3;

export const TOPIC_RESEARCH_FANOUT_MAX_QUERIES = 5;

export const TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES = 18;

/** Max follow-up web-search verifies for economic not_found rows after primary pass. */
export const TOPIC_RESEARCH_SECONDARY_VERIFY_MAX = 4;

export const TOPIC_RESEARCH_FANOUT_CITY_REQUIRED =
  "Topic fan-out requires a company city on the connected site";

export const TOPIC_RESEARCH_PLAN_TEMPERATURE = 0.55;

export const TOPIC_RESEARCH_PLAN_SYSTEM = `You invent localized buyer research questions for a first-party company page.

Return JSON only: { "researchQueries": string[], "namedPrograms": string[] }.

researchQueries: 3 to 5 distinct questions a real local buyer in Location would ask about THIS Keyword and Title. Each question must:
- Read like a natural question or conversational search phrase (how/what/when/can/does/why, or "compare…").
- Mention the city (and province or state when Location includes it) inside the question, not as a trailing keyword suffix.
- Target a different buyer intent derived from Keyword, Title, and page context only (compare, quality, features, climate fit, process). Do not force cost, incentives, examples, or any other slot.
- Be a topic-research question whose SERP answers the Keyword decision. Do not repeat the seed keyword verbatim as the whole query.

Forbidden:
- Where-to-shop questions (where can I see, get, buy, find, or visit samples, showrooms, dealers, or this company). Those SERPs recommend other stores.
- Questions whose subject is the connected company ("Can {Company} help me…"). Research the topic, not the store.
- Rebate, incentive, grant, promotion, financing, or sale questions unless Keyword or Title is already about those.
- Required slots (no mandatory example question, no mandatory program-status question).
- "{seed keyword} {city}"
- "{company name} {city} financing"
- "{topic} rates {city}" or "{topic} installation process {city}" unless rewritten as a full natural question
- Generic national queries with no city
- Other provinces, countries, or cities
- An example from a different industry than Keyword

namedPrograms: official product or program names for THIS company ONLY if explicitly named in inputs. Copy exactly. Otherwise [].
Do not invent programs, years, or install counts.`;

export type TopicResearchPlan = {
  researchQueries: string[];
  namedPrograms: string[];
  plannerModel?: string;
  plannedAt?: string;
  researchAsOf?: string;
  illustrativeExampleQuery?: string;
  programStatusQuery?: string;
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["researchQueries", "namedPrograms"],
  properties: {
    researchQueries: { type: "array", items: { type: "string" } },
    namedPrograms: { type: "array", items: { type: "string" } },
  },
} as const;


const CLAIMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "source"],
        properties: {
          text: { type: "string" },
          source: { type: "string" },
        },
      },
    },
  },
} as const;

const CLAIMS_SYSTEM = `Extract first-party business claims the company can say as we/our.

Return JSON only: { "claims": [ { "text": string, "source": string } ] }.
Sources allowed: chatgpt, swot, gbp, master.
CONNECTED_SITE is this client. Discard ChatGPT facts about a same-name company on a different website, city, province, or country.
Discard grants, loans, rates, tax classes, and payback facts that belong to a different city or province than CONNECTED_SITE location.
Street address, headquarters, phone, and hours: only from GBP_MASTER. Never from chatgpt.
Use only facts in the source text. Years, install counts, and program names only if the source states them. If a source says a program is closed, keep that as a closed-program claim. Never invent a figure.
If the source asserts experience or volume without a figure, write a qualitative claim (years of experience, lots of installs) and never invent a number.
If the sources contain no first-party facts, return { "claims": [] }.`;

const ILLUSTRATIVE_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "leadIn",
    "personaName",
    "householdProfile",
    "situationHook",
    "scenarioQuestion",
    "scenarioNarrative",
    "recommendationTitle",
    "recommendationParagraph",
  ],
  properties: {
    leadIn: { type: "string" },
    personaName: { type: "string" },
    householdProfile: { type: "string" },
    situationHook: { type: "string" },
    scenarioQuestion: { type: "string" },
    scenarioNarrative: { type: "string" },
    recommendationTitle: { type: "string" },
    recommendationParagraph: { type: "string" },
  },
} as const;

export const ILLUSTRATIVE_PERSONA_EXTRACT_TEMPERATURE = 0.85;

export const ILLUSTRATIVE_EXTRACT_SYSTEM = `Create one persona for this blog article [ILLUSTRATIVE] section: ONE named person facing ONE real decision that this article's Keyword, Service topic, and Answer (when provided) already discuss.

Return JSON only: { leadIn, personaName, householdProfile, situationHook, scenarioQuestion, scenarioNarrative, recommendationTitle, recommendationParagraph }.

Topic contract (non-negotiable): the persona's decision MUST be the same topic as Keyword + Service topic + Page title + ARTICLE ANSWER when present. Match the buyer type those sources imply (homeowner, renter, business owner, marketing lead, etc.). Forbidden: inventing a different industry, product line, or room problem than those sources.

leadIn: always "Hypothetical scenario:" (writer ignores this).

personaName: invent a fresh first name for this page only (AI-generated — no fixed lists). Only person in the example.

householdProfile: one-line persona situation that matches this article's buyer (not a default household when the article is B2B or strategy).

situationHook: ONE constraint taken from Keyword or Answer (the tension that makes the decision hard).

scenarioQuestion: one decision question for the blockquote paragraph only (never as an H2 or H3, never prefixed with "Scenario:"). Use the site profile city from PRIMARY LOCAL CONTEXT when the example is local. Do not invent a city. Brand and product names (Hunter Douglas, Alta, Duette) are products, never towns. Forbidden: a question about a topic the Answer does not cover.

scenarioNarrative: 2-3 tight sentences. personaName weighs ONE choice from this article and why they are stuck. Anchor place names to primary service city when local.

recommendationTitle: the specific option the connected Company would recommend (strategy, service, product, or tier named in Keyword/Answer).

recommendationParagraph: 2 sentences max. SITE-FIRST: sentence one MUST open with the connected Company name as the grammatical subject ("{Company} would recommend…" or "{Company} recommends…"), then a balanced why that pick can fit this persona's decision. Use may / can / when / depending on plus variance drivers (budget, window orientation, schedule, glazing, daily routines). Forbidden: guaranteed energy savings, significant long-term savings, pays for itself, or opening with personaName ("{persona} should…"), "they should", or "a business should".

Forbidden recommendation phrases without qualification: "significant long-term energy savings", "will reduce energy bills", "guaranteed savings".

GOOD recommendationParagraph: "{Company} would recommend {the pick} when {named constraint} matters most, because {one mechanism from sources}."
BAD: inventing a city when the site profile has none.
BAD: treating a product name as a town.
BAD: citing another city for local examples when primary city is set.
BAD: a persona deciding something Keyword, Service topic, and Answer never mention.
BAD recommendationParagraph: "{personaName} should implement…"

Forbidden: Homeowner A/B, two personas, product-catalog tours, keyword slug phrasing, treating service topic tokens as geography, other-city cost bands when primary city is set, new dollar amounts when sources lack them.`;

export function normalizeIllustrativeExample(
  raw: unknown,
  asOf: string,
  illustrativeH2Title?: string,
): IllustrativeExample | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const leadIn = String(rec.leadIn ?? "").trim();
  const personaName = String(rec.personaName ?? "").trim();
  const householdProfile = String(rec.householdProfile ?? "").trim();
  const situationHook = String(rec.situationHook ?? "").trim();
  const scenarioQuestion = String(rec.scenarioQuestion ?? "").trim();
  const scenarioNarrative = String(rec.scenarioNarrative ?? "").trim();
  const recommendationTitle = String(rec.recommendationTitle ?? "").trim();
  const recommendationParagraph = String(rec.recommendationParagraph ?? "").trim();
  let quoteBody = String(rec.quoteBody ?? "").trim();
  if (!quoteBody && scenarioNarrative) {
    quoteBody = [scenarioQuestion, scenarioNarrative, recommendationTitle, recommendationParagraph]
      .filter(Boolean)
      .join("\n\n");
  }
  if (!leadIn || !quoteBody || !personaName || !scenarioNarrative || !recommendationParagraph) return undefined;
  const out: IllustrativeExample = { leadIn, quoteBody, asOf };
  const h2 = illustrativeH2Title?.trim();
  if (h2) out.illustrativeH2Title = h2;
  out.personaName = personaName;
  if (householdProfile) out.householdProfile = householdProfile;
  if (situationHook) out.situationHook = situationHook;
  if (scenarioQuestion) out.scenarioQuestion = scenarioQuestion;
  out.scenarioNarrative = scenarioNarrative;
  if (recommendationTitle) out.recommendationTitle = recommendationTitle;
  out.recommendationParagraph = recommendationParagraph;
  return out;
}

function serpContextForIllustrativeQuery(
  serpByQuery: QueryFanoutSerpRow[] | undefined,
  illustrativeExampleQuery: string,
): string {
  const q = illustrativeExampleQuery.trim().toLowerCase();
  const row = serpByQuery?.find((r) => r.query.trim().toLowerCase() === q);
  if (!row) return "";
  const lines: string[] = [`Query: ${row.query}`];
  for (const o of row.organicTop ?? []) {
    const parts = [o.title, o.description].filter(Boolean);
    if (parts.length) lines.push(parts.join(" — "));
  }
  for (const title of row.organicTitles ?? []) {
    if (title.trim()) lines.push(title.trim());
  }
  return lines.join("\n").trim();
}

export async function extractIllustrativeExample(input: {
  keyword: string;
  location: string;
  researchAsOf: string;
  companyName: string;
  illustrativeExampleQuery?: string;
  pageUrl?: string;
  entity?: string;
  serpByQuery?: QueryFanoutSerpRow[];
  chatGptByQuery?: Array<{ query: string; responseText: string }>;
  illustrativeH2Title?: string;
  pageTitle?: string;
  pageExcerpt?: string;
  siteId?: string;
  site?: WordPressSite | null;
  pageLocalContext?: PageLocalContext;
  /** Published Answer HTML: scenario must illustrate this topic, not another vertical. */
  answerSectionHtml?: string;
}): Promise<IllustrativeExample> {
  const keyword = input.keyword.trim();
  const companyName = input.companyName.trim();
  const location = input.location.trim();
  if (!keyword || !companyName) {
    throw new Error("Illustrative persona extract requires keyword and company name.");
  }
  const pageCtx =
    input.pageLocalContext
    ?? resolvePageLocalContext({
      keyword,
      site: input.site,
      entity: input.entity,
    });
  const researchLocation = pageCtx.prosePlaceLabel || pageCtx.primaryCity || location;
  const researchTopic = pageCtx.serviceTopic || keyword;
  const query =
    input.illustrativeExampleQuery?.trim() ||
    buildIllustrativeExampleResearchQuery({
      topic: researchTopic,
      location: researchLocation || researchTopic,
      asOfLabel: input.researchAsOf.trim() || formatResearchAsOfLabel(new Date()),
    });
  const serpContext = serpContextForIllustrativeQuery(input.serpByQuery, query);
  const chatGptMatch = input.chatGptByQuery?.find(
    (r) => r.query.trim().toLowerCase() === query.toLowerCase(),
  );
  const chatGptText = chatGptMatch?.responseText?.trim() ?? "";
  const chatGptContext = (input.chatGptByQuery ?? [])
    .map((r) => r.responseText?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("\n\n");
  const researchText = [serpContext, chatGptText || chatGptContext].filter(Boolean).join("\n\n").trim();
  const apiKey = await resolveOpenRouterApiKeyForHarness();
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(input.siteId),
    system: ILLUSTRATIVE_EXTRACT_SYSTEM,
    user: [
      formatPageLocalContextPromptBlock(pageCtx),
      pageCtx.primaryCity ? `Primary service city: ${pageCtx.primaryCity}` : "",
      pageCtx.serviceTopic ? `Service topic (product or brand, never a city): ${pageCtx.serviceTopic}` : "",
      pageCtx.placeEntity ? `Place entity: ${pageCtx.placeEntity}` : "",
      input.pageTitle?.trim() ? `Page title: ${input.pageTitle.trim()}` : "",
      input.pageUrl?.trim() ? `Page URL: ${input.pageUrl.trim()}` : "",
      `Keyword: ${keyword}`,
      location && location !== pageCtx.primaryCity ? `Legacy location hint: ${location}` : "",
      `Connected business (recommendation paragraph MUST open with this name as the subject): ${companyName}`,
      `Research as-of: ${input.researchAsOf.trim()}`,
      input.pageExcerpt?.trim() ? `Page context: ${input.pageExcerpt.trim().slice(0, 1500)}` : "",
      formatAnswerTopicContractForIllustrativeExtract(input.answerSectionHtml),
      researchText ? `\nResearch snippets:\n${researchText.slice(0, 6000)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 900,
    temperature: ILLUSTRATIVE_PERSONA_EXTRACT_TEMPERATURE,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "illustrative_example_extract", strict: true, schema: ILLUSTRATIVE_EXTRACT_SCHEMA },
    },
  });
  const { parsed } = parseJsonWithRepair<unknown>(content);
  const normalized = normalizeIllustrativeExample(parsed, input.researchAsOf, input.illustrativeH2Title);
  if (!normalized) {
    throw new Error("Illustrative persona extract returned invalid JSON shape.");
  }
  validateIllustrativeScenarioGeo(normalized.scenarioQuestion, pageCtx);
  return normalized;
}

export function cityTokenFromLocation(location: string): string {
  return location.trim().split(",")[0]?.trim() ?? "";
}

/** Month + year label for fresh SERP research, e.g. "August 2026". */
export function formatResearchAsOfLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function buildIllustrativeExampleResearchQuery(input: {
  topic: string;
  location: string;
  asOfLabel: string;
}): string {
  const topic = input.topic.trim();
  const location = input.location.trim();
  const asOf = input.asOfLabel.trim();
  return `What is a realistic real-world example of ${topic} in ${location} as of ${asOf}?`;
}

export function buildProgramStatusResearchQuery(input: {
  topic: string;
  location: string;
  asOfLabel: string;
}): string {
  const topic = input.topic.trim();
  const location = input.location.trim();
  const asOf = input.asOfLabel.trim();
  return `Are ${topic} rebates or incentive programs in ${location} still open to new applications as of ${asOf}?`;
}

export function attachLocationToQfoQuery(query: string, location: string): string {
  const q = query.trim();
  const loc = location.trim();
  const city = cityTokenFromLocation(loc);
  if (!city || !q) return q;
  if (q.toLowerCase().includes(city.toLowerCase())) return q;
  return `${q} ${loc}`;
}

export function attachLocationToQfoQueries(queries: string[], location: string): string[] {
  return uniqueTrimmed(queries.map((query) => attachLocationToQfoQuery(query, location)));
}

function requireFanoutLocation(location: string): string {
  return location.trim();
}

function normalizePlannerCompareText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BOILERPLATE_QUERY_SUFFIXES = new Set([
  "financing",
  "rates",
  "rate",
  "process",
  "installation",
  "install",
  "programs",
  "program",
  "cost",
  "costs",
  "price",
  "prices",
  "efficiency",
]);

export function isBoilerplateResearchQuery(
  query: string,
  input: { keyword: string; companyName: string; location: string },
): boolean {
  const q = normalizePlannerCompareText(query);
  const kw = normalizePlannerCompareText(input.keyword);
  const city = normalizePlannerCompareText(cityTokenFromLocation(input.location));
  const company = normalizePlannerCompareText(input.companyName);
  if (!q || !city) return false;

  if (kw && (q === `${kw} ${city}` || q === `${city} ${kw}`)) return true;

  if (kw && q.startsWith(`${kw} ${city} `)) {
    const suffix = q.slice(`${kw} ${city} `.length);
    if (!suffix || BOILERPLATE_QUERY_SUFFIXES.has(suffix)) return true;
  }

  if (company && q.includes(company) && q.includes(city)) {
    const words = q.split(" ");
    if (words.length <= 6 && /financing|rates|official facts/.test(q)) return true;
  }

  return false;
}

export function filterBoilerplateResearchQueries(
  queries: string[],
  input: { keyword: string; companyName: string; location: string },
): string[] {
  return queries.filter((query) => !isBoilerplateResearchQuery(query, input));
}

function buildTopicResearchPlanUser(input: {
  keyword: string;
  title?: string;
  companyName: string;
  location: string;
  researchAsOf: string;
  pageUrl?: string;
  metaDescription?: string;
  swotText?: string;
  pageExcerpt?: string;
  serpPeopleAlsoAsk?: string[];
}): string {
  const lines = [
    `Keyword: ${input.keyword.trim()}`,
    `Title: ${(input.title ?? "").trim() || input.keyword.trim()}`,
    `Company: ${input.companyName.trim()}`,
    `Location: ${input.location}`,
    `Research as of: ${input.researchAsOf}`,
  ];
  if (input.pageUrl?.trim()) lines.push(`Page URL: ${input.pageUrl.trim()}`);
  if (input.metaDescription?.trim()) {
    lines.push(`Meta description: ${input.metaDescription.trim().slice(0, 400)}`);
  }
  if (input.pageExcerpt?.trim()) {
    lines.push(`Page excerpt:\n${input.pageExcerpt.trim().slice(0, 1200)}`);
  }
  if (input.serpPeopleAlsoAsk?.length) {
    lines.push(
      "SERP people-also-ask (intent hints only; do not copy verbatim):",
      ...input.serpPeopleAlsoAsk.slice(0, 8).map((question) => `- ${question.trim()}`),
    );
  }
  if (input.swotText?.trim()) lines.push(`SWOT / research:\n${input.swotText.trim()}`);
  lines.push(
    "",
    "Return 3-5 unique localized buyer questions for web research. Every question must be about THIS Keyword and Title (compare, quality, features, climate fit). Vary intents from the topic only. No template keyword strings. Forbidden: where can I see/get/buy/find samples or a showroom; can {Company} help me. Do not add rebate, incentive, grant, promotion, or sale questions unless Keyword or Title is about those.",
  );
  return lines.filter(Boolean).join("\n");
}

function uniqueTrimmed(values: unknown, max?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (!Array.isArray(values)) return out;
  for (const raw of values) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (max != null && out.length >= max) break;
  }
  return out;
}

function isIllustrativeResearchQuery(query: string): boolean {
  const q = normalizePlannerCompareText(query);
  return (
    (q.includes("realistic") || q.includes("real world") || q.includes("realworld")) &&
    (q.includes("example") || q.includes("typical") || q.includes("homeowner"))
  );
}

export function ensureIllustrativeResearchQuery(
  queries: string[],
  input: { keyword: string; title?: string; location: string; asOfLabel: string },
): { queries: string[]; illustrativeExampleQuery: string } {
  const topic = (input.title ?? input.keyword).trim() || input.keyword.trim();
  const illustrative = attachLocationToQfoQuery(
    buildIllustrativeExampleResearchQuery({
      topic,
      location: input.location,
      asOfLabel: input.asOfLabel,
    }),
    input.location,
  );
  const hasIllustrative = queries.some(isIllustrativeResearchQuery);
  const merged = hasIllustrative ? [...queries] : [illustrative, ...queries];
  const capped = uniqueTrimmed(merged, TOPIC_RESEARCH_FANOUT_MAX_QUERIES);
  const illustrativeExampleQuery =
    capped.find(isIllustrativeResearchQuery) ?? illustrative;
  return { queries: capped, illustrativeExampleQuery };
}

function isProgramStatusResearchQuery(query: string): boolean {
  const q = normalizePlannerCompareText(query);
  return (
    (q.includes("rebate") || q.includes("incentive") || q.includes("program")) &&
    (q.includes("open") || q.includes("closed") || q.includes("still") || q.includes("application"))
  );
}

export function ensureProgramStatusResearchQuery(
  queries: string[],
  input: { keyword: string; title?: string; location: string; asOfLabel: string },
): { queries: string[]; programStatusQuery: string } {
  const topic = (input.title ?? input.keyword).trim() || input.keyword.trim();
  const programStatus = attachLocationToQfoQuery(
    buildProgramStatusResearchQuery({
      topic,
      location: input.location,
      asOfLabel: input.asOfLabel,
    }),
    input.location,
  );
  const hasProgramStatus = queries.some(isProgramStatusResearchQuery);
  let merged: string[];
  if (hasProgramStatus) {
    merged = [...queries];
  } else {
    const insertAt = queries.some(isIllustrativeResearchQuery) ? 1 : 0;
    merged = [...queries.slice(0, insertAt), programStatus, ...queries.slice(insertAt)];
  }
  const capped = uniqueTrimmed(merged, TOPIC_RESEARCH_FANOUT_MAX_QUERIES);
  const programStatusQuery = capped.find(isProgramStatusResearchQuery) ?? programStatus;
  return { queries: capped, programStatusQuery };
}

export type FactualVerificationPlanItem = {
  claimLabel: string;
  verificationQuery: string;
  preferDomains: string[];
};

const FACTUAL_VERIFICATION_PLAN_SYSTEM = `You plan factual verification queries for a connected-site article rewrite. Return every checkable claim the rewrite must verify or drop.

Return JSON only: { "verifications": [ { "claimLabel": string, "verificationQuery": string, "preferDomains": string[] } ] }.

Read Keyword, Title, Location, Research as-of, and Page excerpt (when present). List only checkable claims that appear in Keyword, Title, or the page excerpt. Do not invent rebate, incentive, solar, climate, or program-status checks unless those appear in Keyword, Title, or excerpt.

Each verificationQuery must surface official government, utility, or authoritative spec sources for the connected province when the claim is governmental. Forbidden: installer blogs or generic SEO articles.

If page excerpt contains a specific number or program name, include a verification row for it.

preferDomains: 1-4 domain suffixes to prefer (e.g. alberta.ca, canada.ca).

Return { "verifications": [] } only when no checkable claims apply. Never exceed ${TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES} items. Prioritize page-excerpt figures first.`;

const PAGE_CLAIM_INVENTORY_SYSTEM = `Extract every checkable factual claim from the page excerpt that a rewrite must verify against official sources or omit.

Return JSON only: { "claims": [ { "claimLabel": string, "verificationQuery": string, "preferDomains": string[] } ] }.

Include ALL specific figures and assertions from the excerpt:
- Dollar amounts and CAD install cost bands (e.g. $15,000–$30,000)
- Payback periods in years
- Property-value or resale premium percentages
- kWh/month usage assumptions
- ¢/kWh or $/kWh electricity and export rates
- Rebate, grant, and incentive program names and implied status
- Roofline setback distances (e.g. 1.2 m above roof)
- Municipal permit or compliance requirements

Each verificationQuery must target official government, utility, weather, or spec sources for Location. Forbidden: installer blogs.

If excerpt has no checkable claims, return { "claims": [] }. Never exceed ${TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES} items.`;

const PAGE_CLAIM_INVENTORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claimLabel", "verificationQuery", "preferDomains"],
        properties: {
          claimLabel: { type: "string" },
          verificationQuery: { type: "string" },
          preferDomains: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const FACTUAL_VERIFICATION_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verifications"],
  properties: {
    verifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claimLabel", "verificationQuery", "preferDomains"],
        properties: {
          claimLabel: { type: "string" },
          verificationQuery: { type: "string" },
          preferDomains: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const VERIFIED_FACT_EXTRACT_SYSTEM = `Extract one factual claim from official page text only.

Return JSON: { "status": "confirmed"|"contradicted"|"not_found", "fact": string, "sourceUrl": string, "sourceDomain": string }.

Rules:
- fact must be directly supported by the page text; no inference or extrapolation.
- If the page does not address the claimLabel, status is not_found and fact is "".
- sourceUrl must match the page URL given in the user message.
- contradicted only when the page explicitly conflicts with a stale figure described in the user message.`;

const VERIFIED_FACT_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "fact", "sourceUrl", "sourceDomain"],
  properties: {
    status: { type: "string", enum: ["confirmed", "contradicted", "not_found"] },
    fact: { type: "string" },
    sourceUrl: { type: "string" },
    sourceDomain: { type: "string" },
  },
} as const;

const PROVINCE_OFFICIAL_DOMAINS: Record<string, string[]> = {
  AB: ["alberta.ca", "gov.ab.ca", "efficiencyalberta.ca"],
  BC: ["gov.bc.ca"],
  ON: ["ontario.ca", "gov.on.ca"],
  SK: ["saskatchewan.ca"],
  MB: ["gov.mb.ca"],
  QC: ["quebec.ca", "gouv.qc.ca"],
};

const BASE_OFFICIAL_DOMAIN_SUFFIXES = ["canada.ca", "gc.ca"];

export function officialDomainsForLocation(location: string): string[] {
  const upper = location.trim().toUpperCase();
  const domains = [...BASE_OFFICIAL_DOMAIN_SUFFIXES];
  const provMatch = upper.match(/,\s*(AB|BC|ON|SK|MB|QC|NL|NB|NS|PE|YT|NT|NU)\b/);
  if (provMatch?.[1]) {
    domains.push(...(PROVINCE_OFFICIAL_DOMAINS[provMatch[1]] ?? []));
  }
  return domains;
}

export function isOfficialDomain(domain: string, preferDomains: string[], location: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d) return false;
  const candidates = [
    ...preferDomains.map((x) => x.trim().toLowerCase()).filter(Boolean),
    ...officialDomainsForLocation(location).map((x) => x.toLowerCase()),
  ];
  return candidates.some(
    (suffix) => d === suffix || d.endsWith(`.${suffix}`) || d.endsWith(suffix),
  );
}

export function pickOfficialOrganicResult(
  organicTop: SerpOrganicTopEntry[],
  preferDomains: string[],
  location: string,
): SerpOrganicTopEntry | undefined {
  for (const entry of organicTop) {
    const domain = entry.domain?.trim() ?? "";
    if (domain && isOfficialDomain(domain, preferDomains, location)) return entry;
    const url = entry.url?.trim() ?? "";
    if (url) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (isOfficialDomain(host, preferDomains, location)) return { ...entry, domain: host };
      } catch {
        // skip invalid URL
      }
    }
  }
  return undefined;
}

export function organicTopFromSerpDump(serpDumpJson: Record<string, unknown>): SerpOrganicTopEntry[] {
  const extracted = extractDataForSeoSerpBrief(serpDumpJson);
  return extracted.organic.slice(0, 5).map((o) => ({
    domain: o.domain,
    url: o.url,
    title: o.title,
    description: o.description,
  }));
}

export function serpRowFromDump(query: string, serpDumpJson: Record<string, unknown>): QueryFanoutSerpRow {
  const extracted = extractDataForSeoSerpBrief(serpDumpJson);
  const organicTop = organicTopFromSerpDump(serpDumpJson);
  return {
    query,
    organicTop,
    organicTitles: organicTop.map((o) => o.title).filter((t): t is string => Boolean(t)),
    paa: extracted.peopleAlsoAsk.map((p) => p.question).filter(Boolean),
  };
}

function buildFactualVerificationPlanUser(input: {
  keyword: string;
  title?: string;
  location: string;
  researchAsOf: string;
  pageExcerpt?: string;
  serpPeopleAlsoAsk?: string[];
}): string {
  const lines = [
    `Keyword: ${input.keyword.trim()}`,
    `Title: ${(input.title ?? "").trim() || input.keyword.trim()}`,
    `Location: ${input.location.trim()}`,
    `Research as of: ${input.researchAsOf.trim()}`,
  ];
  if (input.pageExcerpt?.trim()) {
    lines.push(`Page excerpt:\n${input.pageExcerpt.trim().slice(0, 1200)}`);
  }
  if (input.serpPeopleAlsoAsk?.length) {
    lines.push(
      "SERP people-also-ask (intent hints):",
      ...input.serpPeopleAlsoAsk.slice(0, 6).map((q) => `- ${q.trim()}`),
    );
  }
  lines.push("", `Return 0-${TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES} official-source verification queries.`);
  return lines.join("\n");
}

/** Dedupe by claimLabel and cap at TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES. Earlier plans win. */
export function mergeVerificationPlanItems(
  ...plans: FactualVerificationPlanItem[][]
): FactualVerificationPlanItem[] {
  const seen = new Set<string>();
  const out: FactualVerificationPlanItem[] = [];
  for (const plan of plans) {
    for (const item of plan) {
      const key = item.claimLabel.trim().toLowerCase();
      if (!key || !item.verificationQuery.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES) return out;
    }
  }
  return out;
}

export function buildMandatoryVerificationItems(input: {
  keyword: string;
  location: string;
  researchAsOf: string;
  pageExcerpt?: string;
}): FactualVerificationPlanItem[] {
  const keyword = input.keyword.trim();
  const location = input.location.trim();
  const researchAsOf = input.researchAsOf.trim();
  const excerpt = (input.pageExcerpt ?? "").toLowerCase();
  const corpus = `${keyword} ${excerpt}`.toLowerCase();
  const locUpper = location.toUpperCase();
  const isAlberta = locUpper.includes(", AB") || locUpper.includes("ALBERTA");
  const isSolar = /solar|pv|photovoltaic|micro-?generation|microgeneration/.test(corpus);
  const city = cityTokenFromLocation(location);
  const items: FactualVerificationPlanItem[] = [];

  if (
    isSolar ||
    /incentive|rebate|grant|financ|roi|payback|cost|savings|efficiency/.test(corpus)
  ) {
    items.push({
      claimLabel: "Provincial solar rebate and incentive program status",
      verificationQuery: buildProgramStatusResearchQuery({
        topic: keyword || "solar",
        location,
        asOfLabel: researchAsOf,
      }),
      preferDomains: isAlberta
        ? ["alberta.ca", "efficiencyalberta.ca", "canada.ca"]
        : ["canada.ca", "gc.ca"],
    });
  }

  if (isAlberta && isSolar) {
    items.push({
      claimLabel: "Alberta Solar Club micro-generation export rate",
      verificationQuery: `What is the Alberta Solar Club export rate for excess solar electricity as of ${researchAsOf}?`,
      preferDomains: ["aeso.ca", "alberta.ca", "canada.ca"],
    });
  }

  if (/efficiency|rating|tier|spec|panel/.test(corpus)) {
    items.push({
      claimLabel: "Residential solar panel efficiency tier bands",
      verificationQuery: `What are typical residential solar panel efficiency percentage ranges for standard vs high-efficiency modules as of ${researchAsOf}?`,
      preferDomains: ["nrel.gov", "energy.gov", "canada.ca"],
    });
  }

  if (city && (/sunshine|sun hours|sun-hour|2,?300|2300|daylight/.test(excerpt) || isSolar)) {
    items.push({
      claimLabel: `Annual sunshine or sun hours for ${city}`,
      verificationQuery: `How many hours of sunshine does ${city} ${location} receive per year according to official sources?`,
      preferDomains: ["canada.ca", "weather.gc.ca", "gc.ca"],
    });
  }

  if (/17 hours|seventeen hours|daylight hours daily/.test(excerpt)) {
    items.push({
      claimLabel: `Peak summer daylight hours for ${city || location}`,
      verificationQuery: `What is the maximum daylight length in ${city || location} during summer?`,
      preferDomains: ["canada.ca", "weather.gc.ca", "timeanddate.com"],
    });
  }

  if (/edmonton/.test(excerpt) && /grant|rebate|incentive/.test(excerpt)) {
    items.push({
      claimLabel: "Edmonton municipal solar grant or incentive status",
      verificationQuery: `Is the City of Edmonton residential solar rebate or grant program open to new applications as of ${researchAsOf}?`,
      preferDomains: ["edmonton.ca", "alberta.ca", "canada.ca"],
    });
  }

  if (isSolar) {
    items.push({
      claimLabel: "Residential solar install cost band",
      verificationQuery: `What is a typical installed cost range in CAD for residential solar in ${location} as of ${researchAsOf}?`,
      preferDomains: ["canada.ca", "nrcan.gc.ca", "alberta.ca"],
    });
    items.push({
      claimLabel: "Solar payback period horizon",
      verificationQuery: `What payback period do official or utility sources cite for residential solar in ${location} as of ${researchAsOf}?`,
      preferDomains: ["canada.ca", "nrcan.gc.ca", "aeso.ca"],
    });
    items.push({
      claimLabel: "Residential electricity rate",
      verificationQuery: `What is the residential electricity rate in ¢/kWh or $/kWh for ${location} as of ${researchAsOf}?`,
      preferDomains: ["epcor.com", "aeso.ca", "alberta.ca", "canada.ca"],
    });
  }

  if (/resale|property.value|home value|3.?4%|3–4%/.test(excerpt)) {
    items.push({
      claimLabel: "Solar property-value or resale premium",
      verificationQuery: `Does official research support a resale or property-value premium from solar in ${location}?`,
      preferDomains: ["canada.ca", "nrcan.gc.ca", "cmhc.ca"],
    });
  }

  if (/kwh|kwh\/month|800/.test(excerpt)) {
    items.push({
      claimLabel: "Typical household electricity usage kWh/month",
      verificationQuery: `What is typical residential electricity usage in kWh per month for ${location}?`,
      preferDomains: ["canada.ca", "nrcan.gc.ca"],
    });
  }

  if (/roofline|setback|1\.2\s*m|above the roof/.test(excerpt)) {
    items.push({
      claimLabel: "Solar panel roofline setback requirement",
      verificationQuery: `What roofline or fire setback distance applies to rooftop solar in ${location}?`,
      preferDomains: ["edmonton.ca", "alberta.ca", "canada.ca"],
    });
  }

  if (/edmonton/.test(corpus) && /permit|compliance|requirement/.test(excerpt)) {
    items.push({
      claimLabel: "Edmonton solar permit requirements",
      verificationQuery: `What permits does the City of Edmonton require for residential rooftop solar as of ${researchAsOf}?`,
      preferDomains: ["edmonton.ca"],
    });
  }

  return items;
}

export function normalizePageClaimInventory(raw: unknown): FactualVerificationPlanItem[] {
  if (!raw || typeof raw !== "object") return [];
  const claims = (raw as { claims?: unknown }).claims;
  if (!Array.isArray(claims)) return [];
  const out: FactualVerificationPlanItem[] = [];
  for (const item of claims) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const claimLabel = String(rec.claimLabel ?? "").trim();
    const verificationQuery = String(rec.verificationQuery ?? "").trim();
    const preferDomains = uniqueTrimmed(rec.preferDomains) as string[];
    if (!claimLabel || !verificationQuery) continue;
    out.push({ claimLabel, verificationQuery, preferDomains });
    if (out.length >= TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES) break;
  }
  return out;
}

export async function extractCheckableClaimsFromPageExcerpt(input: {
  keyword: string;
  location: string;
  researchAsOf: string;
  pageExcerpt: string;
  siteId?: string;
}): Promise<FactualVerificationPlanItem[]> {
  const excerpt = input.pageExcerpt.trim();
  if (!excerpt) return [];
  try {
    const location = requireFanoutLocation(input.location);
    const apiKey = await resolveOpenRouterApiKeyForHarness();
    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model: getResearchModel(input.siteId),
      system: PAGE_CLAIM_INVENTORY_SYSTEM,
      user: [
        `Keyword: ${input.keyword.trim()}`,
        `Location: ${location}`,
        `Research as of: ${input.researchAsOf.trim()}`,
        "",
        "Page excerpt:",
        excerpt.slice(0, 6000),
      ].join("\n"),
      maxTokens: 1200,
      temperature: 0.1,
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "page_claim_inventory", strict: true, schema: PAGE_CLAIM_INVENTORY_SCHEMA },
      },
    });
    const { parsed } = parseJsonWithRepair<unknown>(content);
    return normalizePageClaimInventory(parsed);
  } catch {
    return [];
  }
}

export function normalizeFactualVerificationPlan(raw: unknown): FactualVerificationPlanItem[] {
  if (!raw || typeof raw !== "object") return [];
  const verifications = (raw as { verifications?: unknown }).verifications;
  if (!Array.isArray(verifications)) return [];
  const out: FactualVerificationPlanItem[] = [];
  for (const item of verifications) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const claimLabel = String(rec.claimLabel ?? "").trim();
    const verificationQuery = String(rec.verificationQuery ?? "").trim();
    const preferDomains = uniqueTrimmed(rec.preferDomains) as string[];
    if (!claimLabel || !verificationQuery) continue;
    out.push({ claimLabel, verificationQuery, preferDomains });
    if (out.length >= TOPIC_RESEARCH_MAX_VERIFICATION_QUERIES) break;
  }
  return out;
}

export async function planFactualVerificationQueries(input: {
  keyword: string;
  title?: string;
  location: string;
  researchAsOf: string;
  pageExcerpt?: string;
  serpPeopleAlsoAsk?: string[];
  siteId?: string;
}): Promise<FactualVerificationPlanItem[]> {
  try {
    const location = requireFanoutLocation(input.location);
    const apiKey = await resolveOpenRouterApiKeyForHarness();
    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model: getResearchModel(input.siteId),
      system: FACTUAL_VERIFICATION_PLAN_SYSTEM,
      user: buildFactualVerificationPlanUser({ ...input, location }),
      maxTokens: 900,
      temperature: 0.2,
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "factual_verification_plan", strict: true, schema: FACTUAL_VERIFICATION_PLAN_SCHEMA },
      },
    });
    const { parsed } = parseJsonWithRepair<unknown>(content);
    return normalizeFactualVerificationPlan(parsed);
  } catch {
    return [];
  }
}

function normalizeExtractedVerifiedFact(
  raw: unknown,
  claimLabel: string,
  asOf: string,
  fallbackUrl: string,
  fallbackDomain: string,
): VerifiedFact {
  const base: VerifiedFact = {
    claimLabel,
    status: "not_found",
    fact: "",
    sourceUrl: fallbackUrl,
    sourceDomain: fallbackDomain,
    asOf,
  };
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  const statusRaw = String(rec.status ?? "").trim();
  const status =
    statusRaw === "confirmed" || statusRaw === "contradicted" || statusRaw === "not_found"
      ? statusRaw
      : "not_found";
  const fact = String(rec.fact ?? "").trim();
  const sourceUrl = String(rec.sourceUrl ?? fallbackUrl).trim() || fallbackUrl;
  let sourceDomain = String(rec.sourceDomain ?? fallbackDomain).trim() || fallbackDomain;
  if (!sourceDomain && sourceUrl) {
    try {
      sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      sourceDomain = fallbackDomain;
    }
  }
  if (status === "not_found" || !fact) {
    return { ...base, status: "not_found", sourceUrl, sourceDomain };
  }
  return { claimLabel, status, fact, sourceUrl, sourceDomain, asOf };
}

async function extractVerifiedFactFromPageText(input: {
  claimLabel: string;
  pageUrl: string;
  pageDomain: string;
  pageText: string;
  researchAsOf: string;
  siteId?: string;
}): Promise<VerifiedFact> {
  const clipped = input.pageText.trim().slice(0, 8000);
  if (!clipped) {
    return {
      claimLabel: input.claimLabel,
      status: "not_found",
      fact: "",
      sourceUrl: input.pageUrl,
      sourceDomain: input.pageDomain,
      asOf: input.researchAsOf,
    };
  }
  const apiKey = await resolveOpenRouterApiKeyForHarness();
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(input.siteId),
    system: VERIFIED_FACT_EXTRACT_SYSTEM,
    user: [
      `claimLabel: ${input.claimLabel}`,
      `sourceUrl: ${input.pageUrl}`,
      `sourceDomain: ${input.pageDomain}`,
      "",
      "Official page text:",
      clipped,
    ].join("\n"),
    maxTokens: 500,
    temperature: 0,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "verified_fact_extract", strict: true, schema: VERIFIED_FACT_EXTRACT_SCHEMA },
    },
  });
  const { parsed } = parseJsonWithRepair<unknown>(content);
  return normalizeExtractedVerifiedFact(
    parsed,
    input.claimLabel,
    input.researchAsOf,
    input.pageUrl,
    input.pageDomain,
  );
}

async function verifyClaimViaOpenRouter(input: {
  item: FactualVerificationPlanItem;
  keyword: string;
  location: string;
  researchAsOf: string;
}): Promise<VerifiedFact> {
  const userPrompt = buildLlmAuditOfficialVerificationPrompt({
    verificationQuery: input.item.verificationQuery,
    claimLabel: input.item.claimLabel,
    focusKeyword: input.keyword,
    location: input.location,
    researchAsOf: input.researchAsOf,
    preferDomains: input.item.preferDomains,
  });
  try {
    const apiKey = await resolveOpenRouterApiKeyForHarness();
    const { content } = await postOpenRouterAppChat({
      apiKey,
      model: getResearchModel(),
      system: "You verify facts from official government web sources only. Follow the user format exactly.",
      user: userPrompt,
      maxTokens: 600,
      temperature: 0,
      signal: AbortSignal.timeout(90_000),
    });
    const text = content.trim();
    const urlMatch = text.match(/https:\/\/[^\s)]+/);
    const sourceUrl = urlMatch?.[0]?.replace(/[.,;]+$/, "") ?? "";
    let sourceDomain = "";
    if (sourceUrl) {
      try {
        sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        sourceDomain = "";
      }
    }
    const statusMatch = text.match(/status:\s*(confirmed|contradicted|not_found)/i);
    const statusRaw = statusMatch?.[1]?.toLowerCase() ?? "not_found";
    const status =
      statusRaw === "confirmed" || statusRaw === "contradicted" ? statusRaw : ("not_found" as const);
    const factMatch = text.match(/fact:\s*(.+?)(?:\n|$)/i);
    const fact = factMatch?.[1]?.trim() ?? "";
    if (status === "not_found" || !fact) {
      return {
        claimLabel: input.item.claimLabel,
        status: "not_found",
        fact: "",
        sourceUrl,
        sourceDomain,
        asOf: input.researchAsOf,
      };
    }
    return {
      claimLabel: input.item.claimLabel,
      status,
      fact,
      sourceUrl,
      sourceDomain,
      asOf: input.researchAsOf,
    };
  } catch {
    return {
      claimLabel: input.item.claimLabel,
      status: "not_found",
      fact: "",
      sourceUrl: "",
      sourceDomain: "",
      asOf: input.researchAsOf,
    };
  }
}

export async function fetchAndExtractVerifiedFact(input: {
  item: FactualVerificationPlanItem;
  organicTop: SerpOrganicTopEntry[];
  location: string;
  researchAsOf: string;
  siteId?: string;
  keyword: string;
}): Promise<VerifiedFact> {
  const official = pickOfficialOrganicResult(
    input.organicTop,
    input.item.preferDomains,
    input.location,
  );
  const pageUrl = official?.url?.trim() ?? "";
  let pageDomain = official?.domain?.trim() ?? "";
  if (!pageDomain && pageUrl) {
    try {
      pageDomain = new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      pageDomain = "";
    }
  }
  if (!pageUrl) {
    return verifyClaimViaOpenRouter({
      item: input.item,
      keyword: input.keyword,
      location: input.location,
      researchAsOf: input.researchAsOf,
    });
  }
  try {
    const pageText = await fetchUrlTextViaApi(pageUrl);
    return await extractVerifiedFactFromPageText({
      claimLabel: input.item.claimLabel,
      pageUrl,
      pageDomain,
      pageText,
      researchAsOf: input.researchAsOf,
      siteId: input.siteId,
    });
  } catch {
    return verifyClaimViaOpenRouter({
      item: input.item,
      keyword: input.keyword,
      location: input.location,
      researchAsOf: input.researchAsOf,
    });
  }
}

/** Economic claim labels eligible for capped secondary web-search verify. */
export function isEconomicVerificationClaim(claimLabel: string): boolean {
  const t = claimLabel.trim().toLowerCase();
  return (
    /cost|payback|rate|kwh|¢|\/kwh|\$\/w|savings|roi|export|usage|install band|electricity/.test(t) &&
    !/rebate|incentive|grant|program status|permit|setback|efficiency tier|sun hour|sunshine|daylight/.test(t)
  );
}

export async function runFactualVerificationPass(input: {
  keyword: string;
  title?: string;
  location: string;
  researchAsOf: string;
  pageExcerpt?: string;
  serpPeopleAlsoAsk?: string[];
  site?: WordPressSite | null;
  siteId?: string;
  onProgress?: (message: string) => void;
}): Promise<{
  factualVerificationQueries: string[];
  verifiedFacts: VerifiedFact[];
  verificationSerpRows: QueryFanoutSerpRow[];
}> {
  const location = requireFanoutLocation(input.location);
  input.onProgress?.("Planning factual verification queries");
  const plannerPlan = await planFactualVerificationQueries({
    keyword: input.keyword,
    title: input.title,
    location,
    researchAsOf: input.researchAsOf,
    pageExcerpt: input.pageExcerpt,
    serpPeopleAlsoAsk: input.serpPeopleAlsoAsk,
    siteId: input.siteId ?? input.site?.id,
  });
  let pagePlan: FactualVerificationPlanItem[] = [];
  if (input.pageExcerpt?.trim()) {
    input.onProgress?.("Inventorying checkable claims from existing page");
    pagePlan = await extractCheckableClaimsFromPageExcerpt({
      keyword: input.keyword,
      location,
      researchAsOf: input.researchAsOf,
      pageExcerpt: input.pageExcerpt,
      siteId: input.siteId ?? input.site?.id,
    });
  }
  const plan = mergeVerificationPlanItems(pagePlan, plannerPlan);
  if (!plan.length) {
    return { factualVerificationQueries: [], verifiedFacts: [], verificationSerpRows: [] };
  }
  const factualVerificationQueries = plan.map((row) =>
    attachLocationToQfoQuery(row.verificationQuery, location),
  );
  const verifyLimit = pLimit(TOPIC_RESEARCH_VERIFICATION_SERP_CONCURRENCY);
  const verifyResults = await Promise.all(
    plan.map((item, planIndex) =>
      verifyLimit(async () => {
        const query = factualVerificationQueries[planIndex]!;
        input.onProgress?.(`Verifying: ${item.claimLabel.slice(0, 48)}`);
        let organicTop: SerpOrganicTopEntry[] = [];
        let serpRow: QueryFanoutSerpRow;
        try {
          const { serpDumpJson } = await fetchSerpOrganicForQuery({
            keyword: query,
            location,
            site: input.site,
          });
          serpRow = serpRowFromDump(query, serpDumpJson);
          organicTop = serpRow.organicTop;
        } catch {
          serpRow = { query, organicTop: [], paa: [], organicTitles: [] };
        }
        const fact = await fetchAndExtractVerifiedFact({
          item,
          organicTop,
          location,
          researchAsOf: input.researchAsOf,
          siteId: input.siteId ?? input.site?.id,
          keyword: input.keyword,
        });
        return { planIndex, serpRow, fact };
      }),
    ),
  );
  verifyResults.sort((a, b) => a.planIndex - b.planIndex);
  const verifiedFacts: VerifiedFact[] = verifyResults.map((row) => row.fact);
  const verificationSerpRows: QueryFanoutSerpRow[] = verifyResults.map((row) => row.serpRow);

  let secondaryCount = 0;
  for (let i = 0; i < verifiedFacts.length; i++) {
    if (secondaryCount >= TOPIC_RESEARCH_SECONDARY_VERIFY_MAX) break;
    const fact = verifiedFacts[i]!;
    if (fact.status !== "not_found") continue;
    if (!isEconomicVerificationClaim(fact.claimLabel)) continue;
    const item = plan[i];
    if (!item) continue;
    input.onProgress?.(`Secondary verify: ${item.claimLabel.slice(0, 40)}`);
    const retry = await verifyClaimViaOpenRouter({
      item,
      keyword: input.keyword,
      location,
      researchAsOf: input.researchAsOf,
    });
    if (retry.status !== "not_found" && retry.fact.trim()) {
      verifiedFacts[i] = retry;
    }
    secondaryCount += 1;
  }

  return { factualVerificationQueries, verifiedFacts, verificationSerpRows };
}

export function normalizeTopicResearchPlan(raw: unknown): TopicResearchPlan {
  if (!raw || typeof raw !== "object") {
    throw new Error("Topic planner returned invalid JSON");
  }
  const rec = raw as Record<string, unknown>;
  const researchQueries = uniqueTrimmed(rec.researchQueries, TOPIC_RESEARCH_FANOUT_MAX_QUERIES);
  if (researchQueries.length === 0) {
    throw new Error("Topic planner returned no research queries");
  }
  return {
    researchQueries,
    namedPrograms: uniqueTrimmed(rec.namedPrograms),
  };
}

export function normalizeFirstPartyClaims(raw: unknown): FirstPartyClaim[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("First-party claim extractor returned invalid JSON");
  }
  const claimsRaw = (raw as { claims?: unknown }).claims;
  if (!Array.isArray(claimsRaw)) {
    throw new Error("First-party claim extractor returned no claims array");
  }
  const out: FirstPartyClaim[] = [];
  for (const item of claimsRaw) {
    if (!item || typeof item !== "object") continue;
    const text = String((item as { text?: unknown }).text ?? "").trim();
    const source = String((item as { source?: unknown }).source ?? "").trim();
    if (!text || !source) continue;
    out.push({ text, source });
  }
  return out;
}

export function collectFirstPartyClaimSourceText(input: {
  chatGptTexts: string[];
  swotText?: string;
  companyContext?: string;
  siteUrl?: string;
  location?: string;
}): string {
  const parts: string[] = [];
  const siteUrl = input.siteUrl?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  if (siteUrl || location) {
    parts.push(`CONNECTED_SITE:\nurl: ${siteUrl}\nlocation: ${location}`);
  }
  for (const t of input.chatGptTexts) {
    if (t.trim()) parts.push(`CHATGPT:\n${t.trim()}`);
  }
  if (input.swotText?.trim()) parts.push(`SWOT:\n${input.swotText.trim()}`);
  if (input.companyContext?.trim()) parts.push(`GBP_MASTER:\n${input.companyContext.trim()}`);
  return parts.join("\n\n").trim();
}

export async function planTopicResearchQueries(input: {
  keyword: string;
  title?: string;
  companyName: string;
  location?: string;
  siteId?: string;
  pageUrl?: string;
  metaDescription?: string;
  swotText?: string;
  pageExcerpt?: string;
  serpPeopleAlsoAsk?: string[];
}): Promise<TopicResearchPlan> {
  const location = requireFanoutLocation(input.location ?? "");
  const researchAsOf = formatResearchAsOfLabel(new Date());
  const plannerModel = getResearchModel(input.siteId);
  const apiKey = await resolveOpenRouterApiKeyForHarness();
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: plannerModel,
    system: TOPIC_RESEARCH_PLAN_SYSTEM,
    user: buildTopicResearchPlanUser({ ...input, location, researchAsOf }),
    maxTokens: 800,
    temperature: TOPIC_RESEARCH_PLAN_TEMPERATURE,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "topic_research_plan", strict: true, schema: PLAN_SCHEMA },
    },
  });
  const { parsed } = parseJsonWithRepair<unknown>(content);
  const plan = normalizeTopicResearchPlan(parsed);
  const localizedQueries = attachLocationToQfoQueries(plan.researchQueries, location);
  const researchQueries = filterBoilerplateResearchQueries(localizedQueries, {
    keyword: input.keyword,
    companyName: input.companyName,
    location,
  });
  if (researchQueries.length < TOPIC_RESEARCH_FANOUT_MIN_QUERIES) {
    throw new Error("Topic planner returned fewer than 3 topic research queries");
  }
  return {
    ...plan,
    researchQueries,
    researchAsOf,
    illustrativeExampleQuery: researchQueries[0],
    plannerModel,
    plannedAt: new Date().toISOString(),
  };
}

export async function extractFirstPartyClaims(input: {
  chatGptTexts: string[];
  swotText?: string;
  companyContext?: string;
  siteUrl?: string;
  location?: string;
}): Promise<FirstPartyClaim[]> {
  const sourceText = collectFirstPartyClaimSourceText(input);
  if (!sourceText) return [];
  const apiKey = await resolveOpenRouterApiKeyForHarness();
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(),
    system: CLAIMS_SYSTEM,
    user: sourceText,
    maxTokens: 1200,
    temperature: 0,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "first_party_claims", strict: true, schema: CLAIMS_SCHEMA },
    },
  });
  const { parsed } = parseJsonWithRepair<unknown>(content);
  return normalizeFirstPartyClaims(parsed);
}

export function mergeFanoutIntoBrief(
  brief: SeoContentBriefV1,
  fanout: QueryFanout,
  claims: FirstPartyClaim[],
): SeoContentBriefV1 {
  const paaSeen = new Set(brief.dataforseo.peopleAlsoAsk.map((p) => p.question.toLowerCase()));
  const relatedSeen = new Set(brief.dataforseo.relatedSearches.map((s) => s.toLowerCase()));
  const peopleAlsoAsk = [...brief.dataforseo.peopleAlsoAsk];
  const relatedSearches = [...brief.dataforseo.relatedSearches];
  for (const row of fanout.serpByQuery ?? []) {
    for (const q of row.paa) {
      const t = q.trim();
      if (!t || paaSeen.has(t.toLowerCase())) continue;
      paaSeen.add(t.toLowerCase());
      peopleAlsoAsk.push({ question: t, answers: [] });
    }
    const titleSources =
      row.organicTop?.map((o) => o.title).filter((t): t is string => Boolean(t)) ??
      row.organicTitles ??
      [];
    for (const title of titleSources) {
      const t = title.trim();
      if (!t || relatedSeen.has(t.toLowerCase())) continue;
      relatedSeen.add(t.toLowerCase());
      relatedSearches.push(t);
    }
  }
  return {
    ...brief,
    dataforseo: { ...brief.dataforseo, peopleAlsoAsk, relatedSearches },
    queryFanout: fanout,
    firstPartyClaims: claims,
  };
}

function companyContextFromSite(site?: WordPressSite | null): string {
  if (!site) return "";
  const nap = site.napInfo;
  return [site.name, site.siteUrl, nap?.name, nap?.address, nap?.phone].filter(Boolean).join(" | ");
}

export async function runTopicResearchFanout(input: {
  brief: SeoContentBriefV1;
  keyword: string;
  title?: string;
  companyName: string;
  location?: string;
  site?: WordPressSite | null;
  swotText?: string;
  pageExcerpt?: string;
  onProgress?: (message: string) => void;
  /** When true, ignore stored queryFanout and re-plan topic research + illustrative extract. */
  forceRefresh?: boolean;
}): Promise<SeoContentBriefV1> {
  const location = requireFanoutLocation(
    input.location ?? resolveSiteLocationLabel(input.site, input.keyword),
  );
  const siteUrl = input.site?.siteUrl?.trim() ?? "";
  let fanout = input.forceRefresh ? undefined : input.brief.queryFanout;
  if (!fanout?.queries?.length) {
    input.onProgress?.("Planning topic questions");
    const plan = await planTopicResearchQueries({
      keyword: input.keyword,
      title: input.title,
      companyName: input.companyName,
      location,
      siteId: input.site?.id,
      pageUrl: input.brief.pageUrl,
      swotText: input.swotText,
      pageExcerpt: input.pageExcerpt,
    });
    input.onProgress?.("Fan-out SERP");
    const serpByQuery = await Promise.all(
      plan.researchQueries.map(async (query) => {
        try {
          const { serpDumpJson } = await fetchSerpOrganicForQuery({
            keyword: query,
            location,
            site: input.site,
          });
          return serpRowFromDump(query, serpDumpJson);
        } catch {
          return { query, organicTop: [], organicTitles: [], paa: [] };
        }
      }),
    );
    input.onProgress?.("ChatGPT company facts");
    const authorityTopics = [
      ...plan.namedPrograms.map((program) => ({
        query: attachLocationToQfoQuery(program, location),
        topic: input.keyword,
        namedProgram: program,
      })),
      {
        query: attachLocationToQfoQuery(`${input.companyName} official facts`, location),
        topic: input.keyword,
        namedProgram: undefined as string | undefined,
      },
    ];
    const seenAuthority = new Set<string>();
    const uniqueAuthority = authorityTopics.filter((row) => {
      const key = row.query.toLowerCase();
      if (seenAuthority.has(key)) return false;
      seenAuthority.add(key);
      return true;
    });
    const chatGptByQuery = await Promise.all(
      uniqueAuthority.map(async ({ query, topic, namedProgram }) => {
        const result = await fetchChatGptCompanyAuthority({
          companyName: input.companyName,
          location,
          topic,
          namedProgram,
          siteUrl,
        });
        return { query, responseText: result.responseText ?? "" };
      }),
    );
    fanout = {
      queries: plan.researchQueries,
      namedPrograms: plan.namedPrograms,
      plannerModel: plan.plannerModel,
      plannedAt: plan.plannedAt,
      researchAsOf: plan.researchAsOf,
      illustrativeExampleQuery: plan.illustrativeExampleQuery,
      programStatusQuery: plan.programStatusQuery,
      serpByQuery,
      chatGptByQuery,
    };
    if (plan.illustrativeExampleQuery?.trim()) {
      input.onProgress?.("Illustrative example extract");
      const illustrativeExample = await extractIllustrativeExample({
        keyword: input.keyword,
        location,
        researchAsOf: plan.researchAsOf ?? formatResearchAsOfLabel(new Date()),
        illustrativeExampleQuery: plan.illustrativeExampleQuery,
        companyName: input.companyName,
        serpByQuery,
        chatGptByQuery,
        pageTitle: input.title,
        pageExcerpt: input.pageExcerpt,
        siteId: input.site?.id,
        site: input.site,
      });
      fanout = { ...fanout, illustrativeExample };
    }
  }

  const researchAsOf =
    fanout.researchAsOf ?? formatResearchAsOfLabel(new Date());
  if (!fanout.verifiedFacts && cityTokenFromLocation(location)) {
    input.onProgress?.("Factual verification");
    const verification = await runFactualVerificationPass({
      keyword: input.keyword,
      title: input.title,
      location,
      researchAsOf,
      pageExcerpt: input.pageExcerpt,
      site: input.site,
      siteId: input.site?.id,
      onProgress: input.onProgress,
    });
    if (verification.factualVerificationQueries.length) {
      fanout = {
        ...fanout,
        researchAsOf,
        factualVerificationQueries: verification.factualVerificationQueries,
        verifiedFacts: verification.verifiedFacts,
        serpByQuery: [...(fanout.serpByQuery ?? []), ...verification.verificationSerpRows],
      };
    }
  }

  const addedVerifiedFacts =
    Boolean(fanout.verifiedFacts?.length) &&
    !Boolean(input.brief.queryFanout?.verifiedFacts?.length);
  const needsMerge =
    fanout !== input.brief.queryFanout || !input.brief.firstPartyClaims || addedVerifiedFacts;
  if (!needsMerge) {
    return input.brief;
  }

  const claims = await extractFirstPartyClaims({
    chatGptTexts: (fanout.chatGptByQuery ?? []).map((r) => r.responseText),
    swotText: input.swotText,
    companyContext: companyContextFromSite(input.site),
    siteUrl,
    location,
  });
  return mergeFanoutIntoBrief(input.brief, fanout, claims);
}

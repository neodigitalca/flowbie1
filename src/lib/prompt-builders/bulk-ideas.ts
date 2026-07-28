import type { KeywordAIAnalysis } from "../keyword-types";
import type { PromptBulkSitemapInventoryBuckets } from "../bulk/prompt-bulk-sitemap-inventory";
import { GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK } from "../content-topic-blocklist";
import { CRITICAL_LINK_RULE, NO_FAKE_TESTIMONIALS_RULE } from "./core";
import { TITLE_ANTI_CLICKBAIT_RULE, TITLE_KEYWORD_WEAVING_RULE, TITLE_CASE_RULE, TITLE_WELL_KNOWN_ACRONYMS_RULE } from "./system-user";

/** Prompt-mode bulk ideation: informational blogs vs local geo entity (service-area) rows. */
export type BulkBlogIdeasContentKind = "content_blog" | "service_area_sap";

/** CSV Modifier column for local geo / entity URL rows: leave blank (no prompt-modifier token). */
export const BULK_SERVICE_AREA_GAP_CSV_MODIFIER = "";

/** Featured image: Google Maps based, not AI (`bulk-auto-generate-template.csv`). */
export const BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE = "google-maps";

function buildBulkIdeasTodayDateBlock(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  const long = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const year = now.getFullYear();
  const month = now.toLocaleDateString("en-US", { month: "long" });
  return `
=== TODAY (canonical "now" for this entire checklist run) ===
Today's date: ${long} (${iso})
Calendar year: ${year}
Current month: ${month}

This is the only reference date for this run. Apply it to **every** output field: Title, Keyword, MetaDescription, Modifier, and Rationale — plus any rules, angles, or factual framing in your reasoning.

Date-aware rules (all checklist output):
- Treat today as ${long}. "Current", "today", "this year", "now", "latest", "upcoming", and "new for [year]" must match this date — not your training cutoff.
- Forward-looking topics: use ${year} or ${year + 1}. Do not use ${year - 1} or earlier unless the topic is explicitly historical.
- MetaDescription and Rationale: no stale years, expired deadlines, or outdated "just announced" / "new for last year" framing.
- Keywords stay short-tail; do not embed outdated years in Keyword unless the query intent requires a specific historical year.
- Seasonal or time-sensitive angles must fit the season/month of today's date when relevant.
- Do not invent calendar dates inside checklist fields; when a year is needed, derive it from today's date above.
=== END TODAY ===`;
}

// --- Shared rule blocks ---

const TITLE_RULES =
  `Each Title: under 60 characters; no pipe (|), no ' | ', no suffix like '| Site Name'. One short phrase. Each title must use a different format; do not copy keyword as title. Never append Guide, Types, or Options to the keyword then repeat the keyword after a colon. ${TITLE_CASE_RULE} ${TITLE_KEYWORD_WEAVING_RULE} ${TITLE_ANTI_CLICKBAIT_RULE} ${TITLE_WELL_KNOWN_ACRONYMS_RULE}`;

/** Content-blog checklist titles: keyword front-loaded, one flowing phrase — not "Topic: subtitle". */
const BULK_CONTENT_BLOG_TITLE_COLON_BAN = `**Title — keyword first, natural join (non-negotiable for content blogs)**:
- **Keyword first**: primary keyword words open the title (first readable phrase), woven in Title Case — not pasted as a label before a colon.
- **One flowing headline**: continue with natural glue — "and", "for", "vs", "without", "how to", "what", "why", "when", or end with "?". Write a single phrase readers scan left to right.
- **Zero colons**: the character ":" is **forbidden** in every checklist Title. No exceptions. Not for cost guides, overviews, maintenance, efficiency, calculators, or degradation topics.
- **Forbidden patterns**: "Solar Panel Costs: What To Expect For Your Home", "Solar Installation Cost: A Comprehensive Overview", "Solar Energy Efficiency: Maximizing Your Output", "Solar System Maintenance: Keeping It Running Smoothly", "Paint Finish Types Explained: Matte Vs. Glossy", "Cabinet Painting Cost: What to Expect".
- **Good patterns**: "Solar Panel Costs And What To Expect For Your Home", "Solar Installation Cost Overview For Homeowners", "Solar Energy Efficiency Tips For Maximum Output", "Solar System Maintenance And Longevity Basics", "Matte Vs Glossy Paint Finish Types Explained", "How To Choose Interior Paint Sheen", "Is Paint Primer Use Always Necessary?"`;

const TITLE_FORMAT_VARIETY =
  "Formats (rotate across rows; keyword at the start, woven — never keyword-as-label then colon): Comparison 'Matte Vs Glossy [Topic] Compared'; How-to 'How To [Action] [Topic] Without [Problem]'; Numbered '7 [Topic] Strategies For Homeowners'; Question 'Is [Topic] Right For Your Home?'; Guide 'Complete Guide To [Topic] For Beginners'; Problem-solution 'Why [Solution] Matters For [Audience]'. Keyword once, front-loaded; **zero colons** in every title.";

const MODIFIER_ALL = (n: number, modifier: string) =>
  `Apply modifier "${modifier}" to all ${n} ideas. Every title must clearly reflect it; no generic titles.`;

const SOURCE_PRIORITY =
  "Venn / set difference: (A) Ideas MUST come only from the KNOWLEDGE BASE section below - your RAG JSON and other KB files (topics, gaps, expansion). (B) The SITE_INVENTORY_POSTS_JSON, SITE_INVENTORY_PAGES_JSON, and SITE_INVENTORY_SAP_JSON blocks in the user message are NOT sources for ideas; they are the WordPress source of truth across all three sitemaps - existing coverage only. Subtract B from A: propose ideas that do not overlap any bucket (no competing intent with any published title, keyword, or URL path). Never treat inventory as inspiration.";

const INVENTORY_CANNIBALIZATION = `CANNIBALIZATION / EXCLUSION ONLY (mandatory when sitemap inventory blocks are present):
**Read every bucket first:** Each inventory block is a **plain newline-separated keyword list** (one keyword per line, no JSON, no quotes, no commas). Use it as an exclusion list of topics already on the site.
Your new ideas must fall outside the union of all three buckets — no intersection in search intent with any existing keyword.
- Do not duplicate or lightly rephrase any keyword string in the list.
- Do not target the same topic or intent as any listed keyword.
Empty strings are skipped.`;

const WITHIN_CHECKLIST_EXCLUSIVITY = (n: number) =>
  `**Mutual exclusivity (all ${n} new ideas + all inventory rows):**
- Every Keyword in your checklist must be unique (case-insensitive, normalize spacing).
- Every Title must be unique and use a distinct search angle — no two rows may target the same comparison axis, cost guide, or how-to premise.
- Each new idea must be mutually exclusive with every other new idea AND with every URL in POSTS, PAGES, and SAP inventories.
- Before output: verify no keyword/title/intent overlap within the checklist and no cannibalization against any inventory row.`;

/** Informational content blogs - not local service-area pages; AI featured images; reviews not case studies. */
const BULK_CONTENT_BLOG_EDITORIAL_RULES = `Content-blog posture (this checklist path):
- **No service-area / geo landing posts:** Do not put city, region, province, state, or "in [Place]" patterns in titles unless the user explicitly set a title template that includes **[Location]**. Prefer national/educational angles.
- **Keyword field - short-tail, no near-me spam:** Prefer **2–3 words**, topic + intent only (product/service type, comparison, cost, best, types, vs). Strip city, neighborhood, and "near me" proximity language from commercial keywords. **Exception - government / policy / incentives / grants / rebates / regulations / tax credits:** keep jurisdiction already present in the selected keyword (country and federal/provincial/state as written). Do not strip those. Do not invent near-me city spam.
- **Entity column:** If Entity is a **company/brand name**, use it for context only - do **not** treat it as a geographic place (avoid "[topic] near [Entity]" when Entity is a brand).
- **FeaturedImage:** Use **"y"** only (AI-generated featured image at publish). Never **"google-maps"** or **"n"** in checklist output for this flow.
- **Proof points:** Modifiers may suggest **reviews, testimonials, star ratings, third-party credibility**. Do **not** prescribe **case studies**, ROI case studies, or formal customer case studies as the content format.`;

/** Local geo / entity sitemap checklist path (not national blogs). */
const BULK_SERVICE_AREA_GEO_EDITORIAL_RULES = `Local geo landing posture (entity sitemap program):
- **Each idea is one geo-targeted service area page** for the WordPress entity sitemap program, not a national informational blog article.
- **Entity column:** must name the **place the page serves** (neighbourhood, city, county, or hyperlocal area). Use real geography from the knowledge base or typical service territory for this business; never invent fake towns.
- **Keyword:** **2–4 words** combining **commercial or service intent with location** for that row (e.g. core service + city, or service + neighbourhood). Geography belongs here because these are local landings.
- **Title:** follow **GEO title rules** in the system prompt (weave Keyword + Entity with **in / near / for / serving / around** and similar; high variety; not a sheet of bare "[Place] [Keyword]" only).
- **MetaDescription:** local SEO with place plus primary service; no double-quote characters inside the value.
- **Modifier:** leave **empty** for every row (entity landing URLs). On each checklist line use **Modifier: ""** (empty quotes). Do not output guide, comparison, geo-landing, or any other modifier text.
- **FeaturedImage:** use exactly **${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE}** for every row (Google Maps based featured image, not AI-generated). Never use **y** or **n** for these rows.`;

const GEO_LANDING_KEYWORD_INTENT_RULES = `Keyword field (local geo landings): **2–4 words** combining service or product intent with **geography** (city, neighbourhood, or county that row targets). No full sentences or questions in Keyword. Entity names the place; Keyword reinforces what is offered in that market.`;

/** Title patterns for geo rows: natural weave of Keyword + Entity; avoid repetitive "City Product" stacks. */
const GEO_LANDING_TITLE_AI_RULES = `Title (local geo landings — varied, AI-quality local SEO):
- **Weave Keyword and Entity** into one natural phrase. Rotate patterns across rows, for example: "[Keyword] in [Entity]", "[Keyword] near [Entity]", "[Keyword] for [Entity]", "[Keyword] serving [Entity]", "Professional [Keyword] in [Entity]", "[Keyword] across [Entity]", "[Keyword] around [Entity]". Use **different connectors and openers** on each line so the checklist does not sound templated.
- **Avoid as the dominant pattern:** bare "[Place] [Keyword]" or "[Keyword] [Place]" with **no** connector (e.g. a sheet full of "Edmonton Blinds" style only). At most one row may use that ultra-short stack if others use richer patterns.
- ${TITLE_KEYWORD_WEAVING_RULE}
- Entity may appear as written (e.g. city + province) or shortened **only** if still clear and under 60 characters.
- If **Purpose** mentions quarter editorial counts, post shortage, entity shortage, or scheduling, keep titles **confident and timely for filling that gap** without inventing fake calendar dates inside Title unless the user explicitly requested dated titles.
- Optional CSV column **publish_date_gmt** may be filled later for staggering publishes; each Title must read well on its own for any slot in the quarter.`;

/** Hard bans for all bulk blog ideas (service businesses: no DIY repair guides; no entrepreneurship content). */
const GLOBAL_TOPIC_EXCLUSIONS = `Global topic rules (always apply to every idea):
- No repair-guide or DIY fix-it posts: do not propose step-by-step "how to repair / fix / mend" tutorials or repair guides. You may still position the business as offering professional repair or service in other article types (e.g. service pages, trust, when to call a pro) - but do not make the core premise of any idea a repair how-to guide.
- No entrepreneurship or "start a business" content: do not propose ideas about starting a business, launching a startup, side hustles, business plans, registering a company, or similar.
- Never output copyright lines, "©", "Copyright" + year, "All rights reserved", or invented brand/site names (e.g. fake businesses like "MyGlamping"). Use only the connected site name when TARGET SITE is provided.
${NO_FAKE_TESTIMONIALS_RULE}
${GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK}`;

function buildGeneralIntentBlock(flowPurpose: string, n: number): string {
  if (!flowPurpose?.trim()) return "";
  return `
=== CONTENT TOPIC / GENERAL INTENT (MANDATORY - EVERY SINGLE IDEA) ===
General intent: "${flowPurpose.trim()}"

**EVERY idea - Idea #1 through Idea #${n} - MUST be strictly about this topic.** Every keyword and every title must fit "${flowPurpose.trim()}".

**CRITICAL:** Do NOT lift topics from the site inventory. Inventory = cannibalization only. Each idea must align with the content topic; fill gaps the inventory does not cover.
=== END CONTENT TOPIC ===`;
}

const CONTENT_VARIETY =
  "At least 2 content types (e.g. versus, how-to, guide). Prioritize versus/comparison posts when the topic allows. Mix types across ideas.";

function buildContentVarietyInstruction(hasSiteInventory: boolean): string {
  if (hasSiteInventory) {
    return "At least 2 content types (e.g. versus, how-to, guide). Mix types across ideas. When sitemap inventory blocks are present: do **not** prioritize versus/comparison posts if any bucket already contains the same comparison intent or search angle—pick formats and angles that clearly do not overlap any existing url/title/keyword.";
  }
  return CONTENT_VARIETY;
}

const META_DESCRIPTION_RULES =
  "MetaDescription: 150–160 chars, SEO-focused, include primary keyword, compelling call-to-action or value prop. No quotation marks inside; no testimonial-style lines, fake patient/customer quotes, star ratings, or invented attributions (e.g. “Name, Local Resident”).";

/** Primary keyword in each row: drives intent for generation - keep extremely tight. */
const KEYWORD_INTENT_RULES =
  "Keyword field (critical for intent): **short-tail** - prefer **2 or 3 words**. Strip near-me / city / neighborhood proximity spam from commercial keywords. Distill full questions into complete noun/intent phrases; never output broken partial questions. Good: \"solar panels cost\", \"solar panel installation cost\", \"roman shades cost\", \"blinds vs shades\", \"motorized blinds\". Bad: \"how much do solar panels\", \"how much do solar energy\", \"cost of solar panels edmonton\", \"installers near me\". **Exception - government / policy / incentives / grants / rebates / regulations / tax credits:** keep jurisdiction already present (country and federal/provincial/state as written; 3–5 words ok). Good: \"federal solar incentives canada\". Bad: \"solar incentives\" (missing jurisdiction).";

const OUTPUT_FORMAT_LINE = (
  n: number,
  entityMode: string,
  featuredImage: boolean,
  withRationale: boolean,
  contentKind: BulkBlogIdeasContentKind = "content_blog",
) =>
  contentKind === "service_area_sap"
    ? `Numbered checklist (${n} items). Each: Keyword: "[2–4 words: service + geography]", Entity: "[place name]", Title: "[natural local title: keyword + entity via in/near/for/etc.; varied each row]", MetaDescription: "[150–160 char SEO meta, no double quotes inside]", Modifier: "" (empty), FeaturedImage: "${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE}"${withRationale ? ', Rationale: "[optional angle]"' : ""}`
    : `Numbered checklist (${n} items). Each: Keyword: "[2–3 word short-tail intent keyword]", Entity: "[entity]"${entityMode === "blank" ? " (or omit)" : ""}, Title: "[title]", MetaDescription: "[150–160 char SEO meta]", Modifier: "[modifier]", FeaturedImage: "${featuredImage ? "y" : "n"}"${withRationale ? ', Rationale: "[why this matches modifier]"' : ""}`;

/** Non-negotiable output shape for `parseBlogIdeasChecklist` (must match parser regex). */
const MACHINE_CHECKLIST_PARSE_RULES = `MACHINE CHECKLIST FORMAT (required — app parses this with strict line rules):
- Plain text only: do not wrap the checklist in markdown code fences.
- One idea per line. Each line must begin with N. or N) then a single space (e.g. \`1. \` or \`1) \`) at column 0 — no leading spaces, no \`-\`, no \`*\`, no \`**\` around the number.
- Use straight ASCII double quotes only around every field value: Keyword: "...", Title: "...", MetaDescription: "...", etc. No curly/smart quotes.
- MetaDescription must not contain a double-quote character inside the value (rephrase if needed).
- Every line must include labeled Keyword: "…" and Title: "…" exactly in that form.`;

function buildTargetSiteBlock(connectedSite: { name: string; siteUrl: string }): string {
  return `
=== TARGET SITE ===
Site: ${connectedSite.name} (${connectedSite.siteUrl})
Use for topics, tone, context - not as entity. All ideas relevant to ${connectedSite.name}.
**Keyword / Title — never own trading name (fuzzy)**: Do NOT use the company trading name from "${connectedSite.name}" as Keyword (fuzzy / word-reorder: e.g. "Blind Magic" ↔ "Magic Blinds"). Blocked topics (Bali Blinds) stay out. Product/service phrases and dealer product lines (Hunter Douglas, Alta, etc.) are fine.
=== END TARGET SITE ===`;
}

function buildKbBlock(
  activeKnowledgeBaseText: string,
  connectedSite?: { name: string; siteUrl: string }
): string {
  const siteLine = connectedSite ? ` Align with ${connectedSite.name}.` : "";
  return `
=== KNOWLEDGE BASE (PRIMARY SOURCE - RAG FOR NEW IDEAS ONLY) ===
${activeKnowledgeBaseText}
Use ONLY this block for ideation: topics, services, products, themes, and any JSON/strategy files you uploaded here. Extract keywords and gaps; ideas = natural extensions.${siteLine}
Do not use SITE_INVENTORY_POSTS_JSON, SITE_INVENTORY_PAGES_JSON, or SITE_INVENTORY_SAP_JSON (in the user message) as topic sources - they are exclude-only.
=== END KNOWLEDGE BASE ===`;
}

function hasSitemapInventory(
  siteInventoryBuckets?: PromptBulkSitemapInventoryBuckets,
  siteInventoryJson?: string,
): boolean {
  if (siteInventoryJson?.trim()) return true;
  if (!siteInventoryBuckets) return false;
  return countNonemptySitemapBuckets(siteInventoryBuckets) > 0;
}

export function countNonemptySitemapBuckets(buckets: PromptBulkSitemapInventoryBuckets): number {
  return [buckets.posts, buckets.pages, buckets.sap].filter((b) => b.json.trim()).length;
}

export function appendSiteInventoryBucketsToUserPrompt(
  out: string,
  buckets: PromptBulkSitemapInventoryBuckets,
): string {
  const sections: Array<{ key: string; label: string; json: string; rowCount: number }> = [
    { key: "POSTS", label: "Posts sitemap (blog posts)", ...buckets.posts },
    { key: "PAGES", label: "Pages sitemap (pages + page-bucket CPTs)", ...buckets.pages },
    { key: "SAP", label: "SAP / entity sitemap (service-area landings)", ...buckets.sap },
  ];

  let result = out;

  for (const section of sections) {
    if (!section.json.trim()) continue;
    result +=
      `\n=== SITE_INVENTORY_${section.key}_JSON (${section.label}; ${section.rowCount} URLs) ===\n` +
      section.json.trim() +
      `\n=== END SITE_INVENTORY_${section.key}_JSON ===\n`;
  }
  return result;
}

export function buildSiteInventorySystemBlock(bucketCount: number): string {
  return `
=== SITE INVENTORY (see user message - EXCLUSION LIST, NOT RAG) ===
The user message contains ${bucketCount} JSON block(s) marked SITE_INVENTORY_POSTS_JSON, SITE_INVENTORY_PAGES_JSON, and/or SITE_INVENTORY_SAP_JSON. Together they list every published post, page, and entity/service-area URL on the site.
${INVENTORY_CANNIBALIZATION}
=== END SITE INVENTORY INSTRUCTIONS ===`;
}

export function buildGscKeywordsBlock(gscExactKeywords: string[], n: number, flowPurpose?: string): string {
  const list = gscExactKeywords.map((kw, i) => `${i + 1}. "${kw}"`).join("\n");
  const intentOverride = flowPurpose?.trim()
    ? `\n**When content topic "${flowPurpose.trim()}" is set: use each GSC keyword ONLY if it fits this topic; if not, generate a topic-fitting keyword and idea for that slot.**\n`
    : "";
  return `
=== GSC KEYWORDS ===
${list}
${intentOverride}
Use in order when they fit the content topic. These may be selected low-hanging opportunities from site GSC and Semrush keyword JSON. ${n} ideas.
For the Keyword column: use each selected phrase as written only when it is already a clean short-tail commercial keyword. Distill longer commercial/question phrases into **complete 2–3 word intent keywords** and drop near-me / city / neighborhood proximity language. Examples: "how much do solar panels cost in alberta" -> "solar panels cost"; "how much does it cost to install solar panels" -> "solar panel installation cost". Never output broken fragments like "how much do solar panels" or "how much do solar energy". **Exception - government / policy / incentives / grants / rebates / regulations / tax credits:** keep jurisdiction (country and federal/provincial/state) already present in the selected keyword - do not strip it. The article body can still address the full query.
=== END GSC KEYWORDS ===`;
}

function buildSiteKwJsonStepBlock(siteKwJsonText: string, selectedKeywords: string[] | undefined): string {
  const selected = selectedKeywords?.length
    ? selectedKeywords.map((kw, i) => `${i + 1}. "${kw}"`).join("\n")
    : "(none selected)";
  return (
    `STEP 0 - READ SITE_KW_JSON (mandatory before ideas):\n` +
    `This JSON contains scraped Semrush and GSC keyword lists for the target site. Metrics were used to sort them locally, then removed to save tokens. Prioritize Semrush first, then GSC. Read it before generating ideas.\n` +
    `Each idea's Keyword should use SELECTED_LOW_HANGING_KEYWORDS in order, but the displayed Keyword must be the cleaned short-tail form. Distill question/long-tail entries into complete noun/intent keywords, not broken fragments. Only invent a new short-tail keyword when the selected list runs out.\n` +
    `Preserve selected government / policy / incentives / grants / rebates / regulations / tax credit keywords with jurisdiction. For normal commercial keywords, clean long-tail/question wording before using it.\n` +
    `Invented keywords: informational or transactional intent only; 2-3 words for commercial keywords (no near-me / city proximity spam); government/policy inventions must include jurisdiction inferred from the connected site context already reflected in SITE_KW_JSON selection - never invent an unrelated market; no cannibalization with other ideas or the site inventory.\n\n` +
    `=== SELECTED_LOW_HANGING_KEYWORDS ===\n${selected}\n=== END SELECTED_LOW_HANGING_KEYWORDS ===\n\n` +
    `=== SITE_KW_JSON ===\n${siteKwJsonText.trim()}\n=== END SITE_KW_JSON ===\n\n`
  );
}

function buildKeywordAnalysisBlock(
  keywordAnalysisResults: Map<string, KeywordAIAnalysis>,
  n: number
): string {
  const entries = Array.from(keywordAnalysisResults.entries()).slice(0, n);
  const lines = entries.map(([keyword, a], i) => {
    const v = a.keywordSuggestions?.variations?.slice(0, 5) || [];
    const lt = a.keywordSuggestions?.longTail?.slice(0, 3) || [];
    const sem = a.keywordSuggestions?.semantic?.slice(0, 3) || [];
    const h2s = a.h2Suggestions?.slice(0, 5) || [];
    const gaps = a.contentGaps?.slice(0, 3) || [];
    return `${i + 1}. "${keyword}"\n   Variations: ${v.length ? v.map((x) => `"${x}"`).join(", ") : "None"}\n   Long-tail: ${lt.length ? lt.map((x) => `"${x}"`).join(", ") : "None"}\n   Semantic: ${sem.length ? sem.map((x) => `"${x}"`).join(", ") : "None"}${h2s.length ? `\n   H2 ideas: ${h2s.map((h) => h.heading).join(", ")}` : ""}${gaps.length ? `\n   Gaps: ${gaps.map((g) => g.topic).join(", ")}` : ""}`;
  }).join("\n\n");
  return `
=== KEYWORD AI ANALYSIS ===
${lines}
Use for: variations, structure (H2), content gaps. When picking a primary keyword for each idea, prefer 2–3 word short-tail intent phrases derived from this analysis.
=== END KEYWORD AI ANALYSIS ===`;
}

function buildTitleInstruction(_titleTemplate: string, n: number, contentKind: BulkBlogIdeasContentKind): string {
  const base = `${TITLE_RULES} ${TITLE_FORMAT_VARIETY} All ${n} titles under 60 chars, no pipe, different formats.`;
  return contentKind === "content_blog" ? `${base}\n${BULK_CONTENT_BLOG_TITLE_COLON_BAN}` : base;
}

function buildExampleFormat(
  n: number,
  titleTemplate: string,
  entityMode: string,
  keywordMode: string,
  keywordValue: string,
  optionalPrompt: string,
  featuredImage: boolean,
  contentKind: BulkBlogIdeasContentKind,
): string {
  if (contentKind === "service_area_sap") {
    return `Example (local geo landing rows — vary title patterns; do not copy these verbatim):\n1. Keyword: "residential solar denver", Entity: "Denver CO", Title: "Residential Solar in Denver CO", MetaDescription: "Trusted residential solar in Denver. Compare options, incentives, and what to expect before you install. Request a consultation today.", Modifier: "", FeaturedImage: "${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE}"\n2. Keyword: "custom blinds calgary", Entity: "Calgary AB", Title: "Custom Blinds Near Calgary", MetaDescription: "Explore custom blinds near Calgary: styles, light control, and expert fitting for Alberta homes. Book a consultation.", Modifier: "", FeaturedImage: "${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE}"\n3. ... (Modifier must be empty on every line; FeaturedImage must be ${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE} on every line; each new row a different title structure)`;
  }
  const entityVal = entityMode === "manual" ? "ScraperAPI" : entityMode === "blank" ? "" : "ScraperAPI";
  const kwVal = keywordMode === "same" ? keywordValue : "web scraping api";
  const fill = (kw: string, ent: string, num: string) =>
    titleTemplate
      .replace("[Keyword]", kw)
      .replace("[Entity]", ent)
      .replace("[Location]", "")
      .replace("[Number]", num)
      .trim();
  if (titleTemplate) {
    const e = entityMode === "blank" ? "" : entityVal;
    return `Example:\n1. Keyword: "python web scraping", Entity: "${e}", Title: "${fill("python web scraping", e, "1")}", MetaDescription: "Learn Python web scraping step-by-step. Compare libraries, avoid pitfalls, and build scrapers that work. Start here.", Modifier: "${optionalPrompt || "beginner-friendly"}", FeaturedImage: "${featuredImage ? "y" : "n"}"${optionalPrompt ? ', Rationale: "..."' : ""}\n2. ... (same pattern; Keyword always 2–3 words)`;
  }
  return `Example:\n1. Keyword: "${kwVal}", Entity: "${entityVal}", Title: "Web Scraping Vs API Which Should You Choose?", MetaDescription: "Web scraping vs API: pros, cons, and when to use each. Make the right integration choice for your project.", Modifier: "${optionalPrompt || "versus"}", FeaturedImage: "${featuredImage ? "y" : "n"}"${optionalPrompt ? ', Rationale: "..."' : ""}\n2. Keyword: "api integration", Entity: "...", Title: "...", MetaDescription: "...", ...\n3. ...`;
}

function buildSlotKeywordsBlock(slotKeywords: string[]): string {
  if (!slotKeywords.length) return "";
  const lines = slotKeywords.map((kw, i) => {
    const trimmed = kw.trim();
    const row = i + 1;
    return trimmed
      ? `Row ${row}: use exactly "${trimmed}" as Keyword (preserve as written if it is a government/policy keyword with jurisdiction; otherwise 2–3 words if already short; distill if longer; strip near-me / city proximity spam only).`
      : `Row ${row}: no user keyword — pick one unique 2–3 word short-tail intent keyword (no near-me / city spam; government/policy inventions must include jurisdiction).`;
  });
  return `\n=== USER KEYWORD SLOTS (${slotKeywords.length} rows) ===\n${lines.join("\n")}\n=== END USER KEYWORD SLOTS ===\n`;
}

function buildSlotModifiersBlock(slotModifiers: string[]): string {
  if (!slotModifiers.length || !slotModifiers.some((m) => m.trim())) return "";
  const lines = slotModifiers.map((mod, i) => {
    const trimmed = mod.trim();
    const row = i + 1;
    return trimmed
      ? `Row ${row}: apply this modifier to title, angle, and checklist Modifier field: "${trimmed}".`
      : `Row ${row}: no per-row modifier.`;
  });
  return `\n=== USER MODIFICATION SLOTS (${slotModifiers.length} rows) ===\n${lines.join("\n")}\n=== END USER MODIFICATION SLOTS ===\n`;
}

/**
 * Builds a system prompt for generating blog ideas from user prompts
 */
export const buildBulkBlogIdeasSystemPrompt = (
  flowPurpose: string,
  activeKnowledgeBaseText: string,
  numberOfBlogs: number,
  entityMode: "auto" | "manual" | "blank" = "auto",
  entityValue: string = "",
  keywordMode: "same" | "per-blog" | "gsc-keywords" = "per-blog",
  keywordValue: string = "",
  optionalPrompt: string = "",
  titleTemplate: string = "",
  featuredImagePerBlog: boolean = true,
  connectedSite?: { name: string; siteUrl: string },
  siteInventoryJson?: string,
  gscExactKeywords?: string[],
  keywordAnalysisResults?: Map<string, KeywordAIAnalysis>,
  contentKind: BulkBlogIdeasContentKind = "content_blog",
  siteInventoryBuckets?: PromptBulkSitemapInventoryBuckets,
  slotKeywords?: string[],
  slotModifiers?: string[],
): string => {
  const n = numberOfBlogs;
  const isSap = contentKind === "service_area_sap";
  const hasSlotKeywords = Boolean(slotKeywords?.length);
  const hasSlotModifiers = Boolean(slotModifiers?.some((m) => m.trim()));
  const hasSiteInventory = hasSitemapInventory(siteInventoryBuckets, siteInventoryJson);
  const inventoryBucketCount = siteInventoryBuckets
    ? [siteInventoryBuckets.posts, siteInventoryBuckets.pages, siteInventoryBuckets.sap].filter((b) =>
        b.json.trim(),
      ).length
    : siteInventoryJson?.trim()
      ? 1
      : 0;
  const entityLabel =
    entityMode === "auto"
      ? isSap
        ? "Auto: named service area (place) per row"
        : "Auto-extract from KB"
      : entityMode === "manual"
        ? `Manual: "${entityValue}"`
        : "Blank (no entity)";
  const keywordLabel = hasSlotKeywords
    ? "Per blog (user slots + AI fill empty)"
    : keywordMode === "gsc-keywords"
      ? "GSC (use exactly)"
      : keywordMode === "same"
        ? `Same: "${keywordValue}"`
        : isSap
          ? "Per row (unique local intent each)"
          : "Per blog (different each)";

  const generalIntentBlock = buildGeneralIntentBlock(flowPurpose, n);
  const modifierBlock = optionalPrompt
    ? `\n**PROMPT MODIFIER (ALL ${n} IDEAS)**: "${optionalPrompt}"\n${MODIFIER_ALL(n, optionalPrompt)}\n`
    : "";

  const targetSiteBlock = connectedSite ? buildTargetSiteBlock(connectedSite) : "";
  const kbBlock =
    activeKnowledgeBaseText ? buildKbBlock(activeKnowledgeBaseText, connectedSite) : "";
  const inventoryInstructions =
    hasSiteInventory && inventoryBucketCount > 0
      ? buildSiteInventorySystemBlock(inventoryBucketCount)
      : "";

  const gscBlock =
    keywordMode === "gsc-keywords" && gscExactKeywords?.length
      ? buildGscKeywordsBlock(gscExactKeywords, n, flowPurpose)
      : "";
  const analysisBlock =
    keywordAnalysisResults?.size ? buildKeywordAnalysisBlock(keywordAnalysisResults, n) : "";

  const slotKeywordsBlock = hasSlotKeywords ? buildSlotKeywordsBlock(slotKeywords!) : "";
  const slotModifiersBlock = hasSlotModifiers ? buildSlotModifiersBlock(slotModifiers!) : "";

  const keywordReq = hasSlotKeywords
    ? "Follow USER KEYWORD SLOTS: use the exact Keyword where the user provided one; for blogs with no user keyword, pick one unique 2–3 word short-tail intent keyword (different each), no near-me / city spam; government/policy inventions must include jurisdiction."
    : isSap
      ? "One unique row per local geo landing: follow " + GEO_LANDING_KEYWORD_INTENT_RULES + " Distinct geography per row when possible."
      : keywordMode === "gsc-keywords" && gscExactKeywords?.length
        ? flowPurpose?.trim()
          ? "Use GSC/selected phrases in order ONLY when they fit the content topic; otherwise use a topic-fitting 2–3 word keyword for that idea. Prefer selected keywords as written. Strip near-me / city proximity spam from commercial keywords. Preserve jurisdiction on government/policy/incentives/grants keywords."
          : "Align posts with GSC/selected phrases in order; use Keyword as written when already short-tail. Strip near-me / city proximity spam from commercial keywords. Preserve jurisdiction on government/policy/incentives/grants keywords."
        : keywordMode === "same"
          ? `Use one short-tail intent keyword for all (from "${keywordValue}" if already short; if longer, distill; strip near-me / city spam only; keep jurisdiction if it is a government/policy keyword).`
          : "One unique 2–3 word short-tail intent keyword per blog (different each), no near-me / city spam; government/policy inventions must include jurisdiction.";
  const entityReq =
    entityMode === "auto"
      ? isSap
        ? "Each row: Entity = the target place name (city, neighbourhood, or county) for that landing."
        : "Extract from KB or context."
      : entityMode === "manual"
        ? `Use "${entityValue}".`
        : "Leave blank.";
  const entityTitleRule =
    entityMode !== "blank"
      ? titleTemplate?.trim()
        ? " For title templates with [Entity]/[Location]: Title must be readable with NO repeated words (never two \"near\" or duplicate city). If the keyword already says \"near\" or \"near me\", use [Keyword] in [entity] or [Keyword] - [entity]; do not insert another \"near\". If the keyword has no \"near\", you may use [keyword] near [entity] when [Entity] is a place. Keyword = service/product ONLY. Never [entity] [keyword]."
        : isSap
          ? ""
          : " **Default content blogs:** Entity is usually the **brand/business name** - do NOT use \"near [Entity]\" or \"in [Entity]\" as if Entity were a city. Do NOT add city, region, province, or state names to titles unless the title template includes [Location]."
      : "";
  const titleReq =
    titleTemplate?.trim()
      ? buildTitleInstruction(titleTemplate, n, contentKind) + entityTitleRule
      : isSap
        ? `${TITLE_RULES} ${GEO_LANDING_TITLE_AI_RULES} All ${n} titles under 60 chars, no pipe; each row a distinct pattern from the rules above.`
        : buildTitleInstruction("", n, contentKind) + entityTitleRule;
  const exampleBlock = buildExampleFormat(
    n,
    "",
    entityMode,
    keywordMode,
    keywordValue,
    optionalPrompt,
    featuredImagePerBlog,
    contentKind,
  );

  const parts = [
    isSap
      ? "You are Flowbie, an expert local SEO strategist. Generate a structured checklist of **local geo service area landing page** ideas for the entity sitemap program, from user prompts."
      : "You are Flowbie, an expert AI content strategist. Generate a structured checklist of blog post ideas from user prompts.",
    buildBulkIdeasTodayDateBlock(),
    "\nFlow:",
    `Purpose: ${flowPurpose || "Not specified"}`,
    generalIntentBlock,
    modifierBlock,
    slotKeywordsBlock,
    slotModifiersBlock,
    targetSiteBlock,
    kbBlock,
    inventoryInstructions,
    "\nSettings:",
    `${isSap ? "Local geo landing pages to generate" : "Blogs to generate"}: ${n}`,
    `Entity: ${entityLabel}`,
    `Keyword: ${keywordLabel}`,
    isSap
      ? "Featured image: Google Maps based for every row (not AI)."
      : `Featured image: ${featuredImagePerBlog ? "Yes" : "No"}`,
    optionalPrompt ? `Instructions: "${optionalPrompt}"` : "",
    gscBlock,
    analysisBlock,
    `\nOutput: All ${n} ideas in one response. Numbered checklist only.`,
    flowPurpose?.trim()
      ? `\n**EACH OF THE ${n} IDEAS**: keyword and title MUST be about "${flowPurpose.trim()}".\n`
      : "",
    `\n${isSap ? GEO_LANDING_KEYWORD_INTENT_RULES : KEYWORD_INTENT_RULES}\n`,
    "\nEach idea:",
    flowPurpose?.trim()
      ? `- Topic: MUST be about "${flowPurpose.trim()}".`
      : "",
    `- Keyword: ${keywordReq}`,
    `- Entity: ${entityReq}`,
    `- Title: ${titleReq}.`,
    `- MetaDescription: ${META_DESCRIPTION_RULES}`,
    `- Modifier: ${isSap ? `empty for every row (entity URLs): Modifier: "" only` : optionalPrompt ? `Apply "${optionalPrompt}"` : "Optional context/tone"}`,
    `- FeaturedImage: ${isSap ? `exactly "${BULK_SERVICE_AREA_GAP_CSV_FEATURED_IMAGE}" (every row, Google Maps image not AI)` : featuredImagePerBlog ? '"y"' : '"n"'}`,
    `- Date / timeliness: every field above must follow the TODAY block — current info only, no stale years or outdated framing.`,
    optionalPrompt ? '- Rationale: One sentence why this idea matches the modifier.' : "",
    "\nRequirements:",
    isSap ? BULK_SERVICE_AREA_GEO_EDITORIAL_RULES : BULK_CONTENT_BLOG_EDITORIAL_RULES,
    GLOBAL_TOPIC_EXCLUSIONS,
    flowPurpose?.trim()
      ? `- MANDATORY FOR ALL ${n} IDEAS: keyword and title strictly within "${flowPurpose.trim()}". Do not copy inventory titles/keywords verbatim.`
      : "",
    `- Exactly ${n} ideas; each unique.`,
    `- ${WITHIN_CHECKLIST_EXCLUSIVITY(n)}`,
    `- ${TITLE_RULES}`,
    !isSap ? `- ${BULK_CONTENT_BLOG_TITLE_COLON_BAN}` : "",
    `- ${buildContentVarietyInstruction(hasSiteInventory)}`,
    connectedSite ? `- Relevant to ${connectedSite.name}.` : "",
    optionalPrompt ? `- ${MODIFIER_ALL(n, optionalPrompt)}` : "",
    connectedSite
      ? `\n**LINKS / URLs IN THIS CHECKLIST (NON-NEGOTIABLE)**:\n${CRITICAL_LINK_RULE}\nIf you mention any URL in checklist text, it MUST be under the connected site origin (${connectedSite.siteUrl}) or omitted - never example.com or placeholder domains.\n`
      : "",
    SOURCE_PRIORITY,
    "\nFormat:",
    MACHINE_CHECKLIST_PARSE_RULES,
    OUTPUT_FORMAT_LINE(n, entityMode, featuredImagePerBlog, !!optionalPrompt, contentKind),
    "\n" + exampleBlock,
  ];

  return parts.filter(Boolean).join("\n");
};

/**
 * Builds a user prompt for generating blog ideas from natural language input
 */
export const buildBulkBlogIdeasUserPrompt = (
  userPrompt: string,
  numberOfBlogs: number,
  optionalPrompt: string = "",
  siteInventoryJson?: string,
  gscExactKeywords?: string[],
  flowPurpose?: string,
  contentKind: BulkBlogIdeasContentKind = "content_blog",
  siteInventoryBuckets?: PromptBulkSitemapInventoryBuckets,
  siteKwJsonText?: string,
): string => {
  const n = numberOfBlogs;
  const isSap = contentKind === "service_area_sap";
  const hasInv = hasSitemapInventory(siteInventoryBuckets, siteInventoryJson);
  const generalIntentBlock = flowPurpose?.trim()
    ? `CONTENT TOPIC (MANDATORY FOR EVERY IDEA): All ${n} ideas must be about "${flowPurpose.trim()}". Do not copy titles or keywords from the site inventory; use it only to avoid cannibalization.\n\n`
    : "";
  const modifierBlock = optionalPrompt
    ? `PROMPT MODIFIER (apply to all ${n} ideas): "${optionalPrompt}"\nEvery title must reflect this; no generic titles.\n\n`
    : "";

  const editorialLead = isSap
    ? `${BULK_SERVICE_AREA_GEO_EDITORIAL_RULES}\n\n`
    : `${BULK_CONTENT_BLOG_EDITORIAL_RULES}\n\n`;
  const generateLead = isSap
    ? `Generate exactly ${n} local geo service area landing page ideas:\n\n${userPrompt}`
    : `Generate exactly ${n} blog post ideas:\n\n${userPrompt}`;

  const parts = [
    buildBulkIdeasTodayDateBlock(),
    generalIntentBlock,
    modifierBlock,
    editorialLead,
    generateLead,
    optionalPrompt
      ? `\nApply modifier "${optionalPrompt}" to all ${n} ideas. Include Rationale for each item.`
      : "",
    flowPurpose?.trim()
      ? `\nCRITICAL: All ${n} ideas must be about "${flowPurpose.trim()}".`
      : "\nSource priority: Knowledge base = primary (topics, gaps). Site inventory JSON = cannibalization only.",
    `\n${GLOBAL_TOPIC_EXCLUSIONS}\n`,
    `\n${isSap ? GEO_LANDING_KEYWORD_INTENT_RULES : KEYWORD_INTENT_RULES}\n`,
    `\n${TITLE_RULES}`,
    !isSap ? `\n${BULK_CONTENT_BLOG_TITLE_COLON_BAN}` : "",
    `\n${buildContentVarietyInstruction(hasInv)}`,
    `\n${WITHIN_CHECKLIST_EXCLUSIVITY(n)}`,
  ];

  if (gscExactKeywords && gscExactKeywords.length > 0) {
    parts.push(
      flowPurpose?.trim()
        ? "\nUse GSC keywords from the system prompt in order ONLY when each fits the content topic."
        : "\nUse GSC keywords from the system prompt in order.",
    );
  }

  parts.push(
    `\nOutput: Checklist of exactly ${n} ideas per system format (machine checklist lines: N. then Keyword/Title with straight quotes, no fences, no indent). Maximum title variety; different format per title. Every Title: keyword first, natural word join, zero colons.`,
  );

  let out = "";
  if (siteKwJsonText?.trim()) {
    out += buildSiteKwJsonStepBlock(siteKwJsonText, gscExactKeywords);
  }
  if (hasInv && siteInventoryBuckets) {
    out +=
      `STEP 1 — READ SITE INVENTORY (mandatory before any ideas):\n` +
      `The JSON blocks below are every existing URL on the site: published posts, scheduled posts, pages, and entity landings.\n` +
      `Do not copy, paraphrase, or target the same search intent as any title or URL in that inventory.\n` +
      `Your ${n} ideas must be gaps only — zero cannibalization.\n`;
    out = appendSiteInventoryBucketsToUserPrompt(out, siteInventoryBuckets);
    out += `\nSTEP 2 — GENERATE ${n} NEW IDEAS (only after reading inventory above):\n\n`;
  } else if (siteInventoryJson?.trim()) {
    out +=
      `STEP 1 — READ SITE INVENTORY (mandatory):\n` +
      `Do not copy or paraphrase any existing title or keyword in the JSON below.\n\n` +
      `=== SITE_INVENTORY_JSON ===\n${siteInventoryJson.trim()}\n=== END SITE_INVENTORY_JSON ===\n\n` +
      `STEP 2 — GENERATE ${n} NEW IDEAS:\n\n`;
  }

  out += parts.join("");
  return out;
};

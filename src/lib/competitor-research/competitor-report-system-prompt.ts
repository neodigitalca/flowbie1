import {
  COMPETITOR_BULK_CSV_BLOGS_PER_MONTH,
  COMPETITOR_BULK_CSV_MONTHS,
  COMPETITOR_BULK_CSV_TOTAL_POSTS,
} from "@/lib/competitor-research/competitor-bulk-content-csv";
import {
  DEFAULT_COMPETITOR_PLAN_MONTHS,
  clampPlanMonths,
  planMonthsLowerFragment,
} from "@/lib/research/plan-months";

export type CompetitorReportDataSource = "semrush" | "dfs";

/** Whether wire `gq` came from Search Console or synthetic seed ranked-keyword demand. */
export type GqDemandSource = "gsc" | "dfs_seed";

/** One strategist OpenRouter call per H2 block (three calls total: 1–2 parallel, then 3). */
export type CompetitorReportSectionIndex = 1 | 2 | 3;

/** Options shared by competitor strategist prompts (standalone tab vs Proposal). */
export type CompetitorReportPromptOptions = {
  dataSource?: CompetitorReportDataSource;
  gqDemandSource?: GqDemandSource;
  /** Narrative plan horizon (default 3). Proposal passes the same value as the local blueprint. */
  planMonths?: number;
};

function resolveCompetitorPlanMonths(options?: CompetitorReportPromptOptions): number {
  return clampPlanMonths(options?.planMonths, DEFAULT_COMPETITOR_PLAN_MONTHS);
}

/** Client-facing Markdown: **bold** only for important keywords (light touch); no quotes; no [text](url) in prose. */
const COMPETITOR_KEYWORD_STYLE_RULE =
  "KEYWORD STYLE: Emphasize keywords and queries with **bold** only - never with quotation marks. " +
    "QUOTE BAN (non-negotiable): Do not place ASCII \" or ' before or after a keyword, including inside a bold span. " +
    "Invalid: any bold span that contains U+0022 or U+0027 next to the words. Valid: **plain words** as the only emphasis wrapper - no quote characters inside or touching the bold span. " +
    "Use **bold** sparingly - like internal-link anchor emphasis: only important keywords, entities, services, and primary query phrases. " +
    "Do not bold every metric, number, or clause; most prose stays plain. " +
    "Do not use Markdown links [label](url) in narrative; if a URL is needed, write plain hostname or URL. " +
    "Pipe tables: mostly plain cells; at most one **bold** keyword phrase per matrix cell when it helps. " +
    "DECODER: JSON/legend may name internal fields (dfs, sr, sk) - for your wiring only; in client-facing narrative never name third-party SEO data vendors or tools.";

/**
 * Report writer instructions: prompts are mostly plain ASCII to save tokens; the model still outputs Markdown,
 * including **bold** for scanability in section 1 (executive summary + Key insights bullets).
 */

function compactUserInstructions(
  _enrichmentKwPerDomain: number,
  options?: CompetitorReportPromptOptions,
): string {
  const pm = resolveCompetitorPlanMonths(options);
  const appendTables =
    options?.dataSource === "dfs"
      ? "Do not write competitor organic keyword tables; app appends keyword tables after your output."
      : "Do not write competitor organic keyword tables; app appends research keyword tables after your output.";
  return [
    "Out: Markdown, exactly 3 sections only: The Foundational Pillars (## h2; exec-summary paras; KEYWORD STYLE for **bold**; ### Key insights + 4 bullets **Label:** punchy line each), Pain Points (## Pain Points; bullet pain points; ### Buyer personas with exactly 5 short gender-neutral role-based personas; ### Alignment summary 2–4 sentences), Traffic & Intent Gaps (### Content Opportunity Matrix: exactly",
    String(COMPETITOR_BULK_CSV_TOTAL_POSTS),
    "data rows; 5 cols keyword|entity|title|modifier|featuredImage matching bulk content CSV; row order =",
    String(COMPETITOR_BULK_CSV_BLOGS_PER_MONTH),
    "posts month 1 then",
    String(COMPETITOR_BULK_CSV_BLOGS_PER_MONTH),
    "month 2 then",
    String(COMPETITOR_BULK_CSV_BLOGS_PER_MONTH),
    "month 3; no Month column).",
    appendTables,
    `Matrix: no P1. No pillar/hub/landing in title. No Content to Ship. No RD counts. ${planMonthsLowerFragment(pm)}. No geo blogs. No invented URLs.`,
    "Matrix keyword: net-new intents vs existing coverage (gq plus sk); short geography-free targeting phrase; prefer commercial or high-intent informational phrasing in the style of ekr; nine rows must vary topic; do not paste exact gq strings. featuredImage cell must be exactly y or n or google-maps (lowercase).",
  ].join(" ");
}

function getDataSourceFragments(options?: { dataSource?: CompetitorReportDataSource; gqDemandSource?: GqDemandSource }) {
  const src = options?.dataSource === "dfs" ? "dfs" : "semrush";
  const clusterLabel =
    src === "dfs"
      ? "sk and ekr rows are semantic cluster labels with aggregated organic-keyword metrics (Σ Vol, Σ Traffic, best Position per cluster) from the dfs research pipeline"
      : "sk and ekr rows are semantic cluster labels with aggregated organic-keyword metrics (Σ Vol, Σ Traffic, best Position per cluster) from the legacy research pipeline";
  const skList =
    src === "dfs"
      ? "sk lists seed semantic clusters (aggregated organic-keyword metrics per cluster from the dfs pipeline)"
      : "sk lists seed semantic clusters (aggregated organic-keyword metrics per cluster from the legacy pipeline)";
  const sscScv =
    src === "dfs"
      ? "ssc and scv: seed and competitor organic-keyword CSV blobs (dfs pipeline); rows may be joined by ASCII RS (0x1E) instead of newlines."
      : "ssc and scv: seed and competitor organic-keyword CSV blobs (legacy pipeline); rows may be joined by ASCII RS (0x1E) instead of newlines.";
  const tpPool =
    src === "dfs"
      ? "tp: sTr/sVol cluster pools from sk+ekr; avgCompOTr mean competitor monthly organic traffic from sr; seedOTr and gapTr vs peers; rM/rS/rD suggested incremental monthly visit ranges (Moderate/Significant/Drastic); Pt, N; use dfs-shaped metrics in wire."
      : "tp: sTr/sVol cluster pools from sk+ekr; avgCompOTr mean competitor monthly organic traffic from sr; seedOTr and gapTr vs peers; rM/rS/rD suggested incremental monthly visit ranges (Moderate/Significant/Drastic); Pt, N.";
  const appendKw =
    src === "dfs"
      ? "The app appends per-competitor organic keyword tables after your Markdown (research pipeline data)."
      : "The app appends per-competitor organic keyword tables after your Markdown (legacy pipeline).";
  const sec3Semrush =
    src === "dfs"
      ? "Anchor incremental visit ranges primarily on tp: avgCompOTr (mean of competitor sr OTr), seedOTr, gapTr, and when present tp.rM/tp.rS/tp.rD for Moderate/Significant/Drastic - keep Moderate lowest and Drastic highest; you may tighten wording but do not invert tier order. sTr/sVol are directional cluster-keyword pools from sk+ekr (dfs pipeline); Pt planned posts; read N."
      : "Anchor incremental visit ranges primarily on tp: avgCompOTr (mean of competitor sr OTr), seedOTr, gapTr, and when present tp.rM/tp.rS/tp.rD for Moderate/Significant/Drastic - keep Moderate lowest and Drastic highest; you may tighten wording but do not invert tier order. sTr/sVol are directional cluster pools from sk+ekr (legacy pipeline); Pt planned posts; read N.";
  const forbidden =
    src === "dfs"
      ? "Forbidden headings: The Snapshot, Four Moves That Win, Content to Ship, vendor tool scope, 12-month roadmap, module inventory, Keywords They Own, competitor keyword tables. (Section 1 must use ### Key insights as the only H3 inside that section; do not add a duplicate Key insights elsewhere.)"
      : "Forbidden headings: The Snapshot, Four Moves That Win, Content to Ship, vendor tool scope, 12-month roadmap, module inventory, Keywords They Own, competitor keyword tables. (Section 1 must use ### Key insights as the only H3 inside that section; do not add a duplicate Key insights elsewhere.)";
  return { src, clusterLabel, skList, sscScv, tpPool, appendKw, sec3Semrush, forbidden };
}

/**
 * Shared system text for strategist Markdown: ROLE, INPUT, legend, scope - used for each section call.
 */
export function getCompetitorReportSharedSystemPrompt(options?: CompetitorReportPromptOptions): string {
  const pm = resolveCompetitorPlanMonths(options);
  const gqSrc = options?.gqDemandSource ?? "gsc";
  const { clusterLabel, skList, sscScv, tpPool, appendKw } = getDataSourceFragments(options);
  const gqScopeResolved =
    gqSrc === "dfs_seed"
      ? `gq lists ranked-keyword demand proxies for the seed (metrics shaped like Search Console fields) over gdr; not Google Search Console. ${skList}. If gq non-empty, acknowledge organic demand from the seed keyword set. If gq empty, note limited seed keyword coverage and still avoid duplicating sk intents in the matrix.`
      : `gq lists GSC queries the seed site already gets traffic for over gdr; ${skList}. If gq non-empty, acknowledge GSC. If gq empty, note GSC unavailable and still avoid duplicating sk intents in the matrix.`;
  return [
    `ROLE: SEO strategist. OUTPUT: Markdown for executives. Prose: plain English, short paragraphs. Never paste raw JSON keys in narrative; use plain words (overlap count, organic traffic, etc.).`,
    `QUOTE BAN: In every section (especially ### Buyer personas), never wrap emphasized keywords in quotation marks. Write **term** never **"term"** and never "term" for a query - quotes around keywords are a hard failure.`,
    `INPUT: User message is L: (legend) + one compact JSON object + I: (inline instructions). Decode JSON using legend; tuple cols from kc,src,ekc,gc,tcc. dm lists competitor domains; ekr col0 indexes dm. ${clusterLabel}; skM and ekM parallel arrays list exact member phrases per row when present. ${tpPool} ${sscScv}`,
    `SCOPE: ${planMonthsLowerFragment(pm)} plan only. Data only from JSON (sr,sm,so,dm,ekr,gq,tp,ssc,scv,ta,dg). Only sr domains for competitors. Cite CK from sr. ${gqScopeResolved} If dg.skc=0, say no seed SK rows.`,
    `COMPETITOR KEYWORDS: Do not write any ## or ### section for per-competitor organic keyword tables. Do not invent keyword phrases or metrics. ${appendKw}`,
    COMPETITOR_KEYWORD_STYLE_RULE,
    "PIPE TABLES: Separator rows use three hyphens per cell (e.g. | --- | :--- |); never pad alignment with long hyphen runs. Never output a pipe table with only a header row: every table must include the separator line plus all required data rows. No horizontal rule lines of three dashes.",
  ].join(" ");
}

function getSection1Rules(planMonths: number): string {
  const frag = planMonthsLowerFragment(planMonths);
  return `SECTION 1 The Foundational Pillars (executive summary): First line of output must be exactly one H1: \`# **Strategic title**\` (bold phrase inside the heading for the client and ${frag} SEO plan). Then \`## The Foundational Pillars\` as the only H2 in this block. After the H2: two or three very short paragraphs (2-4 sentences total) in punchy executive-summary tone; each paragraph uses **bold** only for one to three primary keyword phrases or entities (sparingly - KEYWORD STYLE applies). Then exactly one subsection heading ### Key insights (sentence case). Under Key insights output exactly four markdown bullets (-); each bullet is one line: start with a short **Bold label** (2-5 words, strategy-focused) followed by a colon and a tight clause; in the clause, **bold** only the core keyword phrases or domains - no quotation marks. The four labels must reflect distinct strategic angles (e.g. positioning, demand gaps, competitive angle, execution focus). Do not output any other ## headings in this response.`;
}

function getSection2PainPointsRules(gqDemandSource: GqDemandSource = "gsc"): string {
  const gqLabel =
    gqDemandSource === "dfs_seed"
      ? "gq (organic demand proxies from seed ranked keywords)"
      : "gq (GSC queries)";
  return `SECTION 2 Pain Points: First line must be the H2 heading ## Pain Points. No H1. Then a bullet list of 5–8 pain points grounded in the JSON wire: seed context (sd, sn, su), ${gqLabel}, sk/skM (seed clusters), sr and ekr competitive themes; tie pains to gaps and demand - do not invent crises. Each pain bullet: **bold** only the primary keyword phrases where helpful (sparingly) - never put quotation marks around those bold spans. Then ### Buyer personas: exactly five personas. Each is short (2–4 sentences) under a **bold role-style label** only (e.g. **The comparison shopper**, **The operations lead**) - gender-neutral; no gendered names; avoid gendered third-person pronouns; describe goals, constraints, and search behavior implied by the data. Inside persona prose: emphasize search terms with **bold** only; do not output ASCII double-quote (U+0022) or apostrophe (U+0027) next to bold keywords (wrong: **"term"** or **'term'**; right: **term**). Number or separate clearly so all five are visible. Then ### Alignment summary: 2–4 sentences tying pain points and personas to the upcoming SEO/content work and confirming shared understanding; **bold** sparingly on key outcomes - again no quotes around emphasized terms. Do not output ## Traffic, ## Estimated Traffic, or ## Authority. Do not output Foundational Pillars or the Content Opportunity Matrix in this response.`;
}

function getSection3TrafficRules(gqDemandSource: GqDemandSource = "gsc"): string {
  const gqSk =
    gqDemandSource === "dfs_seed"
      ? "gq (seed demand proxies) and sk (seed organic phrases)"
      : "gq (GSC) and sk (seed organic phrases)";
  return `SECTION 3 Traffic & Intent Gaps: First line must be the H2 heading ## Traffic & Intent Gaps (Title Case, optional bold words inside). Short prose first (1–3 paragraphs): **bold** only primary keyword phrases where helpful (KEYWORD STYLE). Before the matrix, one short sentence must state that rows 1–${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH} are month 1, rows ${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH + 1}–${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH * 2} are month 2, rows ${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH * 2 + 1}–${COMPETITOR_BULK_CSV_TOTAL_POSTS} are month 3 of the plan (no Month column in the table). Then ### Content Opportunity Matrix: one pipe table exactly ${COMPETITOR_BULK_CSV_TOTAL_POSTS} data rows, 5 columns in this exact header order: keyword|entity|title|modifier|featuredImage (same labels as the app bulk content CSV). keyword: short primary targeting phrase, geography-free (about 2–6 words); net-new vs what the site already captures—treat ${gqSk} as existing demand; do not duplicate or near-duplicate gq or sk intents; model on competitor ekr themes and niche services; prefer commercial or high-intent informational wording. entity: primary business or service-area entity grounded in JSON seed context (sd, sn, su)—do not invent locations. title: full article headline in Title Case (not a type label alone); include format where helpful (how-to, listicle, comparison, explainer, FAQ). Never pillar, hub, landing, service page, location page. modifier: short editorial brief or angle for the post. featuredImage: exactly one of y, n, google-maps (lowercase only). Spread nine rows across distinct topics; at most one **bold** span per cell when it helps—no quotation marks. Do not output H1, Foundational Pillars, Pain Points, Estimated Traffic, or Authority sections in this response.`;
}

/**
 * System prompt for one section (multi-call strategist pipeline). Sections 2–3 must not repeat H1 or other H2s.
 */
export function getCompetitorReportSectionSystemPrompt(
  section: CompetitorReportSectionIndex,
  _enrichmentKwPerDomain: number,
  options?: CompetitorReportPromptOptions,
): string {
  const planMonths = resolveCompetitorPlanMonths(options);
  const gqSrc = options?.gqDemandSource ?? "gsc";
  const shared = getCompetitorReportSharedSystemPrompt(options);
  const { forbidden } = getDataSourceFragments(options);
  const outputContract =
    section === 1
      ? "SINGLE-SECTION OUTPUT: This request is pass 1 of 3. Output only the H1 plus Section 1 (Foundational Pillars). Do not write ## Pain Points or ## Traffic."
      : section === 2
        ? "SINGLE-SECTION OUTPUT: This request is pass 2 of 3. Output only Section 2 (Pain Points). Start with `## Pain Points`. No H1. No other ## sections."
        : "SINGLE-SECTION OUTPUT: This request is pass 3 of 3. Output only Section 3 (Traffic & Intent Gaps). Start with `## Traffic & Intent Gaps`. No H1. No other ## sections.";

  const sectionBody =
    section === 1
      ? getSection1Rules(planMonths)
      : section === 2
        ? getSection2PainPointsRules(gqSrc)
        : getSection3TrafficRules(gqSrc);

  return [
    shared,
    outputContract,
    sectionBody,
    "STYLE: Confident, numbers when useful. No ALL CAPS headings. Follow KEYWORD STYLE above in this section’s prose.",
    forbidden,
    "BLOG VS LOCAL: Do not recommend city-targeted or geo blog content.",
    "LENGTH: This section only - keep prose tight (roughly 200–900 words for Sections 1 and 3; 150–500 for Section 2 pain points and personas) so the matrix stays complete.",
  ].join(" ");
}

/** Compact I: line for one section (pairs with getCompetitorReportSectionSystemPrompt). */
export function getCompetitorReportSectionUserInstructions(
  section: CompetitorReportSectionIndex,
  enrichmentKwPerDomain: number,
  options?: CompetitorReportPromptOptions,
): string {
  const appendTables =
    options?.dataSource === "dfs"
      ? "App appends keyword tables after assembly."
      : "App appends research keyword tables after assembly.";
  const base = [
    `Section ${section}/3 only.`,
    `Enrichment kw/domain cap context: ${enrichmentKwPerDomain}.`,
    appendTables,
  ];
  if (section === 1) {
    base.push("Deliver H1 then Foundational Pillars and ### Key insights bullets only.");
  } else if (section === 2) {
    base.push(
      "Pain points list; exactly five gender-neutral buyer personas; ### Alignment summary. QUOTE BAN: no \" or ' around **bold** keywords in bullets or personas.",
    );
  } else {
    base.push(
      `Matrix: exactly ${COMPETITOR_BULK_CSV_TOTAL_POSTS} rows; cols keyword|entity|title|modifier|featuredImage; keyword net-new vs gq+sk; blog titles only.`,
    );
  }
  return base.join(" ");
}

/**
 * Legacy full-document system prompt (single call). Kept for tests; production uses section prompts + stitch.
 */
export function getCompetitorReportMarkdownSystemPrompt(
  _enrichmentKwPerDomain: number,
  options?: CompetitorReportPromptOptions,
): string {
  const gqSrc = options?.gqDemandSource ?? "gsc";
  const gqSk =
    gqSrc === "dfs_seed"
      ? "gq (seed demand proxies) and sk (seed organic phrases)"
      : "gq (GSC) and sk (seed organic phrases)";
  const { forbidden } = getDataSourceFragments(options);
  const shared = getCompetitorReportSharedSystemPrompt(options);
  return [
    shared,
    "FORMAT: Deliver exactly three sections in the order below. One H1 with bold strategic title inside the heading. ## Section headings Title Case; optional light **bold** in headings (KEYWORD STYLE). Pipe tables with header+separator for the Content Opportunity Matrix only. Never output a pipe table with only a header row: every table must include the separator line plus all required data rows. No horizontal rule lines of three dashes.",
    "COMPLETION PRIORITY: In a single reply you must output the full H1 and all three ## sections with every mandatory matrix row. If space runs short, tighten prose in sections 1–2 and keep matrix cells short - never stop inside a pipe table after only the header row.",
    "SECTION 1 The Foundational Pillars (executive summary): ## The Foundational Pillars as the only H2 for this block. After the H2: two or three very short paragraphs (2-4 sentences total) in punchy executive-summary tone; **bold** only primary keyword phrases (KEYWORD STYLE). Then exactly one subsection heading ### Key insights (sentence case). Under Key insights output exactly four markdown bullets (-); each bullet is one line: start with a short **Bold label** (2-5 words, strategy-focused) followed by a colon and a tight clause tying to the data and plan - no separate H3 or H4 per bullet, no numbered list. The four labels must reflect distinct strategic angles (e.g. positioning, demand gaps, competitive angle, execution focus).",
    "SECTION 2 Pain Points: ## Pain Points as the H2. Bullet list of 5–8 pain points grounded in gq, sk, sr, ekr, and seed context; **bold** primary keyword phrases per bullet sparingly; never quotation marks around keywords. ### Buyer personas: exactly five short gender-neutral role-based personas; **bold** core queries inside text only where helpful - only **phrase** with no U+0022 or U+0027 adjacent to bold (never bold-plus-quotes). ### Alignment summary: 2–4 sentences; **bold** sparingly on key outcomes.",
    `SECTION 3 Traffic & Intent Gaps: short prose first (KEYWORD STYLE). Before the matrix, state row groupings: rows 1–${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH} = month 1, ${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH + 1}–${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH * 2} = month 2, ${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH * 2 + 1}–${COMPETITOR_BULK_CSV_TOTAL_POSTS} = month 3 (no Month column). Then ### Content Opportunity Matrix: one table exactly ${COMPETITOR_BULK_CSV_TOTAL_POSTS} data rows, 5 cols keyword|entity|title|modifier|featuredImage. keyword: short geography-free phrase; net-new vs ${gqSk}; no duplicate intents. entity: from seed JSON context only. title: full blog headline Title Case; never pillar/hub/landing/service/location page. modifier: editorial brief. featuredImage: only y, n, or google-maps. At most one **bold** per cell when helpful; no quotes around queries.`,
    `STYLE: Confident, numbers when useful. No ALL CAPS headings. End after section 3. ${forbidden}`,
    "BLOG VS LOCAL: Do not recommend city-targeted or geo blog content.",
    "LENGTH: Stay concise; short paragraphs; no filler. Aim for roughly 900–2,400 words total so the entire report typically fits model output limits in one pass. Avoid redundant metric restatements and long preamble. Do not add a separate top-level Executive Brief or The Snapshot outside section 1; the opening of section 1 is the executive summary.",
  ].join(" ");
}

export function getCompetitorReportMarkdownUserInstructions(
  _enrichmentKwPerDomain: number,
  options?: CompetitorReportPromptOptions,
): string {
  return compactUserInstructions(_enrichmentKwPerDomain, options);
}

/** Concatenate section Markdown blocks (three strategist calls). */
export function stitchCompetitorReportSections(parts: [string, string, string]): string {
  return parts.map((p) => p.trim()).join("\n\n");
}

/** Summarize step: model must return JSON only, never markdown wrapping. */
export const COMPETITOR_REPORT_SUMMARIZE_SYSTEM =
  "You compress competitor research JSON for the next call. Return one JSON object only. No prose, no markdown, no code fences, no backticks. Shorten only long text fields: ta.Sum, tier Rsn, n, lb, labels if needed. Same keys as input when possible (serialized wire uses scv and ekM, not scsv/ekrM). Do not invent or rewrite sk,sr,ekr,dm,gq,tp,ssc,scv - the server restores those from the canonical wire; you may omit or stub them.";

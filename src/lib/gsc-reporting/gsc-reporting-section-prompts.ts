import type { GscReportingOutlineResult, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";
import {
  COMPARE_SIGNALS_LEXICON,
  searchPerformanceH2ForCompareKind,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";

/** All GFM pipe tables: short metric headers so columns stay scannable (charts + tables). */
const TABLE_HEADER_ABBREV =
  "**Column headers (mandatory):** Abbreviate **every metric** column - **Clk** (clicks), **Imp** (impressions), **Pos** (avg. position), **CTR**; for change use **Δ%** right after the metric (**Clk Δ%**, **Imp Δ%**, **Pos Δ%**). **Forbidden** in header row: spelling out **Clicks**, **Impressions**, **Position**, **Impressions (Mar 20xx)**, etc. Dimension columns stay readable: **Theme**, **Segment**, **Query**, **Page**, **Example**, **Topic**, **URL**, **Includes** / **Inc**.";

/** Shared rules for non-technical executives: tables-first for stats, compact prose, readable links. */
const EXEC_RULES =
  "AUDIENCE: **Senior executives** - they must grasp the section in **under ~90 seconds**. **Overwhelm = failure:** **no** dense grids, **no** multiple similar tables in one section, **no** repeating the same story (site totals vs pages vs queries) with duplicate column layouts. **TONE:** Confident and **constructive** - lead with **wins and momentum**; frame gaps as **opportunities** or **observations**, not a bleak audit. **FORBIDDEN (report output):** Do **not** use headings or labels such as **Priority Next Steps**, **Next steps**, **Recommended actions**, **Keyword strategy** (as a standalone tactic section), or numbered tactical checklists tied to specific query strings. Write **analysis and interpretation** (what changed, what the data shows), not a marketing task list with named campaigns. **No** extra `###` / `####` subheadings under the section **except** `### Key Insights` inside **Executive Summary** only - **no** titles like **Top Performing Query Categories** or **(Month-over-Month)** above tables; **one** `##` section heading, then prose and **at most one** table. **FORMATTING:** Plain **GitHub-Flavored Markdown only** - **no** HTML (`<span>`, `<font>`, `<a>`, `<div>`), **no** inline CSS/color (no green or other colored accents), **no** emoji as decoration. **Section H2 (first line):** Output **exactly** the **Target H2** from the user message - blog-style **Title Case** (major words capitalized); **never** sentence-case the H2; **never** add month names, years, or date spans to the H2 (period labels belong in tables only). **Links:** only `[label](https://...)` - **do not** wrap the whole link in `**bold**` (no `**[label](url)**`); use a normal markdown link. **CMS duplicate URLs (critical):** **Never** cite, quote, paste, or link URLs whose **path ends with `-2` through `-30`** (copy slugs like `…-ontario-2`, `…-united-states-2`). Those rows are **ignored** in RETRIEVED DATA for reporting: **do not** name them in prose, **do not** put them in tables, **do not** use them as examples. Summarize **only** the canonical topic or segment (same slug **without** the `-N` suffix) or use theme labels (e.g. “Austin service area”) with **no** duplicate path strings. **Near-duplicate pages:** Do **not** surface separate rows or long titles for CMS copy slugs (`…-2`, `…-3` in the URL) or titles ending in ` 2`, ` 3`, `-2`, `(2)` - **omit** the duplicate line or merge into the canonical topic; **link labels** must not read like “… Ontario 2”. **NO REDUNDANCY:** **Search Performance Compared Month Over Month** is the **only** place for the **site-wide** KPI table (total clicks, impressions, search queries, CTR, average position and their MoM **%**). **Executive Summary** may mention the story **without** that table. **Do not** repeat that KPI table or re-list those **same** site-wide KPI totals with MoM % in **Key Performance Insights**, **SAP & Local SEO**, or **Content Performance**. **Do not** paste two query/theme MoM grids that show the **same** rows and **same** numbers as if they were new. **Do not** paste another **full** Mar-vs-Feb (or period A vs B) **per-page** spreadsheet in multiple sections - executives should **not** see duplicate Δ% column layouts for the same URLs or queries. **DATA PRESENTATION:** Default to **brief prose + at most ONE GFM pipe table per section**; **max 6 data rows** per table; **≤7 columns** for theme tables (**Theme | Clk | Clk Δ% | Imp | Imp Δ%** ± optional **Pos | Pos Δ%**); **abbreviated metric headers** always (**Clk**, **Imp**, **Pos**, not long words). Prefer **theme / insight rows** over raw URL lists. **Short bullets** for non-tabular callouts (**cap 3–5**). **AGGREGATION:** Theme labels are fine, but **each table row with metrics** must map to **one** CSV row (no blending figures across rows). LISTS: **bold labels**. **KEYWORDS AND TITLES:** Do **not** wrap search queries, keywords, page titles, post slugs, or brand names in ASCII or curly quotation marks. Present them in **plain text** or use **Markdown bold** for scan emphasis (**only** where something should stand out). **Forbidden:** decorative quoting (e.g. wrong: \"term\" or 'term'); correct: **term** or plain term. Same rule inside table **Theme** / **Segment** / **Query** cells. LINKS: **`[Short human label](full URL)`** for pages. TABLES: **one** primary table per section unless explicitly multi-part; **never** stack two page-level performance tables back-to-back. **Theme / category / insight MoM (mandatory column order + abbrev headers):** **Theme | Clk | Clk Δ% | Imp | Imp Δ%** - **level then delta** for Clk, then **level then delta** for Imp (current-period counts + **% change vs prior** from RETRIEVED DATA). **Not** delta-only columns; **not** **Clicks (Mar)** + **Clicks (Feb)** + **Clicks Δ%** (too wide). Optional **Pos | Pos Δ%** as columns 6–7 only if needed; **≤7 columns**.";

/** Canonical site-wide MoM KPI table only (Search Performance section). */
const TABLE_RULE_SITE_MOM =
  "**Search Performance Compared Month Over Month (this section only):** One summary table mirroring RETRIEVED DATA site totals - **same numbers and order as the CSV** (total clicks, impressions, search queries, CTR, average position), but **header row uses abbreviations:** **Clk** / **Imp** / **Queries** / **CTR** / **Pos** with **Δ%** for change columns (e.g. period columns may be **Clk A**, **Clk B**, **Clk Δ%** or shortest labels that stay consistent - **never** long **Clicks (Mar 20xx)** style in the report table).";

/** Theme/category/insight rows: Clicks + Δ, then Impressions + Δ (no raw 10-col MoM export). */
const TABLE_RULE_THEME_DELTA =
  "**Theme / category / insight tables (all sections except the canonical Search Performance MoM table):** **Mandatory column order:** **Theme | Clk | Clk Δ% | Imp | Imp Δ%** - current-period **Clk** total then **Clk Δ%**, then **Imp** total then **Imp Δ%**. Same **% change** formula as the CSV. Optional **Pos | Pos Δ%** as 6th–7th columns. **Headers must use** **Clk**, **Imp**, **Pos**, **Δ%** (abbreviated). **Forbidden:** **Clicks (Mar)** + **Clicks (Feb)** + **Clicks Δ%** triplets, **forbidden:** full per-query MoM paste, **forbidden:** reordering so deltas are not immediately after their level.";

/** Numeric grounding: RETRIEVED DATA always; OUTLINE_GROUNDING when present in user message. */
const GROUNDING_RULE_WITH_OUTLINE =
  "**NUMERIC GROUNDING:** Any **digit**, **%**, **CTR**, or **position** figure in prose or tables must appear **verbatim** in **RETRIEVED DATA** or, when the user message includes **OUTLINE_GROUNDING**, in that block (same tokens; **no** recomputed % or rounded substitutes). If **OUTLINE_GROUNDING** is absent, **RETRIEVED DATA** is the only numeric source. If you cannot support a claim, state it **without numbers** or **omit** it. **Do not** invent URL-, query-, or page-level stats.";

/** One theme row must not blend metrics from different CSV rows (fixes hallucinated aggregates). */
const THEME_ROW_INTEGRITY =
  "**THEME ROW INTEGRITY:** Each table row under **Theme** / **Segment** / **Query** with **Clk**, **Imp**, **Δ%** must match **exactly one** CSV row visible in **RETRIEVED DATA** for this section (same query string or same canonical page URL). **Forbidden:** merging clicks from one row with impressions from another; **forbidden:** synthetic buckets that do not map one-to-one unless prose is **qualitative only** (no shared numeric columns).";

/** Align marketing tone with signed deltas from the CSV. */
const DIRECTIONAL_LANGUAGE =
  "**DIRECTIONAL LANGUAGE:** Words like **growth**, **surge**, **strong gains**, **click growth** apply only when **Clk Δ%** or **Imp Δ%** on the cited row is **strictly positive**. At ~**0%** use **steady**, **flat**, or **unchanged**. When **Δ%** is negative use **down**, **lower**, **pullback**, or **softened** (not growth). Same rule for **Executive Summary** bullets.";

/** Block recomputed or stray CTR claims outside the site KPI table. */
const CTR_DISCIPLINE =
  "**CTR DISCIPLINE:** **Site-wide** CTR appears **only** in **Search Performance Compared Month Over Month** (table + short prose there). In **all other sections**, do **not** mention **CTR** or **CTR Δ%** for queries, pages, or segments unless that **exact** CTR token appears in **RETRIEVED DATA** on the **same** row you are discussing (copy verbatim; **no** recomputation). **Do not** add a **CTR** column to theme tables outside Search Performance unless the source CSV row includes CTR.";

const TABLE_RULE =
  `Use GFM pipe tables only when needed: header row, separator \`|:---|\`, data rows. ${TABLE_HEADER_ABBREV} **Max 6 data rows** per table. ${TABLE_RULE_SITE_MOM} ${TABLE_RULE_THEME_DELTA} ${THEME_ROW_INTEGRITY} ${DIRECTIONAL_LANGUAGE} ${CTR_DISCIPLINE} **One numeric metric per cell:** **never** put multiple stats in **one** cell or in a prose **Summary / Direction** column. **Forbidden:** comma-joined metric bundles. **Forbidden table shapes:** Do **not** duplicate **Search Performance** as a second full MoM grid in other sections. **TABLE DATA (strict):** Every cell grounded in RETRIEVED DATA (and **OUTLINE_GROUNDING** when present). **Forbidden:** “Not Available”, “N/A”, blanks for metrics. **Forbidden:** a pipe table that has **only** a header row and separator with **zero** data rows (omit the table). **Omit** incomplete rows. **URL columns:** \`[short label](url)\`. **Sort** URL rows by clicks ↓ then impressions ↓ only if not using **theme buckets** (default: **theme buckets**). **Do not** include rows where **both** impressions and clicks are **0**.`;

/** GSC position: lower numeric rank is better. */
const POSITION_LEXICON =
  "**AVERAGE POSITION:** In Google Search Console, **lower** average position is **better** (closer to 1). After the KPI table, include **one** short sentence stating this for the executive reader. Your verbal summary of **Pos Δ%** must match the **sign** shown in the CSV (**do not** invert improvement vs decline).";

const KEY_INSIGHTS_DIVISION =
  "**SECTION DIVISION (NO REDUNDANCY):** Prefer **prose-only** interpretation (risks, opportunities, what changed for the business). **Forbidden:** opening by restating total clicks, impressions, search queries, CTR, or average position **and** their MoM **%** (that is **only** in **Search Performance Compared Month Over Month**). **Forbidden:** paraphrasing the Executive Summary lead paragraph. If you include **one** theme table, **≤6 data rows**, **THEME ROW INTEGRITY** applies; the table must **add** something (e.g. different slice or framing), **not** a second copy of the same top-query grid with identical figures.";

const SAP_CONTENT_APPEND =
  "**AFTER THE TABLE:** At most **≤3** short bullets **or** **≤3** sentences of prose (not both long bullets and long prose). **Forbidden:** pseudo-headings or bold labels **Key Insights**, **Observations**, **Top themes** as section breaks. **Forbidden:** query-level **CTR Δ%** or any **%** not traceable to **RETRIEVED DATA** for that segment. **No** second pipe table. **No** `###` / `####`.";

/** SAP / Content must not replay site KPIs or duplicate query tables from earlier sections. */
const SAP_CONTENT_NO_REDUNDANCY_CORE =
  "**NO REDUNDANCY:** **Do not** repeat the site-wide KPI totals or their MoM **%** here. **Do not** paste another **Theme | Clk | Clk Δ% | Imp | Imp Δ%** query grid that duplicates the same lines as **Key Performance Insights** (if that section already showed one).";

const CONTENT_FOOTPRINT_SEGMENT_LENS =
  "**Content section:** Stay in **segment** lens (**Segment | Inc | Clk | Imp | Pos**): thematic content footprint **only**, with prose that **adds** insight rather than restating earlier paragraphs.";

/** Group Pages URLs by submitted sitemap / URL archetype (blogs, local, products, etc.). */
const CONTENT_PERFORMANCE_SITEMAP_BUCKETS =
  "**Sitemap-style buckets (mandatory):** Read **GSC-sitemaps.csv** for submitted child sitemap **paths** (e.g. `post-sitemap`, `page-sitemap`, `product`, `category`, `location`, `local`, `service-area`, `photo-gallery`, `near`, `news`). Build **4–6** **Segment** rows that mirror those **content-type families**, not random themes. Prefer labels such as **Blog & editorial** (posts / articles), **Core pages & marketing** (static pages, homepage hub), **Products & catalog** (product, shop, WooCommerce-style paths), **Local & near-me landings** (location, local, service-area, geo-style URLs when they are **not** the SAP entity-exclusive slice), **Galleries & media**, **Other URLs**. **Inc** column: name the **sitemap file stem** or **URL path pattern** (no digits). Assign each **Pages-MoM.csv** URL to **one** bucket using pathname cues plus **GSC-sitemaps.csv** naming; **omit** empty buckets. **Do not** replay per-URL MoM grids.";

/** Allows summed metrics per Segment row for Content Performance (exception to global one-row theme rule). */
const CONTENT_SEGMENT_BUCKET_OVERRIDE =
  "**SEGMENT AGGREGATES (this section only):** **THEME ROW INTEGRITY** does **not** apply to **Segment** rows here, and the **AGGREGATION** line in **EXEC_RULES** (**one CSV row per theme row**) does **not** apply here. Each **Segment** row is a **bucket** of many page URLs. **Sum** **Clk** and **Imp** across **all** Pages-MoM rows you assign to that bucket (use the CSV period columns). When you show **Clk Δ%** / **Imp Δ%**, compute from those **bucket totals** vs prior period using the **same % formula** as the sheet. **Pos:** omit for bucket rows **or** copy **verbatim** from the **single** highest-**Imp** row inside that bucket (qualitative cue in **Notes** only). **No** invented averages.";

/** When pipeline pins entity allowlist + filtered Pages, writers must obey those blocks over stray CSV excerpts. */
const SAP_RETRIEVED_ENTITY_BLOCKS =
  "**ENTITY BLOCKS (when present in RETRIEVED DATA):** If you see `ENTITY_SITEMAP_ALLOWLIST` or `FILTERED_PAGES_FOR_SAP`, those blocks are **authoritative** for SAP URL scope. **Ignore** any other Pages MoM rows elsewhere in RETRIEVED DATA for the SAP **Page** table. **Do not** paste **query strings** as SAP table rows and **do not** add after-table bullets about named queries (that belongs in query sections). Metrics for SAP rows must come from **FILTERED_PAGES_FOR_SAP** when that block lists matching URLs; otherwise follow **ENTITY_SITEMAP_ALLOWLIST** and omit metrics you cannot trace.";

/** SAP & Local SEO: entity sitemap URLs only, not blog/editorial Pages export leaders. */
const SAP_ENTITY_SITEMAP_LAYOUT =
  "**SAP & LOCAL SEO = ENTITY SITEMAP PERFORMANCE ONLY:** Report **only** URLs that are **entity sitemap** destinations: multi-location / place / entity landings, GBP-aligned local entity pages, service-area **entity** URLs the business submits in its **entity** XML sitemap (service-area / entity child sitemap). Column **Page** = **`[short label](full URL)`**; metrics must match **one** page row in **RETRIEVED DATA** for that URL. **Strictly excluded (do not list):** regular **blog posts**, news posts, editorial guides, **vs** / comparison articles, generic educational resources, homepage, **retail-store** marketing pages, and other **non-entity-sitemap** URLs even if they rank high in a broad **Pages** export. **Do not** use **Queries** as row labels. **If** entity URLs cannot be grounded, state that briefly and output **no** table (never backfill from generic Pages). **Exactly one** GFM pipe table for this section (**never** two tables). **Columns:** **Page | Clk | Clk Δ% | Imp | Imp Δ%** optional **Pos | Pos Δ%** when in CSV. **≤6** rows. **Forbidden:** CMS duplicate paths `-2`…`-30`. Prose and after-table bullets discuss **entity sitemap URL** performance only (no query-theme recap).";

const SAP_LOCAL_TABLE_MIN =
  "**TABLE (SAP only):** **One** pipe table only; **max 6** data rows; numbers **verbatim** from matching page rows; **no** N/A or blank metric cells when the CSV has values; **no** header-only tables; **no** split tables or duplicate headers.";

function buildOutlineGroundingBlock(outline: GscReportingOutlineResult): string {
  const rows = outline.topOpportunities;
  if (!rows.length) return "";
  const lines: string[] = [
    "OUTLINE_GROUNDING (from outline step; evidence lines are verbatim CSV supports):",
    "",
  ];
  for (const t of rows) {
    lines.push(`- rank ${t.rank}: **${t.label}**`);
    lines.push(`  - why: ${t.why}`);
    lines.push(`  - metrics: ${t.metrics}`);
    const ev = t.evidence ?? [];
    if (ev.length) {
      lines.push("  - evidence (verbatim):");
      for (const e of ev) {
        lines.push(`    - ${e}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Page-heavy sections (SAP, top pages): theme rows with one metric per column (no “high-level result” blobs). */
const PAGE_THEMATIC_LAYOUT =
  "**Thematic page groups (mandatory):** Do **not** list **one row per URL** and **never** a **7+ column** Mar/Feb/Δ% grid for pages - that is **not** executive-readable. **Do** use **4–6 theme rows max** (e.g. **Homepage & brand**, **Product / solutions**, **Service-area (regional)**, **Blog / resources**). Each row = **one business segment**, not one URL. **Table columns (mandatory):** **Segment** | **Inc** (what it includes - short phrase; example terms only, no stats) | **Clk** | **Imp** | **Pos** - **five columns total**, abbreviated metric headers (**Clk**, **Imp**, **Pos**). **One** number or **one** % change per cell, never combined. Optional 6th column **Notes**: **one** short qualitative phrase (**no** digits in Notes - all counts and % belong in the numeric columns). **Forbidden:** any column titled **High-level result**, **Summary**, or **Direction** that mixes multiple metrics in prose. **Forbidden:** typing \"High impressions, zero clicks\" **and** the counts in the same cell - put **244** under **Imp**, **0** under **Clk**, etc. **Never** mention or link CMS duplicate paths ending in `-2`…`-30`. Optional **≤2** example page links in prose **below** the table only. **One table only**. **Omit** low-signal buckets.";

/** Content Performance: prefer sitemap-derived segment names over generic examples. */
const PAGE_THEMATIC_LAYOUT_CONTENT =
  "**Combined stages (Content Performance):** Same table shape as thematic page groups (**Segment | Inc | Clk | Imp | Pos** ± **Notes**), but **Segment** labels must follow **sitemap / content-type families** from **GSC-sitemaps.csv** (see **Sitemap-style buckets** above), not generic examples alone. Still **do not** list **one row per URL**.";

/** Cluster sections: executive scannability - tables only, no bullet/numbered lists. */
const CLUSTER_TABLE_ONLY_LAYOUT =
  "CLUSTER LAYOUT (mandatory): Do **not** use bullet lists (`-`, `*`) or numbered lists (`1.`). Optional: at most **one** short intro sentence (no list). Then use **only** GFM pipe tables - up to **3** compact tables: (1) **Cluster metrics** - columns **Metric | Value** (metric names in first column may be short phrases; rows e.g. Total Clk, Total Imp, CTR, Pos) from RETRIEVED DATA. (2) **Example queries or pages** - headers **Example | Imp | Clk | Pos** (abbreviated; omit columns if unsupported); ≤5 example rows, plain text or **bold** for emphasis in cells (**no** quote wrapping around queries or titles); **sort** pages by Clk ↓ then Imp ↓, queries by Imp ↓ then Clk ↓; **omit** rows with 0 Imp **and** 0 Clk. (3) **Takeaways** - columns **Topic | Insight** (1–3 rows: opportunity, relevance, or implication).";

function baseWithExec(): string {
  return `ROLE: SEO strategist writing for a **time-poor executive**. OUTPUT: Markdown only (no HTML). **Brevity beats completeness.** ${GROUNDING_RULE_WITH_OUTLINE} ${COMPARE_SIGNALS_LEXICON} **Tables:** every number from RETRIEVED DATA (and **OUTLINE_GROUNDING** when present); **no** placeholders; **skip** bad rows. **Do not invent** metrics. First line = exact H2 from user message. No H1. ${EXEC_RULES}`;
}

/** Executive Summary ### Key Insights: strategic themes, not a query-by-query inventory. */
const EXEC_KEY_INSIGHTS_BREADTH =
  "**KEY INSIGHTS ALTITUDE:** Write **portfolio-level** bullets for a busy executive: **themes** such as local demand, branded visibility, content categories, or impression-vs-click quality. **Do not** build bullets around **individual** long-tail queries or blog titles unless **one** optional example stands for a whole bucket. **Avoid** celebrating **noise-level** moves (very low prior-period clicks where **%** is misleading, e.g. 1→2). **Prefer** qualitative synthesis; when you use numbers, tie them to a **segment** or pattern supported by **OUTLINE_GROUNDING** / **RETRIEVED DATA**. **At most one** concrete query or page name **in the entire Key Insights block** (optional). **Do not** stack several granular examples in one bullet.";

/** Appended to every section user message for consistent tone. */
export const GSC_REPORTING_SECTION_STYLE_LINE =
  "Style: **Senior exec** - **short** prose first when helpful; **at most one** slim table per section; **never** repeat a giant Mar-vs-Feb per-page grid; **page sections:** **theme segments only**; **query sections:** **categories** as **theme rows**. **Tables:** Abbreviated headers (**Clk**, **Imp**, **Pos**, **CTR**, **Δ%**) on every metric column. **Search Performance Compared Month Over Month** is the **only** section with the full site KPI table (same logic as CSV; **short** metric headers in the markdown). **Do not** repeat that site-wide story or duplicate the same query-theme table in later sections. **Everywhere else** (themes, categories, insights): **Theme | Clk | Clk Δ% | Imp | Imp Δ%** (optional **Pos | Pos Δ%**) - **no** Mar/Feb/Δ triplets, **no** 10-column query MoM layouts; **no** `###` subheadings; **never** one column with comma-joined stats; no placeholder cells; **`[short name](url)`** links; **no** quotation marks around queries, keywords, or titles (use **bold** for emphasis only). **Never** paste or link URL paths ending in `-2`…`-30` (CMS duplicates); use themes or canonical pages only. When **OUTLINE_GROUNDING** is present: follow **NUMERIC GROUNDING** in the system prompt.";

/** Executive summary: one explainer paragraph + ### Key Insights + positive bullets (see pipeline H1 + no URL/source line in output). */
export const GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE =
  `Style (this section only): **Structure (mandatory):** (1) **One short explainer paragraph** (2–4 sentences): what changed this period in plain language for an executive; **bold** 1–2 scan phrases (e.g. **Traffic**, **Visibility**); **no** dense % stacks - **Search performance** holds exact KPIs. **NUMERIC GROUNDING:** Any number or **%** in this paragraph must appear **verbatim** in **RETRIEVED DATA** or **OUTLINE_GROUNDING**; otherwise omit the figure or stay qualitative. (2) A blank line, then **exactly** this heading: \`### Key Insights\` (H3, no other H3). (3) **4–5** Markdown list bullets; each line **Bold label:** one scannable insight; **every** bullet that includes **any** digit or **%** must map clearly to **one** outline opportunity or **one** evidence line in **OUTLINE_GROUNDING**, or to a line in **RETRIEVED DATA** (same query/page token and same figures). **No** new math or invented URL/query stats. **Direction:** apply **DIRECTIONAL LANGUAGE** from the system prompt (no growth wording for flat or negative **Clk Δ%** / **Imp Δ%**). **Do not** wrap query or page names in quotation marks; use **bold** when highlighting a specific term. ${EXEC_KEY_INSIGHTS_BREADTH} Keep tone **constructive**; **no** pipe tables; **no** task lists.`;

export function buildUserMessageForSection(args: {
  siteName: string;
  siteUrl: string;
  outline: GscReportingOutlineResult;
  plan: GscReportingSectionPlan;
  retrievedContext: string;
}): string {
  const { siteName, siteUrl, outline, plan, retrievedContext } = args;

  const clusterHint =
    plan.kind === "cluster" && plan.clusterIndex != null && outline.clusters[plan.clusterIndex]
      ? JSON.stringify(outline.clusters[plan.clusterIndex], null, 0)
      : "";

  const execHint = plan.kind === "executive_summary" ? outline.executiveSummary.slice(0, 2000) : "";

  const parts: string[] = [
    `Property: ${siteName}`,
    `URL: ${siteUrl}`,
    `Section kind: ${plan.kind}`,
    `Target H2 (output this exact heading as the first line): ## ${plan.h2Title}`,
  ];
  if (
    plan.kind === "key_performance_insights" ||
    plan.kind === "sap_local_seo" ||
    plan.kind === "content_performance"
  ) {
    parts.push(
      "Report context (NO REDUNDANCY): Sections above this in the final report already include Executive Summary and Search Performance Compared Month Over Month with the **only** site-wide KPI table. Do **not** repeat that table, do **not** restate the same site-wide KPI totals (clicks, impressions, search queries, CTR, position) with MoM %, and do **not** paste a second query/theme MoM grid that duplicates the same rows and figures as an earlier section.",
    );
  }
  if (plan.kind === "sap_local_seo") {
    parts.push(
      "**SAP section contract:** **Entity sitemap URLs only** (same URLs as the WordPress **Entity** sitemap, e.g. service-area XML). When **ENTITY_SITEMAP_ALLOWLIST** / **FILTERED_PAGES_FOR_SAP** appear in RETRIEVED DATA, the SAP **Page** table must use **only** those URLs. **Excluded:** homepage, retail-store hubs, blog posts, **vs** articles, and other non-entity pages. First column **Page** with markdown links. **One** table. **No** query labels or query recap bullets.",
    );
  }
  if (plan.kind === "content_performance") {
    parts.push(
      "**Content Performance contract:** One **Segment** table: group **Pages-MoM.csv** URLs into **sitemap-style buckets** (blog / posts, core pages, products or shop, local or near-me landings, galleries, other) using **GSC-sitemaps.csv** child sitemap **paths** plus pathname patterns. **Sum** **Clk** and **Imp** per bucket per system prompt. **Do not** duplicate the SAP entity URL table or paste another full query-theme MoM grid.",
    );
  }
  if (plan.kind === "cluster" && clusterHint) {
    parts.push(`Cluster metadata (ground prose in RETRIEVED DATA): ${clusterHint}`);
    parts.push("Cluster section: output tables only (metrics, examples, takeaways) - no bullet or numbered lists.");
  }
  if (plan.kind === "executive_summary" && execHint) {
    parts.push(`Outline executive summary (align narrative; ground numbers in RETRIEVED DATA or OUTLINE_GROUNDING): ${execHint}`);
  }
  const groundingBlock = buildOutlineGroundingBlock(outline);
  if (groundingBlock) {
    parts.push("");
    parts.push(groundingBlock);
  }
  parts.push("");
  parts.push("RETRIEVED DATA (GSC CSV excerpts - ground numbers and examples in this text):");
  parts.push(retrievedContext);
  parts.push("");
  parts.push(
    plan.kind === "executive_summary"
      ? GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE
      : plan.kind === "sap_local_seo"
        ? `${GSC_REPORTING_SECTION_STYLE_LINE} **SAP override:** Obey **ENTITY_SITEMAP_ALLOWLIST** and **FILTERED_PAGES_FOR_SAP** when present; **no** query-theme recap; **one** **Page** table; see system prompt.`
        : plan.kind === "content_performance"
          ? `${GSC_REPORTING_SECTION_STYLE_LINE} **Content override:** **Segment** rows = **sitemap / content-type** buckets (blog, pages, products, local, etc.); see system prompt.`
          : GSC_REPORTING_SECTION_STYLE_LINE,
  );
  return parts.join("\n");
}

export function getGscReportingSectionSystemPrompt(
  kind: GscReportingSectionPlan["kind"],
  compareKind: GscCompareKind = "mom",
): string {
  const base = baseWithExec();
  const searchPerformanceH2 = searchPerformanceH2ForCompareKind(compareKind);
  const periodCompareWording =
    compareKind === "yoy"
      ? "year over year"
      : compareKind === "custom"
        ? "period over period"
        : "month over month";

  switch (kind) {
    case "executive_summary":
      return `${base} ${DIRECTIONAL_LANGUAGE} ${EXEC_KEY_INSIGHTS_BREADTH} SECTION: Executive Summary - **No** site-wide KPI table here (that lives **only** in **${searchPerformanceH2}**). **Output shape (mandatory order):** (1) **One** short explainer paragraph: period story in plain language; **bold** 1–2 key phrases; **defer** exact compare **%** and table figures to **${searchPerformanceH2}**. Obey **COMPARE_SIGNALS** when present. (2) Blank line, then heading **exactly** \`### Key Insights\` (H3 only; **no** other subheadings). (3) **4–5** bullets: each \`- **Label:**\` scannable insight; bullets with numbers must trace to **OUTLINE_GROUNDING** (if present) or **RETRIEVED DATA**. **No** pipe tables; **no** priority/next-step lists.`;
    case "search_performance_period":
      return `${base} ${POSITION_LEXICON} SECTION: Search performance ${periodCompareWording} - **This section owns the canonical KPI table** (totals / current vs prior period). **Lead with** that one summary table including **Search queries** as a fixed row, then at most **2–3** short sentences including the **average position** gloss and **COMPARE_SIGNALS** interpretation when present. **Do not** put month or date ranges in the H2 - the **Target H2** is fixed. **Do not** say "month over month" when compareKind in **COMPARE_SIGNALS** is **yoy**. **Table:** mirror CSV values and order; **header row uses abbreviations** (**Clk**, **Imp**, **Queries**, **CTR**, **Pos**, **Δ%** - not long month labels in headers). ${TABLE_RULE} Do not repeat this table elsewhere.`;
    case "key_performance_insights":
      return `${base} ${KEY_INSIGHTS_DIVISION} SECTION: Key performance insights - **No** \`###\` / \`####\` subheadings (only the single **Target H2**); **do not** add titles like **Top Performing Query Themes** above a table. **Narrative-first:** **2–4 short paragraphs** or **≤5 bullets** with **bold** lead phrases (wins, risks, opportunities). Obey **COMPARE_SIGNALS** when present. **Forbidden:** URL-level compare grids (no duplicate of **${searchPerformanceH2}**). **If** you include a **theme or query-category** table: **exactly this order:** **Theme | Clk | Clk Δ% | Imp | Imp Δ%** (optional **Pos | Pos Δ%**); **abbreviated headers**; **≤7 columns**; **≤6 data rows**; **never** paste **Clicks (month A)**, **Clicks (month B)**, **Clicks Δ%** triplets; **never** emit a table with headers only and **no** data rows. **Forbidden:** headings or bullets framed as **Next steps**, **Priority next steps**, **Recommended actions**, or SEO task backlogs. **Separate columns** per metric (**never** one **Direction** cell with multiple stats). ${TABLE_RULE}`;
    case "sap_local_seo":
      return `${base} ${SAP_CONTENT_NO_REDUNDANCY_CORE} ${SAP_RETRIEVED_ENTITY_BLOCKS} ${SAP_ENTITY_SITEMAP_LAYOUT} ${SAP_CONTENT_APPEND} ${SAP_LOCAL_TABLE_MIN} SECTION: SAP & local SEO - **Entity sitemap performance** only: **one** **Page**-first table (**≤6** entity URLs), prose aligned with that scope.`;
    case "content_performance":
      return `${base} ${SAP_CONTENT_NO_REDUNDANCY_CORE} ${CONTENT_FOOTPRINT_SEGMENT_LENS} ${CONTENT_PERFORMANCE_SITEMAP_BUCKETS} ${PAGE_THEMATIC_LAYOUT_CONTENT} SECTION: Content / top pages - ${PAGE_THEMATIC_LAYOUT} ${CONTENT_SEGMENT_BUCKET_OVERRIDE} ${SAP_CONTENT_APPEND} **Forbidden:** per-page MoM comparison grids (multiple month columns + Δ% per URL). **One** theme table **or** short prose + **≤3** takeaways; **max 6 rows** total. ${TABLE_RULE}`;
    case "cluster":
      return `${base} ${CLUSTER_TABLE_ONLY_LAYOUT} ${TABLE_RULE} SECTION: One topic cluster - follow CLUSTER LAYOUT above; no lists anywhere in this section.`;
    default:
      return `${base} ${TABLE_RULE}`;
  }
}

/**
 * Local Strategy blueprint: fixed Markdown contract (13 writer passes + stitch).
 * Headings and table schemas must match the product spec; prose is grounded in wire JSON.
 */

import {
  DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS,
  clampPlanMonths,
  planMonthsLowerFragment,
  planMonthsTitleFragment,
} from "@/lib/research/plan-months";

export const LOCAL_STRATEGY_SECTION_COUNT = 13 as const;

export type LocalStrategyReportSectionIndex =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13;

const SHARED_ROLE = [
  "ROLE: Local SEO strategist. OUTPUT: Markdown only. Prose: plain English, short paragraphs.",
  "KEYWORD STYLE: Use **bold** sparingly - like internal-link anchor emphasis: only important keywords, entities, services, and primary local query phrases. Do not bold every metric or clause; most text stays plain. QUOTE BAN: Do not use ASCII double-quote (U+0022) or apostrophe (U+0027) adjacent to emphasized keywords - bold spans must be **term** only, never with quotes inside or outside the bold. Do not use Markdown links [label](url) in narrative; plain URL or hostname if needed. DECODER: JSON may name dfs/gmb/gsc/perf/faq fields - never name third-party SEO vendors in client narrative.",
  "DATA: User message is L: (legend) + one compact JSON object. Use only facts supported by JSON (ls, dfs, gmb, gsc, perf when present, faq when present).",
  "When dfs.dataSource is dfs, describe as organic research data in client prose.",
  "Never invent business addresses, phone numbers, or review counts not present in gmb.",
  "For URLs in tables, prefer real URLs from ls.seedUrl and path patterns grounded in the seed domain; you may propose realistic slugs for example columns when JSON lacks a path.",
  "PIPE TABLES: Separator rows use three hyphens per cell (e.g. | --- | :--- |); never pad with long hyphen runs. Every table must include header, separator, and data rows.",
  "FORBIDDEN: do not output competitor-report headings (Pain Points, Traffic & Intent Gaps, Estimated Traffic Potential, Authority and Links, Keywords They Own).",
].join(" ");

function outputContract(section: LocalStrategyReportSectionIndex): string {
  if (section === 1) {
    return `SINGLE-SECTION OUTPUT: Pass 1 of ${LOCAL_STRATEGY_SECTION_COUNT}. Output ONLY the H1 line and opening narrative paragraphs (no ## headings yet).`;
  }
  return `SINGLE-SECTION OUTPUT: Pass ${section} of ${LOCAL_STRATEGY_SECTION_COUNT}. Output ONLY the content for this pass - no H1, no other sections.`;
}

function sectionBody(section: LocalStrategyReportSectionIndex, planMonths: number): string {
  const pm = clampPlanMonths(planMonths, DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS);
  const titleFrag = planMonthsTitleFragment(pm);
  const lowerFrag = planMonthsLowerFragment(pm);
  switch (section) {
    case 1:
      return [
        `First line must be exactly: \`# **Ascend & Expand: A ${titleFrag} Local SEO Blueprint**\` (bold phrase inside H1; the month count must match \`ls.planMonths\` in JSON).`,
        `Then 2–4 short paragraphs before any ##: tie ${lowerFrag} scope, geographic focus (use ls.geoLabel and client context), Google Business Profile + website location pages, and high-intent local searches (use dfs + gsc + gmb when present). Each paragraph: **bold** only primary local keywords and entities (KEYWORD STYLE); no quoted query examples.`,
      ].join(" ");
    case 2:
      return [
        "Start with exactly: `## The Foundational Pillars: Guiding Principles`",
        "Numbered list 1–4 with these exact bold labels:",
        "1. **Precision over Volume** - one tight sentence after the label; **bold** only the core keyword phrase (KEYWORD STYLE).",
        "2. **Entity Authority** - one tight sentence after the label; **bold** only the core keyword phrase (KEYWORD STYLE).",
        "3. **Technical Integrity** - one tight sentence after the label; **bold** only the core keyword phrase (KEYWORD STYLE).",
        "4. **User Intent Fulfillment** - one tight sentence after the label; **bold** only the core keyword phrase (KEYWORD STYLE).",
      ].join(" ");
    case 3:
      return [
        "Start with exactly: `## Core Strategy Components: The Engine of Growth`",
        "Numbered list 1–4 with these exact bold labels:",
        "1. **Hyper-Local Page Optimization**",
        "2. **Content Depth and Relevance**",
        "3. **Citation & GBP Synchronization**",
        "4. **Structured Data Implementation**",
        "After the list, one closing paragraph bridging to audits and content; **bold** primary keywords only (KEYWORD STYLE).",
        "Then exactly: `### Core Strategy Components: The Engine of Growth` (duplicate heading) followed by one paragraph on cross-linking existing content to new local pages (use dfs.seedKeywordSample and gsc queries for themes); **bold** example themes and page types only - no quotes around queries.",
      ].join(" ");
    case 4:
      return [
        "Start with exactly: `## Content Audit`",
        "One Markdown pipe table: columns exactly `Audit Category` | `Focus Area` | `Current Status/Action Required` | `Relevant KB Page Example`",
        "At least 4 data rows (no header-only). Use seed URL from ls.seedUrl for real KB examples where possible. In Description or Status cells, **bold** at most one keyword phrase per cell when helpful.",
      ].join(" ");
    case 5:
      return [
        "Start with exactly: `## Hyper-Local Website Location Pages (City Focused)`",
        "Intro paragraph with **bold** on primary local keywords only (KEYWORD STYLE), then bullets with these exact labels (bold label + colon + text; **bold** sparingly after each colon):",
        "- **Audit Existing Pages:**",
        "- **Target City Selection:**",
        "- **Unique Content Generation:**",
        "- **GBP Integration:**",
        "- **On-Page Optimization:**",
      ].join(" ");
    case 6:
      return [
        "Start with exactly: `## Foundational Content Strategy (City & Service Focus)`",
        "Intro paragraph with **bold** on primary keywords only (KEYWORD STYLE), then bullets:",
        "- **Service Page Enhancement:**",
        "- **Blog Content Mapping:**",
        "- **FAQ Integration:**",
        "- **Visual Content Indexing:**",
        "- **Future Content Planning:**",
      ].join(" ");
    case 7:
      return [
        "Start with exactly: `## Citation Management & Consistency`",
        "Intro paragraph with **bold** on primary keywords only (KEYWORD STYLE), then bullets:",
        "- **Audit Existing Citations:**",
        "- **High-Value Citation Acquisition:**",
        "- **Data Aggregator Submission:**",
        "- **Review Monitoring Strategy:**",
        "- **Consistency Enforcement:**",
      ].join(" ");
    case 8:
      return [
        "Start with exactly: `## Leveraging Schema Markup: A Deeper Dive into AI & Local Signals`",
        "Intro paragraph with **bold** on primary keywords only (KEYWORD STYLE), then bullets:",
        "- **LocalBusiness Schema Implementation:**",
        "- **Service & Product Schema:**",
        "- **FAQ Schema Deployment:**",
        "- **Image and Video Object Markup:**",
        "- **Review Snippet Markup:**",
      ].join(" ");
    case 9:
      return [
        "Start with exactly: `## AI Overviews (AIO) Triggering & Passage-Level Optimization`",
        "Intro paragraph with **bold** on primary keywords only (KEYWORD STYLE), then bullets:",
        "- **Question-Answer Formatting:**",
        "- **Passage Indexing Targets:**",
        "- **Structured Data for Summarization:**",
        "- **Authority Signals for AIO:**",
        "- **Content Clarity and Depth:**",
      ].join(" ");
    case 10:
      return [
        "Start with exactly: `## Local Entity Mapping And Near Me Strategy`",
        "Intro paragraph with **bold** on primary keywords only (KEYWORD STYLE), then a pipe table with columns:",
        "`Target Entity Type` | `Example Page Slug` | `Primary Money Page Target` | `Example Query`",
        "At least 4 data rows (neighborhood, building, landmark, suburb or similar).",
        "Then exactly: `### Local Entity Mapping And Near Me Strategy` + one paragraph on blog → near-me → money page internal linking with **bold** on primary page-type keywords only (KEYWORD STYLE).",
      ].join(" ");
    case 11:
      return [
        "Start with exactly: `## Site Speed Optimization`",
        "If JSON has no `perf` object: one short paragraph stating a speed sample audit was not available; skip table and bullets.",
        "When `perf` is present:",
        "1. Intro paragraph: cite perf.sampleSize and perf.methodologyNote; summarize overall site health from averaged desktop and mobile performance scores.",
        "2. Markdown pipe table with columns exactly: `Metric` | `Desktop avg` | `Mobile avg` | `Site health note`",
        "Rows (use perf.desktop and perf.mobile numeric fields only; round scores to whole numbers for category scores): Performance, Accessibility, Best Practices, SEO, FCP (ms), LCP (ms), CLS, TBT (ms), Speed Index (ms).",
        "Site health note per row: Good (performance score 90+, or TBT under 200ms, or CLS under 0.1 where applicable), Needs improvement (50-89 or middling vitals), Poor (under 50 or very high TBT).",
        "3. Subheading `### Priority fixes` then bullets referencing perf.worstPages URLs and the weakest metrics (especially high TBT or low performance score).",
        "4. Subheading `### What we will do` then bullets for remediation (reduce JS execution, image delivery, caching, render-blocking) tied to the metrics above.",
        "FORBIDDEN: invent scores not in perf JSON.",
      ].join(" ");
    case 12:
      return [
        "Start with exactly: `## FAQ Optimization`",
        "If JSON has no `faq` object: one short paragraph stating FAQ inventory was not available.",
        "When `faq` is present:",
        "1. Intro: faq.sampleSize pages crawled, faq.pagesWithFaq with visible FAQ, faq.totalQaPairs total Q/A pairs.",
        "2. Subheading `### FAQ content gaps` then bullets for pages missing FAQ or thin Q/A (use faq.pageSummaries gaps arrays and hasVisibleFaq).",
        "3. Subheading `### FAQ schema and discoverability` then bullets on FAQ schema deployment and alignment with gsc/dfs local queries when present.",
        "4. Subheading `### What we will do` then bullets: write or expand FAQs, add FAQ schema, consolidate duplicate blocks.",
        "FORBIDDEN: invent Q/A not supported by faq.pageSummaries.",
      ].join(" ");
    case 13:
      return [
        "Start with exactly: `## Task And Hours`",
        "One pipe table: `Category` | `Description` | `Hours`",
        "Exactly six rows with these Category cells (exact wording):",
        "Content Audit",
        "Local Profile Management",
        "Hyper-Local Page Development",
        "Core Service Page Refinement",
        "Citation & Link Building",
        "Technical SEO & Schema",
        "Description column: one short sentence each. When perf or faq blocks are present, reflect speed and FAQ work in Technical SEO & Schema and/or Core Service Page Refinement hours.",
        "Hours column: numeric hours per week estimates (qualitative, consistent with the plan - not random).",
      ].join(" ");
    default:
      return "";
  }
}

export function getLocalStrategyReportSectionSystemPrompt(
  section: LocalStrategyReportSectionIndex,
  planMonths: number = DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS,
): string {
  const pm = clampPlanMonths(planMonths, DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS);
  return [SHARED_ROLE, outputContract(section), sectionBody(section, pm)].join(" ");
}

export function getLocalStrategyReportSectionUserInstructions(section: LocalStrategyReportSectionIndex): string {
  return `Section ${section}/${LOCAL_STRATEGY_SECTION_COUNT} only. Ground claims in JSON.`;
}

export function stitchLocalStrategyReportSections(parts: string[]): string {
  return parts.map((p) => p.trim()).join("\n\n");
}

/** Required H2 headings in order (section 1 has no H2 - H1 only). */
export const LOCAL_STRATEGY_REQUIRED_H2 = [
  "The Foundational Pillars: Guiding Principles",
  "Core Strategy Components: The Engine of Growth",
  "Content Audit",
  "Hyper-Local Website Location Pages (City Focused)",
  "Foundational Content Strategy (City & Service Focus)",
  "Citation Management & Consistency",
  "Leveraging Schema Markup: A Deeper Dive into AI & Local Signals",
  "AI Overviews (AIO) Triggering & Passage-Level Optimization",
  "Local Entity Mapping And Near Me Strategy",
  "Site Speed Optimization",
  "FAQ Optimization",
  "Task And Hours",
] as const;

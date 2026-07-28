/**
 * OpenRouter: scraped page text → displayTitle, actionSummary, csv row fields.
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type {
  BacklinkBlogPitchOption,
  BacklinkFormFieldSuggestion,
  BacklinkFormSubmissionPartial,
  BacklinkSubmissionHowTo,
  BacklinkSubmissionHowToItem,
  BacklinkTileEnrichment,
} from "@/lib/backlink-research/backlink-tile-enriched";

const ENRICH_JSON_MAX_TOKENS = 8192;

function parseBlogPitchOptions(raw: unknown): BacklinkBlogPitchOption[] {
  if (!Array.isArray(raw)) return [];
  const out: BacklinkBlogPitchOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!keyword || !title) continue;
    const entity = typeof o.entity === "string" ? o.entity.trim() : "";
    const modifier = typeof o.modifier === "string" ? o.modifier.trim() : "";
    const fi = typeof o.featuredImage === "string" ? o.featuredImage.trim().toLowerCase() : "";
    const featuredImage =
      fi === "n" || fi === "y" || fi === "google-maps" ? fi : "y";
    out.push({ keyword, entity, title, modifier, featuredImage });
  }
  return out.slice(0, 12);
}

function parseFormSubmission(raw: unknown): BacklinkFormSubmissionPartial | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const subjectLine = typeof o.subjectLine === "string" ? o.subjectLine.trim() : "";
  const proposalMessage = typeof o.proposalMessage === "string" ? o.proposalMessage.trim() : "";
  const keywordTitleIdeasPlainList =
    typeof o.keywordTitleIdeasPlainList === "string" ? o.keywordTitleIdeasPlainList.trim() : "";
  const extra = o.extraFields;
  let extraFields: BacklinkFormFieldSuggestion[] | undefined;
  if (Array.isArray(extra)) {
    const acc: BacklinkFormFieldSuggestion[] = [];
    for (const item of extra) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      const label = typeof e.label === "string" ? e.label.trim() : "";
      const value = typeof e.value === "string" ? e.value.trim() : "";
      if (label) acc.push({ label, value });
    }
    if (acc.length > 0) extraFields = acc;
  }
  if (!subjectLine && !proposalMessage && !keywordTitleIdeasPlainList && !extraFields) return undefined;
  return {
    ...(subjectLine ? { subjectLine } : {}),
    ...(proposalMessage ? { proposalMessage } : {}),
    ...(keywordTitleIdeasPlainList ? { keywordTitleIdeasPlainList } : {}),
    ...(extraFields ? { extraFields } : {}),
  };
}

const LOOSE_EMAIL_RE = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i;

function parseSubmissionHowTo(raw: unknown): BacklinkSubmissionHowTo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  const emails: string[] = [];
  if (Array.isArray(o.submissionEmails)) {
    const seen = new Set<string>();
    for (const e of o.submissionEmails) {
      if (typeof e !== "string") continue;
      const t = e.trim();
      if (!LOOSE_EMAIL_RE.test(t)) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      emails.push(t);
    }
  }

  const items: BacklinkSubmissionHowToItem[] = [];
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const detail = typeof r.detail === "string" ? r.detail.trim() : "";
      if (!label || !detail) continue;
      if (label.length > 200) continue;
      if (detail.length > 1200) continue;
      items.push({ label, detail });
    }
  }

  if (emails.length === 0 && items.length === 0) return undefined;
  return {
    ...(emails.length > 0 ? { submissionEmails: emails } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    const withoutOpen = t.replace(/^```(?:json)?\s*/i, "");
    return withoutOpen.replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

function parseEnrichmentJson(content: string, pageTitleHint: string): BacklinkTileEnrichment | null {
  const raw = stripJsonFence(content);
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as {
    pageTitle?: unknown;
    displayTitle?: unknown;
    actionSummary?: unknown;
    csv?: unknown;
    blogPitchOptions?: unknown;
    formSubmission?: unknown;
    submissionHowTo?: unknown;
  };
  const pageTitleRaw = typeof o.pageTitle === "string" ? o.pageTitle.trim() : "";
  const displayTitleRaw = typeof o.displayTitle === "string" ? o.displayTitle.trim() : "";
  const actionSummary = typeof o.actionSummary === "string" ? o.actionSummary.trim() : "";
  const csvRaw = o.csv && typeof o.csv === "object" ? (o.csv as Record<string, unknown>) : null;
  if (!actionSummary || !csvRaw) return null;

  const keyword = typeof csvRaw.keyword === "string" ? csvRaw.keyword.trim() : "";
  const title = typeof csvRaw.title === "string" ? csvRaw.title.trim() : "";
  if (!keyword || !title) return null;

  const csv: Partial<CSVRow> & Pick<CSVRow, "keyword" | "title"> = { keyword, title };
  const str = (k: keyof CSVRow) => {
    const v = csvRaw[k as string];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  if (str("meta_description")) csv.meta_description = str("meta_description");
  if (str("modifier")) csv.modifier = str("modifier");
  if (str("prompt_modifier")) csv.prompt_modifier = str("prompt_modifier");
  if (str("keyword_focus")) csv.keyword_focus = str("keyword_focus");
  if (str("entity")) csv.entity = str("entity");
  if (str("featuredImage")) csv.featuredImage = str("featuredImage");
  if (str("rationale")) csv.rationale = str("rationale");
  if (str("keyword_questions_json")) csv.keyword_questions_json = str("keyword_questions_json");
  if (str("faq")) csv.faq = str("faq");
  if (str("origin")) csv.origin = str("origin");

  const pageTitle =
    pageTitleRaw ||
    pageTitleHint.trim() ||
    displayTitleRaw ||
    "";
  if (!pageTitle) return null;

  const displayTitle = displayTitleRaw || pageTitle;

  const blogPitchOptions = parseBlogPitchOptions(o.blogPitchOptions);
  const formSubmission = parseFormSubmission(o.formSubmission);
  const submissionHowTo = parseSubmissionHowTo(o.submissionHowTo);

  return {
    pageTitle,
    displayTitle,
    actionSummary,
    csv,
    ...(blogPitchOptions.length > 0 ? { blogPitchOptions } : {}),
    ...(formSubmission ? { formSubmission } : {}),
    ...(submissionHowTo ? { submissionHowTo } : {}),
  };
}

export async function enrichBacklinkTileFromPageText(args: {
  apiKey: string;
  model: string;
  pageUrl: string;
  pageText: string;
  pageTitleHint?: string;
  industry: string;
  serpSummary: string;
  /** User's connected site name; "Company" in guest-post subject template. */
  siteName?: string;
  signal?: AbortSignal;
}): Promise<BacklinkTileEnrichment | null> {
  const text =
    args.pageText.length > 16_000 ? `${args.pageText.slice(0, 16_000)}…` : args.pageText;

  const system = `You are a senior off-page SEO specialist reviewing a guest-post or "write for us" page from scraped text.
Return a single JSON object only, no markdown outside JSON.
Shape: {
  "pageTitle": string,
  "displayTitle": string,
  "actionSummary": string,
  "csv": object,
  "blogPitchOptions": [ { "keyword", "entity", "title", "modifier", "featuredImage" } ],
  "formSubmission": {
    "subjectLine": string,
    "proposalMessage": string,
    "keywordTitleIdeasPlainList": string,
    "extraFields": [ { "label": string, "value": string } ]
  },
  "submissionHowTo": {
    "submissionEmails": [ string ],
    "items": [ { "label": string, "detail": string } ]
  }
}
CRITICAL subject-line gate (run mentally before you write formSubmission.subjectLine):
1. Search the scraped **Page text** in the user message for ANY rule about the email subject or subject line (phrases like "subject line", "with the subject", "use subject", or a quoted subject example).
2. If the page gives ANY fixed wording, template, or quoted subject example (for example Guest Post Submission: [Your Topic]), formSubmission.subjectLine MUST follow ONLY that host pattern. Copy fixed words, colons, spacing, and terminal punctuation from the host wording. Replace topic placeholders such as [Your Topic] or {topic} with the **first** blogPitchOptions.title only. The final subjectLine must contain **zero** leftover bracket or brace placeholders.
3. When step 2 applies: **Forbidden** in subjectLine unless the host text explicitly demands those exact tokens there: the strings "Neo Digital", "Sean", prefixes like "Guest Post Pitch - Sean", or the connected client site name from Writer context. Put agency and client identity in proposalMessage instead unless the host instructions say otherwise.
4. Use the Flowbie Neo Digital subject fallback **only** when step 1 finds **no** subject-line requirement anywhere in the scraped page text.
- pageTitle: The real document title for this URL (as in the browser tab or meta title from the page). Not the article you propose to write.
- displayTitle: Optional 3–8 word subline; may repeat pageTitle if nothing else fits.
- actionSummary: 2–5 sentences a link builder needs: word count, topics, tone, submission steps, editor contact patterns, bio/dofollow rules. Imperative, plain language.
- csv: must include "keyword" (2–4 word SEO intent for the proposed post) and "title" (specific blog post title to pitch for bulk upload, not the host page title). Optional keys matching Flowbie bulk CSV: meta_description (150–160 chars), modifier, prompt_modifier (long instruction block for the writer), keyword_focus, entity, featuredImage ("y"|"n"|"google-maps"), rationale, keyword_questions_json (JSON string array of H2-driving questions), faq, origin (e.g. source URL note). Title and prompt_modifier must respect any guest-post word-count range, allowed topics, or tone constraints stated on the page when present.
- blogPitchOptions: required. Array of 5 to 10 objects. Same columns as Flowbie bulk-auto-generate template: keyword, entity, title, modifier, featuredImage. Each row is a distinct article idea that fits this host's niche and guest guidelines. featuredImage must be "y", "n", or "google-maps". Vary keywords, entities, and angles. modifier is a short writer note (like the template examples). Each row must align with stated word-count ranges, topic lists, banned angles, or formatting expectations on the page when the host gives them.
- formSubmission: required. Help the user paste into a contact or submission form on this site.
  - Host compliance (mandatory): If the page states rules for subject line, recipient or addressee, required opening or body structure, exact phrases, what belongs in the subject versus the body, attachments, or ordering (pitch versus full draft), those rules **override** every Flowbie default below for formSubmission and must be applied faithfully.
  - subjectLine: Short value for the email Subject field. Obey the **CRITICAL subject-line gate** above first. **Host-specified subjects win:** mirror the host template exactly and substitute only the topic portion per the gate. **Flowbie fallback (ONLY when the scraped page text has zero subject-line rules):** "Guest Post Pitch - Sean (Neo Digital) for " plus connected client site name exactly when Writer context includes it, else "Guest Post Pitch - Sean (Neo Digital)". Plain text, no markdown, no asterisks.
  - proposalMessage: Body for "Your message" textarea. Plain text only (no markdown, no # headings). **When the host mandates** specific content (word-count commitment for the article, bio length, links, bullet structure, sections to include, or a required opener), satisfy those requirements while staying truthful (Neo Digital, on behalf of the client, sean@neodigital.ca). **If a host-required greeting or opener conflicts with the Flowbie opener below, follow the host rule.** **Otherwise** the opening line must be: "Hi, I'm Sean, a backlink specialist at Neo Digital..." (use writer first name from context). When using that Flowbie opener, do **not** use "Hi there," "Hello," or other generic greetings without the name and role. Voice: reaching out **on behalf of** the connected client site (sean@neodigital.ca) - do **not** write as if Sean is an employee of the client. Include contact email sean@neodigital.ca. **Paragraph breaks (required):** Put a **blank line** between every short paragraph (use \\n\\n in the JSON string value). Each paragraph should be 1–4 sentences, punchy. Typical flow: (1) opening + who you represent, (2) contact email on its own paragraph or end of opening, (3) proposed title and what the article delivers, (4) why it fits the host or audience, (5) optional guideline/bio/link question, (6) which title is the best fit for this tile, (7) if other rows exist, a short line then the alternate-title dash list, (8) thank-you and closing. **Never** run the whole pitch as one wall of text. After the main pitch, say the **first** blogPitchOptions title is the right fit for **this tile**; if other rows exist, add that if another angle works better, here are other titles you could use, and list them using the **same one-line dash list** as keywordTitleIdeasPlainList (one idea per line, no line break inside an idea). Put a blank line **before** the first "- Keyword:" line. Use first blogPitchOptions row for exact title and modifier. **Closing:** After thanks, add a short day-appropriate wish that matches **Today** in the user message (examples: Monday "great start to your week"; Tue–Thu "great day" or "rest of your week"; Friday "great weekend"; Sat–Sun weekend wishes). Then one sentence that you hope to hear back and that other angles or ideas are welcome. No square brackets or placeholder labels. Under about 2500 characters.
  - keywordTitleIdeasPlainList: Plain text only. For each article idea from blogPitchOptions in the same order: **one line per idea** in this exact pattern: hyphen space, then "Keyword: " then the keyword, then comma space, then "Title: " then the title (all on one line, e.g. "- Keyword: dental marketing, Title: How to ..."). Real values only. Separate ideas with a single newline only (no blank lines). No markdown.
  - extraFields: optional. Only if the page text clearly shows form field labels (e.g. First Name, Phone). Each label as shown on the page; value can be a short placeholder like "Your first name" or empty. Do not invent real email addresses or phone numbers.
- submissionHowTo: optional. Only when the page states **how** to submit guest posts, pitches, or contributor content (not generic site footers). Use this to capture the host's own requirements so the user can follow them.
  - submissionEmails: Array of email addresses **explicitly printed on the page** for guest posts, article submissions, pitches, or editorial contact. Include every distinct address the page gives for that purpose. Use [] if none are stated. Never invent, guess, or pull from unrelated pages.
  - items: 1 to 14 rows. Each row is one distinct requirement, option, or fact the host states: what to send (topics vs full draft), author bio, links, turnaround, review process, etc. **label** must be short (2–12 words). Wording should **mirror** the page's headings or intent (e.g. "How to Submit Your Guest Post", "What to include", "Response time") - vary labels by site; do not reuse one rigid template for every domain. **detail** is one to three sentences, faithful to the scraped text. If one paragraph covers several points, split into multiple items with labels that fit that page's voice. When the page states a required email subject format or subject-line rule, include an items row (for example label "Subject line") with verbatim or faithful detail so the user can verify against generated copy.
  - Omit the whole **submissionHowTo** object if the page has no concrete submission path (no emails and no stated process).
Base keyword and proposed csv.title on the page guidelines and industry; do not invent URLs.`;

  const siteName = args.siteName?.trim();
  const today = new Date();
  const todayWeekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const todayLabel = today.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const writerBlock = siteName
    ? `Writer context (outreach agency, not the client):
- Sean is a backlink specialist at Neo Digital. Contact: sean@neodigital.ca
- Connected client site name (pitch for this brand; Sean does not work there): ${siteName}
- If the Page text specifies an email subject format, formSubmission.subjectLine MUST match that host format only. Do not put Neo Digital, Sean, or this client site name into subjectLine unless the Page text explicitly requires those words in the subject. Use this identity in proposalMessage instead.
`
    : `Writer context: Sean is a backlink specialist at Neo Digital (sean@neodigital.ca). No connected client site name was provided; use the Flowbie subjectLine fallback "Guest Post Pitch - Sean (Neo Digital)" only when the scraped page does not require a specific subject format, and pitch generically on behalf of "our client" until the user sets their site.
`;

  const user = `Industry focus: ${args.industry}

Target URL: ${args.pageUrl}

Today (for proposalMessage closing / day-appropriate sign-off): ${todayWeekday}, ${todayLabel}

SERP snippet (context only): ${args.serpSummary.slice(0, 800)}

${writerBlock}
Before JSON: if Page text below mentions how to write the subject line or shows a quoted subject example, formSubmission.subjectLine must follow that instruction exactly (topic from first blogPitchOptions title). Never use the Flowbie "Guest Post Pitch - Sean (Neo Digital)" subject when the page gives its own subject wording.

Page text:
${text}`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens: ENRICH_JSON_MAX_TOKENS,
    signal: args.signal,
    temperature: Math.min(REPORT_TEMPERATURE, 0.2),
    responseFormat: { type: "json_object" },
  });

  try {
    return parseEnrichmentJson(content, args.pageTitleHint ?? "");
  } catch {
    return null;
  }
}

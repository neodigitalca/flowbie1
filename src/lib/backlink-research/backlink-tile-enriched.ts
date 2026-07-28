/**
 * Enrichment layer: page body + OpenRouter → display title, action summary, CSV-ready row.
 */

import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { BacklinkTile } from "@/lib/backlink-research/openrouter-backlink-tiles";

/** Default entity/name column for bulk CSV when the model leaves it empty. */
export const DEFAULT_BACKLINK_BULK_ENTITY_NAME = "Sean";

/** Outreach is framed as this agency (not the connected client site). */
export const DEFAULT_BACKLINK_AGENCY_NAME = "Neo Digital";

/** Contact email for default guest-post copy. */
export const DEFAULT_BACKLINK_WRITER_EMAIL = "sean@neodigital.ca";

/** Max length for form "Your message" body (guest pitch). */
export const PROPOSAL_MESSAGE_MAX_CHARS = 2500;

export function entityForBulkCsvExport(raw: string | undefined | null): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || DEFAULT_BACKLINK_BULK_ENTITY_NAME;
}

/** One row matching `bulk-auto-generate-template.csv` (keyword, entity, title, modifier, featuredImage, publish_date_gmt). */
export type BacklinkBlogPitchOption = {
  keyword: string;
  entity: string;
  title: string;
  modifier: string;
  featuredImage: string;
  /** Optional schedule date for bulk upload (`YYYY-MM-DD` or ISO instant); see {@link parseBulkCsvPublishDateCell}. */
  publish_date_gmt?: string;
};

export type BacklinkFormFieldSuggestion = {
  label: string;
  value: string;
};

/** Filled values for contact / write-for-us forms (plain text only). */
export type BacklinkFormSubmission = {
  subjectLine: string;
  proposalMessage: string;
  /** Article ideas: one line each, "- Keyword: …, Title: …" (see buildKeywordTitlePlainListFromOptions). */
  keywordTitleIdeasPlainList: string;
  extraFields?: BacklinkFormFieldSuggestion[];
};

/** Model output; fields may be partial. */
export type BacklinkFormSubmissionPartial = {
  subjectLine?: string;
  proposalMessage?: string;
  keywordTitleIdeasPlainList?: string;
  extraFields?: BacklinkFormFieldSuggestion[];
};

/** One row of host-specific submission guidance; `label` mirrors the page (not a fixed template). */
export type BacklinkSubmissionHowToItem = {
  label: string;
  detail: string;
};

/**
 * AI-extracted from the page: where to send work and what the host asks for.
 * Omitted when the model finds nothing concrete.
 */
export type BacklinkSubmissionHowTo = {
  /** Emails shown for pitches, guest posts, or editorial (page text only; do not invent). */
  submissionEmails?: string[];
  /** Requirements, turnaround, what to attach, etc.; labels vary by site. */
  items?: BacklinkSubmissionHowToItem[];
};

/** Plain text for clipboard (emails + labeled rows). */
export function formatSubmissionHowToForCopy(h: BacklinkSubmissionHowTo): string {
  const parts: string[] = [];
  if (h.submissionEmails?.length) {
    parts.push(h.submissionEmails.join("\n"));
  }
  if (h.items?.length) {
    if (parts.length) parts.push("");
    for (const { label, detail } of h.items) {
      parts.push(`${label}\n${detail}`, "");
    }
  }
  return parts.join("\n").trim();
}

export type BacklinkTileEnrichment = {
  /** HTML / browser page title for this URL (what you read on the tab). */
  pageTitle: string;
  /** Optional short tagline under the page title (may echo page title). */
  displayTitle: string;
  /** Plain-language checklist: what the user must do for this site's guest guidelines. */
  actionSummary: string;
  /** Fields aligned with Flowbie bulk CSV / CSVRow. */
  csv: Partial<CSVRow> & Pick<CSVRow, "keyword" | "title">;
  /** 5–10 distinct article ideas for this host; bulk-template columns. */
  blogPitchOptions?: BacklinkBlogPitchOption[];
  /** Subject, message, and optional extra form fields for pasting into site forms. */
  formSubmission?: BacklinkFormSubmissionPartial;
  /** Host's own submission instructions (emails + flexible labeled rows). */
  submissionHowTo?: BacklinkSubmissionHowTo;
};

export type BacklinkEnrichStatus = "idle" | "fetching" | "done" | "error";

export type BacklinkTileRow = BacklinkTile & {
  enrichment?: BacklinkTileEnrichment | null;
  enrichStatus: BacklinkEnrichStatus;
  enrichError?: string;
};

export function initialBacklinkTileRows(tiles: BacklinkTile[]): BacklinkTileRow[] {
  return tiles.map((t) => ({
    ...t,
    enrichStatus: "idle" as const,
  }));
}

/** Prefer AI pitch list; otherwise one row from primary csv for display and download. */
export function getBlogPitchOptionsForDisplay(enrichment: BacklinkTileEnrichment): BacklinkBlogPitchOption[] {
  const raw = enrichment.blogPitchOptions?.filter((o) => o.keyword?.trim() && o.title?.trim()) ?? [];
  let rows: BacklinkBlogPitchOption[];
  if (raw.length > 0) {
    rows = raw;
  } else {
    const c = enrichment.csv;
    if (!c.keyword?.trim() || !c.title?.trim()) return [];
    const fi = (c.featuredImage ?? "y").toString().trim().toLowerCase();
    const featuredImage =
      fi === "n" || fi === "y" || fi === "google-maps" ? fi : "y";
    rows = [
      {
        keyword: c.keyword.trim(),
        entity: c.entity?.trim() ?? "",
        title: c.title.trim(),
        modifier: c.modifier?.trim() ?? "",
        featuredImage,
      },
    ];
  }
  return rows.map((o) => ({ ...o, entity: entityForBulkCsvExport(o.entity) }));
}

/** One line per idea: leading dash, keyword and title on the same line (readable in a textarea). */
export function formatKeywordTitleIdeaHumanBlock(keyword: string, title: string): string {
  return `- Keyword: ${keyword.trim()}, Title: ${title.trim()}`;
}

/** Plain text list from pitch rows (one line per idea, newline between lines). */
export function buildKeywordTitlePlainListFromOptions(options: BacklinkBlogPitchOption[]): string {
  return options
    .filter((o) => o.keyword?.trim() && o.title?.trim())
    .map((o) => formatKeywordTitleIdeaHumanBlock(o.keyword, o.title))
    .join("\n");
}

/** Angle line for the guest pitch: prefer modifier, else a concrete phrase from keyword (no brackets). */
export function pitchAngleSnippetFromOption(first: BacklinkBlogPitchOption): string {
  const m = first.modifier?.trim();
  if (m) return m.length > 350 ? `${m.slice(0, 347)}...` : m;
  const kw = first.keyword?.trim();
  if (kw) return `practical value for readers interested in ${kw}`;
  return "clear, actionable takeaways your readers can use";
}

/**
 * Replace bracket-style instructions in model text with the first pitch row (no placeholders left).
 */
export function normalizeProposalMessageBracketPlaceholders(
  proposalMessage: string,
  first: BacklinkBlogPitchOption | undefined,
): string {
  if (!first?.title?.trim()) return proposalMessage.trim();
  const title = first.title.trim();
  const angle = pitchAngleSnippetFromOption(first);
  let s = proposalMessage;
  s = s.replace(/\[Chosen Topic from Blog Pitch Options\]/gi, title);
  s = s.replace(/\[Chosen Topic\]/gi, title);
  s = s.replace(/\[briefly mention angle\/benefit\]/gi, angle);
  s = s.replace(/\[briefly mention[^\]]*\]/gi, angle);
  s = s.replace(/\[angle\/benefit\]/gi, angle);
  s = s.replace(/\[Topic\]/gi, title);
  s = s.replace(/\[Angle\]/gi, angle);
  return s.trim();
}

/**
 * Insert blank lines so the textarea reads in short, punchy paragraphs (model output often runs together).
 * Keeps single newlines inside the dash keyword/title list.
 */
export function normalizeProposalMessageParagraphSpacing(text: string): string {
  let s = text.replace(/\r\n/g, "\n").trim();
  if (!s) return s;

  // List block: blank line before first "- Keyword:" when it follows prose on the same flow
  s = s.replace(/([^\n])\n(- Keyword:)/g, "$1\n\n$2");
  s = s.replace(/([^\n])\n\n\n(- Keyword:)/g, "$1\n\n$2");
  // Colon then list (e.g. "explore: - Keyword:")
  s = s.replace(/([:;])\s*(- Keyword:)/g, "$1\n\n$2");

  const breakAfterPeriod = [
    "If another angle",
    "if another angle",
    "Here are other titles",
    "here are other titles",
    "Here are other ideas",
    "here are other ideas",
    "We believe",
    "This topic",
    "Our proposed",
    "We are flexible",
    "Thank you for considering",
    "Thanks for considering",
    "Thank you for your time",
    "Thank you for your consideration",
    "I hope you have",
    "I hope to hear",
    "We look forward",
  ];
  for (const phrase of breakAfterPeriod) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`([.!?])\\s+(${escaped})`, "g");
    s = s.replace(re, "$1\n\n$2");
  }

  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 3)}...`;
}

/**
 * Warm sign-off lines from local date: day-appropriate wish + hope to hear back / open to ideas.
 * Used for default proposal bodies; enrichment prompt asks the model for the same pattern.
 */
export function proposalClosingSignOff(now: Date = new Date()): string {
  const dow = now.getDay();
  let wish: string;
  if (dow === 0) {
    wish = "Hope you had a great weekend.";
  } else if (dow === 1) {
    wish = "Have a great start to your week.";
  } else if (dow === 5) {
    wish = "Have a great weekend.";
  } else if (dow === 6) {
    wish = "Hope you're having a good weekend.";
  } else if (dow >= 2 && dow <= 4) {
    const midWeek = [
      "Have a great day.",
      "Have a great rest of your week.",
      "Wishing you a good one today.",
    ];
    wish = midWeek[(now.getDate() + dow) % 3];
  } else {
    wish = "Have a great day.";
  }
  const followUp =
    "I hope to hear back from you. If you have other angles or ideas, I'm happy to explore them.";
  return `${wish}\n\n${followUp}`;
}

function writerFirstName(options?: FormSubmissionDisplayOptions): string {
  const w = (options?.writerName ?? DEFAULT_BACKLINK_BULK_ENTITY_NAME).trim();
  return w || DEFAULT_BACKLINK_BULK_ENTITY_NAME;
}

function agencyNameForPitch(options?: FormSubmissionDisplayOptions): string {
  const a = (options?.agencyName ?? DEFAULT_BACKLINK_AGENCY_NAME).trim();
  return a || DEFAULT_BACKLINK_AGENCY_NAME;
}

function writerEmailForPitch(options?: FormSubmissionDisplayOptions): string {
  const e = (options?.writerEmail ?? DEFAULT_BACKLINK_WRITER_EMAIL).trim();
  return e || DEFAULT_BACKLINK_WRITER_EMAIL;
}

/** Connected client / brand the user is securing links for (not the agency). */
function clientSiteLabel(options?: FormSubmissionDisplayOptions): string {
  const c = (options?.connectedSiteName ?? "").trim();
  return c || "our client";
}

/** Alternate pitch rows (same one-line dash format as article ideas). */
function formatAlternatePitchLines(alternates: BacklinkBlogPitchOption[]): string {
  return alternates
    .filter((o) => o.keyword?.trim() && o.title?.trim())
    .slice(0, 12)
    .map((o) => formatKeywordTitleIdeaHumanBlock(o.keyword, o.title))
    .join("\n");
}

/** Host brand for salutation (page title segment, else pitch entity/keyword). */
function hostLabelForDefaultPitch(
  enrichment: BacklinkTileEnrichment,
  first: BacklinkBlogPitchOption | undefined,
): string {
  const raw = enrichment.displayTitle?.trim() || enrichment.pageTitle?.trim() || "";
  if (raw) {
    const segment = (raw.split(/[|·]/)[0] ?? raw).trim();
    const cleaned = segment.replace(/\s*\([^)]*write for us[^)]*\)\s*/i, "").trim();
    if (cleaned.length) return clip(cleaned, 100);
  }
  const ent = first?.entity?.trim();
  if (ent) return clip(ent, 100);
  const kw = first?.keyword?.trim();
  if (kw) return clip(kw, 80);
  return "your site";
}

function buildDefaultProposalMessageFromPitch(
  first: BacklinkBlogPitchOption | undefined,
  alternatePitches: BacklinkBlogPitchOption[],
  actionSummary: string,
  enrichment: BacklinkTileEnrichment,
  options?: FormSubmissionDisplayOptions,
): string {
  const writer = writerFirstName(options);
  const agency = agencyNameForPitch(options);
  const email = writerEmailForPitch(options);
  const client = clientSiteLabel(options);
  const host = hostLabelForDefaultPitch(enrichment, first);
  const as = actionSummary.trim();

  const opening =
    `Hi, I'm ${writer}, a backlink specialist at ${agency}. I'm reaching out on behalf of ${client} to propose a guest post for ${host}.`;

  if (!first?.title?.trim()) {
    const paras = [
      opening,
      "",
      `You can reach me at ${email}.`,
      ...(as ? ["", as] : []),
      "",
      `Thanks for your time and consideration.`,
      "",
      proposalClosingSignOff(),
    ];
    const body = paras.join("\n").trim();
    return body.length > PROPOSAL_MESSAGE_MAX_CHARS
      ? `${body.slice(0, PROPOSAL_MESSAGE_MAX_CHARS - 3)}...`
      : body;
  }

  const title = first.title.trim();
  const angle = clip(pitchAngleSnippetFromOption(first), 280);

  const pitchParagraph =
    client === "our client"
      ? `I'd like to contribute "${title}." The article would explore ${angle}. It would offer readers clear, practical takeaways they can apply.`
      : `On behalf of ${client}, I'd like to contribute "${title}." The article would explore ${angle}. It would offer readers clear, practical takeaways they can apply.`;

  const altLines = formatAlternatePitchLines(alternatePitches);
  const primaryFitBlock = altLines
    ? `We think "${title}" is the right fit for this tile. If another angle works better for you, here are other titles we could use:\n\n${altLines}`
    : `We think "${title}" is the right fit for this tile.`;

  const core: string[] = [
    opening,
    "",
    `You can reach me at ${email}.`,
    "",
    pitchParagraph,
    "",
    primaryFitBlock,
    "",
    `This topic aligns with your audience at ${host}. I will follow your submission guidelines.`,
    "",
    `I'm planning for roughly 1200–1500 words, focused on benefits and practical value.`,
    "",
    `Could you share your policy on author bios and links?`,
  ];

  const parts: string[] = [...core];
  if (as) {
    parts.push("", as);
  }
  parts.push("", `Thanks for your time and consideration.`, "", proposalClosingSignOff());

  const full = parts.join("\n").trim();
  return full.length > PROPOSAL_MESSAGE_MAX_CHARS
    ? `${full.slice(0, PROPOSAL_MESSAGE_MAX_CHARS - 3)}...`
    : full;
}

export type FormSubmissionDisplayOptions = {
  /** Client site / brand the user is securing links for (not the agency). */
  connectedSiteName?: string;
  /** Writer first name; defaults to DEFAULT_BACKLINK_BULK_ENTITY_NAME. */
  writerName?: string;
  /** Outreach agency (default Neo Digital). */
  agencyName?: string;
  /** Contact email in pitch copy (default sean@neodigital.ca). */
  writerEmail?: string;
};

/**
 * Guest-post subject: writer + agency + optional client. Not "writer / client" as if employed by client.
 * Replaces bracket placeholders; if subject is empty, builds the default line.
 */
export function normalizeGuestPostSubjectLine(
  subjectLine: string,
  options?: FormSubmissionDisplayOptions,
): string {
  const writer = writerFirstName(options);
  const agency = agencyNameForPitch(options);
  const client = (options?.connectedSiteName ?? "").trim();
  const clientOrPlaceholder = client || "your site";

  let s = subjectLine.trim();
  if (!s) {
    if (client) {
      return `Guest Post Pitch - ${writer} (${agency}) for ${client}`;
    }
    return `Guest Post Pitch - ${writer} (${agency})`;
  }
  s = s.replace(/\[Your Name\/Company\]/gi, `${writer} (${agency}) for ${clientOrPlaceholder}`);
  s = s.replace(/\bYour Name\/Company\b/gi, `${writer} (${agency}) for ${clientOrPlaceholder}`);
  s = s.replace(/\[Company\]/gi, clientOrPlaceholder);
  s = s.replace(/\[Your Name\]/gi, writer);
  s = s.replace(/\[Agency\]/gi, agency);
  return s;
}

/**
 * Merge model `formSubmission` with fallbacks from pitches and playbook so copy/paste always has content.
 */
export function getFormSubmissionForDisplay(
  enrichment: BacklinkTileEnrichment,
  options?: FormSubmissionDisplayOptions,
): BacklinkFormSubmission {
  const pitches = getBlogPitchOptionsForDisplay(enrichment);
  const fromPitches = buildKeywordTitlePlainListFromOptions(pitches);
  const fs = enrichment.formSubmission;

  const listFromAi = fs?.keywordTitleIdeasPlainList?.trim() ?? "";
  const keywordTitleIdeasPlainList =
    listFromAi.length > 0 ? listFromAi : fromPitches;

  let subjectLine = fs?.subjectLine?.trim() ?? "";
  let proposalMessage = fs?.proposalMessage?.trim() ?? "";

  if (!subjectLine) {
    subjectLine = normalizeGuestPostSubjectLine("", options);
  } else {
    subjectLine = normalizeGuestPostSubjectLine(subjectLine, options);
  }

  const firstPitch = pitches[0];
  if (!proposalMessage) {
    proposalMessage = buildDefaultProposalMessageFromPitch(
      firstPitch,
      pitches.slice(1),
      enrichment.actionSummary,
      enrichment,
      options,
    );
  } else if (firstPitch) {
    proposalMessage = normalizeProposalMessageBracketPlaceholders(proposalMessage, firstPitch);
  }

  proposalMessage = normalizeProposalMessageParagraphSpacing(proposalMessage);

  if (proposalMessage.length > PROPOSAL_MESSAGE_MAX_CHARS) {
    proposalMessage = `${proposalMessage.slice(0, PROPOSAL_MESSAGE_MAX_CHARS - 3)}...`;
  }

  const extraFields = fs?.extraFields?.filter((e) => e.label?.trim()) ?? undefined;

  return {
    subjectLine,
    proposalMessage,
    keywordTitleIdeasPlainList,
    ...(extraFields?.length ? { extraFields } : {}),
  };
}

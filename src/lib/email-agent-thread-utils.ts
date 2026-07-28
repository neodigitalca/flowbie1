import { format, isValid, parseISO } from "date-fns";
import { marked } from "marked";
import type { AgentMailMessageDetail } from "@/lib/agentmail-api";
import { resolveToolMailboxForRouting } from "@/lib/email-assistant-api";

export const AUTO_PROCESSED_STORAGE_KEY = "flowbie-activity-auto-processed";

/** Max characters for the full thread transcript sent to classify / compose / reply (oldest messages dropped first if over budget). */
export const EMAIL_THREAD_MAX_CONTEXT_CHARS = 24_000;

const PER_MESSAGE_BODY_CAP = 5_000;

/**
 * Formats all messages in a thread (oldest first) for LLM context: inbound vs outbound, From, time, body.
 * Truncates per-message bodies, then drops whole oldest messages until under `maxTotalChars`.
 */
export function formatThreadTranscriptForPrompt(
  messages: AgentMailMessageDetail[],
  inboxAddress: string,
  maxTotalChars: number,
  /** When `inboxAddress` is an AgentMail UUID, pass `toolMailboxEmail` from GET /api/agentmail/config. */
  toolMailboxEmail?: string
): string {
  if (!messages.length) return "";
  const blocks = messages.map((m, i) => {
    const outbound = isOutboundMessage(m.from, inboxAddress, toolMailboxEmail);
    const role = outbound ? "Outbound (Flo)" : "Inbound";
    const from = (m.from || "").trim() || " - ";
    const ts = formatMessageTime(m.timestamp);
    let body = messageBody(m).trim();
    if (body.length > PER_MESSAGE_BODY_CAP) {
      body = `${body.slice(0, PER_MESSAGE_BODY_CAP)}\n…`;
    }
    return `[${i + 1}] ${role} - ${from} - ${ts}\n${body || "(empty)"}`;
  });
  let parts = [...blocks];
  let text = parts.join("\n\n");
  while (text.length > maxTotalChars && parts.length > 1) {
    parts.shift();
    text = parts.join("\n\n");
  }
  if (text.length > maxTotalChars) {
    text = `${text.slice(0, maxTotalChars)}\n…`;
  }
  return text.trim();
}

export function formatMessageTime(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = parseISO(ts);
    return isValid(d) ? format(d, "MMM d · HH:mm") : ts;
  } catch {
    return ts;
  }
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function extractPrimaryEmailFromFromField(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  const raw = m ? m[1] : from;
  const match = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return match ? normalizeEmail(match[0]) : null;
}

/**
 * Outbound if the message was sent from the monitored mailbox.
 * When `inboxAddress` is a UUID (no `@`), pass `toolMailboxEmail` so From `flowbie@…` matches.
 */
export function isOutboundMessage(
  from: string | undefined,
  inboxAddress: string,
  toolMailboxEmail?: string
): boolean {
  if (!from?.trim()) return false;
  if (!(inboxAddress || "").trim() && !(toolMailboxEmail || "").trim()) return false;
  const monitor = resolveToolMailboxForRouting(inboxAddress, toolMailboxEmail);
  if (!monitor.includes("@")) return false;
  const inboxN = normalizeEmail(monitor);
  const primary = extractPrimaryEmailFromFromField(from);
  if (primary) return primary === inboxN;
  return from.toLowerCase().includes(inboxN);
}

export function messageBody(m: AgentMailMessageDetail): string {
  const text = typeof m.text === "string" ? m.text.trim() : "";
  const extracted =
    typeof m.extractedText === "string" && m.extractedText.trim()
      ? m.extractedText.trim()
      : "";
  const preview = typeof m.preview === "string" ? m.preview.trim() : "";
  /** Prefer `text` over `extractedText`: AgentMail often puts full thread quotes only in extractedText. */
  if (text) return text;
  if (extracted) return extracted;
  if (preview) return preview;
  return "";
}

/**
 * Email HTML often includes `color:#111` / `color: rgb(...)` inline - that overrides the dark UI.
 * Remove color-related declarations so parent `text-white/90` applies.
 */
function cleanStyleAttrValue(inner: string): string {
  return inner
    .replace(/\s*color\s*:\s*[^;]+;?/gi, "")
    .replace(/\s*background(-color)?\s*:\s*[^;]+;?/gi, "")
    .replace(/\s*background-image\s*:\s*[^;]+;?/gi, "")
    .replace(/\s*caret-color\s*:\s*[^;]+;?/gi, "")
    .replace(/;\s*;/g, ";")
    .replace(/^;+|;+$/g, "")
    .trim();
}

function stripInlineColorsForDarkPreview(html: string): string {
  let s = html;
  s = s.replace(/\s+color\s*=\s*(["'])[^"']*\1/gi, "");
  s = s.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, inner: string) => {
    const cleaned = cleanStyleAttrValue(inner);
    return cleaned ? ` style="${cleaned}"` : "";
  });
  s = s.replace(/\sstyle\s*=\s*'([^']*)'/gi, (_m, inner: string) => {
    const cleaned = cleanStyleAttrValue(inner);
    return cleaned ? ` style='${cleaned}'` : "";
  });
  s = s.replace(/<font\b([^>]*)>/gi, (_full, attrs: string) => {
    const attrsClean = attrs.replace(/\s+color\s*=\s*(["'])[^"']*\1/gi, "").trim();
    return `<span${attrsClean ? ` ${attrsClean}` : ""}>`;
  });
  s = s.replace(/<\/font>/gi, "</span>");
  return s;
}

/** Remove images from email preview (no remote loads / tracking pixels in the dashboard). */
function stripImagesFromPreview(html: string): string {
  let s = html;
  s = s.replace(/<picture\b[\s\S]*?<\/picture>/gi, "");
  s = s.replace(/<img\b[^>]*>/gi, "");
  s = s.replace(/<image\b[^>]*>/gi, "");
  return s;
}

/**
 * Strip risky tags/attrs before injecting email HTML into the dashboard (preview only).
 */
export function sanitizeEmailPreviewHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  let s = html;
  s = stripImagesFromPreview(s);
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  s = s.replace(/<embed\b[^>]*>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  s = stripInlineColorsForDarkPreview(s);
  return s;
}

function extractEmailHtmlFragment(html: string): string {
  const t = html.trim();
  const body = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body?.[1]) return body[1].trim();
  return t;
}

/**
 * HTML for the Email tab message bubble: prefer multipart `html` (tables render like Gmail),
 * then `text` if it looks like HTML (AgentMail often sets `extractedText` to a stripped version - do not use that for layout).
 */
export function getEmailMessagePreviewHtml(m: AgentMailMessageDetail): string {
  const fromHtml = typeof m.html === "string" && m.html.trim() ? extractEmailHtmlFragment(m.html) : "";
  if (fromHtml) return sanitizeEmailPreviewHtml(fromHtml);

  const textPart = typeof m.text === "string" ? m.text.trim() : "";
  if (textPart && /^\s*</.test(textPart)) {
    return sanitizeEmailPreviewHtml(extractEmailHtmlFragment(textPart));
  }

  const body = messageBody(m).trim();
  if (!body) return "";

  if (/^\s*</.test(body)) {
    return sanitizeEmailPreviewHtml(extractEmailHtmlFragment(body));
  }

  const md = marked.parse(body, { async: false }) as string;
  return sanitizeEmailPreviewHtml(md);
}

export function loadAutoProcessedKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(AUTO_PROCESSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveAutoProcessedKeys(keys: Set<string>) {
  const arr = [...keys];
  sessionStorage.setItem(AUTO_PROCESSED_STORAGE_KEY, JSON.stringify(arr.slice(-4000)));
}

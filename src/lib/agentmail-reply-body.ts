import type { AgentMailReplyAttachment } from "@/lib/agentmail-api";
import { plainTextEmailBody } from "@/lib/flo-email-reply";

/** Compose-task / runAgent response shape before sending via `/api/agentmail/send`. */
export type ComposeLikeForReply = {
  text?: string | null;
  html?: string | null;
  attachments?: AgentMailReplyAttachment[] | null;
};

function htmlToPlainFallback(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * AgentMail `/send` requires non-empty plain `text` and/or `html`. Compose pipelines can return
 * empty `text` with no HTML; this always yields a non-empty `text` for the reply payload.
 */
export function ensureAgentMailReplyBody(composed: ComposeLikeForReply): {
  text: string;
  html?: string;
} {
  const rawText = String(composed.text ?? "").trim();
  const rawHtml =
    typeof composed.html === "string" && composed.html.trim() ? composed.html.trim() : undefined;

  let text = "";
  if (rawText) {
    const pt = plainTextEmailBody(rawText);
    text = typeof pt === "string" ? pt.trim() : "";
  }

  if (!text && rawHtml) {
    text = htmlToPlainFallback(rawHtml) || " - ";
  }
  if (!text && composed.attachments?.length) {
    text = "See attached files.";
  }
  if (!text) {
    text =
      "Flo could not attach a reply body (empty server response). Check VITE_MCP_API_BASE so the dashboard reaches the Flowbie API, and that the sender email is sent for GSC/WP lookup.";
  }

  return {
    text,
    ...(rawHtml ? { html: rawHtml } : {}),
  };
}

/** Stream / chit-chat path: never send an empty plain body to AgentMail. */
export function ensureAgentMailStreamPlainText(raw: string | undefined | null): string {
  const normalized = plainTextEmailBody(String(raw ?? "").trim());
  const s = typeof normalized === "string" ? normalized.trim() : "";
  return (
    s ||
    "Flo could not attach a reply body (empty stream). Check API keys and that the app reaches the Flowbie backend."
  );
}

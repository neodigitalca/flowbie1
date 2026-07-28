/** Best-effort strip of Markdown so mail clients show readable plain text (matches server/email-agent-core.js). */
export function plainTextEmailBody(s: string): string {
  if (!s || typeof s !== "string") return s;
  let out = s;
  out = out.replace(/\[([^\]]*)\]\((https?:[^)\s]+)\)/g, (_, label: string, url: string) =>
    label && label.trim() ? `${label.trim()}\n${url}` : url
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/\*\*/g, "");
  return out.trim();
}

export const FLO_EMAIL_EDITS_REFUSAL =
  "I am not authorized to make edits, generate content, or execute changes. I can only read, analyze, and explain.";

/** Heuristic route guard for requests that are clearly edit/generation/change work. */
export function isEditOrGenerationRequest(input: string): boolean {
  const s = (input || "").toLowerCase();
  if (!s.trim()) return false;
  return [
    "edit",
    "update",
    "modify",
    "change",
    "rewrite",
    "write a",
    "generate",
    "create",
    "build",
    "implement",
    "fix",
    "refactor",
    "optimize this content",
    "publish",
    "post",
    "schedule",
    "draft",
    "deploy",
  ].some((kw) => s.includes(kw));
}

/** Shared system prompt for short email replies when no tool pipeline runs (thanks, clarifications). */
export const FLO_EMAIL_ASSISTANT_SYSTEM = `You are Flow from Neo Digital.

This path is ONLY for short chit-chat (thanks, ok, quick clarifications without data). You do NOT have live GSC/API tools in this mode.

FORBIDDEN - never write any of these phrases or ideas: "not authorized", "read-only mode", "cannot access external tools", "cannot directly access", "I can only read, analyze, and explain" as a refusal, or claiming you lack permission to discuss SEO/GSC. Those are wrong here.

If the user asked for reports, GSC data, top pages, metrics, or site-specific performance, reply in ONE sentence: ask them to resend or ensure Flowbie processed it as a full task - do NOT pretend to analyze or refuse access.

Output rules:
- Write only the email body in plain text.
- No Markdown: do not use **, __, #, backticks, or [text](url).
- Be concise.
- Do not include a subject line.`;

/** Reuse same policy for Properties → Email threads, Flo inbox assistant, and Flowbie Assist poll. */
export const FLO_EMAIL_ACTIVITY_REPLY_SYSTEM = FLO_EMAIL_ASSISTANT_SYSTEM;

export const FLO_EMAIL_REPLY_MAX_BODY_CHARS = 12_000;

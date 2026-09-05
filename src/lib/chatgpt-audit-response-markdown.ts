export const CHATGPT_AUDIT_MARKDOWN_INSTRUCTION =
  "Keep the reply relatively short and scannable. Do not use horizontal line separators (--- or hr). " +
  "Put your full answer in one markdown code block only (```markdown ... ```).";

/** Setup question text only. OpenRouter composes the ChatGPT prompt in the audit worker. */
export function chatgptAuditPromptQuestion(question: string): string {
  return question.trim();
}

/** Pull markdown body out of a fenced code block for CSV storage. */
export function chatgptAuditResponseMarkdown(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  const match = trimmed.match(/```(?:markdown|md)?\s*\r?\n([\s\S]*?)```/i);
  if (match?.[1]) return match[1].trim();

  const generic = trimmed.match(/```\s*\r?\n([\s\S]*?)```/);
  if (generic?.[1]) return generic[1].trim();

  return trimmed;
}

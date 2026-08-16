/** Strip decorative quotes from Pulse Assist card markdown for readable display. */

function sanitizeAssistMarkdownLinks(body: string): string {
  if (!body) return "";
  return body.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
    let cleanLabel = label.trim();
    const suffix = ` (${url})`;
    if (cleanLabel.endsWith(suffix)) {
      cleanLabel = cleanLabel.slice(0, -suffix.length);
    }
    return `[${cleanLabel}](${url})`;
  });
}

export function normalizeAssistDisplayMarkdown(body: string): string {
  if (!body) return "";
  return sanitizeAssistMarkdownLinks(
    body
      .replace(/\*\*"([^"]+)"\*\*/g, "**$1**")
      .replace(/\*\*'([^']+)'\*\*/g, "**$1**"),
  );
}

export function normalizeAssistTopicLabel(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/\s+for\s+"([^"]+)"(\?)?/gi, " for $1$2")
    .replace(/\s+for\s+'([^']+)'(\?)?/gi, " for $1$2")
    .replace(/"([^"]+)"/g, "$1")
    .replace(/'([^']+)'/g, "$1")
    .trim();
}

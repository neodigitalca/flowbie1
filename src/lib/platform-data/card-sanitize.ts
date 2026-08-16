/** Remove relatedTopics:/links: footers and ## Related Topics / ## Links heading leaks from body markdown. */
export function stripStructuredFieldLeaks(body: string): string {
  const lines = body.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const trim = lines[i].trim();
    if (
      /^relatedTopics:\s*$/i.test(trim) ||
      /^links:\s*$/i.test(trim) ||
      /^##\s+Related Topics\s*$/i.test(trim) ||
      /^##\s+Links\s*$/i.test(trim)
    ) {
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return body;
}

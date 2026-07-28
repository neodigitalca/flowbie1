/**
 * Normalizes strategy markdown to bullet lines so the UI stays scannable
 * even when the model returns paragraphs.
 */

function isStructuralLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return true;
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^[-*+]\s/.test(t)) return true;
  if (/^\d+\.\s/.test(t)) return true;
  if (/^>\s/.test(t)) return true;
  if (/^```/.test(t)) return true;
  return false;
}

function bulletizeParagraph(block: string): string[] {
  const t = block.trim();
  if (!t) return [];
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) {
    return sentences.length ? [`- ${sentences[0]}`] : [];
  }
  return sentences.map((s) => `- ${s}`);
}

/**
 * Converts non-list paragraph blocks into `-` bullets; preserves headings,
 * existing lists, blockquotes, and fenced code starts.
 */
export function formatStrategyMarkdownAsBullets(markdown: string): string {
  const raw = markdown.trim();
  if (!raw) return "";

  const lines = raw.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let inFence = false;

  const flushPara = () => {
    if (para.length === 0) return;
    const block = para.join("\n");
    para = [];
    if (block.split("\n").every((l) => isStructuralLine(l) || l.trim() === "")) {
      out.push(block);
      return;
    }
    const first = block.split("\n")[0]?.trim() ?? "";
    if (isStructuralLine(first) && block.includes("\n")) {
      out.push(block);
      return;
    }
    const bullets = bulletizeParagraph(block);
    if (bullets.length) out.push(...bullets);
    else out.push(block);
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushPara();
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      out.push("");
      continue;
    }
    if (isStructuralLine(line)) {
      flushPara();
      out.push(line);
      continue;
    }
    para.push(line);
  }
  flushPara();

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

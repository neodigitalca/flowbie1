import { describe, expect, it } from "vitest";

function appendLine(lines: string[], line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return lines;
  if (lines.includes(trimmed)) return lines;
  if (lines[lines.length - 1] === trimmed) return lines;
  return [...lines, trimmed];
}

function mergeStepLines(lines: string[], stepLabels: string[]): string[] {
  let next = lines;
  for (const label of stepLabels) {
    next = appendLine(next, label);
  }
  return next;
}

describe("agent run progress log dedupe", () => {
  it("does not duplicate when steps grow on poll", () => {
    let lines = mergeStepLines([], ["Generating post ideas…", "Post 1/3"]);
    lines = mergeStepLines(lines, ["Generating post ideas…", "Post 1/3", "Post 2/3"]);
    expect(lines).toEqual(["Generating post ideas…", "Post 1/3", "Post 2/3"]);
  });
});

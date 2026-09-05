import { describe, expect, it } from "vitest";
import { mapFeatureToInstruction } from "@/lib/feature-mapping";

describe("mapFeatureToInstruction [DECISION]/[TRADEOFF]", () => {
  it("maps decision marker to chooser instruction", () => {
    const out = mapFeatureToInstruction("[DECISION]: If you have / choose table", "html");
    expect(out).toContain("[DECISION]");
    expect(out).toMatch(/Choose A when/i);
    expect(out).toContain("If {named constraint}, choose {option}");
  });

  it("maps recommendation marker to a Best-for extractable list", () => {
    const out = mapFeatureToInstruction("[RECOMMENDATION]: explicit site recommendation", "html");
    expect(out).toContain("[RECOMMENDATION]");
    expect(out).toContain("so what should I actually buy");
    expect(out).toContain("Best for {job}: {option}");
    expect(out).not.toMatch(/^\[RECOMMENDATION\]: explicit site recommendation$/i);
  });

  it("maps tradeoff marker to limitation instruction", () => {
    const out = mapFeatureToInstruction("[TRADEOFF]: when not worth it", "html");
    expect(out).toContain("[TRADEOFF]");
    expect(out).toMatch(/skip-this-when/i);
  });
});

describe("mapFeatureToInstruction [IMAGE]", () => {
  it("maps markdown image feature to HTML img embed instruction", () => {
    const url = "https://example.com/wp-content/uploads/2024/dental-crowns.png";
    const out = mapFeatureToInstruction(`[IMAGE]: ![dental crowns guide](${url})`, "html");
    expect(out).toContain("<figure");
    expect(out).toContain("<img");
    expect(out).toMatch(/NEVER use <a href/i);
  });

  it("maps markdown image feature to markdown embed instruction", () => {
    const url = "https://example.com/wp-content/uploads/x.png";
    const out = mapFeatureToInstruction(`[IMAGE]: ![alt text](${url})`, "markdown");
    expect(out).toContain(`![alt text](${url})`);
    expect(out).toMatch(/NEVER use \[text\]/i);
  });
});

describe("mapFeatureToInstruction [BLOCKQUOTE]", () => {
  it("maps markdown quotes to a > line and forbids the word wrapper", () => {
    const out = mapFeatureToInstruction("[BLOCKQUOTE]: entity fact about solar yield", "markdown");
    expect(out).toContain("[BLOCKQUOTE - MANDATORY]");
    expect(out).toContain("> We size each array for the roof");
    expect(out).toMatch(/wrapping the quote with the word blockquote/i);
    expect(out).not.toMatch(/^\[BLOCKQUOTE\]: entity fact/i);
  });

  it("maps illustrative blockquote to persona scenario in blockquote", () => {
    const out = mapFeatureToInstruction("[BLOCKQUOTE]: contrast", "html", {
      illustrativeContext: true,
    });
    expect(out).toContain("MANDATORY ILLUSTRATIVE");
    expect(out).toContain("<blockquote>");
    expect(out).not.toContain("<h3>Scenario:");
  });

  it("maps HTML quotes to blockquote tags and forbids the word wrapper", () => {
    const out = mapFeatureToInstruction("[BLOCKQUOTE]: entity fact about solar yield", "html");
    expect(out).toContain("<blockquote><p>sentence</p></blockquote>");
    expect(out).toMatch(/wrapping the quote with the word blockquote/i);
  });
});

describe("mapFeatureToInstruction tables", () => {
  it("uses [[LINK]] tokens in HTML table cells not raw hrefs", () => {
    const out = mapFeatureToInstruction("| Feature | Benefit |", "html");
    expect(out).toContain("[[LINK:query|anchor]]");
    expect(out).toContain("Never raw <a href>");
    expect(out).not.toContain('title="Page Title"');
  });

  it("uses [[LINK]] tokens in markdown table cells not markdown hrefs", () => {
    const out = mapFeatureToInstruction("| Feature | Benefit |", "markdown");
    expect(out).toContain("[[LINK:query|anchor]]");
    expect(out).not.toContain("[text](url)");
  });
});

describe("mapFeatureToInstruction [ILLUSTRATIVE]", () => {
  it("maps illustrative marker to mandatory h3 + blockquote persona contract", () => {
    const out = mapFeatureToInstruction("[ILLUSTRATIVE]: local scenario", "html");
    expect(out).toContain("[ILLUSTRATIVE - MANDATORY]");
    expect(out).toContain("ILLUSTRATIVE EXAMPLE");
    expect(out).toContain("decision matching Answer");
  });
});

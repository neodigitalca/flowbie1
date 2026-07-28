import { describe, it, expect } from "vitest";
import {
  buildSubMetroEntityUserMessage,
  parseSubMetroEntityHintsJson,
} from "../local-analysis-entity-openrouter";

describe("local-analysis-entity-openrouter", () => {
  it("parseSubMetroEntityHintsJson parses object and markdown-wrapped JSON", () => {
    const m = parseSubMetroEntityHintsJson(
      '{"hints":[{"clusterId":"a","entityHint":"East Cobb"},{"clusterId":"b","entityHint":"Canton Rd"}]}',
    );
    expect(m.get("a")).toBe("East Cobb");
    expect(m.get("b")).toBe("Canton Rd");
  });

  it("parseSubMetroEntityHintsJson extracts first JSON object from prose", () => {
    const m = parseSubMetroEntityHintsJson(
      'Here you go:\n```json\n{"hints":[{"clusterId":"x","entityHint":"Place One"}]}\n```',
    );
    expect(m.get("x")).toBe("Place One");
  });

  it("parseSubMetroEntityHintsJson ignores text after valid JSON (model adds trailing prose)", () => {
    const core = '{"hints":[{"clusterId":"a","entityHint":"East Cobb"}]}';
    const m = parseSubMetroEntityHintsJson(`${core}\n\nHope this helps!`);
    expect(m.get("a")).toBe("East Cobb");
  });

  it("buildSubMetroEntityUserMessage always includes four blocks with (none) when empty", () => {
    const msg = buildSubMetroEntityUserMessage([], "", "", "");
    expect(msg).toContain("--- Seeds (service keywords only; no geography) ---");
    expect(msg).toContain("[]");
    expect(msg).toContain("--- Grid scan (full markdown) ---\n(none)");
    expect(msg).toContain("--- Uploaded grid CSV (full file) ---\n(none)");
    expect(msg).toContain("--- Wikipedia granular place candidates ---\n(none)");
  });

  it("buildSubMetroEntityUserMessage adds multi-seed diversity instructions when N >= 2", () => {
    const msg = buildSubMetroEntityUserMessage(
      [
        { clusterId: "a", keyword: "k1" },
        { clusterId: "b", keyword: "k2" },
      ],
      "",
      "",
      "",
    );
    expect(msg).toContain("There are **2** seeds");
    expect(msg).toContain("**2 different** entityHint strings");
    expect(msg).toContain("**Required mapping:**");
  });

  it("buildSubMetroEntityUserMessage includes seed JSON and verbatim sections", () => {
    const msg = buildSubMetroEntityUserMessage(
      [{ clusterId: "c1", keyword: "solar install" }],
      "## grid",
      "col1,col2\na,b",
      "### Wiki Title\n- text",
    );
    expect(msg).toContain('"clusterId":"c1"');
    expect(msg).toContain("## grid");
    expect(msg).toContain("col1,col2");
    expect(msg).toContain("### Wiki Title");
  });
});

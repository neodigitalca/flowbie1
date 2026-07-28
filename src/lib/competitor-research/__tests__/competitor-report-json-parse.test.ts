import { describe, expect, it } from "vitest";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";

describe("parseAssistantJsonObject", () => {
  it("parses raw JSON", () => {
    expect(parseAssistantJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    expect(parseAssistantJsonObject("```json\n{\"x\":2}\n```")).toEqual({ x: 2 });
  });

  it("extracts first object when prose wraps JSON", () => {
    const wrapped = 'Here is the result:\n{"seed":[{"label":"A","members":["x"]}]}\nThanks.';
    expect(parseAssistantJsonObject(wrapped)).toEqual({
      seed: [{ label: "A", members: ["x"] }],
    });
  });

  it("uses first value only when valid JSON is followed by trailing text (V8 non-whitespace after JSON)", () => {
    const core = { strategyMarkdown: "x", keywordStrategyMarkdown: "y", questionsByKeyword: {}, sapRows: [] };
    const t = JSON.stringify(core) + "\n\n(assistant note: done)";
    expect(parseAssistantJsonObject(t)).toEqual(core);
  });

  it("balanced slice handles } inside string values", () => {
    const o = { hint: "use } in examples", n: 1 };
    const t = JSON.stringify(o) + " trailing";
    expect(parseAssistantJsonObject(t)).toEqual(o);
  });

  it("accepts trailing commas before ] or } (common invalid LLM JSON)", () => {
    const bad = '{"seed":[{"label":"A","members":["x","y",],},],"competitors":{},}';
    expect(parseAssistantJsonObject(bad)).toEqual({
      seed: [{ label: "A", members: ["x", "y"] }],
      competitors: {},
    });
  });

  it("inserts missing commas between adjacent string literals in arrays", () => {
    const bad = '{"seed":[{"label":"A","members":["x" "y"]}]}';
    expect(parseAssistantJsonObject(bad)).toEqual({
      seed: [{ label: "A", members: ["x", "y"] }],
    });
  });
});

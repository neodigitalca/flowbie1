import { describe, expect, it } from "vitest";
import {
  buildAgentRunOptimizerHash,
  buildAgentRunViewHash,
  isAgentRunOptimizerLocationHash,
  parseAgentRunIdFromHash,
  parseGeneratorSectionFromHash,
} from "@/lib/agent-runs/agent-run-optimizer-url";

describe("agent-run-optimizer-url", () => {
  it("builds hash with run id", () => {
    expect(buildAgentRunOptimizerHash(42)).toBe("generator/opt/agent-run/42");
    expect(buildAgentRunViewHash(42, "report")).toBe("generator/report/agent-run/42");
  });

  it("parses run id from hash", () => {
    expect(parseAgentRunIdFromHash("#generator/opt/agent-run/42")).toBe(42);
    expect(parseAgentRunIdFromHash("#generator/report/agent-run/42")).toBe(42);
    expect(parseAgentRunIdFromHash("generator/opt/agent-run/42")).toBe(42);
  });

  it("rejects invalid hashes", () => {
    expect(parseAgentRunIdFromHash("#generator/opt")).toBeNull();
    expect(parseAgentRunIdFromHash("#generator")).toBeNull();
    expect(parseAgentRunIdFromHash("#generator/opt/agent-run/0")).toBeNull();
  });

  it("detects agent optimizer hash", () => {
    expect(isAgentRunOptimizerLocationHash("#generator/opt/agent-run/7")).toBe(true);
    expect(isAgentRunOptimizerLocationHash("#generator/report/agent-run/7")).toBe(true);
    expect(isAgentRunOptimizerLocationHash("#generator/opt")).toBe(false);
  });

  it("parses generator section from hash", () => {
    expect(parseGeneratorSectionFromHash("#generator/opt/agent-run/1")).toBe("opt");
    expect(parseGeneratorSectionFromHash("#generator/report/agent-run/1")).toBe("report");
    expect(parseGeneratorSectionFromHash("#generator/bulk-csv/agent-run/1")).toBe("bulk-csv");
    expect(parseGeneratorSectionFromHash("#generator/flow")).toBe("flow");
  });
});

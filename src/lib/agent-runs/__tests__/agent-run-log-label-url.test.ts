import { describe, expect, it } from "vitest";
import { splitAgentRunLogLabelUrl } from "@/lib/agent-runs/agent-run-log-format";

describe("splitAgentRunLogLabelUrl", () => {
  it("pulls the working URL out of a progress label", () => {
    expect(
      splitAgentRunLogLabelUrl(
        "Working https://posh-outdoors.com/blog/nature-retreats/ (1/34)",
      ),
    ).toEqual({
      before: "Working ",
      url: "https://posh-outdoors.com/blog/nature-retreats/",
      after: " (1/34)",
    });
  });

  it("returns null when the label has no URL", () => {
    expect(splitAgentRunLogLabelUrl("Using saved research brief…")).toBeNull();
  });
});

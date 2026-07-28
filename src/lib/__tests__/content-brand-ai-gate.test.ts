import { describe, expect, it } from "vitest";
import { AI_BLOCKED_TOPIC_LABELS } from "../content-brand-ai-gate";

describe("AI_BLOCKED_TOPIC_LABELS", () => {
  it("includes Bali Blinds for the AI gate", () => {
    expect(AI_BLOCKED_TOPIC_LABELS.some((t) => /bali/i.test(t))).toBe(true);
  });
});

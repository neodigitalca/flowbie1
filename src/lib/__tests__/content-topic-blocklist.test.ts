import { describe, expect, it } from "vitest";
import {
  GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK,
  isBlockedContentTopicPhrase,
} from "../content-topic-blocklist";

describe("isBlockedContentTopicPhrase", () => {
  it("flags Bali blinds keywords and titles", () => {
    expect(isBlockedContentTopicPhrase("bali blinds")).toBe(true);
    expect(isBlockedContentTopicPhrase("Bali Blind Removal")).toBe(true);
    expect(
      isBlockedContentTopicPhrase("bali blinds removal", "Bali Blinds Removal Simplified And Safe"),
    ).toBe(true);
    expect(isBlockedContentTopicPhrase("Safely Remove Bali Blinds: A DIY Guide")).toBe(true);
  });

  it("allows unrelated blind topics", () => {
    expect(isBlockedContentTopicPhrase("roman shades", "Roman Shades Benefits")).toBe(false);
    expect(isBlockedContentTopicPhrase("blinds edmonton")).toBe(false);
  });
});

describe("GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK", () => {
  it("mentions Bali Blinds", () => {
    expect(GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK).toMatch(/Bali Blinds/i);
  });
});

import { describe, expect, it } from "vitest";
import { NEO_PULSE_BOT_EMAIL, pulseAssigneeIds, pulseMemberUserId } from "@/lib/chat-neo-pulse";

describe("pulse assignee helpers", () => {
  it("resolves Pulse bot member user id", () => {
    expect(
      pulseMemberUserId([
        { userId: 1, email: "human@example.com", isBot: false, displayName: "Human" },
        { userId: 42, email: NEO_PULSE_BOT_EMAIL, isBot: true, displayName: "NEO Pulse" },
      ]),
    ).toBe(42);
  });

  it("returns assignee ids array for Pulse", () => {
    expect(
      pulseAssigneeIds([{ userId: 42, email: NEO_PULSE_BOT_EMAIL, isBot: true, displayName: "NEO Pulse" }]),
    ).toEqual([42]);
  });

  it("returns undefined when Pulse is missing", () => {
    expect(pulseAssigneeIds([])).toBeUndefined();
  });
});

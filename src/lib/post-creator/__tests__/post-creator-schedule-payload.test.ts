import { describe, expect, it } from "vitest";
import {
  postCreatorPayloadToScheduleState,
  scheduleStateToPostCreatorPayload,
} from "@/lib/post-creator/post-creator-schedule-payload";
import { defaultPostCreatorExecutionPayload } from "@/lib/post-creator/post-creator-defaults";

describe("post-creator-schedule-payload", () => {
  it("coerces string customStartDate when saving schedule state", () => {
    const base = defaultPostCreatorExecutionPayload();
    const state = postCreatorPayloadToScheduleState(base);
    const saved = scheduleStateToPostCreatorPayload(
      { ...state, customStartDate: "2026-08-16" as unknown as Date },
      base,
    );
    expect(saved.scheduleCustomStartDate).toBe("2026-08-16");
    expect(saved.scheduleStartDay).toBe(16);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AgentRun } from "@/lib/agent-runs-types";
import type { WordPressSite } from "@/components/integrations/types";

vi.mock("@/lib/chatgpt-audit-api", () => ({
  submitChatGptAuditQuery: vi.fn(),
  finishChatGptAuditJob: vi.fn(),
  startNewChatForAuditJob: vi.fn(),
}));

vi.mock("@/lib/task-execution-resolve-bucket-urls", () => ({
  resolveTaskExecutionBucketUrls: vi.fn(async () => [
    "https://example.com/a",
    "https://example.com/b",
    "https://example.com/c",
  ]),
}));

import {
  createChatGptAuditMultiUrlDriverState,
  createChatGptAuditPresetDriverState,
  driveChatGptAuditMultiUrlQuestions,
  driveChatGptAuditPresetQuestions,
  resolveChatGptAuditQuestions,
  resolveChatGptAuditTargetUrls,
} from "@/lib/chatgpt-audit-preset-questions";
import {
  finishChatGptAuditJob,
  startNewChatForAuditJob,
  submitChatGptAuditQuery,
} from "@/lib/chatgpt-audit-api";
import { resolveTaskExecutionBucketUrls } from "@/lib/task-execution-resolve-bucket-urls";

describe("resolveChatGptAuditQuestions", () => {
  it("prefers contract auditQuestions over execution payload", () => {
    const run = {
      plan: { executionPayload: { auditQuestions: ["from payload"] } },
    } as AgentRun;
    expect(
      resolveChatGptAuditQuestions({ auditQuestions: ["from contract"] }, run),
    ).toEqual(["from contract"]);
  });

  it("falls back to execution payload when contract is empty", () => {
    const run = {
      plan: { executionPayload: { auditQuestions: ["  one  ", ""] } },
    } as AgentRun;
    expect(resolveChatGptAuditQuestions({}, run)).toEqual(["one"]);
  });
});

describe("driveChatGptAuditPresetQuestions", () => {
  beforeEach(() => {
    vi.mocked(submitChatGptAuditQuery).mockReset();
    vi.mocked(finishChatGptAuditJob).mockReset();
  });

  it("sends each setup question once after session is ready", async () => {
    vi.mocked(submitChatGptAuditQuery).mockResolvedValue({ ok: true, queryId: "q1" });
    const state = createChatGptAuditPresetDriverState();

    await driveChatGptAuditPresetQuestions({
      jobId: "job-1",
      questions: ["Question A", "Question B"],
      sessionReady: true,
      responseCount: 0,
      state,
    });

    expect(submitChatGptAuditQuery).toHaveBeenCalledTimes(2);
    expect(submitChatGptAuditQuery).toHaveBeenNthCalledWith(1, "job-1", "Question A", "");
    expect(submitChatGptAuditQuery).toHaveBeenNthCalledWith(2, "job-1", "Question B", "");
    expect(state.questionsSent).toBe(true);
    expect(finishChatGptAuditJob).not.toHaveBeenCalled();
  });

  it("does not resend questions on later polls", async () => {
    vi.mocked(submitChatGptAuditQuery).mockResolvedValue({ ok: true, queryId: "q1" });
    vi.mocked(finishChatGptAuditJob).mockResolvedValue({ ok: true });
    const state = createChatGptAuditPresetDriverState();

    await driveChatGptAuditPresetQuestions({
      jobId: "job-1",
      questions: ["Question A", "Question B"],
      sessionReady: true,
      responseCount: 0,
      state,
    });
    await driveChatGptAuditPresetQuestions({
      jobId: "job-1",
      questions: ["Question A", "Question B"],
      sessionReady: true,
      responseCount: 1,
      state,
    });

    expect(submitChatGptAuditQuery).toHaveBeenCalledTimes(2);
    expect(finishChatGptAuditJob).not.toHaveBeenCalled();
  });

  it("finishes once all replies are captured", async () => {
    vi.mocked(submitChatGptAuditQuery).mockResolvedValue({ ok: true, queryId: "q1" });
    vi.mocked(finishChatGptAuditJob).mockResolvedValue({ ok: true });
    const state = createChatGptAuditPresetDriverState();
    state.questionsSent = true;

    await driveChatGptAuditPresetQuestions({
      jobId: "job-1",
      questions: ["Question A", "Question B"],
      sessionReady: true,
      responseCount: 2,
      state,
    });

    expect(finishChatGptAuditJob).toHaveBeenCalledWith("job-1");
    expect(state.finishSent).toBe(true);
  });

  it("throws when submit fails", async () => {
    vi.mocked(submitChatGptAuditQuery).mockResolvedValue({ ok: false, error: "queue blocked" });
    const state = createChatGptAuditPresetDriverState();

    await expect(
      driveChatGptAuditPresetQuestions({
        jobId: "job-1",
        questions: ["Question A"],
        sessionReady: true,
        responseCount: 0,
        state,
      }),
    ).rejects.toThrow("queue blocked");
  });

  it("throws when finish fails", async () => {
    vi.mocked(finishChatGptAuditJob).mockResolvedValue({ ok: false, error: "finish failed" });
    const state = createChatGptAuditPresetDriverState();
    state.questionsSent = true;

    await expect(
      driveChatGptAuditPresetQuestions({
        jobId: "job-1",
        questions: ["Question A"],
        sessionReady: true,
        responseCount: 1,
        state,
      }),
    ).rejects.toThrow("finish failed");
  });
});

describe("driveChatGptAuditMultiUrlQuestions", () => {
  beforeEach(() => {
    vi.mocked(submitChatGptAuditQuery).mockReset();
    vi.mocked(finishChatGptAuditJob).mockReset();
    vi.mocked(startNewChatForAuditJob).mockReset();
  });

  it("audits each URL in a new chat and finishes after the last URL", async () => {
    vi.mocked(submitChatGptAuditQuery).mockResolvedValue({ ok: true, queryId: "q1" });
    vi.mocked(startNewChatForAuditJob).mockResolvedValue({ ok: true });
    vi.mocked(finishChatGptAuditJob).mockResolvedValue({ ok: true });
    const state = createChatGptAuditMultiUrlDriverState();
    const onUrlComplete = vi.fn(async () => {});

    await driveChatGptAuditMultiUrlQuestions({
      jobId: "job-1",
      urls: ["https://example.com/a", "https://example.com/b"],
      questions: ["Q1"],
      sessionReady: true,
      newChatReady: false,
      newChatUrl: null,
      responseCount: 0,
      state,
      onUrlComplete,
    });
    expect(submitChatGptAuditQuery).toHaveBeenCalledWith("job-1", "Q1", "https://example.com/a");

    await driveChatGptAuditMultiUrlQuestions({
      jobId: "job-1",
      urls: ["https://example.com/a", "https://example.com/b"],
      questions: ["Q1"],
      sessionReady: true,
      newChatReady: false,
      newChatUrl: null,
      responseCount: 1,
      state,
      onUrlComplete,
    });
    expect(onUrlComplete).toHaveBeenCalledWith("https://example.com/a", 1);
    expect(startNewChatForAuditJob).toHaveBeenCalledWith("job-1", "https://example.com/b");

    await driveChatGptAuditMultiUrlQuestions({
      jobId: "job-1",
      urls: ["https://example.com/a", "https://example.com/b"],
      questions: ["Q1"],
      sessionReady: true,
      newChatReady: true,
      newChatUrl: "https://example.com/b",
      responseCount: 1,
      state,
      onUrlComplete,
    });
    expect(submitChatGptAuditQuery).toHaveBeenCalledWith("job-1", "Q1", "https://example.com/b");

    await driveChatGptAuditMultiUrlQuestions({
      jobId: "job-1",
      urls: ["https://example.com/a", "https://example.com/b"],
      questions: ["Q1"],
      sessionReady: true,
      newChatReady: true,
      newChatUrl: "https://example.com/b",
      responseCount: 2,
      state,
      onUrlComplete,
    });
    expect(onUrlComplete).toHaveBeenCalledWith("https://example.com/b", 1);
    expect(finishChatGptAuditJob).toHaveBeenCalledWith("job-1");
  });
});

describe("resolveChatGptAuditTargetUrls", () => {
  const site = {
    id: "site-1",
    name: "Example",
    siteUrl: "https://example.com",
  } as WordPressSite;

  beforeEach(() => {
    vi.mocked(resolveTaskExecutionBucketUrls).mockClear();
  });

  it("defaults to the pages bucket when none is configured", async () => {
    const urls = await resolveChatGptAuditTargetUrls(site, {}, undefined);
    expect(urls).toHaveLength(3);
    expect(resolveTaskExecutionBucketUrls).toHaveBeenCalledWith(site, "pages", undefined);
  });

  it("prefers explicit targetUrls over bucket resolution", async () => {
    const site = {
      id: "site-1",
      name: "Example",
      siteUrl: "https://example.com",
    } as WordPressSite;
    const urls = await resolveChatGptAuditTargetUrls(
      site,
      { targetUrls: ["https://example.com/one"] },
      undefined,
    );
    expect(urls).toEqual(["https://example.com/one"]);
    expect(resolveTaskExecutionBucketUrls).not.toHaveBeenCalled();
  });

  it("throws when targetUrls is an empty list", async () => {
    const site = {
      id: "site-1",
      name: "Example",
      siteUrl: "https://example.com",
    } as WordPressSite;
    await expect(resolveChatGptAuditTargetUrls(site, { targetUrls: [] }, undefined)).rejects.toThrow(
      "Select at least one URL to audit.",
    );
  });
});

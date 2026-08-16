import type { WordPressSite } from "@/components/integrations/types";
import { loadApiKey, loadDataForSEOApiKey } from "@/lib/api";
import { initPostCreatorProof } from "@/lib/agent-runs/agent-run-post-creator-proof";
import {
  AGENT_RUN_STEP_KEYS,
  postCreatorHarnessStepKey,
  postCreatorRowStepKey,
} from "@/lib/agent-runs/agent-run-step-keys";
import type { AgentRunResumePoint } from "@/lib/agent-runs-types";
import type { PostCreatorBlockedRow } from "@/lib/post-creator/post-creator-cannibalization-agent";
import { runPostCreatorBulkRows } from "@/lib/post-creator/post-creator-bulk-runner";
import { buildPostCreatorSafeChecklistRows } from "@/lib/post-creator/post-creator-safe-checklist";
import {
  buildPostCreatorWordPressPosting,
  resolvePostCreatorSchedule,
} from "@/lib/post-creator/post-creator-schedule";
import type { PostCreatorExecutionPayload } from "@/lib/tasks-types";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

export type PostCreatorUploadedPost = {
  url: string;
  postId?: number;
  title?: string;
  scheduledFor?: string;
};

export type RunPostCreatorAgentHarnessArgs = {
  site: WordPressSite;
  payload: PostCreatorExecutionPayload;
  run?: import("@/lib/agent-runs-types").AgentRun;
  runId?: number;
  teamId?: number;
  isCancelled?: () => Promise<boolean>;
  resumePoint?: AgentRunResumePoint | null;
  onProgress?: (
    p: { label: string; step: number; total: number; stepKey?: string },
    resumePayload?: Record<string, unknown>,
  ) => void;
  onFilesChanged?: (files: import("@/lib/bulk-file-manager").BulkGeneratedFile[]) => void;
  onHarnessSection?: (payload: import("@/lib/bulk-auto-generate").BulkHarnessSectionPayload) => void;
  onContentBucketReady?: (
    files: import("@/lib/post-creator/post-creator-inventory-bucket").PostCreatorContentBucketFile[],
  ) => void;
};

export type PostCreatorAgentHarnessResult = {
  created: number;
  failed: number;
  postCount: number;
  urls: string[];
  scheduledDates: string[];
  uploadedPosts: PostCreatorUploadedPost[];
  blockedRows: PostCreatorBlockedRow[];
};

function parseResumeChecklistRows(payload: Record<string, unknown>): CSVRow[] | null {
  const rows = payload.checklistRows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows as CSVRow[];
}

function parseResumeUploadedPosts(
  payload: Record<string, unknown>,
): PostCreatorUploadedPost[] {
  const posts = payload.uploadedPosts;
  if (!Array.isArray(posts)) return [];
  return posts.filter((p): p is PostCreatorUploadedPost => Boolean(p && typeof p === "object" && "url" in p));
}

export async function runPostCreatorAgentHarness(
  args: RunPostCreatorAgentHarnessArgs,
): Promise<PostCreatorAgentHarnessResult> {
  const openRouterKey = loadApiKey()?.trim() || "";
  if (!openRouterKey) {
    throw new Error("Add an OpenRouter API key in Settings.");
  }
  const dataForSeoKey = loadDataForSEOApiKey()?.trim() || "";
  if (!dataForSeoKey) {
    throw new Error("Add a DataForSEO API key in Settings.");
  }
  if (!args.site.username?.trim() || !args.site.appPassword?.trim()) {
    throw new Error("WordPress credentials are required for post creation.");
  }

  const schedule = resolvePostCreatorSchedule(args.payload);
  const totalSteps = 2 + schedule.postCount;
  const resumePayload = args.resumePoint?.payload ?? {};
  const resumePhase = String(resumePayload.phase ?? "");
  const resumeRowIndex = typeof resumePayload.rowIndex === "number" ? resumePayload.rowIndex : 0;
  const savedChecklist = parseResumeChecklistRows(resumePayload);
  const priorUploaded = parseResumeUploadedPosts(resumePayload);

  if (args.runId != null) {
    initPostCreatorProof(
      args.runId,
      schedule.postCount,
      args.payload.featuredImage !== false,
    );
  }

  let checklistRows: CSVRow[] | null = savedChecklist;
  let blockedRows: PostCreatorBlockedRow[] = Array.isArray(resumePayload.blockedRows)
    ? (resumePayload.blockedRows as PostCreatorBlockedRow[])
    : [];
  let inventoryContext: Awaited<ReturnType<typeof buildPostCreatorSafeChecklistRows>>["inventory"];

  if (resumePhase === "bulk" && savedChecklist) {
    args.onProgress?.(
      {
        label: `Post ${resumeRowIndex + 1}/${schedule.postCount}: resuming…`,
        step: 2 + resumeRowIndex,
        total: totalSteps,
        stepKey: postCreatorRowStepKey(resumeRowIndex, "start"),
      },
      {
        phase: "bulk",
        rowIndex: resumeRowIndex,
        postCount: schedule.postCount,
        checklistRows: savedChecklist,
        uploadedPosts: priorUploaded,
        blockedRows,
        intraRowPhase: resumePayload.intraRowPhase,
      },
    );
  } else if (!savedChecklist) {
    args.onProgress?.(
      {
        label: "Loading content bucket…",
        step: 0,
        total: totalSteps,
        stepKey: AGENT_RUN_STEP_KEYS.contentBucket,
      },
      { phase: "ideation", postCount: schedule.postCount },
    );

    if (await args.isCancelled?.()) {
      throw new Error("Cancelled");
    }

    const checklist = await buildPostCreatorSafeChecklistRows({
      site: args.site,
      payload: { ...args.payload, postCount: schedule.postCount },
      onProgress: (message) => {
        args.onProgress?.(
          {
            label: message,
            step: 1,
            total: totalSteps,
            stepKey: AGENT_RUN_STEP_KEYS.ideas,
          },
          { phase: "ideation", postCount: schedule.postCount },
        );
      },
      onContentBucketReady: args.onContentBucketReady,
      isCancelled: args.isCancelled,
    });

    if (checklist.rows.length < schedule.postCount) {
      throw new Error(
        `OpenRouter returned ${checklist.rows.length}/${schedule.postCount} blog ideas.`,
      );
    }

    checklistRows = checklist.rows;
    blockedRows = checklist.blockedRows;
    inventoryContext = checklist.inventory;

    args.onProgress?.(
      {
        label: `Creating ${checklist.rows.length} posts…`,
        step: 2,
        total: totalSteps,
        stepKey: AGENT_RUN_STEP_KEYS.bulkStart,
      },
      {
        phase: "bulk",
        rowIndex: 0,
        postCount: schedule.postCount,
        checklistRows: checklist.rows,
        uploadedPosts: [],
        blockedRows,
      },
    );
  } else {
    args.onProgress?.(
      {
        label: `Creating ${savedChecklist.length} posts…`,
        step: 2,
        total: totalSteps,
        stepKey: AGENT_RUN_STEP_KEYS.bulkStart,
      },
      {
        phase: "bulk",
        rowIndex: resumeRowIndex,
        postCount: schedule.postCount,
        checklistRows: savedChecklist,
        uploadedPosts: priorUploaded,
        blockedRows,
      },
    );
  }

  if (!checklistRows?.length) {
    throw new Error("Post creator checklist is empty.");
  }

  if (await args.isCancelled?.()) {
    throw new Error("Cancelled");
  }

  const wordPressPosting = buildPostCreatorWordPressPosting(
    args.site,
    checklistRows.length,
    schedule,
    args.payload,
  );

  const bulkResult = await runPostCreatorBulkRows({
    site: args.site,
    rows: checklistRows,
    wordPressPosting,
    schedule,
    inventoryContext,
    startRowIndex: resumePhase === "bulk" ? resumeRowIndex : 0,
    priorUploadedPosts: priorUploaded,
    resumeIntraRowPhase:
      typeof resumePayload.intraRowPhase === "string" ? resumePayload.intraRowPhase : undefined,
    isCancelled: args.isCancelled,
    onFilesChanged: args.onFilesChanged,
    onHarnessSection: args.onHarnessSection,
    onArtifact:
      args.run && args.teamId
        ? async (input) => {
            const { persistAgentRunArtifact } = await import("@/lib/agent-runs/agent-run-artifacts");
            await persistAgentRunArtifact(args.teamId!, args.run!, input);
          }
        : undefined,
    onProgress: (p) => {
      const harnessMatch = p.message.match(/^Harness (\d+)\/(\d+):/);
      const stepKey = harnessMatch
        ? postCreatorHarnessStepKey(p.rowIndex, Number(harnessMatch[1]) - 1)
        : postCreatorRowStepKey(p.rowIndex, p.intraRowPhase ?? "progress");
      args.onProgress?.(
        { label: p.message, step: 2 + p.rowIndex, total: totalSteps, stepKey },
        {
          phase: "bulk",
          rowIndex: p.rowIndex,
          postCount: schedule.postCount,
          checklistRows,
          uploadedPosts: p.uploadedPosts ?? priorUploaded,
          blockedRows,
          intraRowPhase: p.intraRowPhase,
        },
      );
    },
  });

  return {
    created: bulkResult.created,
    failed: bulkResult.failed,
    postCount: schedule.postCount,
    urls: bulkResult.urls,
    scheduledDates: bulkResult.scheduledDates,
    uploadedPosts: bulkResult.uploadedPosts,
    blockedRows,
  };
}

export function postCreatorPayloadFromContract(
  contract: Record<string, unknown>,
): PostCreatorExecutionPayload {
  return {
    postCount: typeof contract.postCount === "number" ? contract.postCount : Number(contract.postCount) || 1,
    keywordSource:
      contract.keywordSource === "gsc" || contract.keywordSource === "manual"
        ? contract.keywordSource
        : "prompt",
    optionalPrompt: String(contract.optionalPrompt ?? "").trim() || undefined,
    entityMode:
      contract.entityMode === "auto" || contract.entityMode === "manual"
        ? contract.entityMode
        : "blank",
    entityValue: String(contract.entityValue ?? "").trim() || undefined,
    keywordValue: String(contract.keywordValue ?? "").trim() || undefined,
    titleTemplate: String(contract.titleTemplate ?? "").trim() || undefined,
    featuredImage: contract.featuredImage !== false,
    sitemapType: contract.sitemapType === "entity" ? "entity" : "post",
    postDestination:
      contract.postDestination === "draft" || contract.postDestination === "bank"
        ? contract.postDestination
        : "wordpress",
    scheduleTimesPerMonth:
      typeof contract.scheduleTimesPerMonth === "number"
        ? contract.scheduleTimesPerMonth
        : Number(contract.scheduleTimesPerMonth) || undefined,
    scheduleStartDay:
      typeof contract.scheduleStartDay === "number"
        ? contract.scheduleStartDay
        : Number(contract.scheduleStartDay) || undefined,
    scheduleStartTime: String(contract.scheduleStartTime ?? "").trim() || undefined,
    scheduleStaggerOptimized: contract.scheduleStaggerOptimized !== false,
  };
}

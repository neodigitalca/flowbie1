import { pulseAssistBuild } from "./api";
import type { WordPressSite } from "@/components/integrations/types";
import type { AssistCard, AssistRequestPayload } from "./types";
import { BUILD_STEPS } from "./stream";

export type BuildHarnessCallbacks = {
  onProgress: (completed: number, total: number, label: string) => void;
  onStepStatus: (index: number, status: "pending" | "running" | "done" | "error") => void;
  onPresent: (card: AssistCard) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBuildHarness(
  site: WordPressSite | null | undefined,
  payload: AssistRequestPayload,
  callbacks: BuildHarnessCallbacks,
): Promise<void> {
  callbacks.onProgress(0, 3, "Build");
  BUILD_STEPS.forEach((_, i) => {
    callbacks.onStepStatus(i, i === 0 ? "running" : "pending");
  });

  try {
    const card = await pulseAssistBuild(site, payload);
    if (card?.type === "automation_dispatch") {
      callbacks.onPresent(card);
      callbacks.onDone();
      return;
    }

    const isHarnessAction =
      (card?.type === "action" && card.details_drawer) ||
      (card?.type === "action" && card.action_result?.createdTaskIds?.length) ||
      (card?.type === "action" && card.action_result?.createdProjectId);

    if (card?.type === "action" && !card.details_drawer) {
      callbacks.onPresent({
        type: "error",
        title: card.title || "Build did not run",
        body: card.body || "Build did not execute.",
        confidence: "low",
      });
      callbacks.onDone();
      return;
    }

    if (!isHarnessAction) {
      for (let i = 0; i < 3; i++) callbacks.onStepStatus(i, i === 0 ? "error" : "pending");
      callbacks.onPresent({
        type: "error",
        title: card?.title || "Build did not run",
        body:
          card?.type === "plan"
            ? "Build did not execute the plan. Re-plan in Plan mode, then switch to Build."
            : card?.body || "Build did not produce an action result.",
        confidence: "low",
      });
      callbacks.onDone();
      return;
    }

    const milestones = [
      { completed: 1, running: 1 },
      { completed: 2, running: 2 },
      { completed: 3, running: -1 },
    ];
    for (let tick = 0; tick < milestones.length; tick++) {
      const m = milestones[tick];
      callbacks.onProgress(m.completed, 3, tick >= 2 ? "Build complete" : "Build");
      for (let i = 0; i < 3; i++) {
        let st: "pending" | "running" | "done" = "pending";
        if (m.running < 0) st = "done";
        else if (i < m.completed) st = "done";
        else if (i === m.running) st = "running";
        callbacks.onStepStatus(i, st);
      }
      await sleep(150);
    }

    callbacks.onPresent(card);
  } catch (err) {
    callbacks.onPresent({
      type: "error",
      title: "Build failed",
      body: err instanceof Error ? err.message : "Build request failed",
      confidence: "low",
    });
  } finally {
    callbacks.onDone();
  }
}

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../..");

describe("post creator server generator parity", () => {
  it("server harness delegates to runPostCreatorAgentHarness only", () => {
    const harnessPath = join(root, "src/lib/post-creator/post-creator-server-harness.ts");
    expect(existsSync(harnessPath)).toBe(true);
    const src = readFileSync(harnessPath, "utf8");
    expect(src).toContain("runPostCreatorAgentHarness");
    expect(src).not.toContain("generate_gsc_ideas_once");
    expect(src).not.toContain("Neo_Pulse_App");
  });

  it("PHP harness dispatches worker instead of ideation pipeline", () => {
    const phpPath = join(
      root,
      "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-run-harness-post-creator.php",
    );
    expect(existsSync(phpPath)).toBe(true);
    const src = readFileSync(phpPath, "utf8");
    expect(src).toContain("worker_dispatch");
    expect(src).toContain("Post_Creator_Worker::start_job");
    expect(src).not.toContain("generate_gsc_ideas_once");
    expect(src).not.toContain("Post_Creator_Inventory_Ideation");
    expect(src).not.toContain("Post_Creator_Row::run_phase");
  });

  it("removed parallel PHP generator pipeline files", () => {
    expect(
      existsSync(
        join(
          root,
          "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-run-post-creator-pipeline.php",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          root,
          "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-run-post-creator-inventory-ideation.php",
        ),
      ),
    ).toBe(false);
  });

  it("PHP worker client uses single configured URLs without fallbacks", () => {
    const phpPath = join(
      root,
      "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-run-post-creator-worker.php",
    );
    expect(existsSync(phpPath)).toBe(true);
    const src = readFileSync(phpPath, "utf8");
    expect(src).toContain("NEO_PULSE_APP_POST_CREATOR_WORKER_URL");
    expect(src).toContain("NEO_PULSE_APP_POST_CREATOR_API_BASE");
    expect(src).not.toContain("remote_worker_url_candidates");
    expect(src).not.toContain("LOCAL_DOMINATOR_WORKER_URL");
    expect(src).not.toContain("foreach");
    expect(src).not.toContain("FRONTEND_URL");
    expect(src).not.toContain("PUBLIC_API_BASE");
  });

  it("safe checklist has no ideation buffer or post-filter rejects", () => {
    const checklistPath = join(root, "src/lib/post-creator/post-creator-safe-checklist.ts");
    const src = readFileSync(checklistPath, "utf8");
    expect(src).not.toContain("postCount * 3");
    expect(src).not.toContain("ideationCount");
    expect(src).not.toContain("filterPostCreatorChecklistRows");
  });

  it("proof UI does not hardcode monthly-3-posts-run post count", () => {
    const proofPath = join(root, "src/lib/agent-runs/agent-run-post-creator-proof.ts");
    const src = readFileSync(proofPath, "utf8");
    expect(src).not.toMatch(/monthly-3-posts-run[\s\S]*return 3/);
  });

  it("server harness loads PHP preflight artifacts", () => {
    const harnessPath = join(root, "src/lib/post-creator/post-creator-server-harness.ts");
    const src = readFileSync(harnessPath, "utf8");
    expect(src).toContain("buildPostCreatorServerPreflightFromPayload");
    expect(src).toContain("serverPreflight");
    expect(src).not.toContain("scrapePromptBulkSiteKwJson");
  });

  it("PHP harness uses orchestratorPhase and never restarts from preflight on worker progress", () => {
    const phpPath = join(
      root,
      "wordpress-plugins/neo-pulse-app/includes/agent-runs/class-agent-run-harness-post-creator.php",
    );
    const src = readFileSync(phpPath, "utf8");
    expect(src).toContain("orchestratorPhase");
    expect(src).toContain("orchestrator_phase");
    expect(src).toContain("Unknown post creator orchestrator phase");
    expect(src).not.toContain("$server['phase'] = 'preflight'");
  });

  it("server harness preserves orchestratorPhase while worker reports progress", () => {
    const harnessPath = join(root, "src/lib/post-creator/post-creator-server-harness.ts");
    const src = readFileSync(harnessPath, "utf8");
    expect(src).toContain("mergeWorkerServerCheckpoint");
    expect(src).toContain("orchestratorPhase");
    expect(src).not.toContain("inBulk");
  });
});

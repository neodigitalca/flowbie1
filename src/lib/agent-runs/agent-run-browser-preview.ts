import type { AgentRun, AgentRunStepArtifact } from "@/lib/agent-runs-types";

const BROWSER_PREVIEW_STEP_KEY = "browser_preview";
const BROWSER_PREVIEW_NAMES = new Set(["browser-preview.png", "browser-preview.jpg"]);

export function findAgentRunBrowserPreviewArtifact(run: AgentRun): AgentRunStepArtifact | null {
  const steps = run.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    const artifacts = step.payload?.artifacts;
    if (!Array.isArray(artifacts)) continue;
    for (let j = artifacts.length - 1; j >= 0; j -= 1) {
      const item = artifacts[j] as AgentRunStepArtifact | undefined;
      if (!item?.url) continue;
      if (BROWSER_PREVIEW_NAMES.has(item.name) || step.stepKey === BROWSER_PREVIEW_STEP_KEY) {
        return item;
      }
    }
  }
  return null;
}

export function agentRunBrowserPreviewDataUrl(
  screenshotBase64: string,
  mime = "image/jpeg",
): string {
  const trimmed = screenshotBase64.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:${mime};base64,${trimmed}`;
}

export function agentRunBrowserPreviewBase64FromArtifact(
  artifact: AgentRunStepArtifact | null | undefined,
): string | null {
  const url = artifact?.url?.trim();
  if (!url?.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : null;
}

export function agentRunBrowserPreviewImageSrc(
  artifact: AgentRunStepArtifact | null | undefined,
  liveScreenshotBase64: string | null | undefined,
  cacheKey?: string | null,
): string | null {
  const live = liveScreenshotBase64?.trim();
  if (live) return agentRunBrowserPreviewDataUrl(live);

  const url = artifact?.url?.trim();
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  if (!cacheKey) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(cacheKey)}`;
}

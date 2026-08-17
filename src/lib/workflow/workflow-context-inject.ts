import type { WorkflowLibraryEntry, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

const MAX_BLOCK_CHARS = 12000;

export function buildWorkflowContextBlock(
  label: string,
  text: string,
  fileRefs?: WorkflowStepOutput["fileRefs"],
): string {
  const trimmed = text.trim().slice(0, MAX_BLOCK_CHARS);
  if (!trimmed) return "";
  const files =
    fileRefs && fileRefs.length
      ? `\nFiles:\n${fileRefs.map((file, index) => `${index + 1}. ${file.name}${file.url ? ` (${file.url})` : ""}`).join("\n")}`
      : "";
  return `=== WORKFLOW CONTEXT: ${label} ===\n${trimmed}${files}\n=== END WORKFLOW CONTEXT ===`;
}

export function mergeWorkflowContextBlocks(blocks: string[]): string {
  return blocks.filter(Boolean).join("\n\n");
}

export function workflowOutputsToContextBlocks(outputs: WorkflowStepOutput[]): string {
  return mergeWorkflowContextBlocks(
    outputs.map((output) => buildWorkflowContextBlock(output.label || output.variableKey, output.textPreview, output.fileRefs)),
  );
}

export function workflowLibraryToContextBlocks(entries: WorkflowLibraryEntry[]): string {
  return mergeWorkflowContextBlocks(
    entries.map((entry) => buildWorkflowContextBlock(entry.label || entry.key, entry.textPreview, entry.fileRefs)),
  );
}

export function appendWorkflowContextToSystemPrompt(systemPrompt: string, contextBlock: string): string {
  const block = contextBlock.trim();
  if (!block) return systemPrompt;
  return `${systemPrompt.trim()}\n\n${block}`;
}

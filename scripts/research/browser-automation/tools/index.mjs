import { TOOL_DEFINITIONS } from "./definitions.mjs";
import { executeBrowserTool } from "./executor.mjs";
import { filterToolsByPacks, PACK_TOOLS, resolveToolPacks } from "./tool-packs.mjs";

export {
  htmlInstructionsToText,
  BROWSER_VIEWPORT,
  capturePageScreenshot,
  collectPageState,
  sanitizeFilename,
} from "./shared.mjs";

export { resolveToolPacks, PACK_TOOLS, hostIsProxyFirst, isMultiPageAuditInstructions, extractMaxPagesFromInstructions } from "./tool-packs.mjs";
export { executeBrowserTool } from "./executor.mjs";

/** @param {string[]} packIds */
export function assembleTools(packIds) {
  return filterToolsByPacks(packIds, TOOL_DEFINITIONS);
}

/** Default full tool set for tests and backward compatibility. */
export const BROWSER_AUTOMATION_TOOLS = assembleTools([
  "core",
  "navigation",
  "interaction",
  "client_qa",
  "deliverables",
  "html_audit",
  "site_audit",
  "research",
  "forms",
]);

/**
 * @param {{ instructionsText?: string, browsePolicy?: object, targetUrl?: string, executionMode?: object }} input
 */
export function resolveToolsForSession(input) {
  const packs = resolveToolPacks(input);
  return { packs, tools: assembleTools(packs) };
}

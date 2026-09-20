import { streamChatCompletion, loadApiKey } from "@/lib/api";
import { ELEMENTOR_STRUCTURE_DESC } from "@/lib/elementor-optimizer";
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { ElementorHarnessKind } from "@/lib/elementor-page-content/detect-harness-slots";
import {
  assertSameTopLevelCount,
  parseElementorDataJson,
} from "@/lib/elementor-page-content/parse-elementor-section-outline";

export type ApplyHarnessToElementorArgs = {
  elementorJson: string;
  designBreakdown: string;
  harnessKind: ElementorHarnessKind;
  harnessHtml: string;
  focusKeyword?: string;
  targetSectionId?: string;
  siteId?: string;
  signal?: AbortSignal;
};

export type ApplyHarnessToElementorResult = {
  modifiedElementorData: unknown[];
  inserted: boolean;
  targetSectionId?: string;
};

function stripMarkdownFences(text: string): string {
  let s = text.trim();
  const open = s.match(/^```(?:json)?\s*\n?/i);
  if (open) s = s.slice(open[0].length);
  const close = s.match(/\n?```\s*$/);
  if (close) s = s.slice(0, s.length - close[0].length);
  return s.trim();
}

function extractRootObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function harnessKindLabel(kind: ElementorHarnessKind): string {
  switch (kind) {
    case "answer":
      return "Answer (direct-answer block with H2 Answer)";
    case "overview":
      return "Overview (AI Overview bullets block)";
    case "scenario":
      return "Scenario / illustrative local example block";
    case "links":
      return "Internal links inside text-editor widgets";
    case "wikipedia":
      return "Wikipedia link inside relevant text";
    case "headers":
      return "Section headings aligned to SEO outline";
    case "section-header":
      return "Single band heading (H2) SEO rewrite";
    case "section-content":
      return "Single band body copy SEO rewrite";
    case "full-page":
      return "Full page in-place Elementor SEO optimization";
    case "section":
      return "Single Elementor band copy optimization";
    default:
      return kind;
  }
}

export async function applyHarnessSectionToElementor(
  args: ApplyHarnessToElementorArgs,
): Promise<ApplyHarnessToElementorResult> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error("OpenRouter API key not set.");

  await ensureMasterInstructionsInMemory(args.siteId ?? null);
  const model = getResearchModel(args.siteId);
  const before = parseElementorDataJson(args.elementorJson);

  const systemPrompt = appendMasterInstructionsToSystemPrompt(
    `You apply content harness updates to an existing Elementor page JSON array.
${ELEMENTOR_STRUCTURE_DESC}

Rules (non-negotiable):
- Preserve every top-level container/section node (same count, same ids).
- Never add or remove top-level bands.
- Convert harness HTML into Elementor heading + text-editor widgets (or update existing widgets).
- If the harness block is missing, insert widgets inside the best inner container (after hero, before FAQ) using the design breakdown.
- Preserve unrelated widget ids, colors, layout, and images.
- Output ONLY valid JSON: {"modifiedElementorData":[...],"inserted":boolean,"targetSectionId":"optional-id"}`,
    args.siteId ?? null,
  );

  const userPrompt = [
    `Harness type: ${harnessKindLabel(args.harnessKind)}`,
    args.focusKeyword ? `Focus keyword: ${args.focusKeyword}` : "",
    args.targetSectionId ? `Target band id (when optimizing one section): ${args.targetSectionId}` : "",
    `\nDesign breakdown:\n${args.designBreakdown}`,
    `\nHarness HTML to apply:\n${args.harnessHtml}`,
    `\nElementor JSON:\n${args.elementorJson}`,
    `\nReturn JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { content } = await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 32768,
    topP: 1,
    signal: args.signal,
    onContentChunk: () => {},
  });

  const parsed = JSON.parse(stripMarkdownFences(extractRootObject(content || "{}"))) as {
    modifiedElementorData?: unknown;
    inserted?: boolean;
    targetSectionId?: string;
  };

  let modified: unknown[] | undefined;
  if (Array.isArray(parsed.modifiedElementorData)) {
    modified = parsed.modifiedElementorData;
  } else if (typeof parsed.modifiedElementorData === "string") {
    modified = parseElementorDataJson(parsed.modifiedElementorData);
  }

  if (!modified?.length) {
    throw new Error("Harness apply agent returned no modifiedElementorData array.");
  }

  assertSameTopLevelCount(before, modified);

  return {
    modifiedElementorData: modified,
    inserted: parsed.inserted === true,
    targetSectionId:
      typeof parsed.targetSectionId === "string" ? parsed.targetSectionId : args.targetSectionId,
  };
}

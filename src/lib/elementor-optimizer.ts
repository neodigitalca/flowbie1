/**
 * Elementor page optimizer: Agent 1 (design breakdown) + two-phase plan (Phase 1: summary+changes, Phase 2: modified data array).
 * Uses OpenRouter via streamChatCompletion. Phase 1 returns small JSON; Phase 2 streams raw array to avoid parse/truncation issues.
 */

import { streamChatCompletion } from './api';
import { loadApiKey } from './api';
import { getResearchModel } from './optimization-settings-storage';
import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from './master-instructions-storage';

const MAX_ELEMENTOR_CHARS = 80_000;
const ELEMENTOR_STRUCTURE_DESC = `
Elementor page data is a JSON array of elements. Each element has:
- id: string (optional; preserve when editing)
- elType: "section" | "column" | "widget"
- widgetType: string for widgets only. Common types: "heading", "text-editor", "button", "image", "spacer", "divider", "icon", "icon-box", "html"
- settings: object (content, _element_id, typography, color, etc.)
- elements: nested array of child elements (sections contain columns, columns contain widgets)
To add new UX elements: use the same structure - e.g. a new section with elType "section", elements: [ column with elType "column", elements: [ widget with elType "widget", widgetType "button" or "spacer", etc. ] ].
`;

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

function truncateForContext(json: string, maxChars: number): { payload: string; truncated: boolean } {
  if (json.length <= maxChars) return { payload: json, truncated: false };
  return {
    payload: json.slice(0, maxChars) + '\n... [truncated for context]',
    truncated: true,
  };
}

/** Remove markdown code fences so we can parse raw JSON. */
function stripMarkdownFences(text: string): string {
  let s = text.trim();
  const open = s.match(/^```(?:json)?\s*\n?/i);
  if (open) s = s.slice(open[0].length);
  const close = s.match(/\n?```\s*$/);
  if (close) s = s.slice(0, s.length - close[0].length);
  return s.trim();
}

/** Find the root JSON object: from first '{' to its matching '}' (ignore braces inside strings). */
function extractRootObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Find the root JSON array: from first '[' to its matching ']' (ignore brackets inside strings). */
function extractRootArray(text: string): string {
  const start = text.indexOf('[');
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = '"';
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === quote) {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

export interface OptimizationChange {
  type: string;
  description: string;
  elementId?: string;
}

export interface OptimizationPlan {
  summary: string;
  changes: OptimizationChange[];
  /** Full Elementor data as JSON string (or parsed array/object; caller may stringify). */
  modifiedElementorData?: string | unknown;
}

function tryParseOptimizationPlan(content: string): OptimizationPlan {
  const stripped = stripMarkdownFences(content);
  const root = extractRootObject(stripped);
  const cleaned = removeTrailingCommas(root);
  try {
    return JSON.parse(cleaned) as OptimizationPlan;
  } catch {
    try {
      const fallback = removeTrailingCommas(extractRootObject(content));
      return JSON.parse(fallback) as OptimizationPlan;
    } catch {
      try {
        const lastResort = removeTrailingCommas(stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1));
        return JSON.parse(lastResort) as OptimizationPlan;
      } catch {
        throw new Error(
          'Could not parse optimization plan JSON from model response. The model may have returned markdown or invalid JSON.'
        );
      }
    }
  }
}

/** Parse Phase 1 response: only { summary, changes }. Used for small JSON. */
function tryParsePhase1Plan(content: string): { summary: string; changes: OptimizationChange[] } {
  const stripped = stripMarkdownFences(content);
  const root = extractRootObject(stripped);
  const cleaned = removeTrailingCommas(root);
  try {
    const parsed = JSON.parse(cleaned) as { summary?: string; changes?: OptimizationChange[] };
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    };
  } catch {
    const fallback = removeTrailingCommas(extractRootObject(content));
    try {
      const parsed = JSON.parse(fallback) as { summary?: string; changes?: OptimizationChange[] };
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      };
    } catch {
      throw new Error('Could not parse Phase 1 plan (summary and changes). The model may have returned invalid JSON.');
    }
  }
}

function buildMcpToolsPromptSection(mcpToolsList: McpToolDef[] | undefined): string {
  if (!mcpToolsList?.length) return '';
  return `
Elementor MCP tools available (use these for context; to apply changes you will use update_page with elementor_data):
${JSON.stringify(mcpToolsList.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })))}
`;
}

/**
 * Agent 1: Produce a human-readable design breakdown of the Elementor JSON.
 */
export async function runDesignBreakdownAgent(
  elementorJson: string,
  options: { model?: string; siteId?: string; signal?: AbortSignal }
): Promise<string> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('OpenRouter API key not set. Set it in optimization settings or API key storage.');
  await ensureMasterInstructionsInMemory(options.siteId);
  const model = options.model ?? getResearchModel(options.siteId);
  const { payload, truncated } = truncateForContext(elementorJson, MAX_ELEMENTOR_CHARS);

  const systemPrompt = appendMasterInstructionsToSystemPrompt(
    `You are an expert at analyzing Elementor page builder layouts.
${ELEMENTOR_STRUCTURE_DESC}
Your task: given raw Elementor JSON, output a clear, structured breakdown suitable for a developer.
Include: number of sections, what each section contains (columns, widgets), widget types, and any notable content (headings, CTAs, images).
Use plain text with short headings. No code.${truncated ? '\n\nThe JSON is truncated; describe the structure and top-level sections you can see.' : ''}`,
    options.siteId ?? null
  );

  const userPrompt = `Analyze this Elementor page data and provide a design breakdown:\n\n${payload}`;

  const { content } = await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 4096,
    topP: 1,
    signal: options.signal,
    onContentChunk: () => {},
  });

  return content || 'No breakdown generated.';
}

/** Phase 1: Return only { summary, changes }. Small JSON, easy to parse. */
export async function runOptimizationPlanAgentPhase1(
  designBreakdown: string,
  elementorJson: string,
  options: {
    model?: string;
    siteId?: string;
    signal?: AbortSignal;
    mcpToolsList?: McpToolDef[];
  }
): Promise<{ summary: string; changes: OptimizationChange[] }> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('OpenRouter API key not set.');
  await ensureMasterInstructionsInMemory(options.siteId);
  const model = options.model ?? getResearchModel(options.siteId);
  const { payload, truncated } = truncateForContext(elementorJson, 60_000);
  const mcpSection = buildMcpToolsPromptSection(options.mcpToolsList);

  const systemPrompt = appendMasterInstructionsToSystemPrompt(
    `You are an expert at optimizing Elementor page layouts for clarity, conversion, and SEO.
${ELEMENTOR_STRUCTURE_DESC}${mcpSection}

Your task: output ONLY a JSON object with exactly two keys: "summary" and "changes".
- "summary": string, one paragraph overall optimization summary. MUST be non-empty. Describe what you will improve (e.g. hero hierarchy, CTAs, spacing, SEO).
- "changes": array of objects with "type" (string), "description" (string), and optional "elementId" (string). You MUST suggest at least 2 and preferably 4–8 specific changes (e.g. heading, spacing, cta, image, layout, seo). Never return an empty array.

Do NOT include any other keys. No modifiedElementorData, no markdown, no code fence, no explanation. Reply with ONLY the raw JSON object.`,
    options.siteId ?? null
  );

  const userPrompt = `Design breakdown:\n${designBreakdown}\n\nElementor JSON${truncated ? ' (truncated)' : ''}:\n${payload}\n\nOutput only the JSON object with "summary" (non-empty) and "changes" (at least 2 items).`;

  const { content } = await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    topP: 1,
    signal: options.signal,
    onContentChunk: () => {},
  });

  return tryParsePhase1Plan(content || '{}');
}

/** Phase 2: Stream and return the modified Elementor data as a JSON array. Uses phase1 changes so the model applies the same list. */
export async function runOptimizationPlanAgentPhase2(
  designBreakdown: string,
  elementorJson: string,
  options: {
    model?: string;
    siteId?: string;
    signal?: AbortSignal;
    onContentChunk?: (chunk: string) => void;
    mcpToolsList?: McpToolDef[];
    /** Phase 1 result so we tell the model exactly which changes to apply. */
    phase1Summary?: string;
    phase1Changes?: OptimizationChange[];
  }
): Promise<unknown[] | undefined> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('OpenRouter API key not set.');
  await ensureMasterInstructionsInMemory(options.siteId);
  const model = options.model ?? getResearchModel(options.siteId);
  const { payload, truncated } = truncateForContext(elementorJson, 60_000);
  const mcpSection = buildMcpToolsPromptSection(options.mcpToolsList);

  const changesList =
    options.phase1Changes?.length > 0
      ? options.phase1Changes.map((c) => `- ${c.type}: ${c.description}`).join('\n')
      : '';

  const systemPrompt = appendMasterInstructionsToSystemPrompt(
    `You are an expert at optimizing Elementor page layouts.
${ELEMENTOR_STRUCTURE_DESC}${mcpSection}

Your task: apply the EXACT changes listed below to the Elementor JSON, then output ONLY the full modified Elementor data as a valid JSON array. Same structure as the input (array of section elements). No wrapper, no summary, no other text. Start your response with [ and end with ]. No markdown, no \`\`\`.
${changesList ? `\nApply these changes:\n${changesList}\n` : ''}
Preserve all existing structure where you are not changing. Output the complete array so it can replace _elementor_data.`,
    options.siteId ?? null
  );

  const userPrompt = `Summary: ${options.phase1Summary || 'Improve the layout.'}\n\nDesign breakdown:\n${designBreakdown}\n\nElementor JSON${truncated ? ' (truncated - modify what you have)' : ''}:\n${payload}\n\nOutput ONLY the modified Elementor JSON array. Start with [ and end with ].`;

  const { content } = await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 32768,
    topP: 1,
    signal: options.signal,
    onContentChunk: options.onContentChunk ?? (() => {}),
  });

  const raw = (content || '').trim();
  if (!raw) return undefined;
  const stripped = stripMarkdownFences(raw);
  const trimmed = stripped.trim();
  const start = trimmed.indexOf('[');
  if (start < 0) return undefined;

  const extracted = extractRootArray(trimmed.slice(start));
  const cleaned = removeTrailingCommas(extracted);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    const fromLast = trimmed.slice(start, trimmed.lastIndexOf(']') + 1);
    try {
      const parsed = JSON.parse(removeTrailingCommas(fromLast));
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      try {
        const parsed = JSON.parse(cleaned + ']');
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
  }
}

/**
 * Build the modified Elementor layout from the approved checklist (summary + changes). Call this when user approves but Phase 2 didn't return data.
 */
export async function buildLayoutFromChecklist(
  elementorJson: string,
  changes: OptimizationChange[],
  summary: string,
  options: { model?: string; siteId?: string; signal?: AbortSignal; mcpToolsList?: McpToolDef[] }
): Promise<unknown[] | undefined> {
  await ensureMasterInstructionsInMemory(options.siteId);
  const changesList = changes.map((c) => `- ${c.type}: ${c.description}`).join('\n');
  const systemPrompt = appendMasterInstructionsToSystemPrompt(
    `You are an expert at optimizing Elementor page layouts.
${ELEMENTOR_STRUCTURE_DESC}${buildMcpToolsPromptSection(options.mcpToolsList)}

Apply EXACTLY these changes to the Elementor JSON, then output ONLY the full modified Elementor data as a valid JSON array. Same structure as the input (array of section elements). No wrapper, no summary, no other text. Start with [ and end with ]. No markdown.

Apply these changes:
${changesList}

Preserve all existing structure where you are not changing. Output the complete array so it can replace _elementor_data.`,
    options.siteId ?? null
  );

  const { payload, truncated } = truncateForContext(elementorJson, 60_000);
  const userPrompt = `Summary: ${summary}\n\nElementor JSON${truncated ? ' (truncated)' : ''}:\n${payload}\n\nOutput ONLY the modified Elementor JSON array. Start with [ and end with ].`;

  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('OpenRouter API key not set.');
  const { content } = await streamChatCompletion({
    apiKey,
    model: options.model ?? getResearchModel(options.siteId),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 32768,
    topP: 1,
    signal: options.signal,
    onContentChunk: () => {},
  });

  const raw = (content || '').trim();
  if (!raw) return undefined;
  const stripped = stripMarkdownFences(raw);
  const start = stripped.indexOf('[');
  if (start < 0) return undefined;
  const extracted = extractRootArray(stripped.slice(start));
  const cleaned = removeTrailingCommas(extracted);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    try {
      const parsed = JSON.parse(cleaned + ']');
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Orchestrates Phase 1 (summary + changes) and Phase 2 (modified Elementor array). Combines into OptimizationPlan.
 */
export async function runOptimizationPlanAgent(
  designBreakdown: string,
  elementorJson: string,
  options: {
    model?: string;
    siteId?: string;
    signal?: AbortSignal;
    onContentChunk?: (chunk: string) => void;
    mcpToolsList?: McpToolDef[];
  }
): Promise<OptimizationPlan> {
  const phase1 = await runOptimizationPlanAgentPhase1(designBreakdown, elementorJson, {
    model: options.model,
    siteId: options.siteId,
    signal: options.signal,
    mcpToolsList: options.mcpToolsList,
  });
  const phase2 = await runOptimizationPlanAgentPhase2(designBreakdown, elementorJson, {
    model: options.model,
    siteId: options.siteId,
    signal: options.signal,
    onContentChunk: options.onContentChunk,
    mcpToolsList: options.mcpToolsList,
    phase1Summary: phase1.summary,
    phase1Changes: phase1.changes,
  });
  return {
    summary: phase1.summary,
    changes: phase1.changes,
    modifiedElementorData: phase2,
  };
}

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { parsePostCreatorCannibalizationJson } from "@/lib/post-creator/post-creator-cannibalization-parse";
import {
  executePostCreatorCannibalTool,
  POST_CREATOR_CANNIBAL_TOOLS,
  type PostCreatorCannibalToolName,
  type PostCreatorInventoryCatalog,
} from "@/lib/post-creator/post-creator-cannibalization-tools";
import type { PostCreatorRowGateResult } from "@/lib/post-creator/post-creator-inventory-gate";

const CANNIBAL_SYSTEM = `You are a senior SEO strategist reviewing proposed NEW blog posts before upload.

Your job: block any row that would cannibalize existing site inventory (same search intent, same slug path, or near-duplicate topic).

Rules:
- Use the provided tools to look up inventory before deciding.
- Existing inventory wins. Automations must create net-new posts only, never overwrite or compete with live URLs.
- Block when keyword, title, or implied slug overlaps an existing post even with light rephrasing.
- Allow only clearly distinct search intents with no inventory overlap.
- Return final JSON only after tool lookups are complete.`;

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

function buildProposedCatalog(rows: PostCreatorRowGateResult[]): unknown[] {
  return rows.map((entry) => ({
    rowIndex: entry.rowIndex,
    keyword: entry.row.keyword?.trim() || "",
    title: entry.row.title?.trim() || "",
  }));
}

async function callWithTools(args: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}): Promise<{
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
}> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: args.signal,
    headers: openRouterWebAppHeaders(args.apiKey),
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      tools: POST_CREATOR_CANNIBAL_TOOLS,
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter cannibalization agent failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
      };
    }>;
  };

  const message = data.choices?.[0]?.message;
  const toolCalls = message?.tool_calls?.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: call.function.arguments,
  }));
  return { content: message?.content?.trim() ?? "", toolCalls };
}

export async function runPostCreatorCannibalizationAgent(args: {
  apiKey: string;
  model?: string;
  catalog: PostCreatorInventoryCatalog;
  rows: PostCreatorRowGateResult[];
  signal?: AbortSignal;
}): Promise<Map<number, { allow: boolean; reason: string; conflictingUrl?: string }>> {
  const okRows = args.rows.filter((row) => row.status === "ok");
  const decisions = new Map<number, { allow: boolean; reason: string; conflictingUrl?: string }>();
  if (okRows.length === 0) return decisions;

  for (const row of okRows) {
    decisions.set(row.rowIndex, { allow: true, reason: "Passed deterministic gate" });
  }

  const model = args.model ?? getResearchModel();
  const messages: ChatMessage[] = [
    { role: "system", content: CANNIBAL_SYSTEM },
    {
      role: "user",
      content: JSON.stringify({
        task: "post_creator_cannibalization_review",
        proposedRows: buildProposedCatalog(okRows),
        inventoryRowCount: args.catalog.rows.length,
        outputSchema: {
          decisions: [{ rowIndex: 0, allow: true, conflictingUrl: "optional url", reason: "string" }],
        },
        instructions:
          "For each proposed row, call inventory lookup tools as needed, then return JSON { decisions: [...] } for every rowIndex listed.",
      }),
    },
  ];

  const maxRounds = 6;
  for (let round = 0; round < maxRounds; round++) {
    const response = await callWithTools({ apiKey: args.apiKey, model, messages, signal: args.signal });

    if (response.toolCalls?.length) {
      messages.push({
        role: "assistant",
        content: response.content || null,
        tool_calls: response.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      });

      for (const call of response.toolCalls) {
        let parsedArgs: { query?: string } = {};
        try {
          parsedArgs = JSON.parse(call.arguments) as { query?: string };
        } catch {
          parsedArgs = {};
        }
        const toolName = call.name as PostCreatorCannibalToolName;
        const hits = executePostCreatorCannibalTool(args.catalog, toolName, parsedArgs);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ matches: hits.slice(0, 8) }),
        });
      }
      continue;
    }

    const parsed = parsePostCreatorCannibalizationJson(response.content);
    if (parsed.length > 0) {
      for (const decision of parsed) {
        decisions.set(decision.rowIndex, {
          allow: decision.allow,
          reason: decision.reason,
          conflictingUrl: decision.conflictingUrl,
        });
      }
      return decisions;
    }

    if (response.content) break;
  }

  const fallback = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model,
    system: CANNIBAL_SYSTEM,
    user: JSON.stringify({
      task: "post_creator_cannibalization_final_json",
      proposedRows: buildProposedCatalog(okRows),
      note: "Return JSON only: { decisions: [{ rowIndex, allow, reason, conflictingUrl? }] }",
    }),
    maxTokens: 3000,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    signal: args.signal,
  });

  for (const decision of parsePostCreatorCannibalizationJson(fallback.content)) {
    decisions.set(decision.rowIndex, {
      allow: decision.allow,
      reason: decision.reason,
      conflictingUrl: decision.conflictingUrl,
    });
  }

  return decisions;
}

export function applyCannibalDecisions(
  rows: PostCreatorRowGateResult[],
  decisions: Map<number, { allow: boolean; reason: string; conflictingUrl?: string }>,
): PostCreatorRowGateResult[] {
  return rows.map((entry) => {
    if (entry.status === "blocked") return entry;
    const decision = decisions.get(entry.rowIndex);
    if (!decision || decision.allow) return entry;
    return {
      ...entry,
      status: "blocked",
      reason: decision.reason,
      conflictingUrl: decision.conflictingUrl,
    };
  });
}

export type PostCreatorBlockedRow = {
  keyword: string;
  reason: string;
  conflictingUrl?: string;
};

export function blockedRowsFromGate(results: PostCreatorRowGateResult[]): PostCreatorBlockedRow[] {
  return results
    .filter((entry) => entry.status === "blocked")
    .map((entry) => ({
      keyword: entry.row.keyword?.trim() || entry.row.title?.trim() || `row ${entry.rowIndex + 1}`,
      reason: entry.reason,
      conflictingUrl: entry.conflictingUrl,
    }));
}

export function approvedRowsFromGate(results: PostCreatorRowGateResult[]): CSVRow[] {
  return results.filter((entry) => entry.status === "ok").map((entry) => entry.row);
}

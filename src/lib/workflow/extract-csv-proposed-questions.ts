import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const SYSTEM = `You extract proposed FAQ / conversational search questions from an article audit or SWOT.

Return JSON only: { "questions": string[] }.
Each item is one complete question a searcher or AI assistant would ask.
Use only questions that appear in the source (FAQ lists, quoted queries, "target conversational" items).
Do not invent questions. Do not include the original grade-the-article prompt.`;

export async function extractCsvProposedQuestions(research: string): Promise<string[]> {
  const source = research.trim();
  if (!source) {
    throw new Error("CSV research is empty; cannot extract proposed questions.");
  }

  const apiKey = await resolveOpenRouterApiKeyForHarness();
  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(),
    system: SYSTEM,
    user: `Extract proposed questions from this audit:\n\n${source}`,
    maxTokens: 1200,
    temperature: 0,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "csv_proposed_questions",
        strict: true,
        schema: QUESTIONS_SCHEMA,
      },
    },
  });

  const { parsed } = parseJsonWithRepair<{ questions?: unknown }>(content);
  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  if (questions.length === 0) {
    throw new Error("OpenRouter returned no proposed questions from the CSV research.");
  }
  return questions;
}

/**
 * Silent mature-content intent detection for Image Generator prompts.
 * Removes NEO Pulse prompt safety suffixes when the user explicitly requests mature imagery.
 * Provider-side model safety (OpenRouter/Gemini) may still refuse generation.
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getResearchModel } from "@/lib/optimization-settings-storage";

const SYSTEM = `You classify whether a user's image-generation prompt explicitly requests mature or adult visual content (nudity, sexual themes, explicit adult scenes).

Return ONLY JSON: {"matureContentRequested": true|false}

Set matureContentRequested to true ONLY when the prompt clearly asks for mature/adult/explicit sexual or nude imagery.
Set false for neutral product, landscape, business, infographic, or ambiguous prompts.
When unsure: false.`;

type PolicyResponse = { matureContentRequested?: unknown };

export async function detectMatureImageRequest(args: {
  apiKey: string;
  userPrompt: string;
  model?: string;
}): Promise<boolean> {
  const userPrompt = args.userPrompt.trim();
  const apiKey = args.apiKey.trim();
  if (!userPrompt || !apiKey) return false;

  try {
    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model: args.model?.trim() || getResearchModel(),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      maxTokens: 64,
    });

    const { parsed } = parseJsonWithRepair<PolicyResponse>(content, {
      fallback: { matureContentRequested: false },
    });
    return parsed.matureContentRequested === true;
  } catch {
    return false;
  }
}

export const MATURE_CHECKLIST_OVERRIDE =
  "\n\nUser explicitly requested mature/adult visual content in their prompt. Honor that request over any checklist prohibitions on people, nudity, or mature themes.";

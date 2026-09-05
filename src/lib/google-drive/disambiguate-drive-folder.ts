import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import type { DriveFolderMatch } from "@/lib/google-drive/drive-folder-api";

export type DisambiguateDriveFolderInput = {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl?: string;
  purpose: string;
  candidates: DriveFolderMatch[];
  signal?: AbortSignal;
};

export type DisambiguateDriveFolderResult = {
  folderId: string;
  reason?: string;
};

function parseDisambiguationJson(content: string): DisambiguateDriveFolderResult | null {
  try {
    const parsed = JSON.parse(content) as { folderId?: unknown; reason?: unknown };
    const folderId = String(parsed.folderId ?? "").trim();
    if (!folderId) return null;
    return {
      folderId,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}

export async function disambiguateDriveFolder(
  input: DisambiguateDriveFolderInput,
): Promise<DisambiguateDriveFolderResult> {
  if (input.candidates.length === 0) {
    throw new Error("No Google Drive folder candidates to disambiguate.");
  }
  if (input.candidates.length === 1) {
    return { folderId: input.candidates[0]!.folderId, reason: "single_match" };
  }

  const candidateLines = input.candidates
    .map((candidate, index) => `${index + 1}. id=${candidate.folderId} name=${candidate.name}`)
    .join("\n");

  const { content } = await callOpenRouterChatCompletion({
    apiKey: input.apiKey,
    model: input.model,
    temperature: 0,
    maxTokens: 300,
    responseFormat: { type: "json_object" },
    signal: input.signal,
    system:
      "Pick the best Google Drive folder for the client and purpose. Reply with JSON only: {\"folderId\":\"...\",\"reason\":\"...\"}. folderId must match one candidate id exactly.",
    user: [
      `Client: ${input.siteName}`,
      input.siteUrl ? `Site URL: ${input.siteUrl}` : "",
      `Purpose: ${input.purpose}`,
      "Candidates:",
      candidateLines,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const parsed = parseDisambiguationJson(content);
  if (!parsed) {
    throw new Error("Drive folder disambiguation returned invalid JSON.");
  }
  const allowed = new Set(input.candidates.map((candidate) => candidate.folderId));
  if (!allowed.has(parsed.folderId)) {
    throw new Error("Drive folder disambiguation picked a folder outside the candidate list.");
  }
  return parsed;
}

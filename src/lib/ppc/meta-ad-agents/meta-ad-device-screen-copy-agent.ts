import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  buildMetaDeviceScreenCopySystemPrompt,
  buildMetaDeviceScreenCopyUserPayload,
  parseMetaDeviceScreenCopy,
  type MetaAdDeviceScreenCopy,
} from "@/lib/ppc/meta-ad-device-screen-copy";
import { callMetaAdJsonCompletion } from "@/lib/ppc/meta-ad-openrouter-json";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";

const MAX_PARSE_ATTEMPTS = 3;

/** Device screen copy agent */
export async function runMetaAdDeviceScreenCopyAgent(options: {
  apiKey: string;
  model: string;
  creativeBrief: MetaAdCreativeBrief;
  siteName: string;
  localityCity?: string;
  focusKeyword?: string;
  signal?: AbortSignal;
}): Promise<MetaAdDeviceScreenCopy> {
  if (!options.siteName?.trim()) {
    throw new Error("Connected site name is required for device screen copy.");
  }
  if (!options.apiKey?.trim()) {
    throw new Error("OpenRouter API key is missing. Set it in Settings first.");
  }
  if (options.signal?.aborted) {
    throw new Error("Generation cancelled");
  }

  const baseUser = buildMetaDeviceScreenCopyUserPayload({
    creativeBrief: options.creativeBrief,
    siteName: options.siteName,
    localityCity: options.localityCity,
    focusKeyword: options.focusKeyword,
  });

  let lastParseError = "unknown validation error";

  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    const user =
      attempt === 0
        ? baseUser
        : [
            baseUser,
            "",
            `Previous output failed validation: ${lastParseError}`,
            "Return corrected JSON only with all required keys populated.",
          ].join("\n");

    const parsed = await callMetaAdJsonCompletion({
      apiKey: options.apiKey,
      model: options.model,
      system: buildMetaDeviceScreenCopySystemPrompt(options.siteName),
      user,
      maxTokens: getCompetitorReportMaxOutputTokens(options.model),
      temperature: attempt === 0 ? 0.25 : 0.1,
      errorLabel: "Device screen copy",
      signal: options.signal,
    });

    try {
      return parseMetaDeviceScreenCopy(parsed);
    } catch (err) {
      lastParseError = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_PARSE_ATTEMPTS - 1) {
        throw err instanceof Error ? err : new Error(lastParseError);
      }
    }
  }

  throw new Error(`Device screen copy failed validation (${lastParseError}).`);
}

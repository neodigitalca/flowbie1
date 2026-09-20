import { validateClientMap } from "../schema/client-map.mjs";
import { buildExtractClientUser, EXTRACT_CLIENT_MAP_SYSTEM } from "../prompts/extract-client-map.mjs";
import { chatJson } from "./openrouter.mjs";

export function htmlToText(html) {
  let out = "";
  let i = 0;
  let inTag = false;
  const lower = html;
  while (i < lower.length) {
    const ch = lower[i];
    if (ch === "<") {
      inTag = true;
      i += 1;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      out += " ";
      i += 1;
      continue;
    }
    if (!inTag) out += ch;
    i += 1;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * @param {string} url
 */
export async function fetchClientText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Client site fetch failed: ${res.status} ${url}`);
  }
  const html = await res.text();
  const text = htmlToText(html);
  if (!text) {
    throw new Error(`Client site returned empty text: ${url}`);
  }
  return text.slice(0, 40000);
}

/**
 * @param {{ clientUrl: string, leftoverIdentity?: unknown, apiKey: string, chat?: typeof chatJson }} input
 */
export async function extractClientMap(input) {
  const pageText = await fetchClientText(input.clientUrl);
  const raw = await (input.chat || chatJson)({
    apiKey: input.apiKey,
    system: EXTRACT_CLIENT_MAP_SYSTEM,
    user: buildExtractClientUser({
      clientUrl: input.clientUrl,
      pageText,
      leftoverIdentity: input.leftoverIdentity ?? {},
    }),
  });
  return validateClientMap(raw);
}

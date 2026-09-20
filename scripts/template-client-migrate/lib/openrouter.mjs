const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * @param {{ apiKey: string, model?: string, system: string, user: string }} input
 */
export async function chatJson(input) {
  if (!input.apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }
  const model = input.model || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
      "X-Title": "NEO Pulse template-client-migrate",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 400)}`);
  }
  const parsed = JSON.parse(body);
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned empty content");
  }
  return JSON.parse(content);
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export const CHANGELOG_SYSTEM_PROMPT = `You are the Neo Pulse One repository documenter.
Write a weekly changelog from the supplied commits only.
Do not invent commits, dates, or work that is not in the payload.
Do not write marketing fluff.
Return JSON only with these fields:
- title: string
- weekLabel: string
- summary: string
- highlights: string[]
- fixes: string[]
- chores: string[]
Put user-facing product or app changes in highlights.
Put bug fixes in fixes.
Put refactors, tests, dependencies, and internal work in chores.
Empty arrays are allowed when a bucket has no items.`;

const REQUIRED_STRINGS = ["title", "weekLabel", "summary"];
const REQUIRED_ARRAYS = ["highlights", "fixes", "chores"];

export function validateChangelogDoc(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("Changelog schema invalid: expected object");
  }
  for (const key of REQUIRED_STRINGS) {
    if (typeof doc[key] !== "string" || !doc[key].trim()) {
      throw new Error(`Changelog schema invalid: ${key} is required`);
    }
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(doc[key]) || doc[key].some((item) => typeof item !== "string")) {
      throw new Error(`Changelog schema invalid: ${key} must be a string array`);
    }
  }
  return {
    title: doc.title.trim(),
    weekLabel: doc.weekLabel.trim(),
    summary: doc.summary.trim(),
    highlights: doc.highlights.map((item) => item.trim()).filter(Boolean),
    fixes: doc.fixes.map((item) => item.trim()).filter(Boolean),
    chores: doc.chores.map((item) => item.trim()).filter(Boolean),
  };
}

export function renderChangelogMarkdown(doc) {
  const lines = [`# ${doc.title}`, "", doc.weekLabel, "", doc.summary];
  const sections = [
    ["Highlights", doc.highlights],
    ["Fixes", doc.fixes],
    ["Chores", doc.chores],
  ];
  for (const [heading, items] of sections) {
    if (items.length === 0) continue;
    lines.push("", `## ${heading}`, "");
    for (const item of items) {
      lines.push(`- ${item}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function changelogUserPayload(input) {
  return JSON.stringify(
    {
      repoName: input.repoName,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      timezone: "America/Edmonton",
      commits: input.commits,
    },
    null,
    2,
  );
}

export async function writeChangelogDoc(input) {
  const apiKey = String(input.apiKey ?? "").trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }
  const model = String(input.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL).trim();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/app/",
      "X-Title": "NEO Pulse One weekly changelog",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CHANGELOG_SYSTEM_PROMPT },
        { role: "user", content: changelogUserPayload(input) },
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
  return validateChangelogDoc(JSON.parse(content));
}

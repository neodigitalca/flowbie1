import fs from "node:fs";
import {
  buildSystemPrompt,
  buildUserText,
  parseCopilotResponse,
} from "./prompts.mjs";

function openRouterHeaders(apiKey, referer, appTitle) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": appTitle,
  };
}

function parseResponseBody(text, status) {
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(`OpenRouter returned HTML (${status})`);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`OpenRouter non-JSON (${status}): ${trimmed.slice(0, 160)}`);
  }
}

function pngPart(filePath, label) {
  const b64 = fs.readFileSync(filePath).toString("base64");
  return [
    { type: "text", text: label },
    {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${b64}` },
    },
  ];
}

export async function askCopilot({
  apiKey,
  model,
  referer,
  appTitle,
  transcript,
  mode,
  spoilerLevel,
  profile,
  gameTitle,
  processName,
  framePaths,
  priorExchanges,
  audioPath,
}) {
  if (!apiKey) throw new Error("OpenRouter API key missing");

  const system = buildSystemPrompt({ profile, mode, spoilerLevel });
  const frameLabels = framePaths.map((p, i) => {
    const name = p.split(/[/\\]/).pop();
    return `frame ${i + 1}/${framePaths.length}: ${name}`;
  });
  const userText = buildUserText({
    transcript,
    gameTitle,
    processName,
    profile,
    frameLabels,
    priorExchanges,
  });

  const content = [{ type: "text", text: userText }];
  for (let i = 0; i < framePaths.length; i += 1) {
    content.push(...pngPart(framePaths[i], frameLabels[i]));
  }

  if (audioPath && fs.existsSync(audioPath)) {
    const audioB64 = fs.readFileSync(audioPath).toString("base64");
    const ext = audioPath.toLowerCase().endsWith(".wav") ? "wav" : "webm";
    content.push({
      type: "input_audio",
      input_audio: { data: audioB64, format: ext },
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(apiKey, referer, appTitle),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${raw.slice(0, 300)}`);
  }

  const data = parseResponseBody(raw, response.status);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenRouter returned empty content");
  }
  return parseCopilotResponse(text);
}

export async function transcribeAudio({ apiKey, model, referer, appTitle, audioPath }) {
  if (!audioPath || !fs.existsSync(audioPath)) return "";
  const audioB64 = fs.readFileSync(audioPath).toString("base64");
  const ext = audioPath.toLowerCase().endsWith(".wav") ? "wav" : "webm";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(apiKey, referer, appTitle),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this audio to plain English. Return only the transcript text, no quotes.",
            },
            {
              type: "input_audio",
              input_audio: { data: audioB64, format: ext },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 500,
    }),
  });

  const raw = await response.text();
  if (!response.ok) return "";
  const data = parseResponseBody(raw, response.status);
  return (data?.choices?.[0]?.message?.content || "").trim();
}

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";



type MetaJsonCallOptions = {

  apiKey: string;

  model: string;

  system: string;

  user: string;

  maxTokens: number;

  temperature: number;

  errorLabel: string;

  signal?: AbortSignal;

};



const JSON_RETRY_SYSTEM_SUFFIX = [

  "\n\nReturn ONLY valid JSON matching outputSchema. No markdown fences. No prose before or after the JSON.",

  "\n\nCRITICAL: Output must be one JSON object only. Valid JSON syntax. No trailing commas. Double-quoted strings only.",

];



function parseModelJsonContent(content: unknown): unknown {

  if (typeof content !== "string") {

    throw new Error("empty model content");

  }

  if (content.length === 0) {

    throw new Error("empty model content");

  }

  return parseAssistantJsonObject(content);

}



async function repairMetaAdJsonContent(options: {

  apiKey: string;

  model: string;

  errorLabel: string;

  user: string;

  brokenContent: string;

  maxTokens: number;

  signal?: AbortSignal;

}): Promise<unknown> {

  const { content, finishReason, nativeFinishReason } = await callOpenRouterChatCompletion({

    apiKey: options.apiKey,

    model: options.model,

    system:

      "You repair invalid JSON from another model. Return ONLY the corrected JSON object. No markdown fences. No explanation.",

    user: [

      "Fix the broken JSON below so it satisfies the original task outputSchema.",

      "",

      "Original task:",

      options.user,

      "",

      "Broken output:",

      options.brokenContent.slice(0, 14000),

    ].join("\n"),

    maxTokens: options.maxTokens,

    temperature: 0,

    responseFormat: { type: "json_object" },

    signal: options.signal,

  });



  if (finishReason === "length" || nativeFinishReason === "MAX_TOKENS") {

    throw new Error(`${options.errorLabel} repair hit max_tokens (${options.maxTokens}).`);

  }



  return parseModelJsonContent(content);

}



export async function callMetaAdJsonCompletion(options: MetaJsonCallOptions): Promise<unknown> {

  if (typeof options.system !== "string" || options.system.length === 0) {

    throw new Error(`${options.errorLabel} missing system prompt.`);

  }

  if (typeof options.user !== "string" || options.user.length === 0) {

    throw new Error(`${options.errorLabel} missing user prompt.`);

  }

  if (!Number.isFinite(options.maxTokens) || options.maxTokens < 1) {

    throw new Error(`${options.errorLabel} missing maxTokens.`);

  }



  let lastContent = "";

  let lastError: unknown;



  for (let attempt = 0; attempt <= JSON_RETRY_SYSTEM_SUFFIX.length; attempt++) {

    const system =

      attempt === 0 ? options.system : `${options.system}${JSON_RETRY_SYSTEM_SUFFIX[attempt - 1]}`;

    const temperature = attempt === 0 ? options.temperature : 0.1;



    const { content, finishReason, nativeFinishReason } = await callOpenRouterChatCompletion({

      apiKey: options.apiKey,

      model: options.model,

      system,

      user: options.user,

      maxTokens: options.maxTokens,

      temperature,

      responseFormat: { type: "json_object" },

      signal: options.signal,

    });



    if (finishReason === "length" || nativeFinishReason === "MAX_TOKENS") {

      throw new Error(`${options.errorLabel} hit max_tokens (${options.maxTokens}).`);

    }



    lastContent = content;

    try {

      return parseModelJsonContent(content);

    } catch (err) {

      lastError = err;

    }

  }



  if (typeof lastContent === "string" && lastContent.length > 0) {

    try {

      return await repairMetaAdJsonContent({

        apiKey: options.apiKey,

        model: options.model,

        errorLabel: options.errorLabel,

        user: options.user,

        brokenContent: lastContent,

        maxTokens: options.maxTokens,

        signal: options.signal,

      });

    } catch (repairErr) {

      lastError = repairErr;

    }

  }



  const detail =

    lastError instanceof Error ? lastError.message : lastError ? String(lastError) : "unknown parse error";

  throw new Error(`${options.errorLabel} failed after JSON repair (${detail.slice(0, 160)}).`);

}



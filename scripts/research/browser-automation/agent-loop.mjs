import {
  BROWSER_VIEWPORT,
  capturePageScreenshot,
  collectPageState,
  executeBrowserTool,
  resolveToolsForSession,
} from "./tools.mjs";
import { detectBlocked, attachBlockResponseListener } from "./block-detect.mjs";
import { fetchSerpOrganic } from "./serp-dfs.mjs";
import {
  detectVisionNavStuck,
  extractMaxPagesFromInstructions,
  resolveExecutionMode,
} from "./execution-mode.mjs";

const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";
const MAX_ROUNDS = 20;
const SETTLE_MS = 700;
const NO_PROGRESS_MAX_ROUNDS = 6;

function pickOpenRouterKey(env) {
  return String(
    env.OPENROUTER_API_KEY ??
      env.NEO_PULSE_APP_OPENROUTER_API_KEY ??
      env.OPEN_ROUTER_API_KEY ??
      "",
  ).trim();
}

function pickVisionModel(env) {
  return String(
    env.BROWSER_AUTOMATION_VISION_MODEL ??
      env.OPENROUTER_VISION_MODEL ??
      env.OPENROUTER_MODEL ??
      env.NEO_PULSE_APP_OPENROUTER_MODEL ??
      DEFAULT_VISION_MODEL,
  ).trim();
}

function formatActionLog(actionLog) {
  if (!actionLog.length) return "None yet.";
  return actionLog
    .slice(-8)
    .map((entry) => {
      const args = JSON.stringify(entry.args ?? {});
      const result = JSON.stringify(entry.result ?? {});
      return `${entry.tool} ${args} -> ${result}`;
    })
    .join("\n");
}

function lastActionSummary(actionLog) {
  const last = actionLog[actionLog.length - 1];
  if (!last) return undefined;
  const result = last.result ?? {};
  if (last.tool === "type_at" || last.tool === "type") {
    return {
      tool: last.tool,
      verified: result.verified,
      method: result.method,
      fieldValue: result.fieldValue,
      navigated: result.navigated,
    };
  }
  if (last.tool === "press_key" || last.tool === "click_at") {
    return {
      tool: last.tool,
      navigated: result.navigated,
      urlBefore: result.urlBefore,
      urlAfter: result.urlAfter,
    };
  }
  if (last.tool === "search_serp") {
    return {
      tool: last.tool,
      organicCount: Array.isArray(result.serp?.organic) ? result.serp.organic.length : 0,
    };
  }
  if (last.tool === "capture_screenshot") {
    return { tool: last.tool, filename: result.filename, label: result.label };
  }
  if (last.tool === "get_page_info") {
    return {
      tool: last.tool,
      url: result.url,
      httpStatus: result.httpStatus,
      title: result.title,
    };
  }
  return { tool: last.tool, result };
}

function detectStuckLoop(actionLog) {
  if (actionLog.length < 3) return null;
  const recent = actionLog.slice(-3);
  const signature = (entry) => `${entry.tool}:${JSON.stringify(entry.args ?? {})}`;
  if (recent.every((entry) => signature(entry) === signature(recent[0]))) {
    return recent[0];
  }
  const clicks = actionLog.slice(-4).filter((entry) => entry.tool === "click_at" || entry.tool === "type_at");
  if (clicks.length >= 3) {
    const first = clicks[0];
    const sameSpot = clicks.every(
      (entry) => entry.args?.x === first.args?.x && entry.args?.y === first.args?.y,
    );
    if (sameSpot) return first;
  }
  return null;
}

function detectFailedTyping(actionLog) {
  const typeActions = actionLog
    .slice(-2)
    .filter((entry) => entry.tool === "type_at" || entry.tool === "type");
  if (typeActions.length < 2) return null;
  const allUnverified = typeActions.every((entry) => entry.result?.verified === false);
  const sameSpot = typeActions.every(
    (entry) =>
      entry.args?.x === typeActions[0].args?.x &&
      entry.args?.y === typeActions[0].args?.y,
  );
  if (allUnverified && (sameSpot || typeActions.every((entry) => entry.tool === "type"))) {
    return typeActions[0];
  }
  return null;
}

function hasVerifiedType(actionLog) {
  return actionLog.some(
    (entry) =>
      (entry.tool === "type_at" || entry.tool === "type") &&
      entry.result?.verified === true,
  );
}

function detectNoProgress(actionLog, startUrl, round) {
  if (round + 1 < NO_PROGRESS_MAX_ROUNDS) return false;
  const urlChanged = actionLog.some((entry) => {
    const before = entry.result?.urlBefore;
    const after = entry.result?.urlAfter ?? entry.result?.pageUrl;
    return before && after && before !== after;
  });
  if (urlChanged) return false;
  if (hasVerifiedType(actionLog)) return false;
  if (actionLog.some((entry) => entry.tool === "search_serp")) return false;
  return actionLog.some((entry) => entry.tool === "type_at" || entry.tool === "type");
}

function buildHybridSystemPrompt(executionMode) {
  let prompt =
    "You control a real browser. Each turn you receive a screenshot for context, but prefer programmatic tools when they can finish the step. " +
    "The viewport is 1440x900 pixels. Pick exactly ONE next action that moves toward the user's goal. " +
    "For web search, use search_serp (DataForSEO). Never type into Google or Bing search boxes. " +
    "After search_serp, use navigate to open a result URL if needed. " +
    "When the user asks to screenshot or save a page image, call capture_screenshot then complete(success=true). " +
    "When the user asks if a page returns HTTP 200, call get_page_info or read preflightStatus in context. " +
    "When the user asks to audit HTML on one page, call audit_page_html then complete. " +
        "When the user asks to check multiple pages, every page, or save a site health CSV, call audit_site_pages (auditAll=true for every page) then complete. " +
        "Never use audit_page_html for multi-page or every-page requests. " +
    "When the user asks to save text or CSV reports, use save_text_deliverable or save_csv_deliverable. " +
    "Never finish with text alone; always call complete when done or blocked.";

  if (executionMode.mode === "programmatic_first") {
    prompt +=
      " EXECUTION MODE: programmatic_first on a client/WordPress site. " +
      "Use navigate, list_page_links, audit_site_pages, get_page_info, extract_page_meta, and fetch_url_status. " +
      "Do NOT use click_at to follow main nav links when a URL is known or list_page_links can supply hrefs. " +
      "Use click_at/type_at only if programmatic tools cannot reach the target.";
  } else if (executionMode.mode === "hybrid") {
    prompt +=
      " EXECUTION MODE: hybrid. Try programmatic tools first; use click_at, type_at, scroll only for forms, modals, or complex UI.";
  } else {
    prompt +=
      " EXECUTION MODE: vision_first. Vision interaction may be required on this platform; still prefer navigate when you have a URL.";
  }

  if (executionMode.suggestedFirstTool) {
    prompt += ` Suggested first tool: ${executionMode.suggestedFirstTool}.`;
  }

  prompt +=
    " For text fields on forms, prefer type_at (click + type in one step). " +
    "Check lastActionResult: if verified=false the text did not land in the field. " +
    "Do not repeat the same coordinates more than twice without trying something different.";

  return prompt;
}

function buildVisionMessages(input) {
  const screenshotUrl = `data:image/jpeg;base64,${input.screenshotBase64}`;
  const stuck = detectStuckLoop(input.actionLog);
  const failedTyping = detectFailedTyping(input.actionLog);
  const visionNavStuck = detectVisionNavStuck(input.actionLog, input.targetUrl);
  let stuckWarning;
  if (input.blockStatus?.blocked && input.proxyMode === "proxy") {
    stuckWarning =
      "Page is blocked (captcha or bot check) and you are already on residential proxy. " +
      "Call complete(success=false, notes=blocked). Do not click captcha checkboxes.";
  } else if (visionNavStuck) {
    stuckWarning =
      "You clicked the same nav area repeatedly without changing pages on a client site. " +
      "Stop using click_at for navigation. Use audit_site_pages, list_page_links, or navigate(url) instead.";
  } else if (failedTyping) {
    stuckWarning =
      `type_at at (${failedTyping.args?.x}, ${failedTyping.args?.y}) failed verification twice. ` +
      "Try different coordinates, complete(success=false), or scroll.";
  } else if (stuck) {
    stuckWarning =
      `You repeated ${stuck.tool} at the same spot without progress. ` +
      "Try a different action (submit button, scroll, or complete with success=false).";
  }
  return [
    {
      role: "system",
      content: buildHybridSystemPrompt(input.executionMode),
    },
    {
      role: "user",
      content: JSON.stringify({
        targetUrl: input.targetUrl,
        currentUrl: input.currentUrl,
        pageState: input.pageState,
        browsePolicy: input.browsePolicy,
        proxyMode: input.proxyMode,
        serpContext: input.serpContext,
        blockStatus: input.blockStatus,
        preflightStatus: input.preflightStatus ?? null,
        activeToolPacks: input.activeToolPacks ?? [],
        executionMode: input.executionMode,
        viewport: BROWSER_VIEWPORT,
        instructions: input.instructionsText,
        recentActions: formatActionLog(input.actionLog),
        lastActionResult: lastActionSummary(input.actionLog),
        stuckWarning,
      }),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Screenshot of the current page. Choose the next action.",
        },
        {
          type: "image_url",
          image_url: { url: screenshotUrl },
        },
      ],
    },
  ];
}

async function callOpenRouterVision({ apiKey, model, messages, tools }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie Browser Automation",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "required",
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const toolCalls = (message?.tool_calls ?? []).map((call) => ({
    id: call.id,
    name: call.function?.name ?? "",
    arguments: call.function?.arguments ?? "{}",
  }));
  return {
    content: message?.content?.trim() ?? "",
    toolCalls,
  };
}

function describeToolCall(name, args, result) {
  if (name === "search_serp") {
    const query = String(args.query ?? "");
    const count = Array.isArray(result?.serp?.organic) ? result.serp.organic.length : 0;
    return `search_serp "${query}" (${count} results)`;
  }
  if (name === "type_at") {
    const label = String(args.label ?? "").trim();
    const text = String(args.text ?? "");
    const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    const verify =
      result?.verified === true
        ? `verified=true method=${result.method ?? "?"}`
        : result?.verified === false
          ? "verified=false"
          : "";
    const base = label
      ? `type_at (${args.x}, ${args.y}) "${preview}" ${label}`
      : `type_at (${args.x}, ${args.y}) "${preview}"`;
    return verify ? `${base} ${verify}` : base;
  }
  if (name === "click_at") {
    const label = String(args.label ?? "").trim();
    const nav = result?.navigated ? " navigated" : "";
    return label
      ? `click_at (${args.x}, ${args.y}) ${label}${nav}`
      : `click_at (${args.x}, ${args.y})${nav}`;
  }
  if (name === "type") {
    const text = String(args.text ?? "");
    const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    const verify =
      result?.verified === true
        ? ` verified=true method=${result.method ?? "?"}`
        : result?.verified === false
          ? " verified=false"
          : "";
    return `type "${preview}"${verify}`;
  }
  if (name === "press_key" && result?.navigated) {
    return `press_key: ${JSON.stringify(args).slice(0, 80)} navigated`;
  }
  if (name === "capture_screenshot") {
    return `capture_screenshot ${result.filename ?? ""} ${String(args.label ?? "").trim()}`.trim();
  }
  if (name === "get_page_info") {
    return `get_page_info status=${result.httpStatus ?? "?"} url=${String(result.url ?? "").slice(0, 80)}`;
  }
  return `${name}: ${JSON.stringify(args).slice(0, 80)}`;
}

async function settleAfterAction(name, args, result) {
  const instant = new Set([
    "wait",
    "search_serp",
    "get_page_info",
    "extract_page_meta",
    "extract_visible_text",
    "list_page_links",
    "verify_page_contains",
    "extract_competitor_headings",
    "capture_screenshot",
    "save_text_deliverable",
    "save_csv_deliverable",
    "audit_page_html",
    "audit_site_pages",
    "fetch_url_status",
    "report_blocked",
  ]);
  if (instant.has(name)) return;
  if (name === "navigate") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }
  if (
    (name === "press_key" && String(args?.key ?? "").toLowerCase() === "enter") ||
    (name === "click_at" && result?.navigated)
  ) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

/**
 * @param {object} input
 */
export async function runBrowserAutomationAgentLoop(input) {
  const apiKey = pickOpenRouterKey(input.env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for browser automation.");
  }
  const model = pickVisionModel(input.env);
  /** @type {Array<Record<string, unknown>>} */
  const actionLog = [...(input.initialActionLog ?? [])];
  const startUrl = input.page.url();
  const responseListener = attachBlockResponseListener(input.page);
  /** @type {Record<string, unknown> | null} */
  let liveSerpContext = input.serpContext ? { ...input.serpContext } : null;
  /** @type {Array<Record<string, unknown>>} */
  const deliverables = [...(input.initialDeliverables ?? [])];
  let endedWithoutTool = false;

  input.progress.step(`Browse mode: ${input.proxyMode ?? "direct"}`);

  const executionMode = resolveExecutionMode({
    instructionsText: input.instructionsText,
    targetUrl: input.targetUrl,
    browsePolicy: input.browsePolicy,
  });

  const { packs: activeToolPacks, tools: sessionTools } = resolveToolsForSession({
    instructionsText: input.instructionsText,
    browsePolicy: input.browsePolicy,
    targetUrl: input.targetUrl,
    executionMode,
  });

  input.progress.step(`Execution mode: ${executionMode.mode} (${executionMode.reason})`);
  input.progress.step(`Tool packs: ${activeToolPacks.join(", ")}`);

  const toolContext = {
    fetchSerp: fetchSerpOrganic,
    deliverables,
    preflightStatus: input.preflightStatus ?? null,
    env: input.env ?? {},
    serpContext: liveSerpContext,
    onDeliverable: (item) => {
      input.progress.write?.({
        type: "deliverable",
        filename: item.filename,
        label: item.label,
        mime: item.mime,
        kind: item.kind,
        content: item.content,
        base64: item.base64,
        capturedAt: item.capturedAt,
        url: item.url,
        rowIndex: item.rowIndex,
        rowTotal: item.rowTotal,
      });
    },
    onAuditRow: ({ csv, filename, label, url, index, total }) => {
      const item = {
        filename,
        label,
        mime: "text/csv",
        content: csv,
        kind: "csv",
        capturedAt: new Date().toISOString(),
        url,
        rowIndex: index,
        rowTotal: total,
      };
      const idx = deliverables.findIndex(
        (entry) => entry.kind === "csv" && entry.filename === filename,
      );
      if (idx >= 0) deliverables[idx] = item;
      else deliverables.push(item);
      toolContext.onDeliverable(item);
    },
    onAuditProgress: ({ index, total, url }) => {
      const path = (() => {
        try {
          return new URL(url).pathname || "/";
        } catch {
          return url;
        }
      })();
      input.progress.step(`Site audit ${index}/${total}: ${path}`);
    },
  };

  function loopResultBase(extra = {}) {
    return {
      actionLog,
      deliverables,
      preflightStatus: input.preflightStatus ?? null,
      finalUrl: input.page.url(),
      model,
      escalate: false,
      ...extra,
    };
  }

  try {
    if (executionMode.bootstrapTool && actionLog.length === 0) {
      const bootstrapArgs =
        executionMode.bootstrapTool === "audit_site_pages"
          ? (() => {
              const maxPages = extractMaxPagesFromInstructions(input.instructionsText);
              return maxPages === null ? { auditAll: true } : { maxPages };
            })()
          : {};
      input.progress.step(`Programmatic bootstrap: ${executionMode.bootstrapTool}`);
      try {
        const bootstrapResult = await executeBrowserTool(
          input.page,
          executionMode.bootstrapTool,
          bootstrapArgs,
          toolContext,
        );
        actionLog.push({
          tool: executionMode.bootstrapTool,
          args: bootstrapArgs,
          result: { ...bootstrapResult, pageUrl: input.page.url() },
          at: new Date().toISOString(),
        });
        if (executionMode.bootstrapTool === "audit_site_pages" && bootstrapResult.ok) {
          return loopResultBase({
            success: Number(bootstrapResult.failedCount ?? 0) === 0,
            summary: String(bootstrapResult.summary ?? "Site health audit complete."),
            notes: `Programmatic audit checked ${bootstrapResult.pagesChecked ?? 0} page(s). CSV: ${bootstrapResult.csvFilename ?? "site-health.csv"}`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Programmatic bootstrap failed.";
        input.progress.step(message);
        actionLog.push({
          tool: executionMode.bootstrapTool,
          args: bootstrapArgs,
          result: { ok: false, error: message },
          at: new Date().toISOString(),
        });
      }
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (input.sessionMeta && input.proxyMode === "direct") {
        input.sessionMeta.directRounds += 1;
      }

      if (detectNoProgress(actionLog, startUrl, round)) {
        await input.progress.screenshot(input.page, "No progress");
        return loopResultBase({
          success: false,
          summary: "Browser automation stopped: typing never verified and URL unchanged.",
          notes: `No verified type after ${NO_PROGRESS_MAX_ROUNDS} rounds.`,
        });
      }

      const badResponse = responseListener.consume();
      let blockStatus = await detectBlocked(input.page);
      if (!blockStatus.blocked && badResponse) {
        blockStatus = { blocked: true, reason: `http_${badResponse.status}` };
      }

      if (blockStatus.blocked && input.onBlocked) {
        const checkpoint = {
          url: input.page.url(),
          actionLog: [...actionLog],
          round,
          serpContext: liveSerpContext,
        };
        const decision = await input.onBlocked(blockStatus, checkpoint);
        if (decision?.escalate) {
          return loopResultBase({
            success: false,
            summary: "Escalating to residential proxy after block.",
            notes: blockStatus.reason,
            escalate: true,
            checkpoint,
          });
        }
      }

      input.progress.step(`Vision planning (round ${round + 1})`);
      const pageState = await collectPageState(input.page);
      const screenshotBase64 = await capturePageScreenshot(input.page);
      await input.progress.screenshot(input.page, `Round ${round + 1}`);

      const visionContext = {
        targetUrl: input.targetUrl,
        currentUrl: input.page.url(),
        pageState,
        instructionsText: input.instructionsText,
        actionLog,
        screenshotBase64,
        browsePolicy: input.browsePolicy,
        proxyMode: input.proxyMode,
        serpContext: liveSerpContext,
        blockStatus,
        preflightStatus: input.preflightStatus,
        activeToolPacks,
        executionMode,
      };

      let messages = buildVisionMessages(visionContext);
      let response = await callOpenRouterVision({ apiKey, model, messages, tools: sessionTools });
      let call = response.toolCalls[0];

      if (!call) {
        if (response.content) {
          actionLog.push({
            tool: "assistant",
            args: {},
            result: { content: response.content },
            at: new Date().toISOString(),
          });
        }
        messages = [
          ...messages,
          {
            role: "assistant",
            content: response.content || "I will finish the task.",
          },
          {
            role: "user",
            content:
              "You must call exactly one tool. For multi-page client site checks use audit_site_pages then complete. " +
              "For screenshot tasks use capture_screenshot then complete. " +
              "For HTTP status checks use get_page_info. Never finish with text alone.",
          },
        ];
        response = await callOpenRouterVision({ apiKey, model, messages, tools: sessionTools });
        call = response.toolCalls[0];
        if (!call) {
          if (response.content) {
            actionLog.push({
              tool: "assistant",
              args: {},
              result: { content: response.content, retry: true },
              at: new Date().toISOString(),
            });
          }
          endedWithoutTool = true;
          break;
        }
      }

      let parsed = {};
      try {
        parsed = JSON.parse(call.arguments);
      } catch {
        parsed = {};
      }

      const result = await executeBrowserTool(input.page, call.name, parsed, {
        ...toolContext,
        serpContext: liveSerpContext,
      });

      if (call.name === "search_serp" && result.serp) {
        liveSerpContext = result.serp;
        toolContext.serpContext = liveSerpContext;
      }

      input.progress.step(describeToolCall(call.name, parsed, result));
      actionLog.push({
        tool: call.name,
        args: parsed,
        result: { ...result, pageUrl: input.page.url() },
        at: new Date().toISOString(),
      });

      if ((call.name === "complete" || call.name === "report_blocked") && result.done) {
        return loopResultBase({
          success: result.success,
          summary: result.summary,
          notes: result.notes,
        });
      }

      await settleAfterAction(call.name, parsed, result);
    }

    await input.progress.screenshot(input.page, "Agent stopped");
    return loopResultBase({
      success: false,
      summary: endedWithoutTool
        ? "Vision model did not call a tool."
        : "Browser automation stopped after max agent rounds.",
      notes: endedWithoutTool ? "Model returned text without a tool call after retry." : "",
    });
  } finally {
    responseListener.detach();
  }
}

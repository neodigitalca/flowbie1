#!/usr/bin/env node
/**
 * Interactive ChatGPT website audit session.
 *
 * Usage:
 *   node scripts/research/chatgpt-audit/run-session.mjs --json --progress-file /tmp/job.jsonl
 */

import {
  isProxyConfigured,
  launchBrowserWithResidentialProxy,
  resolveResidentialProxyEnv,
} from "../residential-proxy/lib.mjs";
import {
  applySessionCookies,
  composeChatGptAuditPrompt,
  createProgressWriter,
  enableChatGptLeanBrowsing,
  isComposerReady,
  loginChatGpt,
  readControlAction,
  readControlPayload,
  clearControlFile,
  readNewQueryEntries,
  requireEnv,
  readLatestAssistantText,
  resolveEnv,
  saveSessionCookies,
  startNewChat,
  readAssistantMessageCount,
  readComposerSnapshot,
  submitComposer,
  typeIntoComposer,
  waitForAssistantReply,
  waitWithProgressScreenshots,
} from "./lib.mjs";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return "";
  return process.argv[idx + 1].trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const progressPath = readArg("--progress-file");
  const queriesPath = readArg("--queries-file");
  const controlPath = readArg("--control-file");
  const progress = createProgressWriter(progressPath);
  const processedIds = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const responses = [];

  const env = {
    ...resolveResidentialProxyEnv(),
    ...resolveEnv(),
  };
  const agentmailApiKey = requireEnv("AGENTMAIL_API_KEY", env);
  const agentmailInbox = env.AGENTMAIL_INBOX?.trim() || readArg("--agentmail-inbox") || "neo-pulse@agentmail.to";
  const email = env.CHATGPT_AUDIT_EMAIL?.trim() || readArg("--email") || agentmailInbox;
  const clientName = readArg("--client-name");
  const clientUrl = readArg("--client-url");
  const headed = hasFlag("--headed");
  const saveSession = hasFlag("--save-session");

  if (!isProxyConfigured(env)) {
    throw new Error(
      "Residential proxy is required for ChatGPT audit. Configure OXYLABS_PROXY_USERNAME and OXYLABS_PROXY_PASSWORD in .env.residential-proxy.",
    );
  }

  progress.step("Starting ChatGPT audit session (residential proxy)");

  const { browser, page } = await launchBrowserWithResidentialProxy({ headed, env });

  try {
    await enableChatGptLeanBrowsing(page);
    await applySessionCookies(page);
    await loginChatGpt(page, progress, { email, agentmailApiKey, agentmailInbox, env });

    if (!(await isComposerReady(page))) {
      throw new Error("ChatGPT composer is not ready.");
    }

    progress.write({ type: "session_ready", clientName, clientUrl, capturedAt: new Date().toISOString() });
    progress.step("Session ready");

    let activeClientUrl = clientUrl;
    let running = true;
    while (running) {
      const control = readControlPayload(controlPath);
      if (control.action === "cancel") {
        progress.error("Session cancelled.");
        process.exitCode = 1;
        return;
      }
      if (control.action === "finish") {
        clearControlFile(controlPath);
        running = false;
        break;
      }
      if (control.action === "new_chat") {
        if (control.clientUrl) activeClientUrl = control.clientUrl;
        await startNewChat(page, progress);
        progress.write({
          type: "new_chat_ready",
          clientUrl: activeClientUrl,
          capturedAt: new Date().toISOString(),
        });
        clearControlFile(controlPath);
        continue;
      }

      const pending = readNewQueryEntries(queriesPath, processedIds);
      if (pending.length === 0) {
        await sleep(2_000);
        continue;
      }

      for (const entry of pending) {
        processedIds.add(entry.id);
        const promptUrl = entry.clientUrl?.trim() || activeClientUrl;
        const prompt = await composeChatGptAuditPrompt({
          clientName,
          pageUrl: promptUrl,
          question: entry.text,
        });
        progress.step(`Sending: ${entry.text.slice(0, 80)}`);
        await progress.screenshot(page, `Sending question (${promptUrl})`, { force: true });

        const beforeReply = await readLatestAssistantText(page);
        const beforeAssistantCount = await readAssistantMessageCount(page);
        const preSubmitUserCount = (await readComposerSnapshot(page)).userMessageCount;
        await typeIntoComposer(page, prompt);
        const submitBaseline = {
          composerText: prompt,
          userMessageCount: preSubmitUserCount,
        };
        await progress.screenshot(page, "Question typed", { force: true });
        await submitComposer(page, submitBaseline);
        await progress.screenshot(page, "Question submitted", { force: true });

        const response = await waitForAssistantReply(page, progress, {
          previousText: beforeReply,
          previousAssistantCount: beforeAssistantCount,
        });
        const capturedAt = new Date().toISOString();
        const payload = {
          type: "query_response",
          queryId: entry.id,
          query: entry.text,
          prompt,
          response,
          capturedAt,
        };
        progress.write(payload);
        responses.push(payload);
        progress.step(`Saved reply (${responses.length})`);
      }
    }

    if (saveSession) {
      await saveSessionCookies(page);
    }

    const summary = {
      clientName,
      clientUrl,
      responseCount: responses.length,
      responses: responses.map((item) => ({
        queryId: item.queryId,
        query: item.query,
        response: item.response,
        capturedAt: item.capturedAt,
      })),
      finishedAt: new Date().toISOString(),
    };

    progress.write({ type: "session_done", summary });
    progress.done({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress.error(message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const progressPath = readArg("--progress-file");
  const progress = createProgressWriter(progressPath);
  const message = error instanceof Error ? error.message : String(error);
  progress.error(message);
  process.exitCode = 1;
});

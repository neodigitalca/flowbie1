import { planBrowsePolicy } from "./browse-policy.mjs";
import { detectBlocked } from "./block-detect.mjs";
import { probeDirectUrl } from "./preflight.mjs";
import { fetchSerpOrganic } from "./serp-dfs.mjs";
import { runBrowserAutomationAgentLoop } from "./agent-loop.mjs";
import {
  defaultAgentMailInbox,
  loginChatGpt,
} from "../chatgpt-audit/lib.mjs";
import {
  isProxyConfigured,
  launchBrowser,
} from "../residential-proxy/lib.mjs";

const CHATGPT_LOGIN_HOSTS = ["chatgpt.com", "chat.openai.com", "openai.com"];

function hostNeedsChatGptLogin(url) {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    return CHATGPT_LOGIN_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
  } catch {
    return false;
  }
}

function resolveAgentMailCredentials(env) {
  const agentmailApiKey = String(env.AGENTMAIL_API_KEY ?? "").trim();
  const agentmailInbox = String(env.AGENTMAIL_INBOX ?? "").trim() || defaultAgentMailInbox;
  const email = String(env.CHATGPT_AUDIT_EMAIL ?? "").trim() || agentmailInbox;
  return { agentmailApiKey, agentmailInbox, email };
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} navigateUrl
 * @param {object} browsePolicy
 * @param {{ firstLaunch?: boolean }} options
 */
async function navigateInitial(page, navigateUrl, browsePolicy, options = {}) {
  if (browsePolicy.route === "serp_api" && options.firstLaunch) {
    await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 30_000 });
    return;
  }
  await page.goto(navigateUrl, { waitUntil: "networkidle2", timeout: 90_000 });
  try {
    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector('textarea[name="q"]') ||
            document.querySelector('input[name="q"]') ||
            document.querySelector('[role="combobox"]') ||
            document.body,
        ),
      { timeout: 10_000 },
    );
  } catch {
    /* optional wait */
  }
}

/**
 * @param {object} input
 * @param {string} input.targetUrl
 * @param {string} input.instructionsText
 * @param {Record<string, string>} input.env
 * @param {boolean} [input.headed]
 * @param {import("../chatgpt-audit/lib.mjs").ProgressWriter} input.progress
 */
export async function runSmartBrowseSession(input) {
  const browsePolicy = await planBrowsePolicy({
    targetUrl: input.targetUrl,
    instructionsText: input.instructionsText,
    env: input.env,
  });

  input.progress.step(`Browse policy: ${browsePolicy.route} (${browsePolicy.rationale})`);

  /** @type {Record<string, unknown> | null} */
  let serpContext = null;
  if (browsePolicy.route === "serp_api" && browsePolicy.searchQuery) {
    input.progress.step(`Fetching SERP via DataForSEO: "${browsePolicy.searchQuery}"`);
    serpContext = await fetchSerpOrganic({
      query: browsePolicy.searchQuery,
      location: browsePolicy.locationHint,
    });
  }

  let proxyMode = browsePolicy.route === "browser_proxy" ? "proxy" : "direct";
  /** @type {{ status: number, ok: boolean, finalUrl?: string } | null} */
  let preflightStatus = null;
  if (browsePolicy.route === "browser_direct") {
    const preflight = await probeDirectUrl(input.targetUrl);
    preflightStatus = {
      status: preflight.status,
      ok: preflight.ok,
      finalUrl: preflight.finalUrl,
    };
    if (preflight.ok) {
      input.progress.step(`Direct preflight: ${preflight.status} OK`);
    } else {
      input.progress.step(`Preflight blocked (${preflight.reason}) → starting with proxy`);
      proxyMode = "proxy";
    }
  } else if (proxyMode === "proxy") {
    input.progress.step("Starting with residential proxy (known sensitive host)");
  }

  const sessionMeta = {
    browsePolicy,
    proxyModeTimeline: [proxyMode],
    serpUsed: Boolean(serpContext),
    blockEvents: [],
    directRounds: 0,
  };

  let resumeUrl = input.targetUrl;
  /** @type {Array<Record<string, unknown>>} */
  let resumeActionLog = [];
  /** @type {Array<Record<string, unknown>>} */
  let resumeDeliverables = [];
  let escalated = false;

  while (true) {
    if (proxyMode === "proxy" && !isProxyConfigured(input.env)) {
      throw new Error("RESIDENTIAL_PROXY_REQUIRED_FOR_ESCALATION");
    }

    input.progress.step(
      proxyMode === "proxy" ? "Launching browser with residential proxy" : "Launching browser (direct)",
    );

    const { browser, page } = await launchBrowser({
      useProxy: proxyMode === "proxy",
      headed: Boolean(input.headed),
      env: input.env,
    });

    try {
      input.progress.step(`Navigating to ${resumeUrl}`);
      await navigateInitial(page, resumeUrl, browsePolicy, {
        firstLaunch: resumeActionLog.length === 0,
      });
      await input.progress.screenshot(page, "Initial page");

      const chatGptLoginUrl = resumeUrl || input.targetUrl;
      if (hostNeedsChatGptLogin(chatGptLoginUrl)) {
        const { agentmailApiKey, agentmailInbox, email } = resolveAgentMailCredentials(input.env);
        if (!agentmailApiKey) {
          throw new Error("Missing AGENTMAIL_API_KEY for ChatGPT login.");
        }
        input.progress.step("ChatGPT host detected; logging in via AgentMail OTP");
        await loginChatGpt(page, input.progress, { email, agentmailApiKey, agentmailInbox, env: input.env });
      }

      const loopResult = await runBrowserAutomationAgentLoop({
        page,
        targetUrl: input.targetUrl,
        instructionsText: input.instructionsText,
        env: input.env,
        progress: input.progress,
        browsePolicy,
        proxyMode,
        serpContext,
        preflightStatus,
        initialActionLog: resumeActionLog,
        initialDeliverables: resumeDeliverables,
        sessionMeta,
        onBlocked: async (blockInfo, checkpoint) => {
          sessionMeta.blockEvents.push({
            at: new Date().toISOString(),
            reason: blockInfo.reason,
            escalated: false,
            proxyMode,
          });
          if (proxyMode === "direct" && !escalated) {
            input.progress.step(`Blocked (${blockInfo.reason}) → escalating to proxy`);
            sessionMeta.blockEvents[sessionMeta.blockEvents.length - 1].escalated = true;
            return { escalate: true, checkpoint };
          }
          return { escalate: false };
        },
      });

      if (loopResult.escalate && proxyMode === "direct" && !escalated) {
        await browser.close().catch(() => {});
        proxyMode = "proxy";
        escalated = true;
        sessionMeta.proxyModeTimeline.push("proxy");
        resumeUrl = loopResult.checkpoint?.url || resumeUrl;
        resumeActionLog = loopResult.actionLog ?? resumeActionLog;
        resumeDeliverables = loopResult.deliverables ?? resumeDeliverables;
        input.progress.step(`Resumed at ${resumeUrl}`);
        continue;
      }

      await input.progress.screenshot(page, loopResult.success ? "Complete" : "Stopped");

      return {
        ...loopResult,
        browsePolicy,
        proxyModeTimeline: sessionMeta.proxyModeTimeline,
        serpUsed: sessionMeta.serpUsed,
        blockEvents: sessionMeta.blockEvents,
        directRounds: sessionMeta.directRounds,
        serpContext,
        finalProxyMode: proxyMode,
      };
    } catch (error) {
      await input.progress.screenshot(page, "Error").catch(() => {});
      throw error;
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

export { detectBlocked };

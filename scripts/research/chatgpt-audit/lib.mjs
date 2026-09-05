import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  enableChatGptLeanBrowsing,
  shouldAbortChatGptProxyRequest,
} from "./chatgpt-lean-browsing.mjs";

export { enableChatGptLeanBrowsing, shouldAbortChatGptProxyRequest };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..", "..", "..");
export const envPath = path.join(repoRoot, ".env.chatgpt-audit");
export const sessionPath = path.join(repoRoot, ".chatgpt-audit-session.json");
export const defaultChatGptUrl = "https://chatgpt.com";
export const defaultAgentMailInbox = "neo-pulse@agentmail.to";

export function loadEnv(filePath = envPath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadOpenRouterFromAppSecretsPhp() {
  const secretsPath = path.join(
    repoRoot,
    "wordpress-plugins",
    "neo-pulse-app",
    "includes",
    "neo-pulse-app-secrets.php",
  );
  if (!fs.existsSync(secretsPath)) return "";
  const src = fs.readFileSync(secretsPath, "utf8");
  const match = src.match(
    /define\(\s*'NEO_PULSE_APP_OPENROUTER_API_KEY',\s*'((?:\\'|[^'])*)'/,
  );
  if (!match) return "";
  return match[1].replace(/\\'/g, "'").trim();
}

export function resolveEnv(overrides = {}) {
  const rootEnvPath = path.join(repoRoot, ".env");
  const envFileOverride = process.env.CHATGPT_AUDIT_ENV_FILE?.trim();
  const env = {
    ...loadEnv(rootEnvPath),
    ...loadEnv(envPath),
    ...(envFileOverride ? loadEnv(envFileOverride) : {}),
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value && !(key in env)) env[key] = value;
  }
  const openRouterFromSecrets = loadOpenRouterFromAppSecretsPhp();
  if (openRouterFromSecrets) {
    if (!env.OPENROUTER_API_KEY) env.OPENROUTER_API_KEY = openRouterFromSecrets;
    if (!env.NEO_PULSE_APP_OPENROUTER_API_KEY) {
      env.NEO_PULSE_APP_OPENROUTER_API_KEY = openRouterFromSecrets;
    }
  }
  return { ...env, ...overrides };
}

export function requireEnv(name, env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.chatgpt-audit or the environment.`);
  }
  return value;
}

/** @typedef {{ step: (label: string) => void, screenshot: (page: import("puppeteer").Page, label: string) => Promise<void>, done: (payload: Record<string, unknown>) => void, error: (message: string) => void, write: (payload: Record<string, unknown>) => void }} ProgressWriter */

/** @returns {ProgressWriter} */
export function createProgressWriter(progressPath) {
  if (!progressPath) {
    return {
      step() {},
      async screenshot() {},
      done() {},
      error() {},
      write() {},
    };
  }

  const write = (payload) => {
    fs.appendFileSync(progressPath, `${JSON.stringify(payload)}\n`, "utf8");
  };

  let lastScreenshotAt = 0;
  const SCREENSHOT_MIN_INTERVAL_MS = 4_000;

  return {
    step(label) {
      write({ type: "step", label });
    },
    async screenshot(page, label, options = {}) {
      const force = options?.force === true;
      const now = Date.now();
      if (!force && now - lastScreenshotAt < SCREENSHOT_MIN_INTERVAL_MS) {
        write({ type: "step", label, capturedAt: new Date().toISOString() });
        return;
      }
      const jpegBase64 = await capturePageScreenshot(page);
      const capturedAt = new Date().toISOString();
      if (!jpegBase64) {
        write({ type: "step", label: `${label} (preview unavailable)`, capturedAt });
        return;
      }
      lastScreenshotAt = now;
      write({
        type: "screenshot",
        label,
        pngBase64: jpegBase64,
        mime: "image/jpeg",
        capturedAt,
      });
    },
    done(payload) {
      write({ type: "done", ...payload });
    },
    error(message) {
      write({ type: "error", message });
    },
    write,
  };
}

const PREVIEW_CAPTURE_INTERVAL_MS = 800;
const COMPOSER_POLL_INTERVAL_MS = 2_000;
const REPLY_POLL_INTERVAL_MS = 1_500;
const NEW_CHAT_POLL_INTERVAL_MS = 1_500;

function isNavigationContextError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Execution context was destroyed")
    || message.includes("Cannot find context")
    || message.includes("Cannot take screenshot")
    || message.includes("Target closed")
    || message.includes("Session closed")
  );
}

function isScreenshotRecoverableError(error) {
  return isNavigationContextError(error);
}

async function evaluateOnPageSafe(page, pageFunction, ...args) {
  try {
    return await page.evaluate(pageFunction, ...args);
  } catch (error) {
    if (isNavigationContextError(error)) return undefined;
    throw error;
  }
}

async function evaluateHandleSafe(handle, pageFunction, ...args) {
  if (!handle) return undefined;
  try {
    return await handle.evaluate(pageFunction, ...args);
  } catch (error) {
    if (isNavigationContextError(error)) return undefined;
    throw error;
  }
}

export async function resolveScreenshotPage(page) {
  if (page && typeof page.isClosed === "function" && !page.isClosed()) {
    try {
      await page.evaluate(() => document.readyState);
      return page;
    } catch (error) {
      if (!isScreenshotRecoverableError(error)) throw error;
    }
  }

  const browser = page?.browser?.();
  if (!browser) return page;

  const pages = await browser.pages();
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const candidate = pages[index];
    if (candidate.isClosed()) continue;
    try {
      await candidate.evaluate(() => document.readyState);
      return candidate;
    } catch {
      continue;
    }
  }

  return page;
}

export async function capturePageScreenshot(page) {
  const target = await resolveScreenshotPage(page);
  if (!target || (typeof target.isClosed === "function" && target.isClosed())) {
    return null;
  }

  const options = {
    type: "jpeg",
    quality: 78,
    encoding: "base64",
    captureBeyondViewport: false,
  };

  try {
    return await target.screenshot(options);
  } catch (error) {
    if (!isScreenshotRecoverableError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const retryTarget = await resolveScreenshotPage(page);
    if (!retryTarget || (typeof retryTarget.isClosed === "function" && retryTarget.isClosed())) {
      return null;
    }
    try {
      return await retryTarget.screenshot(options);
    } catch (retryError) {
      if (!isScreenshotRecoverableError(retryError)) throw retryError;
      return null;
    }
  }
}

export async function waitWithProgressScreenshots(page, progress, label, totalMs) {
  if (page && progress && totalMs > 0) {
    await progress.screenshot(page, label, { force: true });
  }
  if (totalMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, totalMs));
  }
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} [url]
 * @param {{ timeoutMs?: number, waitForComposer?: boolean }} [options]
 */
export async function gotoChatGpt(page, url = defaultChatGptUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const waitForComposer = options.waitForComposer !== false;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  if (!waitForComposer) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) return;
    await new Promise((resolve) => setTimeout(resolve, COMPOSER_POLL_INTERVAL_MS));
  }
  throw new Error(`ChatGPT composer did not become ready at ${url}`);
}

export async function applySessionCookies(page) {
  const session = readSessionFile();
  if (!session?.cookies?.length) return false;
  if (sessionCookiesAreStale(session.cookies, session.savedAt)) {
    clearSessionFile();
    return false;
  }
  await page.setCookie(...session.cookies);
  return true;
}

export async function saveSessionCookies(page) {
  const cookies = await page.cookies();
  const payload = {
    savedAt: new Date().toISOString(),
    cookies,
  };
  fs.writeFileSync(sessionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function readSessionFile() {
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    if (Array.isArray(parsed)) {
      return { savedAt: null, cookies: parsed };
    }
    if (parsed && Array.isArray(parsed.cookies)) {
      return {
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
        cookies: parsed.cookies,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearSessionFile() {
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

export function sessionCookiesAreStale(cookies, savedAt) {
  const nowSec = Date.now() / 1000;
  for (const cookie of cookies) {
    const expires = Number(cookie?.expires ?? 0);
    if (expires > 0 && expires < nowSec) {
      return true;
    }
  }
  if (savedAt) {
    const savedMs = Date.parse(savedAt);
    if (Number.isFinite(savedMs) && Date.now() - savedMs > 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
  }
  return false;
}

export function extractOtpFromText(text) {
  const normalized = String(text ?? "");
  const matches = normalized.match(/\b(\d{6,8})\b/g);
  if (!matches || matches.length === 0) return "";
  return matches[matches.length - 1];
}

export async function fetchAgentMailMessages(apiKey, inbox, afterIso, filters = {}) {
  const params = new URLSearchParams({ limit: "20" });
  if (afterIso) params.set("after", afterIso);
  if (filters.from) params.set("from", filters.from);
  if (filters.subject) params.set("subject", filters.subject);
  const url = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`AgentMail list failed (${res.status}): ${raw.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.messages) ? data.messages : Array.isArray(data?.items) ? data.items : [];
}

export async function fetchAgentMailMessageBody(apiKey, inbox, messageId) {
  const url = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(messageId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return "";
  const data = await res.json();
  const parts = [
    data?.subject,
    data?.text,
    data?.body_text,
    data?.body?.text,
    data?.html,
    data?.body_html,
    data?.body?.html,
  ];
  return parts.filter(Boolean).join("\n");
}

function messageTimestampMs(message) {
  const raw = message?.timestamp ?? message?.created_at ?? message?.sent_at;
  const ms = Date.parse(String(raw ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function isChatGptVerificationMessage(message) {
  const haystack = [
    message?.subject,
    message?.from,
    message?.sender,
    message?.preview,
    message?.snippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes("chatgpt")
    || haystack.includes("openai")
    || haystack.includes("verification")
  );
}

export async function pollAgentMailOtp(apiKey, inbox, loginStartedAt, progress, page) {
  const afterMs = loginStartedAt - 15_000;
  const afterIso = new Date(afterMs).toISOString();
  const deadline = Date.now() + 180_000;
  const seenIds = new Set();

  while (Date.now() < deadline) {
    progress?.step("Waiting for login code in AgentMail");
    const messages = await fetchAgentMailMessages(apiKey, inbox, afterIso);
    const sorted = [...messages].sort(
      (left, right) => messageTimestampMs(right) - messageTimestampMs(left),
    );
    for (const message of sorted) {
      const messageId = String(message?.message_id ?? message?.id ?? "").trim();
      if (!messageId || seenIds.has(messageId)) continue;
      seenIds.add(messageId);

      if (messageTimestampMs(message) > 0 && messageTimestampMs(message) < afterMs) continue;
      if (!isChatGptVerificationMessage(message)) continue;

      let body = [
        message?.subject,
        message?.text,
        message?.body_text,
        message?.preview,
        message?.snippet,
      ]
        .filter(Boolean)
        .join("\n");

      if (!extractOtpFromText(body)) {
        body = await fetchAgentMailMessageBody(apiKey, inbox, messageId);
      }

      const otp = extractOtpFromText(body);
      if (otp) return otp;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error("Timed out waiting for ChatGPT login code in AgentMail inbox.");
}

const LOGIN_BUTTON_LABELS = ["log in", "login", "sign in"];

const LOGIN_BUTTON_SELECTORS = [
  '[data-testid="login-button"]',
  'button[data-testid="welcome-login-button"]',
  'a[href*="/auth/login"]',
  'a[href*="auth.openai.com"]',
  'button[aria-label*="Log in" i]',
  'button[aria-label*="Login" i]',
];

const EMAIL_INPUT_SELECTORS = [
  'input[type="email"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[id="email"]',
  'input[id="username"]',
  'input[autocomplete="email"]',
  'input[autocomplete="username"]',
];

async function findVisibleEmailInput(root) {
  for (const selector of EMAIL_INPUT_SELECTORS) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await evaluateHandleSafe(handle, (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (visible) return handle;
  }
  return null;
}

async function clickLoginButton(page) {
  for (const selector of LOGIN_BUTTON_SELECTORS) {
    const handle = await page.$(selector);
    if (!handle) continue;
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (!visible) continue;
    await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await handle.click({ delay: 20 });
    return true;
  }

  return page.evaluate((labels) => {
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      const matches = labels.some((label) => text === label || text.startsWith(`${label} `));
      if (!matches) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!(best instanceof HTMLElement)) return false;
    best.scrollIntoView({ block: "center", inline: "center" });
    best.click();
    return true;
  }, LOGIN_BUTTON_LABELS);
}

async function waitForLoginButtonAndClick(page, progress, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const clicked = await clickLoginButton(page);
    if (clicked) return true;
    await progress.screenshot(page, "Waiting for Log in button");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function continueButtonLabels() {
  return ["Continue", "Continue with email", "Continue with Google", "Next"];
}

async function clickFirstMatching(root, selectors, textLabels = continueButtonLabels()) {
  for (const selector of selectors) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      return true;
    });
    if (!visible) continue;
    await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await handle.click();
    return true;
  }
  const clicked = await root.evaluate((labels) => {
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.trim().toLowerCase() ?? "";
      const matches = labels.some((label) => {
        const normalized = label.toLowerCase();
        return text === normalized || text.startsWith(`${normalized} `);
      });
      if (!matches) continue;
      if (node instanceof HTMLButtonElement && node.disabled) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!best) return false;
    best.scrollIntoView({ block: "center", inline: "center" });
    best.click();
    return true;
  }, textLabels);
  return clicked;
}

async function clickContinueInRoot(root) {
  const selectors = [
    'button[type="submit"]',
    'button[data-action="continue"]',
    'button[name="action"]',
  ];
  return clickFirstMatching(root, selectors, continueButtonLabels());
}

async function clickContinueButton(page) {
  if (await clickContinueInRoot(page)) return true;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      if (await clickContinueInRoot(frame)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function fillEmailField(page, email) {
  const handle = await waitForEmailInput(page, 45_000);
  if (!handle) return false;
  await handle.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await handle.type(email, { delay: 15 });
  let value = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (value !== email.trim()) {
    await handle.evaluate((el, nextEmail) => {
      if (!("value" in el)) return;
      el.value = nextEmail;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, email.trim());
    value = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  return value === email.trim();
}

async function waitForEmailInput(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const onPage = await findVisibleEmailInput(page);
    if (onPage) return onPage;

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const inFrame = await findVisibleEmailInput(frame);
        if (inFrame) return inFrame;
      } catch {
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function fillSplitOtpInputs(page, otp) {
  const digits = String(otp ?? "").trim().split("");
  if (digits.length < 4) return false;

  return page.evaluate((codeDigits) => {
    const inputs = [...document.querySelectorAll("input")].filter((node) => {
      if (!(node instanceof HTMLInputElement)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      const mode = `${node.inputMode} ${node.type} ${node.autocomplete} ${node.name}`.toLowerCase();
      return (
        mode.includes("numeric")
        || mode.includes("one-time-code")
        || node.maxLength === 1
        || node.getAttribute("aria-label")?.toLowerCase().includes("code")
      );
    });

    if (inputs.length < codeDigits.length) return false;
    codeDigits.forEach((digit, index) => {
      const input = inputs[index];
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      input.value = digit;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return true;
  }, digits);
}

async function fillOtpOnAuthPage(page, otp) {
  let handle = await waitForOtpInput(page, 10_000);
  if (!handle) {
    return fillSplitOtpInputs(page, otp);
  }

  const typeOtp = async (target) => {
    await target.click({ clickCount: 3 });
    await target.type(otp, { delay: 25 });
  };

  try {
    await typeOtp(handle);
  } catch (error) {
    if (!isNavigationContextError(error)) throw error;
    handle = await waitForOtpInput(page, 5_000);
    if (!handle) return fillSplitOtpInputs(page, otp);
    await typeOtp(handle);
  }

  const verified = await page.evaluate((expected) => {
    const inputs = [...document.querySelectorAll("input")];
    const combined = inputs
      .map((node) => (node instanceof HTMLInputElement ? node.value : ""))
      .join("");
    if (combined.includes(expected)) return true;
    const single = inputs.find((node) => {
      if (!(node instanceof HTMLInputElement)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8 && node.value.includes(expected);
    });
    return Boolean(single);
  }, otp);

  if (verified) return true;
  return fillSplitOtpInputs(page, otp);
}

async function submitOtpOnAuthPage(authPage, otp) {
  const handle = await waitForOtpInput(authPage, 5_000);
  const navigationWait = authPage
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => null);

  if (handle) {
    const frame = resolveElementFrame(handle, authPage);
    const clicked = await clickContinueInRoot(frame);
    if (!clicked) {
      await clickContinueButton(authPage);
    }
  } else {
    await clickContinueButton(authPage);
  }

  await navigationWait;
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  if (await isComposerReady(authPage)) return true;

  if (handle) {
    await progressSafeFocus(handle);
    await authPage.keyboard.press("Enter");
    await authPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
  }
  return true;
}

export async function isLoggedIn(page) {
  const result = await evaluateOnPageSafe(page, () => {
    const loginSelectors = [
      '[data-testid="login-button"]',
      'button[data-testid="welcome-login-button"]',
      'a[href*="auth/login"]',
    ];
    for (const selector of loginSelectors) {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) return false;
    }
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    for (const label of ["Log in", "Login", "Sign up"]) {
      const match = nodes.find((node) => node.textContent?.trim().toLowerCase() === label.toLowerCase());
      if (!(match instanceof HTMLElement)) continue;
      const rect = match.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) return false;
    }
    return true;
  });
  return result === true;
}

export async function isComposerReady(page) {
  if (!(await isLoggedIn(page))) return false;
  const result = await evaluateOnPageSafe(page, () => {
    const textarea = document.querySelector("#prompt-textarea");
    if (textarea instanceof HTMLTextAreaElement && !textarea.disabled) return true;
    const editable = document.querySelector('[contenteditable="true"]#prompt-textarea, div[contenteditable="true"]');
    return editable instanceof HTMLElement;
  });
  return result === true;
}

async function clearBrowserCookies(page) {
  const cookies = await page.cookies();
  if (cookies.length === 0) return;
  await page.deleteCookie(...cookies);
}

function isBareChatGptHome(url) {
  return /^https:\/\/(www\.)?(chatgpt\.com|chat\.openai\.com)\/?(\?.*)?$/i.test(String(url ?? ""));
}

function isAuthLoginUrl(url) {
  const value = String(url ?? "");
  return (
    /auth\.openai\.com/i.test(value)
    || /chatgpt\.com\/auth/i.test(value)
    || /chat\.openai\.com\/auth/i.test(value)
    || /openai\.com\/auth/i.test(value)
  );
}

async function pageHasVisibleAuthEmailField(page) {
  const handle = await waitForEmailInput(page, 1_000);
  return Boolean(handle);
}

async function resolveAuthLoginPage(browser, page, options = {}) {
  const allowHomeModal = options.allowHomeModal === true;

  async function check(candidate) {
    try {
      if (!(await pageHasVisibleAuthEmailField(candidate))) return null;
      const url = candidate.url();
      if (isAuthLoginUrl(url)) return candidate;
      if (allowHomeModal && isBareChatGptHome(url)) return candidate;
      if (!isBareChatGptHome(url)) return candidate;
      return null;
    } catch (error) {
      if (isNavigationContextError(error)) return null;
      throw error;
    }
  }

  const direct = await check(page);
  if (direct) return direct;

  for (const candidate of await browser.pages()) {
    if (candidate === page) continue;
    const found = await check(candidate);
    if (found) return found;
  }

  return null;
}

async function waitForAuthLoginPage(page, progress, timeoutMs = 45_000, options = {}) {
  const browser = page.browser();
  const deadline = Date.now() + timeoutMs;
  let lastCaptureMs = 0;

  while (Date.now() < deadline) {
    const authPage = await resolveAuthLoginPage(browser, page, options);
    if (authPage) return authPage;
    if (progress && Date.now() - lastCaptureMs >= PREVIEW_CAPTURE_INTERVAL_MS) {
      progress.step(`Opening login flow (${page.url()})`);
      if (progress.screenshot) {
        await progress.screenshot(page, `Opening login flow (${page.url()})`);
      }
      lastCaptureMs = Date.now();
    } else {
      progress?.step(`Opening login flow (${page.url()})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

async function authEmailFieldStillVisible(page, timeoutMs = 1_500) {
  const handle = await waitForEmailInput(page, timeoutMs);
  return Boolean(handle);
}

function resolveElementFrame(handle, page) {
  const frame = handle?.frame;
  if (frame && typeof frame.$ === "function") return frame;
  return page.mainFrame();
}

async function pageShowsVerificationCopy(page) {
  const result = await evaluateOnPageSafe(page, () => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
    return (
      text.includes("verification code")
      || text.includes("enter the code")
      || text.includes("enter code")
      || text.includes("one-time code")
      || text.includes("6-digit")
      || text.includes("check your email")
      || text.includes("we sent a code")
      || text.includes("email code")
      || text.includes("inbox for a code")
    );
  });
  return result === true;
}

async function isLoggedOutHomepage(page) {
  if (!isBareChatGptHome(page.url())) return false;
  const hasAuthOverlay = await evaluateOnPageSafe(page, () => {
    const dialogs = [...document.querySelectorAll('[role="dialog"], [data-testid*="modal"], [class*="modal"]')];
    return dialogs.some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      const text = node.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
      return (
        text.includes("email")
        || text.includes("code")
        || text.includes("continue")
        || text.includes("password")
      );
    });
  });
  if (hasAuthOverlay === undefined) return false;
  if (hasAuthOverlay) return false;
  return !(await isLoggedIn(page));
}

async function detectLoginStep(page, timeoutMs = 2_000) {
  if (await waitForOtpInput(page, timeoutMs)) return "code_prompt";
  if (await pageShowsVerificationCopy(page)) return "code_prompt";
  if (await authEmailFieldStillVisible(page, 800)) return "email";
  if (await isLoggedOutHomepage(page)) return "logged_out_home";
  if (isAuthLoginUrl(page.url())) return "auth_unknown";
  return "unknown";
}

async function detectLoginStepWithRetry(page, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(500, deadline - Date.now());
      const step = await detectLoginStep(page, Math.min(2_000, remaining));
      if (step !== "unknown") return step;
    } catch (error) {
      if (!isNavigationContextError(error)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return "unknown";
}

async function submitEmailViaForm(emailHandle) {
  try {
    return await emailHandle.evaluate((el) => {
      if (!(el instanceof HTMLElement)) return false;

      const form = el.closest("form");
      if (form instanceof HTMLFormElement) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submit instanceof HTMLElement) {
          if (submit instanceof HTMLButtonElement && submit.disabled) return false;
          submit.scrollIntoView({ block: "center", inline: "center" });
          submit.click();
          return true;
        }
        form.requestSubmit();
        return true;
      }

      const scope = el.closest('[role="dialog"], [data-testid*="modal"], [class*="modal"]');
      const root = scope instanceof HTMLElement ? scope : document.body;
      const buttons = [...root.querySelectorAll("button, [role='button']")];
      let best = null;
      let bestArea = 0;
      for (const node of buttons) {
        if (!(node instanceof HTMLElement)) continue;
        const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
        if (!text.startsWith("continue") && text !== "next") continue;
        if (node instanceof HTMLButtonElement && node.disabled) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 8 || rect.height <= 8) continue;
        const area = rect.width * rect.height;
        if (area > bestArea) {
          best = node;
          bestArea = area;
        }
      }
      if (!(best instanceof HTMLElement)) return false;
      best.scrollIntoView({ block: "center", inline: "center" });
      best.click();
      return true;
    });
  } catch (error) {
    if (isNavigationContextError(error)) {
      return true;
    }
    throw error;
  }
}

async function waitForAuthPageContent(page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await evaluateOnPageSafe(page, () => {
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
      return text.length >= 15;
    });
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function resolveAuthPageAfterSubmit(browser, page) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const authPage = (await resolveAuthLoginPage(browser, page, { allowHomeModal: true })) ?? page;
    try {
      await authPage.evaluate(() => document.readyState);
      if (await waitForAuthPageContent(authPage, Math.max(500, deadline - Date.now()))) {
        return authPage;
      }
    } catch (error) {
      if (!isNavigationContextError(error)) throw error;
    }
  }
  return (await resolveAuthLoginPage(browser, page, { allowHomeModal: true })) ?? page;
}

async function submitEmailOnce(authPage, emailHandle, progress = null) {
  const browser = authPage.browser();
  const navigationWait = authPage
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => null);

  let submitted = await submitEmailViaForm(emailHandle);
  if (!submitted) {
    const emailFrame = resolveElementFrame(emailHandle, authPage);
    submitted = await clickContinueInRoot(emailFrame);
  }

  await navigationWait;
  let nextPage = await resolveAuthPageAfterSubmit(browser, authPage);
  if (progress?.screenshot) {
    await progress.screenshot(nextPage, submitted ? "Email submit sent" : "Email submit pending");
  }

  let step = await detectLoginStepWithRetry(nextPage, 8_000);
  if (step === "logged_out_home") {
    return { ok: false, authPage: nextPage, step };
  }
  if (step === "code_prompt" || submitted) {
    return { ok: true, authPage: nextPage, step: step === "code_prompt" ? "code_prompt" : "email_submitted" };
  }

  if (step === "email" && !submitted) {
    const freshEmail = await waitForEmailInput(nextPage, 2_000);
    if (freshEmail) {
      await progressSafeFocus(freshEmail);
      await nextPage.keyboard.press("Enter");
      submitted = true;
      await nextPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
      nextPage = await resolveAuthPageAfterSubmit(browser, nextPage);
      step = await detectLoginStepWithRetry(nextPage, 8_000);
      if (step === "logged_out_home") {
        return { ok: false, authPage: nextPage, step };
      }
      if (step === "code_prompt" || submitted) {
        return { ok: true, authPage: nextPage, step: step === "code_prompt" ? "code_prompt" : "email_submitted" };
      }
    }
  }

  return { ok: false, authPage: nextPage, step };
}

function progressSafeFocus(handle) {
  return handle.focus().catch((error) => {
    if (isNavigationContextError(error)) return;
    throw error;
  });
}

const OTP_INPUT_SELECTORS = [
  'input[name="code"]',
  'input[autocomplete="one-time-code"]',
  'input[inputmode="numeric"]',
  'input[placeholder*="code" i]',
  'input[aria-label*="code" i]',
  'input[maxlength="6"]',
  'input[maxlength="8"]',
];

async function findVisibleOtpInput(root) {
  for (const selector of OTP_INPUT_SELECTORS) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await evaluateHandleSafe(handle, (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (visible) return handle;
  }
  return null;
}

async function waitForOtpInput(page, timeoutMs = 60_000, progress = null, label = "Waiting for code prompt") {
  const deadline = Date.now() + timeoutMs;
  let lastCaptureMs = 0;
  while (Date.now() < deadline) {
    if (progress && Date.now() - lastCaptureMs >= PREVIEW_CAPTURE_INTERVAL_MS) {
      await progress.screenshot(page, label);
      lastCaptureMs = Date.now();
    }

    const onPage = await findVisibleOtpInput(page);
    if (onPage) return onPage;

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const inFrame = await findVisibleOtpInput(frame);
        if (inFrame) return inFrame;
      } catch {
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function waitForAuthEmailField(page, timeoutMs = 45_000) {
  return waitForEmailInput(page, timeoutMs);
}

export function pickOpenRouterKey(env) {
  return String(
    env.OPENROUTER_API_KEY ??
      env.NEO_PULSE_APP_OPENROUTER_API_KEY ??
      env.OPEN_ROUTER_API_KEY ??
      "",
  ).trim();
}

function pickOpenRouterModel(env) {
  return String(
    env.CHATGPT_AUDIT_OPENROUTER_MODEL ??
      env.OPENROUTER_MODEL ??
      env.NEO_PULSE_APP_OPENROUTER_MODEL ??
      "google/gemini-2.5-flash",
  ).trim();
}

/** @typedef {{ fullName: string, age: number }} OnboardingProfile */

export async function generateOnboardingProfile(env = resolveEnv()) {
  const apiKey = pickOpenRouterKey(env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for ChatGPT onboarding profile generation.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie ChatGPT Audit",
    },
    body: JSON.stringify({
      model: pickOpenRouterModel(env),
      temperature: 0.9,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Generate one plausible fictional person for a generic web signup form. " +
            "Return JSON only: { \"fullName\": string, \"age\": number }. " +
            "fullName must be two common words (first and last). age must be an integer from 25 to 55.",
        },
        { role: "user", content: "Generate one profile." },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter onboarding profile failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter onboarding profile returned invalid JSON.");
  }

  const fullName = String(parsed?.fullName ?? "").trim();
  const age = Number(parsed?.age);
  if (!fullName || !Number.isInteger(age) || age < 18 || age > 80) {
    throw new Error("OpenRouter onboarding profile returned an invalid fullName or age.");
  }

  return { fullName, age };
}

async function findVisibleInputMatching(root, hints) {
  const selectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="number"]',
    'input[inputmode="numeric"]',
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
  ];
  for (const selector of selectors) {
    const handles = await root.$$(selector);
    for (const handle of handles) {
      const matches = await handle.evaluate((el, hintList) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 8 || rect.height <= 8) return false;
        const haystack = [
          el.getAttribute("placeholder"),
          el.getAttribute("name"),
          el.getAttribute("id"),
          el.getAttribute("aria-label"),
          el.getAttribute("autocomplete"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hintList.some((hint) => haystack.includes(hint));
      }, hints);
      if (matches) return handle;
    }
  }
  return null;
}

async function pageShowsOnboardingProfile(page) {
  const hasCopy = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
    return text.includes("how old are you") || text.includes("full name");
  });
  if (!hasCopy) return false;
  const nameInput = await findVisibleInputMatching(page, ["name"]);
  const ageInput = await findVisibleInputMatching(page, ["age"]);
  return Boolean(nameInput && ageInput);
}

async function fillInputValue(handle, page, value) {
  await handle.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await handle.type(String(value), { delay: 12 });
  let current = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (current !== String(value).trim()) {
    await handle.evaluate((el, nextValue) => {
      if (!("value" in el)) return;
      el.value = nextValue;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(value).trim());
    current = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  return current === String(value).trim();
}

async function completeOnboardingProfile(page, progress, env) {
  if (!(await pageShowsOnboardingProfile(page))) return false;

  progress.step("Completing profile setup");
  const profile = await generateOnboardingProfile(env);
  progress.step(`Profile: ${profile.fullName}, age ${profile.age}`);

  const nameInput = await findVisibleInputMatching(page, ["name"]);
  const ageInput = await findVisibleInputMatching(page, ["age"]);
  if (!nameInput || !ageInput) {
    throw new Error("ChatGPT profile setup fields were not found.");
  }

  const nameFilled = await fillInputValue(nameInput, page, profile.fullName);
  const ageFilled = await fillInputValue(ageInput, page, profile.age);
  if (!nameFilled || !ageFilled) {
    throw new Error("Could not fill ChatGPT profile setup fields.");
  }

  await progress.screenshot(page, "Profile fields filled");
  const clicked = await clickContinueButton(page);
  if (!clicked) {
    throw new Error("Could not submit ChatGPT profile setup form.");
  }

  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  await progress.screenshot(page, "Profile setup submitted");
  return true;
}

export async function loginChatGpt(page, progress, { email, agentmailApiKey, agentmailInbox, env = resolveEnv() }) {
  progress.step("Opening ChatGPT");
  await gotoChatGpt(page, defaultChatGptUrl, { waitForComposer: false });
  await progress.screenshot(page, "Opening ChatGPT", { force: true });

  if (await isComposerReady(page)) {
    progress.step("Already logged in");
    await progress.screenshot(page, "Already logged in", { force: true });
    await saveSessionCookies(page);
    return;
  }

  clearSessionFile();
  await clearBrowserCookies(page);
  await gotoChatGpt(page, defaultChatGptUrl, { waitForComposer: false });
  await progress.screenshot(page, "Fresh ChatGPT session", { force: true });

  progress.step("Starting login");
  await waitWithProgressScreenshots(page, progress, "Loading ChatGPT", 5_000);

  const loginClicked = await waitForLoginButtonAndClick(page, progress, 45_000);
  if (!loginClicked) {
    await progress.screenshot(page, "Log in button not found");
    throw new Error(`Could not find ChatGPT Log in button. Current URL: ${page.url()}`);
  }

  progress.step("Log in clicked");
  await progress.screenshot(page, "Log in clicked");
  await Promise.race([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 20_000)),
  ]);

  let authPage = await waitForAuthLoginPage(page, progress, 45_000, { allowHomeModal: true });
  if (!authPage) {
    await progress.screenshot(page, "Auth login page not reached");
    throw new Error(`Auth login page did not open after Log in. Current URL: ${page.url()}`);
  }

  progress.step("Login screen");
  await progress.screenshot(authPage, "Login screen");

  const emailHandle = await waitForAuthEmailField(authPage, 45_000);
  if (!emailHandle) {
    clearSessionFile();
    await progress.screenshot(authPage, "Email input not found");
    throw new Error(`Could not find email field on auth login page. Current URL: ${authPage.url()}`);
  }

  progress.step("Entering email");
  await emailHandle.click({ clickCount: 3 });
  await authPage.keyboard.press("Backspace");
  await emailHandle.type(email, { delay: 15 });
  let emailValue = await emailHandle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (emailValue !== email.trim()) {
    await emailHandle.evaluate((el, nextEmail) => {
      if (!("value" in el)) return;
      el.value = nextEmail;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, email.trim());
    emailValue = await emailHandle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  if (emailValue !== email.trim()) {
    await progress.screenshot(authPage, "Email entry failed");
    throw new Error(`Could not enter email on auth login page. Current URL: ${authPage.url()}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
  const emailScreenshotLabel = `Email entered: ${email}`;
  progress.step(emailScreenshotLabel);
  await progress.screenshot(authPage, emailScreenshotLabel);

  const loginStartedAt = Date.now();
  progress.step("Submitting email");
  const submitResult = await submitEmailOnce(authPage, emailHandle, progress);
  authPage = submitResult.authPage;
  if (!submitResult.ok) {
    await progress.screenshot(authPage, "Email submit failed");
    if (submitResult.step === "logged_out_home") {
      throw new Error("Email submit closed the login modal and returned to the ChatGPT homepage. OpenAI did not send a verification email.");
    }
    throw new Error("Could not click Continue on the auth login page.");
  }
  progress.step("Email submitted");
  await progress.screenshot(authPage, "Email submitted");

  progress.step("Waiting for code prompt");
  await waitWithProgressScreenshots(authPage, progress, "Waiting for code prompt", 3_000);
  const otpHandle = await waitForOtpInput(authPage, 60_000, progress, "Waiting for code prompt");
  if (!otpHandle) {
    await progress.screenshot(authPage, "Code prompt not shown");
    throw new Error("ChatGPT did not show the verification code prompt after email submit.");
  }
  await progress.screenshot(authPage, "Code prompt ready");

  const otp = await pollAgentMailOtp(agentmailApiKey, agentmailInbox, loginStartedAt, progress, authPage);
  progress.step("Entering login code");
  const otpFilled = await fillOtpOnAuthPage(authPage, otp);
  if (!otpFilled) {
    await progress.screenshot(authPage, "Login code entry failed");
    throw new Error("Could not enter ChatGPT verification code.");
  }
  await progress.screenshot(authPage, "Entering login code");

  progress.step("Submitting login code");
  await submitOtpOnAuthPage(authPage, otp);
  await progress.screenshot(authPage, "Submitting login code");

  if (!isAuthLoginUrl(page.url()) && (await isComposerReady(page))) {
    await saveSessionCookies(page);
    return;
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const activePage = isAuthLoginUrl(page.url()) ? page : authPage;
    if (await completeOnboardingProfile(page, progress, env)) {
      await waitWithProgressScreenshots(page, progress, "Finishing login", 2_000);
      continue;
    }
    if (activePage !== page && (await pageShowsOnboardingProfile(activePage))) {
      await completeOnboardingProfile(activePage, progress, env);
      await waitWithProgressScreenshots(page, progress, "Finishing login", 2_000);
      continue;
    }
    if (await isComposerReady(page)) {
      progress.step("Logged in");
      await progress.screenshot(page, "Logged in");
      await saveSessionCookies(page);
      return;
    }
    if (activePage !== page && (await isComposerReady(activePage))) {
      progress.step("Logged in");
      await progress.screenshot(activePage, "Logged in");
      await saveSessionCookies(activePage);
      return;
    }
    if (!isAuthLoginUrl(page.url()) && !page.url().includes("chatgpt.com")) {
      await gotoChatGpt(page, defaultChatGptUrl);
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  throw new Error("ChatGPT login did not reach the composer.");
}

async function clickNewChatButton(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("a, button, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      if (text !== "new chat" && !text.startsWith("new chat ")) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!(best instanceof HTMLElement)) return false;
    best.click();
    return true;
  });
}

async function tryNewChatKeyboardShortcut(page) {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.keyboard.down("Shift");
  await page.keyboard.press("o");
  await page.keyboard.up("Shift");
  await page.keyboard.up(modifier);
}

export async function startNewChat(page, progress) {
  progress?.step("Starting new chat");
  await progress?.screenshot(page, "Starting new chat", { force: true });

  const clicked = await clickNewChatButton(page);
  if (!clicked) {
    await tryNewChatKeyboardShortcut(page);
  }

  let deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) {
      progress?.step("New chat ready");
      await progress?.screenshot(page, "New chat ready", { force: true });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  progress?.step("New chat reload (proxy heavy)");
  await gotoChatGpt(page, defaultChatGptUrl);

  deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) {
      progress?.step("New chat ready");
      await progress?.screenshot(page, "New chat ready", { force: true });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  throw new Error("ChatGPT new chat composer did not become ready.");
}

const CHATGPT_AUDIT_RESPONSE_RULES =
  "Keep the reply relatively short and scannable. Do not use horizontal line separators (--- or hr). " +
  "Put your full answer in one markdown code block only (```markdown ... ```).";

/** @param {string} pageUrl */
function inferChatGptAuditPageKind(pageUrl) {
  try {
    const path = new URL(pageUrl).pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || /^\/(index\.html?|home)$/i.test(path)) return "homepage";
    if (
      /\/(blog|news|articles?|post|posts)\/[^/]+/i.test(path) ||
      /\/\d{4}\/\d{2}\/[^/]+/.test(path)
    ) {
      return "article";
    }
    return "page";
  } catch {
    return "page";
  }
}

/**
 * OpenRouter: one natural ChatGPT user message for a specific page URL + audit question.
 * @param {{ clientName?: string, pageUrl: string, question: string }} input
 */
export async function composeChatGptAuditPrompt(input, env = resolveEnv()) {
  const pageUrl = String(input?.pageUrl ?? "").trim();
  const question = String(input?.question ?? "").trim();
  const clientName = String(input?.clientName ?? "").trim();
  if (!pageUrl) throw new Error("Missing page URL for ChatGPT audit prompt.");
  if (!question) throw new Error("Missing audit question for ChatGPT audit prompt.");

  const apiKey = pickOpenRouterKey(env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for ChatGPT audit prompt composition.");
  }

  const pageKind = inferChatGptAuditPageKind(pageUrl);
  const userLines = [
    `Page URL: ${pageUrl}`,
    `Page kind hint: ${pageKind}`,
    `Audit question: ${question}`,
  ];
  if (clientName) userLines.unshift(`Client name: ${clientName}`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie ChatGPT Audit",
    },
    body: JSON.stringify({
      model: pickOpenRouterModel(env),
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Write one ChatGPT user message for an AISEO audit. Return JSON only: { \"prompt\": string }. " +
            "Sound like a real person asking a colleague — direct, natural, not a template. " +
            "Include the full page URL once. Refer to what is on this specific URL or this specific web page " +
            "(never say website alone). " +
            "Use the page kind hint: for homepage use homepage/main page/language like that; " +
            "never call a homepage an article or blog post. For article, article/post is fine. " +
            "For page, say page or contents at this URL — do not assume it is an article. " +
            "Weave the audit question in naturally; do not add labels like Website: or Question:. " +
            "Do not use stiff phrases like article found at unless the URL is clearly an article and it fits. " +
            "Prefer the contents of this URL or what is on this page when unsure. " +
            "Preserve the intent of the audit question without copying it word-for-word if it sounds robotic. " +
            `End the prompt by telling ChatGPT: ${CHATGPT_AUDIT_RESPONSE_RULES}`,
        },
        { role: "user", content: userLines.join("\n") },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter audit prompt failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter audit prompt returned invalid JSON.");
  }

  const prompt = String(parsed?.prompt ?? "").trim();
  if (!prompt) throw new Error("OpenRouter audit prompt returned an empty prompt.");
  if (!prompt.includes(pageUrl)) {
    throw new Error("OpenRouter audit prompt did not include the page URL.");
  }
  if (/^\s*(website|question)\s*:/im.test(prompt)) {
    throw new Error("OpenRouter audit prompt used forbidden Website:/Question: labels.");
  }
  if (pageKind === "homepage" && /\barticle\b/i.test(prompt)) {
    throw new Error("OpenRouter audit prompt incorrectly called a homepage an article.");
  }
  if (!prompt.includes("```markdown")) {
    return `${prompt} ${CHATGPT_AUDIT_RESPONSE_RULES}`;
  }
  return prompt;
}

const COMPOSER_SELECTOR =
  '#prompt-textarea, [contenteditable="true"]#prompt-textarea, div[contenteditable="true"]';

async function focusComposer(page) {
  await page.waitForSelector(COMPOSER_SELECTOR, { timeout: 10_000 });
  await page.click(COMPOSER_SELECTOR);
}

async function isSendButtonEnabled(page) {
  return page.evaluate(() => {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
    ];
    for (const selector of selectors) {
      for (const send of document.querySelectorAll(selector)) {
        if (send instanceof HTMLButtonElement && !send.disabled) return true;
      }
    }
    const composer = document.querySelector("#prompt-textarea, [contenteditable=\"true\"]");
    const form = composer?.closest("form");
    if (form) {
      const submit = form.querySelector("button:not([disabled])");
      if (submit instanceof HTMLButtonElement) return true;
    }
    return false;
  });
}

export function composerSubmitLooksAccepted(snapshot, baseline) {
  if (snapshot.generating) return true;
  if (snapshot.userMessageCount > baseline.userMessageCount) return true;
  const typedLen = baseline.composerText.trim().length;
  const currentLen = snapshot.composerText.trim().length;
  if (typedLen >= 20 && currentLen < 20) return true;
  if (typedLen > 0 && typedLen < 20 && currentLen === 0) return true;
  return false;
}

export async function readComposerSnapshot(page) {
  return page.evaluate(() => {
    const composer = document.querySelector(
      '#prompt-textarea, [contenteditable="true"]#prompt-textarea, div[contenteditable="true"]',
    );
    let composerText = "";
    if (composer instanceof HTMLTextAreaElement) composerText = composer.value.trim();
    else if (composer instanceof HTMLElement) {
      composerText = (composer.innerText ?? composer.textContent ?? "").trim();
    }
    const userMessageCount = document.querySelectorAll('[data-message-author-role="user"]').length;
    const generating = Boolean(
      document.querySelector(
        'button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label*="Stop"]',
      ),
    );
    return { composerText, userMessageCount, generating };
  });
}

export async function readAssistantMessageCount(page) {
  return page.evaluate(
    () => document.querySelectorAll('[data-message-author-role="assistant"]').length,
  );
}

export async function assertComposerSubmitted(page, baseline) {
  const submitBaseline =
    baseline ??
    (await readComposerSnapshot(page).then((snapshot) => ({
      composerText: snapshot.composerText,
      userMessageCount: snapshot.userMessageCount,
    })));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const snapshot = await readComposerSnapshot(page);
    if (composerSubmitLooksAccepted(snapshot, submitBaseline)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("ChatGPT did not accept the prompt (composer still has text).");
}

export async function typeIntoComposer(page, text) {
  await focusComposer(page);
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 4 });

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await isSendButtonEnabled(page)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("ChatGPT send button did not enable after typing the prompt.");
}

export async function submitComposer(page, baseline) {
  const submitBaseline =
    baseline ??
    (await readComposerSnapshot(page).then((snapshot) => ({
      composerText: snapshot.composerText,
      userMessageCount: snapshot.userMessageCount,
    })));
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const clicked = await page.evaluate(() => {
      const selectors = [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send"]',
        'button[aria-label*="Send"]',
      ];
      for (const selector of selectors) {
        for (const send of document.querySelectorAll(selector)) {
          if (send instanceof HTMLButtonElement && !send.disabled) {
            send.click();
            return true;
          }
        }
      }
      return false;
    });
    if (clicked) {
      await assertComposerSubmitted(page, submitBaseline);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await page.keyboard.press("Enter");
  await assertComposerSubmitted(page, submitBaseline);
}

export async function readLatestAssistantText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const last = nodes[nodes.length - 1];
    if (!last) return "";
    const markdown =
      last.querySelector(".markdown, [class*=\"markdown\"], .prose, [data-testid=\"conversation-turn\"] .markdown");
    return (markdown?.textContent ?? last.textContent ?? "").trim();
  });
}

export async function waitForAssistantReply(page, progress, baseline = {}) {
  const opts = typeof baseline === "string" ? { previousText: baseline } : baseline;
  const previousText = opts.previousText ?? "";
  const previousAssistantCount = opts.previousAssistantCount ?? 0;
  progress.step("Waiting for ChatGPT reply");
  const deadline = Date.now() + 300_000;
  const waitStarted = Date.now();
  let lastText = previousText;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const current = await readLatestAssistantText(page);
    const assistantCount = await readAssistantMessageCount(page);
    const hasNewAssistantTurn =
      assistantCount > previousAssistantCount && current.trim().length > 0;
    if (!hasNewAssistantTurn && Date.now() - waitStarted >= 90_000) {
      const snap = await readComposerSnapshot(page);
      if (snap.composerText.trim().length >= 20) {
        throw new Error("ChatGPT never started a reply; the prompt is still in the composer.");
      }
    }
    if (hasNewAssistantTurn && current !== previousText) {
      if (current === lastText) {
        if (stableSince === 0) stableSince = Date.now();
        if (Date.now() - stableSince >= 2_000) {
          progress.step("Reply received");
          await progress.screenshot(page, "Reply received", { force: true });
          return current;
        }
      } else {
        lastText = current;
        stableSince = 0;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, REPLY_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for ChatGPT reply.");
}

export function readNewQueryEntries(queriesPath, processedIds) {
  if (!queriesPath || !fs.existsSync(queriesPath)) return [];
  const lines = fs.readFileSync(queriesPath, "utf8").split(/\r?\n/).filter(Boolean);
  /** @type {Array<{ id: string, text: string, enqueuedAt?: string }>} */
  const fresh = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const id = String(entry?.id ?? "").trim();
      const text = String(entry?.text ?? "").trim();
      if (!id || !text || processedIds.has(id)) continue;
      fresh.push({
        id,
        text,
        clientUrl: String(entry?.clientUrl ?? "").trim(),
        enqueuedAt: entry.enqueuedAt,
      });
    } catch {
      // ignore bad lines
    }
  }
  return fresh;
}

export function readControlPayload(controlPath) {
  if (!controlPath || !fs.existsSync(controlPath)) {
    return { action: "", clientUrl: "" };
  }
  try {
    const data = JSON.parse(fs.readFileSync(controlPath, "utf8"));
    return {
      action: String(data?.action ?? "").trim().toLowerCase(),
      clientUrl: String(data?.clientUrl ?? "").trim(),
    };
  } catch {
    return { action: "", clientUrl: "" };
  }
}

export function readControlAction(controlPath) {
  return readControlPayload(controlPath).action;
}

export function clearControlFile(controlPath) {
  if (controlPath && fs.existsSync(controlPath)) {
    fs.unlinkSync(controlPath);
  }
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

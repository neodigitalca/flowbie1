import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { loadEnv as loadRootEnv } from "../chatgpt-audit/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..", "..", "..");
export const envPath = path.join(repoRoot, ".env.residential-proxy");

export function loadResidentialProxyEnv(filePath = envPath) {
  const rootEnvPath = path.join(repoRoot, ".env");
  const override = process.env.RESIDENTIAL_PROXY_ENV_FILE?.trim();
  return {
    ...loadRootEnv(rootEnvPath),
    ...loadRootEnv(filePath),
    ...(override ? loadRootEnv(override) : {}),
  };
}

export function resolveResidentialProxyEnv(overrides = {}) {
  const env = loadResidentialProxyEnv();
  for (const [key, value] of Object.entries(process.env)) {
    if (value && !(key in env)) env[key] = value;
  }
  return { ...env, ...overrides };
}

export function proxyConfigFromEnv(env = resolveResidentialProxyEnv()) {
  return {
    host: String(env.OXYLABS_PROXY_HOST ?? "pr.oxylabs.io").trim(),
    port: String(env.OXYLABS_PROXY_PORT ?? "7777").trim(),
    username: String(env.OXYLABS_PROXY_USERNAME ?? "").trim(),
    password: String(env.OXYLABS_PROXY_PASSWORD ?? "").trim(),
  };
}

export function isProxyConfigured(env = resolveResidentialProxyEnv()) {
  const config = proxyConfigFromEnv(env);
  return Boolean(config.host && config.port && config.username && config.password);
}

export function requireProxyEnv(env = resolveResidentialProxyEnv()) {
  const config = proxyConfigFromEnv(env);
  if (!config.username || !config.password) {
    throw new Error("Missing OXYLABS_PROXY_USERNAME or OXYLABS_PROXY_PASSWORD. Copy .env.residential-proxy.example to .env.residential-proxy.");
  }
  return config;
}

function proxyServerLaunchArg(config) {
  return `--proxy-server=http://${config.host}:${config.port}`;
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function setupPage(page, config = null) {
  await page.setUserAgent(DEFAULT_UA);
  if (config?.username && config?.password) {
    await page.authenticate({
      username: config.username,
      password: config.password,
    });
  }
}

async function launchPuppeteer({ headed, useProxy, env }) {
  const args = ["--disable-blink-features=AutomationControlled"];
  let config = null;
  if (useProxy) {
    config = requireProxyEnv(env);
    args.push(proxyServerLaunchArg(config));
  }
  const browser = await puppeteer.launch({
    headless: !headed,
    defaultViewport: { width: 1440, height: 900 },
    args,
  });
  const page = await browser.newPage();
  await setupPage(page, config);
  return { browser, page, config };
}

export async function launchBrowserDirect(options = {}) {
  return launchPuppeteer({ headed: Boolean(options.headed), useProxy: false, env: options.env });
}

export async function launchBrowserWithResidentialProxy(options = {}) {
  const launched = await launchPuppeteer({
    headed: Boolean(options.headed),
    useProxy: true,
    env: options.env,
  });
  return launched;
}

/**
 * @param {{ useProxy?: boolean, headed?: boolean, env?: Record<string, string> }} options
 */
export async function launchBrowser(options = {}) {
  return launchPuppeteer({
    headed: Boolean(options.headed),
    useProxy: Boolean(options.useProxy),
    env: options.env,
  });
}

export async function probeResidentialProxy(options = {}) {
  if (!isProxyConfigured(options.env)) {
    return { ok: false, configured: false, error: "Residential proxy is not configured." };
  }
  let browser;
  try {
    const launched = await launchBrowserWithResidentialProxy({ ...options, headed: false });
    browser = launched.browser;
    const page = launched.page;
    await page.goto("https://api.ipify.org?format=json", { waitUntil: "networkidle2", timeout: 60_000 });
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    let ip = "";
    try {
      ip = JSON.parse(text).ip ?? "";
    } catch {
      ip = text.trim();
    }
    const config = proxyConfigFromEnv(options.env);
    return {
      ok: true,
      configured: true,
      host: config.host,
      port: config.port,
      username: config.username.replace(/(.{2}).+/, "$1***"),
      ip: ip || undefined,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Residential proxy probe failed.",
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

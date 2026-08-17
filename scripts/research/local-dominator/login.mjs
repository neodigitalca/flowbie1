#!/usr/bin/env node
/**
 * Log into Local Dominator with credentials from .env.localdominator.
 */

import puppeteer from "puppeteer";
import {
  applySessionCookies,
  defaultLoginUrl,
  requireEnv,
  resolveEnv,
  saveSessionCookies,
  submitLogin,
} from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const headed = args.has("--headed");
const saveSession = args.has("--save-session");

async function main() {
  const env = resolveEnv();
  const email = requireEnv("LOCAL_DOMINATOR_EMAIL", env);
  const password = requireEnv("LOCAL_DOMINATOR_PASSWORD", env);
  const loginUrl = env.LOCAL_DOMINATOR_LOGIN_URL?.trim() || defaultLoginUrl;

  const browser = await puppeteer.launch({
    headless: !headed,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await applySessionCookies(page);

  console.log(`Opening ${loginUrl}`);
  await submitLogin(page, email, password, loginUrl);

  const finalUrl = page.url();
  const pathname = new URL(finalUrl).pathname;

  if (pathname.includes("/dashboard")) {
    console.log("Login succeeded.");
    console.log(`URL: ${finalUrl}`);
    console.log(`Title: ${await page.title()}`);
  } else {
    console.log("Login completed.");
    console.log(`URL: ${finalUrl}`);
    console.log(`Title: ${await page.title()}`);
  }

  if (saveSession) {
    await saveSessionCookies(page);
    console.log("Saved session cookies.");
  }

  if (headed) {
    console.log("Headed mode: browser stays open for 30s.");
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

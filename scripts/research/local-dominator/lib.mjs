import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..", "..", "..");
export const envPath = path.join(repoRoot, ".env.localdominator");
export const sessionPath = path.join(repoRoot, ".localdominator-session.json");
export const defaultLoginUrl = "https://app.localdominator.co/login/";
export const defaultDashboardUrl = "https://app.localdominator.co/dashboard/";

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

export function resolveEnv(overrides = {}) {
  const env = loadEnv();
  for (const [key, value] of Object.entries(process.env)) {
    if (value && !(key in env)) env[key] = value;
  }
  return { ...env, ...overrides };
}

export function requireEnv(name, env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.localdominator.example to .env.localdominator.`);
  }
  return value;
}

/** @typedef {{ step: (label: string) => void, screenshot: (page: import("puppeteer").Page, label: string) => Promise<void>, done: (payload: Record<string, unknown>) => void, error: (message: string) => void }} ProgressWriter */

/** @returns {ProgressWriter} */
export function createProgressWriter(progressPath) {
  if (!progressPath) {
    return {
      step() {},
      async screenshot() {},
      done() {},
      error() {},
    };
  }

  const write = (payload) => {
    fs.appendFileSync(progressPath, `${JSON.stringify(payload)}\n`, "utf8");
  };

  return {
    step(label) {
      write({ type: "step", label });
    },
    async screenshot(page, label) {
      const jpegBase64 = await page.screenshot({
        type: "jpeg",
        quality: 72,
        encoding: "base64",
      });
      write({ type: "screenshot", label, pngBase64: jpegBase64, mime: "image/jpeg" });
    },
    done(payload) {
      write({ type: "done", ...payload });
    },
    error(message) {
      write({ type: "error", message });
    },
  };
}

const PREVIEW_CAPTURE_INTERVAL_MS = 1_000;

export async function waitWithProgressScreenshots(page, progress, label, totalMs, intervalMs = PREVIEW_CAPTURE_INTERVAL_MS) {
  if (!page || !progress || totalMs <= 0) {
    await new Promise((resolve) => setTimeout(resolve, totalMs));
    return;
  }
  const started = Date.now();
  while (Date.now() - started < totalMs) {
    await progress.screenshot(page, label);
    const remaining = totalMs - (Date.now() - started);
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
}

export async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(
    selector,
    (el, nextValue) => {
      if (!(el instanceof HTMLInputElement)) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (setter) {
        setter.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

export async function clickButtonByText(page, label) {
  const clicked = await page.evaluate((buttonLabel) => {
    const button = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === buttonLabel,
    );
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, label);
  if (!clicked) {
    throw new Error(`Button not found: ${label}`);
  }
}

async function waitForPasswordField(page) {
  return page
    .waitForSelector('input[name="password"]', { visible: true, timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
}

async function bootstrapEmailPassword(page, email, password) {
  await page.goto(
    `https://app.localdominator.co/set-password?email=${encodeURIComponent(email)}`,
    { waitUntil: "networkidle2", timeout: 60_000 },
  );
  await fillInput(page, 'input[name="password"]', password);
  await fillInput(page, 'input[name="repeatPassword"]', password);
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === "Save password",
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 }).catch(() => null),
    clickButtonByText(page, "Save password"),
  ]);
}

export async function submitLogin(
  page,
  email,
  password,
  loginUrl = defaultLoginUrl,
  progress = null,
) {
  progress?.step("Logging in");
  await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60_000 });

  let pathname = new URL(page.url()).pathname;
  if (!pathname.includes("/login") && !pathname.includes("/set-password")) {
    progress?.step("Logged in");
    await progress?.screenshot(page, "Logged in");
    return;
  }

  await page.waitForSelector('input[name="email"]', { visible: true, timeout: 60_000 });
  await fillInput(page, 'input[name="email"]', email);
  await progress?.screenshot(page, "Logging in");

  let hasPasswordField = await waitForPasswordField(page);
  if (!hasPasswordField) {
    await bootstrapEmailPassword(page, email, password);
    await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60_000 });
    await page.waitForSelector('input[name="email"]', { visible: true, timeout: 60_000 });
    await fillInput(page, 'input[name="email"]', email);
    hasPasswordField = await waitForPasswordField(page);
  }

  if (!hasPasswordField) {
    throw new Error(
      "Password field did not appear after email entry. This account may require Google login.",
    );
  }

  await fillInput(page, 'input[name="password"]', password);
  await progress?.screenshot(page, "Submitting login");
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  pathname = new URL(page.url()).pathname;
  if (pathname.includes("/login") || pathname.includes("/set-password")) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    throw new Error(`Login did not reach dashboard.\n${bodyText}`);
  }

  progress?.step("Logged in");
  await progress?.screenshot(page, "Logged in");
}

export async function applySessionCookies(page) {
  if (!fs.existsSync(sessionPath)) return;
  const cookies = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  if (Array.isArray(cookies) && cookies.length > 0) {
    await page.setCookie(...cookies);
  }
}

export async function saveSessionCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(sessionPath, `${JSON.stringify(cookies, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeLocalDominatorBusinessName(businessName) {
  const trimmed = String(businessName ?? "").trim();
  const pipeIdx = trimmed.indexOf(" | ");
  if (pipeIdx > 0) return trimmed.slice(0, pipeIdx).trim();
  return trimmed;
}

export async function getDashboardContentFrame(page, dashboardUrl = defaultDashboardUrl, progress = null) {
  progress?.step("Loading dashboard");
  await page.goto(
    "https://app.localdominator.co/dashboard/?selectedOptions=History&selectedDropdown=Live%20Heat%20Map&",
    { waitUntil: "networkidle2", timeout: 60_000 },
  );
  await page.waitForFunction(
    () => [...document.querySelectorAll("iframe")].some((frame) => {
      const src = frame.getAttribute("src") ?? "";
      return src.includes("dashboard-content");
    }),
    { timeout: 60_000 },
  );
  await waitWithProgressScreenshots(page, progress, "Loading dashboard", 2000);
  const frame = page.frames().find((item) => item.url().includes("dashboard-content"));
  if (!frame) {
    throw new Error("Local Dominator dashboard content frame not found.");
  }
  await frame.waitForSelector('input[placeholder="Search business or keyword"]', {
    visible: true,
    timeout: 60_000,
  });
  progress?.step("Dashboard ready");
  await progress?.screenshot(page, "Dashboard ready");
  return frame;
}

async function findSearchInput(frame) {
  return frame.waitForSelector('input[placeholder="Search business or keyword"]', {
    visible: true,
    timeout: 30_000,
  });
}

export async function openGridScan(frame, businessName, keyword, page = null, progress = null) {
  businessName = normalizeLocalDominatorBusinessName(businessName);
  progress?.step(`Opening grid scan for ${businessName}`);
  const keywordFilter = String(keyword ?? "").trim();

  async function searchAndOpen() {
    const searchInput = await findSearchInput(frame);
    await searchInput.click({ clickCount: 3 });
    await frame.evaluate((selector) => {
      const input = document.querySelector(selector);
      if (input instanceof HTMLInputElement) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, 'input[placeholder="Search business or keyword"]');
    await searchInput.type(businessName, { delay: 20 });
    if (page && progress) {
      await waitWithProgressScreenshots(page, progress, `Searching for ${businessName}`, 2000);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return frame.evaluate(
      (business, kw) => {
        const rows = [...document.querySelectorAll("tr, [role='row']")].filter((node) => {
          const text = node.textContent ?? "";
          return text.includes(business) && (!kw || text.toLowerCase().includes(kw.toLowerCase()));
        });
        const preferred =
          rows.find((row) => !(row.textContent ?? "").includes("Running")) ??
          rows[0];
        if (!preferred) {
          const fallback = [...document.querySelectorAll("a, button, td, div")].find((node) => {
            const text = node.textContent ?? "";
            return (
              text.includes(business) &&
              (!kw || text.toLowerCase().includes(kw.toLowerCase())) &&
              !text.includes("Running")
            );
          });
          if (!(fallback instanceof HTMLElement)) return false;
          fallback.click();
          return true;
        }
        const link = [...preferred.querySelectorAll("a, button, td, div")].find((node) => {
          const text = (node.textContent ?? "").trim();
          return text.includes(business) || /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(text);
        });
        (link instanceof HTMLElement ? link : preferred).click();
        return true;
      },
      businessName,
      keywordFilter,
    );
  }

  async function openFirstAvailableGridRow() {
    return frame.evaluate(() => {
      const rows = [...document.querySelectorAll("tr, [role='row']")].filter((node) => {
        const text = (node.textContent ?? "").trim();
        return text !== "" && !text.includes("Running");
      });
      const preferred = rows[0];
      if (!preferred) return false;
      const link = [...preferred.querySelectorAll("a, button, td, div")].find((node) => {
        const text = (node.textContent ?? "").trim();
        return /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(text) || text.length > 0;
      });
      (link instanceof HTMLElement ? link : preferred).click();
      return true;
    });
  }

  let opened = await searchAndOpen();
  if (!opened) {
    await frame.evaluate(() => {
      [...document.querySelectorAll("button, a, [role='tab']")].find((el) =>
        (el.textContent ?? "").includes("Scheduled"),
      )?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    opened = await searchAndOpen();
  }

  if (!opened && !keywordFilter) {
    progress?.step("Using first available grid scan");
    opened = await openFirstAvailableGridRow();
  }

  if (!opened) {
    throw new Error(
      `Could not find grid scan row for ${businessName}${keywordFilter ? ` (${keywordFilter})` : ""}.`,
    );
  }

  if (page && progress) {
    await waitWithProgressScreenshots(page, progress, "Grid scan opened", 4000);
  } else {
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  progress?.step("Grid scan opened");
  if (page) {
    await progress?.screenshot(page, "Grid scan opened");
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectExportSearchFrames(page, listFrame) {
  const ordered = [];
  const seen = new Set();
  const add = (frame) => {
    if (!frame || seen.has(frame)) return;
    seen.add(frame);
    ordered.push(frame);
  };

  for (const frame of page.frames()) {
    if (frame.url().includes("dashboard-content")) add(frame);
  }
  add(listFrame);
  add(page.mainFrame());
  for (const frame of page.frames()) add(frame);
  return ordered;
}

async function clickExportCsvInFrame(frame) {
  return frame.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        "button, a, [role='menuitem'], [role='option'], li, span, div[role='button']",
      ),
    ];
    const item = nodes.find((node) => {
      const normalized = (node.textContent?.trim() ?? "").toLowerCase().replace(/\s+/g, " ");
      const aria = (node.getAttribute("aria-label") ?? "").trim().toLowerCase();
      const title = (node.getAttribute("title") ?? "").trim().toLowerCase();
      const label = [normalized, aria, title].filter(Boolean).join(" ");
      const hasCsv = label.includes("csv");
      const hasExport = label.includes("export") || label.includes("download") || label.includes("save");
      return hasCsv && hasExport;
    });
    if (!(item instanceof HTMLElement)) return false;
    item.click();
    return true;
  });
}

async function openExportOverflowMenu(frame) {
  return frame.evaluate(() => {
    const popupButtons = [
      ...document.querySelectorAll(
        'button[aria-haspopup="true"], button[aria-haspopup="menu"], [aria-haspopup="menu"]',
      ),
    ];
    for (const btn of popupButtons) {
      if (!(btn instanceof HTMLElement)) continue;
      btn.click();
      return true;
    }

    const buttons = [...document.querySelectorAll("button")];
    const runNowIndex = buttons.findIndex((btn) => btn.textContent?.trim() === "Run Now");
    const candidates =
      runNowIndex >= 0
        ? buttons.slice(Math.max(0, runNowIndex - 2), runNowIndex + 3)
        : buttons.filter((btn) => btn.querySelector("svg"));
    const menuButton =
      candidates.find((btn) => {
        const text = (btn.textContent ?? "").trim();
        return text === "" || text.length <= 2;
      }) ??
      [...document.querySelectorAll("button,[role='button']")].find((btn) => {
        const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").trim().toLowerCase();
        return label.includes("more") || label.includes("menu") || label.includes("options");
      });
    if (!(menuButton instanceof HTMLElement)) return false;
    menuButton.click();
    return true;
  });
}

async function exportCsvFromDetailFrame(page, listFrame, progress = null) {
  const searchFrames = async () => {
    const frames = await collectExportSearchFrames(page, listFrame);
    for (const frame of frames) {
      if (await clickExportCsvInFrame(frame)) return true;
    }
    return false;
  };

  if (await searchFrames()) return;

  const menuFrames = await collectExportSearchFrames(page, listFrame);
  for (const frame of menuFrames) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const menuOpened = await openExportOverflowMenu(frame);
      if (!menuOpened) {
        await sleep(400);
        continue;
      }
      await sleep(1200);
      if (await searchFrames()) return;
    }
  }

  if (page && progress) {
    await progress.screenshot(page, 'Menu item "Export as CSV" not found.');
  }
  throw new Error('Menu item "Export as CSV" not found.');
}

async function waitForDownloadFile(downloadDir, timeoutMs = 90_000, page = null, progress = null) {
  const started = Date.now();
  let lastCapture = 0;
  while (Date.now() - started < timeoutMs) {
    const now = Date.now();
    if (page && progress && now - lastCapture >= PREVIEW_CAPTURE_INTERVAL_MS) {
      await progress.screenshot(page, "Waiting for download");
      lastCapture = now;
    }
    const files = fs
      .readdirSync(downloadDir)
      .filter((name) => name.endsWith(".csv") && !name.endsWith(".crdownload"));
    if (files.length > 0) {
      const fileName = files[0];
      const filePath = path.join(downloadDir, fileName);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { fileName, filePath };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("CSV download timed out.");
}

export async function exportLocalDominatorGridCsv(
  page,
  { businessName, keyword, downloadDir, progress = null },
) {
  businessName = normalizeLocalDominatorBusinessName(businessName);
  fs.mkdirSync(downloadDir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  });

  const listFrame = await getDashboardContentFrame(page, defaultDashboardUrl, progress);
  await openGridScan(listFrame, businessName, keyword, page, progress);
  await new Promise((resolve) => setTimeout(resolve, 2500));

  progress?.step("Exporting CSV");
  await progress?.screenshot(page, "Exporting CSV");
  await exportCsvFromDetailFrame(page, listFrame, progress);
  progress?.step("Waiting for download");
  const downloaded = await waitForDownloadFile(downloadDir, 90_000, page, progress);
  const csvContent = fs.readFileSync(downloaded.filePath, "utf8");
  fs.rmSync(downloadDir, { recursive: true, force: true });
  return {
    fileName: downloaded.fileName,
    csvContent,
  };
}

export function buildArchiveFileName(businessName, keyword, fileName) {
  const stamp = Date.now();
  const businessSlug = slugify(businessName) || "grid";
  const keywordSlug = slugify(keyword) || "keyword";
  if (fileName?.endsWith(".csv")) return `research-${businessSlug}-${keywordSlug}-${stamp}.csv`;
  return `research-${businessSlug}-${keywordSlug}-${stamp}.csv`;
}

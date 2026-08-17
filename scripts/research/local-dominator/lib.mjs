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

export async function submitLogin(page, email, password, loginUrl = defaultLoginUrl) {
  await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForSelector('input[name="email"]', { visible: true, timeout: 60_000 });
  await fillInput(page, 'input[name="email"]', email);

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
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  const pathname = new URL(page.url()).pathname;
  if (pathname.includes("/login") || pathname.includes("/set-password")) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    throw new Error(`Login did not reach dashboard.\n${bodyText}`);
  }
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

export async function getDashboardContentFrame(page, dashboardUrl = defaultDashboardUrl) {
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
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const frame = page.frames().find((item) => item.url().includes("dashboard-content"));
  if (!frame) {
    throw new Error("Local Dominator dashboard content frame not found.");
  }
  await frame.waitForSelector('input[placeholder="Search business or keyword"]', {
    visible: true,
    timeout: 60_000,
  });
  return frame;
}

async function findSearchInput(frame) {
  return frame.waitForSelector('input[placeholder="Search business or keyword"]', {
    visible: true,
    timeout: 30_000,
  });
}

export async function openGridScan(frame, businessName, keyword) {
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
      keyword,
    );
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

  if (!opened) {
    throw new Error(`Could not find grid scan row for ${businessName} (${keyword}).`);
  }

  await new Promise((resolve) => setTimeout(resolve, 4000));
}

async function exportCsvFromDetailFrame(frame) {
  const directExport = await frame.evaluate(() => {
    const item = [...document.querySelectorAll("button, a, [role='menuitem']")].find(
      (node) => node.textContent?.trim() === "Export as CSV",
    );
    if (!(item instanceof HTMLElement)) return false;
    item.click();
    return true;
  });
  if (directExport) return;

  const menuOpened = await frame.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const runNowIndex = buttons.findIndex((btn) => btn.textContent?.trim() === "Run Now");
    const candidates =
      runNowIndex >= 0
        ? buttons.slice(Math.max(0, runNowIndex - 2), runNowIndex + 3)
        : buttons.filter((btn) => btn.querySelector("svg"));
    const menuButton = candidates.find((btn) => {
      const text = (btn.textContent ?? "").trim();
      return text === "" || text.length <= 2;
    });
    if (!(menuButton instanceof HTMLButtonElement)) return false;
    menuButton.click();
    return true;
  });

  if (!menuOpened) {
    throw new Error("Could not open grid scan overflow menu.");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  const exportClicked = await frame.evaluate(() => {
    const item = [...document.querySelectorAll("button, a, [role='menuitem']")].find(
      (node) => node.textContent?.trim() === "Export as CSV",
    );
    if (!(item instanceof HTMLElement)) return false;
    item.click();
    return true;
  });

  if (!exportClicked) {
    throw new Error('Menu item "Export as CSV" not found.');
  }
}

async function waitForDownloadFile(downloadDir, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
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

export async function exportLocalDominatorGridCsv(page, { businessName, keyword, downloadDir }) {
  fs.mkdirSync(downloadDir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  });

  const listFrame = await getDashboardContentFrame(page);
  await openGridScan(listFrame, businessName, keyword);

  const detailFrame =
    page.frames().find(
      (item) =>
        item.url().includes("dashboard-content") &&
        !item.url().includes("/history") &&
        !item.url().includes("/scans"),
    ) ??
    page.frames().find((item) => item.url().includes("dashboard-content")) ??
    listFrame;

  await exportCsvFromDetailFrame(detailFrame);
  const downloaded = await waitForDownloadFile(downloadDir);
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

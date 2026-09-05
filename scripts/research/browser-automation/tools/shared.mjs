export const BROWSER_VIEWPORT = { width: 1440, height: 900 };

export const TYPE_DELAY_MS = 50;
export const NAV_WAIT_MS = 15_000;

export function htmlInstructionsToText(html) {
  const input = String(html ?? "").trim();
  if (!input) return "";
  let text = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** @param {import("puppeteer").Page} page @param {{ fullPage?: boolean }} [options] */
export async function capturePageScreenshot(page, options = {}) {
  return page.screenshot({
    type: "jpeg",
    quality: 72,
    encoding: "base64",
    fullPage: Boolean(options.fullPage),
  });
}

export function sanitizeFilename(value, fallback = "file.txt") {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return fallback;
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || fallback;
}

/** @param {import("puppeteer").Page} page */
export async function collectPageState(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    let activeFieldValue = "";
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      activeFieldValue = active.value ?? "";
    } else if (active instanceof HTMLElement && active.isContentEditable) {
      activeFieldValue = active.textContent ?? "";
    }
    return {
      currentUrl: location.href,
      documentTitle: document.title ?? "",
      activeElementTag: active?.tagName?.toLowerCase() ?? "",
      activeFieldValue: activeFieldValue.slice(0, 80),
    };
  });
}

export function clampCoord(value, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), max);
}

/** @param {import("puppeteer").Page} page @param {string} urlBefore */
export async function waitForUrlChange(page, urlBefore) {
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_WAIT_MS }),
      page.waitForFunction(
        (before) => location.href !== before,
        { timeout: NAV_WAIT_MS },
        urlBefore,
      ),
    ]);
    return true;
  } catch {
    return page.url() !== urlBefore;
  }
}

export function isSubmitLabel(label) {
  const text = String(label ?? "").trim().toLowerCase();
  if (!text) return false;
  return /search|submit|go|find|enter|login|sign in|continue|next/.test(text);
}

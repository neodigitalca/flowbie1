import {
  BROWSER_VIEWPORT,
  TYPE_DELAY_MS,
  clampCoord,
  isSubmitLabel,
  waitForUrlChange,
} from "./shared.mjs";

const GOOGLE_FIELD_SELECTORS = [
  'textarea[name="q"]',
  'input[name="q"]',
  'textarea[aria-label]',
  '[role="combobox"]',
];

function verifyTypedText(expected, actual) {
  const want = String(expected ?? "").trim().toLowerCase();
  const got = String(actual ?? "").trim().toLowerCase();
  if (!want) return Boolean(got);
  if (!got) return false;
  return got.includes(want);
}

async function resolveEditableAtPoint(page, x, y) {
  const handle = await page.evaluateHandle(({ px, py }) => {
    const el = document.elementFromPoint(px, py);
    const target = el?.closest(
      "input, textarea, [contenteditable=''], [contenteditable='true'], [role='combobox']",
    );
    return target ?? null;
  }, { px: x, py: y });
  const element = handle.asElement();
  if (!element) {
    await handle.dispose();
    return null;
  }
  const visible = await element.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  });
  if (!visible) {
    await element.dispose();
    return null;
  }
  return element;
}

async function typeIntoHandle(handle, text) {
  await handle.click({ clickCount: 3 });
  await handle.type(text, { delay: TYPE_DELAY_MS });
}

async function readEditableValue(page, handle = null) {
  if (handle) {
    const fromHandle = await handle.evaluate((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return (el.value ?? "").trim();
      }
      if (el instanceof HTMLElement && el.isContentEditable) {
        return (el.textContent ?? "").trim();
      }
      return "";
    });
    if (fromHandle) return fromHandle;
  }
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return (el.value ?? "").trim();
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      return (el.textContent ?? "").trim();
    }
    return "";
  });
}

async function tryLocatorFill(page, text) {
  for (const selector of GOOGLE_FIELD_SELECTORS) {
    try {
      await page.locator(selector).setTimeout(5000).fill(text);
      return "locator-fill";
    } catch {
      /* next */
    }
  }
  return null;
}

async function trySelectorType(page, text) {
  for (const selector of GOOGLE_FIELD_SELECTORS) {
    const handle = await page.$(selector);
    if (!handle) continue;
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (!visible) {
      await handle.dispose();
      continue;
    }
    await handle.click({ clickCount: 3 });
    await handle.type(text, { delay: TYPE_DELAY_MS });
    await handle.dispose();
    return "element-type";
  }
  return null;
}

async function domFallbackAssign(page, x, y, text) {
  if (x >= 0 && y >= 0) {
    const atPoint = await page.evaluate(({ px, py, value }) => {
      const el = document.elementFromPoint(px, py);
      const target = el?.closest("input, textarea, [contenteditable=''], [contenteditable='true']");
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return false;
      }
      target.focus();
      target.value = value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { px: x, py: y, value: text });
    if (atPoint) return "dom-fallback";
  }
  const focused = await page.evaluate((value) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, text);
  return focused ? "dom-fallback" : null;
}

async function setTextAtPoint(page, x, y, text) {
  let method = "";
  let handle = null;
  let fieldValue = "";
  if (x >= 0 && y >= 0) {
    await page.mouse.click(x, y);
    handle = await resolveEditableAtPoint(page, x, y);
    if (handle) {
      await typeIntoHandle(handle, text);
      method = "element-type";
      fieldValue = await readEditableValue(page, handle);
    }
  }
  if (!verifyTypedText(text, fieldValue)) {
    const selectorMethod = await trySelectorType(page, text);
    if (selectorMethod) {
      method = selectorMethod;
      fieldValue = await readEditableValue(page, null);
    }
  }
  if (!verifyTypedText(text, fieldValue)) {
    const locatorMethod = await tryLocatorFill(page, text);
    if (locatorMethod) {
      method = locatorMethod;
      fieldValue = await readEditableValue(page, null);
    }
  }
  if (!verifyTypedText(text, fieldValue)) {
    if (x >= 0 && y >= 0) await page.mouse.click(x, y);
    await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
    method = "keyboard";
    fieldValue = await readEditableValue(page, handle);
  }
  if (!verifyTypedText(text, fieldValue)) {
    const domMethod = await domFallbackAssign(page, x, y, text);
    if (domMethod) {
      method = domMethod;
      fieldValue = await readEditableValue(page, handle);
    }
  }
  const verified = verifyTypedText(text, fieldValue);
  if (handle) await handle.dispose();
  return { method: method || "unknown", fieldValue, verified };
}

const INTERACTION_TOOLS = new Set([
  "type_at",
  "click_at",
  "type",
  "press_key",
  "scroll",
  "select_option",
  "fill_form_fields",
]);

export function isInteractionTool(name) {
  return INTERACTION_TOOLS.has(name);
}

/** @param {import("puppeteer").Page} page @param {string} name @param {Record<string, unknown>} args */
export async function executeInteractionTool(page, name, args) {
  switch (name) {
    case "type_at": {
      const x = clampCoord(args.x, BROWSER_VIEWPORT.width - 1);
      const y = clampCoord(args.y, BROWSER_VIEWPORT.height - 1);
      if (x === null || y === null) throw new Error("type_at requires numeric x and y");
      const text = String(args.text ?? "");
      const urlBefore = page.url();
      const typed = await setTextAtPoint(page, x, y, text);
      return {
        ok: true,
        x,
        y,
        length: text.length,
        method: typed.method,
        verified: typed.verified,
        fieldValue: typed.fieldValue,
        urlBefore,
        urlAfter: page.url(),
        label: String(args.label ?? "").trim() || undefined,
      };
    }
    case "click_at": {
      const x = clampCoord(args.x, BROWSER_VIEWPORT.width - 1);
      const y = clampCoord(args.y, BROWSER_VIEWPORT.height - 1);
      if (x === null || y === null) throw new Error("click_at requires numeric x and y");
      const label = String(args.label ?? "").trim();
      const urlBefore = page.url();
      await page.mouse.click(x, y);
      let navigated = false;
      if (isSubmitLabel(label)) {
        navigated = await waitForUrlChange(page, urlBefore);
      }
      return {
        ok: true,
        x,
        y,
        label: label || undefined,
        urlBefore,
        urlAfter: page.url(),
        navigated,
      };
    }
    case "type": {
      const text = String(args.text ?? "");
      const urlBefore = page.url();
      const typed = await setTextAtPoint(page, -1, -1, text);
      return {
        ok: true,
        length: text.length,
        method: typed.method,
        verified: typed.verified,
        fieldValue: typed.fieldValue,
        urlBefore,
        urlAfter: page.url(),
      };
    }
    case "press_key": {
      const key = String(args.key ?? "").trim();
      if (!key) throw new Error("press_key requires key");
      const urlBefore = page.url();
      await page.keyboard.press(key);
      let navigated = false;
      if (key.toLowerCase() === "enter") {
        navigated = await waitForUrlChange(page, urlBefore);
      }
      return { ok: true, key, urlBefore, urlAfter: page.url(), navigated };
    }
    case "scroll": {
      const direction = args.direction === "up" ? "up" : "down";
      const amount = Number(args.amount ?? 600);
      const delta = direction === "up" ? -amount : amount;
      await page.evaluate((y) => window.scrollBy(0, y), delta);
      return { ok: true, direction, amount };
    }
    case "select_option": {
      const selector = String(args.selector ?? "").trim();
      const value = String(args.value ?? "").trim();
      if (!selector || !value) throw new Error("select_option requires selector and value");
      await page.select(selector, value);
      return { ok: true, selector, value };
    }
    case "fill_form_fields": {
      const fields = Array.isArray(args.fields) ? args.fields : [];
      const filled = await page.evaluate((rows) => {
        const results = [];
        for (const row of rows) {
          const label = String(row.label ?? "").trim().toLowerCase();
          const value = String(row.value ?? "");
          if (!label) continue;
          const candidates = [...document.querySelectorAll("input, textarea, select")];
          let matched = null;
          for (const el of candidates) {
            const id = el.id?.toLowerCase() ?? "";
            const name = el.getAttribute("name")?.toLowerCase() ?? "";
            const placeholder = el.getAttribute("placeholder")?.toLowerCase() ?? "";
            const aria = el.getAttribute("aria-label")?.toLowerCase() ?? "";
            if (id.includes(label) || name.includes(label) || placeholder.includes(label) || aria.includes(label)) {
              matched = el;
              break;
            }
          }
          if (!matched) {
            results.push({ label: row.label, ok: false });
            continue;
          }
          if (matched instanceof HTMLSelectElement) {
            matched.value = value;
          } else if (matched instanceof HTMLInputElement || matched instanceof HTMLTextAreaElement) {
            matched.focus();
            matched.value = value;
            matched.dispatchEvent(new Event("input", { bubbles: true }));
            matched.dispatchEvent(new Event("change", { bubbles: true }));
          }
          results.push({ label: row.label, ok: true });
        }
        return results;
      }, fields);
      return { ok: true, filled };
    }
    default:
      return null;
  }
}

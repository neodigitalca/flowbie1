import { sanitizeFilename } from "./shared.mjs";

/** @param {Record<string, unknown>} context @param {Record<string, unknown>} item */
export function upsertDeliverable(context, item) {
  if (Array.isArray(context.deliverables)) {
    const filename = String(item.filename ?? "");
    const kind = String(item.kind ?? "");
    const idx = context.deliverables.findIndex(
      (entry) => String(entry.filename ?? "") === filename && String(entry.kind ?? "") === kind,
    );
    if (idx >= 0) context.deliverables[idx] = item;
    else context.deliverables.push(item);
  }
  context.onDeliverable?.(item);
}

/** @param {Record<string, unknown>} context @param {Record<string, unknown>} item */
export function pushDeliverable(context, item) {
  upsertDeliverable(context, item);
}

/** @param {Record<string, unknown>} context @param {object} input */
export function pushTextDeliverable(context, input) {
  const label = String(input.label ?? "").trim() || "Report";
  const filename = sanitizeFilename(input.filename || label, "report.md");
  const mime = String(input.mime ?? "text/markdown").trim() || "text/markdown";
  const content = String(input.content ?? "");
  const item = {
    filename,
    label,
    mime,
    content,
    kind: "text",
    capturedAt: new Date().toISOString(),
    url: input.url ?? null,
  };
  pushDeliverable(context, item);
  return { filename, label, mime };
}

/** @param {Record<string, unknown>} context @param {object} input */
export function pushCsvDeliverable(context, input) {
  const label = String(input.label ?? "").trim() || "Export";
  const filename = sanitizeFilename(input.filename || label, "export.csv");
  const content = String(input.content ?? "");
  const item = {
    filename,
    label,
    mime: "text/csv",
    content,
    kind: "csv",
    capturedAt: new Date().toISOString(),
    url: input.url ?? null,
  };
  pushDeliverable(context, item);
  return { filename, label };
}

/** @param {Record<string, unknown>} context @param {object} input */
export function pushImageDeliverable(context, input) {
  const label = String(input.label ?? "").trim() || "Screenshot";
  let filename = sanitizeFilename(input.filename || label, "screenshot.jpg");
  if (!filename.toLowerCase().endsWith(".jpg") && !filename.toLowerCase().endsWith(".jpeg")) {
    filename = `${filename}.jpg`;
  }
  const item = {
    filename,
    label,
    mime: "image/jpeg",
    base64: input.base64,
    kind: "image",
    fullPage: Boolean(input.fullPage),
    capturedAt: new Date().toISOString(),
    url: input.url ?? null,
  };
  pushDeliverable(context, item);
  return { filename, label };
}

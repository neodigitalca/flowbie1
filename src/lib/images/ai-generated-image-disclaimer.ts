/** Disclaimer burned into in-content images after generation (not model-drawn). */
export const AI_GENERATED_IMAGE_DISCLAIMER = "This is an AI-generated image";

const DISCLAIMER_FONT = '12pt Lato, sans-serif';
const PAD_X = 12;
const PAD_Y = 10;

function stripDataUrlPrefix(base64OrDataUrl: string): string {
  const s = base64OrDataUrl.trim();
  if (s.includes(",")) return s.split(",")[1] ?? s;
  return s;
}

function toDataUrl(base64: string): string {
  const raw = stripDataUrlPrefix(base64);
  if (base64.trim().startsWith("data:")) return base64.trim();
  return `data:image/png;base64,${raw}`;
}

/**
 * Draw a small AI disclaimer in the bottom-left corner (12pt Lato).
 * Returns raw base64 (no data-URL prefix). Browser-only (canvas).
 */
export async function applyAiGeneratedImageDisclaimer(
  imageBase64: string,
  text: string = AI_GENERATED_IMAGE_DISCLAIMER,
): Promise<string> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return stripDataUrlPrefix(imageBase64);
  }

  const label = (text ?? "").trim() || AI_GENERATED_IMAGE_DISCLAIMER;
  const src = toDataUrl(imageBase64);

  if (typeof document.fonts?.load === "function") {
    try {
      await document.fonts.load(DISCLAIMER_FONT);
    } catch {
      // Continue with fallback sans-serif if Lato is unavailable.
    }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to decode image for AI disclaimer overlay"));
    el.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return stripDataUrlPrefix(imageBase64);
  }

  ctx.drawImage(img, 0, 0);
  ctx.font = DISCLAIMER_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 2;
  const x = PAD_X;
  const y = canvas.height - PAD_Y;
  ctx.strokeText(label, x, y);
  ctx.fillText(label, x, y);

  const out = canvas.toDataURL("image/png");
  return stripDataUrlPrefix(out);
}

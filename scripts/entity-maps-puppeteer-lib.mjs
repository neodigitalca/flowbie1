import puppeteer from "puppeteer";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-3.1-flash-image";

export function replicationPrompt(entity) {
  return (
    "Recreate the attached Google Maps screenshot as a clean square map for " +
    entity +
    ". Keep the streets, pin, labels, and colors exactly as shown in the attached image. " +
    "Do not add a frame, border, mat, or invented boundary line. " +
    "Remove leftover browser chrome only if it appears in the photo. " +
    "Do not invent streets, pins, or labels that are not visible in the reference."
  );
}

function extractImageDataUrl(json) {
  const images = json?.choices?.[0]?.message?.images;
  if (Array.isArray(images) && images[0]) {
    const first = images[0];
    const field = first.image_url;
    const url = typeof field === "string" ? field : field?.url;
    if (typeof url === "string" && url.startsWith("data:image/")) return url;
    if (typeof first.url === "string" && first.url.startsWith("data:image/")) return first.url;
    if (typeof first.b64_json === "string") return `data:image/png;base64,${first.b64_json}`;
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.startsWith("data:image/")) return content;
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 === "string") return `data:image/png;base64,${b64}`;
  const orError = typeof json?.error?.message === "string" ? json.error.message.trim() : "";
  throw new Error(orError ? `OpenRouter returned no image: ${orError}` : "OpenRouter returned no image");
}

function mimeFromDataUrl(dataUrl) {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "image/jpeg";
  return "image/png";
}

function dataUrlParts(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Prepared image dataUrl invalid");
  return {
    mimeType: mimeFromDataUrl(dataUrl),
    imageBase64: dataUrl.slice(comma + 1),
  };
}

export async function generateEntityMapsImage({ entity, apiKey }) {
  const keyword = String(entity ?? "").trim();
  if (!keyword) throw new Error("Missing required field: entity");
  const key = String(apiKey ?? "").trim();
  if (!key) throw new Error("Missing OpenRouter API key");

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}`;
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  await page.goto(mapsUrl, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector("canvas", { timeout: 60000 });
  const png = await page.screenshot({
    type: "png",
    clip: { x: 400, y: 0, width: 1520, height: 1080 },
  });
  await browser.close();

  if (!png?.length) throw new Error("Google Maps screenshot is empty");

  const referenceDataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  const orResponse = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
      "X-Title": "NEO Pulse Web App",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      modalities: ["text", "image"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: replicationPrompt(keyword) },
            { type: "image_url", image_url: { url: referenceDataUrl } },
          ],
        },
      ],
      size: "1024x1024",
    }),
  });

  const orJson = await orResponse.json();
  if (!orResponse.ok) {
    const msg = orJson?.error?.message || orJson?.message || `HTTP ${orResponse.status}`;
    throw new Error(`OpenRouter ${orResponse.status}: ${msg}`);
  }

  const dataUrl = extractImageDataUrl(orJson);
  const parts = dataUrlParts(dataUrl);
  return {
    success: true,
    imageBase64: parts.imageBase64,
    mimeType: parts.mimeType,
    referencePngBase64: Buffer.from(png).toString("base64"),
  };
}

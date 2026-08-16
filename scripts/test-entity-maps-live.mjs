/**
 * Live entity map test: POST neodigital.ca API, save JPEG + metadata to test-output/.
 *
 * Usage (from repo root):
 *   node scripts/test-entity-maps-live.mjs
 *   node scripts/test-entity-maps-live.mjs "Meadowlark Park, Edmonton, AB"
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "test-output");

function loadEnvKey() {
  const envPath = join(root, ".env");
  let text = "";
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(OPEN_ROUTER_API_KEY|OPENROUTER_API_KEY)=(.+)$/);
    if (m) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
}

const entity = process.argv[2]?.trim() || "Meadowlark Park, Edmonton, AB";
const apiKey = loadEnvKey();
if (!apiKey) {
  console.error("Missing OPEN_ROUTER_API_KEY in .env or environment");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const slug = entity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const jsonOut = join(outDir, `${slug}-map-result.json`);
const imageOut = join(outDir, `${slug}-map.jpg`);

console.log("Entity:", entity);
console.log("Calling https://neodigital.ca/api/entity-maps-image/generate ...");

const started = Date.now();
const response = await fetch("https://neodigital.ca/api/entity-maps-image/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-OpenRouter-Api-Key": apiKey,
  },
  body: JSON.stringify({ entity }),
});

const json = await response.json();
const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

if (!response.ok || !json.success || !json.imageBase64) {
  writeFileSync(jsonOut, JSON.stringify({ entity, elapsedSec, httpStatus: response.status, ...json }, null, 2));
  console.error("Failed:", json.error || `HTTP ${response.status}`);
  console.error("Details:", jsonOut);
  process.exit(1);
}

writeFileSync(imageOut, Buffer.from(json.imageBase64, "base64"));
const meta = {
  success: true,
  entity,
  elapsedSec,
  httpStatus: response.status,
  mimeType: json.mimeType,
  width: json.width,
  height: json.height,
  imageFile: imageOut,
};
writeFileSync(jsonOut, JSON.stringify(meta, null, 2));

console.log(`Done in ${elapsedSec}s`);
console.log("Image:", imageOut, `${json.width}x${json.height}`);
console.log("Meta:", jsonOut);

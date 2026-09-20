/**
 * One-shot Google Maps neighborhood capture + OpenRouter replicate.
 *
 * Usage (from repo root):
 *   node scripts/entity-maps-puppeteer.mjs "Jasper Ave Edmonton"
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { generateEntityMapsImage } from "./entity-maps-puppeteer-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "test-output");
const mirrorDir = "B:\\USE THIS\\Flowbie\\test-output";

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

const entity = process.argv[2]?.trim();
if (!entity) {
  throw new Error("Missing required argument: keyword");
}

const apiKey = loadEnvKey();
if (!apiKey) {
  throw new Error("Missing OPEN_ROUTER_API_KEY in .env or environment");
}

mkdirSync(outDir, { recursive: true });
mkdirSync(mirrorDir, { recursive: true });

const slug = entity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const beforeOut = join(outDir, `${slug}-before.png`);
const jsonOut = join(outDir, `${slug}-map-result.json`);

console.log("Entity:", entity);

const started = Date.now();
const result = await generateEntityMapsImage({ entity, apiKey });
const afterExt = result.mimeType === "image/jpeg" ? "jpg" : "png";
const afterOut = join(outDir, `${slug}-after.${afterExt}`);

writeFileSync(beforeOut, Buffer.from(result.referencePngBase64, "base64"));
writeFileSync(afterOut, Buffer.from(result.imageBase64, "base64"));

const mirrorBefore = join(mirrorDir, `${slug}-before.png`);
const mirrorAfter = join(mirrorDir, `${slug}-after.${afterExt}`);
copyFileSync(beforeOut, mirrorBefore);
copyFileSync(afterOut, mirrorAfter);

const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
writeFileSync(
  jsonOut,
  JSON.stringify(
    {
      success: true,
      entity,
      elapsedSec,
      mimeType: result.mimeType,
      beforeFile: beforeOut,
      afterFile: afterOut,
      mirrorBefore,
      mirrorAfter,
    },
    null,
    2,
  ),
);

console.log(`Done in ${elapsedSec}s`);
console.log("Before:", beforeOut);
console.log("After:", afterOut);
console.log("Mirror before:", mirrorBefore);
console.log("Mirror after:", mirrorAfter);
console.log("Meta:", jsonOut);

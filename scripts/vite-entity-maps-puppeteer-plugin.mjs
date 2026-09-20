import { generateEntityMapsImage } from "./entity-maps-puppeteer-lib.mjs";
import { readRequestBody, sendJson } from "./local-dominator-export-jobs.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvKey() {
  const envPath = join(root, ".env");
  let text = "";
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(OPEN_ROUTER_API_KEY|OPENROUTER_API_KEY|VITE_OPENROUTER_API_KEY)=(.+)$/);
    if (m) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.OPEN_ROUTER_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
}

function headerApiKey(req) {
  const raw = req.headers["x-openrouter-api-key"];
  return (Array.isArray(raw) ? raw[0] : raw || "").trim();
}

function isMapsGeneratePath(url) {
  return (
    url === "/api/entity-maps-image/generate" ||
    url === "/api/entity-maps-puppeteer/generate"
  );
}

export function entityMapsPuppeteerDevPlugin() {
  return {
    name: "entity-maps-puppeteer-dev",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url?.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
        if (req.method !== "POST" || !isMapsGeneratePath(url)) {
          next();
          return;
        }

        try {
          const raw = await readRequestBody(req);
          const body = raw ? JSON.parse(String(raw)) : {};
          const entity = String(body.entity ?? "").trim();
          const apiKey = headerApiKey(req) || loadEnvKey();
          const result = await generateEntityMapsImage({ entity, apiKey });
          sendJson(res, 200, {
            success: true,
            imageBase64: result.imageBase64,
            mimeType: result.mimeType,
            referencePngBase64: result.referencePngBase64,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Entity map image failed";
          const status =
            message.includes("Missing required field") || message.includes("Missing OpenRouter API key")
              ? 400
              : 502;
          sendJson(res, status, { success: false, error: message });
        }
        return;
      });
    },
  };
}

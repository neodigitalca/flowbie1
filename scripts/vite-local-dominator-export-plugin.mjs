import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const exportScript = path.join(repoRoot, "scripts", "research", "local-dominator", "export-grid.mjs");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function parseExportStdout(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // keep scanning
    }
  }
  return null;
}

/**
 * Local WP Staging runs PHP inside Docker without Node. Intercept export-grid on
 * the Vite dev server and run Puppeteer on the host instead.
 */
export function localDominatorDevExportPlugin() {
  return {
    name: "local-dominator-dev-export",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method !== "POST" || url !== "/api/local-dominator/export-grid") {
          next();
          return;
        }

        if (!fs.existsSync(exportScript)) {
          sendJson(res, 500, {
            ok: false,
            error: "Local Dominator export script is missing in the repo.",
            code: "LD_EXPORT_EXEC_BLOCKED",
          });
          return;
        }

        let body = {};
        try {
          const raw = await readRequestBody(req);
          body = raw ? JSON.parse(raw) : {};
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
          return;
        }

        const businessName = String(body.businessName ?? "").trim();
        const keyword = String(body.keyword ?? "").trim();
        if (!businessName) {
          sendJson(res, 400, { ok: false, error: "Missing required field: businessName" });
          return;
        }
        if (!keyword) {
          sendJson(res, 400, { ok: false, error: "Missing required field: keyword" });
          return;
        }

        const result = spawnSync(
          process.execPath,
          [
            exportScript,
            "--json",
            "--business",
            businessName,
            "--keyword",
            keyword,
          ],
          {
            cwd: repoRoot,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
          },
        );

        const parsed = parseExportStdout(result.stdout ?? "");
        if (parsed?.ok) {
          sendJson(res, 200, parsed);
          return;
        }

        const stderr = (result.stderr ?? "").trim();
        const message =
          (parsed && parsed.error) ||
          stderr ||
          (result.stdout ?? "").trim() ||
          "Local Dominator export failed on the dev host.";

        sendJson(res, 500, {
          ok: false,
          error: message,
          code: parsed?.code ?? "LD_EXPORT_EXEC_BLOCKED",
        });
      });
    },
  };
}

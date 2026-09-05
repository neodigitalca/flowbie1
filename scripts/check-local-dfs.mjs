import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test-output");

function loadDotEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function loadOpenRouterKey(env) {
  return (
    env.OPEN_ROUTER_API_KEY?.trim() ||
    env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    ""
  );
}

function loadLocalBase() {
  try {
    const cfg = JSON.parse(readFileSync(join(root, "scripts/local-wp-staging.config.json"), "utf8"));
    return String(cfg.siteUrl || "https://neopulse.local").replace(/\/+$/, "");
  } catch {
    return "https://neopulse.local";
  }
}

function readSecretsPhp() {
  try {
    const src = readFileSync(
      join(root, "wordpress-plugins/neo-pulse-app/includes/neo-pulse-app-secrets.php"),
      "utf8",
    );
    const login = src.match(/NEO_PULSE_APP_DATAFORSEO_LOGIN',\s*'([^']*)'/)?.[1] ?? "";
    const pass = src.match(/NEO_PULSE_APP_DATAFORSEO_PASSWORD',\s*'([^']*)'/)?.[1] ?? "";
    return { login, pass };
  } catch {
    return { login: "", pass: "" };
  }
}

const env = loadDotEnv();
const envLogin = env.DATAFORSEO_API_LOGIN || env.DATAFORSEO_LOGIN || "";
const envPass = env.DATAFORSEO_API_PASSWORD || env.DATAFORSEO_PASSWORD || "";
const secrets = readSecretsPhp();
const entity = process.argv[2]?.trim() || "Plum Coulee, MB";
const localBase = loadLocalBase();

console.log("=== Local DataForSEO check ===");
console.log(".env login set:", Boolean(envLogin));
console.log(".env password set:", Boolean(envPass), `(len ${envPass.length})`);
console.log("neo-pulse-app-secrets.php login set:", Boolean(secrets.login));
console.log("neo-pulse-app-secrets.php password set:", Boolean(secrets.pass), `(len ${secrets.pass.length})`);
console.log(".env matches secrets file:", envLogin === secrets.login && envPass === secrets.pass);

if (!envLogin || !envPass) {
  console.error("FAIL: missing DATAFORSEO_API_LOGIN or DATAFORSEO_API_PASSWORD in repo .env");
  process.exit(1);
}

const auth = Buffer.from(`${envLogin}:${envPass}`).toString("base64");
const dfsRes = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
  headers: { Authorization: `Basic ${auth}` },
});
const dfsJson = await dfsRes.json();
const task = dfsJson?.tasks?.[0];
console.log("\nDataForSEO direct API:");
console.log("HTTP:", dfsRes.status);
console.log("status_code:", task?.status_code);
console.log("status_message:", task?.status_message || "(none)");
if (task?.status_code === 20000 && task?.result?.[0]) {
  const u = task.result[0];
  console.log("account login:", u.login || "(n/a)");
  console.log("balance:", u.money?.balance ?? u.money_balance ?? "(unknown)");
} else {
  console.error("FAIL: DataForSEO credentials rejected or API error");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "local-dfs-check.json"), JSON.stringify(dfsJson, null, 2));
  process.exit(1);
}

console.log("\n=== Local entity maps (neopulse.local) ===");
console.log("URL:", `${localBase}/api/entity-maps-image/generate`);
const orKey = loadOpenRouterKey(env);
if (!orKey) {
  console.warn("WARN: no OPEN_ROUTER_API_KEY in .env (maps replicate step may fail)");
}

const started = Date.now();
const mapsRes = await fetch(`${localBase}/api/entity-maps-image/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(orKey ? { "X-OpenRouter-Api-Key": orKey } : {}),
  },
  body: JSON.stringify({ entity }),
});
const mapsText = await mapsRes.text();
let mapsJson = {};
try {
  mapsJson = JSON.parse(mapsText);
} catch {
  mapsJson = { raw: mapsText.slice(0, 300) };
}
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log("HTTP:", mapsRes.status, `(${elapsed}s)`);
console.log("success:", mapsJson.success);
console.log("error:", mapsJson.error || "(none)");
if (mapsJson.imageBase64) {
  console.log("image base64 length:", String(mapsJson.imageBase64).length);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "local-plum-coulee-map-result.json"),
  JSON.stringify({ entity, elapsedSec: elapsed, httpStatus: mapsRes.status, ...mapsJson, imageBase64: mapsJson.imageBase64 ? "[omitted]" : undefined }, null, 2),
);

if (!mapsRes.ok || !mapsJson.success) {
  console.error("FAIL: local entity maps endpoint");
  process.exit(1);
}

console.log("\nOK: local DataForSEO + entity maps working");

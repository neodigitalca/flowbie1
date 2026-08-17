#!/usr/bin/env node
/**
 * Provision Flowbie Render services via REST API when Blueprint is not used.
 * Requires RENDER_API_KEY env (or reads from RENDER_API_KEY.txt in Downloads).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const API = "https://api.render.com/v1";
const REPO = "https://github.com/neodigitalca/flowbie1";
const BRANCH_DEMO = "cursor/meta-ads-visual-settings-layout";
const BRANCH_PROD = "main";

function loadApiKey() {
  const fromEnv = (process.env.RENDER_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  const downloads = path.join(os.homedir(), "Downloads", "RENDER API KEY.txt");
  if (fs.existsSync(downloads)) {
    return fs.readFileSync(downloads, "utf8").trim();
  }
  throw new Error("Set RENDER_API_KEY or place key in Downloads/RENDER API KEY.txt");
}

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${loadApiKey()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${route} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return data;
}

async function listServices() {
  const data = await api("GET", "/services?limit=100");
  const rows = Array.isArray(data) ? data : data?.services ?? [];
  return rows.map((row) => row.service ?? row).filter(Boolean);
}

async function getOwnerId() {
  const data = await api("GET", "/owners?limit=20");
  const list = Array.isArray(data) ? data.map((row) => row.owner ?? row) : data?.owners ?? [];
  if (!list.length) throw new Error("No Render owners found.");
  const preferred = list.find((o) => o.type === "team") ?? list[0];
  return preferred.id;
}

async function updateStaticSiteConfig(serviceId) {
  await api("PATCH", `/services/${serviceId}`, {
    serviceDetails: {
      buildCommand: "npm ci && npm run build:render-static",
      publishPath: "dist",
    },
  });
  console.log(`[static-config] ${serviceId}: build + publishPath=dist`);
}

async function getEnvVar(serviceId, key) {
  try {
    const rows = await api("GET", `/services/${serviceId}/env-vars?limit=100`);
    const list = Array.isArray(rows) ? rows.map((row) => row.envVar ?? row) : [];
    const hit = list.find((item) => item.key === key);
    return hit?.value ? String(hit.value).trim() : "";
  } catch {
    return "";
  }
}

async function ensureStaticSite(ownerId, spec) {
  const existing = (await listServices()).find((s) => s.name === spec.name);
  if (existing?.id) {
    console.log(`[skip] ${spec.name} exists: ${existing.id}`);
    await updateStaticSiteConfig(existing.id);
    return existing;
  }

  const created = await api("POST", "/services", {
    type: "static_site",
    name: spec.name,
    ownerId,
    repo: REPO,
    branch: spec.branch,
    autoDeploy: "yes",
    serviceDetails: {
      buildCommand: "npm ci && npm run build:render-static",
      publishPath: "dist",
    },
    envVars: spec.envVars,
  });
  console.log(`[created] ${spec.name}:`, created.id || created.service?.id);
  return created.service ?? created;
}

async function ensureDockerWorker(ownerId, spec) {
  const existing = (await listServices()).find((s) => s.name === spec.name);
  if (existing?.id) {
    console.log(`[skip] ${spec.name} exists: ${existing.id}`);
    return existing;
  }

  const created = await api("POST", "/services", {
    type: "web_service",
    name: spec.name,
    ownerId,
    repo: REPO,
    branch: spec.branch,
    autoDeploy: "yes",
    serviceDetails: {
      runtime: "docker",
      plan: "standard",
      envSpecificDetails: {
        dockerfilePath: "./Dockerfile.ld-worker",
        dockerContext: ".",
      },
    },
    envVars: spec.envVars,
  });
  console.log(`[created] ${spec.name}:`, created.id || created.service?.id);
  return created.service ?? created;
}

async function triggerDeploy(serviceId) {
  try {
    const deploy = await api("POST", `/services/${serviceId}/deploys`, { clearCache: "do_not_clear" });
    console.log(`[deploy] ${serviceId}:`, deploy?.id || deploy?.deploy?.id || "started");
  } catch (err) {
    console.warn(`[deploy] ${serviceId} failed:`, err.message || err);
  }
}

async function putEnvVars(serviceId, vars) {
  const payload = vars
    .filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== "")
    .map((item) => ({ key: item.key, value: String(item.value) }));
  if (!payload.length) return;
  await api("PUT", `/services/${serviceId}/env-vars`, payload);
  console.log(`[env] ${serviceId}: ${payload.map((item) => item.key).join(", ")}`);
}

function readRepoEnv() {
  const readKey = (file, key) => {
    const filePath = path.join(REPO_ROOT, file);
    if (!fs.existsSync(filePath)) return "";
    const line = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith(`${key}=`));
    if (!line) return "";
    return line.slice(key.length + 1).trim();
  };
  return {
    openRouter: readKey(".env", "OPEN_ROUTER_API_KEY"),
    ldEmail: readKey(".env.localdominator", "LOCAL_DOMINATOR_EMAIL"),
    ldPassword: readKey(".env.localdominator", "LOCAL_DOMINATOR_PASSWORD"),
    ldLoginUrl: readKey(".env.localdominator", "LOCAL_DOMINATOR_LOGIN_URL") || "https://app.localdominator.co/login/",
    workerToken: process.env.LD_WORKER_AUTH_TOKEN || crypto.randomBytes(24).toString("hex"),
  };
}

async function updateServiceBranch(serviceId, branch) {
  await api("PATCH", `/services/${serviceId}`, { branch });
  console.log(`[branch] ${serviceId} -> ${branch}`);
}

async function addCustomDomain(serviceId, domain) {
  try {
    const result = await api("POST", `/services/${serviceId}/custom-domains`, { name: domain });
    console.log(`[domain] ${serviceId} ${domain}:`, result?.id || result?.customDomain?.id || "added");
  } catch (err) {
    console.warn(`[domain] ${serviceId} ${domain}:`, err.message || err);
  }
}

const baseStaticEnv = [
  { key: "VITE_BASE_PATH", value: "/" },
  { key: "VITE_MCP_API_BASE", value: "https://neodigital.ca/api/mcp" },
];

const workerEnv = [
  { key: "LOCAL_DOMINATOR_LOGIN_URL", value: "https://app.localdominator.co/login/" },
];

async function main() {
  const ownerId = await getOwnerId();
  console.log("[owner]", ownerId);

  const secrets = readRepoEnv();
  const demoWorkerExisting = (await listServices()).find((s) => s.name === "flowbie-demo-worker");
  const savedToken =
    process.env.LD_WORKER_AUTH_TOKEN?.trim() ||
    (demoWorkerExisting?.id ? await getEnvVar(demoWorkerExisting.id, "LD_WORKER_AUTH_TOKEN") : "");
  if (savedToken) secrets.workerToken = savedToken;

  const demoStatic = await ensureStaticSite(ownerId, {
    name: "flowbie-demo-static",
    branch: BRANCH_DEMO,
    envVars: [{ key: "RENDER_PROFILE", value: "demo" }, ...baseStaticEnv],
  });

  const demoWorker = await ensureDockerWorker(ownerId, {
    name: "flowbie-demo-worker",
    branch: BRANCH_DEMO,
    envVars: workerEnv,
  });

  const prodStatic = await ensureStaticSite(ownerId, {
    name: "flowbie-prod-static",
    branch: BRANCH_PROD,
    envVars: [{ key: "RENDER_PROFILE", value: "prod" }, ...baseStaticEnv],
  });

  const prodWorker = await ensureDockerWorker(ownerId, {
    name: "flowbie-prod-worker",
    branch: BRANCH_PROD,
    envVars: workerEnv,
  });

  const staticEnv = (profile) => [
    { key: "RENDER_PROFILE", value: profile },
    ...baseStaticEnv,
    { key: "VITE_OPENROUTER_API_KEY", value: secrets.openRouter },
  ];

  const workerSecrets = [
    { key: "LOCAL_DOMINATOR_LOGIN_URL", value: secrets.ldLoginUrl },
    { key: "LOCAL_DOMINATOR_EMAIL", value: secrets.ldEmail },
    { key: "LOCAL_DOMINATOR_PASSWORD", value: secrets.ldPassword },
    { key: "LD_WORKER_AUTH_TOKEN", value: secrets.workerToken },
  ];

  if (demoStatic?.id) await putEnvVars(demoStatic.id, staticEnv("demo"));
  if (prodStatic?.id) await putEnvVars(prodStatic.id, staticEnv("prod"));
  if (demoWorker?.id) await putEnvVars(demoWorker.id, workerSecrets);
  if (prodWorker?.id) await putEnvVars(prodWorker.id, workerSecrets);

  if (prodStatic?.id) await updateServiceBranch(prodStatic.id, BRANCH_DEMO);
  if (prodWorker?.id) await updateServiceBranch(prodWorker.id, BRANCH_DEMO);

  for (const svc of [demoStatic, demoWorker, prodStatic, prodWorker]) {
    const id = svc?.id;
    if (id) await triggerDeploy(id);
  }

  const prodStaticId = prodStatic?.id;
  const prodWorkerId = prodWorker?.id;
  if (prodStaticId) await addCustomDomain(prodStaticId, "app.neodigital.ca");
  if (prodWorkerId) await addCustomDomain(prodWorkerId, "ld.neodigital.ca");

  console.log("\nDone.");
  console.log("- Demo static:", demoStatic?.serviceDetails?.url || "https://flowbie-demo-static.onrender.com");
  console.log("- Demo worker:", demoWorker?.serviceDetails?.url || "https://flowbie-demo-worker.onrender.com");
  console.log("- Prod static:", prodStatic?.serviceDetails?.url || "https://flowbie-prod-static.onrender.com");
  console.log("- Prod worker:", prodWorker?.serviceDetails?.url || "https://flowbie-prod-worker.onrender.com");
  console.log("- WP Engine worker URL: https://ld.neodigital.ca (or prod worker onrender URL until DNS verified)");
  console.log(`- LD_WORKER_AUTH_TOKEN (save for WP secrets): ${secrets.workerToken}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

/**
 * Fast API verify: Google Drive workflow step test uploads one file via test-step-upload.
 *
 * Usage:
 *   node scripts/verify-workflow-drive-step-test.mjs
 *   WORKFLOW_ID=7 node scripts/verify-workflow-drive-step-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { propertiesClientFolderName } from "./lib/properties-client-folder-name.mjs";

const APP_BASE = process.env.VERIFY_APP_BASE ?? "http://localhost:8080";
const API_BASE = `${APP_BASE.replace(/\/+$/, "")}/api`;
const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");
const sitesPath =
  process.env.NEO_PULSE_SITES_JSON ??
  [".cursor-tmp-flowbie-sites.json", ".cursor-tmp-neodigital-sites.json"]
    .map((name) => path.join(process.cwd(), name))
    .find((filePath) => fs.existsSync(filePath));
const WORKFLOW_ID = Number(process.env.WORKFLOW_ID ?? 7);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const url = `${API_BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON ${res.status} from ${url}: ${raw.slice(0, 200)}`);
  }
  return { res, data };
}

async function login() {
  const { email, password } = readJson(loginPath);
  const loginRes = await api("/auth/login", {
    method: "POST",
    body: { username: email, email, password },
  });
  if (!loginRes.data.ok || !loginRes.data.sessionToken) {
    throw new Error(`Login failed: ${loginRes.data.error ?? loginRes.res.status}`);
  }
  const token = loginRes.data.sessionToken;
  const me = await api(`/auth/me?_=${Date.now()}`, { token });
  const teamId = me.data.activeTeam?.id ?? me.data.teams?.[0]?.id;
  if (!teamId) throw new Error("No team id");
  return { token, teamId };
}

async function loadSites(token) {
  const fromApi = await api("/manager-wordpress-properties/load", { token });
  const apiSites = Array.isArray(fromApi.data.sites) ? fromApi.data.sites : [];
  if (apiSites.length > 0) return apiSites;
  if (!sitesPath) return [];
  const raw = readJson(sitesPath);
  return Array.isArray(raw.sites) ? raw.sites : Array.isArray(raw) ? raw : [];
}

async function main() {
  const started = Date.now();
  const auth = await login();
  const wfRes = await api(`/teams/${auth.teamId}/workflows/${WORKFLOW_ID}`, { token: auth.token });
  const workflow = wfRes.data.workflow;
  if (!workflow) throw new Error(`Workflow ${WORKFLOW_ID} not found`);

  const gdriveNode = (workflow.nodes ?? []).find((node) => node.kind === "then_google_drive");
  if (!gdriveNode) throw new Error(`Workflow ${WORKFLOW_ID} has no Google Drive step`);

  const clientNode = (workflow.nodes ?? []).find((node) => node.kind === "workflow_client");
  const siteId = clientNode?.config?.siteIds?.[0]?.trim?.() ?? "";
  if (!siteId) throw new Error("Workflow has no client site configured");

  const sites = await loadSites(auth.token);
  const site = sites.find((item) => item.id === siteId);
  if (!site) {
    throw new Error(`Site ${siteId} not found (checked API mirror and ${sitesPath ?? "sites json"})`);
  }

  const payload = gdriveNode.config?.executionPayload ?? {};
  const siteName = propertiesClientFolderName(site);
  const title = String(workflow.name ?? gdriveNode.label ?? "Workflow step").trim();
  const agentNode = (workflow.nodes ?? []).find((node) => node.kind === "action_agent");
  const executionKind = String(agentNode?.config?.executionKind ?? "gsc_reporting").trim();

  console.log(`Workflow #${WORKFLOW_ID}: ${workflow.name}`);
  console.log(`Drive step: ${gdriveNode.label} (${gdriveNode.id})`);
  console.log(`Client: ${siteName}`);

  const uploadRes = await api("/google-mcp/test-step-upload", {
    method: "POST",
    body: {
      title,
      siteName,
      siteUrl: site.siteUrl,
      executionKind,
      saveToGoogleDrive: true,
      googleDriveFolderSource: "path",
      googleDriveFolderPath: payload.googleDriveFolderPath || "reporting",
      googleDriveFolderId: payload.googleDriveFolderId,
      googleDriveFolderLabel: payload.googleDriveFolderLabel,
      googleDrivePresetKey: payload.googleDrivePresetKey,
      googleDriveFolderVariable: payload.googleDriveFolderVariable,
    },
  });

  if (!uploadRes.res.ok || uploadRes.data.success === false) {
    throw new Error(uploadRes.data.error ?? `test-step-upload failed (${uploadRes.res.status})`);
  }

  const folderLink = String(uploadRes.data.folderLink ?? "").trim();
  const folderLabel = String(uploadRes.data.folderLabel ?? "").trim();
  if (!folderLink) throw new Error("test-step-upload succeeded without folderLink");
  if (!/\/ (Reporting|Audits|Grids) \/ \d{4} \/ /i.test(folderLabel)) {
    throw new Error(`test-step-upload resolved client root instead of month folder: ${folderLabel || "(empty label)"}`);
  }

  const elapsedMs = Date.now() - started;
  console.log(
    JSON.stringify(
      {
        ok: true,
        elapsedMs,
        folderLink,
        folderLabel,
        fileName: uploadRes.data.fileName,
        created: uploadRes.data.created ?? [],
      },
      null,
      2,
    ),
  );

  if (elapsedMs > 30_000) {
    console.warn(`Warning: test-step-upload took ${elapsedMs}ms (expected under 30s)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

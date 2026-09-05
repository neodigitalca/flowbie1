/**
 * Verify grid CSV export reaches Google Drive on workflow 10 (Grid to entity pages).
 * Usage: node scripts/verify-workflow-grid-to-drive.mjs [workflowId]
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:8080/api";
const WORKFLOW_ID = Number.parseInt(process.argv[2] ?? "10", 10);
const POLL_MS = 4000;
const MAX_MS = 12 * 60 * 1000;

const loginPath = path.join(process.cwd(), ".cursor-tmp-login.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const url = `${BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON ${res.status} from ${url}: ${raw.slice(0, 200)}`);
  }
  return { res, data };
}

async function auth() {
  const { email, password } = readJson(loginPath);
  const login = await api("/auth/login", {
    method: "POST",
    body: { username: email, email, password },
  });
  if (!login.data.ok || !login.data.sessionToken) {
    throw new Error(`Login failed: ${login.data.error ?? login.res.status}`);
  }
  const token = login.data.sessionToken;
  const me = await api(`/auth/me?_=${Date.now()}`, { token });
  const teamId = me.data.activeTeam?.id ?? me.data.teams?.[0]?.id;
  if (!teamId) throw new Error("No team id");
  return { token, teamId };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { token, teamId } = await auth();
  const wfRes = await api(`/teams/${teamId}/workflows/${WORKFLOW_ID}`, { token });
  const wf = wfRes.data.workflow;
  if (!wf) throw new Error(`Workflow ${WORKFLOW_ID} not found`);

  const gdriveNode = (wf.nodes ?? []).find((n) => n.kind === "then_google_drive");
  const ldNode = (wf.nodes ?? []).find(
    (n) => n.kind === "action_agent" && n.config?.executionKind === "local_dominator_export",
  );
  if (!ldNode) throw new Error("No local_dominator_export step on workflow");
  if (!gdriveNode) throw new Error("No then_google_drive step on workflow");

  console.log(`Workflow: ${wf.name} (#${WORKFLOW_ID})`);
  console.log(`LD step: ${ldNode.label}`);
  console.log(`Drive step: ${gdriveNode.label}`);

  const start = await api(`/teams/${teamId}/workflows/${WORKFLOW_ID}/runs`, {
    method: "POST",
    token,
    body: { simulated: true },
  });
  if (!start.data.ok || !start.data.run?.id) {
    throw new Error(`Start run failed: ${start.data.error ?? start.res.status}`);
  }
  const runId = start.data.run.id;
  console.log(`Started workflow run #${runId}`);

  const t0 = Date.now();
  let lastLine = "";

  while (Date.now() - t0 < MAX_MS) {
    const runRes = await api(`/teams/${teamId}/workflows/${WORKFLOW_ID}/runs/${runId}`, { token });
    const run = runRes.data.run;
    const outsRes = await api(
      `/teams/${teamId}/workflows/${WORKFLOW_ID}/runs/${runId}/outputs`,
      { token },
    );
    const outputs = outsRes.data.outputs ?? [];

    const ldOut = outputs.find((o) => o.nodeId === ldNode.id);
    const gdriveOut = outputs.find((o) => o.nodeId === gdriveNode.id);
    const ldCsv = (ldOut?.fileRefs ?? []).some((f) => /\.csv$/i.test(f.name ?? ""));
    const gdriveFile = (gdriveOut?.fileRefs ?? []).length > 0;
    const gdriveUrl =
      gdriveOut?.deliveryMeta?.googleDriveUrl ??
      gdriveOut?.deliveryMeta?.googleDriveFolderUrl ??
      gdriveOut?.fileRefs?.[0]?.url ??
      "";

    const line = `status=${run?.status} ldCsv=${ldCsv} gdrive=${gdriveFile} outputs=${outputs.length}`;
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }

    if (run?.status === "failed") {
      console.error("FAILED:", run.errorMessage ?? "unknown");
      console.log(JSON.stringify({ runId, outputs: outputs.map((o) => ({ label: o.label, files: o.fileRefs })) }, null, 2));
      process.exit(1);
    }

    if (run?.status === "done") {
      if (!ldCsv) {
        console.error("Workflow done but grid CSV output missing on LD step");
        process.exit(1);
      }
      if (!gdriveOut) {
        console.error("Workflow done but Google Drive step never produced output");
        process.exit(1);
      }
      console.log("SUCCESS");
      console.log(JSON.stringify({
        runId,
        gridCsv: ldOut?.fileRefs?.map((f) => f.name),
        googleDrive: {
          textPreview: gdriveOut.textPreview,
          url: gdriveUrl,
          files: gdriveOut.fileRefs,
          deliveryMeta: gdriveOut.deliveryMeta,
        },
      }, null, 2));
      process.exit(0);
    }

    await sleep(POLL_MS);
  }

  console.error("Timed out waiting for workflow run");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

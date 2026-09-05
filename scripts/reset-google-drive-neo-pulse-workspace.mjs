/**
 * Trash every folder directly under NEO Pulse workspace (full reset before rebuild).
 * Usage: node scripts/reset-google-drive-neo-pulse-workspace.mjs
 */

const API_BASE = (process.env.NEO_PULSE_API_BASE || "https://neopulse.local/api").replace(/\/+$/, "");
const SHARED_DRIVE_ID = "0AHAVAVW8TixdUk9PVA";
const WORKSPACE_NAME = "NEO Pulse";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? `${path} failed (${res.status})`);
  }
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? `${path} failed (${res.status})`);
  }
  return data;
}

async function main() {
  const workspace = await apiPost("/google-mcp/resolve-folder-path/", {
    rootFolderId: SHARED_DRIVE_ID,
    segments: [WORKSPACE_NAME],
    createMissing: false,
  });

  const children = await apiGet(
    `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(workspace.folderId)}`,
  );
  const folders = Array.isArray(children.children) ? children.children : [];
  if (folders.length === 0) {
    console.log(JSON.stringify({ trashedCount: 0, trashed: [], workspaceLink: workspace.webViewLink }, null, 2));
    return;
  }

  const trashed = [];
  for (const folder of folders) {
    const folderId = String(folder.folderId ?? "").trim();
    if (!folderId) continue;
    await apiPost("/google-mcp/trash-file/", { fileId: folderId });
    trashed.push({ name: folder.name, folderId });
    console.log(`Trashed ${folder.name}`);
  }

  console.log(
    JSON.stringify(
      {
        workspaceLink: workspace.webViewLink,
        trashedCount: trashed.length,
        trashed,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

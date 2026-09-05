/**
 * Trash Deliverables subfolders under each client folder in NEO Pulse workspace.
 * Usage: node scripts/trash-google-drive-deliverables-folders.mjs
 */

const API_BASE = (process.env.NEO_PULSE_API_BASE || "https://neopulse.local/api").replace(/\/+$/, "");
const SHARED_DRIVE_ID = "0AHAVAVW8TixdUk9PVA";
const WORKSPACE_NAME = "NEO Pulse";
const TARGET_FOLDER_NAME = "Deliverables";

function isLikelyTruncatedStoredName(name) {
  return / \.\.\.$/.test(String(name ?? "").trim());
}

function propertiesClientName(site) {
  const stored = String(site.name ?? "").trim();
  const nap = String(site.napInfo?.name ?? "").trim();
  if (nap) {
    if (isLikelyTruncatedStoredName(stored)) return nap;
    const storedCore = stored.replace(/ \.\.\.$/, "").trim();
    if (nap.length > storedCore.length) return nap;
  }
  if (isLikelyTruncatedStoredName(stored)) {
    return stored.replace(/ \.\.\.$/, "").trim();
  }
  return stored;
}

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
  const sitesPayload = await apiGet("/manager-wordpress-properties/load/");
  const sites = Array.isArray(sitesPayload.sites) ? sitesPayload.sites : [];
  if (sites.length === 0) throw new Error("No Pulse client sites found.");

  const workspace = await apiPost("/google-mcp/resolve-folder-path/", {
    rootFolderId: SHARED_DRIVE_ID,
    segments: [WORKSPACE_NAME],
    createMissing: false,
  });

  const trashed = [];
  const missing = [];

  for (const site of sites) {
    const clientName = propertiesClientName(site);
    let clientFolder;
    try {
      clientFolder = await apiPost("/google-mcp/resolve-folder-path/", {
        rootFolderId: workspace.folderId,
        segments: [clientName],
        createMissing: false,
      });
    } catch {
      missing.push({ client: clientName, reason: "client folder not found" });
      continue;
    }

    const children = await apiGet(
      `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(clientFolder.folderId)}`,
    );
    const deliverables = (children.children ?? []).find(
      (child) => String(child.name ?? "").trim().toLowerCase() === TARGET_FOLDER_NAME.toLowerCase(),
    );
    if (!deliverables?.folderId) {
      missing.push({ client: clientName, reason: "Deliverables folder not found" });
      continue;
    }

    await apiPost("/google-mcp/trash-file/", { fileId: deliverables.folderId });
    trashed.push({ client: clientName, folderId: deliverables.folderId });
    console.log(`Trashed Deliverables for ${clientName}`);
  }

  console.log(JSON.stringify({ trashedCount: trashed.length, trashed, missing }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

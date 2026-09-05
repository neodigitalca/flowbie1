/**
 * Restore Reporting / Audits / Grids + current year/month under Advance Blinds in NEO Pulse.
 *
 * Usage:
 *   node scripts/restore-advance-blinds-drive-folders.mjs
 */

import { driveDateSegments } from "./lib/drive-date-segments.mjs";

const API_BASE = (process.env.NEO_PULSE_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
const SHARED_DRIVE_ID = "0AHAVAVW8TixdUk9PVA";
const WORKSPACE_NAME = "NEO Pulse";
const PURPOSE_FOLDERS = ["Reporting", "Audits", "Grids"];
const CLIENT_MATCH = /advance blinds|advanced blinds/i;
const [year, month] = driveDateSegments();

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

  const clients = await apiGet(
    `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(workspace.folderId)}`,
  );
  const matches = (clients.children ?? []).filter((client) => CLIENT_MATCH.test(String(client.name ?? "")));
  if (matches.length === 0) {
    throw new Error("No Advance Blinds client folder found under NEO Pulse.");
  }

  const client = matches[0];
  const restored = {};

  for (const purpose of PURPOSE_FOLDERS) {
    const purposeFolder = await apiPost("/google-mcp/resolve-folder-path/", {
      rootFolderId: client.folderId,
      segments: [purpose],
      createMissing: true,
    });

    const monthFolder = await apiPost("/google-mcp/resolve-folder-path/", {
      rootFolderId: purposeFolder.folderId,
      segments: [year, month],
      createMissing: true,
    });

    restored[purpose] = {
      purposeLink: purposeFolder.webViewLink ?? purposeFolder.folderId,
      monthLink: monthFolder.webViewLink ?? monthFolder.folderId,
      created: [...(purposeFolder.created ?? []), ...(monthFolder.created ?? [])],
    };
  }

  const after = await apiGet(
    `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(client.folderId)}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        clientName: client.name,
        clientFolderId: client.folderId,
        clientFolderLink: client.webViewLink,
        yearMonth: `${year}/${month}`,
        restored,
        topLevelAfter: (after.children ?? []).map((item) => item.name).sort(),
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

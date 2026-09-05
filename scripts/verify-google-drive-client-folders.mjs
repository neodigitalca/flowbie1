/**
 * Verify NEO Pulse workspace has expected client + purpose + year/month folder counts.
 * Usage: node scripts/verify-google-drive-client-folders.mjs
 */

import { driveDateSegments } from "./lib/drive-date-segments.mjs";

const API_BASE = (process.env.NEO_PULSE_API_BASE || "https://neopulse.local/api").replace(/\/+$/, "");
const SHARED_DRIVE_ID = "0AHAVAVW8TixdUk9PVA";
const WORKSPACE_NAME = "NEO Pulse";
const EXPECTED_CLIENTS = 17;
const EXPECTED_PURPOSES = ["Audits", "Grids", "Reporting"];
const BLIND_MAGIC_CLIENT = "Blind Magic Window Coverings | Hunter Douglas Blinds";
const [expectedYear, expectedMonth] = driveDateSegments();

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
  const clientFolders = Array.isArray(clients.children) ? clients.children : [];

  const issues = [];
  if (clientFolders.length !== EXPECTED_CLIENTS) {
    issues.push(`Expected ${EXPECTED_CLIENTS} client folders, found ${clientFolders.length}.`);
  }

  let sampled = null;
  for (const client of clientFolders) {
    const children = await apiGet(
      `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(client.folderId)}`,
    );
    const names = (children.children ?? []).map((item) => item.name).sort();
    const expected = [...EXPECTED_PURPOSES].sort();
    if (names.length !== expected.length || expected.some((name) => !names.includes(name))) {
      issues.push(`${client.name}: expected ${expected.join(", ")}, found ${names.join(", ")}`);
    }
    if (client.name.includes("Blind Magic")) sampled = { client: client.name, children: names };
  }

  const blindMagicTest = await apiPost("/google-mcp/resolve-folder-path/", {
    rootFolderId: workspace.folderId,
    segments: [BLIND_MAGIC_CLIENT, "Reporting", expectedYear, expectedMonth],
    createMissing: false,
  });

  const blindMagicReporting = await apiPost("/google-mcp/resolve-folder-path/", {
    rootFolderId: workspace.folderId,
    segments: [BLIND_MAGIC_CLIENT, "Reporting"],
    createMissing: false,
  });
  const yearFolders = await apiGet(
    `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(blindMagicReporting.folderId)}`,
  );
  const yearNames = (yearFolders.children ?? []).map((item) => item.name);
  if (!yearNames.includes(expectedYear)) {
    issues.push(`Blind Magic Reporting: expected year folder ${expectedYear}, found ${yearNames.join(", ")}`);
  } else {
    const yearFolder = (yearFolders.children ?? []).find((item) => item.name === expectedYear);
    if (yearFolder?.folderId) {
      const monthFolders = await apiGet(
        `/google-mcp/list-folder-children/?folderId=${encodeURIComponent(yearFolder.folderId)}`,
      );
      const monthNames = (monthFolders.children ?? []).map((item) => item.name);
      if (!monthNames.includes(expectedMonth)) {
        issues.push(
          `Blind Magic Reporting/${expectedYear}: expected month folder ${expectedMonth}, found ${monthNames.join(", ")}`,
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: issues.length === 0,
        workspaceLink: workspace.webViewLink,
        clientFolderCount: clientFolders.length,
        expectedYearMonth: `${expectedYear}/${expectedMonth}`,
        sampledBlindMagic: sampled,
        blindMagicReportingMonthLink: blindMagicTest.webViewLink,
        issues,
      },
      null,
      2,
    ),
  );

  if (issues.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

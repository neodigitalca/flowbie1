/**
 * Create NEO Pulse / {client} / {Reporting|Audits|Grids} for every Properties site.
 *
 * Usage:
 *   node scripts/provision-google-drive-client-folders.mjs [csvPath]
 *   NEO_PULSE_SITES_CSV=path/to/sites.csv node scripts/provision-google-drive-client-folders.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  propertiesClientFolderName,
  sortSitesByDisplayName,
} from "./lib/properties-client-folder-name.mjs";
import { driveDateSegments } from "./lib/drive-date-segments.mjs";

const API_BASE = (process.env.NEO_PULSE_API_BASE || "https://neopulse.local/api").replace(/\/+$/, "");
const SHARED_DRIVE_ID = "0AHAVAVW8TixdUk9PVA";
const WORKSPACE_NAME = "NEO Pulse";
const PURPOSE_FOLDERS = ["Reporting", "Audits", "Grids"];
const EXPECTED_CLIENT_COUNT = 17;
const DEFAULT_CSV = String.raw`c:\Users\Sean Craig\Downloads\neo-pulse-wordpress-sites-2026-08-20.csv`;

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function loadSitesFromCsv(csvPath) {
  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error(`CSV has no data rows: ${csvPath}`);

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const nameIdx = headers.indexOf("name");
  const idIdx = headers.indexOf("id");
  const siteUrlIdx = headers.indexOf("siteUrl");
  if (nameIdx < 0 || idIdx < 0) {
    throw new Error("CSV must include name and id columns.");
  }

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      name: cols[nameIdx]?.trim() ?? "",
      id: cols[idIdx]?.trim() ?? "",
      siteUrl: siteUrlIdx >= 0 ? cols[siteUrlIdx]?.trim() ?? "" : "",
    };
  });
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
  const csvArg = process.argv[2] || process.env.NEO_PULSE_SITES_CSV || DEFAULT_CSV;
  const csvPath = resolve(csvArg);
  const sites = sortSitesByDisplayName(loadSitesFromCsv(csvPath));

  if (sites.length !== EXPECTED_CLIENT_COUNT) {
    throw new Error(`Expected ${EXPECTED_CLIENT_COUNT} clients in CSV, found ${sites.length}.`);
  }

  console.log(`Provisioning ${sites.length} Properties clients from ${csvPath}:`);
  for (const site of sites) {
    console.log(`  - ${propertiesClientFolderName(site)}`);
  }

  const workspace = await apiPost("/google-mcp/resolve-folder-path/", {
    rootFolderId: SHARED_DRIVE_ID,
    segments: [WORKSPACE_NAME],
    createMissing: true,
  });

  const results = [];
  for (const site of sites) {
    const clientName = propertiesClientFolderName(site);
    const clientFolder = await apiPost("/google-mcp/resolve-folder-path/", {
      rootFolderId: workspace.folderId,
      segments: [clientName],
      createMissing: true,
    });

    const clientResult = {
      client: clientName,
      siteId: site.id,
      clientFolderLink: clientFolder.webViewLink ?? clientFolder.folderId,
      folders: {},
    };

    for (const purpose of PURPOSE_FOLDERS) {
      const resolved = await apiPost("/google-mcp/resolve-folder-path/", {
        rootFolderId: clientFolder.folderId,
        segments: [purpose],
        createMissing: true,
      });

      const monthFolder = await apiPost("/google-mcp/resolve-folder-path/", {
        rootFolderId: resolved.folderId,
        segments: driveDateSegments(),
        createMissing: true,
      });

      clientResult.folders[purpose] = monthFolder.webViewLink ?? monthFolder.folderId;
    }

    results.push(clientResult);
    console.log(`OK ${clientName}`);
  }

  console.log(
    JSON.stringify(
      {
        workspaceLink: workspace.webViewLink,
        clientCount: results.length,
        purposeFoldersPerClient: PURPOSE_FOLDERS.length,
        clients: results,
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

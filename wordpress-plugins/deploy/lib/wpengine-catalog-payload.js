import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadSites } from "./csv-sites.js";

/** Default Customer List CSV path. */
export function defaultWpEngineCsvPath(repoRoot) {
  return join(repoRoot, "wordpress-plugins/Customer List/SFTP Users_Clients List.csv");
}

export function buildWpEngineCatalogPayload(csvPath) {
  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }
  const sites = loadSites(csvPath);
  if (sites.length === 0) {
    throw new Error("No SFTP rows in CSV");
  }
  const updatedAt = new Date().toISOString();
  const rows = sites.map((row) => ({
    site: row.site,
    host: row.host,
    port: row.port,
    username: row.username,
    password: row.password,
    isStaging: /1stg/i.test(row.host) || /1stg/i.test(row.username),
  }));
  return { updatedAt, rows, count: rows.length };
}

export function writeWpEngineCatalogJson(csvPath, outPath) {
  const payload = buildWpEngineCatalogPayload(csvPath);
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

import { readFileSync } from "fs";

function parseRow(line) {
  const parts = line.split(",").map((item) => item.trim());
  const password = line.split(",").slice(4).join(",").trim().replace(/^"|"$/g, "");
  return {
    site: parts[0],
    host: parts[1],
    port: Number(parts[2]) || 2222,
    username: parts[3],
    password,
  };
}

function menuLabel(row, domainCounts) {
  if (domainCounts.get(row.site) > 1) {
    return `${row.site} (${row.username})`;
  }
  return row.site;
}

/** App hosts — not client WP plugin deploy targets */
const WP_CLIENT_DEPLOY_EXCLUDED = new Set(["flowbie.ca", "neodigital.ca"]);

export function isStagingSite(row) {
  const username = (row.username || "").toLowerCase();
  const host = (row.host || "").toLowerCase();
  return username.includes("1stg") || host.includes("1stg");
}

export function loadSites(csvPath) {
  const text = readFileSync(csvPath, "utf8");
  const rows = text
    .split(/\r?\n/)
    .slice(1)
    .map(parseRow)
    .filter((row) => row.site && row.host && row.username && row.password);

  const domainCounts = new Map();
  for (const row of rows) {
    domainCounts.set(row.site, (domainCounts.get(row.site) || 0) + 1);
  }

  return rows
    .map((row) => ({
      ...row,
      label: menuLabel(row, domainCounts),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Production clients only (staging rows and app hosts excluded). */
export function loadProductionSites(csvPath) {
  return loadSites(csvPath).filter(
    (row) => !isStagingSite(row) && !WP_CLIENT_DEPLOY_EXCLUDED.has(row.site.toLowerCase()),
  );
}

/** Staging rows only (1stg in host or username). */
export function loadStagingSites(csvPath) {
  return loadSites(csvPath).filter(isStagingSite);
}

/** @deprecated Use loadProductionSites / loadStagingSites */
export function loadDeployMenu(csvPath) {
  const sites = loadSites(csvPath);
  const staging = sites.filter(isStagingSite);
  const production = sites.filter((row) => !isStagingSite(row));
  return {
    stagingSite: staging[0] ?? null,
    productionSites: production,
  };
}

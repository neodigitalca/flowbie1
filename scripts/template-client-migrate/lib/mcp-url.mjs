import fs from "node:fs";

const SERVER_KEY = "emcp-neodigital-ca";

/**
 * @param {string} mcpPath
 * @param {string} emcpUrl
 */
export function pointEmcpUrl(mcpPath, emcpUrl) {
  if (!mcpPath) {
    throw new Error("MCP_JSON_PATH is required");
  }
  if (!emcpUrl || !String(emcpUrl).includes("/wp-json/mcp/")) {
    throw new Error("EMCP_URL must be a WordPress EMCP tools URL");
  }
  if (!fs.existsSync(mcpPath)) {
    throw new Error(`mcp.json not found: ${mcpPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.mcpServers || typeof parsed.mcpServers !== "object") {
    throw new Error("mcp.json must contain mcpServers");
  }
  const current = parsed.mcpServers[SERVER_KEY];
  parsed.mcpServers[SERVER_KEY] = {
    ...(current && typeof current === "object" ? current : {}),
    url: String(emcpUrl).trim(),
    headers: current?.headers && typeof current.headers === "object" ? current.headers : {},
  };
  fs.writeFileSync(mcpPath, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed.mcpServers[SERVER_KEY].url;
}

/**
 * @param {string} templateUrl
 */
export function hostFromUrl(templateUrl) {
  const u = new URL(templateUrl);
  return u.hostname.toLowerCase();
}

/**
 * @param {string} templateUrl
 */
export function jobSlugFromTemplate(templateUrl) {
  return hostFromUrl(templateUrl).replace(/[^a-z0-9.-]+/g, "-");
}

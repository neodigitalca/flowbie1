const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const LOCAL_CONFIG_PATH = path.join(REPO_ROOT, "scripts", "local-wp-staging.config.json");
const PRODUCTION_API_TARGET = "https://neodigital.ca";

function resolveDevApiTarget() {
  const fromEnv = (process.env.VITE_LOCAL_API_TARGET || "").trim();
  if (fromEnv) return fromEnv;

  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8"));
      const target = String(config.apiProxyTarget || config.siteUrl || "").trim();
      if (target) return target;
    } catch {
      // ignore invalid config
    }
  }

  return PRODUCTION_API_TARGET;
}

function isLocalWpProxyTarget(target) {
  try {
    const host = new URL(target).hostname.toLowerCase();
    return host.endsWith(".local") || host === "localhost" || host.startsWith("127.");
  } catch {
    return false;
  }
}

module.exports = {
  PRODUCTION_API_TARGET,
  resolveDevApiTarget,
  isLocalWpProxyTarget,
};

#!/usr/bin/env node
/**
 * Deploy NEO Pulse SPA + app plugin.
 *
 * Production (neodigital.ca):
 *   npm run build:neodigital-app
 *   npm run deploy:neodigital-app
 *
 * Test staging (flowbie.ca, dist only):
 *   npm run build:flowbie-test
 *   npm run deploy:flowbie-test
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";
import { buildDirZip } from "./deploy/lib/zip-dir.js";
import { uploadZipAndInstall } from "./deploy/lib/deploy-zip.js";
import { loadSites } from "./deploy/lib/csv-sites.js";
import { buildWpEngineCatalogPayload } from "./deploy/lib/wpengine-catalog-payload.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const distDir = join(repoRoot, "dist");
const pluginDir = join(__dirname, "neo-pulse-app");
const deployDir = join(__dirname, ".deploy");
const csvPath = join(__dirname, "Customer List", "SFTP Users_Clients List.csv");
const deploySite = (process.env.DEPLOY_SITE || "neodigital.ca").trim().toLowerCase();
const deployPlugin = process.env.DEPLOY_PLUGIN !== "0";
const deployMobile = process.env.DEPLOY_MOBILE === "1";

const SITE_PROFILES = {
  "flowbie.ca": {
    distRemote: "./flowbie",
    appRemote: "./wp-content/plugins/flowbie-app",
    appZipPrefix: "flowbie-app",
    appVerify: "flowbie-app.php",
    publicUrl: "https://flowbie.ca/flowbie/",
    spaBase: "flowbie",
  },
  "neodigital.ca": {
    distRemote: deployMobile ? "./mobile" : "./app",
    appRemote: "./wp-content/plugins/neo-pulse-app",
    appZipPrefix: "neo-pulse-app",
    appVerify: "neo-pulse-app.php",
    publicUrl: deployMobile ? "https://neodigital.ca/mobile/" : "https://neodigital.ca/app/",
    spaBase: deployMobile ? "mobile" : "app",
  },
};

const configPaths = [
  process.env.NEO_PULSE_WPENGINE_CONFIG,
  join(__dirname, "neo-pulse-wpengine.config.json"),
  join(__dirname, "flowbie-wpengine.config.json"),
].filter(Boolean);

function loadSiteFromWpEngineConfig() {
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    const siteUrl = String(raw.site ?? "").trim();
    const site = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (site !== deploySite || !raw.host || !raw.username || !(raw.password || raw.passwordPath)) continue;
    const profile = SITE_PROFILES[site] ?? SITE_PROFILES["neodigital.ca"];
    return {
      ...profile,
      site,
      host: raw.host,
      port: Number(raw.port) || 2222,
      username: raw.username,
      password: raw.password ?? "",
      distRemote: raw.neoPulseDistRemotePath ?? profile.distRemote,
      appRemote: raw.neoPulseAppRemotePath ?? profile.appRemote,
    };
  }
  return null;
}

function loadSite() {
  const profile = SITE_PROFILES[deploySite];
  if (!profile) {
    console.error(`Unknown DEPLOY_SITE=${deploySite}. Use flowbie.ca or neodigital.ca`);
    process.exit(1);
  }
  const fromConfig = loadSiteFromWpEngineConfig();
  if (fromConfig) return fromConfig;
  if (existsSync(csvPath)) {
    const rows = loadSites(csvPath).filter((s) => s.site === deploySite);
    const row = rows.find((s) => s.password) ?? rows[0];
    if (row?.password) return { ...profile, ...row };
  }
  console.error(`${deploySite} not found in Customer List CSV or wpengine config JSON`);
  process.exit(1);
}

function progress(label) {
  return (phase, done, total) => {
    if (phase === "upload") {
      const pct = total ? Math.round((done / total) * 100) : 0;
      process.stdout.write(`\r  ${label} zip upload: ${pct}%`);
      if (done >= total) process.stdout.write("\n");
      return;
    }
    if (phase === "install") {
      process.stdout.write(`\r  ${label} install: ${done}/${total}`);
      if (done >= total) process.stdout.write("\n");
    }
  };
}

function extractIndexScriptSrc(html, spaBase) {
  const match = html.match(new RegExp(`/${spaBase}/assets/index-[^"]+\\.js(?:\\?[^"]*)?`));
  return match?.[0] ?? "";
}

async function connectSftp(site) {
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 30000,
  });
  return sftp;
}

const ROOT_SPA_MARKER_START = "# BEGIN NEO Pulse SPA";
const ROOT_SPA_MARKER_END = "# END NEO Pulse SPA";

function cacheBustFromBuildInfo(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(raw.builtAt ?? "").replace(/[^0-9]/g, "");
}

function parseExistingRootCacheBusts(block) {
  const app =
    block.match(/RewriteRule \^app\/\?(?:index\\.html)?\$ \/app\/\?v=(\d+)/)?.[1] ??
    block.match(/RewriteRule \^app\/\?\$ \/app\/\?v=(\d+)/)?.[1] ??
    "";
  const mobile =
    block.match(/RewriteRule \^mobile\/\?(?:index\\.html)?\$ \/mobile\/\?v=(\d+)/)?.[1] ??
    block.match(/RewriteRule \^mobile\/\?\$ \/mobile\/\?v=(\d+)/)?.[1] ??
    "";
  return { app, mobile };
}

async function fetchRemoteBuildInfoCacheBust(sftp, remotePath) {
  try {
    const buf = await sftp.get(remotePath);
    const json = JSON.parse(Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf));
    return cacheBustFromBuildInfo(json);
  } catch {
    return "";
  }
}

/** @param {{ appBust?: string, mobileBust?: string, flowbieBust?: string }} busts */
function buildRootSpaBlock(busts) {
  const lines = [ROOT_SPA_MARKER_START, "<IfModule mod_rewrite.c>", "RewriteEngine On", ""];

  if (busts.mobileBust) {
    lines.push(
      "# Mobile latest-version entry redirect",
      `RewriteCond %{QUERY_STRING} !(^|&)v=${busts.mobileBust}(&|$)`,
      `RewriteRule ^mobile/?(?:index\\.html)?$ /mobile/?v=${busts.mobileBust} [R=302,L]`,
      "",
    );
  }

  if (busts.appBust) {
    lines.push(
      "# App latest-version entry redirect",
      `RewriteCond %{QUERY_STRING} !(^|&)v=${busts.appBust}(&|$)`,
      `RewriteRule ^app/?(?:index\\.html)?$ /app/?v=${busts.appBust} [R=302,L]`,
      "",
    );
  }

  if (busts.flowbieBust) {
    lines.push(
      "# Flowbie latest-version entry redirect",
      `RewriteCond %{QUERY_STRING} !(^|&)v=${busts.flowbieBust}(&|$)`,
      `RewriteRule ^flowbie/?$ /flowbie/?v=${busts.flowbieBust} [R=302,L]`,
      "",
    );
  }

  lines.push("# SPA static bypass (WordPress must not swallow asset requests)");
  if (busts.appBust || busts.mobileBust) {
    if (busts.appBust) lines.push("RewriteRule ^app/ - [L]");
    if (busts.mobileBust) lines.push("RewriteRule ^mobile/ - [L]");
  }
  if (busts.flowbieBust) {
    lines.push("RewriteRule ^flowbie/ - [L]");
  }
  lines.push("</IfModule>", ROOT_SPA_MARKER_END, "");
  return lines.join("\n");
}

async function forceUploadDistEntrypoint(site, localDistDir, remoteRoot, spaBase) {
  const localIndexPath = join(localDistDir, "index.html");
  const localHtml = readFileSync(localIndexPath, "utf8");
  const expectedScript = extractIndexScriptSrc(localHtml, spaBase);
  if (!expectedScript) {
    throw new Error(`dist/index.html missing /${spaBase}/assets/index-*.js script tag.`);
  }

  const entryFiles = ["index.html", "build-info.json", ".htaccess"];
  const remoteIndexPath = `${remoteRoot}/index.html`;

  const sftp = await connectSftp(site);
  try {
    console.log("  force-uploading entry files...");
    for (const name of entryFiles) {
      const localPath = join(localDistDir, name);
      if (!existsSync(localPath)) continue;
      await sftp.fastPut(localPath, `${remoteRoot}/${name}`);
    }

    const buf = await sftp.get(remoteIndexPath);
    const remoteHtml = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
    const remoteScript = extractIndexScriptSrc(remoteHtml, spaBase);
    if (remoteScript !== expectedScript) {
      throw new Error(
        `Origin index.html still wrong after force-upload (remote: ${remoteScript || "missing"}). Purge CDN cache for /${spaBase}/.`,
      );
    }
    console.log("  dist entrypoint OK:", expectedScript);
  } finally {
    await sftp.end();
  }
}

async function ensureRootHtaccessSpaBypass(site, spaBase, cacheBust) {
  const sftp = await connectSftp(site);
  try {
    const remotePath = "./.htaccess";
    let html = "";
    try {
      const buf = await sftp.get(remotePath);
      html = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
    } catch {
      html = "";
    }

    const existingBlockMatch = html.match(
      new RegExp(`${ROOT_SPA_MARKER_START}[\\s\\S]*?${ROOT_SPA_MARKER_END}`, "g"),
    );
    const existingBlock = existingBlockMatch?.[0] ?? "";
    const preserved = parseExistingRootCacheBusts(existingBlock);

    /** @type {{ appBust?: string, mobileBust?: string, flowbieBust?: string }} */
    const busts = {};
    if (deploySite === "neodigital.ca") {
      if (spaBase === "mobile") {
        busts.mobileBust = cacheBust;
        busts.appBust =
          (await fetchRemoteBuildInfoCacheBust(sftp, "./app/build-info.json")) || preserved.app;
      } else {
        busts.appBust = cacheBust;
        busts.mobileBust =
          (await fetchRemoteBuildInfoCacheBust(sftp, "./mobile/build-info.json")) || preserved.mobile;
      }
    } else {
      busts.flowbieBust = cacheBust;
    }

    const block = buildRootSpaBlock(busts);
    const stripped = html.replace(
      new RegExp(`${ROOT_SPA_MARKER_START}[\\s\\S]*?${ROOT_SPA_MARKER_END}\\n?`, "g"),
      "",
    );
    const wpBegin = stripped.indexOf("# BEGIN WordPress");
    const next =
      wpBegin >= 0 ? stripped.slice(0, wpBegin) + block + stripped.slice(wpBegin) : block + stripped;
    await sftp.put(Buffer.from(next, "utf8"), remotePath);

    if (busts.mobileBust) {
      console.log(`  root .htaccess mobile entry: /mobile/?v=${busts.mobileBust}`);
    }
    if (busts.appBust) {
      console.log(`  root .htaccess app entry: /app/?v=${busts.appBust}`);
    }
    if (busts.flowbieBust) {
      console.log(`  root .htaccess flowbie entry: /flowbie/?v=${busts.flowbieBust}`);
    }
  } finally {
    await sftp.end();
  }
}

async function uploadWpEngineCatalog(site) {
  if (!existsSync(csvPath)) {
    console.log("\n(WP Engine catalog skipped: Customer List CSV not found)");
    return;
  }
  const payload = buildWpEngineCatalogPayload(csvPath);
  const localJson = join(deployDir, "wpengine-sftp-catalog.json");
  writeFileSync(localJson, JSON.stringify(payload, null, 2), "utf8");
  const remotePath = "./wp-content/uploads/neo-pulse-data/wpengine-sftp-catalog.json";
  console.log("\n=== WP Engine SFTP catalog ===");
  console.log(`  rows: ${payload.count}`);
  const sftp = await connectSftp(site);
  try {
    await sftp.mkdir("./wp-content/uploads/neo-pulse-data", true);
    await sftp.put(Buffer.from(JSON.stringify(payload, null, 2), "utf8"), remotePath);
  } finally {
    await sftp.end();
  }
  console.log("  catalog uploaded");
}

async function main() {
  if (!existsSync(distDir)) {
    console.error("dist/ missing. Run build first.");
    process.exit(1);
  }

  const site = loadSite();
  const neodigitalProfile = SITE_PROFILES["neodigital.ca"];
  const mobileProfile = deployMobile ? neodigitalProfile : null;
  const distRemote = String(
    mobileProfile?.distRemote ??
      site.distRemote ??
      site.neoPulseDistRemotePath ??
      neodigitalProfile.distRemote,
  ).replace(/\/+$/, "");
  const appRemote = String(site.appRemote ?? site.neoPulseAppRemotePath ?? neodigitalProfile.appRemote).replace(
    /\/+$/,
    "",
  );
  const spaBase = mobileProfile?.spaBase ?? site.spaBase ?? distRemote.replace(/^\.\//, "");
  mkdirSync(deployDir, { recursive: true });

  const buildInfoPath = join(distDir, "build-info.json");
  const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));
  const cacheBust = String(buildInfo.builtAt ?? Date.now()).replace(/[^0-9]/g, "");

  const htaccess = `# NEO Pulse SPA fallback
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /${spaBase}/

# Redirect bare entry and stale ?v= to the current build stamp
RewriteCond %{QUERY_STRING} !(^|&)v=${cacheBust}(&|$)
RewriteRule ^(index\\.html)?$ /${spaBase}/?v=${cacheBust} [R=302,L]

RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /${spaBase}/index.html [L]
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "^(index\\.html|build-info\\.json)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
    Header set CDN-Cache-Control "no-store"
    Header set X-Cacheable "NO"
  </FilesMatch>
</IfModule>
`;

  writeFileSync(join(distDir, ".htaccess"), htaccess, "utf8");

  const distZip = join(deployDir, `${deploySite.replace(/\./g, "-")}-dist.zip`);
  console.log("Building dist zip...");
  buildDirZip(distDir, distZip);
  console.log("  dist zip:", distZip);

  console.log("\nDeploy:", site.site);
  console.log("Host:", `${site.host}:${site.port}`);
  console.log("User:", site.username);
  console.log("SPA path:", distRemote);

  console.log("\n=== React dist ===");
  await uploadZipAndInstall(site, {
    zipPath: distZip,
    localDir: distDir,
    remoteZipPath: `./_neo-pulse-deploy/${deploySite}-dist.zip`,
    installRoot: distRemote,
    verifyRelPath: "index.html",
    onProgress: progress("dist"),
  });

  await forceUploadDistEntrypoint(site, distDir, distRemote, spaBase);
  await ensureRootHtaccessSpaBypass(site, spaBase, cacheBust);

  if (deployPlugin && !deployMobile) {
    const appZip = join(deployDir, `${deploySite.replace(/\./g, "-")}-app.zip`);
    console.log("\n=== app plugin ===");
    buildDirZip(pluginDir, appZip, { zipPrefix: site.appZipPrefix ?? "neo-pulse-app" });
    await uploadZipAndInstall(site, {
      zipPath: appZip,
      localDir: pluginDir,
      remoteZipPath: `./wp-content/plugins/${site.appZipPrefix ?? "neo-pulse-app"}.zip`,
      installRoot: appRemote,
      verifyRelPath: site.appVerify ?? "neo-pulse-app.php",
      onProgress: progress("plugin"),
    });
  } else if (deployMobile) {
    console.log("\n(plugin upload skipped for mobile dist-only deploy)");
  } else {
    console.log("\n(plugin upload skipped)");
  }

  if (deploySite === "neodigital.ca" && deployPlugin && !deployMobile) {
    const wpClientDir = join(__dirname, "neo-pulse-wp");
    const wpZip = join(deployDir, "neo-pulse-wp-server-staging.zip");
    console.log("\n=== neo-pulse-wp server staging (in-app SFTP deploy) ===");
    buildDirZip(wpClientDir, wpZip);
    await uploadZipAndInstall(site, {
      zipPath: wpZip,
      localDir: wpClientDir,
      remoteZipPath: "./wp-content/uploads/neo-pulse-data/wpengine/neo-pulse-wp-staging.zip",
      installRoot: "./wp-content/uploads/neo-pulse-data/wpengine/plugin/neo-pulse-wp",
      verifyRelPath: "neo-pulse-wp.php",
      onProgress: progress("wpengine-staging"),
    });

    await uploadWpEngineCatalog(site);
  }

  const doneUrl = `${mobileProfile?.publicUrl ?? site.publicUrl ?? `https://${site.site}/${spaBase}/`}?v=${cacheBust}`;
  console.log(`\nDone: ${doneUrl}`);
  if (deploySite === "neodigital.ca") {
    console.log(`Next: npm run smoke:neo-pulse`);
    console.log(`Open: ${doneUrl}`);
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});

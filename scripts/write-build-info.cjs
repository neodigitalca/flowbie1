/**
 * After `vite build`, writes dist/build-info.json for deploy verification.
 * On Render, RENDER_GIT_COMMIT is set - compare to GitHub to confirm the static site built the expected commit.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const dist = path.join(__dirname, "..", "dist");
const out = path.join(dist, "build-info.json");
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

let gitSha = process.env.RENDER_GIT_COMMIT || "";
if (!gitSha) {
  try {
    gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    gitSha = "unknown";
  }
}

const payload = {
  version: pkg.version,
  builtAt: new Date().toISOString(),
  gitSha,
  render: process.env.RENDER === "true",
  node: process.version,
};

if (!fs.existsSync(dist)) {
  console.error("[write-build-info] dist/ missing; run vite build first.");
  process.exit(1);
}

fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
console.log("[write-build-info] wrote", out, payload.version, payload.gitSha.slice(0, 7));

const indexPath = path.join(dist, "index.html");
if (fs.existsSync(indexPath)) {
  const cacheBust = payload.builtAt.replace(/[^0-9]/g, "");
  let html = fs.readFileSync(indexPath, "utf8");

  html = html.replace(
    /<script>\(function\(\)\{(?:var embedded=|var v=)[\s\S]*?<\/script>\s*/g,
    "",
  );

  const basePath = (process.env.VITE_BASE_PATH || "/neo-pulse/").replace(/\/?$/, "/");
  const basePathNoSlash = basePath.replace(/^\/|\/$/g, "");
  const forceDeployStampScript = `<script>(function(){var embedded="${cacheBust}";var base="${basePath}";function go(v){if(!v)return;var p=new URLSearchParams(location.search);if(p.get("v")===v)return;p.set("v",v);location.replace(location.pathname+"?"+p.toString()+location.hash);}go(embedded);fetch(base+"build-info.json?_="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){var fetched=String(j.builtAt||"").replace(/[^0-9]/g,"");if(!fetched||fetched===embedded)return;if(fetched>embedded)go(fetched);}).catch(function(){});})();</script>`;

  html = html.replace("<head>", `<head>\n    ${forceDeployStampScript}`);
  html = html.replace(
    new RegExp(`(/${basePathNoSlash}/assets/[^"]+\\.(?:js|css))(?:\\?[^"]*)?"`, "g"),
    `$1?v=${cacheBust}"`,
  );
  html = html.replace(/content="\/branding\//g, `content="${basePath}branding/`);

  fs.writeFileSync(indexPath, html, "utf8");
  console.log("[write-build-info] force deploy stamp", cacheBust);
}

/**
 * After `vite build`, writes dist/build-info.json for deploy verification.
 * On Render, RENDER_GIT_COMMIT is set - compare to GitHub to confirm the static site built the expected commit.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const dist = path.join(__dirname, "..", "dist");
const out = path.join(dist, "build-info.json");

let gitSha = process.env.RENDER_GIT_COMMIT || "";
if (!gitSha) {
  try {
    gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    gitSha = "unknown";
  }
}

const payload = {
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
console.log("[write-build-info] wrote", out, payload.gitSha.slice(0, 7));

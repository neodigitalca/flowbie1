import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";

const SKIP_DIRS = new Set(["tests", ".git", "node_modules"]);

function shouldSkip(rel) {
  if (rel.split("/").some((p) => SKIP_DIRS.has(p))) return true;
  if (!rel.includes("/") && rel.toLowerCase().endsWith(".md")) return true;
  return false;
}

function collectFiles(root, rel = "") {
  const files = [];
  for (const ent of readdirSync(join(root, rel), { withFileTypes: true })) {
    const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
    if (shouldSkip(nextRel.replace(/\\/g, "/"))) continue;
    if (ent.isDirectory()) {
      files.push(...collectFiles(root, nextRel));
    } else if (ent.isFile()) {
      files.push({ local: join(root, nextRel), rel: nextRel.replace(/\\/g, "/") });
    }
  }
  return files;
}

export function buildPluginZip(pluginDir, zipPath, onProgress) {
  const files = collectFiles(pluginDir);
  const zip = new AdmZip();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    zip.addFile(`flowbie-wp/${file.rel}`, readFileSync(file.local));
    onProgress?.(i + 1, files.length);
  }

  zip.writeZip(zipPath);
}

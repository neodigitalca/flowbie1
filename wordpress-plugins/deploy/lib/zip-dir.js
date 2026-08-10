import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { assertNoSecretsInFiles, isSecretRelPath } from "./secret-excludes.js";

const SKIP_DIRS = new Set(["tests", ".git", "node_modules"]);

function shouldSkip(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (norm.split("/").some((p) => SKIP_DIRS.has(p))) return true;
  if (!norm.includes("/") && norm.toLowerCase().endsWith(".md")) return true;
  if (isSecretRelPath(norm)) return true;
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

/** Build a zip from a directory. Optional zipPrefix prepended to each entry (e.g. flowbie-app/). */
export function buildDirZip(rootDir, zipPath, options = {}) {
  const { zipPrefix = "", onProgress } = options;
  const files = collectFiles(rootDir);
  assertNoSecretsInFiles(files, "Zip build");
  const zip = new AdmZip();
  const prefix = zipPrefix ? `${zipPrefix.replace(/\/+$/, "")}/` : "";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    zip.addFile(`${prefix}${file.rel}`, readFileSync(file.local));
    onProgress?.(i + 1, files.length);
  }

  zip.writeZip(zipPath);
  return { fileCount: files.length, zipPath };
}

import fs from "node:fs";
import path from "node:path";
import { validateBrandAssetList } from "../schema/client-map.mjs";
import {
  buildClassifyAssetsUser,
  CLASSIFY_BRAND_ASSETS_SYSTEM,
} from "../prompts/classify-brand-assets.mjs";
import { chatJson } from "./openrouter.mjs";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".pdf"]);

/**
 * @param {string} folder
 */
export function listBrandFiles(folder) {
  if (!folder) return [];
  if (!fs.existsSync(folder)) {
    throw new Error(`Brand folder not found: ${folder}`);
  }
  const stat = fs.statSync(folder);
  if (!stat.isDirectory()) {
    throw new Error(`Brand folder is not a directory: ${folder}`);
  }
  return fs
    .readdirSync(folder)
    .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()))
    .sort();
}

/**
 * @param {unknown} raw
 */
export function parseBrandAssets(raw) {
  const list = raw && typeof raw === "object" && Array.isArray(raw.assets) ? raw.assets : raw;
  return validateBrandAssetList(list);
}

/**
 * @param {{ folder: string, teamNames?: string[], apiKey: string, chat?: typeof chatJson }} input
 */
export async function classifyBrandFolder(input) {
  const filenames = listBrandFiles(input.folder);
  if (filenames.length === 0) {
    return [];
  }
  const raw = await (input.chat || chatJson)({
    apiKey: input.apiKey,
    system: CLASSIFY_BRAND_ASSETS_SYSTEM,
    user: buildClassifyAssetsUser({
      filenames,
      teamNames: input.teamNames ?? [],
    }),
  });
  const assets = parseBrandAssets(raw);
  const allowed = new Set(filenames);
  for (const row of assets) {
    if (!allowed.has(row.filename)) {
      throw new Error(`Classified filename is not in the brand folder: ${row.filename}`);
    }
    row.absPath = path.join(input.folder, row.filename);
  }
  return assets;
}

/**
 * @param {string} absPath
 */
export function fileToBase64(absPath) {
  return fs.readFileSync(absPath).toString("base64");
}

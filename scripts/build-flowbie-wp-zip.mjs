#!/usr/bin/env node
/**
 * Build flowbie-wp.zip excluding local credential files.
 *
 * Usage: node scripts/build-flowbie-wp-zip.mjs
 */

import { buildPluginZip } from "../wordpress-plugins/deploy/lib/build-zip.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(root, "wordpress-plugins", "flowbie-wp");
const zipPath = join(root, "wordpress-plugins", "flowbie-wp.zip");

buildPluginZip(pluginDir, zipPath, (done, total) => {
  process.stdout.write(`\r  zip ${Math.round((done / total) * 100)}%`);
});
process.stdout.write("\n");
console.log("Wrote", zipPath);

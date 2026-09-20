/**
 * Rebinds a staging header JSON and writes it onto a destination header post.
 * SFTP password from the client CSV or WPE_SFTP_PASS. Do not log or commit it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProductionSites } from "../../wordpress-plugins/deploy/lib/csv-sites.js";
import { parseHeaderApplyArgs } from "./lib/header-apply-args.mjs";
import { BLIND_MAGIC_REPLACEMENTS, rebindHeaderJson } from "./lib/header-json-rebind.mjs";
import { uploadMuPlugin } from "./lib/sftp-mu-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = parseHeaderApplyArgs(process.env, process.argv.slice(2), root);

if (!fs.existsSync(args.sourcePath)) {
  throw new Error(`header source JSON is missing: ${args.sourcePath}`);
}

const raw = JSON.parse(fs.readFileSync(args.sourcePath, "utf8"));
const tree = raw.json || raw;
const replacements =
  args.destSite === "blindmagic.com"
    ? BLIND_MAGIC_REPLACEMENTS
    : [
        { from: args.fromHost, to: args.destSite },
        ...(args.email ? [{ from: "info@drcentre.ca", to: args.email }] : []),
        ...(args.phone ? [{ from: "(800) 610-0331", to: args.phone }] : []),
      ];
const rebound = rebindHeaderJson(tree, {
  menuId: args.menuId,
  logo: { id: args.logoId, url: args.logoUrl },
  promotionsUrl: args.promotionsUrl,
  replacements,
});
fs.mkdirSync(path.dirname(args.reboundPath), { recursive: true });
fs.writeFileSync(args.reboundPath, `${JSON.stringify(rebound)}\n`);

const csvPath = path.join(root, "wordpress-plugins/Customer List/SFTP Users_Clients List.csv");
const site = loadProductionSites(csvPath).find((row) => row.site === args.destSite);
if (!site) throw new Error(`${args.destSite} not in SFTP catalog`);
const password = process.env.WPE_SFTP_PASS || site.password;
if (!password) throw new Error("WPE_SFTP_PASS is required");

const lockName = path.posix.basename(args.lockRel);
const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/${lockName}';
  if (file_exists($lock)) {
    @unlink(__FILE__);
    return;
  }
  $json = ${JSON.stringify(JSON.stringify(rebound))};
  $data = json_decode($json, true);
  if (!is_array($data)) {
    return;
  }
  update_post_meta(${args.headerId}, '_elementor_data', wp_slash($json));
  delete_post_meta(${args.headerId}, '_elementor_element_cache');
  delete_post_meta(${args.headerId}, '_elementor_css');
  delete_post_meta(${args.headerId}, '_elementor_page_assets');
  delete_post_meta(${args.headerId}, '_elementor_controls_usage');
  if (function_exists('update_field') && ${JSON.stringify(args.phone)}) {
    update_field('ci_phone', ${JSON.stringify(args.phone)}, 'option');
  }
  if (class_exists('\\Elementor\\Plugin')) {
    \\Elementor\\Plugin::instance()->files_manager->clear_cache();
  }
  $dir = WP_CONTENT_DIR . '/uploads/elementor/css';
  if (is_dir($dir)) {
    foreach (scandir($dir) as $file) {
      if (substr($file, -4) === '.css') {
        @unlink($dir . '/' . $file);
      }
    }
  }
  file_put_contents($lock, gmdate('c'));
  @unlink(__FILE__);
}, 20);
`;

const remote = await uploadMuPlugin({
  host: site.host,
  port: site.port,
  username: site.username,
  password,
  remoteName: args.remoteName,
  php,
  deleteBefore: [args.lockRel],
});
console.log("uploaded", remote);
console.log("wrote", args.reboundPath);

const trigger = new URL(args.triggerUrl);
trigger.searchParams.set("tcm-header", "1");
const hit = await fetch(trigger.href);
console.log("triggered", hit.status, trigger.href);

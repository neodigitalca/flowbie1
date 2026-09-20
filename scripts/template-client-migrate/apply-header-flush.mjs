/**
 * Deletes stale Elementor document cache on Blind Magic header 101.
 * SFTP password from the client CSV. Do not log or commit it.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProductionSites } from "../../wordpress-plugins/deploy/lib/csv-sites.js";
import { uploadMuPlugin } from "./lib/sftp-mu-plugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const csvPath = path.join(root, "wordpress-plugins/Customer List/SFTP Users_Clients List.csv");
const site = loadProductionSites(csvPath).find((row) => row.site === "blindmagic.com");
if (!site) throw new Error("blindmagic.com not in SFTP catalog");

const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.tcm-bm-header-flush-done';
  if (file_exists($lock)) {
    @unlink(__FILE__);
    return;
  }
  delete_post_meta(101, '_elementor_element_cache');
  delete_post_meta(101, '_elementor_css');
  delete_post_meta(101, '_elementor_page_assets');
  delete_post_meta(101, '_elementor_controls_usage');
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
  password: site.password,
  remoteName: "tcm-bm-header-flush-once.php",
  php,
});
console.log("uploaded", remote);

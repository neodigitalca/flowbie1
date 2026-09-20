/**
 * Uploads a one-shot mu-plugin that writes DRC ACF options and leftover string replace.
 * Password stays in WPE_SFTP_PASS. Do not commit secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const here = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(here, "drc-blinds-content-map.json"), "utf8"));
const password = process.env.WPE_SFTP_PASS;
if (!password) {
  console.error("WPE_SFTP_PASS is required");
  process.exit(1);
}

const php = `<?php
add_action('init', function () {
  if (!function_exists('update_field')) {
    return;
  }
  $lock = WP_CONTENT_DIR . '/uploads/.drc-apply-done';
  if (file_exists($lock)) {
    return;
  }
  $acf = json_decode(${JSON.stringify(JSON.stringify(map.acf))}, true);
  foreach ($acf as $key => $value) {
    update_field($key, $value, 'option');
  }
  $logo = ${Number(map.logo_attachment_id)};
  if ($logo) {
    update_field('ci_logo_dark', $logo, 'option');
    update_field('ci_logo_white', $logo, 'option');
    update_field('ci_logo_icon', $logo, 'option');
  }
  $pairs = json_decode(${JSON.stringify(JSON.stringify(map.search_replace))}, true);
  global $wpdb;
  foreach ($pairs as $pair) {
    $from = $pair['from'];
    $to = $pair['to'];
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_title = REPLACE(post_title, %s, %s), post_content = REPLACE(post_content, %s, %s), post_excerpt = REPLACE(post_excerpt, %s, %s)", $from, $to, $from, $to, $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)", $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s)", $from, $to));
  }
  if (class_exists('\\Elementor\\Plugin')) {
    \\Elementor\\Plugin::instance()->files_manager->clear_cache();
  }
  file_put_contents($lock, gmdate('c'));
  @unlink(__FILE__);
}, 20);
`;

const sftp = new SftpClient();
await sftp.connect({
  host: process.env.WPE_SFTP_HOST || "blindswebsitet.sftp.wpengine.com",
  port: Number(process.env.WPE_SFTP_PORT || 2222),
  username: process.env.WPE_SFTP_USER || "blindswebsitet-sean",
  password,
  readyTimeout: 30000,
});
const remote = "./wp-content/mu-plugins/drc-apply-once.php";
await sftp.mkdir("./wp-content/mu-plugins", true);
await sftp.put(Buffer.from(php, "utf8"), remote);
await sftp.end();
console.log("uploaded", remote);

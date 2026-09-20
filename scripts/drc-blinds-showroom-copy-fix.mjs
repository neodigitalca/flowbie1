/**
 * Replaces leftover 1800 sq ft showroom claims. Password in WPE_SFTP_PASS.
 */
import SftpClient from "ssh2-sftp-client";

const password = process.env.WPE_SFTP_PASS;
if (!password) {
  console.error("WPE_SFTP_PASS is required");
  process.exit(1);
}

const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.drc-showroom-copy-done';
  if (file_exists($lock)) {
    return;
  }
  $pairs = array(
    'our new, 1,800 square foot showroom' => 'our Vancouver showroom',
    'our 1800 sq. ft showroom' => 'our Vancouver showroom',
    'Largest Gallery Showroom in Vancouver, measuring 1,800 square feet.' => 'Hunter Douglas Gallery Showroom in Vancouver.',
  );
  global $wpdb;
  foreach ($pairs as $from => $to) {
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)", $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)", $from, $to));
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
  host: "blindswebsitet.sftp.wpengine.com",
  port: 2222,
  username: "blindswebsitet-sean",
  password,
  readyTimeout: 30000,
});
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/mu-plugins/drc-showroom-copy-once.php");
await sftp.end();
console.log("uploaded showroom copy fix");

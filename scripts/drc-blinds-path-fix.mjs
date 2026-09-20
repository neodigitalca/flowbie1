/**
 * Restores media filenames that the first replace rewrote. Password in WPE_SFTP_PASS.
 */
import SftpClient from "ssh2-sftp-client";

const password = process.env.WPE_SFTP_PASS;
if (!password) {
  console.error("WPE_SFTP_PASS is required");
  process.exit(1);
}

const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.drc-path-fix-done';
  if (file_exists($lock)) {
    return;
  }
  $pairs = array(
    "Designer's Resource Centre-Blinds" => 'Lindsey-Blinds',
    "Designer's Resource Centre-blinds" => 'Lindsey-blinds',
    "Designer's Resource Centre-Dark" => 'Lindsey-Dark',
    "Designer's Resource Centre-White" => 'Lindsey-White',
    'Designer&#039;s Resource Centre-Blinds' => 'Lindsey-Blinds',
    'Designer&#039;s Resource Centre-blinds' => 'Lindsey-blinds',
    'Designer&#039;s Resource Centre-Dark' => 'Lindsey-Dark',
    'Designer&#039;s Resource Centre-White' => 'Lindsey-White',
  );
  global $wpdb;
  foreach ($pairs as $from => $to) {
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET guid = REPLACE(guid, %s, %s), post_title = REPLACE(post_title, %s, %s), post_name = REPLACE(post_name, %s, %s)", $from, $to, $from, $to, $from, $to));
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
await sftp.delete("./wp-content/mu-plugins/drc-apply-once.php").catch(() => {});
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/mu-plugins/drc-path-fix-once.php");
await sftp.end();
console.log("uploaded path fix");

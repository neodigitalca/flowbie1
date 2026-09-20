/**
 * Flushes Elementor CSS cache after color writes. Password in WPE_SFTP_PASS.
 */
import SftpClient from "ssh2-sftp-client";

const password = process.env.WPE_SFTP_PASS;
if (!password) {
  console.error("WPE_SFTP_PASS is required");
  process.exit(1);
}

const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.drc-css-flush-done';
  if (file_exists($lock)) {
    @unlink(__FILE__);
    return;
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

const sftp = new SftpClient();
await sftp.connect({
  host: "blindswebsitet.sftp.wpengine.com",
  port: 2222,
  username: "blindswebsitet-sean",
  password,
  readyTimeout: 30000,
});
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/mu-plugins/drc-css-flush-once.php");
await sftp.end();
console.log("uploaded css flush");

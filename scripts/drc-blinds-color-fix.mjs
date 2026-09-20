/**
 * Sets DRC dealer colors (black, white, blue #2C72DB) on the Elementor kit
 * and replaces leftover purple/orange hex. Password in WPE_SFTP_PASS.
 * Writes post meta directly. Elementor update_settings requires a logged-in user.
 */
import SftpClient from "ssh2-sftp-client";

const password = process.env.WPE_SFTP_PASS;
if (!password) {
  console.error("WPE_SFTP_PASS is required");
  process.exit(1);
}

const php = `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.drc-colors-blue-done';
  if (file_exists($lock)) {
    @unlink(__FILE__);
    return;
  }
  $kit_id = (int) get_option('elementor_active_kit');
  if ($kit_id) {
    $settings = get_post_meta($kit_id, '_elementor_page_settings', true);
    if (is_array($settings) && isset($settings['system_colors']) && is_array($settings['system_colors'])) {
      foreach ($settings['system_colors'] as &$slot) {
        $id = isset($slot['_id']) ? $slot['_id'] : '';
        if ($id === 'primary') {
          $slot['color'] = '#000000';
        }
        if ($id === 'secondary') {
          $slot['color'] = '#5B6770';
        }
        if ($id === 'text') {
          $slot['color'] = '#000000';
        }
        if ($id === 'accent') {
          $slot['color'] = '#2C72DB';
        }
      }
      unset($slot);
      update_post_meta($kit_id, '_elementor_page_settings', $settings);
    }
  }
  $pairs = array(
    '#4D2B82' => '#2C72DB',
    '#4d2b82' => '#2C72DB',
    '#F68B21' => '#2C72DB',
    '#f68b21' => '#2C72DB',
  );
  global $wpdb;
  foreach ($pairs as $from => $to) {
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)", $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE post_id <> %d", $from, $to, $kit_id));
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
  host: "blindswebsitet.sftp.wpengine.com",
  port: 2222,
  username: "blindswebsitet-sean",
  password,
  readyTimeout: 30000,
});
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/mu-plugins/drc-colors-blue-once.php");
await sftp.end();
console.log("uploaded color fix");

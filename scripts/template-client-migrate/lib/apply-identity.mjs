import { isHex7 } from "../schema/client-map.mjs";

/**
 * @param {{ from: string, to: string }[]} pairs
 */
export function sortReplacePairs(pairs) {
  return [...pairs].sort((a, b) => b.from.length - a.from.length);
}

/**
 * @param {string} hex
 */
export function assertHex7(hex, label) {
  if (!isHex7(hex)) {
    throw new Error(`${label} must be #RRGGBB`);
  }
  return hex.toUpperCase();
}

/**
 * Same-length #RRGGBB only so PHP serialized strings stay valid.
 * @param {Record<string, string>} leftoverHex
 * @param {Record<string, string>} clientHex
 */
export function buildHexPairs(leftoverHex, clientHex) {
  const pairs = [];
  const keys = ["primary", "secondary", "text", "accent"];
  for (const key of keys) {
    const from = leftoverHex?.[key];
    const to = clientHex?.[key];
    if (!from || !to) continue;
    const a = assertHex7(from, `leftover ${key}`);
    const b = assertHex7(to, `client ${key}`);
    if (a.length !== b.length) {
      throw new Error(`Hex replace for ${key} must be the same length`);
    }
    if (a !== b) pairs.push({ from: a, to: b }, { from: a.toLowerCase(), to: b });
  }
  return pairs;
}

/**
 * @param {{ slug: string, acf: Record<string, string>, logoFields?: Record<string, number>, searchReplace: {from:string,to:string}[], colors: {primary:string,secondary:string,text:string,accent:string}, hexPairs: {from:string,to:string}[] }} job
 */
export function buildIdentityPhp(job) {
  const slug = String(job.slug || "job").replace(/[^a-z0-9.-]+/gi, "-");
  const acf = job.acf && typeof job.acf === "object" ? job.acf : {};
  const logoFields = job.logoFields && typeof job.logoFields === "object" ? job.logoFields : {};
  const pairs = sortReplacePairs(job.searchReplace || []);
  const colors = job.colors;
  assertHex7(colors.primary, "primary");
  assertHex7(colors.secondary, "secondary");
  assertHex7(colors.text, "text");
  assertHex7(colors.accent, "accent");
  const hexPairs = job.hexPairs || [];

  return `<?php
add_action('init', function () {
  $lock = WP_CONTENT_DIR . '/uploads/.tcm-${slug}-done';
  if (file_exists($lock)) {
    @unlink(__FILE__);
    return;
  }
  $acf = json_decode(${JSON.stringify(JSON.stringify(acf))}, true);
  if (function_exists('update_field')) {
    foreach ($acf as $key => $value) {
      update_field($key, $value, 'option');
    }
    $logos = json_decode(${JSON.stringify(JSON.stringify(logoFields))}, true);
    foreach ($logos as $key => $id) {
      if ($id) {
        update_field($key, (int) $id, 'option');
      }
    }
  }
  $pairs = json_decode(${JSON.stringify(JSON.stringify(pairs))}, true);
  global $wpdb;
  foreach ($pairs as $pair) {
    $from = $pair['from'];
    $to = $pair['to'];
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_title = REPLACE(post_title, %s, %s), post_content = REPLACE(post_content, %s, %s), post_excerpt = REPLACE(post_excerpt, %s, %s)", $from, $to, $from, $to, $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)", $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s)", $from, $to));
  }
  $kit_id = (int) get_option('elementor_active_kit');
  if ($kit_id) {
    $settings = get_post_meta($kit_id, '_elementor_page_settings', true);
    if (is_array($settings) && isset($settings['system_colors']) && is_array($settings['system_colors'])) {
      foreach ($settings['system_colors'] as &$slot) {
        $id = isset($slot['_id']) ? $slot['_id'] : '';
        if ($id === 'primary') { $slot['color'] = '${colors.primary}'; }
        if ($id === 'secondary') { $slot['color'] = '${colors.secondary}'; }
        if ($id === 'text') { $slot['color'] = '${colors.text}'; }
        if ($id === 'accent') { $slot['color'] = '${colors.accent}'; }
      }
      unset($slot);
      update_post_meta($kit_id, '_elementor_page_settings', $settings);
    }
  }
  $hex = json_decode(${JSON.stringify(JSON.stringify(hexPairs))}, true);
  foreach ($hex as $pair) {
    $from = $pair['from'];
    $to = $pair['to'];
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)", $from, $to));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE post_id <> %d", $from, $to, $kit_id));
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s)", $from, $to));
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
}

import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const code = `
// Disable neo_pulse_wp_global_css frontend injection
update_option('global-css_gc_enabled', '0');
update_option('global-css_gc_body_font_family', 'Lato');
update_option('global-css_gc_body_font_weight', '400');
update_option('global-css_gc_body_font_size', '1.5rem');
update_option('global-css_gc_body_line_height', '1.6');
update_option('global-css_gc_body_color', '#c8c8c8');

// Remove rogue black heading colors
for ($i = 1; $i <= 6; $i++) {
    update_option("global-css_gc_h{$i}_color", '');
    update_option("global-css_gc_h{$i}_font_weight", '');
}

// Clean Elementor generated CSS cache
if ( class_exists( '\\Elementor\\Plugin' ) ) {
    \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}

echo wp_json_encode(array(
  'ok' => true,
  'enabled' => get_option('global-css_gc_enabled'),
  'family' => get_option('global-css_gc_body_font_family'),
  'weight' => get_option('global-css_gc_body_font_weight')
));
`;

const res = await runNeodigitalPhp(code, "oneshot-fix-global-css-options");
console.log("FIX OPTIONS RESULT:", res);

import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const code = `
$enabled = get_option('global-css_gc_enabled');
$family = get_option('global-css_gc_body_font_family');
$weight = get_option('global-css_gc_body_font_weight');
echo wp_json_encode(array(
  'ok' => true,
  'enabled' => $enabled,
  'family' => $family,
  'weight' => $weight
));
`;

const res = await runNeodigitalPhp(code, "oneshot-test-np-css");
console.log("RESPONSE:", res);

/**
 * Apply crawl-budget index rules on neodigital.ca: robots, sitemap types, flush.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { uploadNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const phpInner = `
$skip_types = Neo_Pulse_Wp_Index_Rules::noindex_post_types();
$skip_tax = Neo_Pulse_Wp_Index_Rules::noindex_taxonomies();
$config = Neo_Pulse_Wp_Sitemap_Settings::get_config();
$changed = array();
foreach ( $config['post_types'] as $slug => $row ) {
  $want = ! in_array( $slug, $skip_types, true );
  if ( ! empty( $row['include_xml'] ) !== $want ) {
    $config['post_types'][ $slug ]['include_xml'] = $want;
    $config['post_types'][ $slug ]['include_html'] = $want;
    $changed[] = 'type:' . $slug . '=' . ( $want ? '1' : '0' );
  }
}
foreach ( $config['taxonomies'] as $slug => $row ) {
  $want = ! in_array( $slug, $skip_tax, true );
  if ( ! empty( $row['include_xml'] ) !== $want ) {
    $config['taxonomies'][ $slug ]['include_xml'] = $want;
    $config['taxonomies'][ $slug ]['include_html'] = $want;
    $changed[] = 'tax:' . $slug . '=' . ( $want ? '1' : '0' );
  }
}
Neo_Pulse_Wp_Sitemap_Settings::save_config( $config );
Neo_Pulse_Wp_Robots_Txt::save_content( Neo_Pulse_Wp_Robots_Txt::default_content( true ) );
if ( class_exists( 'Neo_Pulse_Wp_Sitemap_Cache', false ) ) {
  Neo_Pulse_Wp_Sitemap_Cache::flush_all();
}
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
  Neo_Pulse_Wp_Cache_Flush::purge_html_caches();
}
$after = Neo_Pulse_Wp_Sitemap_Settings::get_config();
$xml = array();
foreach ( $after['post_types'] as $slug => $row ) {
  $xml[ $slug ] = ! empty( $row['include_xml'] );
}
echo wp_json_encode( array(
  'changed' => $changed,
  'sitemap_xml' => $xml,
  'robots' => Neo_Pulse_Wp_Robots_Txt::get_content(),
) );
`;

const { url } = await uploadNeodigitalPhp(phpInner, "nd-apply-index-rules");
const res = await fetch(url, { cache: "no-store" });
const text = await res.text();
console.log("http", res.status);
writeFileSync(join(import.meta.dirname, "apply-index-rules.json"), text, "utf8");
console.log(text);

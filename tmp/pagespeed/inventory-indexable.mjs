import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { uploadNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const phpInner = `
$types = array();
foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $slug => $obj ) {
  $counts = wp_count_posts( $slug );
  $types[ $slug ] = array(
    'label' => $obj->label,
    'publish' => isset( $counts->publish ) ? (int) $counts->publish : 0,
  );
}
$tax = array();
foreach ( get_taxonomies( array( 'public' => true ), 'objects' ) as $slug => $obj ) {
  $terms = get_terms( array( 'taxonomy' => $slug, 'hide_empty' => true, 'fields' => 'ids' ) );
  $tax[ $slug ] = array(
    'label' => $obj->label,
    'terms' => is_array( $terms ) ? count( $terms ) : 0,
  );
}
$attachments = (int) ( wp_count_posts( 'attachment' )->inherit ?? 0 );
$robots = class_exists( 'Neo_Pulse_Wp_Robots_Txt' ) ? Neo_Pulse_Wp_Robots_Txt::get_content() : '';
$sm = class_exists( 'Neo_Pulse_Wp_Sitemap_Settings' ) ? Neo_Pulse_Wp_Sitemap_Settings::get_config() : array();
if ( ! function_exists( 'is_plugin_active' ) ) {
  require_once ABSPATH . 'wp-admin/includes/plugin.php';
}
$plugins = array();
foreach ( array( 'wordpress-seo/wp-seo.php', 'seo-by-rank-math/rank-math.php', 'elementor/elementor.php' ) as $p ) {
  $plugins[ $p ] = is_plugin_active( $p );
}
$noindex_pages = array();
foreach ( get_posts( array( 'post_type' => array( 'page', 'post' ), 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids' ) ) as $id ) {
  $rm = get_post_meta( (int) $id, 'rank_math_robots', true );
  $has = ( is_array( $rm ) && in_array( 'noindex', $rm, true ) ) || ( is_string( $rm ) && stripos( $rm, 'noindex' ) !== false );
  if ( $has ) {
    $noindex_pages[] = array( 'id' => (int) $id, 'url' => get_permalink( (int) $id ) );
  }
}
echo wp_json_encode( array(
  'types' => $types,
  'tax' => $tax,
  'attachments' => $attachments,
  'robots' => $robots,
  'sitemap_tax' => isset( $sm['taxonomies'] ) ? $sm['taxonomies'] : array(),
  'sitemap_types' => isset( $sm['post_types'] ) ? array_map( function( $row ) { return array( 'xml' => ! empty( $row['include_xml'] ) ); }, $sm['post_types'] ) : array(),
  'sitemap_images' => ! empty( $sm['general']['include_images'] ),
  'plugins' => $plugins,
  'already_noindex' => $noindex_pages,
) );
`;

const { url } = await uploadNeodigitalPhp(phpInner, "nd-inventory-index");
const res = await fetch(url, { cache: "no-store" });
const text = await res.text();
console.log("http", res.status);
writeFileSync(join(import.meta.dirname, "index-inventory.json"), text, "utf8");
console.log(text.slice(0, 6000));

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { uploadNeodigitalPhp } from "../../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const phpInner = `
$slugs = array( 'local-seo', 'edmonton-seo', 'google-ads', 'website-design', 'about', 'graphic-design' );
$out = array();
foreach ( $slugs as $slug ) {
  $page = get_page_by_path( $slug );
  if ( ! $page ) {
    $out[ $slug ] = array( 'error' => 'missing' );
    continue;
  }
  $id = (int) $page->ID;
  $data = get_post_meta( $id, '_elementor_data', true );
  $mode = get_post_meta( $id, '_elementor_edit_mode', true );
  $out[ $slug ] = array(
    'id' => $id,
    'status' => $page->post_status,
    'mode' => $mode,
    'data_bytes' => is_string( $data ) ? strlen( $data ) : 0,
    'content_bytes' => strlen( (string) $page->post_content ),
    'css_file' => file_exists( WP_CONTENT_DIR . '/uploads/elementor/css/post-' . $id . '.css' ),
  );
}
echo wp_json_encode( $out );
`;

const { url } = await uploadNeodigitalPhp(phpInner, "nd-inspect-el-pages");
const res = await fetch(url, { cache: "no-store" });
const text = await res.text();
console.log("http", res.status);
console.log(text.slice(0, 4000));
writeFileSync(join(import.meta.dirname, "elementor-pages.json"), text, "utf8");

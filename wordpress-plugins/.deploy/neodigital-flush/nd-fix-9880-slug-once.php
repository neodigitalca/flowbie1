<?php
if ( ( $_GET['key'] ?? '' ) !== '06651d212f9e7bd97df51f8a306f9495' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$post_id = 9880;
$post = get_post( $post_id );
if ( ! $post ) {
  echo wp_json_encode( array( 'error' => 'page 9880 missing' ) );
  @unlink( __FILE__ );
  exit;
}
$slug = sanitize_title( $post->post_title );
wp_update_post( array( 'ID' => $post_id, 'post_name' => $slug, 'post_status' => 'publish' ), true );
clean_post_cache( $post_id );
$fresh = get_post( $post_id );
echo wp_json_encode( array(
  'ok' => true,
  'post_id' => $post_id,
  'slug' => $fresh ? $fresh->post_name : $slug,
  'status' => $fresh ? $fresh->post_status : '',
  'view_url' => get_permalink( $post_id ),
) );
@unlink( __FILE__ );

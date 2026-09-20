<?php
if ( ( $_GET['key'] ?? '' ) !== '626a029d49a52ba0bc5b959db6d1dbf3' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$pages = get_posts( array(
  'post_type'      => 'page',
  'post_status'    => array( 'publish', 'draft', 'private' ),
  'posts_per_page' => 8,
  'orderby'        => 'date',
  'order'          => 'DESC',
) );
$out = array();
foreach ( $pages as $page ) {
  $out[] = array(
    'id'     => (int) $page->ID,
    'title'  => $page->post_title,
    'status' => $page->post_status,
    'slug'   => $page->post_name,
    'url'    => get_permalink( $page ),
    'date'   => $page->post_date,
  );
}
echo wp_json_encode( array( 'ok' => true, 'pages' => $out ) );
@unlink( __FILE__ );

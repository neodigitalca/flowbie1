<?php
if ( ( $_GET['key'] ?? '' ) !== '12ed693e0d4ee2951d99e3c3e5d4273f' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) {
  echo wp_json_encode( array( 'error' => 'no administrator' ) );
  @unlink( __FILE__ );
  exit;
}
wp_set_current_user( (int) $admins[0]->ID );
$post_id = wp_insert_post(
  array(
    'post_type'   => 'page',
    'post_title'  => 'aiseo edmonton',
    'post_name'   => 'aiseo-edmonton',
    'post_status' => 'publish',
    'post_author' => (int) $admins[0]->ID,
  ),
  true
);
if ( is_wp_error( $post_id ) ) {
  echo wp_json_encode( array( 'error' => $post_id->get_error_message() ) );
  @unlink( __FILE__ );
  exit;
}
update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
echo wp_json_encode( array(
  'ok'       => true,
  'post_id'  => (int) $post_id,
  'title'    => get_the_title( $post_id ),
  'status'   => get_post_status( $post_id ),
  'view_url' => get_permalink( $post_id ),
  'edit_url' => get_edit_post_link( $post_id, 'raw' ),
) );
@unlink( __FILE__ );

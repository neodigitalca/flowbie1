<?php
if ( ( $_GET['key'] ?? '' ) !== '58e2037dd65fc74638a7f375ac3f3068' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) {
  echo wp_json_encode( array( 'error' => 'no administrator' ) );
  @unlink( __FILE__ );
  exit;
}
wp_set_current_user( (int) $admins[0]->ID );
$names = array( 'edmonton-seo-analytics.png', 'edmonton-seo-chat.png', 'edmonton-seo-command.png', 'edmonton-seo-email.png', 'edmonton-seo-hero-skyline.png', 'edmonton-seo-maps.png', 'edmonton-seo-reviews.png', 'edmonton-seo-river.png', 'edmonton-seo-serp.png', 'edmonton-seo-strategist.png', 'edmonton-seo-tablet.png', 'edmonton-seo-workshop.png' );
$upload = wp_upload_dir();
$out = array();
foreach ( $names as $name ) {
  $path = trailingslashit( $upload['basedir'] ) . '2026/09/' . $name;
  if ( ! is_readable( $path ) ) {
    $out[] = array( 'name' => $name, 'error' => 'missing' );
    continue;
  }
  $filetype = wp_check_filetype( $name, null );
  $attachment_id = wp_insert_attachment(
    array(
      'post_mime_type' => $filetype['type'] ? $filetype['type'] : 'image/png',
      'post_title'     => preg_replace( '/\.[^.]+$/', '', $name ),
      'post_content'   => '',
      'post_status'    => 'inherit',
    ),
    $path,
    10203
  );
  if ( is_wp_error( $attachment_id ) ) {
    $out[] = array( 'name' => $name, 'error' => $attachment_id->get_error_message() );
    continue;
  }
  $meta = wp_generate_attachment_metadata( $attachment_id, $path );
  wp_update_attachment_metadata( $attachment_id, $meta );
  $out[] = array(
    'name' => $name,
    'id'   => (int) $attachment_id,
    'url'  => wp_get_attachment_url( $attachment_id ),
  );
}
echo wp_json_encode( array( 'ok' => true, 'attachments' => $out ) );
@unlink( __FILE__ );

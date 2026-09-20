<?php
if ( ( $_GET['key'] ?? '' ) !== 'e8d66797b8d9c62e0b6c00e891940fcd' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;

function nd_walk( $elements, $path, &$out ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    $id = isset( $el['id'] ) ? $el['id'] : '';
    $type = isset( $el['widgetType'] ) ? $el['widgetType'] : ( isset( $el['elType'] ) ? $el['elType'] : '' );
    $settings = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
    $title = '';
    foreach ( array( 'title', 'subtitle', 'editor', '_title' ) as $k ) {
      if ( empty( $settings[ $k ] ) ) continue;
      $raw = is_string( $settings[ $k ] ) ? wp_strip_all_tags( $settings[ $k ] ) : '';
      if ( $raw !== '' ) { $title = substr( $raw, 0, 80 ); break; }
    }
    $img = '';
    $img_id = 0;
    if ( isset( $settings['image']['url'] ) ) {
      $img = $settings['image']['url'];
      $img_id = isset( $settings['image']['id'] ) ? (int) $settings['image']['id'] : 0;
    }
    $out[] = array(
      'id' => $id,
      'type' => $type,
      'path' => $path,
      'title' => $title,
      'img' => $img,
      'img_id' => $img_id,
      'width' => isset( $settings['width'] ) ? $settings['width'] : null,
    );
    if ( ! empty( $el['elements'] ) ) {
      nd_walk( $el['elements'], $path . '/' . $id, $out );
    }
  }
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$out = array();
if ( is_array( $data ) ) nd_walk( $data, '', $out );

$q = new WP_Query( array(
  'post_type' => 'attachment',
  'post_status' => 'inherit',
  'posts_per_page' => 30,
  'post_parent' => 10203,
) );
$media = array();
foreach ( $q->posts as $p ) {
  $media[] = array(
    'id' => (int) $p->ID,
    'title' => $p->post_title,
    'url' => wp_get_attachment_url( $p->ID ),
  );
}

$logo_q = new WP_Query( array(
  'post_type' => 'attachment',
  'post_status' => 'inherit',
  'posts_per_page' => 10,
  's' => 'favicon',
) );
$logos = array();
foreach ( $logo_q->posts as $p ) {
  $logos[] = array( 'id' => (int) $p->ID, 'title' => $p->post_title, 'url' => wp_get_attachment_url( $p->ID ) );
}

echo wp_json_encode( array( 'ok' => true, 'widgets' => $out, 'media' => $media, 'logos' => $logos ) );
@unlink( __FILE__ );

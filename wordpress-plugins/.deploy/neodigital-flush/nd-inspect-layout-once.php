<?php
if ( ( $_GET['key'] ?? '' ) !== 'db5e1e246389b8df57484d1c91914fad' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;

function nd_find( $elements, $id ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    if ( isset( $el['id'] ) && $el['id'] === $id ) return $el;
    if ( ! empty( $el['elements'] ) ) {
      $hit = nd_find( $el['elements'], $id );
      if ( $hit ) return $hit;
    }
  }
  return null;
}

function nd_kids( $el ) {
  $out = array();
  foreach ( (array) ( $el['elements'] ?? array() ) as $child ) {
    $s = $child['settings'] ?? array();
    $out[] = array(
      'id' => $child['id'] ?? '',
      'type' => $child['widgetType'] ?? ( $child['elType'] ?? '' ),
      'width' => $s['width'] ?? null,
      'flex' => $s['flex_direction'] ?? null,
      'justify' => $s['justify_content'] ?? null,
      'align' => $s['align_items'] ?? $s['align'] ?? null,
      'bg' => $s['background_image']['url'] ?? ( $s['background_overlay_image']['url'] ?? '' ),
      'title' => $s['_title'] ?? ( $s['title'] ?? '' ),
      'img' => $s['image']['url'] ?? '',
      'child_count' => isset( $child['elements'] ) ? count( $child['elements'] ) : 0,
    );
  }
  return $out;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$ids = array( 'f51d2a0', 'c8ba8a3', 'd65ad74', 'e997763', 'b79ecfb', '2d20944', 'e0a0811', 'e21681d', '3164f23', 'eee0f60', 'c7dc3d1', '691604a', '47d5885', '8ac12e7', '72914d2' );
$out = array();
foreach ( $ids as $id ) {
  $el = nd_find( $data, $id );
  if ( ! $el ) { $out[ $id ] = null; continue; }
  $s = $el['settings'] ?? array();
  $out[ $id ] = array(
    'type' => $el['widgetType'] ?? ( $el['elType'] ?? '' ),
    'flex' => $s['flex_direction'] ?? null,
    'wrap' => $s['flex_wrap'] ?? null,
    'width' => $s['width'] ?? null,
    'bg' => $s['background_image']['url'] ?? '',
    'overlay' => $s['background_overlay_image']['url'] ?? '',
    'css' => $s['custom_css'] ?? '',
    'title' => $s['_title'] ?? ( $s['title'] ?? '' ),
    'kids' => nd_kids( $el ),
  );
}

echo wp_json_encode( array( 'ok' => true, 'nodes' => $out ) );
@unlink( __FILE__ );

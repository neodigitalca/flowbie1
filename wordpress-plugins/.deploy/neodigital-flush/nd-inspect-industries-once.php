<?php
if ( ( $_GET['key'] ?? '' ) !== 'fef4b684c03baadc79096eef6d6c2506' ) { http_response_code(403); exit('forbidden'); }
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
      'title' => $s['_title'] ?? ( $s['title'] ?? ( $s['subtitle'] ?? '' ) ),
      'img' => $s['image']['url'] ?? '',
      'child_count' => isset( $child['elements'] ) ? count( $child['elements'] ) : 0,
    );
  }
  return $out;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$ids = array( '0bf24ba', '19ed9c0', 'e475fb8', '0b760b7', '125d61b', '6386b7f' );
$out = array();
foreach ( $ids as $id ) {
  $el = nd_find( $data, $id );
  if ( ! $el ) { $out[ $id ] = null; continue; }
  $s = $el['settings'] ?? array();
  $out[ $id ] = array(
    'type' => $el['widgetType'] ?? ( $el['elType'] ?? '' ),
    'flex' => $s['flex_direction'] ?? null,
    'width' => $s['width'] ?? null,
    'title' => $s['_title'] ?? ( $s['title'] ?? '' ),
    'kids' => nd_kids( $el ),
  );
}

$used = array();
function nd_imgs( $elements, &$used ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    if ( ! empty( $el['settings']['image']['id'] ) ) {
      $used[] = (int) $el['settings']['image']['id'];
    }
    if ( ! empty( $el['elements'] ) ) nd_imgs( $el['elements'], $used );
  }
}
if ( is_array( $data ) ) nd_imgs( $data, $used );

$q = new WP_Query( array(
  'post_type' => 'attachment',
  'post_status' => 'inherit',
  'posts_per_page' => 20,
  's' => 'edmonton',
) );
$media = array();
foreach ( $q->posts as $p ) {
  $media[] = array(
    'id' => (int) $p->ID,
    'title' => $p->post_title,
    'url' => wp_get_attachment_url( $p->ID ),
    'used' => in_array( (int) $p->ID, $used, true ),
  );
}

echo wp_json_encode( array( 'ok' => true, 'nodes' => $out, 'used_ids' => array_values( array_unique( $used ) ), 'media' => $media ) );
@unlink( __FILE__ );

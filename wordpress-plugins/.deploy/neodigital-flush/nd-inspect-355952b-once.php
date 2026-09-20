<?php
if ( ( $_GET['key'] ?? '' ) !== '12cc34a1019cbbbba48257b2a612788f' ) { http_response_code(403); exit('forbidden'); }
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

function nd_tree( $elements, $depth = 0 ) {
  $out = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    $row = array(
      'id' => isset( $el['id'] ) ? $el['id'] : '',
      'type' => isset( $el['widgetType'] ) ? $el['widgetType'] : ( isset( $el['elType'] ) ? $el['elType'] : '' ),
      'depth' => $depth,
    );
    if ( isset( $el['settings']['content_width'] ) ) $row['content_width'] = $el['settings']['content_width'];
    if ( isset( $el['settings']['width'] ) ) $row['width'] = $el['settings']['width'];
    $out[] = $row;
    if ( ! empty( $el['elements'] ) && $depth < 4 ) {
      $out = array_merge( $out, nd_tree( $el['elements'], $depth + 1 ) );
    }
  }
  return $out;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$logo = nd_find( $data, '355952b' );
$hero = isset( $data[0] ) ? nd_tree( array( $data[0] ) ) : array();
echo wp_json_encode( array(
  'ok' => true,
  'logo_settings' => $logo ? $logo['settings'] : null,
  'hero' => $hero,
) );
@unlink( __FILE__ );

<?php
if ( ( $_GET['key'] ?? '' ) !== '2e97b20b7798ddc5408e23b19f673afd' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$raw = get_post_meta( 10203, '_elementor_data', true );
$hits = array();
function nd_find( $elements, $path ) {
  global $hits;
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    $id = isset( $el['id'] ) ? $el['id'] : '';
    $json = wp_json_encode( isset( $el['settings'] ) ? $el['settings'] : array() );
    if ( strpos( $json, '6585' ) !== false || strpos( $json, 'Light.svg' ) !== false || strpos( $json, 'Dark.svg' ) !== false || strpos( $json, 'favicon.png' ) !== false ) {
      $hits[] = array(
        'id' => $id,
        'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : '',
        'elType' => isset( $el['elType'] ) ? $el['elType'] : '',
        'path' => $path,
        'settings_keys' => array_keys( isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array() ),
      );
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_find( $el['elements'], $path . '/' . $id );
    }
  }
}
$data = json_decode( $raw, true );
if ( is_array( $data ) ) nd_find( $data, '' );
echo wp_json_encode( array( 'ok' => true, 'hits' => $hits ) );
@unlink( __FILE__ );

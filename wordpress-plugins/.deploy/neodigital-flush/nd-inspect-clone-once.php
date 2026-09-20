<?php
if ( ( $_GET['key'] ?? '' ) !== '47b994425fdfc0d27094e83a44963585' ) { http_response_code(403); exit('forbidden'); }
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
$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$el = nd_find( $data, '93db3db' );
echo wp_json_encode( array( 'ok' => true, 'clone' => $el ) );
@unlink( __FILE__ );

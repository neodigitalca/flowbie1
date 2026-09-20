<?php
if ( ( $_GET['key'] ?? '' ) !== '94e91a1c74ed4d0a78e705f83782edb8' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
require_once $wp_load;
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
wp_set_current_user( (int) $admins[0]->ID );

function &nd_find( &$elements, $id ) {
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['id'] ) && $el['id'] === $id ) {
      return $el;
    }
    if ( ! empty( $el['elements'] ) ) {
      $hit =& nd_find( $el['elements'], $id );
      if ( $hit !== null ) {
        return $hit;
      }
    }
  }
  unset( $el );
  $none = null;
  return $none;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$row =& nd_find( $data, '19ed9c0' );
$image =& nd_find( $data, '8f21b01' );
$text =& nd_find( $data, 'e475fb8' );
if ( ! $row || ! $image || ! $text ) {
  echo wp_json_encode( array( 'error' => 'industries row missing' ) );
  @unlink( __FILE__ );
  exit;
}

$row['settings']['flex_gap'] = array(
  'column' => '48',
  'row' => '32',
  'isLinked' => false,
  'unit' => 'px',
  'size' => 48,
);
$image['settings']['padding'] = array(
  'unit' => 'px',
  'top' => '0',
  'right' => '32',
  'bottom' => '0',
  'left' => '0',
  'isLinked' => false,
);
$text['settings']['padding'] = array(
  'unit' => 'px',
  'top' => '0',
  'right' => '0',
  'bottom' => '0',
  'left' => '32',
  'isLinked' => false,
);

$document = \Elementor\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\Elementor\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array( 'ok' => true ) );
@unlink( __FILE__ );

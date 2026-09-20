<?php
if ( ( $_GET['key'] ?? '' ) !== '7396f03b6759f3cb5fccd42dd8e0041d' ) { http_response_code(403); exit('forbidden'); }
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

function nd_extract( &$elements, $id, &$found ) {
  $kept = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    if ( isset( $el['id'] ) && $el['id'] === $id ) {
      $found = $el;
      continue;
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_extract( $el['elements'], $id, $found );
    }
    $kept[] = $el;
  }
  $elements = array_values( $kept );
}

function nd_insert( &$elements, $parent_id, $child ) {
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) continue;
    if ( isset( $el['id'] ) && $el['id'] === $parent_id ) {
      if ( ! isset( $el['elements'] ) || ! is_array( $el['elements'] ) ) {
        $el['elements'] = array();
      }
      array_unshift( $el['elements'], $child );
      return true;
    }
    if ( ! empty( $el['elements'] ) && nd_insert( $el['elements'], $parent_id, $child ) ) {
      return true;
    }
  }
  unset( $el );
  return false;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$logo = null;
nd_extract( $data, '355952b', $logo );
if ( ! $logo ) {
  echo wp_json_encode( array( 'error' => 'logo missing' ) );
  @unlink( __FILE__ );
  exit;
}

$logo['settings']['align'] = 'left';
$logo['settings']['width'] = array( 'unit' => 'px', 'size' => 180, 'sizes' => array() );
unset( $logo['settings']['_position'] );
unset( $logo['settings']['_offset_orientation_h'] );
unset( $logo['settings']['_offset_orientation_v'] );
unset( $logo['settings']['_offset_y_end'] );
$logo['settings']['image']['alt'] = 'Edmonton Agency';

$moved = nd_insert( $data, 'e8af43f', $logo );
$document = \Elementor\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\Elementor\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array( 'ok' => true, 'moved' => $moved ) );
@unlink( __FILE__ );

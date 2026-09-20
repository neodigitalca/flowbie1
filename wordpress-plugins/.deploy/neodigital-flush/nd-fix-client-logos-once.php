<?php
if ( ( $_GET['key'] ?? '' ) !== 'de9c023718eb087f52861c879536b6fd' ) { http_response_code(403); exit('forbidden'); }
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

$remove_ids = array( '1357a6d', 'f61ce01', 'b08a5dd', '14b8668', '30e4321' );

function nd_remove_ids( &$elements, $ids ) {
  $kept = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    if ( isset( $el['id'] ) && in_array( $el['id'], $ids, true ) ) continue;
    if ( ! empty( $el['elements'] ) ) nd_remove_ids( $el['elements'], $ids );
    $kept[] = $el;
  }
  $elements = array_values( $kept );
}

function nd_prune_empty( &$elements ) {
  $kept = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) continue;
    if ( ! empty( $el['elements'] ) ) nd_prune_empty( $el['elements'] );
    $type = isset( $el['elType'] ) ? $el['elType'] : '';
    if ( in_array( $type, array( 'container', 'section', 'column' ), true ) && empty( $el['elements'] ) ) continue;
    $kept[] = $el;
  }
  $elements = array_values( $kept );
}

function nd_strip_testimonial_logos( &$elements ) {
  $cleared = 0;
  foreach ( $elements as &$el ) {
    if ( ! is_array( $el ) ) continue;
    if ( isset( $el['id'] ) && $el['id'] === '007e2e5' && ! empty( $el['settings']['testimonials'] ) && is_array( $el['settings']['testimonials'] ) ) {
      foreach ( $el['settings']['testimonials'] as &$row ) {
        if ( isset( $row['image'] ) ) {
          $url = isset( $row['image']['url'] ) ? (string) $row['image']['url'] : '';
          if ( strpos( $url, 'favicon.png' ) !== false || strpos( $url, 'Light.svg' ) !== false || strpos( $url, 'Dark.svg' ) !== false ) {
            $row['image'] = array( 'url' => '', 'id' => '' );
            $cleared++;
          }
        }
      }
      unset( $row );
    }
    if ( ! empty( $el['elements'] ) ) {
      $cleared += nd_strip_testimonial_logos( $el['elements'] );
    }
  }
  unset( $el );
  return $cleared;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
nd_remove_ids( $data, $remove_ids );
nd_prune_empty( $data );
$cleared = nd_strip_testimonial_logos( $data );

$document = \Elementor\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\Elementor\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array( 'ok' => true, 'removed' => $remove_ids, 'testimonials_cleared' => $cleared ) );
@unlink( __FILE__ );

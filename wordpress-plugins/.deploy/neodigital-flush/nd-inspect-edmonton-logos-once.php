<?php
if ( ( $_GET['key'] ?? '' ) !== '991106e66b0455f31621d8e6fa29dc58' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;

function nd_walk( $elements, $parent, &$out ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    $id = isset( $el['id'] ) ? $el['id'] : '';
    $settings = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
    $widget = isset( $el['widgetType'] ) ? $el['widgetType'] : '';
    if ( $widget === 'image' || $widget === 'ygency_image' || isset( $settings['image'] ) ) {
      $image = isset( $settings['image'] ) && is_array( $settings['image'] ) ? $settings['image'] : array();
      $aid = isset( $image['id'] ) ? (int) $image['id'] : 0;
      $out[] = array(
        'id'       => $id,
        'parent'   => $parent,
        'widget'   => $widget,
        'elType'   => isset( $el['elType'] ) ? $el['elType'] : '',
        'image_id' => $aid,
        'image_url'=> isset( $image['url'] ) ? $image['url'] : '',
        'alt'      => isset( $settings['image']['alt'] ) ? $settings['image']['alt'] : ( isset( $settings['_title'] ) ? $settings['_title'] : '' ),
        'caption'  => isset( $settings['caption'] ) ? $settings['caption'] : '',
        'title'    => $aid ? get_the_title( $aid ) : '',
        'attach_alt'=> $aid ? (string) get_post_meta( $aid, '_wp_attachment_image_alt', true ) : '',
      );
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_walk( $el['elements'], $id, $out );
    }
  }
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$widgets = array();
if ( is_array( $data ) ) {
  nd_walk( $data, '', $widgets );
}

$q = new WP_Query( array(
  'post_type'      => 'attachment',
  'post_status'    => 'inherit',
  'posts_per_page' => 20,
  's'              => 'agency',
) );
$agency = array();
foreach ( $q->posts as $p ) {
  $agency[] = array(
    'id'    => (int) $p->ID,
    'title' => $p->post_title,
    'url'   => wp_get_attachment_url( $p->ID ),
    'alt'   => (string) get_post_meta( $p->ID, '_wp_attachment_image_alt', true ),
  );
}

echo wp_json_encode( array( 'ok' => true, 'widgets' => $widgets, 'agency_media' => $agency ) );
@unlink( __FILE__ );

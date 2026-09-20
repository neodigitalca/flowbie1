<?php
if ( ( $_GET['key'] ?? '' ) !== '4de686ca2f452762f99ba4eb94ff8f48' ) { http_response_code(403); exit('forbidden'); }
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

$attach_id = 9217;
$url = wp_get_attachment_url( $attach_id );
if ( ! $url ) {
  echo wp_json_encode( array( 'error' => 'missing edmonton image' ) );
  @unlink( __FILE__ );
  exit;
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$row =& nd_find( $data, '19ed9c0' );
$text =& nd_find( $data, 'e475fb8' );
if ( ! $row || ! $text ) {
  echo wp_json_encode( array( 'error' => 'industries containers missing' ) );
  @unlink( __FILE__ );
  exit;
}

$row['settings']['flex_direction'] = 'row';
$row['settings']['flex_wrap'] = 'wrap';
$text['settings']['_title'] = 'Right Column';
$text['settings']['width'] = array( 'unit' => '%', 'size' => 50, 'sizes' => array() );

$already = false;
foreach ( $row['elements'] as $kid ) {
  if ( isset( $kid['id'] ) && $kid['id'] === '8f21b01' ) {
    $already = true;
    break;
  }
}

if ( ! $already ) {
  $image_col = array(
    'id' => '8f21b01',
    'elType' => 'container',
    'isInner' => true,
    'settings' => array(
      'content_width' => 'full',
      '_title' => 'Edmonton image',
      'width' => array( 'unit' => '%', 'size' => 50, 'sizes' => array() ),
      'justify_content' => 'center',
      'align_items' => 'center',
    ),
    'elements' => array(
      array(
        'id' => '8f21b02',
        'elType' => 'widget',
        'widgetType' => 'image',
        'elements' => array(),
        'settings' => array(
          'image' => array(
            'url' => $url,
            'id' => $attach_id,
            'alt' => 'Edmonton skyline and river valley for local SEO coverage',
            'source' => 'library',
          ),
          'image_border_radius' => array(
            'unit' => 'px',
            'top' => '20',
            'right' => '20',
            'bottom' => '20',
            'left' => '20',
            'isLinked' => true,
          ),
        ),
      ),
    ),
  );
  array_unshift( $row['elements'], $image_col );
}

$document = \Elementor\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\Elementor\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array( 'ok' => true, 'image' => $url, 'already' => $already ) );
@unlink( __FILE__ );

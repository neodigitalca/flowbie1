<?php
if ( ( $_GET['key'] ?? '' ) !== '5a7e7f8335e177a3cb5a33a1b86d8a14' ) { http_response_code(403); exit('forbidden'); }
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

function nd_image_col( $col_id, $widget_id, $attach_id, $alt ) {
  $url = wp_get_attachment_url( $attach_id );
  return array(
    'id' => $col_id,
    'elType' => 'container',
    'isInner' => true,
    'settings' => array(
      'content_width' => 'full',
    ),
    'elements' => array(
      array(
        'id' => $widget_id,
        'elType' => 'widget',
        'widgetType' => 'image',
        'elements' => array(),
        'settings' => array(
          'image' => array(
            'url' => $url,
            'id' => $attach_id,
            'alt' => $alt,
            'source' => 'library',
          ),
          'hover_animation' => 'grow',
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
}

function nd_logo_col( $col_id, $widget_id, $attach_id, $alt ) {
  $url = wp_get_attachment_url( $attach_id );
  return array(
    'id' => $col_id,
    'elType' => 'container',
    'isInner' => true,
    'settings' => array(
      'content_width' => 'full',
      'width' => array( 'unit' => '%', 'size' => 40, 'sizes' => array() ),
      'justify_content' => 'center',
      'align_items' => 'center',
    ),
    'elements' => array(
      array(
        'id' => $widget_id,
        'elType' => 'widget',
        'widgetType' => 'image',
        'elements' => array(),
        'settings' => array(
          'image' => array(
            'url' => $url,
            'id' => $attach_id,
            'alt' => $alt,
            'source' => 'library',
          ),
          'width' => array( 'unit' => 'px', 'size' => 220, 'sizes' => array() ),
          'align' => 'center',
        ),
      ),
    ),
  );
}

$review_id = 9213;
$links_id = 7025;
$logo_a = 6583;
$logo_b = 5853;
foreach ( array( $review_id, $links_id, $logo_a, $logo_b ) as $aid ) {
  if ( ! wp_get_attachment_url( $aid ) ) {
    echo wp_json_encode( array( 'error' => 'missing attachment', 'id' => $aid ) );
    @unlink( __FILE__ );
    exit;
  }
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );

$review =& nd_find( $data, 'c8ba8a3' );
$internal =& nd_find( $data, 'd65ad74' );
$why =& nd_find( $data, 'eee0f60' );
$services =& nd_find( $data, '691604a' );
if ( ! $review || ! $internal || ! $why || ! $services ) {
  echo wp_json_encode( array( 'error' => 'container missing' ) );
  @unlink( __FILE__ );
  exit;
}

$has_review_img = false;
$has_internal_img = false;
foreach ( $review['elements'] as $kid ) {
  if ( isset( $kid['id'] ) && $kid['id'] === '7c91a11' ) $has_review_img = true;
}
foreach ( $internal['elements'] as $kid ) {
  if ( isset( $kid['id'] ) && $kid['id'] === '7c91a13' ) $has_internal_img = true;
}

if ( ! $has_review_img ) {
  array_unshift(
    $review['elements'],
    nd_image_col( '7c91a11', '7c91a12', $review_id, 'Edmonton owner checking new local reviews on a phone' )
  );
}
if ( ! $has_internal_img ) {
  $internal['elements'][] = nd_image_col( '7c91a13', '7c91a14', $links_id, 'Internal link map for Edmonton SEO pages on a laptop' );
}

$why_has = false;
$svc_has = false;
foreach ( $why['elements'] as $kid ) {
  if ( isset( $kid['id'] ) && $kid['id'] === '7c91a15' ) $why_has = true;
}
foreach ( $services['elements'] as $kid ) {
  if ( isset( $kid['id'] ) && $kid['id'] === '7c91a17' ) $svc_has = true;
}
if ( ! $why_has ) {
  $why['elements'][] = nd_logo_col( '7c91a15', '7c91a16', $logo_a, 'Edmonton Agency mark' );
}
if ( ! $svc_has ) {
  $services['elements'][] = nd_logo_col( '7c91a17', '7c91a18', $logo_b, 'Neo Digital mark' );
}

$document = \Elementor\Plugin::$instance->documents->get( 10203 );
$document->save( array( 'elements' => $data ) );
\Elementor\Plugin::$instance->files_manager->clear_cache();

echo wp_json_encode( array(
  'ok' => true,
  'review' => wp_get_attachment_url( $review_id ),
  'internal' => wp_get_attachment_url( $links_id ),
  'logo_why' => wp_get_attachment_url( $logo_a ),
  'logo_svc' => wp_get_attachment_url( $logo_b ),
) );
@unlink( __FILE__ );

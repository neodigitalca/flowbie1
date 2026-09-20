<?php
if ( ( $_GET['key'] ?? '' ) !== 'c48dda7d26f246c81972b9484ae653cf' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;

function nd_collect_images( $elements, &$out ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    $settings = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
    $hits = array();
    foreach ( $settings as $key => $value ) {
      if ( is_array( $value ) && ( isset( $value['url'] ) || isset( $value['id'] ) ) ) {
        $url = isset( $value['url'] ) ? (string) $value['url'] : '';
        $id  = isset( $value['id'] ) ? (int) $value['id'] : 0;
        if ( $url !== '' || $id > 0 ) {
          $hits[] = array( 'key' => $key, 'id' => $id, 'url' => $url );
        }
      }
    }
    if ( $hits ) {
      $out[] = array(
        'id'     => isset( $el['id'] ) ? $el['id'] : '',
        'elType' => isset( $el['elType'] ) ? $el['elType'] : '',
        'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : '',
        'hits'   => $hits,
      );
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_collect_images( $el['elements'], $out );
    }
  }
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$widgets = array();
if ( is_array( $data ) ) {
  nd_collect_images( $data, $widgets );
}

$counts = array();
foreach ( $widgets as $w ) {
  foreach ( $w['hits'] as $hit ) {
    $key = $hit['url'] !== '' ? $hit['url'] : ( 'id:' . $hit['id'] );
    if ( ! isset( $counts[ $key ] ) ) {
      $counts[ $key ] = 0;
    }
    $counts[ $key ]++;
  }
}

$menus = array();
foreach ( wp_get_nav_menus() as $menu ) {
  $items = wp_get_nav_menu_items( $menu->term_id );
  $row_items = array();
  foreach ( (array) $items as $item ) {
    $row_items[] = array(
      'id'     => (int) $item->ID,
      'parent' => (int) $item->menu_item_parent,
      'title'  => $item->title,
      'url'    => $item->url,
      'object' => $item->object,
      'object_id' => (int) $item->object_id,
    );
  }
  $menus[] = array(
    'id'    => (int) $menu->term_id,
    'name'  => $menu->name,
    'slug'  => $menu->slug,
    'count' => (int) $menu->count,
    'items' => $row_items,
  );
}

echo wp_json_encode( array(
  'ok'      => true,
  'post'    => array(
    'id'    => 10203,
    'title' => get_the_title( 10203 ),
    'url'   => get_permalink( 10203 ),
  ),
  'widgets' => $widgets,
  'counts'  => $counts,
  'menus'   => $menus,
) );
@unlink( __FILE__ );

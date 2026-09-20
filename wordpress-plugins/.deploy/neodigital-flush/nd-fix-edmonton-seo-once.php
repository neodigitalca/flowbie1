<?php
if ( ( $_GET['key'] ?? '' ) !== '72bf7a0955ec7c1e291ba9d870cfbea2' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( empty( $admins ) ) {
  echo wp_json_encode( array( 'error' => 'no administrator' ) );
  @unlink( __FILE__ );
  exit;
}
wp_set_current_user( (int) $admins[0]->ID );

$remove_ids = array(
  '1e0aea1',
  'a0f2e17',
  'ea685d3',
  '7b0802f',
  '54cf407',
  '376709b',
  '07ee289',
  'f793f0d',
  '253a465',
  'e077324',
);

function nd_remove_ids( &$elements, $ids ) {
  $kept = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['id'] ) && in_array( $el['id'], $ids, true ) ) {
      continue;
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_remove_ids( $el['elements'], $ids );
    }
    $kept[] = $el;
  }
  $elements = array_values( $kept );
}

function nd_prune_empty( &$elements ) {
  $kept = array();
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_prune_empty( $el['elements'] );
    }
    $type = isset( $el['elType'] ) ? $el['elType'] : '';
    $empty_box = in_array( $type, array( 'container', 'section', 'column' ), true ) && empty( $el['elements'] );
    if ( $empty_box ) {
      continue;
    }
    $kept[] = $el;
  }
  $elements = array_values( $kept );
}

function nd_collect_image_urls( $elements, &$urls ) {
  foreach ( (array) $elements as $el ) {
    if ( ! is_array( $el ) ) {
      continue;
    }
    if ( isset( $el['widgetType'] ) && $el['widgetType'] === 'image' ) {
      $url = '';
      if ( isset( $el['settings']['image']['url'] ) ) {
        $url = (string) $el['settings']['image']['url'];
      }
      if ( $url !== '' ) {
        if ( ! isset( $urls[ $url ] ) ) {
          $urls[ $url ] = 0;
        }
        $urls[ $url ]++;
      }
    }
    if ( ! empty( $el['elements'] ) ) {
      nd_collect_image_urls( $el['elements'], $urls );
    }
  }
}

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
if ( ! is_array( $data ) ) {
  echo wp_json_encode( array( 'error' => 'no elementor data' ) );
  @unlink( __FILE__ );
  exit;
}

nd_remove_ids( $data, $remove_ids );
nd_prune_empty( $data );

$saved = false;
if ( class_exists( '\Elementor\Plugin' ) ) {
  $document = \Elementor\Plugin::$instance->documents->get( 10203 );
  if ( $document ) {
    $document->save( array( 'elements' => $data ) );
    $saved = true;
  }
}
if ( ! $saved ) {
  update_post_meta( 10203, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
}
if ( class_exists( '\Elementor\Plugin' ) ) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

$menu_id = 44;
$parent_id = 146;
$already = false;
foreach ( (array) wp_get_nav_menu_items( $menu_id ) as $item ) {
  if ( (int) $item->object_id === 10203 && (int) $item->menu_item_parent === $parent_id ) {
    $already = true;
    $menu_item_id = (int) $item->ID;
    break;
  }
}
$menu_item_id = isset( $menu_item_id ) ? $menu_item_id : 0;
if ( ! $already ) {
  $menu_item_id = wp_update_nav_menu_item(
    $menu_id,
    0,
    array(
      'menu-item-title'     => 'Edmonton SEO',
      'menu-item-object'    => 'page',
      'menu-item-object-id' => 10203,
      'menu-item-type'      => 'post_type',
      'menu-item-status'    => 'publish',
      'menu-item-parent-id' => $parent_id,
    )
  );
}

$after_urls = array();
$after_raw = get_post_meta( 10203, '_elementor_data', true );
$after_data = json_decode( $after_raw, true );
if ( is_array( $after_data ) ) {
  nd_collect_image_urls( $after_data, $after_urls );
}

$services = array();
foreach ( (array) wp_get_nav_menu_items( $menu_id ) as $item ) {
  if ( (int) $item->menu_item_parent === $parent_id ) {
    $services[] = array(
      'id'    => (int) $item->ID,
      'title' => $item->title,
      'url'   => $item->url,
    );
  }
}

echo wp_json_encode( array(
  'ok'            => true,
  'saved'         => $saved,
  'removed'       => $remove_ids,
  'menu_item_id'  => is_wp_error( $menu_item_id ) ? $menu_item_id->get_error_message() : (int) $menu_item_id,
  'menu_already'  => $already,
  'image_counts'  => $after_urls,
  'services'      => $services,
) );
@unlink( __FILE__ );

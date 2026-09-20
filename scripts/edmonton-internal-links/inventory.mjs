/**
 * Dump published pages, Our Work items, and posts from neodigital.ca.
 * Writes test-output/edmonton-seo-inventory.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNeodigitalPhp } from "./sftp-oneshot.mjs";

const phpInner = `
function nd_hrefs( $html ) {
  $out = array();
  if ( ! is_string( $html ) || $html === '' ) {
    return $out;
  }
  $dom = new DOMDocument();
  libxml_use_internal_errors( true );
  $dom->loadHTML( '<?xml encoding="utf-8"><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
  libxml_clear_errors();
  foreach ( $dom->getElementsByTagName( 'a' ) as $a ) {
    $href = trim( $a->getAttribute( 'href' ) );
    if ( $href === '' || str_starts_with( $href, '#' ) || str_starts_with( $href, 'mailto:' ) || str_starts_with( $href, 'tel:' ) ) {
      continue;
    }
    $host = parse_url( $href, PHP_URL_HOST );
    $path = parse_url( $href, PHP_URL_PATH );
    if ( $host && stripos( $host, 'neodigital.ca' ) === false ) {
      continue;
    }
    $out[] = array(
      'href'   => $href,
      'path'   => $path ? $path : '/',
      'anchor' => trim( preg_replace( '/\\s+/', ' ', $a->textContent ) ),
    );
  }
  return $out;
}

function nd_walk_elementor( $nodes, &$hrefs, &$text ) {
  if ( ! is_array( $nodes ) ) {
    return;
  }
  foreach ( $nodes as $node ) {
    $settings = isset( $node['settings'] ) && is_array( $node['settings'] ) ? $node['settings'] : array();
    foreach ( $settings as $val ) {
      if ( is_string( $val ) ) {
        $plain = wp_strip_all_tags( $val );
        $text .= ' ' . $plain;
        if ( strlen( $plain ) >= 12 ) {
          $chunks[] = $plain;
        }
        foreach ( nd_hrefs( $val ) as $h ) {
          $hrefs[] = $h;
        }
      } elseif ( is_array( $val ) && isset( $val['url'] ) && is_string( $val['url'] ) && $val['url'] !== '' ) {
        $url  = $val['url'];
        $host = parse_url( $url, PHP_URL_HOST );
        $path = parse_url( $url, PHP_URL_PATH );
        if ( ! $host || stripos( $host, 'neodigital.ca' ) !== false ) {
          $hrefs[] = array( 'href' => $url, 'path' => $path ? $path : '/', 'anchor' => '' );
        }
      }
    }
    if ( ! empty( $node['elements'] ) ) {
      nd_walk_elementor( $node['elements'], $hrefs, $text );
    }
  }
}

function nd_row( $post ) {
  $hrefs  = array();
  $chunks = array();
  $text   = wp_strip_all_tags( $post->post_content );
  if ( $text !== '' ) {
    $chunks[] = $text;
  }
  foreach ( nd_hrefs( $post->post_content ) as $h ) {
    $hrefs[] = $h;
  }
  $raw = get_post_meta( $post->ID, '_elementor_data', true );
  if ( is_string( $raw ) && $raw !== '' ) {
    $data = json_decode( $raw, true );
    if ( is_array( $data ) ) {
      nd_walk_elementor( $data, $hrefs, $text );
    }
  }
  if ( function_exists( 'get_fields' ) ) {
    $fields = get_fields( $post->ID );
    if ( is_array( $fields ) ) {
      array_walk_recursive(
        $fields,
        function ( $val ) use ( &$hrefs, &$text, &$chunks ) {
          if ( ! is_string( $val ) ) {
            return;
          }
          $plain = wp_strip_all_tags( $val );
          $text .= ' ' . $plain;
          if ( strlen( $plain ) >= 12 ) {
            $chunks[] = $plain;
          }
          foreach ( nd_hrefs( $val ) as $h ) {
            $hrefs[] = $h;
          }
        }
      );
    }
  }
  $seen = array();
  $uniq = array();
  foreach ( $hrefs as $h ) {
    $key = strtolower( rtrim( $h['path'], '/' ) . '|' . $h['anchor'] );
    if ( isset( $seen[ $key ] ) ) {
      continue;
    }
    $seen[ $key ] = true;
    $uniq[]       = $h;
  }
  $path = wp_parse_url( get_permalink( $post ), PHP_URL_PATH );
  return array(
    'id'        => (int) $post->ID,
    'type'      => $post->post_type,
    'slug'      => $post->post_name,
    'title'     => $post->post_title,
    'excerpt'   => wp_strip_all_tags( $post->post_excerpt ),
    'permalink' => get_permalink( $post ),
    'path'      => $path ? $path : '/',
    'hrefs'     => $uniq,
    'text'      => trim( preg_replace( '/\\s+/', ' ', $text ) ),
    'chunks'    => array_values( array_unique( $chunks ) ),
  );
}

$types = array( 'page', 'post' );
foreach ( get_post_types( array( 'public' => true ), 'names' ) as $name ) {
  if ( $name === 'page' || $name === 'post' || $name === 'attachment' ) {
    continue;
  }
  if ( str_contains( $name, 'work' ) || str_contains( $name, 'portfolio' ) || str_contains( $name, 'project' ) ) {
    $types[] = $name;
  }
}
$types = array_values( array_unique( $types ) );
$rows  = array();
foreach ( $types as $type ) {
  $posts = get_posts(
    array(
      'post_type'      => $type,
      'post_status'    => 'publish',
      'posts_per_page' => -1,
      'orderby'        => 'date',
      'order'          => 'DESC',
    )
  );
  foreach ( $posts as $post ) {
    $rows[] = nd_row( $post );
  }
}
echo wp_json_encode(
  array(
    'ok'         => true,
    'types'      => $types,
    'count'      => count( $rows ),
    'items'      => $rows,
  )
);
`;

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "test-output");
mkdirSync(outDir, { recursive: true });
const data = await runNeodigitalPhp(phpInner, "nd-edmonton-inventory-once");
const dest = join(outDir, "edmonton-seo-inventory.json");
writeFileSync(dest, JSON.stringify(data, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, types: data.types, count: data.count, dest }, null, 2));

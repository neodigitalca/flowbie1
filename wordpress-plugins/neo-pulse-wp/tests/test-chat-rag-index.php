<?php
/**
 * Chat RAG index filtering and link allowlist tests.
 *
 * Run: php tests/test-chat-rag-index.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'post_type_exists' ) ) {
	function post_type_exists( $post_type ) {
		return in_array( $post_type, array( 'post', 'page', 'service-area' ), true );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

if ( ! function_exists( 'wp_trim_words' ) ) {
	function wp_trim_words( $text, $num_words = 55, $more = null ) {
		$words = preg_split( '/\s+/', trim( wp_strip_all_tags( (string) $text ) ) );
		if ( count( $words ) <= $num_words ) {
			return implode( ' ', $words );
		}
		return implode( ' ', array_slice( $words, 0, $num_words ) ) . (string) $more;
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $string ) {
		return strip_tags( (string) $string );
	}
}

if ( ! function_exists( 'get_bloginfo' ) ) {
	function get_bloginfo( $show = '' ) {
		return $show === 'name' ? 'Example Site' : '';
	}
}

function chat_rag_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-rag.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-chat-links.php';

$settings_post_page = array(
	'indexed_post_types'  => array( 'post', 'page' ),
	'excluded_categories' => array(),
);

$sample_index = array(
	array(
		'id'           => 1,
		'title'        => 'Contact',
		'url'          => 'https://example.com/contact/',
		'type'         => 'page',
		'category_ids' => array(),
	),
	array(
		'id'           => 2,
		'title'        => 'Edmonton',
		'url'          => 'https://example.com/service-area/edmonton/',
		'type'         => 'service-area',
		'category_ids' => array(),
	),
	array(
		'id'           => 3,
		'title'        => 'News',
		'url'          => 'https://example.com/news/',
		'type'         => 'post',
		'category_ids' => array( 5 ),
	),
);

$filtered = Neo_Pulse_Wp_Chat_Rag::filter_index( $sample_index, $settings_post_page );
chat_rag_assert( count( $filtered ) === 2, 'service-area dropped when not in indexed_post_types' );
chat_rag_assert(
	! in_array( 'service-area', array_column( $filtered, 'type' ), true ),
	'filtered index contains no service-area type'
);

$types = array_column( $filtered, 'type' );
chat_rag_assert( in_array( 'page', $types, true ) && in_array( 'post', $types, true ), 'post and page kept when checked' );

$settings_exclude_cat = array(
	'indexed_post_types'  => array( 'post', 'page', 'service-area' ),
	'excluded_categories' => array( 5 ),
);

$filtered_cats = Neo_Pulse_Wp_Chat_Rag::filter_index( $sample_index, $settings_exclude_cat );
chat_rag_assert( count( $filtered_cats ) === 2, 'category exclusion removes matching items' );
chat_rag_assert(
	! in_array( 3, array_column( $filtered_cats, 'id' ), true ),
	'excluded category post id 3 removed'
);

$allowed_links = array(
	array( 'label' => 'Contact', 'url' => 'https://example.com/contact/' ),
);
$blocked_links = array(
	array( 'label' => 'Edmonton', 'url' => 'https://example.com/service-area/edmonton/' ),
);
$mixed_links = array_merge( $allowed_links, $blocked_links );

$link_filtered = Neo_Pulse_Wp_Chat_Links::filter_links_to_index( $mixed_links, $filtered );
chat_rag_assert( count( $link_filtered ) === 1, 'filter_links_to_index drops off-index URLs' );
chat_rag_assert(
	$link_filtered[0]['url'] === 'https://example.com/contact/',
	'filter_links_to_index keeps in-index URL'
);

$extra_post = array(
	array(
		'id'    => 99,
		'title' => 'Hidden Blog Post',
		'url'   => 'https://example.com/hidden-blog-post/',
		'type'  => 'post',
	),
);
$blog_links = array(
	array( 'label' => 'Hidden Blog Post', 'url' => 'https://example.com/hidden-blog-post/' ),
);
$blog_link_filtered = Neo_Pulse_Wp_Chat_Links::filter_links_to_index( $blog_links, $filtered, $extra_post );
chat_rag_assert( count( $blog_link_filtered ) === 1, 'filter_links_to_index allows extra retrieved items' );

$raw_for_blog = array(
	array(
		'id'           => 10,
		'title'        => 'Starter Guide',
		'url'          => 'https://example.com/starter-guide/',
		'type'         => 'post',
		'category_ids' => array( 5 ),
		'excerpt'      => 'Intro tips',
	),
	array(
		'id'           => 11,
		'title'        => 'Another Post',
		'url'          => 'https://example.com/another-post/',
		'type'         => 'post',
		'category_ids' => array( 5 ),
		'excerpt'      => 'More tips',
	),
);

if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $key ) {
		global $chat_rag_test_transient;
		return $chat_rag_test_transient[ $key ] ?? false;
	}
	function set_transient( $key, $value, $ttl ) {
		global $chat_rag_test_transient;
		$chat_rag_test_transient[ $key ] = $value;
		return true;
	}
}

$chat_rag_test_transient = array();
set_transient( 'neo_pulse_chat_context_cache_v4', $raw_for_blog, 3600 );

$blog_posts = Neo_Pulse_Wp_Chat_Rag::collect_sitemap_blog_posts(
	'what blogs should i start with',
	array(
		'indexed_post_types'  => array( 'post', 'page' ),
		'excluded_categories' => array( 5 ),
	),
	5
);
chat_rag_assert( count( $blog_posts ) === 2, 'blog discovery reads posts from sitemap even when category excluded' );
chat_rag_assert(
	$blog_posts[0]['url'] === 'https://example.com/starter-guide/' || $blog_posts[1]['url'] === 'https://example.com/starter-guide/',
	'collect_sitemap_blog_posts returns real post URLs'
);

$blog_card = Neo_Pulse_Wp_Chat_Rag::build_blog_discovery_card(
	'what blogs should i start with',
	$blog_posts,
	array(
		'indexed_post_types'  => array( 'post', 'page' ),
		'excluded_categories' => array( 5 ),
	)
);
chat_rag_assert( is_array( $blog_card ) && ! empty( $blog_card['links'] ), 'build_blog_discovery_card includes link rows' );
chat_rag_assert(
	str_contains( (string) $blog_card['body'], 'Starter Guide' ),
	'blog card body uses real post titles'
);

echo "All chat RAG index tests passed.\n";

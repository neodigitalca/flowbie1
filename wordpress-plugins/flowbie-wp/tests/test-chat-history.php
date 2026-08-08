<?php
/**
 * Structured chat history tests.
 *
 * Run: php tests/test-chat-history.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return trim( strip_tags( (string) $str ) );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $url ) {
		$url = trim( (string) $url );
		return filter_var( $url, FILTER_VALIDATE_URL ) ? $url : '';
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $str ) {
		return strip_tags( (string) $str );
	}
}

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://example.com' . $path;
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

function chat_history_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-history.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-rag.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-links.php';

$raw_history = array(
	array(
		'role'    => 'user',
		'content' => 'Tell me about root canals',
	),
	array(
		'role'    => 'assistant',
		'content' => 'Root canals treat infected pulp.',
		'card'    => array(
			'title'         => 'Root Canals',
			'cta'           => array(
				'label' => 'Root Canals',
				'url'   => 'https://example.com/root-canals/',
			),
			'links'         => array(
				array(
					'label' => 'Root Canals',
					'url'   => 'https://example.com/root-canals/',
				),
				array(
					'label' => 'Dental Pain',
					'url'   => 'https://example.com/dental-pain/',
				),
			),
			'relatedTopics' => array( 'Root canal cost', 'Recovery time' ),
		),
	),
);

$normalized = Flowbie_Wp_Chat_History::normalize( $raw_history );
chat_history_assert( count( $normalized ) === 2, 'normalize keeps two turns' );
chat_history_assert(
	isset( $normalized[1]['card']['cta']['url'] ) && $normalized[1]['card']['cta']['url'] === 'https://example.com/root-canals/',
	'normalize preserves card CTA url'
);
chat_history_assert(
	count( $normalized[1]['card']['links'] ) === 2,
	'normalize preserves card links'
);

$seen_urls = Flowbie_Wp_Chat_History::collect_seen_urls( $normalized );
chat_history_assert( in_array( 'https://example.com/root-canals', $seen_urls, true ), 'collect_seen_urls includes CTA url' );
chat_history_assert( in_array( 'https://example.com/dental-pain', $seen_urls, true ), 'collect_seen_urls includes link url' );

$seen_topics = Flowbie_Wp_Chat_History::collect_seen_topics( $normalized );
chat_history_assert( in_array( 'Root canal cost', $seen_topics, true ), 'collect_seen_topics includes prior chips' );

$prompt = Flowbie_Wp_Chat_History::format_for_prompt( $normalized );
chat_history_assert( strpos( $prompt, 'shown_cta:' ) !== false, 'format_for_prompt includes shown_cta metadata' );
chat_history_assert( strpos( $prompt, 'chips:' ) !== false, 'format_for_prompt includes chips metadata' );

$filtered_topics = Flowbie_Wp_Chat_History::filter_topics(
	array( 'Root canal cost', 'Insurance coverage' ),
	array( 'Root canal cost', 'Recovery time' )
);
chat_history_assert(
	count( $filtered_topics ) === 1 && $filtered_topics[0] === 'Insurance coverage',
	'filter_topics removes prior chips'
);

$topic_index = array(
	array(
		'title' => 'Root Canals',
		'url'   => 'https://example.com/root-canals/',
		'slug'  => 'root-canals',
		'type'  => 'page',
	),
	array(
		'title' => 'Root Canal Cost',
		'url'   => 'https://example.com/root-canal-cost/',
		'slug'  => 'root-canal-cost',
		'type'  => 'page',
	),
);

$primary = Flowbie_Wp_Chat_Links::pick_primary_topic_link(
	'root canal',
	array(),
	$topic_index,
	array(),
	array( 'https://example.com/root-canals/' )
);
chat_history_assert(
	is_array( $primary ) && $primary['url'] === 'https://example.com/root-canal-cost/',
	'pick_primary_topic_link skips excluded URL and picks next candidate'
);

$all_excluded = Flowbie_Wp_Chat_Links::pick_primary_topic_link(
	'root canal',
	array(),
	$topic_index,
	array(),
	array( 'https://example.com/root-canals/', 'https://example.com/root-canal-cost/' )
);
chat_history_assert( null === $all_excluded, 'pick_primary_topic_link returns null when all candidates excluded' );

echo "All chat history tests passed.\n";

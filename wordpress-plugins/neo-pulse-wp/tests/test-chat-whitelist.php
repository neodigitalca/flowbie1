<?php
/**
 * Chat whitelist URL matching.
 *
 * Run: php tests/test-chat-whitelist.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'wp_unslash' ) ) {
	function wp_unslash( $value ) {
		return is_string( $value ) ? stripslashes( $value ) : $value;
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-chat.php';

function whitelist_assert( bool $ok, string $message ): void {
	if ( ! $ok ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

$allowed = 'https://kwbllp.com/chat-bot-test-page/';

whitelist_assert(
	Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, '/chat-bot-test-page/' ),
	'test page request path matches https whitelist'
);
whitelist_assert(
	Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, '/chat-bot-test-page' ),
	'trailing slash is ignored'
);
whitelist_assert(
	Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, 'https://kwbllp.com/chat-bot-test-page/' ),
	'permalink matches whitelist'
);
whitelist_assert(
	Neo_Pulse_Wp_Chat::url_path_matches_whitelist( 'kwbllp.com/chat-bot-test-page/', '/chat-bot-test-page/' ),
	'whitelist without scheme still matches'
);
whitelist_assert(
	Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, '/chat-bot-test-page/?preview=true' ),
	'query string does not block a match'
);
whitelist_assert(
	! Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, '/' ),
	'home page is not the test page'
);
whitelist_assert(
	! Neo_Pulse_Wp_Chat::url_path_matches_whitelist( $allowed, '/about/' ),
	'other pages stay hidden when whitelist is set'
);

echo "All chat whitelist tests passed.\n";

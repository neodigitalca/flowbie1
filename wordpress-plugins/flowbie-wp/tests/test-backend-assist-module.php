<?php
/**
 * Backend Assist module contract tests (no OpenRouter).
 *
 * Run: php tests/test-backend-assist-module.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$flowbie_ba_test_user_id = 42;

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $str ) {
		return trim( (string) $str );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id() {
		global $flowbie_ba_test_user_id;
		return (int) $flowbie_ba_test_user_id;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0 ) {
		unset( $options );
		return json_encode( $data );
	}
}

$ba_dir = FLOWBIE_WP_PLUGIN_DIR . 'includes/backend-assist/';
require_once $ba_dir . 'class-flowbie-wp-backend-assist-context.php';
require_once $ba_dir . 'class-flowbie-wp-backend-assist-ai.php';
require_once $ba_dir . 'class-flowbie-wp-backend-assist-cards.php';
require_once $ba_dir . 'class-flowbie-wp-backend-assist-registry.php';
require_once $ba_dir . 'class-flowbie-wp-backend-assist-workflow.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-backend-assist.php';

$failures = 0;

function ba_assert( bool $cond, string $label ): void {
	global $failures;
	if ( ! $cond ) {
		echo "FAIL: {$label}\n";
		++$failures;
		return;
	}
	echo "OK: {$label}\n";
}

// parse_json_response strips fences.
$parsed = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( "```json\n{\"intent\":\"action\"}\n```" );
ba_assert( is_array( $parsed ) && ( $parsed['intent'] ?? '' ) === 'action', 'parse_json_response strips markdown fences' );

$bad = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( 'not json' );
ba_assert( null === $bad, 'parse_json_response returns null for invalid JSON' );

// normalize_history caps and sanitizes.
$history = Flowbie_Wp_Backend_Assist_Cards::normalize_history(
	array(
		array( 'role' => 'user', 'content' => '  hello  ' ),
		array( 'role' => 'assistant', 'content' => 'world' ),
	)
);
ba_assert( count( $history ) === 2 && $history[0]['content'] === 'hello', 'normalize_history sanitizes content' );

$many = array_fill( 0, 15, array( 'role' => 'user', 'content' => 'x' ) );
$trimmed = Flowbie_Wp_Backend_Assist_Cards::normalize_history( $many );
ba_assert( count( $trimmed ) === 10, 'normalize_history keeps last 10 entries' );

// workflow transient key is user-scoped.
$key = Flowbie_Wp_Backend_Assist_Workflow::workflow_transient_key( 'wf_abc123' );
ba_assert( str_contains( $key, 'flowbie_ba_wf_42_' ) && str_contains( $key, 'wf_abc123' ), 'workflow_transient_key includes user id' );

// Tool registry + executable checks.
Flowbie_Wp_Backend_Assist_Registry::register_tool(
	'test_tool',
	static function ( array $params ): array {
		unset( $params );
		return array( 'success' => true );
	},
	'A test tool'
);
ba_assert(
	str_contains( Flowbie_Wp_Backend_Assist_Registry::get_tool_descriptions(), 'test_tool' ),
	'get_tool_descriptions lists registered tools'
);
ba_assert(
	Flowbie_Wp_Backend_Assist_Workflow::is_registered_executable_tool( 'test_tool' ),
	'is_registered_executable_tool true for registry tool'
);
ba_assert(
	! Flowbie_Wp_Backend_Assist_Workflow::is_registered_executable_tool( 'missing_tool' ),
	'is_registered_executable_tool false for unknown tool'
);
ba_assert(
	Flowbie_Wp_Backend_Assist_Workflow::is_step_executable( array( 'tool' => 'test_tool' ) ),
	'is_step_executable true for registered tool step'
);
ba_assert(
	! Flowbie_Wp_Backend_Assist_Workflow::is_step_executable( array( 'tool' => 'micro_section', 'status' => 'pending' ) ),
	'is_step_executable false for micro_section pseudo tool'
);

// Facade delegates registry.
Flowbie_Wp_Backend_Assist::register_tool(
	'facade_tool',
	static function ( array $params ): array {
		unset( $params );
		return array( 'success' => true );
	},
	'Via facade'
);
ba_assert(
	str_contains( Flowbie_Wp_Backend_Assist::get_tool_descriptions(), 'facade_tool' ),
	'facade register_tool and get_tool_descriptions'
);

// error_card shape.
$card = Flowbie_Wp_Backend_Assist_Cards::error_card( 'Test error' );
ba_assert( ( $card['type'] ?? '' ) === 'error' && ( $card['body'] ?? '' ) === 'Test error', 'error_card structure' );

echo $failures === 0 ? "\nAll Backend Assist module tests passed.\n" : "\n{$failures} test(s) failed.\n";
exit( $failures === 0 ? 0 : 1 );

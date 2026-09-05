<?php
/**
 * Chat RAG/agent prompts must not hardcode a product vertical.
 *
 * Run: php tests/test-chat-rag-no-hardcode.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

$plugin_dir = dirname( __DIR__ );
$scan_files = array(
	$plugin_dir . '/includes/class-neo-pulse-wp-chat-rag.php',
	$plugin_dir . '/includes/class-neo-pulse-wp-chat-agents.php',
	$plugin_dir . '/includes/class-neo-pulse-wp-chat-starters.php',
	$plugin_dir . '/includes/class-neo-pulse-wp-chat-suggestion-templates.php',
	$plugin_dir . '/includes/class-neo-pulse-wp-chat-logs-gap-csv.php',
);

$forbidden = array(
	'hunter douglas',
	'alta window',
	'powerview',
	'window covering',
	'duette',
	'lightlock',
	'motorization',
);

$failed = false;
foreach ( $scan_files as $path ) {
	if ( ! is_readable( $path ) ) {
		fwrite( STDERR, "FAIL: missing " . basename( $path ) . "\n" );
		$failed = true;
		continue;
	}
	$haystack = strtolower( (string) file_get_contents( $path ) );
	foreach ( $forbidden as $needle ) {
		if ( str_contains( $haystack, $needle ) ) {
			fwrite( STDERR, 'FAIL: ' . basename( $path ) . " contains hardcoded \"{$needle}\"\n" );
			$failed = true;
		}
	}
}

if ( $failed ) {
	exit( 1 );
}

echo "PASS: chat RAG/agent sources have no hardcoded product vertical\n";

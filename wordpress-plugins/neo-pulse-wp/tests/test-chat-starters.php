<?php
/**
 * History-based empty-state chat starter contract.
 *
 * Run: php tests/test-chat-starters.php
 *
 * @package Neo_Pulse_Wp
 */

$plugin_dir = dirname( __DIR__ );
$starters   = (string) file_get_contents( $plugin_dir . '/includes/class-neo-pulse-wp-chat-starters.php' );
$chat       = (string) file_get_contents( $plugin_dir . '/includes/class-neo-pulse-wp-chat.php' );

function starters_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

starters_assert(
	str_contains( $starters, "CACHE_KEY       = 'neo_pulse_chat_starters_v2'" )
		|| str_contains( $starters, "CACHE_KEY = 'neo_pulse_chat_starters_v2'" ),
	'cache key is v2'
);
starters_assert( str_contains( $starters, 'DAY_IN_SECONDS' ), 'cache TTL is one day' );
starters_assert( str_contains( $starters, 'neo_pulse_wp_refresh_chat_starters' ), 'daily cron hook is registered' );
starters_assert( str_contains( $starters, 'RECENCY_DAYS    = 45' ) || str_contains( $starters, 'RECENCY_DAYS = 45' ), 'recency window is 45 days' );
starters_assert( str_contains( $starters, 'build_recency_block' ), 'recency block is built for the prompt' );
starters_assert( str_contains( $starters, "'source'    => 'frontend'" ) || str_contains( $starters, "'source' => 'frontend'" ), 'recency uses frontend visitor messages' );

starters_assert( str_contains( $starters, '{"starters": ["question 1", "question 2", "question 3"]}' ), 'system prompt requires 3 JSON starters' );
starters_assert( str_contains( $starters, 'Ground every question in the SITE INVENTORY or KNOWLEDGE BASE' ), 'system prompt requires inventory/KB grounding' );
starters_assert( str_contains( $starters, 'If RECENT VISITOR QUESTIONS is present' ), 'system prompt prefers recency themes' );
starters_assert( str_contains( $starters, 'Ignore summarize-the-page prompts' ), 'system prompt ignores summarize-only asks' );
starters_assert( str_contains( $starters, 'RECENT VISITOR QUESTIONS (last 45 days)' ), 'user prompt includes recency block label' );
starters_assert( str_contains( $starters, 'Prefer recent visitor themes that inventory or knowledge base can answer' ), 'user prompt ends with recency constraints' );

starters_assert( str_contains( $chat, 'Neo_Pulse_Wp_Chat_Starters::maybe_schedule' ), 'chat init schedules starter refresh' );

$idx = strpos( $chat, 'Summarize this page' );
starters_assert( $idx !== false, 'Summarize this page remains a separate chip' );
$snippet = substr( $chat, max( 0, $idx - 180 ), 420 );
starters_assert( str_contains( $snippet, 'array_unshift' ), 'Summarize this page is prepended' );
starters_assert( ! str_contains( $snippet, 'array_slice' ), 'Summarize this page does not slice away history chips' );

echo "All chat starter tests passed.\n";

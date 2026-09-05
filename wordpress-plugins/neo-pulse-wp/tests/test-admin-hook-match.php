<?php
/**
 * Admin screen hooks match WordPress 7 hyphenated plugin page names.
 *
 * Run: php tests/test-admin-hook-match.php
 *
 * @package Neo_Pulse_Wp
 */

$plugin_dir = dirname( __DIR__ );
$failed     = false;

function hook_match_assert( bool $ok, string $message ): void {
	global $failed;
	if ( ! $ok ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		$failed = true;
		return;
	}
	echo "PASS: {$message}\n";
}

/**
 * @param array<int, string> $ids
 */
function neo_pulse_test_admin_hook_matches( string $hook_suffix, array $ids ): bool {
	if ( $hook_suffix === '' ) {
		return false;
	}
	$want = str_replace( '-', '_', strtolower( $hook_suffix ) );
	foreach ( $ids as $id ) {
		if ( str_replace( '-', '_', strtolower( (string) $id ) ) === $want ) {
			return true;
		}
	}
	return false;
}

$shell = (string) file_get_contents( $plugin_dir . '/includes/admin/trait-admin-wp-shell.php' );
$el    = (string) file_get_contents( $plugin_dir . '/includes/search/integrations/class-neo-pulse-wp-search-elementor.php' );
$store = (string) file_get_contents( $plugin_dir . '/includes/fields/class-neo-pulse-wp-fields-storage.php' );

hook_match_assert(
	str_contains( $shell, 'function admin_hook_matches' )
		&& str_contains( $shell, "str_replace( '-', '_'" ),
	'shell compares admin hooks with hyphen/underscore normalized'
);

hook_match_assert(
	neo_pulse_test_admin_hook_matches(
		'neo-pulse-wp_page_neo-pulse-wp-chat',
		array( 'neo-pulse-wp_page_neo_pulse-wp-chat' )
	),
	'WP 7 Chat hook matches the stored screen id'
);

hook_match_assert(
	neo_pulse_test_admin_hook_matches(
		'toplevel_page_neo-pulse-wp',
		array( 'toplevel_page_neo_pulse-wp' )
	),
	'WP 7 dashboard hook matches the stored screen id'
);

hook_match_assert(
	! neo_pulse_test_admin_hook_matches(
		'edit.php',
		array( 'neo-pulse-wp_page_neo_pulse-wp-chat' )
	),
	'unrelated admin hooks do not match'
);

hook_match_assert(
	str_contains( $el, "add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_preview_script' )" )
		&& str_contains( $el, "add_action( 'admin_enqueue_scripts', array( __CLASS__, 'register_preview_script' )" )
		&& ! str_contains( $el, "self::register_preview_script();\n\t\tself::\$booted" ),
	'Elementor preview script registers on enqueue hooks only'
);

hook_match_assert(
	str_contains( $store, "const CPT_GROUP     = 'np-field-group'" )
		&& str_contains( $store, "const CPT_OPTIONS   = 'np-options-page'" )
		&& strlen( 'np-field-group' ) <= 20
		&& strlen( 'np-options-page' ) <= 20,
	'storage CPT slugs are 20 characters or fewer'
);

if ( $failed ) {
	exit( 1 );
}

echo "PASS: admin hook match contract\n";

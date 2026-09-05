<?php
/**
 * God Mode can be turned off in Chat General and is gated server-side.
 *
 * Run: php tests/test-god-mode-setting.php
 *
 * @package Neo_Pulse_Wp
 */

$plugin_dir = dirname( __DIR__ );
$failed     = false;

function god_mode_assert( bool $ok, string $message ): void {
	global $failed;
	if ( ! $ok ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		$failed = true;
		return;
	}
	echo "PASS: {$message}\n";
}

$chat = (string) file_get_contents( $plugin_dir . '/includes/class-neo-pulse-wp-chat.php' );
$admin_render = (string) file_get_contents( $plugin_dir . '/includes/admin/trait-admin-render-chat.php' );
$admin_save   = (string) file_get_contents( $plugin_dir . '/includes/admin/trait-admin-handlers-settings.php' );
$super        = (string) file_get_contents( $plugin_dir . '/includes/class-neo-pulse-wp-chat-super-admin.php' );

god_mode_assert(
	str_contains( $chat, "'god_mode_enabled'" ) && str_contains( $chat, 'current_user_can_backend_mode' ),
	'chat settings default and helper include god_mode_enabled'
);

god_mode_assert(
	(bool) preg_match( "/'god_mode_enabled'\\s*=>\\s*true/", $chat ),
	'God Mode stays on by default for existing sites'
);

god_mode_assert(
	str_contains( $chat, 'canBackendMode' ) && str_contains( $chat, 'current_user_can_backend_mode()' ),
	'widget config uses the God Mode helper, not logged-in alone'
);

god_mode_assert(
	! str_contains( $chat, 'canBackendMode=true' ),
	'inline script does not force God Mode on'
);

god_mode_assert(
	str_contains( $admin_render, 'neo_pulse_chat_admin_only' )
		&& str_contains( $admin_save, "'admin_only'" ),
	'Chat General can restrict the widget to administrators'
);

god_mode_assert(
	str_contains( $chat, "'admin_only'" ) && str_contains( $chat, 'should_show_for_visitor' ),
	'visitor gate includes admin_only'
);

god_mode_assert(
	str_contains( $admin_render, 'neo_pulse_chat_god_mode_enabled' )
		&& str_contains( $admin_render, 'Enable God Mode for Neo Digital staff (@neodigital.ca)' ),
	'Chat General has an Enable God Mode toggle for Neo Digital staff'
);

god_mode_assert(
	str_contains( $admin_save, 'neo_pulse_chat_god_mode_enabled' )
		&& str_contains( $admin_save, "'god_mode_enabled'" ),
	'saving Chat General persists god_mode_enabled'
);

god_mode_assert(
	str_contains( $chat, 'current_user_email_is_neodigital' )
		&& str_contains( $chat, "domain === 'neodigital.ca'" ),
	'God Mode helper whitelists @neodigital.ca emails'
);

god_mode_assert(
	str_contains( $super, 'current_user_can_backend_mode()' ),
	'backend stream rejects God Mode when the helper is false'
);

if ( $failed ) {
	exit( 1 );
}

echo "PASS: God Mode setting contract\n";

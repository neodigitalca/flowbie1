<?php
/**
 * Chekkit contact module tests.
 *
 * Run: php tests/test-chekkit.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $text ) {
		return trim( strip_tags( (string) $text ) );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $text ) {
		return trim( strip_tags( (string) $text ) );
	}
}

if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $email ) {
		$email = trim( (string) $email );
		return filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : '';
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $url ) {
		$url = trim( (string) $url );
		return filter_var( $url, FILTER_VALIDATE_URL ) ? $url : '';
	}
}

if ( ! function_exists( 'is_email' ) ) {
	function is_email( $email ) {
		return (bool) filter_var( (string) $email, FILTER_VALIDATE_EMAIL );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-chekkit.php';

function chekkit_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

chekkit_assert(
	null === Neo_Pulse_Wp_Chekkit::validate_contact_input(
		array(
			'name'  => 'Jane Doe',
			'phone' => '+14035551234',
			'email' => 'jane@example.com',
		)
	),
	'valid contact input passes'
);

$missing_name = Neo_Pulse_Wp_Chekkit::validate_contact_input(
	array(
		'name'  => '',
		'phone' => '+14035551234',
	)
);
chekkit_assert(
	is_array( $missing_name ) && isset( $missing_name['name'] ),
	'missing name returns error'
);

$bad_email = Neo_Pulse_Wp_Chekkit::validate_contact_input(
	array(
		'name'  => 'Jane',
		'phone' => '+14035551234',
		'email' => 'not-an-email',
	)
);
chekkit_assert(
	is_array( $bad_email ) && isset( $bad_email['email'] ),
	'invalid email returns error'
);

$payload = Neo_Pulse_Wp_Chekkit::build_payload(
	array(
		'name'       => 'Jane Doe',
		'phone'      => '+14035551234',
		'email'      => 'jane@example.com',
		'message'    => 'Need help',
		'source_url' => 'https://example.com/contact',
	),
	'contact_request'
);
chekkit_assert( $payload['name'] === 'Jane Doe', 'payload name' );
chekkit_assert( $payload['phone'] === '+14035551234', 'payload phone' );
chekkit_assert( $payload['email'] === 'jane@example.com', 'payload email' );
chekkit_assert( $payload['message'] === 'Need help', 'payload message' );
chekkit_assert( $payload['event_type'] === 'contact_request', 'payload event_type' );
chekkit_assert( $payload['source_url'] === 'https://example.com/contact', 'payload source_url' );

chekkit_assert( Neo_Pulse_Wp_Chekkit::is_configured(), 'chekkit configured with default hub URL' );
chekkit_assert(
	Neo_Pulse_Wp_Chekkit::get_webhook_url() === Neo_Pulse_Wp_Chekkit::DEFAULT_WEBHOOK_URL,
	'default webhook URL is neodigital.ca hub'
);

echo "All Chekkit tests passed.\n";

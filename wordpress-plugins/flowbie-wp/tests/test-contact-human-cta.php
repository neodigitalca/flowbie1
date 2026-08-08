<?php
/**
 * Talk To A Human card CTA tests.
 *
 * Run: php tests/test-contact-human-cta.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

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

function contact_human_cta_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chekkit.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-rag.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-links.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-chat-lead.php';

$settings_enabled = array(
	'chekkit_enabled'        => true,
	'chekkit_teaser_enabled' => true,
	'chekkit_cta_label'      => 'Send Us A Text',
);
$settings_disabled = array(
	'chekkit_enabled' => false,
);

/**
 * Mirrors Flowbie_Wp_Chat frontend config for chekkitTeaserEnabled.
 *
 * @param array<string,mixed> $settings
 */
function contact_human_chekkit_teaser_enabled( array $settings ): bool {
	$chekkit_enabled = ! isset( $settings['chekkit_enabled'] ) || ! empty( $settings['chekkit_enabled'] );
	return $chekkit_enabled && ( ! isset( $settings['chekkit_teaser_enabled'] ) || ! empty( $settings['chekkit_teaser_enabled'] ) );
}

contact_human_cta_assert(
	contact_human_chekkit_teaser_enabled( $settings_enabled ),
	'chekkit teaser enabled by default when chekkit is on'
);

contact_human_cta_assert(
	! contact_human_chekkit_teaser_enabled( $settings_disabled ),
	'chekkit teaser disabled when chekkit is off'
);

contact_human_cta_assert(
	contact_human_chekkit_teaser_enabled( array( 'chekkit_enabled' => true ) ),
	'chekkit teaser defaults on when teaser key is unset'
);

contact_human_cta_assert(
	! contact_human_chekkit_teaser_enabled(
		array(
			'chekkit_enabled'        => true,
			'chekkit_teaser_enabled' => false,
		)
	),
	'chekkit teaser respects explicit disable'
);

contact_human_cta_assert(
	Flowbie_Wp_Chat_Lead::should_suggest_contact_human( 'What is your phone number?', array( 'intent' => 'question' ) ),
	'keyword contact message suggests contact human'
);

contact_human_cta_assert(
	Flowbie_Wp_Chat_Lead::should_suggest_contact_human( 'Can i talk to a human', array( 'intent' => 'question' ) ),
	'human handoff phrase suggests contact human'
);

contact_human_cta_assert(
	Flowbie_Wp_Chat_Links::detect_lead_action( 'Can i talk to a human' ) === 'contact',
	'detect_lead_action matches human handoff message'
);

contact_human_cta_assert(
	Flowbie_Wp_Chat_Lead::should_suggest_contact_human( 'Tell me about services', array( 'intent' => 'navigation' ) ),
	'navigation intent suggests contact human'
);

contact_human_cta_assert(
	! Flowbie_Wp_Chat_Lead::should_suggest_contact_human( 'Tell me about services', array( 'intent' => 'question' ) ),
	'non-lead question does not suggest contact human'
);

contact_human_cta_assert(
	! Flowbie_Wp_Chat_Lead::is_chekkit_available( $settings_disabled ),
	'chekkit unavailable when disabled in settings'
);

$card = array(
	'type'  => 'navigation',
	'title' => 'Contact',
	'body'  => 'Reach us anytime.',
	'cta'   => array(
		'label' => 'Contact us',
		'url'   => 'https://example.com/contact',
	),
);

$unchanged = Flowbie_Wp_Chat_Lead::maybe_attach_contact_human_cta(
	$card,
	'Tell me about services',
	array( 'intent' => 'question' ),
	$settings_enabled
);
contact_human_cta_assert(
	! isset( $unchanged['contactHumanCta'] ),
	'skips contactHumanCta when not a lead message'
);

if ( ! defined( 'FLOWBIE_WP_CHEKKIT_WEBHOOK_URL' ) ) {
	define( 'FLOWBIE_WP_CHEKKIT_WEBHOOK_URL', 'https://flowbie.ca/webhook' );
}

contact_human_cta_assert(
	Flowbie_Wp_Chat_Lead::is_chekkit_available( $settings_enabled ),
	'chekkit available when enabled and configured'
);

$with_human = Flowbie_Wp_Chat_Lead::maybe_attach_contact_human_cta(
	$card,
	'What is your phone number?',
	array( 'intent' => 'navigation' ),
	$settings_enabled
);
contact_human_cta_assert(
	isset( $with_human['contactHumanCta']['action'] ) && $with_human['contactHumanCta']['action'] === 'contact_human',
	'attaches contactHumanCta action'
);
contact_human_cta_assert(
	$with_human['contactHumanCta']['label'] === 'Send Us A Text',
	'uses configured chekkit label'
);
contact_human_cta_assert(
	! isset( $with_human['cta'] ),
	'removes page cta button when contact human cta is attached'
);

echo "All contact human CTA tests passed.\n";

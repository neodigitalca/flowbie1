<?php
/**
 * Novamira page design harness helpers (no live Novamira).
 *
 * @package Neo_Pulse_Wp
 */

define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', NEO_PULSE_WP_PLUGIN_DIR );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-context.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-openrouter-agent.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-novamira-page-design-harness.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-novamira-page.php';

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

function assert_ok( $cond, $msg ) {
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: {$msg}\n" );
		exit( 1 );
	}
}

$tool = Neo_Pulse_Wp_Backend_Assist_Openrouter_Agent::tool_name_from_ability( 'novamira/elementor-update-page' );
assert_ok( $tool === 'novamira_elementor-update-page', 'tool name sanitize' );

$back = Neo_Pulse_Wp_Backend_Assist_Openrouter_Agent::ability_from_tool_name(
	$tool,
	array( 'novamira/elementor-update-page' )
);
assert_ok( $back === 'novamira/elementor-update-page', 'tool name roundtrip' );

$plan = Neo_Pulse_Wp_Backend_Assist_Novamira_Page::section_plan_from_block_spans(
	array(
		array(
			'label'        => 'Hero',
			'slot_indexes' => array( 0, 1 ),
		),
	)
);
assert_ok( count( $plan ) === 1 && $plan[0]['label'] === 'Hero', 'section plan from block spans' );

$tools = Neo_Pulse_Wp_Backend_Assist_Openrouter_Agent::tools_from_allowlist(
	array( 'novamira/check-design' )
);
assert_ok( count( $tools ) === 1 && ( $tools[0]['function']['name'] ?? '' ) !== '', 'tools from allowlist' );

$mock_names = array(
	'novamira/agent-context',
	'novamira/check-design',
	'novamira/elementor-update-page',
	'novamira/gutenberg-write-content',
	'novamira/elementor-get-page',
);
$filtered = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Harness::filter_elementor_write_abilities( $mock_names );
assert_ok( $filtered === array( 'novamira/elementor-update-page' ), 'allowlist filters elementor write only' );

assert_ok(
	! Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Harness::check_design_passed( array( 'ok' => false, 'violations' => array( 'contrast' ) ) ),
	'check-design fail gate'
);
assert_ok(
	Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Harness::check_design_passed( array( 'ok' => true ) ),
	'check-design pass gate'
);

echo "OK novamira-page-design-harness tests\n";

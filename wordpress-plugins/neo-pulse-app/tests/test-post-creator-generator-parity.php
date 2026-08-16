<?php
/**
 * Post creator server vs Generator parity (filter, blueprint expand, token budgets).
 *
 * Run: php wordpress-plugins/neo-pulse-app/tests/test-post-creator-generator-parity.php
 *
 * @package Neo_Pulse_App
 */

define( 'ABSPATH', true );
define( 'NEO_PULSE_APP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/class-agent-run-article-length-policy.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/prompts/post-creator-exported-prompts.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/prompts/post-creator-generator-prompts.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/class-agent-run-checklist-post-process.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/class-agent-run-blueprint-post-process.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/class-agent-run-harness-section-tokens.php';
require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/agent-runs/class-agent-run-post-creator-pipeline.php';

$failures = 0;

function assert_true( bool $cond, string $message ): void {
	global $failures;
	if ( ! $cond ) {
		echo "FAIL: {$message}\n";
		++$failures;
	}
}

function assert_eq( $expected, $actual, string $message ): void {
	global $failures;
	if ( $expected !== $actual ) {
		echo "FAIL: {$message} (expected " . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) . ")\n";
		++$failures;
	}
}

// Intro agents are kept; FAQ and Overview are stripped.
$agents = array(
	array( 'step' => 1, 'title' => 'Introduction', 'features' => array( '[LINK]: x' ) ),
	array( 'step' => 2, 'title' => 'Core Benefits', 'features' => array( '[LINK]: x' ) ),
	array( 'step' => 3, 'title' => 'FAQ', 'features' => array() ),
	array( 'step' => 4, 'title' => 'Overview', 'features' => array() ),
	array( 'step' => 5, 'title' => 'Installation Steps', 'features' => array( '[LINK]: x' ) ),
);
$body = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::filter_body_agents( $agents );
assert_eq( 3, count( $body ), 'filter_body_agents keeps intro, drops FAQ/Overview only' );
assert_true(
	strtolower( (string) ( $body[0]['title'] ?? '' ) ) === 'introduction',
	'first body agent is Introduction (not dropped)'
);

$renamed = Neo_Pulse_App_Agent_Run_Exported_Prompts::rename_intro_agent_title( 'Intro', 'motorized blinds' );
assert_eq( 'Why motorized blinds Matters', $renamed, 'rename_intro_agent_title rewrites Intro' );

$checklist = array(
	'Why motorized blinds matter [EXACT PRIMARY PER H2]',
	'Types and materials [TABLE]',
	'Installation [LIST]: number',
	'Maintenance tips [LIST]: bullet',
	'Cost comparison [TABLE]',
	'Conclusion with CTA [LINK]',
);

$normalized = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::normalize_blueprint_agents(
	array(
		array(
			'id'       => 'a1',
			'step'     => 1,
			'title'    => 'Intro',
			'features' => array( '[TABLE] x', '[LIST] y', '[LINK] z', 'extra 1', 'extra 2' ),
		),
	),
	$checklist,
	'motorized blinds'
);
assert_true( count( $normalized ) >= 1, 'normalize keeps intro agent (renamed)' );
assert_true(
	stripos( (string) ( $normalized[0]['title'] ?? '' ), 'motorized blinds' ) !== false,
	'intro agent title renamed to SEO H2'
);

$expanded = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::expand_blueprint_agents_if_needed( $normalized, $checklist );
assert_true(
	count( $expanded ) >= min( count( $checklist ), 4 ),
	'expand_blueprint_agents_if_needed reaches min(checklist, 4) agents'
);

$body_agents = array();
foreach ( array_slice( $checklist, 0, 5 ) as $i => $item ) {
	$body_agents[] = array(
		'step'     => $i + 1,
		'title'    => Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::normalize_blueprint_agents(
			array( array( 'title' => $item, 'features' => array( '[LINK]: x' ) ) ),
			array( $item ),
			'motorized blinds'
		)[0]['title'],
		'features' => array( '[LINK]: x' ),
	);
}
$token_map = Neo_Pulse_App_Agent_Run_Harness_Section_Tokens::token_map_for_body_and_overview(
	$body_agents,
	Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::HARNESS_ROW_TOKEN_BUDGET
);
$allocated = array_sum( $token_map );
assert_eq(
	Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::HARNESS_ROW_TOKEN_BUDGET,
	$allocated,
	'token_map_for_body_and_overview allocates full 16k row budget'
);
assert_true( isset( $token_map['overview'] ), 'overview slot present in token map' );
assert_true( $token_map['overview'] >= 256, 'overview maxTokens meets sanity minimum' );

$body_md = array();
foreach ( $body_agents as $agent ) {
	$body_md[] = '## ' . $agent['title'] . "\n\nBody copy for section.";
}
$overview = "## Overview\n\nLead paragraph.\n\n- **Benefits**: One sentence with [[SCROLL:#types-and-materials|material options]].";
$stitched = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::stitch_markdown( $overview, $body_md );
$h2_count = preg_match_all( '/^## /m', $stitched );
assert_true(
	$h2_count >= 6,
	'stitched markdown has Overview plus at least 5 body H2s (got ' . $h2_count . ')'
);

$raw_checklist = "1. ## Experience the Future of Blinds [STRUCTURE]: 2 paragraphs.\n"
	. "2. Why motorized blinds matter [EXACT PRIMARY PER H2] [LINK]: 3-5 links.\n"
	. "3. **Bold only:** no markers here.\n"
	. "4. Installation [LIST]: number steps.\n"
	. "5. Conclusion with motorized blinds [EXACT PRIMARY PER H2].";
$parsed_checklist = Neo_Pulse_App_Agent_Run_Checklist_Post_Process::parse_blog_template_checklist( $raw_checklist );
assert_true( count( $parsed_checklist ) >= 4, 'checklist parse yields at least 4 items from fixture LLM text' );
foreach ( $parsed_checklist as $item ) {
	assert_true( strpos( $item, '##' ) !== 0, 'parsed checklist item must not start with ##' );
}
$numbered = Neo_Pulse_App_Agent_Run_Checklist_Post_Process::format_checklist_numbered_lines( $parsed_checklist );
assert_true( preg_match( '/^1\. /', $numbered[0] ) === 1, 'artifact lines are numbered' );

$gen = Neo_Pulse_App_Agent_Run_Generator_Prompts::build_checklist_messages(
	array(
		'title'              => 'Test Title',
		'keyword'            => 'motorized blinds',
		'keywordData'        => array( 'keyword' => 'motorized blinds' ),
		'selectedKeywords'   => array( 'motorized blinds' ),
		'selectedH2Sections' => array( 'Why motorized blinds matter' ),
		'connectedSite'      => array( 'name' => 'Advance Blinds', 'siteUrl' => 'https://example.com' ),
	)
);
assert_true(
	strpos( $gen['system'], 'Do NOT use ## markdown headings' ) !== false,
	'generator checklist system prompt includes no-## rule'
);

$nested = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::normalize_blueprint_payload(
	array(
		'blueprint' => array(
			'title'   => 'Nested title',
			'agents'  => array(
				array( 'title' => 'Section A', 'features' => array( '[LINK]: x' ) ),
			),
		),
	)
);
assert_true(
	is_array( $nested['agents'] ?? null ) && count( $nested['agents'] ) === 1,
	'normalize_blueprint_payload unwraps blueprint.agents'
);

$fenced = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::parse_blueprint_json(
	"```json\n{\"agents\":[{\"title\":\"Fenced\",\"features\":[\"[LINK]: x\"]}]}\n```"
);
assert_true(
	is_array( $fenced['agents'] ?? null ) && count( $fenced['agents'] ) === 1,
	'parse_blueprint_json strips markdown fences'
);

$fallback_agents = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::agents_from_checklist(
	$checklist,
	'motorized blinds'
);
assert_true(
	count( $fallback_agents ) >= 3,
	'agents_from_checklist builds at least 3 agents from 6-item checklist'
);
$repaired = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::repair_agents(
	$fallback_agents,
	$checklist,
	'motorized blinds'
);
assert_true(
	count( $repaired ) >= min( count( $checklist ), 3 ),
	'repair_agents expands checklist fallback to min agents'
);

if ( $failures > 0 ) {
	echo "{$failures} assertion(s) failed.\n";
	exit( 1 );
}

echo "OK: post creator generator parity (" . count( $body_agents ) . " body agents, {$allocated} tokens).\n";

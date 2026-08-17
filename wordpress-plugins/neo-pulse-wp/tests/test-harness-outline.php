<?php
/**
 * Smoke tests for harness outline (run: php tests/test-harness-outline.php)
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );

require_once dirname( __DIR__ ) . '/includes/harness/class-neo-pulse-wp-harness-prompts.php';
require_once dirname( __DIR__ ) . '/includes/harness/class-neo-pulse-wp-harness-outline.php';
require_once dirname( __DIR__ ) . '/includes/harness/class-neo-pulse-wp-content-sections.php';

$failed = 0;

function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$stitched = Neo_Pulse_Wp_Harness_Outline::stitch_sections(
	array(
		'<h2>First</h2><p>a</p>',
		'<h2>Second</h2><p>b</p>',
	)
);
assert_true( $stitched === "<h2>First</h2><p>a</p>\n\n<h2>Second</h2><p>b</p>", 'stitch order' );

$footer = Neo_Pulse_Wp_Harness_Outline::strip_footer_from_section_html(
	'<h2>Topic</h2><p>Body</p><footer><p>Wrap-up</p></footer>'
);
assert_true( strpos( $footer, '<footer>' ) === false, 'footer stripped' );

$agents = array(
	array(
		'title'       => 'Alpha',
		'description' => 'About alpha',
		'features'    => array(),
		'headingLevel' => 1,
	),
	array(
		'title'       => 'FAQ block',
		'description' => 'Questions',
		'features'    => array( '[faq]' ),
		'headingLevel' => 1,
	),
);
$outline = Neo_Pulse_Wp_Harness_Outline::from_agents( $agents );
assert_true( $outline[1]['displayTitle'] === 'Frequently Asked Questions', 'FAQ display title' );
assert_true( Neo_Pulse_Wp_Harness_Prompts::agent_has_faq_feature( array( '[faq]' ) ), 'faq feature detect' );

$titles = Neo_Pulse_Wp_Content_Sections::extract_h2_titles_from_html( '<h2>One</h2><p>x</p><h2>Two</h2>' );
assert_true( count( $titles ) === 2 && $titles[0] === 'One', 'h2 extract' );

exit( $failed > 0 ? 1 : 0 );

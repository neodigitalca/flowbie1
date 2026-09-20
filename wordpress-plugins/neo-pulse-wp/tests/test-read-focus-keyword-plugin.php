<?php
/**
 * Smoke test: blog focus keyword follows the current title, not a leftover Rank Math slug.
 *
 * Run: php wordpress-plugins/neo-pulse-wp/tests/test-read-focus-keyword-plugin.php
 */

define( 'ABSPATH', __DIR__ );

$GLOBALS['neo_pulse_test_meta']   = array();
$GLOBALS['neo_pulse_test_titles'] = array();

if ( ! class_exists( 'WP_Post' ) ) {
	class WP_Post {
		public $post_title = '';
		public $post_type  = 'post';
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = false ) {
		unset( $single );
		$store = $GLOBALS['neo_pulse_test_meta'][ (int) $post_id ] ?? array();
		return $store[ $key ] ?? '';
	}
}

if ( ! function_exists( 'get_field' ) ) {
	function get_field( $key, $post_id, $format = true ) {
		unset( $format );
		$store = $GLOBALS['neo_pulse_test_meta'][ (int) $post_id ] ?? array();
		return $store[ $key ] ?? '';
	}
}

if ( ! function_exists( 'get_post' ) ) {
	function get_post( $post_id ) {
		$title = $GLOBALS['neo_pulse_test_titles'][ (int) $post_id ] ?? '';
		if ( $title === '' ) {
			return null;
		}
		$post             = new WP_Post();
		$post->post_title = $title;
		$post->post_type  = 'post';
		return $post;
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-ai-context.php';

function neo_pulse_assert( $ok, $label ) {
	if ( ! $ok ) {
		fwrite( STDERR, "FAIL: {$label}\n" );
		exit( 1 );
	}
}

neo_pulse_assert(
	Neo_Pulse_Wp_Ai_Context::primary_focus_phrase( 'national seo strategy, seo edmonton' ) === 'national seo strategy',
	'primary_focus_phrase uses the phrase before the comma'
);

$GLOBALS['neo_pulse_test_titles'][12] = 'What Is National SEO And How It Works';
$GLOBALS['neo_pulse_test_meta'][12]   = array(
	'keyword_focus'           => 'elementor experts',
	'rank_math_focus_keyword' => 'what is national seo',
);
neo_pulse_assert(
	Neo_Pulse_Wp_Ai_Context::read_focus_keyword( 12 ) === 'what is national seo',
	'stored keyword that matches the title wins'
);

$GLOBALS['neo_pulse_test_titles'][8186] = 'What Is National SEO And How Does It Work?';
$GLOBALS['neo_pulse_test_meta'][8186]   = array(
	'rank_math_focus_keyword' => 'elementor experts',
);
neo_pulse_assert(
	Neo_Pulse_Wp_Ai_Context::read_focus_keyword( 8186 ) === 'what is national seo and how does it work',
	'leftover Rank Math slug loses to the current title'
);

$GLOBALS['neo_pulse_test_titles'][8209] = 'Scaling A Digital Brand With Growth Strategies';
$GLOBALS['neo_pulse_test_meta'][8209]   = array(
	'keyword_focus' => 'wordpress maintenance',
);
neo_pulse_assert(
	Neo_Pulse_Wp_Ai_Context::read_focus_keyword( 8209 ) === 'scaling a digital brand with growth strategies',
	'leftover ACF keyword loses to the current title'
);

echo "ok\n";

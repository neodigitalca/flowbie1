<?php
/**
 * Novamira site design RAG and compose (fixture only, no live slugs).
 *
 * @package Neo_Pulse_Wp
 */

define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'ABSPATH', NEO_PULSE_WP_PLUGIN_DIR );

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-novamira-page-design-rag.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-context.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-ai.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/backend-assist/class-neo-pulse-wp-backend-assist-novamira-page-compose.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-library.php';

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		private $message;
		public function __construct( $code = '', $message = '' ) {
			unset( $code );
			$this->message = (string) $message;
		}
		public function get_error_message() {
			return $this->message;
		}
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $value ) {
		return abs( (int) $value );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return is_string( $key ) ? strtolower( preg_replace( '/[^a-z0-9_\-]/', '', $key ) ) : '';
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return is_string( $text ) ? htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' ) : '';
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $string ) {
		return is_string( $string ) ? strip_tags( $string ) : '';
	}
}

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://example.test/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min = 0, $max = 0 ) {
		unset( $min, $max );
		return 42;
	}
}

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return $thing instanceof WP_Error;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

function assert_ok( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$fixture_section = array(
	'id'       => 'sec1',
	'elType'   => 'section',
	'settings' => array(
		'background_background' => 'classic',
		'background_color'      => '#000000',
	),
	'elements' => array(
		array(
			'id'       => 'col1',
			'elType'   => 'column',
			'settings' => array( '_column_size' => 50 ),
			'elements' => array(
				array(
					'id'         => 'w1',
					'elType'     => 'widget',
					'widgetType' => 'ygency-section-title',
					'settings'   => array(
						'title'       => 'Reference title must be stripped',
						'title_color' => '#ffffff',
					),
				),
			),
		),
		array(
			'id'       => 'col2',
			'elType'   => 'column',
			'settings' => array( '_column_size' => 50 ),
			'elements' => array(
				array(
					'id'         => 'w2',
					'elType'     => 'widget',
					'widgetType' => 'image',
					'settings'   => array(
						'image' => array( 'id' => 99, 'url' => 'https://example.test/img.png' ),
					),
				),
			),
		),
	),
);

$blueprint = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::section_to_blueprint( $fixture_section );
assert_ok( is_array( $blueprint ), 'section_to_blueprint returns array' );
assert_ok( ( $blueprint['archetype'] ?? '' ) === 'hero', 'hero archetype inferred' );
assert_ok( ! empty( $blueprint['widgets_by_column'] ) && count( $blueprint['widgets_by_column'] ) === 2, 'widgets_by_column preserves two columns' );
assert_ok( ( $blueprint['widgets_by_column'][1][0]['widgetType'] ?? '' ) === 'image', 'image stays in second column bucket' );
assert_ok( ! isset( $blueprint['widgets'][0]['settings']['title'] ), 'reference title stripped from exemplar' );
assert_ok( isset( $blueprint['widgets'][0]['settings']['title_color'] ), 'style color kept' );

$digest = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::merge_pages(
	array(
		array(
			'post_id'  => 100,
			'title'    => 'Fixture Page',
			'elements' => array( $fixture_section ),
		),
	)
);
assert_ok( $digest !== array(), 'merge_pages non-empty' );
assert_ok( in_array( 'hero', $digest['archetypes'], true ), 'digest lists hero archetype' );
assert_ok( ! empty( $digest['widget_exemplars']['ygency-section-title'] ), 'ygency exemplar in catalog' );
$hero_blueprint = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::section_to_blueprint( $fixture_section );
assert_ok( is_array( $hero_blueprint ), 'hero blueprint for sequence fixture' );
$digest['section_template_sequence'] = array( $hero_blueprint );

$slots = array(
	array( 'type' => 'h2', 'text' => 'Topic H2', 'heading_level' => 2 ),
	array( 'type' => 'paragraph', 'html' => '<p>Body copy for topic.</p>' ),
	array( 'type' => 'h2', 'text' => 'Second H2', 'heading_level' => 2 ),
	array( 'type' => 'paragraph', 'html' => '<p>Second body.</p>' ),
);

$block_plan = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::deterministic_layout_plan(
	$digest,
	$slots,
	array(
		array(
			'label'        => 'Topic H2',
			'slot_indexes' => array( 0, 1 ),
		),
		array(
			'label'        => 'Second H2',
			'slot_indexes' => array( 2, 3 ),
		),
	)
);
assert_ok( ! ( $block_plan instanceof WP_Error ), 'block span plan succeeds' );
assert_ok( count( $block_plan['sections'] ) === 2, 'one section per saved SEO block span' );
assert_ok( isset( $block_plan['sections'][0]['template_index'] ), 'block plan assigns template index' );

$deterministic = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::deterministic_layout_plan( $digest, $slots );
assert_ok( ! ( $deterministic instanceof WP_Error ), 'deterministic_layout_plan succeeds' );
assert_ok( count( $deterministic['sections'] ) === 2, 'one section per H2 block' );
assert_ok( ( $deterministic['sections'][0]['label'] ?? '' ) === 'Topic H2', 'first section label is H2 text' );
assert_ok( empty( $deterministic['sections'][0]['slot_driven'] ), 'sections use RAG templates not slot_driven stack' );

$plan = $deterministic;

$validated = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::validate_plan( $plan, $digest['archetypes'], count( $slots ) );
assert_ok( ! ( $validated instanceof WP_Error ), 'plan validates' );

$elements = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::materialize(
	$validated,
	$digest,
	$slots,
	'Topic Page Title',
	array( 'design' => array( 'tokens' => array() ) )
);
assert_ok( ! ( $elements instanceof WP_Error ), 'materialize succeeds' );
assert_ok( is_array( $elements ) && count( $elements ) === 2, 'one Elementor section per H2 block' );

$found_ygency = false;
$found_topic  = false;
$image_in_col2 = false;
$walk = static function ( array $nodes, int $depth = 0 ) use ( &$walk, &$found_ygency, &$found_topic, &$image_in_col2 ) {
	foreach ( $nodes as $node ) {
		if ( ! is_array( $node ) ) {
			continue;
		}
		if ( ( $node['elType'] ?? '' ) === 'column' && $depth === 1 ) {
			$col_size = (int) ( $node['settings']['_column_size'] ?? 0 );
			if ( $col_size === 50 && ! empty( $node['elements'] ) && is_array( $node['elements'] ) ) {
				foreach ( $node['elements'] as $child ) {
					if ( is_array( $child ) && ( $child['widgetType'] ?? '' ) === 'image' ) {
						$image_in_col2 = true;
					}
				}
			}
		}
		if ( ( $node['elType'] ?? '' ) === 'widget' ) {
			if ( ( $node['widgetType'] ?? '' ) === 'ygency-section-title' ) {
				$found_ygency = true;
			}
			$settings = $node['settings'] ?? array();
			if ( is_array( $settings ) ) {
				$blob = wp_json_encode( $settings );
				if ( is_string( $blob ) && str_contains( $blob, 'Topic H2' ) ) {
					$found_topic = true;
				}
			}
		}
		if ( ! empty( $node['elements'] ) && is_array( $node['elements'] ) ) {
			$walk( $node['elements'], $depth + 1 );
		}
	}
};
$walk( $elements, 0 );
assert_ok( $found_ygency, 'output uses site ygency widget type from RAG' );
assert_ok( $found_topic, 'output uses slot copy not reference title' );
assert_ok( $image_in_col2, 'hero chrome image remains in second column' );

echo "OK novamira-page-design-rag tests\n";

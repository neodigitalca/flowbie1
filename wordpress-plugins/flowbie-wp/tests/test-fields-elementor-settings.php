<?php
/**
 * Smoke tests for Fields Elementor settings and boot gating.
 *
 * Run: php tests/test-fields-elementor-settings.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$flowbie_test_options = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	/**
	 * @param array<string, mixed> $args     Args.
	 * @param array<string, mixed> $defaults Defaults.
	 * @return array<string, mixed>
	 */
	function wp_parse_args( $args, $defaults = array() ) {
		if ( ! is_array( $args ) ) {
			return $defaults;
		}
		return array_merge( $defaults, $args );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		global $flowbie_test_options;
		return array_key_exists( $key, $flowbie_test_options ) ? $flowbie_test_options[ $key ] : $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value ) {
		global $flowbie_test_options;
		$flowbie_test_options[ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'add_option' ) ) {
	function add_option( $key, $value ) {
		global $flowbie_test_options;
		if ( array_key_exists( $key, $flowbie_test_options ) ) {
			return false;
		}
		$flowbie_test_options[ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'did_action' ) ) {
	function did_action( $hook ) {
		unset( $hook );
		return false;
	}
}

class Flowbie_Wp_Fields {
	public static function acf_is_active(): bool {
		return ! empty( $GLOBALS['flowbie_test_acf_active'] );
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-settings.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg  Message.
 */
function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$defaults = Flowbie_Wp_Fields_Elementor_Settings::default_config();
assert_true( ! empty( $defaults['enabled'] ), 'defaults enable dynamic tags' );
assert_true( ! empty( $defaults['enable_post_tags'] ), 'defaults enable post tags' );
assert_true( ( $defaults['field_picker_scope'] ?? '' ) === 'all', 'defaults use all-fields picker scope' );
assert_true( empty( $defaults['show_layout_fields'] ), 'layout fields off by default' );

$sanitized = Flowbie_Wp_Fields_Elementor_Settings::sanitize_config(
	array(
		'enabled'              => 1,
		'enable_post_tags'     => 'yes',
		'enable_options_tags'  => 0,
		'show_layout_fields'   => 'on',
		'field_picker_scope'   => 'location',
	)
);
assert_true( ! empty( $sanitized['enabled'] ), 'enabled coerced to bool true' );
assert_true( empty( $sanitized['enable_options_tags'] ), 'disabled options tags sanitized' );
assert_true( ! empty( $sanitized['show_layout_fields'] ), 'show_layout_fields coerced true' );
assert_true( $sanitized['field_picker_scope'] === 'location', 'field_picker_scope location sanitized' );

$flowbie_test_options = array();
Flowbie_Wp_Fields_Elementor_Settings::save_config(
	array(
		'enabled'             => false,
		'enable_post_tags'    => true,
		'enable_options_tags' => true,
	)
);
$saved = Flowbie_Wp_Fields_Elementor_Settings::get_config();
assert_true( empty( $saved['enabled'] ), 'saved master toggle persists' );
assert_true( ! Flowbie_Wp_Fields_Elementor_Settings::is_enabled(), 'is_enabled false when master off' );
assert_true( 0 === Flowbie_Wp_Fields_Elementor_Settings::expected_registered_tag_count(), 'zero tags when master disabled' );

Flowbie_Wp_Fields_Elementor_Settings::save_config(
	array(
		'enabled'             => true,
		'enable_post_tags'    => true,
		'enable_options_tags' => false,
	)
);
assert_true( 4 === Flowbie_Wp_Fields_Elementor_Settings::expected_registered_tag_count(), 'four tags when only post tags on' );
assert_true( Flowbie_Wp_Fields_Elementor_Settings::post_tags_enabled(), 'post tags enabled' );
assert_true( ! Flowbie_Wp_Fields_Elementor_Settings::options_tags_enabled(), 'options tags disabled' );

$GLOBALS['flowbie_test_acf_active'] = true;
assert_true( ! Flowbie_Wp_Fields_Elementor::can_register_tags(), 'cannot register when ACF active' );
$GLOBALS['flowbie_test_acf_active'] = false;

Flowbie_Wp_Fields_Elementor_Settings::save_config(
	array(
		'enabled'             => true,
		'enable_post_tags'    => true,
		'enable_options_tags' => true,
	)
);
assert_true( ! Flowbie_Wp_Fields_Elementor::can_register_tags(), 'cannot register without Elementor dynamic tags module' );

class Elementor_Modules_DynamicTags_Module {}

assert_true( class_exists( '\Elementor\Modules\DynamicTags\Module', false ), 'dynamic tags module stub loaded' );
assert_true( ! Flowbie_Wp_Fields_Elementor::can_register_tags(), 'still cannot register without elementor loaded' );

define( 'ELEMENTOR_VERSION', '3.0.0' );
assert_true( Flowbie_Wp_Fields_Elementor::elementor_loaded(), 'elementor_loaded true with constant' );
assert_true( Flowbie_Wp_Fields_Elementor::can_register_tags(), 'can register when all requirements met' );
assert_true( 8 === Flowbie_Wp_Fields_Elementor::expected_registered_tag_count(), 'eight tags when fully enabled' );

Flowbie_Wp_Fields_Elementor_Settings::save_config(
	array(
		'enabled'             => true,
		'enable_post_tags'    => false,
		'enable_options_tags' => false,
	)
);
assert_true( ! Flowbie_Wp_Fields_Elementor::can_register_tags(), 'cannot register when both tag groups disabled' );

$flowbie_test_options = array();
Flowbie_Wp_Fields_Elementor_Settings::maybe_bootstrap_defaults();
$bootstrapped = Flowbie_Wp_Fields_Elementor_Settings::get_config();
assert_true( ! empty( $bootstrapped['enabled'] ), 'maybe_bootstrap_defaults persists enabled defaults' );

$GLOBALS['flowbie_elementor_actions'] = array();
if ( ! function_exists( 'add_action' ) ) {
	/**
	 * @param string               $hook     Hook.
	 * @param callable             $callback Callback.
	 * @param int                  $priority Priority.
	 */
	function add_action( $hook, $callback, $priority = 10 ) {
		unset( $priority );
		$GLOBALS['flowbie_elementor_actions'][ $hook ][] = $callback;
	}
}
if ( ! function_exists( 'has_action' ) ) {
	function has_action( $hook, $callback = false ) {
		if ( empty( $GLOBALS['flowbie_elementor_actions'][ $hook ] ) ) {
			return false;
		}
		if ( $callback === false ) {
			return true;
		}
		foreach ( $GLOBALS['flowbie_elementor_actions'][ $hook ] as $registered ) {
			if ( $registered === $callback ) {
				return true;
			}
		}
		return false;
	}
}
if ( ! function_exists( 'do_action' ) ) {
	function do_action( $hook ) {
		unset( $hook );
	}
}

Flowbie_Wp_Fields_Elementor_Settings::save_config( Flowbie_Wp_Fields_Elementor_Settings::default_config() );
Flowbie_Wp_Fields_Elementor::init();
Flowbie_Wp_Fields_Elementor::boot();
assert_true( has_action( 'elementor/dynamic_tags/register', array( 'Flowbie_Wp_Fields_Elementor', 'register_tags' ) ), 'boot hooks dynamic tag registration' );
Flowbie_Wp_Fields_Elementor::boot();
assert_true( has_action( 'elementor/dynamic_tags/register', array( 'Flowbie_Wp_Fields_Elementor', 'register_tags' ) ), 'boot is idempotent' );

$status = Flowbie_Wp_Fields_Elementor::get_integration_status();
assert_true( is_array( $status ), 'get_integration_status returns array' );
assert_true( ! empty( $status['can_register_tags'] ), 'status reports can register when ready' );

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-post-meta-registry.php';
$types = Flowbie_Wp_Fields_Post_Meta_Registry::post_types_for_group(
	array(
		'location' => array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'post',
				),
			),
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'page',
				),
			),
		),
	)
);
assert_true( in_array( 'post', $types, true ), 'post_types_for_group includes post' );
assert_true( in_array( 'page', $types, true ), 'post_types_for_group includes page' );

$fields = Flowbie_Wp_Fields_Post_Meta_Registry::collect_registerable_fields(
	array(
		array(
			'name' => 'keyword_focus',
			'type' => 'text',
		),
		array(
			'name'       => 'layout_group',
			'type'       => 'group',
			'sub_fields' => array(
				array(
					'name' => 'nested_field',
					'type' => 'text',
				),
			),
		),
		array(
			'name' => 'tab_block',
			'type' => 'tab',
		),
	)
);
$field_names = array_map(
	static function ( $field ) {
		return (string) ( $field['name'] ?? '' );
	},
	$fields
);
assert_true( in_array( 'keyword_focus', $field_names, true ), 'collect_registerable_fields includes scalar fields' );
assert_true( in_array( 'nested_field', $field_names, true ), 'collect_registerable_fields includes group sub fields' );
assert_true( ! in_array( 'tab_block', $field_names, true ), 'collect_registerable_fields skips layout fields' );

exit( $failed > 0 ? 1 : 0 );

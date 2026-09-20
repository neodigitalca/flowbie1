<?php
/**
 * Flowbie / legacy field CPT slugs map to Pulse storage.
 *
 * Run: php tests/test-fields-storage-legacy-map.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-storage.php';

$failed = 0;

function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		++$failed;
		return;
	}
	echo "OK: {$msg}\n";
}

$map = Neo_Pulse_Wp_Fields_Storage::legacy_post_type_map();
assert_true( isset( $map['flowbie-field-group'] ), 'maps flowbie-field-group' );
assert_true( ( $map['flowbie-field-group'] ?? '' ) === Neo_Pulse_Wp_Fields_Storage::CPT_GROUP, 'flowbie groups become np-field-group' );
assert_true( ( $map['flowbie-field'] ?? '' ) === Neo_Pulse_Wp_Fields_Storage::CPT_FIELD, 'flowbie fields become neo-pulse-field' );
assert_true( ( $map['neo-pulse-field-group'] ?? '' ) === Neo_Pulse_Wp_Fields_Storage::CPT_GROUP, 'legacy Pulse groups become np-field-group' );
assert_true( Neo_Pulse_Wp_Fields_Storage::STORAGE_SLUG_VER === '3', 'storage slug version is 3' );

$editor = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-editor.php' );
assert_true( str_contains( $editor, '__back_compat_meta_box' ), 'AI box stays visible in the block editor' );

$fields_box = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-meta-box.php' );
assert_true( str_contains( $fields_box, '__back_compat_meta_box' ), 'field groups stay visible in the block editor' );

$fields = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields.php' );
assert_true( str_contains( $fields, 'Neo_Pulse_Wp_Fields_Meta_Box::init();' ), 'field meta boxes always init' );
assert_true( ! str_contains( $fields, "if ( ! self::acf_is_active() ) {\n\t\t\tNeo_Pulse_Wp_Fields_Meta_Box::init();" ), 'field boxes are not skipped when ACF is active' );

$plugin = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'neo-pulse-wp.php' );
assert_true( str_contains( $plugin, "Version:           0.9.228" ), 'plugin header is 0.9.228' );
assert_true( str_contains( $plugin, "define( 'NEO_PULSE_WP_VERSION', '0.9.228' )" ), 'plugin constant is 0.9.228' );

$gate = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-ai-gate.php' );
assert_true( str_contains( $gate, "array( 'post', 'page' )" ), 'optimizer types always include page' );

$editor = (string) file_get_contents( NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-editor.php' );
assert_true( ! str_contains( $editor, 'post_type_allowed' ), 'page editor is not blocked by the post-only gate' );

if ( $failed > 0 ) {
	exit( 1 );
}

echo "PASS: fields storage legacy map\n";

<?php
/**
 * Elementor ACF dynamic tag migration tests.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

$GLOBALS['neo-pulse_test_post_meta'] = array();
$GLOBALS['neo-pulse_test_posts']     = array();

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) {
		return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $key ) );
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = false ) {
		unset( $single );
		return $GLOBALS['neo-pulse_test_post_meta'][ $post_id ][ $key ] ?? '';
	}
}

if ( ! function_exists( 'update_post_meta' ) ) {
	function update_post_meta( $post_id, $key, $value ) {
		$GLOBALS['neo-pulse_test_post_meta'][ $post_id ][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_post_meta' ) ) {
	function delete_post_meta( $post_id, $key ) {
		unset( $GLOBALS['neo-pulse_test_post_meta'][ $post_id ][ $key ] );
		return true;
	}
}

if ( ! function_exists( 'wp_slash' ) ) {
	function wp_slash( $value ) {
		return $value;
	}
}

if ( ! function_exists( 'get_post' ) ) {
	function get_post( $post_id ) {
		return $GLOBALS['neo-pulse_test_posts'][ (int) $post_id ] ?? null;
	}
}

if ( ! function_exists( 'get_post_types' ) ) {
	function get_post_types( $args = array(), $output = 'names' ) {
		unset( $args, $output );
		return array( 'page', 'elementor_library' );
	}
}

if ( ! class_exists( 'WP_Post', false ) ) {
	class WP_Post {
		public $ID;
		public $post_title;
		public $post_type;
		public function __construct( array $data ) {
			foreach ( $data as $k => $v ) {
				$this->$k = $v;
			}
		}
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Storage', false ) ) {
	class Neo_Pulse_Wp_Fields_Storage {
		public static function get_all_groups( bool $active_only = true ): array {
			unset( $active_only );
			return $GLOBALS['neo-pulse_test_field_groups'] ?? array();
		}
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Location', false ) ) {
	class Neo_Pulse_Wp_Fields_Location {
		public static function matches_group( array $group, array $screen ): bool {
			unset( $group, $screen );
			return true;
		}
	}
}

if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Registry', false ) ) {
	class Neo_Pulse_Wp_Fields_Elementor_Registry {
		public static function options_field_key( string $options_slug, string $field_name ): string {
			return $options_slug . '::' . $field_name;
		}
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-dynamic-tags.php';

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

$GLOBALS['neo-pulse_test_field_groups'] = array(
	array(
		'key'      => 'group_contact',
		'location' => array(
			array(
				array(
					'param'    => 'options_page',
					'operator' => '==',
					'value'    => 'contact-information',
				),
			),
		),
		'fields'   => array(
			array(
				'key'  => 'field_66db25d749f17',
				'name' => 'ci_phone',
				'type' => 'text',
			),
			array(
				'key'  => 'field_66db261849f18',
				'name' => 'ci_phone_link',
				'type' => 'text',
			),
			array(
				'key'  => 'field_email',
				'name' => 'ci_email_address',
				'type' => 'email',
			),
		),
	),
	array(
		'key'      => 'group_service',
		'location' => array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'service-area',
				),
			),
		),
		'fields'   => array(
			array(
				'key'  => 'field_headline',
				'name' => 'headline',
				'type' => 'text',
			),
		),
	),
);

Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_field_index();
$index = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::build_field_index();
assert_true( isset( $index['options']['ci_phone'] ), 'field index maps ci_phone to options slug' );
assert_true( $index['options']['ci_phone'] === 'contact-information', 'ci_phone resolves to contact-information' );

$options_key = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::resolve_acf_key_setting( 'options:ci_phone' );
assert_true( ( $options_key['field_name'] ?? '' ) === 'ci_phone', 'resolve options:ci_phone field name' );
assert_true( ( $options_key['options_slug'] ?? '' ) === 'contact-information', 'resolve options:ci_phone slug' );

$post_key = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::resolve_acf_key_setting( 'field_headline:headline' );
assert_true( ( $post_key['field_name'] ?? '' ) === 'headline', 'resolve post field key:name' );
assert_true( empty( $post_key['options_slug'] ), 'post field has no options slug' );

$acf_settings = rawurlencode( wp_json_encode( array( 'key' => 'options:ci_phone' ) ) );
$acf_shortcode = '[elementor-tag id="abc1234" name="acf-text" settings="' . $acf_settings . '"]';
$acf_url_settings = rawurlencode( wp_json_encode( array( 'key' => 'options:ci_phone_link' ) ) );
$acf_url_shortcode = '[elementor-tag id="link123" name="acf-url" settings="' . $acf_url_settings . '"]';

$mapped = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::map_acf_tag(
	'acf-text',
	array( 'key' => 'options:ci_phone' )
);
assert_true( ( $mapped['name'] ?? '' ) === 'neo-pulse-options-field', 'maps acf-text to neo-pulse-options-field' );
assert_true(
	( $mapped['settings']['field_name'] ?? '' ) === 'contact-information::ci_phone',
	'maps options key to NEO Pulse composite field_name'
);

$rewrite = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $acf_shortcode );
assert_true( $rewrite['replacements'] === 0, 'rewrite_string idle mode keeps acf tags unchanged' );
assert_true( strpos( $rewrite['value'], 'acf-text' ) !== false, 'idle rewrite preserves acf tag name' );

Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::set_walk_mode( Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::WALK_MODE_MIGRATE_TO_NEO_PULSE );
$rewrite_forward = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $acf_shortcode );
assert_true( $rewrite_forward['replacements'] === 1, 'rewrite_string replaces one tag in migrate mode' );
assert_true( strpos( $rewrite_forward['value'], 'neo-pulse-options-field' ) !== false, 'rewritten shortcode uses neo-pulse tag' );
assert_true( strpos( $rewrite_forward['value'], 'contact-information' ) !== false, 'rewritten shortcode keeps options slug' );

$neo_pulse_preserved = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $rewrite_forward['value'] );
assert_true( (int) $neo_pulse_preserved['replacements'] === 0, 'migrate mode leaves existing neo-pulse tags unchanged' );
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_walk_mode();

$neo_pulse_settings = rawurlencode( wp_json_encode( array( 'field_name' => 'contact-information::ci_phone' ) ) );
$neo_pulse_shortcode = '[elementor-tag id="abc1234" name="neo-pulse-options-field" settings="' . $neo_pulse_settings . '"]';
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::set_walk_mode( Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::WALK_MODE_REVERT_TO_ACF );
$revert_rewrite = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $neo_pulse_shortcode );
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_walk_mode();
assert_true( (int) $revert_rewrite['replacements'] === 1, 'revert mode restores acf tag via rewrite_string' );
assert_true( strpos( $revert_rewrite['value'], 'acf-text' ) !== false, 'reverted tag uses acf-text' );
assert_true( strpos( $revert_rewrite['value'], 'options%3Aci_phone' ) !== false || strpos( $revert_rewrite['value'], 'options:ci_phone' ) !== false, 'reverted tag uses options key' );

$icon_list_elements = array(
	array(
		'elType'     => 'widget',
		'widgetType' => 'icon-list',
		'settings'   => array(
			'icon_list' => array(
				array(
					'text'               => '',
					'__dynamic__text'     => $acf_shortcode,
					'link'               => array(
						'url'         => '',
						'is_external' => '',
						'nofollow'    => '',
					),
					'__dynamic__link.url' => $acf_url_shortcode,
				),
			),
		),
	),
);

Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::set_walk_mode( Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::WALK_MODE_MIGRATE_TO_NEO_PULSE );
$walk = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::walk_elements( $icon_list_elements );
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_walk_mode();
assert_true( (int) $walk['replacements'] === 2, 'walk_elements rewrites icon list dynamic text and link' );
assert_true(
	strpos( (string) $walk['elements'][0]['settings']['icon_list'][0]['__dynamic__text'], 'neo-pulse-options-field' ) !== false,
	'icon list __dynamic__text updated'
);
assert_true(
	strpos( (string) $walk['elements'][0]['settings']['icon_list'][0]['__dynamic__link.url'], 'neo-pulse-options-url' ) !== false,
	'icon list __dynamic__link.url updated'
);

$reordered_settings = rawurlencode( wp_json_encode( array( 'key' => 'options:ci_phone_link' ) ) );
$reordered_shortcode = '[elementor-tag name="acf-url" settings="' . $reordered_settings . '" id="xyz9876"]';
$post_settings = rawurlencode( wp_json_encode( array( 'key' => 'field_headline:headline' ) ) );
$post_shortcode = '[elementor-tag id="def5678" name="acf-text" settings="' . $post_settings . '"]';
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::set_walk_mode( Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::WALK_MODE_MIGRATE_TO_NEO_PULSE );
$reordered_rewrite = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $reordered_shortcode );
$post_rewrite = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string( $post_shortcode );
$unknown = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::rewrite_string(
	'[elementor-tag id="zzz" name="unknown-tag" settings="' . rawurlencode( '{}' ) . '"]'
);
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_walk_mode();
assert_true( (int) $reordered_rewrite['replacements'] === 1, 'flexible attribute order parses acf-url tag' );
assert_true( strpos( $reordered_rewrite['value'], 'neo-pulse-options-url' ) !== false, 'reordered attrs map to neo-pulse-options-url' );
assert_true( strpos( $post_rewrite['value'], 'neo-pulse-field' ) !== false, 'post acf tag maps to neo-pulse-field' );
assert_true( strpos( $post_rewrite['value'], 'headline' ) !== false, 'post field name preserved' );
assert_true( (int) $unknown['replacements'] === 0, 'unknown tag left unchanged' );
assert_true( (int) $unknown['skipped'] === 1, 'unknown tag counted as skipped' );

$static_contact_elements = array(
	array(
		'elType'     => 'widget',
		'widgetType' => 'icon-list',
		'settings'   => array(
			'icon_list' => array(
				array(
					'text' => 'CALL US',
					'link' => array( 'url' => 'tel:7805551212' ),
				),
				array(
					'text' => 'EMAIL',
					'link' => array( 'url' => 'mailto:info@example.com' ),
				),
				array(
					'text' => 'MAP',
					'link' => array( 'url' => 'https://maps.google.com/?q=edmonton' ),
				),
			),
		),
	),
);

Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::set_walk_mode( Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::WALK_MODE_MIGRATE_TO_NEO_PULSE );
$contact_walk = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::walk_elements( $static_contact_elements );
Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::reset_walk_mode();
assert_true( (int) $contact_walk['replacements'] >= 3, 'static contact icon list repaired with neo-pulse tags' );
assert_true(
	strpos( (string) $contact_walk['elements'][0]['settings']['icon_list'][0]['__dynamic__text'], 'neo-pulse-options-field' ) !== false,
	'static contact row uses neo-pulse-options-field'
);
assert_true(
	strpos( (string) $contact_walk['elements'][0]['settings']['icon_list'][0]['__dynamic__link.url'], 'neo-pulse-options-url' ) !== false,
	'static contact row uses neo-pulse-options-url'
);

$header_json = wp_json_encode( $icon_list_elements );
$GLOBALS['neo-pulse_test_post_meta'][101]['_elementor_data'] = $header_json;
$GLOBALS['neo-pulse_test_posts'][101] = new WP_Post(
	array(
		'ID'         => 101,
		'post_title' => 'Header',
		'post_type'  => 'elementor_library',
	)
);

$apply = Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags::apply_documents( array( 101 ), false );
assert_true( ! empty( $apply['processed'] ), 'apply_documents runs' );
assert_true( (int) $apply['documents_updated'] === 1, 'apply_documents reports one updated document' );
assert_true( (int) $apply['replacements'] >= 1, 'apply_documents reports tag replacements' );

$stored = get_post_meta( 101, '_elementor_data', true );
assert_true( is_string( $stored ) && strpos( $stored, 'neo-pulse-options-field' ) !== false, 'stored elementor data uses neo-pulse tag' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll tests passed.\n";
exit( $failed > 0 ? 1 : 0 );

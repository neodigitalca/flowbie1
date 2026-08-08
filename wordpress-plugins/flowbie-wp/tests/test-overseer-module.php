<?php
/**
 * Smoke tests for Overseer module (run: php tests/test-overseer-module.php)
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function apply_filters( $hook, $value ) { // phpcs:ignore
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * @param mixed $data Data.
	 */
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	/**
	 * @param string $url URL.
	 */
	function esc_url_raw( $url ) {
		return $url;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	/**
	 * @param string $str String.
	 */
	function sanitize_text_field( $str ) {
		return trim( $str );
	}
}

if ( ! function_exists( 'current_time' ) ) {
	/**
	 * @param string $type Type.
	 * @param bool   $gmt  GMT.
	 */
	function current_time( $type, $gmt = false ) {
		unset( $type, $gmt );
		return gmdate( 'Y-m-d H:i:s' );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) { // phpcs:ignore
		unset( $key );
		return $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $key, $value, $autoload = false ) { // phpcs:ignore
		unset( $key, $value, $autoload );
		return true;
	}
}

if ( ! function_exists( 'add_option' ) ) {
	function add_option( $key, $value, $deprecated = '', $autoload = false ) { // phpcs:ignore
		unset( $key, $value, $deprecated, $autoload );
		return true;
	}
}

if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id() {
		return 0;
	}
}

if ( ! function_exists( 'is_user_logged_in' ) ) {
	function is_user_logged_in() {
		return false;
	}
}

if ( ! function_exists( 'current_user_can' ) ) {
	function current_user_can( $cap ) { // phpcs:ignore
		unset( $cap );
		return false;
	}
}

if ( ! function_exists( 'url_to_postid' ) ) {
	function url_to_postid( $url ) { // phpcs:ignore
		unset( $url );
		return 0;
	}
}

if ( ! function_exists( 'wp_generate_password' ) ) {
	function wp_generate_password( $length, $special, $extra ) { // phpcs:ignore
		unset( $special, $extra );
		return str_repeat( 'a', (int) $length );
	}
}

if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min, $max ) { // phpcs:ignore
		return $min;
	}
}

if ( ! function_exists( 'rest_url' ) ) {
	function rest_url( $path = '' ) {
		return 'https://example.test/wp-json/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'wp_create_nonce' ) ) {
	function wp_create_nonce( $action ) { // phpcs:ignore
		return 'nonce_' . $action;
	}
}

if ( ! function_exists( 'plugins_url' ) ) {
	function plugins_url( $path, $plugin ) { // phpcs:ignore
		unset( $plugin );
		return 'https://example.test/wp-content/plugins/flowbie-wp/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ) { // phpcs:ignore
		return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
	}
}

if ( ! function_exists( 'do_action' ) ) {
	function do_action( $hook ) { // phpcs:ignore
		unset( $hook );
	}
}

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) { // phpcs:ignore
		unset( $domain );
		return $text;
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $maybeint ) { // phpcs:ignore
		return abs( (int) $maybeint );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) { // phpcs:ignore
		$parts = parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return false;
		}
		if ( -1 === $component ) {
			return $parts;
		}
		$map = array(
			PHP_URL_SCHEME   => 'scheme',
			PHP_URL_HOST     => 'host',
			PHP_URL_PORT     => 'port',
			PHP_URL_USER     => 'user',
			PHP_URL_PASS     => 'pass',
			PHP_URL_PATH     => 'path',
			PHP_URL_QUERY    => 'query',
			PHP_URL_FRAGMENT => 'fragment',
		);
		$key = $map[ $component ] ?? null;
		return ( $key && isset( $parts[ $key ] ) ) ? $parts[ $key ] : null;
	}
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-script-manager-rules.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-field-registry.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer.php';

$overseer_ref = new ReflectionClass( Flowbie_Wp_Overseer::class );
$overseer_load = $overseer_ref->getMethod( 'load_dependencies' );
$overseer_load->setAccessible( true );
$overseer_load->invoke( null );

if ( ! isset( $GLOBALS['wpdb'] ) ) {
	$GLOBALS['wpdb'] = new class() {
		public $prefix = 'wp_';

		public function prepare( $query, ...$args ) { // phpcs:ignore
			unset( $args );
			return $query;
		}

		public function get_row( $query ) { // phpcs:ignore
			unset( $query );
			return (object) array(
				'sessions'          => 0,
				'pageviews'         => 0,
				'page_exits'        => 0,
				'clicks'            => 0,
				'form_submits'      => 0,
				'conversions'       => 0,
				'avg_page_load_ms'  => 0,
				'avg_scroll_pct'    => 0,
				'avg_duration_ms'   => 0,
				'avg_active_ms'     => 0,
				'total_sessions'    => 0,
				'bounce_sessions'   => 0,
				'avg_session_sec'   => 0,
			);
		}

		public function get_var( $query ) { // phpcs:ignore
			unset( $query );
			return '0';
		}

		public function get_results( $query ) { // phpcs:ignore
			unset( $query );
			return array();
		}
	};
}

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-conversions.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-overseer-csv.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg Message.
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

assert_true(
	Flowbie_Wp_Overseer::is_valid_session_id( 'ovsess_1234567890_abcdef12' ),
	'session id pattern accepts valid id'
);
assert_true(
	! Flowbie_Wp_Overseer::is_valid_session_id( 'invalid' ),
	'session id pattern rejects invalid id'
);

assert_true(
	'/contact/' === Flowbie_Wp_Overseer::normalize_path_url( 'https://example.test/contact/?utm_source=x' ),
	'normalize_path_url strips query and host'
);
assert_true(
	'/' === Flowbie_Wp_Overseer::normalize_path_url( '' ),
	'normalize_path_url returns root path for empty url'
);

assert_true(
	'192.168.1.0' === Flowbie_Wp_Overseer::anonymize_ip( '192.168.1.42' ),
	'ipv4 anonymize zeros last octet'
);

assert_true(
	'mobile' === Flowbie_Wp_Overseer::detect_device( 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' ),
	'mobile user agent detected'
);
assert_true(
	'desktop' === Flowbie_Wp_Overseer::detect_device( 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' ),
	'desktop user agent detected'
);

$template = Flowbie_Wp_Overseer::builtin_script_template();
assert_true(
	! Flowbie_Wp_Overseer::is_stub_script_code( $template ),
	'builtin template includes script tags'
);
assert_true(
	strpos( $template, '<script' ) !== false,
	'builtin template has script tags'
);
assert_true(
	strpos( $template, '%%FLOWBIE_OVERSEER_CONFIG%%' ) !== false,
	'builtin template includes config placeholder'
);
assert_true(
	strpos( $template, '%%FLOWBIE_OVERSEER_JS_URL%%' ) !== false,
	'builtin template includes js url placeholder'
);

$resolved = Flowbie_Wp_Overseer::resolve_script_placeholders( $template );
assert_true(
	strpos( $resolved, '%%FLOWBIE_OVERSEER_' ) === false,
	'resolved template replaces all placeholders'
);
assert_true(
	strpos( $resolved, 'flowbie-overseer.js' ) !== false,
	'resolved template includes beacon js url'
);
assert_true(
	strpos( $resolved, 'flowbie/v1/overseer/collect' ) !== false,
	'resolved template includes collect endpoint'
);

assert_true(
	Flowbie_Wp_Overseer::is_stub_script_code( "<!-- Flowbie Page View Tag (Overseer) -->\n" ),
	'legacy comment-only stub is detected'
);
assert_true(
	Flowbie_Wp_Overseer::needs_builtin_script_resync( "<!-- Flowbie Page View Tag (Overseer) -->\n" ),
	'legacy comment-only stub triggers resync'
);

$json = Flowbie_Wp_Overseer::beacon_config_json();
assert_true(
	strpos( $json, 'flowbie/v1/overseer/collect' ) !== false,
	'beacon config json includes endpoint'
);
assert_true(
	strpos( $json, '</script>' ) === false,
	'beacon config json escapes script close sequences'
);

$config = Flowbie_Wp_Overseer::beacon_config();
assert_true(
	! empty( $config['endpoint'] ) && ! empty( $config['nonce'] ),
	'beacon config has endpoint and nonce'
);
assert_true(
	array_key_exists( 'track_interactions', $config ),
	'beacon config exposes track_interactions'
);

$settings = Flowbie_Wp_Overseer::get_settings();
assert_true(
	empty( $settings['tracking_enabled'] ) && 90 === (int) $settings['retention_days'],
	'default settings keep tracking off until enabled in admin'
);
assert_true(
	! empty( $settings['track_interactions'] ),
	'default settings include interaction tracking'
);

assert_true(
	in_array( 'page_exit', Flowbie_Wp_Overseer::ALLOWED_EVENT_TYPES, true ),
	'page_exit is an allowed event type'
);
assert_true(
	in_array( 'page_heartbeat', Flowbie_Wp_Overseer::ALLOWED_EVENT_TYPES, true ),
	'page_heartbeat is an allowed event type'
);

$summary = Flowbie_Wp_Overseer::aggregate_summary( '2099-01-01', '2099-01-02' );
assert_true(
	is_array( $summary )
	&& array_key_exists( 'sessions', $summary )
	&& array_key_exists( 'avg_time_on_page_sec', $summary )
	&& array_key_exists( 'bounce_rate_pct', $summary )
	&& array_key_exists( 'conversions', $summary )
	&& 0 === (int) $summary['sessions'],
	'aggregate_summary returns expected shape with zero data'
);

assert_true(
	in_array( 'conversion', Flowbie_Wp_Overseer::ALLOWED_EVENT_TYPES, true ),
	'conversion is an allowed event type'
);

$sample_form = array(
	'ID'     => 42,
	'fields' => array(
		array(
			'id'    => 'fld_email1',
			'type'  => 'email',
			'name'  => 'email',
			'label' => 'Email',
		),
		array(
			'id'    => 'fld_phone1',
			'type'  => 'phone',
			'name'  => 'phone',
			'label' => 'Phone',
		),
		array(
			'id'    => 'fld_name1',
			'type'  => 'name',
			'name'  => 'name',
			'label' => 'Name',
			'name_subfields' => array(
				'first' => true,
				'last'  => true,
			),
		),
	),
);

$email_only_meta = array(
	'email' => 'user@example.com',
);
$email_phone_meta = array(
	'email' => 'user@example.com',
	'phone' => '555-1234',
);
$name_meta = array(
	'name' => array(
		'first' => 'Ada',
		'last'  => '',
	),
);

$email_ctx = Flowbie_Wp_Overseer_Conversions::build_field_context( $sample_form, $email_only_meta );
$both_ctx  = Flowbie_Wp_Overseer_Conversions::build_field_context( $sample_form, $email_phone_meta );
$name_ctx  = Flowbie_Wp_Overseer_Conversions::build_field_context( $sample_form, $name_meta );

assert_true(
	! empty( $email_ctx['field_signals']['email'] )
	&& empty( $email_ctx['field_signals']['phone'] ),
	'build_field_context marks email without phone'
);
assert_true(
	! empty( $both_ctx['field_signals']['email'] )
	&& ! empty( $both_ctx['field_signals']['phone'] ),
	'build_field_context marks email and phone when both submitted'
);
assert_true(
	! empty( $name_ctx['field_signals']['name'] ),
	'build_field_context detects compound name field'
);

$goal = array(
	'id'           => 'cv_testgoal01',
	'name'         => 'Lead',
	'enabled'      => true,
	'trigger_type' => 'form_success',
	'form_id'      => 42,
	'match_mode'   => 'all',
	'rules'        => array(
		array(
			'type'  => 'field_type',
			'value' => 'email',
		),
		array(
			'type'  => 'field_type',
			'value' => 'phone',
		),
	),
);

assert_true(
	! Flowbie_Wp_Overseer_Conversions::goal_matches_submission( $goal, $sample_form, $email_ctx ),
	'goal requiring email and phone rejects email-only submission'
);
assert_true(
	Flowbie_Wp_Overseer_Conversions::goal_matches_submission( $goal, $sample_form, $both_ctx ),
	'goal requiring email and phone accepts both fields'
);

$any_submit_goal = array(
	'id'           => 'cv_anysubmit1',
	'name'         => 'Any submit',
	'enabled'      => true,
	'trigger_type' => 'form_success',
	'form_id'      => 42,
	'match_mode'   => 'all',
	'rules'        => array(),
);
assert_true(
	Flowbie_Wp_Overseer_Conversions::goal_matches_submission( $any_submit_goal, $sample_form, $email_ctx ),
	'form_success goal with no field rules matches any successful submit'
);

$click_ctx = array(
	'page_url'     => 'https://example.test/contact/',
	'element_text' => 'Call now',
	'element_href' => 'tel:5551234',
);
$click_goal = array(
	'id'           => 'cv_clickgoal1',
	'name'         => 'Phone click',
	'enabled'      => true,
	'trigger_type' => 'click',
	'form_id'      => 0,
	'match_mode'   => 'all',
	'rules'        => array(
		array(
			'type'  => 'href_contains',
			'value' => 'tel:',
		),
	),
);
assert_true(
	Flowbie_Wp_Overseer_Conversions::goal_matches_interaction( $click_goal, $click_ctx ),
	'click goal matches tel: href filter'
);
assert_true(
	! Flowbie_Wp_Overseer_Conversions::goal_matches_interaction(
		$click_goal,
		array_merge( $click_ctx, array( 'element_href' => 'mailto:test@example.com' ) )
	),
	'click goal rejects non-matching href'
);

assert_true(
	'form_success' === Flowbie_Wp_Overseer_Conversions::get_trigger_type( $goal ),
	'get_trigger_type returns stored trigger or defaults to form_success'
);

$conversion_meta = Flowbie_Wp_Overseer::sanitize_client_meta(
	array(
		'conversion_goal_id' => 'cv_testgoal01',
		'conversion_name'    => 'Lead',
		'trigger_type'       => 'form_success',
		'form_id'            => 42,
		'entry_id'           => 9,
		'field_signals'      => array(
			'email' => true,
			'phone' => true,
		),
		'matched_field_ids'  => array( 'fld_email1', 'fld_phone1' ),
	),
	'conversion'
);
assert_true(
	'cv_testgoal01' === $conversion_meta['conversion_goal_id']
	&& true === $conversion_meta['field_signals']['email']
	&& 42 === (int) $conversion_meta['form_id']
	&& ! isset( $conversion_meta['email'] ),
	'sanitize_client_meta stores conversion signals without field values'
);

$eng_map = Flowbie_Wp_Overseer::build_engagement_map_from_events(
	array(
		(object) array(
			'event_type'         => 'page_exit',
			'parent_visit_uid'   => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
			'duration_ms'        => 5000,
			'active_duration_ms' => 3000,
			'scroll_depth_pct'   => 50,
		),
		(object) array(
			'event_type'         => 'page_heartbeat',
			'parent_visit_uid'   => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
			'duration_ms'        => 8000,
			'active_duration_ms' => 4000,
			'scroll_depth_pct'   => 60,
		),
	)
);
assert_true(
	isset( $eng_map['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] )
	&& 8000 === $eng_map['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']['duration_ms']
	&& 4000 === $eng_map['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']['active_duration_ms']
	&& 60 === $eng_map['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']['scroll_depth_pct'],
	'build_engagement_map_from_events keeps max duration active scroll'
);

assert_true(
	strpos( Flowbie_Wp_Overseer_Csv::HEADER, 'active_duration_ms' ) !== false
	&& strpos( Flowbie_Wp_Overseer_Csv::HEADER, 'page_load_ms' ) !== false,
	'csv header includes new metric columns'
);

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll overseer smoke tests passed.\n";
exit( $failed > 0 ? 1 : 0 );

<?php
/**
 * Speed module bootstrap (Autoptimize-style asset optimization).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Front-end optimization and REST/admin integration.
 */
class Neo_Pulse_Wp_Speed {

	const REST_NAMESPACE = 'neo-pulse/v1';

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_migrate_speed_settings' ), 15 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_start_buffer' ), 0 );
		add_action( 'send_headers', array( __CLASS__, 'maybe_send_speed_cache_headers' ) );
		add_action( 'wp_footer', array( 'Neo_Pulse_Wp_Speed_Diagnostics', 'maybe_print_footer_marker' ), 9999 );
		add_action( 'save_post', array( __CLASS__, 'flush_cache_on_content_change' ), 20 );
		add_action( 'deleted_post', array( __CLASS__, 'flush_cache_on_content_change' ), 20 );
		add_action( 'switch_theme', array( __CLASS__, 'flush_cache' ) );
		add_action( 'customize_save_after', array( __CLASS__, 'flush_cache' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * @return bool Whether the speed module is active and optimizing.
	 */
	public static function is_active(): bool {
		return Neo_Pulse_Wp_Speed_Settings::is_enabled();
	}

	public static function maybe_migrate_speed_settings(): void {
		Neo_Pulse_Wp_Speed_Settings::maybe_migrate_elementor_safe_defaults();
		Neo_Pulse_Wp_Speed_Settings::maybe_migrate_elementor_safe_defaults_v2();
		Neo_Pulse_Wp_Speed_Settings::maybe_repair_simple_enabled_config();
		Neo_Pulse_Wp_Speed_Settings::maybe_repair_simple_enabled_config_v2();
		Neo_Pulse_Wp_Speed_Settings::maybe_repair_simple_enabled_config_v3();
		Neo_Pulse_Wp_Speed_Settings::maybe_enable_speed_by_default();
		if ( Neo_Pulse_Wp_Speed_Settings::is_enabled() ) {
			Neo_Pulse_Wp_Speed_Warm::maybe_auto_warm();
		}
	}

	public static function maybe_start_buffer(): void {
		Neo_Pulse_Wp_Speed_Buffer::maybe_start();
	}

	/**
	 * Long-cache headers for minified assets served from wp-content/cache/neo-pulse-speed/.
	 */
	public static function maybe_send_speed_cache_headers(): void {
		if ( is_admin() || headers_sent() ) {
			return;
		}
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( $uri === '' || strpos( $uri, '/cache/neo-pulse-speed/' ) === false ) {
			return;
		}
		if ( ! preg_match( '#/cache/neo-pulse-speed/(css|js)/[a-f0-9]+\.(css|js)$#i', $uri ) ) {
			return;
		}
		header( 'Cache-Control: public, max-age=31536000, immutable', true );
	}

	public static function flush_cache(): void {
		Neo_Pulse_Wp_Speed_Cache::flush_all();
	}

	/**
	 * Full NEO Pulse + WordPress flush (no host / WP Engine API).
	 *
	 * @return array<string, mixed>
	 */
	public static function flush_all_wordpress(): array {
		if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
			return Neo_Pulse_Wp_Cache_Flush::flush_all();
		}
		self::flush_cache();
		return array( 'speed_files' => 0 );
	}

	public static function flush_cache_on_content_change(): void {
		if ( ! self::is_active() ) {
			return;
		}
		self::flush_cache();
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/speed/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_status' ),
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/speed/flush',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_flush' ),
				'permission_callback' => static function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_status( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );
		$config  = Neo_Pulse_Wp_Speed_Settings::get_config();
		$stats   = Neo_Pulse_Wp_Speed_Cache::stats();
		$conflicts = Neo_Pulse_Wp_Speed_Settings::conflicting_plugins();

		return new WP_REST_Response(
			array(
				'ok'        => true,
				'enabled'   => ! empty( $config['enabled'] ),
				'config'    => $config,
				'cache'     => $stats,
				'conflicts' => $conflicts,
			),
			200
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function rest_flush( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );
		$summary = self::flush_all_wordpress();
		return new WP_REST_Response(
			array(
				'ok'      => true,
				'message' => __( 'WordPress + NEO Pulse caches flushed.', 'neo-pulse-wp' ),
				'cache'   => Neo_Pulse_Wp_Speed_Cache::stats(),
				'summary' => $summary,
			),
			200
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function tool_status_payload(): array {
		$res = self::rest_status( new WP_REST_Request( 'GET', '/neo-pulse/v1/speed/status' ) );
		return $res->get_data();
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function tool_flush_payload(): array {
		$res = self::rest_flush( new WP_REST_Request( 'POST', '/neo-pulse/v1/speed/flush' ) );
		return $res->get_data();
	}
}

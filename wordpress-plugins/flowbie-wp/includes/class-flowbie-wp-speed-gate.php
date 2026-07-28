<?php
/**
 * Speed module request gate — when to run optimization.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Decides whether front-end output buffering should run.
 */
class Flowbie_Wp_Speed_Gate {

	const MAX_BUFFER_BYTES = 5242880;

	/**
	 * @return bool
	 */
	public static function should_optimize(): bool {
		if ( ! Flowbie_Wp_Speed_Settings::is_enabled() ) {
			return false;
		}

		if ( class_exists( 'Flowbie_Wp_Speed_Warm', false ) && Flowbie_Wp_Speed_Warm::is_warm_request() ) {
			return self::config_has_active_transforms( Flowbie_Wp_Speed_Settings::get_config() );
		}

		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return false;
		}

		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return false;
		}

		if ( is_feed() || is_trackback() || is_robots() ) {
			return false;
		}

		if ( is_preview() || is_customize_preview() ) {
			return false;
		}

		if ( isset( $_GET['nocache'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}

		$config = Flowbie_Wp_Speed_Settings::get_config();
		if ( ! empty( $config['skip_logged_in'] ) && is_user_logged_in() ) {
			return false;
		}

		if ( ! self::config_has_active_transforms( $config ) ) {
			return false;
		}

		if ( ! empty( $config['bypass_elementor'] ) && self::is_elementor_built_page() ) {
			return false;
		}

		if ( self::is_woocommerce_sensitive() ) {
			return false;
		}

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return false;
		}

		$should = true;
		return (bool) apply_filters( 'flowbie_wp_speed_should_optimize', $should );
	}

	/**
	 * @return bool
	 */
	private static function is_woocommerce_sensitive(): bool {
		if ( ! class_exists( 'WooCommerce', false ) ) {
			return false;
		}
		if ( function_exists( 'is_cart' ) && is_cart() ) {
			return true;
		}
		if ( function_exists( 'is_checkout' ) && is_checkout() ) {
			return true;
		}
		if ( function_exists( 'is_account_page' ) && is_account_page() ) {
			return true;
		}
		return false;
	}

	/**
	 * Whether any Speed setting would change HTML output.
	 *
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function config_has_active_transforms( array $config ): bool {
		if ( ! empty( $config['optimize_css'] ) ) {
			return true;
		}
		if ( ! empty( $config['optimize_js'] ) ) {
			return true;
		}
		if ( ! empty( $config['minify_html'] ) ) {
			return true;
		}
		if ( ! empty( $config['remove_query_strings'] ) ) {
			return true;
		}
		if ( ! empty( $config['font_display_swap'] ) ) {
			return true;
		}
		if ( ! empty( $config['preconnect_fonts'] ) ) {
			return true;
		}
		if ( ! empty( $config['async_google_fonts'] ) ) {
			return true;
		}
		if ( ! empty( $config['defer_js'] ) && ! empty( $config['optimize_js'] ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Whether buffered HTML was built with Elementor (page builder output).
	 *
	 * @param string $html Buffered HTML.
	 */
	public static function html_uses_elementor( string $html ): bool {
		if ( $html === '' ) {
			return false;
		}
		if ( stripos( $html, 'elementor-page' ) !== false ) {
			return true;
		}
		if ( stripos( $html, 'data-elementor-type' ) !== false ) {
			return true;
		}
		if ( stripos( $html, 'elementor-frontend' ) !== false ) {
			return true;
		}
		return (bool) apply_filters( 'flowbie_wp_speed_html_uses_elementor', false, $html );
	}

	/**
	 * Disable aggregate/defer on Elementor pages; per-file minify remains allowed.
	 *
	 * @param array<string, mixed> $config Speed settings.
	 * @param string               $html   Buffered HTML.
	 * @return array<string, mixed>
	 */
	public static function config_for_html( array $config, string $html ): array {
		if ( ! self::html_uses_elementor( $html ) ) {
			return $config;
		}
		// Keep per-file CSS/JS minify; disable combine/defer/HTML minify on builder output.
		$config['minify_html']          = false;
		$config['aggregate_css']        = false;
		$config['aggregate_js']         = false;
		$config['defer_js']             = false;
		$config['remove_query_strings'] = false;
		return apply_filters( 'flowbie_wp_speed_elementor_config', $config, $html );
	}

	/**
	 * Whether the main query is for a page/post built with Elementor.
	 */
	public static function is_elementor_built_page(): bool {
		if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
			return false;
		}

		$post_id = 0;
		if ( is_singular() ) {
			$post_id = (int) get_queried_object_id();
		} elseif ( is_front_page() && get_option( 'show_on_front' ) === 'page' ) {
			$post_id = (int) get_option( 'page_on_front' );
		}

		if ( $post_id > 0 && 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ) ) {
			return true;
		}

		return (bool) apply_filters( 'flowbie_wp_speed_is_elementor_page', false, $post_id );
	}

	/**
	 * @param string $html Buffered HTML.
	 * @return bool
	 */
	public static function is_valid_html_document( string $html ): bool {
		$html = ltrim( $html );
		if ( $html === '' ) {
			return false;
		}
		if ( strlen( $html ) > self::MAX_BUFFER_BYTES ) {
			return false;
		}
		if ( stripos( $html, '<html' ) === false && stripos( $html, '<!DOCTYPE' ) === false ) {
			return false;
		}
		return true;
	}
}

<?php
/**
 * Flowbie FAQ bootstrap.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Faq {

	public static function init(): void {
		self::load_dependencies();
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_frontend_assets' ) );
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/faq/integrations/class-flowbie-wp-faq-elementor.php';
		Flowbie_Wp_Faq_Elementor::init();
	}

	private static function load_dependencies(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/faq/class-flowbie-wp-faq-parser.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/faq/class-flowbie-wp-faq-schema.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/faq/class-flowbie-wp-faq-renderer.php';
	}

	/**
	 * Render a FAQ instance (Elementor widget or programmatic).
	 *
	 * @param array<string,mixed> $args Instance settings.
	 * @return string
	 */
	public static function render_instance( array $args ): string {
		return Flowbie_Wp_Faq_Renderer::render_instance( $args );
	}

	public static function register_frontend_assets(): void {
		$base = 'assets/frontend/';
		$css  = FLOWBIE_WP_PLUGIN_DIR . $base . 'flowbie-faq.css';
		$js   = FLOWBIE_WP_PLUGIN_DIR . $base . 'flowbie-faq.js';
		$ver  = FLOWBIE_WP_VERSION;
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		wp_register_style(
			'flowbie-faq',
			plugins_url( $base . 'flowbie-faq.css', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			$ver
		);
		$js_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $js ) ) {
			$js_ver .= '.' . (string) filemtime( $js );
		}
		wp_register_script(
			'flowbie-faq',
			plugins_url( $base . 'flowbie-faq.js', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			$js_ver,
			true
		);
	}

	public static function enqueue_frontend_assets(): void {
		self::register_frontend_assets();
		wp_enqueue_style( 'flowbie-faq' );
		wp_enqueue_script( 'flowbie-faq' );
	}
}

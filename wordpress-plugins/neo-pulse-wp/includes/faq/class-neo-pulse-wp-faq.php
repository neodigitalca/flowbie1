<?php
/**
 * NEO Pulse FAQ bootstrap.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Faq {

	public static function init(): void {
		self::load_dependencies();
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_frontend_assets' ) );
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/integrations/class-neo-pulse-wp-faq-elementor.php';
		Neo_Pulse_Wp_Faq_Elementor::init();
	}

	private static function load_dependencies(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/class-neo-pulse-wp-faq-parser.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/class-neo-pulse-wp-faq-schema.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/class-neo-pulse-wp-faq-renderer.php';
	}

	/**
	 * Render a FAQ instance (Elementor widget or programmatic).
	 *
	 * @param array<string,mixed> $args Instance settings.
	 * @return string
	 */
	public static function render_instance( array $args ): string {
		return Neo_Pulse_Wp_Faq_Renderer::render_instance( $args );
	}

	public static function register_frontend_assets(): void {
		$base = 'assets/frontend/';
		$css  = NEO_PULSE_WP_PLUGIN_DIR . $base . 'neo-pulse-faq.css';
		$js   = NEO_PULSE_WP_PLUGIN_DIR . $base . 'neo-pulse-faq.js';
		$ver  = NEO_PULSE_WP_VERSION;
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		wp_register_style(
			'neo-pulse-faq',
			plugins_url( $base . 'neo-pulse-faq.css', NEO_PULSE_WP_PLUGIN_FILE ),
			array(),
			$ver
		);
		$js_ver = NEO_PULSE_WP_VERSION;
		if ( is_readable( $js ) ) {
			$js_ver .= '.' . (string) filemtime( $js );
		}
		wp_register_script(
			'neo-pulse-faq',
			plugins_url( $base . 'neo-pulse-faq.js', NEO_PULSE_WP_PLUGIN_FILE ),
			array(),
			$js_ver,
			true
		);
	}

	public static function enqueue_frontend_assets(): void {
		self::register_frontend_assets();
		wp_enqueue_style( 'neo-pulse-faq' );
		wp_enqueue_script( 'neo-pulse-faq' );
	}
}

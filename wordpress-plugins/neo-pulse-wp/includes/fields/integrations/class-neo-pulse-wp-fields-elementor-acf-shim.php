<?php
/**
 * Legacy Elementor ACF dynamic tag shims (when ACF Pro is inactive).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim {

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		if ( Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return;
		}
		add_action( 'elementor/loaded', array( __CLASS__, 'boot' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'boot' ), 120 );
	}

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		if ( ! class_exists( '\Elementor\Plugin', false ) ) {
			return;
		}
		if ( ! class_exists( '\Elementor\Modules\DynamicTags\Module', false ) ) {
			return;
		}
		add_action( 'elementor/dynamic_tags/register', array( __CLASS__, 'register_tags' ), 5 );
		self::$booted = true;
	}

	public static function register_tags( $dynamic_tags_manager ): void {
		if ( Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return;
		}

		if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-shim-tags.php';
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-registry.php';

		$dynamic_tags_manager->register_group(
			'acf',
			array(
				'title' => esc_html__( 'ACF', 'neo-pulse-wp' ),
			)
		);

		$tags = array(
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text(),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-number' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-color' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-date-time' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-field' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text( 'post-custom-field' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Url(),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Url( 'acf-file' ),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Image(),
			new Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Gallery(),
		);

		foreach ( $tags as $tag ) {
			$dynamic_tags_manager->register( $tag );
		}
	}
}

<?php
/**
 * Elementor widget integration for NEO Pulse FAQ.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Faq_Elementor {

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		add_action( 'elementor/loaded', array( __CLASS__, 'boot' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'boot' ), 120 );
	}

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		if ( ! did_action( 'elementor/loaded' ) && ! defined( 'ELEMENTOR_VERSION' ) ) {
			return;
		}

		add_action( 'elementor/elements/categories_registered', array( __CLASS__, 'register_category' ) );
		add_action( 'elementor/widgets/register', array( __CLASS__, 'register_widgets' ) );
		add_action( 'elementor/preview/enqueue_scripts', array( __CLASS__, 'enqueue_preview_assets' ) );
		add_action( 'elementor/editor/after_enqueue_scripts', array( __CLASS__, 'enqueue_preview_assets' ) );
		self::$booted = true;
	}

	/**
	 * @param \Elementor\Elements_Manager $elements_manager
	 */
	public static function register_category( $elements_manager ): void {
		if ( ! method_exists( $elements_manager, 'add_category' ) ) {
			return;
		}
		$elements_manager->add_category(
			'neo-pulse',
			array(
				'title' => esc_html__( 'NEO Pulse', 'neo-pulse-wp' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}

	/**
	 * @param \Elementor\Widgets_Manager $widgets_manager
	 */
	public static function register_widgets( $widgets_manager ): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/integrations/class-neo-pulse-wp-faq-elementor-widget.php';
		$widgets_manager->register( new Neo_Pulse_Wp_Faq_Elementor_Widget() );
	}

	public static function enqueue_preview_assets(): void {
		Neo_Pulse_Wp_Faq::enqueue_frontend_assets();
	}
}

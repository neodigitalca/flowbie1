<?php
/**
 * Elementor integration for NEO Pulse SEO blocks.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Seo_Blocks_Elementor {

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

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-sync.php';
		Neo_Pulse_Wp_Seo_Blocks_Sync::init();

		add_action( 'elementor/elements/categories_registered', array( __CLASS__, 'register_category' ) );
		add_action( 'elementor/widgets/register', array( __CLASS__, 'register_widgets' ) );
		add_action( 'elementor/frontend/after_register_styles', array( __CLASS__, 'register_frontend_styles' ) );
		add_action( 'elementor/editor/after_enqueue_scripts', array( __CLASS__, 'enqueue_editor_assets' ) );
		add_action( 'elementor/preview/enqueue_scripts', array( __CLASS__, 'enqueue_editor_assets' ) );

		self::$booted = true;
	}

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
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/class-neo-pulse-wp-seo-blocks-elementor-widget.php';
		$widgets_manager->register( new Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget() );
	}

	public static function register_frontend_styles(): void {
		$css_path = NEO_PULSE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_register_style(
			'neo-pulse-seo-block',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : NEO_PULSE_WP_VERSION
		);
	}

	public static function enqueue_editor_assets(): void {
		$css_path = NEO_PULSE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_enqueue_style(
			'neo-pulse-seo-block',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : NEO_PULSE_WP_VERSION
		);
		wp_enqueue_style(
			'neo-pulse-seo-block-editor',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-editor.css',
			array(),
			NEO_PULSE_WP_VERSION
		);
		wp_enqueue_style(
			'neo-pulse-wp-ai-components',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/editor/neo-pulse-ai-components.css',
			array(),
			NEO_PULSE_WP_VERSION
		);
		$editor_js = NEO_PULSE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-editor.js';
		wp_enqueue_script(
			'neo-pulse-seo-block-editor',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-editor.js',
			array( 'jquery', 'elementor-editor' ),
			file_exists( $editor_js ) ? (string) filemtime( $editor_js ) : NEO_PULSE_WP_VERSION,
			true
		);
		wp_localize_script(
			'neo-pulse-seo-block-editor',
			'NeoPulseSeoBlockEditor',
			array(
				'restRoot'  => esc_url_raw( rest_url( 'neo-pulse/v1/' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'hubUrl'    => admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' ),
				'i18n'      => array(
					'optimizeFull'   => __( 'Full optimize', 'neo-pulse-wp' ),
					'optimizeIntent' => __( 'Align intent', 'neo-pulse-wp' ),
					'previewTitle'   => __( 'SEO block preview', 'neo-pulse-wp' ),
					'apply'          => __( 'Apply', 'neo-pulse-wp' ),
					'cancel'         => __( 'Cancel', 'neo-pulse-wp' ),
					'loading'        => __( 'Generating…', 'neo-pulse-wp' ),
					'error'          => __( 'Optimization failed.', 'neo-pulse-wp' ),
					'selectBlock'    => __( 'Select a block from the Agent Hub table first.', 'neo-pulse-wp' ),
					'focusKeyword'   => __( 'Focus keyword', 'neo-pulse-wp' ),
					'h2'             => __( 'H2', 'neo-pulse-wp' ),
					'slots'          => __( 'Slots', 'neo-pulse-wp' ),
				),
			)
		);
	}
}

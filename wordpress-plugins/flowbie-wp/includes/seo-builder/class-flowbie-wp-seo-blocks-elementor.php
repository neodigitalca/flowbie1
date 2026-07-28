<?php
/**
 * Elementor integration for Flowbie SEO blocks.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Seo_Blocks_Elementor {

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

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-sync.php';
		Flowbie_Wp_Seo_Blocks_Sync::init();

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
			'flowbie',
			array(
				'title' => esc_html__( 'Flowbie', 'flowbie-wp' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}

	/**
	 * @param \Elementor\Widgets_Manager $widgets_manager
	 */
	public static function register_widgets( $widgets_manager ): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-elementor-widget.php';
		$widgets_manager->register( new Flowbie_Wp_Seo_Blocks_Elementor_Widget() );
	}

	public static function register_frontend_styles(): void {
		$css_path = FLOWBIE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_register_style(
			'flowbie-seo-block',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : FLOWBIE_WP_VERSION
		);
	}

	public static function enqueue_editor_assets(): void {
		$css_path = FLOWBIE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_enqueue_style(
			'flowbie-seo-block',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : FLOWBIE_WP_VERSION
		);
		wp_enqueue_style(
			'flowbie-seo-block-editor',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-editor.css',
			array(),
			FLOWBIE_WP_VERSION
		);
		wp_enqueue_style(
			'flowbie-wp-ai-components',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/editor/flowbie-ai-components.css',
			array(),
			FLOWBIE_WP_VERSION
		);
		$editor_js = FLOWBIE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-editor.js';
		wp_enqueue_script(
			'flowbie-seo-block-editor',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-editor.js',
			array( 'jquery', 'elementor-editor' ),
			file_exists( $editor_js ) ? (string) filemtime( $editor_js ) : FLOWBIE_WP_VERSION,
			true
		);
		wp_localize_script(
			'flowbie-seo-block-editor',
			'FlowbieSeoBlockEditor',
			array(
				'restRoot'  => esc_url_raw( rest_url( 'flowbie/v1/' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'hubUrl'    => admin_url( 'admin.php?page=flowbie-wp-agent-hub' ),
				'i18n'      => array(
					'optimizeFull'   => __( 'Full optimize', 'flowbie-wp' ),
					'optimizeIntent' => __( 'Align intent', 'flowbie-wp' ),
					'previewTitle'   => __( 'SEO block preview', 'flowbie-wp' ),
					'apply'          => __( 'Apply', 'flowbie-wp' ),
					'cancel'         => __( 'Cancel', 'flowbie-wp' ),
					'loading'        => __( 'Generating…', 'flowbie-wp' ),
					'error'          => __( 'Optimization failed.', 'flowbie-wp' ),
					'selectBlock'    => __( 'Select a block from the Agent Hub table first.', 'flowbie-wp' ),
					'focusKeyword'   => __( 'Focus keyword', 'flowbie-wp' ),
					'h2'             => __( 'H2', 'flowbie-wp' ),
					'slots'          => __( 'Slots', 'flowbie-wp' ),
				),
			)
		);
	}
}

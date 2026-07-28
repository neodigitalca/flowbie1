<?php
/**
 * Flowbie Forms bootstrap (Gravity Forms–style, local-only).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms {

	public static function init(): void {
		self::load_dependencies();
		add_action( 'init', array( __CLASS__, 'register_storage' ), 5 );
		add_action( 'plugins_loaded', array( 'Flowbie_Wp_Forms_Entries', 'maybe_install' ), 20 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_frontend_assets' ) );
		add_shortcode( 'flowbie_form', array( __CLASS__, 'render_shortcode' ) );
		Flowbie_Wp_Forms_Rest::init();

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/integrations/class-flowbie-wp-forms-elementor.php';
		Flowbie_Wp_Forms_Elementor::init();
	}

	private static function load_dependencies(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-field-registry.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-storage.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-entries.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-entries-csv.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-validator.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-notifications.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-submit.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-renderer.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/class-flowbie-wp-forms-rest.php';
	}

	public static function register_storage(): void {
		Flowbie_Wp_Forms_Storage::register_post_types();
	}

	public static function install(): void {
		self::load_dependencies();
		Flowbie_Wp_Forms_Entries::install();
	}

	/**
	 * @param array<string, string>|string $atts Shortcode attributes.
	 */
	public static function render_shortcode( $atts ): string {
		$atts = shortcode_atts(
			array(
				'id' => '0',
			),
			is_array( $atts ) ? $atts : array(),
			'flowbie_form'
		);
		$form_id = (int) $atts['id'];
		if ( $form_id < 1 ) {
			return '';
		}
		return self::render_instance(
			array(
				'form_id' => $form_id,
			)
		);
	}

	/**
	 * Render a form instance (shortcode, Elementor widget, or programmatic).
	 *
	 * @param array<string,mixed> $args form_id|linked_form_id|form, plus instance/style overrides.
	 * @return string
	 */
	public static function render_instance( array $args ): string {
		$form_id = 0;
		if ( ! empty( $args['form_id'] ) ) {
			$form_id = (int) $args['form_id'];
		} elseif ( ! empty( $args['linked_form_id'] ) ) {
			$form_id = (int) $args['linked_form_id'];
		}

		$form = null;
		if ( $form_id > 0 ) {
			$form = Flowbie_Wp_Forms_Storage::get_form_by_id( $form_id );
		} elseif ( ! empty( $args['form'] ) && is_array( $args['form'] ) ) {
			$form = $args['form'];
		}

		if ( ! $form ) {
			return '';
		}

		$instance = isset( $args['instance'] ) && is_array( $args['instance'] ) ? $args['instance'] : array();
		$skip     = array( 'form_id', 'linked_form_id', 'form', 'instance', 'form_source', 'form_id_select', 'form_fields', 'form_title', 'form_active' );
		foreach ( $args as $key => $value ) {
			if ( ! in_array( $key, $skip, true ) ) {
				$instance[ $key ] = $value;
			}
		}

		return Flowbie_Wp_Forms_Renderer::render( $form, $instance );
	}

	/**
	 * Register front-end form assets (for Elementor depends + lazy enqueue).
	 */
	public static function register_frontend_assets(): void {
		$base = 'assets/frontend/';
		$css  = FLOWBIE_WP_PLUGIN_DIR . $base . 'flowbie-forms.css';
		$js   = FLOWBIE_WP_PLUGIN_DIR . $base . 'flowbie-forms.js';
		$ver  = FLOWBIE_WP_VERSION;
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		wp_register_style(
			'flowbie-forms',
			plugins_url( $base . 'flowbie-forms.css', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			$ver
		);
		$js_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $js ) ) {
			$js_ver .= '.' . (string) filemtime( $js );
		}
		wp_register_script(
			'flowbie-forms',
			plugins_url( $base . 'flowbie-forms.js', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			$js_ver,
			true
		);
	}

	/**
	 * Enqueue registered front-end form assets.
	 */
	public static function enqueue_frontend_assets(): void {
		self::register_frontend_assets();
		wp_enqueue_style( 'flowbie-forms' );
		wp_enqueue_script( 'flowbie-forms' );
	}

	public static function frontend_asset_version(): string {
		$css = FLOWBIE_WP_PLUGIN_DIR . 'assets/frontend/flowbie-forms.css';
		$js  = FLOWBIE_WP_PLUGIN_DIR . 'assets/frontend/flowbie-forms.js';
		$ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		if ( is_readable( $js ) ) {
			$ver .= '.' . (string) filemtime( $js );
		}
		return $ver;
	}

	public static function enqueue_admin_assets( string $hook ): void {
		$screens = array(
			'flowbie-wp_page_flowbie-wp-forms',
			'admin_page_flowbie-wp-forms-edit',
			'flowbie-wp_page_flowbie-wp-forms-edit',
			'admin_page_flowbie-wp-forms-entries',
			'flowbie-wp_page_flowbie-wp-forms-entries',
		);
		if ( ! in_array( $hook, $screens, true ) ) {
			return;
		}
		if ( in_array( $hook, array( 'admin_page_flowbie-wp-forms-edit', 'flowbie-wp_page_flowbie-wp-forms-edit' ), true ) ) {
			$base   = 'assets/admin/';
			$js     = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-forms-builder.js';
			$js_ver = FLOWBIE_WP_VERSION;
			if ( is_readable( $js ) ) {
				$js_ver .= '.' . (string) filemtime( $js );
			}
			wp_enqueue_script( 'jquery-ui-sortable' );
			wp_enqueue_script( 'jquery-ui-draggable' );
			wp_enqueue_script(
				'flowbie-wp-admin-forms-builder',
				plugins_url( $base . 'admin-forms-builder.js', FLOWBIE_WP_PLUGIN_FILE ),
				array( 'jquery', 'jquery-ui-sortable', 'jquery-ui-draggable' ),
				$js_ver,
				true
			);
			wp_localize_script(
				'flowbie-wp-admin-forms-builder',
				'flowbieFormsBuilder',
				array(
					'fieldTypes'  => Flowbie_Wp_Forms_Field_Registry::choices(),
					'fieldGroups' => Flowbie_Wp_Forms_Field_Registry::choices_grouped(),
					'strings'     => array(
						'addFields'       => __( 'Add Fields', 'flowbie-wp' ),
						'fieldSettings' => __( 'Field Settings', 'flowbie-wp' ),
						'formSettings'    => __( 'Form Settings', 'flowbie-wp' ),
						'removeField'     => __( 'Remove', 'flowbie-wp' ),
						'dragHandle'      => __( 'Drag to reorder', 'flowbie-wp' ),
						'emptyCanvas'     => __( 'Drag fields here or click a field type from the sidebar.', 'flowbie-wp' ),
						'selectField'     => __( 'Select a field on the canvas to edit its settings.', 'flowbie-wp' ),
						'searchFields'    => __( 'Search fields…', 'flowbie-wp' ),
						'standard'        => __( 'Standard Fields', 'flowbie-wp' ),
						'advanced'        => __( 'Advanced Fields', 'flowbie-wp' ),
					),
				)
			);
		}
	}
}

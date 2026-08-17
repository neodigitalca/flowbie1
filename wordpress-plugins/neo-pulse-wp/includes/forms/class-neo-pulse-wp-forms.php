<?php
/**
 * NEO Pulse Forms bootstrap (Gravity Forms–style, local-only).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms {

	public static function init(): void {
		self::load_dependencies();
		add_action( 'init', array( __CLASS__, 'register_storage' ), 5 );
		add_action( 'plugins_loaded', array( 'Neo_Pulse_Wp_Forms_Entries', 'maybe_install' ), 20 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_frontend_assets' ) );
		add_shortcode( 'neo-pulse_form', array( __CLASS__, 'render_shortcode' ) );
		Neo_Pulse_Wp_Forms_Rest::init();

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/integrations/class-neo-pulse-wp-forms-elementor.php';
		Neo_Pulse_Wp_Forms_Elementor::init();
	}

	private static function load_dependencies(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-field-registry.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-storage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-entries.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-entries-csv.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-validator.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-notifications.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-submit.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-renderer.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/class-neo-pulse-wp-forms-rest.php';
	}

	public static function register_storage(): void {
		Neo_Pulse_Wp_Forms_Storage::register_post_types();
	}

	public static function install(): void {
		self::load_dependencies();
		Neo_Pulse_Wp_Forms_Entries::install();
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
			'neo-pulse_form'
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
			$form = Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id );
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

		return Neo_Pulse_Wp_Forms_Renderer::render( $form, $instance );
	}

	/**
	 * Register front-end form assets (for Elementor depends + lazy enqueue).
	 */
	public static function register_frontend_assets(): void {
		$base = 'assets/frontend/';
		$css  = NEO_PULSE_WP_PLUGIN_DIR . $base . 'neo-pulse-forms.css';
		$js   = NEO_PULSE_WP_PLUGIN_DIR . $base . 'neo-pulse-forms.js';
		$ver  = NEO_PULSE_WP_VERSION;
		if ( is_readable( $css ) ) {
			$ver .= '.' . (string) filemtime( $css );
		}
		wp_register_style(
			'neo-pulse-forms',
			plugins_url( $base . 'neo-pulse-forms.css', NEO_PULSE_WP_PLUGIN_FILE ),
			array(),
			$ver
		);
		$js_ver = NEO_PULSE_WP_VERSION;
		if ( is_readable( $js ) ) {
			$js_ver .= '.' . (string) filemtime( $js );
		}
		wp_register_script(
			'neo-pulse-forms',
			plugins_url( $base . 'neo-pulse-forms.js', NEO_PULSE_WP_PLUGIN_FILE ),
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
		wp_enqueue_style( 'neo-pulse-forms' );
		wp_enqueue_script( 'neo-pulse-forms' );
	}

	public static function frontend_asset_version(): string {
		$css = NEO_PULSE_WP_PLUGIN_DIR . 'assets/frontend/neo-pulse-forms.css';
		$js  = NEO_PULSE_WP_PLUGIN_DIR . 'assets/frontend/neo-pulse-forms.js';
		$ver = NEO_PULSE_WP_VERSION;
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
			'neo-pulse-wp_page_neo_pulse-wp-forms',
			'admin_page_neo_pulse-wp-forms-edit',
			'neo-pulse-wp_page_neo_pulse-wp-forms-edit',
			'admin_page_neo_pulse-wp-forms-entries',
			'neo-pulse-wp_page_neo_pulse-wp-forms-entries',
		);
		if ( ! in_array( $hook, $screens, true ) ) {
			return;
		}
		if ( in_array( $hook, array( 'admin_page_neo_pulse-wp-forms-edit', 'neo-pulse-wp_page_neo_pulse-wp-forms-edit' ), true ) ) {
			$base   = 'assets/admin/';
			$js     = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-forms-builder.js';
			$js_ver = NEO_PULSE_WP_VERSION;
			if ( is_readable( $js ) ) {
				$js_ver .= '.' . (string) filemtime( $js );
			}
			wp_enqueue_script( 'jquery-ui-sortable' );
			wp_enqueue_script( 'jquery-ui-draggable' );
			wp_enqueue_script(
				'neo-pulse-wp-admin-forms-builder',
				plugins_url( $base . 'admin-forms-builder.js', NEO_PULSE_WP_PLUGIN_FILE ),
				array( 'jquery', 'jquery-ui-sortable', 'jquery-ui-draggable' ),
				$js_ver,
				true
			);
			wp_localize_script(
				'neo-pulse-wp-admin-forms-builder',
				'neo-pulseFormsBuilder',
				array(
					'fieldTypes'  => Neo_Pulse_Wp_Forms_Field_Registry::choices(),
					'fieldGroups' => Neo_Pulse_Wp_Forms_Field_Registry::choices_grouped(),
					'strings'     => array(
						'addFields'       => __( 'Add Fields', 'neo-pulse-wp' ),
						'fieldSettings' => __( 'Field Settings', 'neo-pulse-wp' ),
						'formSettings'    => __( 'Form Settings', 'neo-pulse-wp' ),
						'removeField'     => __( 'Remove', 'neo-pulse-wp' ),
						'dragHandle'      => __( 'Drag to reorder', 'neo-pulse-wp' ),
						'emptyCanvas'     => __( 'Drag fields here or click a field type from the sidebar.', 'neo-pulse-wp' ),
						'selectField'     => __( 'Select a field on the canvas to edit its settings.', 'neo-pulse-wp' ),
						'searchFields'    => __( 'Search fields…', 'neo-pulse-wp' ),
						'standard'        => __( 'Standard Fields', 'neo-pulse-wp' ),
						'advanced'        => __( 'Advanced Fields', 'neo-pulse-wp' ),
					),
				)
			);
		}
	}
}

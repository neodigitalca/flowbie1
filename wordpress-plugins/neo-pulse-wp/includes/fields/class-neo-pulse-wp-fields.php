<?php
/**
 * NEO Pulse Fields bootstrap (ACF replacement).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields {

	const ACF_CONFLICT_NOTICE = 'neo_pulse_wp_acf_conflict_dismissed';

	public static function init(): void {
		self::load_dependencies();
		add_action( 'init', array( __CLASS__, 'register_storage' ), 5 );
		Neo_Pulse_Wp_Fields_Registry::init();
		add_action( 'plugins_loaded', array( 'Neo_Pulse_Wp_Fields_Api', 'register_functions' ), 99 );
		if ( ! self::acf_is_active() ) {
			Neo_Pulse_Wp_Fields_Meta_Box::init();
		}
		Neo_Pulse_Wp_Fields_Post_Types::init();
		Neo_Pulse_Wp_Fields_Post_Type_Caps::init();
		Neo_Pulse_Wp_Fields_Taxonomies::init();
		Neo_Pulse_Wp_Fields_Options::init();
		Neo_Pulse_Wp_Fields_Elementor::init();
		Neo_Pulse_Wp_Fields_Elementor_Acf_Shim::init();
		Neo_Pulse_Wp_Fields_Elementor_Cache_Fix::init();
		add_action( 'plugins_loaded', array( 'Neo_Pulse_Wp_Fields_Acf_Bridge', 'init' ), 50 );
		Neo_Pulse_Wp_Fields_Post_Meta_Registry::init();
		Neo_Pulse_Wp_Faq::init();
		if ( ! self::acf_is_active() ) {
			Neo_Pulse_Wp_Fields_Rest::init();
		}
		if ( is_admin() ) {
			add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_screen_assets' ) );
			add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_post_edit_assets' ) );
			add_action( 'admin_notices', array( __CLASS__, 'acf_conflict_notice' ) );
			add_action( 'admin_init', array( __CLASS__, 'maybe_dismiss_acf_notice' ) );
		}
	}

	private static function load_dependencies(): void {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/interface-neo-pulse-wp-field-type.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-field-type-base.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-local-json.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-storage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/field-types/loader.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-registry.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-location.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-conditional.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-validation.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-values.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-api.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-import-export.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-gallery-templates.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-meta-box.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-post-types.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-post-type-caps.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-taxonomies.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-options.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-rest.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-settings.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-acf-bridge.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-shim.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-cache-fix.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-elementor-site-recovery.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-post-meta-registry.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/faq/class-neo-pulse-wp-faq.php';
	}

	public static function register_storage(): void {
		Neo_Pulse_Wp_Fields_Storage::register_post_types();
	}

	public static function enqueue_admin_screen_assets( string $hook ): void {
		$screens = array(
			'neo-pulse-wp_page_neo_pulse-wp-fields',
			'admin_page_neo_pulse-wp-fields-edit',
			'neo-pulse-wp_page_neo_pulse-wp-fields-edit',
			'neo-pulse-wp_page_neo_pulse-wp-post-types',
			'admin_page_neo_pulse-wp-post-types-edit',
			'neo-pulse-wp_page_neo_pulse-wp-post-types-edit',
			'neo-pulse-wp_page_neo_pulse-wp-taxonomies',
			'neo-pulse-wp_page_neo_pulse-wp-options-pages',
			'admin_page_neo_pulse-wp-fields-gallery',
			'neo-pulse-wp_page_neo_pulse-wp-fields-gallery',
			'neo-pulse-wp_page_neo_pulse-wp-fields-tools',
			'neo-pulse-wp_page_neo_pulse-wp-tags',
			'admin_page_neo_pulse-wp-fields-elementor',
			'neo-pulse-wp_page_neo_pulse-wp-fields-elementor',
		);
		if ( ! in_array( $hook, $screens, true ) ) {
			return;
		}
		$post_type_js = in_array( $hook, array( 'admin_page_neo_pulse-wp-post-types-edit', 'neo-pulse-wp_page_neo_pulse-wp-post-types-edit' ), true );
		$builder_js   = in_array( $hook, array( 'admin_page_neo_pulse-wp-fields-edit', 'neo-pulse-wp_page_neo_pulse-wp-fields-edit' ), true );
		$gallery_js   = in_array( $hook, array( 'admin_page_neo_pulse-wp-fields-gallery', 'neo-pulse-wp_page_neo_pulse-wp-fields-gallery' ), true );
		self::enqueue_admin_fields_styles( $builder_js, $post_type_js, $gallery_js );
	}

	private static function enqueue_admin_fields_styles( bool $builder_js = false, bool $post_type_js = false, bool $gallery_js = false ): void {
		self::enqueue_lato_and_tokens();
		self::enqueue_fields_admin_contrast();
		$base = 'assets/fields/';
		$abs  = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-fields.css';
		$ver  = NEO_PULSE_WP_VERSION;
		if ( is_readable( $abs ) ) {
			$ver .= '.' . (string) filemtime( $abs );
		}
		wp_enqueue_style(
			'neo-pulse-fields-admin',
			plugins_url( $base . 'admin-fields.css', NEO_PULSE_WP_PLUGIN_FILE ),
			array( 'neo-pulse-wp-admin-tokens', 'neo-pulse-wp-admin-contrast' ),
			$ver
		);
		self::enqueue_typography_enforce( 'neo-pulse-fields-admin' );
		if ( $gallery_js ) {
			$gallery_abs = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-fields-gallery.js';
			$gallery_ver = NEO_PULSE_WP_VERSION;
			if ( is_readable( $gallery_abs ) ) {
				$gallery_ver .= '.' . (string) filemtime( $gallery_abs );
			}
			wp_enqueue_script(
				'neo-pulse-fields-gallery',
				plugins_url( $base . 'admin-fields-gallery.js', NEO_PULSE_WP_PLUGIN_FILE ),
				array( 'jquery' ),
				$gallery_ver,
				true
			);
		}
		if ( $builder_js ) {
			$js_abs = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-fields-builder.js';
			$js_ver = NEO_PULSE_WP_VERSION;
			if ( is_readable( $js_abs ) ) {
				$js_ver .= '.' . (string) filemtime( $js_abs );
			}
			wp_enqueue_script(
				'neo-pulse-fields-builder',
				plugins_url( $base . 'admin-fields-builder.js', NEO_PULSE_WP_PLUGIN_FILE ),
				array( 'jquery', 'jquery-ui-sortable' ),
				$js_ver,
				true
			);
			wp_localize_script(
				'neo-pulse-fields-builder',
				'neo-pulseFieldsBuilder',
				array(
					'fieldTypes'     => Neo_Pulse_Wp_Fields_Registry::choices(),
					'locationParams' => Neo_Pulse_Wp_Fields_Location::param_choices(),
					'strings'        => array(
						'addField'     => __( 'Add Field', 'neo-pulse-wp' ),
						'addRuleGroup' => __( 'Add rule group', 'neo-pulse-wp' ),
						'and'          => __( 'and', 'neo-pulse-wp' ),
					),
				)
			);
		}
		if ( $post_type_js ) {
			$js_abs = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-fields-post-type.js';
			$js_ver = NEO_PULSE_WP_VERSION;
			if ( is_readable( $js_abs ) ) {
				$js_ver .= '.' . (string) filemtime( $js_abs );
			}
			wp_enqueue_script(
				'neo-pulse-fields-post-type',
				plugins_url( $base . 'admin-fields-post-type.js', NEO_PULSE_WP_PLUGIN_FILE ),
				array( 'jquery' ),
				$js_ver,
				true
			);
		}
	}

	public static function enqueue_post_edit_assets( string $hook ): void {
		if ( self::acf_is_active() ) {
			return;
		}
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}
		self::enqueue_field_assets();
	}

	public static function enqueue_field_assets(): void {
		wp_enqueue_media();
		wp_enqueue_editor();
		self::enqueue_lato_and_tokens();
		$base = 'assets/fields/';
		$ver  = NEO_PULSE_WP_VERSION;
		$scripts = array( 'admin-field-inputs.js', 'admin-field-image-seo.js', 'acf-shim.js' );
		$fields_css_handle = '';
		$prev_css_handle   = 'neo-pulse-wp-admin-tokens';
		foreach ( array_merge( array( 'admin-fields.css', 'post-edit-fields.css' ), $scripts ) as $file ) {
			$abs = NEO_PULSE_WP_PLUGIN_DIR . $base . $file;
			if ( ! is_readable( $abs ) ) {
				continue;
			}
			$ver_file = $ver . '.' . (string) filemtime( $abs );
			if ( substr( $file, -4 ) === '.css' ) {
				$fields_css_handle = 'neo-pulse-fields-' . sanitize_key( $file );
				wp_enqueue_style(
					$fields_css_handle,
					plugins_url( $base . $file, NEO_PULSE_WP_PLUGIN_FILE ),
					array( $prev_css_handle ),
					$ver_file
				);
				$prev_css_handle = $fields_css_handle;
			} else {
				$deps = array( 'jquery', 'wp-util', 'media-upload', 'media-views' );
				if ( $file === 'admin-field-image-seo.js' ) {
					$deps[] = 'neo-pulse-fields-admin-field-inputsjs';
				}
				wp_enqueue_script(
					'neo-pulse-fields-' . sanitize_key( $file ),
					plugins_url( $base . $file, NEO_PULSE_WP_PLUGIN_FILE ),
					$deps,
					$ver_file,
					true
				);
			}
		}

		if ( $fields_css_handle !== '' ) {
			self::enqueue_typography_enforce( $fields_css_handle );
		}

		$editor_css = NEO_PULSE_WP_PLUGIN_DIR . 'assets/editor/neo-pulse-ai-components.css';
		if ( is_readable( $editor_css ) ) {
			wp_enqueue_style(
				'neo-pulse-wp-ai-components',
				plugins_url( 'assets/editor/neo-pulse-ai-components.css', NEO_PULSE_WP_PLUGIN_FILE ),
				array(),
				$ver . '.' . (string) filemtime( $editor_css )
			);
		}

		wp_localize_script(
			'neo-pulse-fields-admin-field-image-seojs',
			'neoPulseWpImageSeoField',
			array(
				'root'       => esc_url_raw( rest_url( 'neo-pulse/v1/image-seo' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'saveLabel'  => __( 'Save metadata', 'neo-pulse-wp' ),
				'savedLabel' => __( 'Saved', 'neo-pulse-wp' ),
			)
		);
	}

	public static function acf_is_active(): bool {
		return class_exists( 'ACF', false )
			|| class_exists( 'acf', false )
			|| function_exists( 'acf' )
			|| defined( 'ACF_PRO' )
			|| defined( 'ACF_VERSION' );
	}

	public static function acf_conflict_notice(): void {
		if ( ! self::acf_is_active() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( get_user_meta( get_current_user_id(), self::ACF_CONFLICT_NOTICE, true ) ) {
			return;
		}
		$dismiss = wp_nonce_url(
			add_query_arg( 'neo-pulse_dismiss_acf_conflict', '1', admin_url() ),
			'neo-pulse_dismiss_acf_conflict'
		);
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Advanced Custom Fields is active. NEO Pulse Fields replaces ACF — deactivate ACF to avoid conflicts.', 'neo-pulse-wp' );
		echo ' <a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss', 'neo-pulse-wp' ) . '</a>';
		echo '</p></div>';
	}

	public static function maybe_dismiss_acf_notice(): void {
		if ( ! isset( $_GET['neo-pulse_dismiss_acf_conflict'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		check_admin_referer( 'neo-pulse_dismiss_acf_conflict' );
		update_user_meta( get_current_user_id(), self::ACF_CONFLICT_NOTICE, '1' );
		wp_safe_redirect( remove_query_arg( array( 'neo-pulse_dismiss_acf_conflict', '_wpnonce' ) ) );
		exit;
	}

	public static function enqueue_admin_builder_assets(): void {
		self::enqueue_admin_fields_styles( true );
	}

	private static function enqueue_fields_admin_contrast(): void {
		$rel = 'assets/admin/admin-contrast-enforce.css';
		$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}
		wp_enqueue_style(
			'neo-pulse-wp-admin-contrast',
			plugins_url( $rel, NEO_PULSE_WP_PLUGIN_FILE ),
			array( 'neo-pulse-wp-admin-tokens' ),
			NEO_PULSE_WP_VERSION . '.' . (string) filemtime( $abs )
		);
	}

	private static function enqueue_lato_and_tokens(): void {
		wp_enqueue_style(
			'neo-pulse-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);
		$tokens_abs = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/admin-tokens.css';
		$tokens_ver = NEO_PULSE_WP_VERSION;
		if ( is_readable( $tokens_abs ) ) {
			$tokens_ver .= '.' . (string) filemtime( $tokens_abs );
		}
		wp_enqueue_style(
			'neo-pulse-wp-admin-tokens',
			plugins_url( 'assets/admin/admin-tokens.css', NEO_PULSE_WP_PLUGIN_FILE ),
			array( 'neo-pulse-wp-lato' ),
			$tokens_ver
		);
	}

	private static function enqueue_typography_enforce( string $dep_handle ): void {
		$rel = 'assets/admin/admin-typography-enforce.css';
		$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}
		wp_enqueue_style(
			'neo-pulse-wp-admin-typography',
			plugins_url( $rel, NEO_PULSE_WP_PLUGIN_FILE ),
			array( $dep_handle ),
			NEO_PULSE_WP_VERSION . '.' . (string) filemtime( $abs )
		);

		$btn_rel = 'assets/admin/admin-buttons.css';
		$btn_abs = NEO_PULSE_WP_PLUGIN_DIR . $btn_rel;
		if ( is_readable( $btn_abs ) ) {
			wp_enqueue_style(
				'neo-pulse-wp-admin-buttons',
				plugins_url( $btn_rel, NEO_PULSE_WP_PLUGIN_FILE ),
				array( 'neo-pulse-wp-admin-typography' ),
				NEO_PULSE_WP_VERSION . '.' . (string) filemtime( $btn_abs )
			);
		}
	}
}

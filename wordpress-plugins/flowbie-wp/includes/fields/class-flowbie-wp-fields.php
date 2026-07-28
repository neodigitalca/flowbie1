<?php
/**
 * Flowbie Fields bootstrap (ACF replacement).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields {

	const ACF_CONFLICT_NOTICE = 'flowbie_wp_acf_conflict_dismissed';

	public static function init(): void {
		self::load_dependencies();
		add_action( 'init', array( __CLASS__, 'register_storage' ), 5 );
		Flowbie_Wp_Fields_Registry::init();
		add_action( 'plugins_loaded', array( 'Flowbie_Wp_Fields_Api', 'register_functions' ), 99 );
		if ( ! self::acf_is_active() ) {
			Flowbie_Wp_Fields_Meta_Box::init();
		}
		Flowbie_Wp_Fields_Post_Types::init();
		Flowbie_Wp_Fields_Post_Type_Caps::init();
		Flowbie_Wp_Fields_Taxonomies::init();
		Flowbie_Wp_Fields_Options::init();
		Flowbie_Wp_Fields_Elementor::init();
		Flowbie_Wp_Fields_Elementor_Acf_Shim::init();
		Flowbie_Wp_Fields_Elementor_Cache_Fix::init();
		add_action( 'plugins_loaded', array( 'Flowbie_Wp_Fields_Acf_Bridge', 'init' ), 50 );
		Flowbie_Wp_Fields_Post_Meta_Registry::init();
		Flowbie_Wp_Faq::init();
		if ( ! self::acf_is_active() ) {
			Flowbie_Wp_Fields_Rest::init();
		}
		if ( is_admin() ) {
			add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_screen_assets' ) );
			add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_post_edit_assets' ) );
			add_action( 'admin_notices', array( __CLASS__, 'acf_conflict_notice' ) );
			add_action( 'admin_init', array( __CLASS__, 'maybe_dismiss_acf_notice' ) );
		}
	}

	private static function load_dependencies(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/interface-flowbie-wp-field-type.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-field-type-base.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-local-json.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-storage.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/field-types/loader.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-registry.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-location.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-conditional.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-validation.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-values.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-api.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-import-export.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-gallery-templates.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-meta-box.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-post-types.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-post-type-caps.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-taxonomies.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-options.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-rest.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-settings.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-acf-bridge.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-shim.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-cache-fix.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-post-meta-registry.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/faq/class-flowbie-wp-faq.php';
	}

	public static function register_storage(): void {
		Flowbie_Wp_Fields_Storage::register_post_types();
	}

	public static function enqueue_admin_screen_assets( string $hook ): void {
		$screens = array(
			'flowbie-wp_page_flowbie-wp-fields',
			'admin_page_flowbie-wp-fields-edit',
			'flowbie-wp_page_flowbie-wp-fields-edit',
			'flowbie-wp_page_flowbie-wp-post-types',
			'admin_page_flowbie-wp-post-types-edit',
			'flowbie-wp_page_flowbie-wp-post-types-edit',
			'flowbie-wp_page_flowbie-wp-taxonomies',
			'flowbie-wp_page_flowbie-wp-options-pages',
			'admin_page_flowbie-wp-fields-gallery',
			'flowbie-wp_page_flowbie-wp-fields-gallery',
			'flowbie-wp_page_flowbie-wp-fields-tools',
			'flowbie-wp_page_flowbie-wp-tags',
			'admin_page_flowbie-wp-fields-elementor',
			'flowbie-wp_page_flowbie-wp-fields-elementor',
		);
		if ( ! in_array( $hook, $screens, true ) ) {
			return;
		}
		$post_type_js = in_array( $hook, array( 'admin_page_flowbie-wp-post-types-edit', 'flowbie-wp_page_flowbie-wp-post-types-edit' ), true );
		$builder_js   = in_array( $hook, array( 'admin_page_flowbie-wp-fields-edit', 'flowbie-wp_page_flowbie-wp-fields-edit' ), true );
		$gallery_js   = in_array( $hook, array( 'admin_page_flowbie-wp-fields-gallery', 'flowbie-wp_page_flowbie-wp-fields-gallery' ), true );
		self::enqueue_admin_fields_styles( $builder_js, $post_type_js, $gallery_js );
	}

	private static function enqueue_admin_fields_styles( bool $builder_js = false, bool $post_type_js = false, bool $gallery_js = false ): void {
		self::enqueue_lato_and_tokens();
		self::enqueue_fields_admin_contrast();
		$base = 'assets/fields/';
		$abs  = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-fields.css';
		$ver  = FLOWBIE_WP_VERSION;
		if ( is_readable( $abs ) ) {
			$ver .= '.' . (string) filemtime( $abs );
		}
		wp_enqueue_style(
			'flowbie-fields-admin',
			plugins_url( $base . 'admin-fields.css', FLOWBIE_WP_PLUGIN_FILE ),
			array( 'flowbie-wp-admin-tokens', 'flowbie-wp-admin-contrast' ),
			$ver
		);
		self::enqueue_typography_enforce( 'flowbie-fields-admin' );
		if ( $gallery_js ) {
			$gallery_abs = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-fields-gallery.js';
			$gallery_ver = FLOWBIE_WP_VERSION;
			if ( is_readable( $gallery_abs ) ) {
				$gallery_ver .= '.' . (string) filemtime( $gallery_abs );
			}
			wp_enqueue_script(
				'flowbie-fields-gallery',
				plugins_url( $base . 'admin-fields-gallery.js', FLOWBIE_WP_PLUGIN_FILE ),
				array( 'jquery' ),
				$gallery_ver,
				true
			);
		}
		if ( $builder_js ) {
			$js_abs = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-fields-builder.js';
			$js_ver = FLOWBIE_WP_VERSION;
			if ( is_readable( $js_abs ) ) {
				$js_ver .= '.' . (string) filemtime( $js_abs );
			}
			wp_enqueue_script(
				'flowbie-fields-builder',
				plugins_url( $base . 'admin-fields-builder.js', FLOWBIE_WP_PLUGIN_FILE ),
				array( 'jquery', 'jquery-ui-sortable' ),
				$js_ver,
				true
			);
			wp_localize_script(
				'flowbie-fields-builder',
				'flowbieFieldsBuilder',
				array(
					'fieldTypes'     => Flowbie_Wp_Fields_Registry::choices(),
					'locationParams' => Flowbie_Wp_Fields_Location::param_choices(),
					'strings'        => array(
						'addField'     => __( 'Add Field', 'flowbie-wp' ),
						'addRuleGroup' => __( 'Add rule group', 'flowbie-wp' ),
						'and'          => __( 'and', 'flowbie-wp' ),
					),
				)
			);
		}
		if ( $post_type_js ) {
			$js_abs = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-fields-post-type.js';
			$js_ver = FLOWBIE_WP_VERSION;
			if ( is_readable( $js_abs ) ) {
				$js_ver .= '.' . (string) filemtime( $js_abs );
			}
			wp_enqueue_script(
				'flowbie-fields-post-type',
				plugins_url( $base . 'admin-fields-post-type.js', FLOWBIE_WP_PLUGIN_FILE ),
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
		$ver  = FLOWBIE_WP_VERSION;
		$scripts = array( 'admin-field-inputs.js', 'admin-field-image-seo.js', 'acf-shim.js' );
		$fields_css_handle = '';
		$prev_css_handle   = 'flowbie-wp-admin-tokens';
		foreach ( array_merge( array( 'admin-fields.css', 'post-edit-fields.css' ), $scripts ) as $file ) {
			$abs = FLOWBIE_WP_PLUGIN_DIR . $base . $file;
			if ( ! is_readable( $abs ) ) {
				continue;
			}
			$ver_file = $ver . '.' . (string) filemtime( $abs );
			if ( substr( $file, -4 ) === '.css' ) {
				$fields_css_handle = 'flowbie-fields-' . sanitize_key( $file );
				wp_enqueue_style(
					$fields_css_handle,
					plugins_url( $base . $file, FLOWBIE_WP_PLUGIN_FILE ),
					array( $prev_css_handle ),
					$ver_file
				);
				$prev_css_handle = $fields_css_handle;
			} else {
				$deps = array( 'jquery', 'wp-util', 'media-upload', 'media-views' );
				if ( $file === 'admin-field-image-seo.js' ) {
					$deps[] = 'flowbie-fields-admin-field-inputsjs';
				}
				wp_enqueue_script(
					'flowbie-fields-' . sanitize_key( $file ),
					plugins_url( $base . $file, FLOWBIE_WP_PLUGIN_FILE ),
					$deps,
					$ver_file,
					true
				);
			}
		}

		if ( $fields_css_handle !== '' ) {
			self::enqueue_typography_enforce( $fields_css_handle );
		}

		$editor_css = FLOWBIE_WP_PLUGIN_DIR . 'assets/editor/flowbie-ai-components.css';
		if ( is_readable( $editor_css ) ) {
			wp_enqueue_style(
				'flowbie-wp-ai-components',
				plugins_url( 'assets/editor/flowbie-ai-components.css', FLOWBIE_WP_PLUGIN_FILE ),
				array(),
				$ver . '.' . (string) filemtime( $editor_css )
			);
		}

		wp_localize_script(
			'flowbie-fields-admin-field-image-seojs',
			'flowbieWpImageSeoField',
			array(
				'root'       => esc_url_raw( rest_url( 'flowbie/v1/image-seo' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'saveLabel'  => __( 'Save metadata', 'flowbie-wp' ),
				'savedLabel' => __( 'Saved', 'flowbie-wp' ),
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
			add_query_arg( 'flowbie_dismiss_acf_conflict', '1', admin_url() ),
			'flowbie_dismiss_acf_conflict'
		);
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Advanced Custom Fields is active. Flowbie Fields replaces ACF — deactivate ACF to avoid conflicts.', 'flowbie-wp' );
		echo ' <a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss', 'flowbie-wp' ) . '</a>';
		echo '</p></div>';
	}

	public static function maybe_dismiss_acf_notice(): void {
		if ( ! isset( $_GET['flowbie_dismiss_acf_conflict'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		check_admin_referer( 'flowbie_dismiss_acf_conflict' );
		update_user_meta( get_current_user_id(), self::ACF_CONFLICT_NOTICE, '1' );
		wp_safe_redirect( remove_query_arg( array( 'flowbie_dismiss_acf_conflict', '_wpnonce' ) ) );
		exit;
	}

	public static function enqueue_admin_builder_assets(): void {
		self::enqueue_admin_fields_styles( true );
	}

	private static function enqueue_fields_admin_contrast(): void {
		$rel = 'assets/admin/admin-contrast-enforce.css';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}
		wp_enqueue_style(
			'flowbie-wp-admin-contrast',
			plugins_url( $rel, FLOWBIE_WP_PLUGIN_FILE ),
			array( 'flowbie-wp-admin-tokens' ),
			FLOWBIE_WP_VERSION . '.' . (string) filemtime( $abs )
		);
	}

	private static function enqueue_lato_and_tokens(): void {
		wp_enqueue_style(
			'flowbie-wp-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);
		$tokens_abs = FLOWBIE_WP_PLUGIN_DIR . 'assets/admin/admin-tokens.css';
		$tokens_ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $tokens_abs ) ) {
			$tokens_ver .= '.' . (string) filemtime( $tokens_abs );
		}
		wp_enqueue_style(
			'flowbie-wp-admin-tokens',
			plugins_url( 'assets/admin/admin-tokens.css', FLOWBIE_WP_PLUGIN_FILE ),
			array( 'flowbie-wp-lato' ),
			$tokens_ver
		);
	}

	private static function enqueue_typography_enforce( string $dep_handle ): void {
		$rel = 'assets/admin/admin-typography-enforce.css';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}
		wp_enqueue_style(
			'flowbie-wp-admin-typography',
			plugins_url( $rel, FLOWBIE_WP_PLUGIN_FILE ),
			array( $dep_handle ),
			FLOWBIE_WP_VERSION . '.' . (string) filemtime( $abs )
		);

		$btn_rel = 'assets/admin/admin-buttons.css';
		$btn_abs = FLOWBIE_WP_PLUGIN_DIR . $btn_rel;
		if ( is_readable( $btn_abs ) ) {
			wp_enqueue_style(
				'flowbie-wp-admin-buttons',
				plugins_url( $btn_rel, FLOWBIE_WP_PLUGIN_FILE ),
				array( 'flowbie-wp-admin-typography' ),
				FLOWBIE_WP_VERSION . '.' . (string) filemtime( $btn_abs )
			);
		}
	}
}

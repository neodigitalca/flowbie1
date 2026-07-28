<?php
/**
 * Elementor Pro dynamic tags for Flowbie Fields (post + options pages).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Elementor {

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		Flowbie_Wp_Fields_Elementor_Settings::maybe_bootstrap_defaults();
		add_action( 'elementor/loaded', array( __CLASS__, 'boot' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'boot' ), 120 );
	}

	public static function elementor_loaded(): bool {
		return did_action( 'elementor/loaded' ) || defined( 'ELEMENTOR_VERSION' );
	}

	public static function dynamic_tags_available(): bool {
		return class_exists( '\Elementor\Modules\DynamicTags\Module', false );
	}

	public static function can_register_tags(): bool {
		if ( Flowbie_Wp_Fields_Elementor_Settings::force_options_tags_active() ) {
			return self::elementor_loaded() && self::dynamic_tags_available();
		}
		if ( ! Flowbie_Wp_Fields_Elementor_Settings::is_enabled() && Flowbie_Wp_Fields::acf_is_active() ) {
			return false;
		}
		if ( ! self::elementor_loaded() || ! self::dynamic_tags_available() ) {
			return false;
		}
		return self::expected_registered_tag_count() > 0;
	}

	public static function expected_registered_tag_count(): int {
		return Flowbie_Wp_Fields_Elementor_Settings::expected_registered_tag_count();
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function get_integration_status(): array {
		return array(
			'acf_active'             => Flowbie_Wp_Fields::acf_is_active(),
			'settings_enabled'       => Flowbie_Wp_Fields_Elementor_Settings::is_enabled(),
			'post_tags_enabled'      => Flowbie_Wp_Fields_Elementor_Settings::post_tags_enabled(),
			'options_tags_enabled'   => Flowbie_Wp_Fields_Elementor_Settings::options_tags_enabled(),
			'elementor_loaded'       => self::elementor_loaded(),
			'dynamic_tags_available' => self::dynamic_tags_available(),
			'expected_tag_count'     => self::expected_registered_tag_count(),
			'can_register_tags'      => self::can_register_tags(),
			'boot_hooked'            => self::$booted || has_action( 'elementor/dynamic_tags/register', array( __CLASS__, 'register_tags' ) ),
		);
	}

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		if ( ! self::elementor_loaded() ) {
			return;
		}
		if ( ! self::dynamic_tags_available() ) {
			return;
		}
		if ( ! Flowbie_Wp_Fields_Elementor_Settings::is_enabled()
			&& Flowbie_Wp_Fields::acf_is_active()
			&& ! Flowbie_Wp_Fields_Elementor_Settings::force_options_tags_active() ) {
			return;
		}
		add_action( 'elementor/dynamic_tags/register', array( __CLASS__, 'register_tags' ) );
		self::$booted = true;
	}

	public static function register_tags( $dynamic_tags_manager ): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-registry.php';
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-tags.php';

		$post_tags    = Flowbie_Wp_Fields_Elementor_Settings::post_tags_enabled() && ! Flowbie_Wp_Fields::acf_is_active();
		$options_tags = Flowbie_Wp_Fields_Elementor_Settings::options_tags_enabled() || ! Flowbie_Wp_Fields::acf_is_active();

		if ( $post_tags || $options_tags ) {
			$dynamic_tags_manager->register_group(
				'flowbie',
				array(
					'title' => esc_html__( 'Flowbie', 'flowbie-wp' ),
				)
			);
		}

		$tags = array();
		if ( $post_tags ) {
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Text();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Image();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Url();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Gallery();
		}
		if ( $options_tags ) {
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Options_Text();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Options_Image();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Options_Url();
			$tags[] = new Flowbie_Wp_Fields_Elementor_Tag_Options_Gallery();
		}

		foreach ( $tags as $tag ) {
			$dynamic_tags_manager->register( $tag );
		}
	}

	/**
	 * Build an Elementor dynamic tag shortcode for post meta text (e.g. focus keyword).
	 */
	public static function build_post_meta_text_tag( string $meta_key ): string {
		if ( ! self::dynamic_tags_available() || $meta_key === '' ) {
			return '';
		}

		if ( ! class_exists( 'Flowbie_Wp_Migrate_Elementor_Dynamic_Tags', false ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-dynamic-tags.php';
		}

		$field_name = ltrim( $meta_key, '_' );
		if ( self::can_register_tags() && class_exists( 'Flowbie_Wp_Fields_Values', false ) ) {
			$field = Flowbie_Wp_Fields_Values::find_field( $field_name );
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				return Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::build_flowbie_tag_from_resolved(
					'text',
					array(
						'field_name'   => (string) $field['name'],
						'options_slug' => null,
					),
					$meta_key
				);
			}
		}

		return Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::build_elementor_tag_shortcode(
			substr( md5( 'post-meta-' . $meta_key ), 0, 7 ),
			'post-custom-field',
			array( 'key' => $meta_key )
		);
	}
}

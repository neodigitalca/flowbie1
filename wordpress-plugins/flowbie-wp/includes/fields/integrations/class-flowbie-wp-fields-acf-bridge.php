<?php
/**
 * Bridge ACF option reads to Flowbie Fields storage (custom options page slugs).
 *
 * Elementor ACF tags call get_field( $name, 'options' ) even for custom options pages
 * like contact-information. Values imported by Flowbie live under {slug}_{field}.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Acf_Bridge {

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		if ( self::$booted ) {
			return;
		}
		if ( ! class_exists( 'Flowbie_Wp_Fields_Storage', false ) ) {
			return;
		}
		add_filter( 'acf/load_value', array( __CLASS__, 'load_value' ), 20, 3 );
		add_filter( 'acf/pre_load_value', array( __CLASS__, 'pre_load_value' ), 20, 3 );
		add_action( 'init', array( __CLASS__, 'maybe_sync_option_mirrors' ), 20 );
		self::$booted = true;
	}

	/**
	 * Mirror custom options page values to legacy options_{field} keys for Elementor ACF tags.
	 */
	public static function maybe_sync_option_mirrors(): void {
		if ( get_option( 'flowbie_wp_option_mirror_synced', false ) ) {
			return;
		}
		if ( ! class_exists( 'Flowbie_Wp_Fields_Values', false ) ) {
			return;
		}

		$synced = 0;
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
			if ( ! is_array( $page ) || empty( $page['menu_slug'] ) ) {
				continue;
			}
			$slug = (string) $page['menu_slug'];
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-location.php';
			$screen = array( 'options_page' => $slug );
			foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
				if ( ! Flowbie_Wp_Fields_Location::matches_group( $group, $screen ) ) {
					continue;
				}
				foreach ( isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array() as $field ) {
					if ( ! is_array( $field ) || empty( $field['name'] ) ) {
						continue;
					}
					$name = (string) $field['name'];
					if ( ! Flowbie_Wp_Fields_Values::option_value_exists( $slug, $name ) ) {
						continue;
					}
					$legacy_key = 'options_' . $name;
					if ( Flowbie_Wp_Fields_Values::option_key_exists( $legacy_key ) ) {
						continue;
					}
					$raw = Flowbie_Wp_Fields_Values::read_option_raw( $slug, $name, null );
					if ( ! self::value_present( $raw ) ) {
						continue;
					}
					update_option( $legacy_key, $raw, false );
					++$synced;
				}
			}
		}

		if ( $synced > 0 || get_option( 'flowbie_wp_option_mirror_synced', false ) === false ) {
			update_option( 'flowbie_wp_option_mirror_synced', 1, false );
		}
	}

	/**
	 * @param mixed $value   Existing value.
	 * @param mixed $post_id ACF post ID or options context.
	 * @param array<string, mixed> $field ACF field array.
	 * @return mixed
	 */
	public static function pre_load_value( $value, $post_id, $field ) {
		if ( null !== $value ) {
			return $value;
		}
		return self::load_value( $value, $post_id, is_array( $field ) ? $field : array() );
	}

	/**
	 * @param mixed $value   Existing value.
	 * @param mixed $post_id ACF post ID or options context.
	 * @param array<string, mixed> $field ACF field array.
	 * @return mixed
	 */
	public static function load_value( $value, $post_id, $field ) {
		if ( self::value_present( $value ) ) {
			return $value;
		}
		if ( ! is_array( $field ) || empty( $field['name'] ) ) {
			return $value;
		}

		$name = (string) $field['name'];
		if ( ! self::is_options_context( $post_id ) ) {
			return $value;
		}

		$resolved = self::read_flowbie_option_value( $name, $post_id, $field );
		return self::value_present( $resolved ) ? $resolved : $value;
	}

	/**
	 * @param mixed $post_id ACF post ID or options context.
	 */
	private static function is_options_context( $post_id ): bool {
		if ( $post_id === 'options' || $post_id === 'option' ) {
			return true;
		}
		return is_string( $post_id ) && $post_id !== '' && ! is_numeric( $post_id );
	}

	/**
	 * @param mixed $value Value to test.
	 */
	private static function value_present( $value ): bool {
		if ( null === $value || false === $value ) {
			return false;
		}
		if ( is_string( $value ) && $value === '' ) {
			return false;
		}
		if ( is_array( $value ) && empty( $value ) ) {
			return false;
		}
		return true;
	}

	/**
	 * @param mixed                $post_id ACF options context.
	 * @param array<string, mixed> $field   ACF field array.
	 * @return mixed|null
	 */
	private static function read_flowbie_option_value( string $name, $post_id, array $field ) {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';

		$slugs = array();
		if ( is_string( $post_id ) && ! in_array( $post_id, array( 'options', 'option' ), true ) ) {
			$slugs[] = $post_id;
			$slugs[] = sanitize_key( $post_id );
		}

		Flowbie_Wp_Fields_Elementor_Acf_Resolver::build_field_index();
		$indexed_slug = Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_acf_key( 'options:' . $name );
		if ( is_array( $indexed_slug ) && ! empty( $indexed_slug['options_slug'] ) ) {
			$slugs[] = (string) $indexed_slug['options_slug'];
		}

		foreach ( self::all_options_slugs() as $slug ) {
			$slugs[] = $slug;
		}

		$slugs = array_values( array_unique( array_filter( $slugs ) ) );
		$config = Flowbie_Wp_Fields_Values::find_field( $name );
		if ( ! is_array( $config ) ) {
			$config = $field;
		}

		foreach ( $slugs as $slug ) {
			if ( ! Flowbie_Wp_Fields_Values::option_value_exists( $slug, $name ) ) {
				continue;
			}
			$raw = Flowbie_Wp_Fields_Values::read_option_raw( $slug, $name, null );
			if ( ! self::value_present( $raw ) ) {
				continue;
			}
			return Flowbie_Wp_Fields_Registry::load_value( $raw, $config, 0 );
		}

		return null;
	}

	/**
	 * @return array<int, string>
	 */
	private static function all_options_slugs(): array {
		$slugs = array();
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
			if ( ! is_array( $page ) || empty( $page['menu_slug'] ) ) {
				continue;
			}
			$slugs[] = (string) $page['menu_slug'];
		}
		return array_values( array_unique( array_filter( $slugs ) ) );
	}
}

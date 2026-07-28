<?php
/**
 * Resolve legacy Elementor ACF dynamic tag settings via Flowbie Fields.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Elementor_Acf_Resolver {

	/** @var array<string, array<string, mixed>>|null */
	private static $field_index = null;

	/**
	 * @param array<string, mixed> $settings Elementor tag settings.
	 */
	public static function extract_key_from_settings( array $settings ): string {
		foreach ( array( 'key', 'field_key', 'field', 'acf_field_key', 'acf_field' ) as $setting_key ) {
			$value = trim( (string) ( $settings[ $setting_key ] ?? '' ) );
			if ( $value !== '' && $value !== '-1' ) {
				return $value;
			}
		}
		return '';
	}

	/**
	 * @return array<string, array<string, mixed>>
	 */
	public static function build_field_index(): array {
		if ( null !== self::$field_index ) {
			return self::$field_index;
		}

		self::$field_index = array(
			'by_key'  => array(),
			'by_name' => array(),
			'by_label'=> array(),
			'options' => array(),
		);

		if ( ! class_exists( 'Flowbie_Wp_Fields_Storage', false ) ) {
			return self::$field_index;
		}

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/class-flowbie-wp-fields-location.php';

		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$options_slug = self::options_slug_for_group( $group );
			self::index_fields_tree(
				isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array(),
				$options_slug
			);
		}

		return self::$field_index;
	}

	public static function reset_field_index(): void {
		self::$field_index = null;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields
	 */
	private static function index_fields_tree( array $fields, ?string $options_slug, string $prefix = '' ): void {
		unset( $prefix );
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$name = (string) $field['name'];
			$key  = (string) ( $field['key'] ?? '' );
			$type = (string) ( $field['type'] ?? 'text' );

			$entry = array(
				'name'         => $name,
				'key'          => $key,
				'type'         => $type,
				'options_slug' => $options_slug,
				'label'        => (string) ( $field['label'] ?? $name ),
			);

			if ( $key !== '' ) {
				self::$field_index['by_key'][ $key ] = $entry;
			}
			self::$field_index['by_name'][ $name ] = $entry;
			if ( $options_slug !== null && $options_slug !== '' ) {
				self::$field_index['options'][ $name ] = $options_slug;
			}

			$label = (string) ( $field['label'] ?? $name );
			foreach ( self::label_lookup_keys( $label ) as $label_key ) {
				self::$field_index['by_label'][ $label_key ] = $entry;
			}

			foreach ( array( 'sub_fields', 'layouts' ) as $nested_key ) {
				if ( empty( $field[ $nested_key ] ) || ! is_array( $field[ $nested_key ] ) ) {
					continue;
				}
				if ( $nested_key === 'layouts' ) {
					foreach ( $field['layouts'] as $layout ) {
						if ( is_array( $layout ) && ! empty( $layout['sub_fields'] ) ) {
							self::index_fields_tree( $layout['sub_fields'], $options_slug );
						}
					}
				} else {
					self::index_fields_tree( $field['sub_fields'], $options_slug );
				}
			}
		}
	}

	/**
	 * @param array<string, mixed> $group
	 */
	private static function options_slug_for_group( array $group ): ?string {
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
		foreach ( $location as $rule_group ) {
			if ( ! is_array( $rule_group ) ) {
				continue;
			}
			foreach ( $rule_group as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				if ( (string) ( $rule['param'] ?? '' ) !== 'options_page' ) {
					continue;
				}
				if ( (string) ( $rule['operator'] ?? '==' ) === '!=' ) {
					continue;
				}
				$value = (string) ( $rule['value'] ?? '' );
				if ( $value !== '' ) {
					return sanitize_key( $value );
				}
			}
		}
		return null;
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	public static function resolve_any_key( string $key ): ?array {
		$key = trim( $key );
		if ( $key === '' || $key === '-1' ) {
			return null;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-registry.php';
		$parsed = Flowbie_Wp_Fields_Elementor_Registry::parse_field_key( $key );
		if ( ! empty( $parsed['options_slug'] ) ) {
			$name = sanitize_key( (string) $parsed['field_name'] );
			if ( $name === '' ) {
				return null;
			}
			return array(
				'field_name'   => $name,
				'options_slug' => (string) $parsed['options_slug'],
			);
		}
		if ( ! empty( $parsed['post_type'] ) && (string) $parsed['field_name'] !== '' ) {
			return array(
				'field_name'   => sanitize_key( (string) $parsed['field_name'] ),
				'options_slug' => null,
			);
		}
		if ( strpos( $key, '::' ) !== false ) {
			list( $slug, $name ) = explode( '::', $key, 2 );
			$slug = sanitize_key( (string) $slug );
			$name = sanitize_key( (string) $name );
			if ( $name === '' ) {
				return null;
			}
			return array(
				'field_name'   => $name,
				'options_slug' => $slug !== '' ? $slug : null,
			);
		}
		return self::resolve_acf_key( $key );
	}

	/**
	 * @param array<string, mixed> $settings Elementor dynamic tag settings.
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	public static function resolve_from_tag_settings( array $settings ): ?array {
		foreach ( array( 'key', 'field_key', 'field', 'acf_field_key', 'acf_field', 'field_name' ) as $setting_key ) {
			$value = trim( (string) ( $settings[ $setting_key ] ?? '' ) );
			if ( $value === '' || $value === '-1' ) {
				continue;
			}
			$resolved = self::resolve_any_key( $value );
			if ( $resolved !== null ) {
				return $resolved;
			}
		}
		return null;
	}

	/**
	 * Build the legacy ACF Elementor `key` setting from a resolved field binding.
	 *
	 * @param array{field_name: string, options_slug: string|null} $resolved
	 */
	public static function to_acf_key_setting( array $resolved ): string {
		self::build_field_index();

		$name = (string) ( $resolved['field_name'] ?? '' );
		if ( $name === '' ) {
			return '';
		}

		if ( ! empty( $resolved['options_slug'] ) ) {
			return 'options:' . $name;
		}

		$entry = self::$field_index['by_name'][ $name ] ?? null;
		if ( is_array( $entry ) && ! empty( $entry['key'] ) ) {
			return (string) $entry['key'] . ':' . (string) ( $entry['name'] ?? $name );
		}

		return $name;
	}

	/**
	 * @return array<int, array{name: string, key: string, type: string, options_slug: string, label: string}>
	 */
	public static function options_fields_for_patterns( array $name_patterns ): array {
		self::build_field_index();
		$out  = array();
		$seen = array();

		foreach ( self::$field_index['by_name'] as $name => $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['options_slug'] ) ) {
				continue;
			}
			foreach ( $name_patterns as $pattern ) {
				if ( @preg_match( $pattern, (string) $name ) ) {
					if ( ! isset( $seen[ (string) $name ] ) ) {
						$seen[ (string) $name ] = true;
						$out[]                    = array(
							'name'         => (string) $name,
							'key'          => (string) ( $entry['key'] ?? '' ),
							'type'         => (string) ( $entry['type'] ?? 'text' ),
							'options_slug' => (string) $entry['options_slug'],
							'label'        => (string) ( $entry['label'] ?? $name ),
						);
					}
					break;
				}
			}
		}

		usort(
			$out,
			static function ( $a, $b ) {
				return strcmp( (string) $a['name'], (string) $b['name'] );
			}
		);

		return $out;
	}

	/**
	 * @return array<int, string>
	 */
	private static function label_lookup_keys( string $label ): array {
		$label = trim( $label );
		if ( $label === '' ) {
			return array();
		}
		$keys   = array();
		$keys[] = self::normalize_label_key( $label );
		$keys[] = self::normalize_label_key( preg_replace( '/^options:\s*/i', '', $label ) );
		return array_values( array_unique( array_filter( $keys ) ) );
	}

	private static function normalize_label_key( string $label ): string {
		$label = strtolower( trim( $label ) );
		$label = preg_replace( '/^options:\s*/', '', $label );
		$label = preg_replace( '/[^a-z0-9]+/', '', (string) $label );
		return (string) $label;
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	public static function resolve_acf_key( string $key ): ?array {
		$key = trim( $key );
		if ( $key === '' || $key === '-1' ) {
			return null;
		}

		self::build_field_index();

		if ( 0 === stripos( $key, 'options:' ) ) {
			$field_name = substr( $key, strlen( 'options:' ) );
			$field_name = trim( $field_name );
			if ( $field_name === '' ) {
				return null;
			}
			$resolved_name = self::resolve_field_name_token( $field_name );
			if ( $resolved_name === null ) {
				return null;
			}
			$options_slug = self::$field_index['options'][ $resolved_name ] ?? null;
			if ( $options_slug === null || $options_slug === '' ) {
				$options_slug = 'options';
			}
			return array(
				'field_name'   => $resolved_name,
				'options_slug' => $options_slug,
			);
		}

		if ( false !== strpos( $key, ':' ) ) {
			list( $field_key, $field_name ) = explode( ':', $key, 2 );
			$field_name = (string) $field_name;
			if ( $field_name !== '' ) {
				$entry = self::$field_index['by_key'][ $field_key ] ?? self::$field_index['by_name'][ $field_name ] ?? null;
				if ( is_array( $entry ) && ! empty( $entry['options_slug'] ) ) {
					return array(
						'field_name'   => $field_name,
						'options_slug' => (string) $entry['options_slug'],
					);
				}
				return array(
					'field_name'   => $field_name,
					'options_slug' => null,
				);
			}
		}

		$entry = self::$field_index['by_key'][ $key ] ?? self::$field_index['by_name'][ $key ] ?? null;
		if ( is_array( $entry ) ) {
			return array(
				'field_name'   => (string) $entry['name'],
				'options_slug' => ! empty( $entry['options_slug'] ) ? (string) $entry['options_slug'] : null,
			);
		}

		$options_slug = self::$field_index['options'][ $key ] ?? null;
		return array(
			'field_name'   => $key,
			'options_slug' => $options_slug,
		);
	}

	/**
	 * Resolve ACF option picker labels (e.g. "Logo Icon") or raw field names.
	 */
	private static function resolve_field_name_token( string $token ): ?string {
		$token = trim( $token );
		if ( $token === '' ) {
			return null;
		}
		if ( isset( self::$field_index['by_name'][ $token ] ) ) {
			return $token;
		}
		$label_key = self::normalize_label_key( $token );
		if ( $label_key !== '' && isset( self::$field_index['by_label'][ $label_key ] ) ) {
			return (string) ( self::$field_index['by_label'][ $label_key ]['name'] ?? '' );
		}
		return sanitize_key( $token ) !== '' ? sanitize_key( $token ) : null;
	}

	/**
	 * @param array<string, mixed> $settings Elementor tag settings.
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	public static function resolve_from_settings( array $settings ): ?array {
		return self::resolve_from_tag_settings( $settings );
	}

	/**
	 * @param array{field_name: string, options_slug: string|null} $resolved
	 * @return array<string, mixed>|null
	 */
	public static function get_field_config( array $resolved ): ?array {
		$name = (string) ( $resolved['field_name'] ?? '' );
		if ( $name === '' ) {
			return null;
		}
		if ( ! empty( $resolved['options_slug'] ) ) {
			$field = Flowbie_Wp_Fields_Values::find_field( $name );
			return is_array( $field ) ? $field : self::stub_field( $name );
		}
		$post_id = Flowbie_Wp_Fields_Elementor_Registry::resolve_editor_post_id();
		if ( $post_id < 1 ) {
			$post_id = get_queried_object_id();
		}
		$field = Flowbie_Wp_Fields_Values::find_field( $name, $post_id > 0 ? $post_id : null );
		return is_array( $field ) ? $field : self::stub_field( $name );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function stub_field( string $name ): array {
		$type = 'text';
		if ( false !== strpos( $name, 'email' ) ) {
			$type = 'email';
		} elseif ( false !== strpos( $name, 'link' ) || false !== strpos( $name, 'url' ) || false !== strpos( $name, 'maps' ) ) {
			$type = 'url';
		} elseif ( false !== strpos( $name, 'image' ) || false !== strpos( $name, 'logo' ) ) {
			$type = 'image';
		}
		return array(
			'name' => $name,
			'type' => $type,
			'key'  => '',
		);
	}

	/**
	 * @param array{field_name: string, options_slug: string|null} $resolved
	 * @return mixed
	 */
	public static function get_field_value( array $resolved, bool $format = true ) {
		$name = (string) ( $resolved['field_name'] ?? '' );
		if ( $name === '' ) {
			return null;
		}

		if ( ! empty( $resolved['options_slug'] ) ) {
			$slug  = (string) $resolved['options_slug'];
			$field = self::get_field_config( $resolved );
			if ( is_array( $field ) ) {
				$value = Flowbie_Wp_Fields_Values::get_option( $slug, $field, $format );
				if ( self::value_present( $value ) ) {
					return $value;
				}
			}
			return self::read_option_fallback( $name, $slug, is_array( $field ) ? $field : array( 'name' => $name, 'type' => 'text' ), $format );
		}

		$source = Flowbie_Wp_Fields_Elementor_Registry::resolve_editor_post_id();
		if ( $source < 1 ) {
			$source = get_queried_object_id();
		}

		if ( class_exists( 'Flowbie_Wp_Fields_Api', false ) && ! Flowbie_Wp_Fields::acf_is_active() ) {
			$value = Flowbie_Wp_Fields_Api::get_field( $name, $source, $format );
			if ( self::value_present( $value ) ) {
				return $value;
			}
		}

		$field = self::get_field_config( $resolved );
		if ( ! $field ) {
			return null;
		}
		$post_id = (int) $source;
		return $post_id > 0 ? Flowbie_Wp_Fields_Values::get_value( $post_id, $field, $format ) : null;
	}

	/**
	 * @param array<string, mixed> $field
	 * @return mixed
	 */
	private static function read_option_fallback( string $name, string $primary_slug, array $field, bool $format ) {
		$slugs = array( $primary_slug, sanitize_key( $primary_slug ) );
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
			if ( is_array( $page ) && ! empty( $page['menu_slug'] ) ) {
				$slugs[] = (string) $page['menu_slug'];
			}
		}
		$slugs = array_values( array_unique( array_filter( $slugs ) ) );

		foreach ( $slugs as $slug ) {
			if ( ! Flowbie_Wp_Fields_Values::option_value_exists( $slug, $name ) ) {
				continue;
			}
			$raw = Flowbie_Wp_Fields_Values::read_option_raw( $slug, $name, null );
			if ( ! self::value_present( $raw ) ) {
				continue;
			}
			$loaded = Flowbie_Wp_Fields_Registry::load_value( $raw, $field, 0 );
			return $format ? Flowbie_Wp_Fields_Registry::format_value( $loaded, $field, 0 ) : $loaded;
		}

		return null;
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
}

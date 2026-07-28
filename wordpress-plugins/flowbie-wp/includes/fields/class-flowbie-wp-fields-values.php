<?php
/**
 * Field value load, save, format (ACF meta pattern).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Values {

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function get_raw( int $post_id, array $field ) {
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' ) {
			return null;
		}
		return get_post_meta( $post_id, $name, true );
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function get_value( int $post_id, array $field, bool $format = true ) {
		$raw = self::get_raw( $post_id, $field );
		if ( $raw === '' && ! metadata_exists( 'post', $post_id, (string) $field['name'] ) ) {
			$raw = $field['default_value'] ?? '';
		}
		$loaded = Flowbie_Wp_Fields_Registry::load_value( $raw, $field, $post_id );
		return $format ? Flowbie_Wp_Fields_Registry::format_value( $loaded, $field, $post_id ) : $loaded;
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Value to store.
	 */
	public static function update_value( int $post_id, array $field, $value ): bool {
		$name = (string) ( $field['name'] ?? '' );
		$key  = (string) ( $field['key'] ?? '' );
		if ( $name === '' ) {
			return false;
		}
		$valid = Flowbie_Wp_Fields_Validation::validate( $field, $value );
		if ( is_wp_error( $valid ) ) {
			return false;
		}
		$value = Flowbie_Wp_Fields_Registry::update_value( $value, $field, $post_id );
		update_post_meta( $post_id, $name, $value );
		if ( $key !== '' ) {
			update_post_meta( $post_id, '_' . $name, $key );
		}
		return true;
	}

	public static function delete_value( int $post_id, array $field ): void {
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' ) {
			return;
		}
		delete_post_meta( $post_id, $name );
		delete_post_meta( $post_id, '_' . $name );
	}

	/**
	 * @param array<int, array<string, mixed>> $fields Field configs.
	 * @return array<string, mixed>
	 */
	public static function get_all_values( int $post_id, array $fields, bool $format = true ): array {
		$out = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$out[ (string) $field['name'] ] = self::get_value( $post_id, $field, $format );
		}
		return $out;
	}

	/**
	 * Find field config by selector (name or key) across groups.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function find_field( string $selector, ?int $post_id = null ): ?array {
		$selector = trim( $selector );
		if ( $selector === '' ) {
			return null;
		}
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( $post_id && ! Flowbie_Wp_Fields_Location::matches_group( $group, self::screen_for_post( $post_id ) ) ) {
				continue;
			}
			$field = self::find_in_fields( $selector, isset( $group['fields'] ) ? $group['fields'] : array() );
			if ( $field ) {
				return $field;
			}
		}
		return null;
	}

	/**
	 * @param array<int, array<string, mixed>> $fields Fields tree.
	 * @return array<string, mixed>|null
	 */
	public static function find_in_fields( string $selector, array $fields ): ?array {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( (string) ( $field['name'] ?? '' ) === $selector || (string) ( $field['key'] ?? '' ) === $selector ) {
				return $field;
			}
			foreach ( array( 'sub_fields', 'layouts' ) as $nested_key ) {
				if ( empty( $field[ $nested_key ] ) || ! is_array( $field[ $nested_key ] ) ) {
					continue;
				}
				if ( $nested_key === 'layouts' ) {
					foreach ( $field['layouts'] as $layout ) {
						if ( is_array( $layout ) && ! empty( $layout['sub_fields'] ) ) {
							$found = self::find_in_fields( $selector, $layout['sub_fields'] );
							if ( $found ) {
								return $found;
							}
						}
					}
				} else {
					$found = self::find_in_fields( $selector, $field['sub_fields'] );
					if ( $found ) {
						return $found;
					}
				}
			}
		}
		return null;
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function screen_for_post( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return array();
		}
		return array(
			'post_id'       => $post_id,
			'post_type'     => $post->post_type,
			'post_status'   => $post->post_status,
			'page_template' => get_page_template_slug( $post ),
		);
	}

	/** Options page values. */
	public static function get_option( string $option_slug, array $field, bool $format = true ) {
		$name = (string) ( $field['name'] ?? '' );
		$raw  = self::read_option_raw( $option_slug, $name, $field['default_value'] ?? '' );
		$loaded = Flowbie_Wp_Fields_Registry::load_value( $raw, $field, 0 );
		return $format ? Flowbie_Wp_Fields_Registry::format_value( $loaded, $field, 0 ) : $loaded;
	}

	/**
	 * Read raw option value, including legacy ACF storage prefixes.
	 *
	 * @param mixed $default Default when no stored value exists.
	 * @return mixed
	 */
	public static function read_option_raw( string $option_slug, string $name, $default = '' ) {
		if ( $name === '' ) {
			return $default;
		}
		foreach ( self::option_storage_keys( $option_slug, $name ) as $option_key ) {
			if ( self::option_key_exists( $option_key ) ) {
				return get_option( $option_key );
			}
		}
		return $default;
	}

	public static function option_value_exists( string $option_slug, string $name ): bool {
		if ( $name === '' ) {
			return false;
		}
		foreach ( self::option_storage_keys( $option_slug, $name ) as $option_key ) {
			if ( self::option_key_exists( $option_key ) ) {
				return true;
			}
		}
		return false;
	}

	public static function option_key_exists( string $option_key ): bool {
		return get_option( $option_key, null ) !== null;
	}

	/**
	 * @return array<int, string>
	 */
	public static function option_storage_keys( string $option_slug, string $field_name ): array {
		$slug = sanitize_key( $option_slug );
		return array_values(
			array_unique(
				array_filter(
					array(
						$option_slug . '_' . $field_name,
						$slug . '_' . $field_name,
						'options_' . $field_name,
						'option_' . $field_name,
						$field_name,
					)
				)
			)
		);
	}

	public static function update_option( string $option_slug, array $field, $value ): void {
		$name  = (string) ( $field['name'] ?? '' );
		$value = Flowbie_Wp_Fields_Registry::update_value( $value, $field, 0 );
		update_option( $option_slug . '_' . $name, $value );
		update_option( 'options_' . $name, $value );
		if ( ! empty( $field['key'] ) ) {
			update_option( $option_slug . '_' . $name, $value );
			update_option( '_' . $option_slug . '_' . $name, (string) $field['key'] );
		}
	}
}

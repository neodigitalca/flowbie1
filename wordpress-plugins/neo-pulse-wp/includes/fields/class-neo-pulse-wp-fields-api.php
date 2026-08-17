<?php
/**
 * ACF-compatible public API (get_field, update_field, have_rows, etc.).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Api {

	/** @var array<string, mixed> */
	private static $row_stack = array();

	public static function register_functions(): void {
		// Never polyfill while real ACF is active — prevents "Cannot redeclare get_field()" fatals.
		if ( Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return;
		}
		if ( ! function_exists( 'get_field' ) ) {
			/**
			 * @param mixed $post_id Post ID or option slug.
			 */
			function get_field( $selector, $post_id = false, $format_value = true ) {
				return Neo_Pulse_Wp_Fields_Api::get_field( $selector, $post_id, $format_value );
			}
		}
		if ( ! function_exists( 'the_field' ) ) {
			function the_field( $selector, $post_id = false, $format_value = true ): void {
				Neo_Pulse_Wp_Fields_Api::the_field( $selector, $post_id, $format_value );
			}
		}
		if ( ! function_exists( 'get_fields' ) ) {
			function get_fields( $post_id = false, $format_value = true ) {
				return Neo_Pulse_Wp_Fields_Api::get_fields( $post_id, $format_value );
			}
		}
		if ( ! function_exists( 'get_field_object' ) ) {
			function get_field_object( $selector, $post_id = false, $format_value = true, $load_value = true ) {
				return Neo_Pulse_Wp_Fields_Api::get_field_object( $selector, $post_id, $format_value, $load_value );
			}
		}
		if ( ! function_exists( 'update_field' ) ) {
			function update_field( $selector, $value, $post_id = false ) {
				return Neo_Pulse_Wp_Fields_Api::update_field( $selector, $value, $post_id );
			}
		}
		if ( ! function_exists( 'delete_field' ) ) {
			function delete_field( $selector, $post_id = false ) {
				return Neo_Pulse_Wp_Fields_Api::delete_field( $selector, $post_id );
			}
		}
		if ( ! function_exists( 'have_rows' ) ) {
			function have_rows( $selector, $post_id = false ) {
				return Neo_Pulse_Wp_Fields_Api::have_rows( $selector, $post_id );
			}
		}
		if ( ! function_exists( 'the_row' ) ) {
			function the_row( $format = false ) {
				Neo_Pulse_Wp_Fields_Api::the_row( $format );
			}
		}
		if ( ! function_exists( 'get_row' ) ) {
			function get_row( $format = false ) {
				return Neo_Pulse_Wp_Fields_Api::get_row( $format );
			}
		}
		if ( ! function_exists( 'get_sub_field' ) ) {
			function get_sub_field( $selector, $format_value = true ) {
				return Neo_Pulse_Wp_Fields_Api::get_sub_field( $selector, $format_value );
			}
		}
		if ( ! function_exists( 'update_sub_field' ) ) {
			function update_sub_field( $selector, $value, $post_id = false ) {
				return Neo_Pulse_Wp_Fields_Api::update_sub_field( $selector, $value, $post_id );
			}
		}
		if ( ! function_exists( 'acf_add_local_field_group' ) ) {
			function acf_add_local_field_group( $group ) {
				return Neo_Pulse_Wp_Fields_Api::add_local_field_group( $group );
			}
		}
		if ( ! function_exists( 'acf_add_options_page' ) ) {
			function acf_add_options_page( $page ) {
				return Neo_Pulse_Wp_Fields_Api::add_options_page( $page );
			}
		}
	}

	/** @var array<int, array<string, mixed>> */
	private static $local_groups = array();

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function add_local_field_group( array $group ): bool {
		if ( empty( $group['key'] ) ) {
			return false;
		}
		self::$local_groups[] = $group;
		Neo_Pulse_Wp_Fields_Storage::flush_cache();
		return true;
	}

	/**
	 * @param array<string, mixed> $page Options page config.
	 */
	public static function add_options_page( array $page ): bool {
		return Neo_Pulse_Wp_Fields_Options::register_page( $page );
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 */
	public static function get_field( $selector, $post_id = false, $format_value = true ) {
		$selector = (string) $selector;
		$field    = self::resolve_field( $selector, $post_id );
		list( $id, $is_option ) = self::normalize_post_id( $post_id );
		if ( ! $field ) {
			if ( ! $is_option && $id > 0 && $selector !== '' && metadata_exists( 'post', $id, $selector ) ) {
				$raw = get_post_meta( $id, $selector, true );
				return $format_value ? $raw : $raw;
			}
			return null;
		}
		if ( $is_option ) {
			return Neo_Pulse_Wp_Fields_Values::get_option( $id, $field, $format_value );
		}
		return Neo_Pulse_Wp_Fields_Values::get_value( $id, $field, $format_value );
	}

	public static function the_field( $selector, $post_id = false, $format_value = true ): void {
		$value = self::get_field( $selector, $post_id, $format_value );
		if ( is_array( $value ) ) {
			echo esc_html( wp_json_encode( $value ) );
		} elseif ( is_scalar( $value ) ) {
			echo wp_kses_post( (string) $value );
		}
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 * @return array<string, mixed>
	 */
	public static function get_fields( $post_id = false, $format_value = true ): array {
		list( $id, $is_option ) = self::normalize_post_id( $post_id );
		$screen = $is_option ? array( 'options_page' => $id ) : Neo_Pulse_Wp_Fields_Values::screen_for_post( $id );
		$out    = array();
		foreach ( self::all_groups() as $group ) {
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( isset( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$name = (string) $field['name'];
				if ( $is_option ) {
					$out[ $name ] = Neo_Pulse_Wp_Fields_Values::get_option( $id, $field, $format_value );
				} else {
					$out[ $name ] = Neo_Pulse_Wp_Fields_Values::get_value( $id, $field, $format_value );
				}
			}
		}
		return $out;
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 * @return array<string, mixed>|false|null
	 */
	public static function get_field_object( $selector, $post_id = false, $format_value = true, $load_value = true ) {
		$field = self::resolve_field( (string) $selector, $post_id );
		if ( ! $field ) {
			return null;
		}
		if ( $load_value ) {
			list( $id, $is_option ) = self::normalize_post_id( $post_id );
			if ( $is_option ) {
				$field['value'] = Neo_Pulse_Wp_Fields_Values::get_option( $id, $field, $format_value );
			} else {
				$field['value'] = Neo_Pulse_Wp_Fields_Values::get_value( $id, $field, $format_value );
			}
		}
		return $field;
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 */
	public static function update_field( $selector, $value, $post_id = false ): bool {
		$field = self::resolve_field( (string) $selector, $post_id );
		if ( ! $field ) {
			return false;
		}
		list( $id, $is_option ) = self::normalize_post_id( $post_id );
		if ( $is_option ) {
			Neo_Pulse_Wp_Fields_Values::update_option( $id, $field, $value );
			return true;
		}
		return Neo_Pulse_Wp_Fields_Values::update_value( $id, $field, $value );
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 */
	public static function delete_field( $selector, $post_id = false ): bool {
		$field = self::resolve_field( (string) $selector, $post_id );
		if ( ! $field ) {
			return false;
		}
		list( $id, $is_option ) = self::normalize_post_id( $post_id );
		if ( $is_option ) {
			delete_option( $id . '_' . (string) $field['name'] );
			return true;
		}
		Neo_Pulse_Wp_Fields_Values::delete_value( $id, $field );
		return true;
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 */
	public static function have_rows( $selector, $post_id = false ): bool {
		$key = (string) $selector . ':' . wp_json_encode( $post_id );
		if ( ! isset( self::$row_stack[ $key ] ) ) {
			$rows = self::get_field( $selector, $post_id, false );
			self::$row_stack[ $key ] = array(
				'rows' => is_array( $rows ) ? array_values( $rows ) : array(),
				'i'    => -1,
			);
		}
		$stack = &self::$row_stack[ $key ];
		++$stack['i'];
		return isset( $stack['rows'][ $stack['i'] ] );
	}

	public static function the_row( $format = false ): void {
		unset( $format );
	}

	/**
	 * @return array<string, mixed>|false
	 */
	public static function get_row( $format = false ) {
		unset( $format );
		foreach ( self::$row_stack as $stack ) {
			if ( $stack['i'] >= 0 && isset( $stack['rows'][ $stack['i'] ] ) ) {
				return $stack['rows'][ $stack['i'] ];
			}
		}
		return false;
	}

	public static function get_sub_field( $selector, $format_value = true ) {
		$row = self::get_row( $format_value );
		if ( ! is_array( $row ) ) {
			return null;
		}
		$value = $row[ (string) $selector ] ?? null;
		$field = Neo_Pulse_Wp_Fields_Values::find_field( (string) $selector );
		if ( $field && $format_value ) {
			return Neo_Pulse_Wp_Fields_Registry::format_value( $value, $field, 0 );
		}
		return $value;
	}

	public static function update_sub_field( $selector, $value, $post_id = false ): bool {
		unset( $selector, $value, $post_id );
		return false;
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 * @return array<string, mixed>|null
	 */
	private static function resolve_field( string $selector, $post_id ) {
		list( $id, $is_option ) = self::normalize_post_id( $post_id );
		$context_id = $is_option ? null : $id;
		return Neo_Pulse_Wp_Fields_Values::find_field( $selector, $context_id );
	}

	/**
	 * @param mixed $post_id Post ID or option slug.
	 * @return array{0: int|string, 1: bool} [id, is_option]
	 */
	private static function normalize_post_id( $post_id ): array {
		if ( $post_id === 'option' || $post_id === 'options' ) {
			return array( 'options', true );
		}
		if ( is_string( $post_id ) && strpos( $post_id, 'option_' ) === 0 ) {
			return array( substr( $post_id, 7 ), true );
		}
		if ( is_string( $post_id ) && $post_id !== '' && ! is_numeric( $post_id ) ) {
			return array( $post_id, true );
		}
		if ( false === $post_id || null === $post_id ) {
			global $post;
			$post_id = $post instanceof WP_Post ? (int) $post->ID : 0;
		}
		return array( (int) $post_id, false );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private static function all_groups(): array {
		$groups = Neo_Pulse_Wp_Fields_Storage::get_all_groups( true );
		foreach ( self::$local_groups as $group ) {
			$groups[] = $group;
		}
		return $groups;
	}
}

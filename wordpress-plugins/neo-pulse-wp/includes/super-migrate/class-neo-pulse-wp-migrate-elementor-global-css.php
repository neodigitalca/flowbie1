<?php
/**
 * Elementor active kit globals → NEO Pulse Global CSS mapper.
 *
 * Reads elementor_active_kit + _elementor_page_settings. Does not import page templates or _elementor_data.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Migrate_Elementor_Global_Css {

	const KIT_OPTION = 'elementor_active_kit';

	/**
	 * @return bool
	 */
	public static function kit_available(): bool {
		return self::kit_id() > 0;
	}

	/**
	 * @return int
	 */
	public static function kit_id(): int {
		return (int) get_option( self::KIT_OPTION, 0 );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function read_kit_settings(): array {
		$kit_id = self::kit_id();
		if ( $kit_id < 1 ) {
			return array();
		}
		$settings = get_post_meta( $kit_id, '_elementor_page_settings', true );
		return is_array( $settings ) ? $settings : array();
	}

	/**
	 * Crawl payload for Flo Sheet.
	 *
	 * @return array<string, mixed>
	 */
	public static function crawl_payload(): array {
		$settings = self::read_kit_settings();
		$mapped   = self::map_from_elementor( $settings );

		return array(
			'kit_id'   => self::kit_id(),
			'settings' => $settings,
			'mapped'   => $mapped,
		);
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array<string, mixed>
	 */
	public static function map_from_elementor( array $settings ): array {
		$mapped = array();
		$mapped = array_merge( $mapped, self::map_colors( $settings ) );
		$mapped = array_merge( $mapped, self::map_typography( $settings ) );
		$mapped['gc_custom_css']             = self::map_custom_css( $settings );
		$mapped['gc_elementor_tokens_json']  = wp_json_encode(
			array(
				'system_colors'       => $settings['system_colors'] ?? array(),
				'custom_colors'       => $settings['custom_colors'] ?? array(),
				'system_typography'   => $settings['system_typography'] ?? array(),
				'custom_typography'   => $settings['custom_typography'] ?? array(),
				'custom_css'          => $settings['custom_css'] ?? '',
			)
		);
		$mapped['gc_enabled'] = 1;
		return $mapped;
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array<string, mixed>
	 */
	public static function map_colors( array $settings ): array {
		$out = array(
			'gc_color_primary'   => '',
			'gc_color_secondary' => '',
			'gc_color_accent'    => '',
			'gc_color_text'      => '',
			'gc_custom_colors'   => array(),
		);

		$system = isset( $settings['system_colors'] ) && is_array( $settings['system_colors'] ) ? $settings['system_colors'] : array();
		foreach ( $system as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$id    = sanitize_key( (string) ( $row['_id'] ?? '' ) );
			$color = sanitize_hex_color( (string) ( $row['color'] ?? '' ) );
			if ( ! $color ) {
				continue;
			}
			if ( $id === 'primary' ) {
				$out['gc_color_primary'] = $color;
			} elseif ( $id === 'secondary' ) {
				$out['gc_color_secondary'] = $color;
			} elseif ( $id === 'accent' ) {
				$out['gc_color_accent'] = $color;
			} elseif ( $id === 'text' ) {
				$out['gc_color_text'] = $color;
			}
		}

		$custom = isset( $settings['custom_colors'] ) && is_array( $settings['custom_colors'] ) ? $settings['custom_colors'] : array();
		foreach ( $custom as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$color = sanitize_hex_color( (string) ( $row['color'] ?? '' ) );
			if ( ! $color ) {
				continue;
			}
			$out['gc_custom_colors'][] = array(
				'name'  => sanitize_text_field( (string) ( $row['title'] ?? $row['_id'] ?? '' ) ),
				'color' => $color,
			);
		}

		return $out;
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array<string, mixed>
	 */
	public static function map_typography( array $settings ): array {
		$out = array();

		$targets = array(
			'body' => 'gc_body_',
		);
		for ( $n = 1; $n <= 6; $n++ ) {
			$targets[ 'h' . $n ] = 'gc_h' . $n . '_';
		}

		foreach ( $targets as $token => $prefix ) {
			$row = self::find_typography_token( $settings, $token );
			if ( empty( $row ) ) {
				continue;
			}
			$mapped = self::map_typography_row( $row );
			foreach ( $mapped as $suffix => $value ) {
				if ( $value !== '' ) {
					$out[ $prefix . $suffix ] = $value;
				}
			}
		}

		return $out;
	}

	/**
	 * @param array<string, mixed> $settings
	 * @param string               $token body|h1|h2|...
	 * @return array<string, mixed>
	 */
	public static function find_typography_token( array $settings, string $token ): array {
		$flat_prefix = $token . '_typography_';
		$flat        = array();
		foreach ( $settings as $key => $value ) {
			if ( ! is_string( $key ) || 0 !== strpos( $key, $flat_prefix ) ) {
				continue;
			}
			$suffix = substr( $key, strlen( $flat_prefix ) );
			$flat[ 'typography_' . $suffix ] = $value;
		}
		if ( ! empty( $flat ) ) {
			return $flat;
		}

		$lists = array();
		if ( ! empty( $settings['system_typography'] ) && is_array( $settings['system_typography'] ) ) {
			$lists[] = $settings['system_typography'];
		}
		if ( ! empty( $settings['custom_typography'] ) && is_array( $settings['custom_typography'] ) ) {
			$lists[] = $settings['custom_typography'];
		}

		foreach ( $lists as $list ) {
			foreach ( $list as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$id    = sanitize_key( (string) ( $row['_id'] ?? '' ) );
				$title = strtolower( sanitize_text_field( (string) ( $row['title'] ?? '' ) ) );
				if ( $id === $token || $title === $token || $id === $token . '_typography' ) {
					return $row;
				}
				if ( $token === 'body' && in_array( $id, array( 'primary', 'text', 'body' ), true ) ) {
					return $row;
				}
			}
		}

		return array();
	}

	/**
	 * @param array<string, mixed> $row
	 * @return array{font_family: string, font_size: string, font_weight: string, line_height: string, color: string}
	 */
	public static function map_typography_row( array $row ): array {
		return array(
			'font_family'  => self::typography_value( $row, 'font_family' ),
			'font_size'    => self::format_size( self::typography_value( $row, 'font_size' ), $row, 'font_size' ),
			'font_weight'  => self::typography_value( $row, 'font_weight' ),
			'line_height'  => self::format_size( self::typography_value( $row, 'line_height' ), $row, 'line_height' ),
			'color'        => sanitize_hex_color( self::typography_value( $row, 'color' ) ) ?: '',
		);
	}

	/**
	 * @param array<string, mixed> $row
	 */
	public static function typography_value( array $row, string $prop ): string {
		$key = 'typography_' . $prop;
		if ( ! empty( $row[ $key ] ) ) {
			return sanitize_text_field( (string) $row[ $key ] );
		}
		if ( ! empty( $row[ $prop ] ) ) {
			return sanitize_text_field( (string) $row[ $prop ] );
		}
		return '';
	}

	/**
	 * @param array<string, mixed> $row
	 */
	public static function format_size( string $value, array $row, string $prop ): string {
		if ( $value !== '' ) {
			return $value;
		}
		$key = 'typography_' . $prop;
		if ( ! isset( $row[ $key ] ) || ! is_array( $row[ $key ] ) ) {
			return '';
		}
		$size = (string) ( $row[ $key ]['size'] ?? '' );
		$unit = (string) ( $row[ $key ]['unit'] ?? 'px' );
		if ( $size === '' ) {
			return '';
		}
		return sanitize_text_field( $size . $unit );
	}

	/**
	 * @param array<string, mixed> $settings
	 */
	public static function map_custom_css( array $settings ): string {
		$css = isset( $settings['custom_css'] ) ? (string) $settings['custom_css'] : '';
		if ( $css !== '' ) {
			return $css;
		}

		$kit_id = self::kit_id();
		if ( $kit_id < 1 ) {
			return '';
		}
		$generated = get_post_meta( $kit_id, '_elementor_css', true );
		return is_string( $generated ) ? $generated : '';
	}

	/**
	 * @param array<string, mixed>|null $existing
	 * @return array<string, mixed>
	 */
	public static function build_mapped_values( ?array $existing = null ): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-global-css.php';
		Neo_Pulse_Wp_Global_Css::install();

		$base     = is_array( $existing ) ? $existing : Neo_Pulse_Wp_Global_Css::get_stored_values();
		$settings = self::read_kit_settings();
		$mapped   = self::map_from_elementor( $settings );

		return self::merge_non_empty( $base, $mapped );
	}

	/**
	 * @return array{ok: bool, error?: string, message?: string, stats?: array<string, mixed>}
	 */
	public static function apply( bool $dry = false ): array {
		if ( ! self::kit_available() && ! defined( 'ELEMENTOR_VERSION' ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Elementor kit settings were not found in the database.', 'neo-pulse-wp' ),
			);
		}

		$settings = self::read_kit_settings();
		if ( empty( $settings ) && ! self::kit_available() ) {
			return array(
				'ok'      => true,
				'message' => __( 'No Elementor global style data to import.', 'neo-pulse-wp' ),
				'stats'   => array( 'skipped' => 1 ),
			);
		}

		$values = self::build_mapped_values();
		if ( ! self::values_have_data( $values ) ) {
			return array(
				'ok'      => true,
				'message' => __( 'No Elementor global style data to import.', 'neo-pulse-wp' ),
				'stats'   => array( 'skipped' => 1 ),
			);
		}

		if ( $dry ) {
			return array(
				'ok'      => true,
				'message' => __( 'Dry run: would import Elementor global styles.', 'neo-pulse-wp' ),
				'stats'   => array( 'would_import' => 1 ),
			);
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-global-css.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-values.php';

		Neo_Pulse_Wp_Global_Css::install();
		$field_map = Neo_Pulse_Wp_Global_Css::get_field_map();
		$updated   = 0;

		foreach ( $values as $name => $value ) {
			if ( ! isset( $field_map[ $name ] ) ) {
				continue;
			}
			Neo_Pulse_Wp_Fields_Values::update_option( Neo_Pulse_Wp_Global_Css::OPTION_SLUG, $field_map[ $name ], $value );
			++$updated;
		}

		return array(
			'ok'      => true,
			'message' => __( 'Elementor global styles imported into Global CSS.', 'neo-pulse-wp' ),
			'stats'   => array(
				'updated' => $updated,
				'enabled' => ! empty( $values['gc_enabled'] ) ? 1 : 0,
			),
		);
	}

	/**
	 * @param array<string, mixed> $values
	 */
	public static function values_have_data( array $values ): bool {
		unset( $values['gc_enabled'], $values['gc_elementor_tokens_json'] );
		foreach ( $values as $value ) {
			if ( is_array( $value ) && ! empty( $value ) ) {
				return true;
			}
			if ( is_string( $value ) && trim( $value ) !== '' ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string, mixed> $base
	 * @param array<string, mixed> $overlay
	 * @return array<string, mixed>
	 */
	public static function merge_non_empty( array $base, array $overlay ): array {
		foreach ( $overlay as $key => $value ) {
			if ( is_array( $value ) ) {
				if ( self::is_list_array( $value ) ) {
					if ( ! empty( $value ) ) {
						$base[ $key ] = $value;
					}
				} else {
					if ( ! isset( $base[ $key ] ) || ! is_array( $base[ $key ] ) ) {
						$base[ $key ] = array();
					}
					$base[ $key ] = self::merge_non_empty( $base[ $key ], $value );
				}
			} elseif ( self::is_meaningful_scalar( $value ) ) {
				$base[ $key ] = $value;
			}
		}
		return $base;
	}

	/**
	 * @param mixed $value
	 */
	private static function is_meaningful_scalar( $value ): bool {
		if ( is_bool( $value ) ) {
			return true;
		}
		if ( is_numeric( $value ) ) {
			return true;
		}
		return is_string( $value ) && $value !== '';
	}

	/**
	 * @param array<string|int, mixed> $array
	 */
	private static function is_list_array( array $array ): bool {
		if ( array() === $array ) {
			return true;
		}
		return array_keys( $array ) === range( 0, count( $array ) - 1 );
	}
}

<?php
/**
 * Speed module settings JSON import and bundled presets.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Applies exported Speed JSON or built-in presets (Elementor-safe).
 */
class Neo_Pulse_Wp_Speed_Import {

	const PRESET_ELEMENTOR_SAFE = 'elementor-safe';

	const PRESET_DISABLE = 'disable';

	/**
	 * @return array<string, string>
	 */
	public static function preset_labels(): array {
		return array(
			self::PRESET_ELEMENTOR_SAFE => __( 'Elementor-safe (guest-safe transforms off)', 'neo-pulse-wp' ),
			self::PRESET_DISABLE        => __( 'Disable Speed (diagnostic)', 'neo-pulse-wp' ),
		);
	}

	/**
	 * @param string $preset_id Preset identifier.
	 * @return string Absolute path to preset JSON.
	 */
	public static function preset_file_path( string $preset_id ): string {
		$preset_id = sanitize_key( $preset_id );
		return NEO_PULSE_WP_PLUGIN_DIR . 'presets/speed-' . $preset_id . '.json';
	}

	/**
	 * @param string $preset_id Preset identifier.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function load_preset( string $preset_id ) {
		$path = self::preset_file_path( $preset_id );
		if ( ! is_readable( $path ) ) {
			return new WP_Error( 'neo-pulse_speed_preset_missing', __( 'Preset file is missing from the plugin.', 'neo-pulse-wp' ) );
		}
		$raw = file_get_contents( $path );
		if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
			return new WP_Error( 'neo-pulse_speed_preset_empty', __( 'Preset file is empty.', 'neo-pulse-wp' ) );
		}
		$raw = self::normalize_json_text( $raw );
		return self::parse_json( $raw );
	}

	/**
	 * @param string $json Raw JSON text.
	 * @return array<string, mixed>|WP_Error Normalized import payload.
	 */
	public static function parse_json( string $json ) {
		$json = self::normalize_json_text( $json );
		if ( $json === '' ) {
			return new WP_Error( 'neo-pulse_speed_import_empty', __( 'JSON file is empty.', 'neo-pulse-wp' ) );
		}

		$data = json_decode( $json, true );
		if ( ! is_array( $data ) ) {
			return new WP_Error( 'neo-pulse_speed_import_invalid', __( 'Invalid JSON. Use a file exported from NEO Pulse → Speed → Cache.', 'neo-pulse-wp' ) );
		}

		$data = Neo_Pulse_Wp_Speed_Export::redact_secrets( $data );

		if ( isset( $data['speed'] ) && is_array( $data['speed'] ) ) {
			$speed = $data['speed'];
		} elseif ( self::looks_like_speed_config( $data ) ) {
			$speed = $data;
			$data  = array( 'speed' => $speed );
		} else {
			return new WP_Error( 'neo-pulse_speed_import_no_speed', __( 'JSON does not contain a "speed" settings object.', 'neo-pulse-wp' ) );
		}

		$out = array( 'speed' => $speed );
		if ( isset( $data['speed_images'] ) && is_array( $data['speed_images'] ) ) {
			$out['speed_images'] = $data['speed_images'];
		}

		return $out;
	}

	/**
	 * @param array<string, mixed> $payload Parsed import payload.
	 * @param array<string, bool>  $options import_speed, import_speed_images.
	 * @return array{success:bool,message:string}|WP_Error
	 */
	public static function apply( array $payload, array $options = array() ) {
		$import_speed        = ! isset( $options['import_speed'] ) || ! empty( $options['import_speed'] );
		$import_speed_images = ! empty( $options['import_speed_images'] );

		$parts = array();

		if ( $import_speed ) {
			if ( empty( $payload['speed'] ) || ! is_array( $payload['speed'] ) ) {
				return new WP_Error( 'neo-pulse_speed_import_no_speed', __( 'Nothing to import for Speed settings.', 'neo-pulse-wp' ) );
			}
			$config = Neo_Pulse_Wp_Speed_Settings::sanitize_config(
				Neo_Pulse_Wp_Speed_Settings::merge_with_defaults( $payload['speed'] )
			);
			if ( ! empty( $config['enabled'] ) ) {
				$config = Neo_Pulse_Wp_Speed_Settings::apply_simple_enabled_config( $config );
			}
			Neo_Pulse_Wp_Speed_Settings::save_config( $config );
			$parts[] = __( 'Speed', 'neo-pulse-wp' );
		}

		if ( $import_speed_images && ! empty( $payload['speed_images'] ) && is_array( $payload['speed_images'] ) ) {
			$images = Neo_Pulse_Wp_Speed_Image_Settings::sanitize_config(
				wp_parse_args( $payload['speed_images'], Neo_Pulse_Wp_Speed_Image_Settings::default_config() )
			);
			Neo_Pulse_Wp_Speed_Image_Settings::save_config( $images );
			$parts[] = __( 'Speed Images', 'neo-pulse-wp' );
		}

		if ( empty( $parts ) ) {
			return new WP_Error( 'neo-pulse_speed_import_nothing', __( 'No settings were applied.', 'neo-pulse-wp' ) );
		}

		if ( class_exists( 'Neo_Pulse_Wp_Speed', false ) ) {
			Neo_Pulse_Wp_Speed::flush_all_wordpress();
		}
		Neo_Pulse_Wp_Speed_Cache::ensure_dirs();

		update_option( Neo_Pulse_Wp_Speed_Settings::ELEMENTOR_SAFE_MIGRATION_KEY, '1', false );

		return array(
			'success' => true,
			'message' => sprintf(
				/* translators: %s: comma-separated section names */
				__( 'Imported %s settings and ran a full WordPress + NEO Pulse cache flush. Test in a private window.', 'neo-pulse-wp' ),
				implode( ', ', $parts )
			),
		);
	}

	/**
	 * @param string $preset_id Preset identifier.
	 * @return array{success:bool,message:string}|WP_Error
	 */
	public static function apply_preset( string $preset_id ) {
		$preset_id = sanitize_key( $preset_id );
		if ( ! isset( self::preset_labels()[ $preset_id ] ) ) {
			return new WP_Error( 'neo-pulse_speed_preset_unknown', __( 'Unknown preset.', 'neo-pulse-wp' ) );
		}

		$payload = self::load_preset( $preset_id );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$result = self::apply(
			$payload,
			array(
				'import_speed'        => true,
				'import_speed_images' => ! empty( $payload['speed_images'] ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$result['message'] = sprintf(
			/* translators: %s: preset label */
			__( 'Applied preset: %s. %s', 'neo-pulse-wp' ),
			self::preset_labels()[ $preset_id ],
			$result['message']
		);

		return $result;
	}

	/**
	 * @param array<string, mixed> $data Decoded JSON root.
	 */
	/**
	 * Strip BOM and any bytes before the opening JSON brace/bracket.
	 */
	public static function normalize_json_text( string $json ): string {
		$json = preg_replace( '/^\xEF\xBB\xBF/', '', $json );
		if ( ! is_string( $json ) ) {
			return '';
		}
		if ( preg_match( '/[\{\[]/', $json, $match, PREG_OFFSET_CAPTURE ) ) {
			$json = substr( $json, (int) $match[0][1] );
		}
		return trim( $json );
	}

	/**
	 * @param array<string, mixed> $data Decoded JSON root.
	 */
	private static function looks_like_speed_config( array $data ): bool {
		$keys = array( 'enabled', 'optimize_css', 'aggregate_css', 'minify_html' );
		foreach ( $keys as $key ) {
			if ( array_key_exists( $key, $data ) ) {
				return true;
			}
		}
		return false;
	}
}

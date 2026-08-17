<?php
/**
 * Local JSON sync (acf-json folder compatibility).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Local_Json {

	/**
	 * @return array<int, string>
	 */
	public static function get_load_paths(): array {
		$paths = array();
		if ( function_exists( 'get_stylesheet_directory' ) ) {
			$paths[] = trailingslashit( get_stylesheet_directory() ) . 'acf-json';
		}
		if ( function_exists( 'get_template_directory' ) && get_template_directory() !== get_stylesheet_directory() ) {
			$paths[] = trailingslashit( get_template_directory() ) . 'acf-json';
		}
		$paths[] = trailingslashit( WP_CONTENT_DIR ) . 'neo-pulse-fields-json';
		$paths[] = trailingslashit( NEO_PULSE_WP_PLUGIN_DIR ) . 'includes/fields/fixtures';
		return apply_filters( 'neo_pulse_wp_fields_json_load_paths', $paths );
	}

	public static function get_save_path(): string {
		$path = trailingslashit( get_stylesheet_directory() ) . 'acf-json';
		return apply_filters( 'neo_pulse_wp_fields_json_save_path', $path );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function load_all(): array {
		$items    = array();
		$patterns = array(
			'group_*.json',
			'post_type_*.json',
			'taxonomy_*.json',
			'ui_options_page_*.json',
			'options_page_*.json',
		);

		foreach ( self::get_load_paths() as $dir ) {
			if ( ! is_dir( $dir ) ) {
				continue;
			}
			foreach ( $patterns as $pattern ) {
				$files = glob( trailingslashit( $dir ) . $pattern );
				if ( ! is_array( $files ) ) {
					continue;
				}
				foreach ( $files as $file ) {
					$raw = file_get_contents( $file );
					if ( ! is_string( $raw ) || $raw === '' ) {
						continue;
					}
					$data = json_decode( $raw, true );
					if ( is_array( $data ) && ! empty( $data['key'] ) ) {
						$items[] = $data;
					}
				}
			}
		}

		return $items;
	}

	/**
	 * @param array<string, mixed> $group Field group.
	 */
	public static function sync_group( array $group ): void {
		if ( empty( $group['key'] ) ) {
			return;
		}
		$dir = self::get_save_path();
		if ( ! wp_mkdir_p( $dir ) ) {
			return;
		}
		$file = trailingslashit( $dir ) . sanitize_file_name( (string) $group['key'] ) . '.json';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		file_put_contents( $file, wp_json_encode( $group, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) );
	}

	public static function delete_group_file( string $key ): void {
		$file = trailingslashit( self::get_save_path() ) . sanitize_file_name( $key ) . '.json';
		if ( is_readable( $file ) ) {
			wp_delete_file( $file );
		}
	}
}

<?php
/**
 * Fix Elementor element caching for widgets that use dynamic tags (Icon List bug).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Elementor_Cache_Fix {

	const OPTION_KEY = 'flowbie_wp_elementor_dynamic_cache_fixed';

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		if ( self::$booted ) {
			return;
		}
		add_action( 'init', array( __CLASS__, 'maybe_fix_all_documents' ), 25 );
		add_filter( 'elementor/element/is_dynamic_content', array( __CLASS__, 'mark_icon_list_dynamic' ), 10, 3 );
		self::$booted = true;
	}

	/**
	 * Icon List + Element Caching repeats the first item for every row (Elementor #28137).
	 *
	 * @param array<string, mixed> $raw_data Element raw data.
	 */
	public static function mark_icon_list_dynamic( bool $is_dynamic, array $raw_data, $element ): bool {
		unset( $element );
		if ( $is_dynamic ) {
			return true;
		}
		if ( (string) ( $raw_data['widgetType'] ?? '' ) !== 'icon-list' ) {
			return false;
		}
		return self::settings_have_dynamic_tags( isset( $raw_data['settings'] ) && is_array( $raw_data['settings'] ) ? $raw_data['settings'] : array() );
	}

	public static function maybe_fix_all_documents(): void {
		if ( get_option( self::OPTION_KEY, false ) ) {
			return;
		}
		self::fix_all_documents();
		update_option( self::OPTION_KEY, 1, false );
	}

	/**
	 * Disable element caching on dynamic widgets and clear Elementor output cache.
	 *
	 * @return array{documents_processed: int, documents_patched: int}
	 */
	public static function fix_all_documents(): array {
		if ( ! class_exists( 'Flowbie_Wp_Migrate_Elementor_Dynamic_Tags', false ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-dynamic-tags.php';
		}

		Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::repair_all_documents();

		$processed = 0;
		$patched   = 0;
		foreach ( Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::elementor_document_ids() as $post_id ) {
			++$processed;
			if ( self::fix_post( (int) $post_id ) ) {
				++$patched;
			}
		}

		self::clear_all_element_output_cache();
		Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::clear_elementor_cache();

		return array(
			'documents_processed' => $processed,
			'documents_patched'   => $patched,
		);
	}

	public static function fix_post( int $post_id ): bool {
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return false;
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return false;
		}

		$fixed = self::fix_elements_cache_settings( $data );
		if ( ! self::elements_changed( $data, $fixed ) ) {
			delete_post_meta( $post_id, '_elementor_element_cache' );
			return false;
		}

		$json = wp_json_encode( $fixed );
		if ( ! is_string( $json ) ) {
			return false;
		}

		update_post_meta( $post_id, '_elementor_data', wp_slash( $json ) );
		delete_post_meta( $post_id, '_elementor_element_cache' );
		return true;
	}

	public static function clear_all_element_output_cache(): void {
		global $wpdb;
		if ( ! isset( $wpdb ) ) {
			return;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE meta_key = '_elementor_element_cache'" );
	}

	/**
	 * @param array<int, array<string, mixed>> $elements
	 * @return array<int, array<string, mixed>>
	 */
	public static function fix_elements_cache_settings( array $elements ): array {
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( ! empty( $element['settings'] ) && is_array( $element['settings'] ) ) {
				if ( self::settings_have_dynamic_tags( $element['settings'] ) ) {
					// Elementor UI label "Inactive" = value "yes".
					$element['settings']['_element_cache'] = 'yes';
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$element['elements'] = self::fix_elements_cache_settings( $element['elements'] );
			}
		}
		unset( $element );
		return $elements;
	}

	/**
	 * @param array<int|string, mixed> $settings
	 */
	public static function settings_have_dynamic_tags( array $settings ): bool {
		foreach ( $settings as $key => $value ) {
			if ( is_string( $key ) && 0 === strpos( $key, '__dynamic__' ) ) {
				return true;
			}
			if ( is_string( $value ) && strpos( $value, '[elementor-tag' ) !== false ) {
				return true;
			}
			if ( is_array( $value ) && self::settings_have_dynamic_tags( $value ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int, array<string, mixed>> $before
	 * @param array<int, array<string, mixed>> $after
	 */
	private static function elements_changed( array $before, array $after ): bool {
		return wp_json_encode( $before ) !== wp_json_encode( $after );
	}
}

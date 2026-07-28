<?php
/**
 * Flowbie native module snapshot adapter (always available).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Migrate_Source_Flowbie_Native implements Flowbie_Wp_Migrate_Adapter {

	public function get_id(): string {
		return 'flowbie_native';
	}

	public function get_macro_group(): string {
		return 'general';
	}

	public function get_label(): string {
		return __( 'Flowbie WP modules', 'flowbie-wp' );
	}

	public function is_available(): bool {
		return true;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function detect(): array {
		return array(
			'active' => true,
			'modules'=> array(
				'speed'    => class_exists( 'Flowbie_Wp_Speed_Export', false ),
				'scripts'  => class_exists( 'Flowbie_Wp_Script_Manager', false ),
				'sitemap'  => class_exists( 'Flowbie_Wp_Sitemap_Settings', false ),
				'overseer' => class_exists( 'Flowbie_Wp_Overseer', false ),
				'search'   => class_exists( 'Flowbie_Wp_Search', false ),
			),
		);
	}

	public function get_steps( string $phase ): array {
		if ( 'crawl' === $phase ) {
			return array(
				array(
					'id'    => 'flowbie_native_crawl',
					'label' => __( 'Snapshot Flowbie module settings', 'flowbie-wp' ),
					'total' => 1,
				),
			);
		}
		if ( 'apply' === $phase ) {
			return array(
				array(
					'id'    => 'flowbie_native_flush_cache',
					'label' => __( 'Flush Elementor & site caches', 'flowbie-wp' ),
					'total' => 1,
				),
			);
		}
		return array();
	}

	/**
	 * @param array<string, mixed> $sheet   Flo Sheet.
	 * @param array<string, mixed> $context Job context.
	 */
	public function run_step( string $step_id, string $phase, array &$sheet, array $context ): array {
		if ( 'flowbie_native_flush_cache' === $step_id && 'apply' === $phase ) {
			if ( ! empty( $context['dry_run'] ) ) {
				return array(
					'ok'      => true,
					'done'    => true,
					'message' => __( 'Dry run — cache flush skipped.', 'flowbie-wp' ),
				);
			}

			if ( ! class_exists( 'Flowbie_Wp_Super_Migrate_Cache', false ) ) {
				require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-super-migrate-cache.php';
			}

			$stats = Flowbie_Wp_Super_Migrate_Cache::flush_after_import();

			return array(
				'ok'      => true,
				'done'    => true,
				'message' => sprintf(
					/* translators: 1: Elementor documents processed, 2: documents patched */
					__( 'Caches cleared — %1$d Elementor document(s) processed, %2$d patched for dynamic output.', 'flowbie-wp' ),
					(int) ( $stats['elementor_documents_processed'] ?? 0 ),
					(int) ( $stats['elementor_documents_patched'] ?? 0 )
				),
				'stats'   => $stats,
			);
		}

		unset( $context );
		if ( 'flowbie_native_crawl' !== $step_id || 'crawl' !== $phase ) {
			return array(
				'ok'    => false,
				'error' => __( 'Unknown Flowbie native step.', 'flowbie-wp' ),
			);
		}

		$native = array();

		if ( class_exists( 'Flowbie_Wp_Speed_Export', false ) ) {
			$native['speed'] = Flowbie_Wp_Speed_Export::collect();
		}
		if ( class_exists( 'Flowbie_Wp_Sitemap_Settings', false ) ) {
			$native['sitemap'] = Flowbie_Wp_Sitemap_Settings::get_config();
		}
		if ( class_exists( 'Flowbie_Wp_Overseer', false ) ) {
			$native['overseer'] = Flowbie_Wp_Overseer::get_settings();
		}
		if ( class_exists( 'Flowbie_Wp_Search', false ) ) {
			$native['search'] = Flowbie_Wp_Search::get_search_settings();
		}
		if ( class_exists( 'Flowbie_Wp_Script_Manager', false ) ) {
			global $wpdb;
			$table = Flowbie_Wp_Script_Manager::table_name();
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM {$table} WHERE status != 'trash' ORDER BY id ASC" );
			if ( is_array( $rows ) ) {
				$json = Flowbie_Wp_Script_Manager_Import::build_json_export( $rows );
				$native['scripts_export'] = json_decode( $json, true );
			}
		}
		if ( class_exists( 'Flowbie_Wp_Fields_Import_Export', false ) ) {
			$json = Flowbie_Wp_Fields_Import_Export::export_json_string();
			$native['fields_export'] = json_decode( $json, true );
		}

		$sheet['sheets']['flowbie_native'] = $native;

		if ( ! empty( $native['speed']['speed'] ) && is_array( $native['speed']['speed'] ) ) {
			$sheet['sheets']['speed'] = array_merge(
				isset( $sheet['sheets']['speed'] ) && is_array( $sheet['sheets']['speed'] ) ? $sheet['sheets']['speed'] : array(),
				$native['speed']['speed']
			);
		}
		if ( ! empty( $native['sitemap'] ) && is_array( $native['sitemap'] ) ) {
			$sheet['sheets']['sitemap'] = $native['sitemap'];
		}

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => __( 'Flowbie native settings snapshotted.', 'flowbie-wp' ),
		);
	}
}

<?php
/**
 * Super Migrate job orchestrator.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-flo-sheet.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-super-import-plugins.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-super-migrate-registry.php';

class Flowbie_Wp_Super_Migrate {

	const JOB_TTL       = 3600;
	const TRANSIENT_KEY = 'flowbie_wp_super_migrate_';

	/**
	 * @return array<string, mixed>
	 */
	public static function get_plan_preview(): array {
		$sources = Flowbie_Wp_Super_Migrate_Registry::scan_sources();
		$crawl   = Flowbie_Wp_Super_Migrate_Registry::build_plan( array( 'crawl' ) );
		$apply   = Flowbie_Wp_Super_Migrate_Registry::build_plan( array( 'apply' ) );

		return array(
			'ok'      => true,
			'sources' => $sources,
			'crawl'   => $crawl,
			'apply'   => $apply,
			'sheet'   => self::sheet_summary( Flowbie_Wp_Flo_Sheet::get() ),
		);
	}

	/**
	 * @param array<string, mixed> $params Start params.
	 * @return array<string, mixed>
	 */
	public static function start_job( array $params ): array {
		$phases = isset( $params['phases'] ) && is_array( $params['phases'] )
			? array_values( array_intersect( array_map( 'sanitize_key', $params['phases'] ), array( 'crawl', 'apply' ) ) )
			: array( 'crawl', 'apply' );

		if ( empty( $phases ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'No valid phases selected.', 'flowbie-wp' ),
			);
		}

		$plan = Flowbie_Wp_Super_Migrate_Registry::build_plan( $phases );
		if ( empty( $plan['micro'] ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Nothing to import — no active third-party sources detected.', 'flowbie-wp' ),
			);
		}

		$sheet = Flowbie_Wp_Flo_Sheet::empty_sheet();
		$sheet = Flowbie_Wp_Flo_Sheet::touch_collected( $sheet );
		$sheet['sources_detected'] = Flowbie_Wp_Super_Migrate_Registry::scan_sources();
		Flowbie_Wp_Flo_Sheet::save( $sheet );

		$job_id = self::normalize_job_id( 'sm_' . wp_generate_password( 12, false, false ) );

		$job = array(
			'job_id'     => $job_id,
			'status'     => 'running',
			'phase'      => $phases[0],
			'phases'     => $phases,
			'dry_run'    => ! empty( $params['dry_run'] ),
			'macro'      => $plan['macro'],
			'micro'      => $plan['micro'],
			'step_index' => 0,
			'errors'     => array(),
			'started_at' => gmdate( 'c' ),
		);

		self::persist_job( $job_id, $job );

		return array(
			'ok'     => true,
			'job_id' => $job_id,
			'job'    => self::public_job( $job ),
		);
	}

	/**
	 * @param string               $job_id Job id.
	 * @param array<string, mixed> $params Step params.
	 * @return array<string, mixed>
	 */
	public static function run_step( string $job_id, array $params = array() ): array {
		$batch    = ! empty( $params['parallel'] );
		$max_pass = $batch ? 32 : 1;
		$last     = null;

		for ( $pass = 0; $pass < $max_pass; $pass++ ) {
			$last = self::run_step_once( $job_id );
			if ( empty( $last['ok'] ) ) {
				break;
			}

			$job = self::load_job( $job_id );
			if ( null === $job || in_array( $job['status'] ?? '', array( 'done', 'error' ), true ) ) {
				break;
			}

			$idx = (int) ( $job['step_index'] ?? 0 );
			if ( isset( $job['micro'][ $idx ] ) && 'running' === ( $job['micro'][ $idx ]['status'] ?? '' ) ) {
				break;
			}

			if ( ! $batch ) {
				break;
			}
		}

		if ( null === $last ) {
			return array(
				'ok'    => false,
				'error' => __( 'Import job expired or not found.', 'flowbie-wp' ),
			);
		}

		if ( $batch && null !== ( $job = self::load_job( $job_id ) ) ) {
			$last['job'] = self::public_job( $job );
		}

		return $last;
	}

	/**
	 * Execute one micro-step iteration (may be a partial batch within a step).
	 *
	 * @param string $job_id Job id.
	 * @return array<string, mixed>
	 */
	private static function run_step_once( string $job_id ): array {
		$job = self::load_job( $job_id );
		if ( null === $job ) {
			return array(
				'ok'    => false,
				'error' => __( 'Import job expired or not found.', 'flowbie-wp' ),
			);
		}

		if ( in_array( $job['status'], array( 'done', 'error' ), true ) ) {
			return array(
				'ok'  => true,
				'job' => self::public_job( $job ),
			);
		}

		$index = (int) ( $job['step_index'] ?? 0 );
		if ( ! isset( $job['micro'][ $index ] ) ) {
			$job['status'] = 'done';
			self::persist_job( $job_id, $job );
			return array(
				'ok'      => true,
				'job'     => self::public_job( $job ),
				'message' => __( 'Super Import complete.', 'flowbie-wp' ),
			);
		}

		$step = &$job['micro'][ $index ];
		$step['status'] = 'running';

		$adapter = Flowbie_Wp_Super_Migrate_Registry::get_adapter( (string) ( $step['adapter'] ?? '' ) );
		if ( ! $adapter ) {
			$step['status'] = 'error';
			$job['errors'][] = sprintf(
				/* translators: %s: adapter id */
				__( 'Unknown adapter: %s', 'flowbie-wp' ),
				(string) ( $step['adapter'] ?? '' )
			);
			++$job['step_index'];
			self::persist_job( $job_id, $job );
			return array(
				'ok'    => false,
				'error' => end( $job['errors'] ),
				'job'   => self::public_job( $job ),
			);
		}

		$sheet = Flowbie_Wp_Flo_Sheet::get();
		$context = array(
			'dry_run'       => ! empty( $job['dry_run'] ),
			'batch_offset'  => (int) ( $step['batch_offset'] ?? 0 ),
			'job_id'        => $job_id,
		);

		$result = $adapter->run_step(
			(string) $step['id'],
			(string) ( $step['phase'] ?? 'crawl' ),
			$sheet,
			$context
		);

		$sheet = Flowbie_Wp_Flo_Sheet::touch_collected( $sheet );
		if ( ! empty( $result['stats'] ) && is_array( $result['stats'] ) ) {
			Flowbie_Wp_Flo_Sheet::append_apply_log(
				$sheet,
				array(
					'step'    => $step['id'],
					'adapter' => $step['adapter'],
					'phase'   => $step['phase'],
					'stats'   => $result['stats'],
					'message' => isset( $result['message'] ) ? (string) $result['message'] : '',
				)
			);
		}
		Flowbie_Wp_Flo_Sheet::save( $sheet );

		if ( empty( $result['ok'] ) ) {
			$step['status'] = 'error';
			if ( ! empty( $result['error'] ) ) {
				$job['errors'][] = (string) $result['error'];
			}
			$job['status'] = 'error';
			self::recompute_macro( $job );
			self::persist_job( $job_id, $job );
			return array(
				'ok'    => false,
				'error' => $result['error'] ?? __( 'Step failed.', 'flowbie-wp' ),
				'job'   => self::public_job( $job ),
			);
		}

		if ( empty( $result['done'] ) ) {
			$step['batch_offset'] = (int) ( $step['batch_offset'] ?? 0 ) + self::batch_increment( $step );
			$step['completed']    = min( (int) ( $step['completed'] ?? 0 ) + 1, (int) ( $step['total'] ?? 1 ) );
			$step['status']       = 'running';
		} else {
			$step['status']    = 'done';
			$step['completed'] = (int) ( $step['total'] ?? 1 );
			++$job['step_index'];
		}

		self::recompute_macro( $job );

		if ( (int) $job['step_index'] >= count( $job['micro'] ) ) {
			$job['status'] = 'done';
		}

		self::persist_job( $job_id, $job );

		return array(
			'ok'      => true,
			'job'     => self::public_job( $job ),
			'message' => isset( $result['message'] ) ? (string) $result['message'] : '',
			'step'    => array(
				'id'     => $step['id'],
				'status' => $step['status'],
			),
		);
	}

	/**
	 * @param string $job_id Job id.
	 * @return array<string, mixed>|null
	 */
	public static function get_status( string $job_id ): ?array {
		$job = self::load_job( $job_id );
		if ( null === $job ) {
			return null;
		}
		return self::public_job( $job );
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 * @return array<string, mixed>
	 */
	public static function sheet_summary( array $sheet ): array {
		$sheets = isset( $sheet['sheets'] ) && is_array( $sheet['sheets'] ) ? $sheet['sheets'] : array();
		return array(
			'collectedAt' => $sheet['collectedAt'] ?? '',
			'counts'      => array(
				'field_groups' => count( isset( $sheets['fields']['groups'] ) && is_array( $sheets['fields']['groups'] ) ? $sheets['fields']['groups'] : array() ),
				'redirects'    => count( isset( $sheets['redirects'] ) && is_array( $sheets['redirects'] ) ? $sheets['redirects'] : array() ),
				'scripts'      => count( isset( $sheets['scripts'] ) && is_array( $sheets['scripts'] ) ? $sheets['scripts'] : array() ),
				'seo_meta'     => count( isset( $sheets['seo_meta']['posts'] ) && is_array( $sheets['seo_meta']['posts'] ) ? $sheets['seo_meta']['posts'] : array() ),
				'field_values' => count( isset( $sheets['field_values']['posts'] ) && is_array( $sheets['field_values']['posts'] ) ? $sheets['field_values']['posts'] : array() ),
			),
		);
	}

	/**
	 * @param string $json Flo Sheet JSON.
	 * @param bool   $dry  Dry run apply only.
	 * @return array<string, mixed>
	 */
	public static function import_flo_sheet( string $json, bool $dry = false ): array {
		$parsed = Flowbie_Wp_Flo_Sheet::from_json( $json );
		if ( empty( $parsed['ok'] ) || empty( $parsed['sheet'] ) ) {
			return array(
				'ok'    => false,
				'error' => $parsed['error'] ?? __( 'Invalid Flo Sheet.', 'flowbie-wp' ),
			);
		}

		Flowbie_Wp_Flo_Sheet::save( $parsed['sheet'] );
		if ( class_exists( 'Flowbie_Wp_Seo_Builder', false ) ) {
			Flowbie_Wp_Seo_Builder::import_flo_sheet_blocks( $parsed['sheet'] );
		}

		return self::start_job(
			array(
				'phases'  => array( 'apply' ),
				'dry_run' => $dry,
			)
		);
	}

	/**
	 * @param array<string, mixed> $step Micro step.
	 */
	private static function batch_increment( array $step ): int {
		$id = (string) ( $step['id'] ?? '' );
		if ( strpos( $id, 'redirect' ) !== false ) {
			return Flowbie_Wp_Migrate_Source_Rank_Math::BATCH_REDIRECTS;
		}
		if ( strpos( $id, 'dynamic_tags' ) !== false ) {
			return Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::BATCH_POSTS;
		}
		if ( strpos( $id, 'meta' ) !== false || strpos( $id, 'values' ) !== false ) {
			return 50;
		}
		if ( strpos( $id, 'script' ) !== false ) {
			return Flowbie_Wp_Migrate_Source_Hfcm::BATCH_SCRIPTS;
		}
		return 1;
	}

	/**
	 * @param array<string, mixed> $job Job state.
	 */
	private static function recompute_macro( array &$job ): void {
		if ( empty( $job['macro'] ) || ! is_array( $job['macro'] ) ) {
			return;
		}
		foreach ( $job['macro'] as &$macro ) {
			$macro_id  = (string) ( $macro['id'] ?? '' );
			$completed = 0;
			$total     = 0;
			foreach ( $job['micro'] as $micro ) {
				if ( (string) ( $micro['macro'] ?? '' ) !== $macro_id ) {
					continue;
				}
				++$total;
				if ( ( $micro['status'] ?? '' ) === 'done' ) {
					++$completed;
				}
			}
			$macro['total']     = $total;
			$macro['completed'] = $completed;
		}
		unset( $macro );
	}

	/**
	 * Adapter ids whose import steps all completed successfully.
	 *
	 * @param array<string, mixed> $job Job state.
	 * @return array<int, string>
	 */
	public static function imported_adapter_ids_from_job( array $job ): array {
		if ( empty( $job['micro'] ) || ! is_array( $job['micro'] ) ) {
			return array();
		}

		$by_adapter = array();
		foreach ( $job['micro'] as $step ) {
			if ( ! is_array( $step ) ) {
				continue;
			}
			$adapter = sanitize_key( (string) ( $step['adapter'] ?? '' ) );
			if ( $adapter === '' || 'flowbie_native' === $adapter ) {
				continue;
			}
			if ( ! isset( $by_adapter[ $adapter ] ) ) {
				$by_adapter[ $adapter ] = array(
					'done'  => 0,
					'total' => 0,
				);
			}
			++$by_adapter[ $adapter ]['total'];
			if ( ( $step['status'] ?? '' ) === 'done' ) {
				++$by_adapter[ $adapter ]['done'];
			}
		}

		$imported = array();
		foreach ( $by_adapter as $adapter => $counts ) {
			if ( $counts['total'] > 0 && $counts['done'] === $counts['total'] ) {
				$imported[] = $adapter;
			}
		}

		return array_values( array_unique( $imported ) );
	}

	/**
	 * @param string               $job_id        Completed job id.
	 * @param array<int, string>   $plugin_files  Plugin bootstrap paths to deactivate.
	 * @return array{ok: bool, deactivated?: array<int, string>, error?: string}
	 */
	public static function deactivate_imported_conflicts( string $job_id, array $plugin_files ): array {
		$job = self::load_job( $job_id );
		if ( null === $job ) {
			return array(
				'ok'    => false,
				'error' => __( 'Import job expired or not found.', 'flowbie-wp' ),
			);
		}
		if ( ( $job['status'] ?? '' ) !== 'done' ) {
			return array(
				'ok'    => false,
				'error' => __( 'Import must finish before plugins can be deactivated.', 'flowbie-wp' ),
			);
		}
		if ( ! empty( $job['dry_run'] ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Dry-run imports cannot deactivate plugins.', 'flowbie-wp' ),
			);
		}

		return Flowbie_Wp_Super_Import_Plugins::deactivate_for_adapters(
			self::imported_adapter_ids_from_job( $job ),
			$plugin_files
		);
	}

	/**
	 * @return array{ok: bool, activated?: array<int, string>, flowbie_deactivated?: bool, error?: string}
	 */
	public static function restore_imported_plugins(): array {
		return Flowbie_Wp_Super_Import_Plugins::restore_deactivated_plugins();
	}

	/**
	 * @param array<string, mixed> $job Job state.
	 * @return array<string, mixed>
	 */
	private static function public_job( array $job ): array {
		$current = null;
		$idx     = (int) ( $job['step_index'] ?? 0 );
		if ( isset( $job['micro'][ $idx ] ) ) {
			$current = $job['micro'][ $idx ];
		}

		$imported_adapters = array();
		$conflict_plugins  = array();
		if ( ( $job['status'] ?? '' ) === 'done' && empty( $job['dry_run'] ) ) {
			$imported_adapters = self::imported_adapter_ids_from_job( $job );
			$conflict_plugins  = Flowbie_Wp_Super_Import_Plugins::active_for_adapters( $imported_adapters );
		}

		return array(
			'job_id'             => $job['job_id'] ?? '',
			'status'             => $job['status'] ?? 'running',
			'dry_run'            => ! empty( $job['dry_run'] ),
			'macro'              => $job['macro'] ?? array(),
			'micro'              => $job['micro'] ?? array(),
			'step_index'         => $idx,
			'current_step'       => $current,
			'errors'             => $job['errors'] ?? array(),
			'sheet_summary'      => self::sheet_summary( Flowbie_Wp_Flo_Sheet::get() ),
			'imported_adapters'  => $imported_adapters,
			'conflict_plugins'   => $conflict_plugins,
		);
	}

	/**
	 * @param string $job_id Job id.
	 * @return string
	 */
	private static function normalize_job_id( string $job_id ): string {
		return sanitize_key( $job_id );
	}

	/**
	 * @param string               $job_id Job id.
	 * @param array<string, mixed> $job    Job state.
	 */
	private static function persist_job( string $job_id, array $job ): void {
		$job_id = self::normalize_job_id( $job_id );
		set_transient( self::TRANSIENT_KEY . $job_id, $job, self::JOB_TTL );
	}

	/**
	 * @param string $job_id Job id.
	 * @return array<string, mixed>|null
	 */
	private static function load_job( string $job_id ): ?array {
		$job = get_transient( self::TRANSIENT_KEY . self::normalize_job_id( $job_id ) );
		return is_array( $job ) ? $job : null;
	}
}

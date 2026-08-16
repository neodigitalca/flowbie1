<?php
/**
 * Task trigger evaluation orchestrator.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Trigger_Evaluator {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $options simulate?:bool
	 * @return array<string,mixed>
	 */
	public static function evaluate_task( int $team_id, array $task, array $options = array() ): array {
		$simulated = ! empty( $options['simulate'] );
		$task_id   = (int) ( $task['id'] ?? 0 );
		$config    = is_array( $task['triggerConfig'] ?? null )
			? Neo_Pulse_App_Tasks_Store::sanitize_trigger_config( $task['triggerConfig'] )
			: Neo_Pulse_App_Tasks_Store::sanitize_trigger_config( array() );
		$payload   = is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array();
		$bucket    = Neo_Pulse_App_Tasks_Store::sanitize_execution_target_bucket( $payload['targetBucket'] ?? '' );
		$site_id   = trim( (string) ( $task['wordpressSiteId'] ?? '' ) );

		if ( $site_id === '' || $bucket === '' ) {
			return array( 'ok' => false, 'error' => 'Task requires a client site and scan bucket.' );
		}
		if ( count( $config['conditions'] ) === 0 && ! self::is_schedule_only_source( $config ) ) {
			return array( 'ok' => false, 'error' => 'Add at least one trigger condition.' );
		}

		$auth = Neo_Pulse_App_Task_Execution_Site_Resolver::wordpress_auth( $site_id );
		if ( ! $auth ) {
			return array( 'ok' => false, 'error' => 'Could not resolve WordPress site credentials.' );
		}

		$inventory = Neo_Pulse_App_Task_Trigger_Inventory::urls_for_bucket( $site_id, $bucket );
		if ( ! empty( $inventory['error'] ) ) {
			return array( 'ok' => false, 'error' => (string) $inventory['error'] );
		}
		$inventory_urls = is_array( $inventory['urls'] ?? null ) ? $inventory['urls'] : array();
		if ( count( $inventory_urls ) === 0 ) {
			return array(
				'ok'               => true,
				'simulated'        => $simulated,
				'scannedCount'     => 0,
				'gscDataCount'     => 0,
				'skippedNoGscData' => 0,
				'matchedCount'     => 0,
				'matchedUrls'      => array(),
				'matches'          => array(),
			);
		}

		if ( self::is_schedule_only_source( $config ) ) {
			return self::evaluate_schedule_only(
				$team_id,
				$task_id,
				$inventory_urls,
				$config,
				$task,
				$simulated
			);
		}

		if ( $simulated ) {
			$stand_in = Neo_Pulse_App_Task_Trigger_Inventory::pick_stand_in_urls( $inventory_urls );
			self::persist_eval_meta( $team_id, $task_id, count( $inventory_urls ), count( $stand_in ), true );
			return array(
				'ok'               => true,
				'simulated'        => true,
				'scannedCount'     => count( $inventory_urls ),
				'gscDataCount'     => 0,
				'skippedNoGscData' => count( $inventory_urls ),
				'matchedCount'     => count( $stand_in ),
				'matchedUrls'      => $stand_in,
				'matches'          => array(),
			);
		}

		$gsc = Neo_Pulse_App_Task_Trigger_Gsc::fetch_page_compare_maps( (string) $auth['siteUrl'], $config );
		if ( ! empty( $gsc['error'] ) ) {
			return array( 'ok' => false, 'error' => (string) $gsc['error'] );
		}

		$pages      = is_array( $gsc['pages'] ?? null ) ? $gsc['pages'] : array();
		$prior_pages = is_array( $gsc['priorPages'] ?? null ) ? $gsc['priorPages'] : array();
		$ranges     = is_array( $gsc['ranges'] ?? null ) ? $gsc['ranges'] : Neo_Pulse_App_Task_Trigger_Gsc::date_ranges( $config );
		$match_mode = (string) ( $config['match'] ?? 'any' );

		$inventory_keys = array();
		foreach ( $inventory_urls as $url ) {
			$inventory_keys[ Neo_Pulse_App_Task_Trigger_Gsc::normalize_url_key( $url ) ] = $url;
		}

		$candidates = array();
		$gsc_data_count = 0;
		foreach ( $inventory_keys as $key => $canonical_url ) {
			if ( ! isset( $pages[ $key ] ) ) {
				continue;
			}
			$gsc_data_count++;
			$current = $pages[ $key ];
			$prior   = $prior_pages[ $key ] ?? null;
			$matched_signals = array();
			foreach ( $config['conditions'] as $condition ) {
				if ( ! is_array( $condition ) ) {
					continue;
				}
				if ( Neo_Pulse_App_Task_Trigger_Gsc::condition_matches( $current, $prior, $condition ) ) {
					$matched_signals[] = sanitize_key( (string) ( $condition['signal'] ?? '' ) );
				}
			}
			$passes = ( $match_mode === 'all' )
				? count( $matched_signals ) === count( $config['conditions'] )
				: count( $matched_signals ) > 0;
			if ( ! $passes ) {
				continue;
			}
			$severity = self::severity_score( $current, $prior );
			$candidates[] = array(
				'url'      => $canonical_url,
				'signal'   => $matched_signals[0] ?? '',
				'current'  => Neo_Pulse_App_Task_Trigger_Gsc::metrics_for_response( $current ),
				'prior'    => is_array( $prior ) ? Neo_Pulse_App_Task_Trigger_Gsc::metrics_for_response( $prior ) : array(),
				'severity' => $severity,
				'dateRange'=> array(
					'current' => $ranges['current'] ?? array(),
					'prior'   => $ranges['prior'] ?? array(),
				),
			);
		}

		usort(
			$candidates,
			static function ( $a, $b ) {
				return (float) ( $b['severity'] ?? 0 ) <=> (float) ( $a['severity'] ?? 0 );
			}
		);

		$cooldowns = self::cooldown_map( $task );
		$filtered  = array();
		foreach ( $candidates as $candidate ) {
			$url = (string) ( $candidate['url'] ?? '' );
			if ( $url === '' || self::url_in_cooldown( $url, $cooldowns, (int) $config['cooldownHours'] ) ) {
				continue;
			}
			unset( $candidate['severity'] );
			$filtered[] = $candidate;
		}

		$matched_urls = array_values(
			array_map(
				static function ( $row ) {
					return (string) ( $row['url'] ?? '' );
				},
				$filtered
			)
		);

		self::persist_eval_meta(
			$team_id,
			$task_id,
			count( $inventory_urls ),
			count( $matched_urls ),
			false
		);

		return array(
			'ok'               => true,
			'simulated'        => false,
			'scannedCount'     => count( $inventory_urls ),
			'gscDataCount'     => $gsc_data_count,
			'skippedNoGscData' => max( 0, count( $inventory_urls ) - $gsc_data_count ),
			'matchedCount'     => count( $matched_urls ),
			'matchedUrls'      => $matched_urls,
			'matches'          => $filtered,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function test_fire( int $team_id, array $task ): array {
		$result = self::evaluate_task( $team_id, $task, array( 'simulate' => true ) );
		if ( empty( $result['ok'] ) ) {
			return $result;
		}
		$urls = is_array( $result['matchedUrls'] ?? null ) ? $result['matchedUrls'] : array();
		if ( count( $urls ) === 0 ) {
			return array( 'ok' => false, 'error' => 'No inventory URLs available for test trigger.' );
		}
		$task_id = (int) ( $task['id'] ?? 0 );
		Neo_Pulse_App_Task_Trigger_Pending_Store::enqueue( $team_id, $task_id, $urls, true );
		Neo_Pulse_App_Tasks_Store::patch_task_trigger_meta(
			$team_id,
			$task_id,
			array(
				'lastFiredAt'      => gmdate( 'c' ),
				'lastSimulated'    => true,
				'lastMatchedCount' => count( $urls ),
			)
		);
		$result['queued'] = true;
		return $result;
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function cron_evaluate_and_queue( int $team_id, array $task ): array {
		$config = is_array( $task['triggerConfig'] ?? null ) ? $task['triggerConfig'] : array();
		$meta   = is_array( $task['triggerMeta'] ?? null ) ? $task['triggerMeta'] : array();
		$poll_h = max( 1, (int) ( $config['pollHours'] ?? 24 ) );
		$last   = strtotime( (string) ( $meta['lastEvaluatedAt'] ?? '' ) );
		if ( $last > 0 && ( time() - $last ) < ( $poll_h * HOUR_IN_SECONDS ) ) {
			return array( 'ok' => true, 'skipped' => 'poll_interval' );
		}
		$result = self::evaluate_task( $team_id, $task, array( 'simulate' => false ) );
		if ( empty( $result['ok'] ) ) {
			return $result;
		}
		$urls = is_array( $result['matchedUrls'] ?? null ) ? $result['matchedUrls'] : array();
		if ( count( $urls ) === 0 ) {
			return $result;
		}
		$task_id = (int) ( $task['id'] ?? 0 );
		Neo_Pulse_App_Task_Trigger_Pending_Store::enqueue( $team_id, $task_id, $urls, false );
		self::apply_cooldowns( $team_id, $task_id, $task, $urls, (int) ( $config['cooldownHours'] ?? 72 ) );
		Neo_Pulse_App_Tasks_Store::patch_task_trigger_meta(
			$team_id,
			$task_id,
			array(
				'lastFiredAt'      => gmdate( 'c' ),
				'lastSimulated'    => false,
				'lastMatchedCount' => count( $urls ),
			)
		);
		$result['queued'] = true;
		return $result;
	}

	/**
	 * @param array<string,mixed> $current
	 * @param array<string,mixed>|null $prior
	 */
	private static function is_schedule_only_source( array $config ): bool {
		$sources = is_array( $config['sources'] ?? null ) ? $config['sources'] : array();
		return count( $sources ) === 1 && in_array( 'schedule', $sources, true );
	}

	/**
	 * @param array<int,string> $inventory_urls
	 * @param array<string,mixed> $config
	 * @param array<string,mixed> $task
	 * @return array<string,mixed>
	 */
	private static function evaluate_schedule_only(
		int $team_id,
		int $task_id,
		array $inventory_urls,
		array $config,
		array $task,
		bool $simulated
	): array {
		$cooldowns = self::cooldown_map( $task );
		$matched   = array();
		foreach ( $inventory_urls as $url ) {
			$url = esc_url_raw( (string) $url );
			if ( $url === '' || self::url_in_cooldown( $url, $cooldowns, (int) ( $config['cooldownHours'] ?? 72 ) ) ) {
				continue;
			}
			$matched[] = $url;
		}

		self::persist_eval_meta( $team_id, $task_id, count( $inventory_urls ), count( $matched ), $simulated );

		return array(
			'ok'               => true,
			'simulated'        => $simulated,
			'scannedCount'     => count( $inventory_urls ),
			'gscDataCount'     => 0,
			'skippedNoGscData' => 0,
			'matchedCount'     => count( $matched ),
			'matchedUrls'      => $matched,
			'matches'          => array(),
		);
	}

	private static function severity_score( array $current, ?array $prior ): float {
		$cur_pos = (float) ( $current['position'] ?? 0 );
		$pri_pos = is_array( $prior ) ? (float) ( $prior['position'] ?? 0 ) : 0;
		$cur_imp = (int) ( $current['impressions'] ?? 0 );
		return ( max( 0, $cur_pos - $pri_pos ) * 10 ) + ( $cur_imp / 100 );
	}

	/**
	 * @param array<string,mixed> $task
	 * @return array<string,string>
	 */
	private static function cooldown_map( array $task ): array {
		$meta = is_array( $task['triggerMeta'] ?? null ) ? $task['triggerMeta'] : array();
		$raw  = is_array( $meta['urlCooldowns'] ?? null ) ? $meta['urlCooldowns'] : array();
		$out  = array();
		foreach ( $raw as $url => $iso ) {
			$url = esc_url_raw( (string) $url );
			$iso = sanitize_text_field( (string) $iso );
			if ( $url !== '' && $iso !== '' ) {
				$out[ $url ] = $iso;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,string> $cooldowns
	 */
	private static function url_in_cooldown( string $url, array $cooldowns, int $cooldown_hours ): bool {
		if ( ! isset( $cooldowns[ $url ] ) ) {
			return false;
		}
		$ts = strtotime( $cooldowns[ $url ] );
		if ( ! $ts ) {
			return false;
		}
		return ( time() - $ts ) < ( max( 1, $cooldown_hours ) * HOUR_IN_SECONDS );
	}

	/**
	 * @param array<int,string> $urls
	 * @param array<string,mixed> $task
	 */
	private static function apply_cooldowns( int $team_id, int $task_id, array $task, array $urls, int $cooldown_hours ): void {
		unset( $cooldown_hours );
		$meta      = is_array( $task['triggerMeta'] ?? null ) ? $task['triggerMeta'] : array();
		$cooldowns = is_array( $meta['urlCooldowns'] ?? null ) ? $meta['urlCooldowns'] : array();
		$now       = gmdate( 'c' );
		foreach ( $urls as $url ) {
			$url = esc_url_raw( (string) $url );
			if ( $url !== '' ) {
				$cooldowns[ $url ] = $now;
			}
		}
		Neo_Pulse_App_Tasks_Store::patch_task_trigger_meta(
			$team_id,
			$task_id,
			array( 'urlCooldowns' => $cooldowns )
		);
	}

	private static function persist_eval_meta(
		int $team_id,
		int $task_id,
		int $scanned,
		int $matched,
		bool $simulated
	): void {
		if ( $task_id <= 0 ) {
			return;
		}
		Neo_Pulse_App_Tasks_Store::patch_task_trigger_meta(
			$team_id,
			$task_id,
			array(
				'lastEvaluatedAt'  => gmdate( 'c' ),
				'lastScannedCount' => $scanned,
				'lastMatchedCount' => $matched,
				'lastSimulated'    => $simulated,
			)
		);
	}
}

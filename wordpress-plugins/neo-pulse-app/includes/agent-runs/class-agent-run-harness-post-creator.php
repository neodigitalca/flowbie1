<?php
/**
 * Server-side post creator harness (tick-based).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Harness_Post_Creator {

	/**
	 * @param array<string,mixed> $run
	 */
	public static function tick( int $team_id, array $run ): void {
		$run_id = (int) ( $run['id'] ?? 0 );
		if ( $run_id <= 0 ) {
			return;
		}

		$plan     = is_array( $run['plan'] ?? null ) ? $run['plan'] : array();
		$contract = is_array( $plan['clientRunContract'] ?? null ) ? $plan['clientRunContract'] : array();
		$result   = is_array( $run['result'] ?? null ) ? $run['result'] : array();
		$checkpoint = is_array( $result['checkpoint'] ?? null ) ? $result['checkpoint'] : array();
		$server   = is_array( $checkpoint['server'] ?? null ) ? $checkpoint['server'] : array();
		$phase    = sanitize_key( (string) ( $server['phase'] ?? 'preflight' ) );

		$post_count = max( 1, (int) ( $contract['postCount'] ?? 1 ) );
		$site_id    = trim( (string) ( $contract['siteId'] ?? $run['context']['siteId'] ?? '' ) );
		$site       = $site_id !== '' ? Neo_Pulse_App_Task_Execution_Site_Resolver::resolve_by_id( $site_id ) : null;
		if ( ! $site ) {
			throw new Exception( 'WordPress site not found for server post creator run.' );
		}

		switch ( $phase ) {
			case 'preflight':
				self::step( $team_id, $run_id, 'preflight', 'Preflight', 'done' );
				$server['phase'] = 'content_bucket';
				self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
				return;

			case 'content_bucket':
				self::step( $team_id, $run_id, 'content-bucket', 'Loading content bucket…', 'running' );
				$inventory   = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::load_posts_bucket( $site, 100 );
				$bucket_name = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::bucket_artifact_name( $site );
				$saved       = Neo_Pulse_App_Agent_Runs_Artifacts::save_artifact(
					$team_id,
					$run_id,
					array(
						'stepKey' => 'content-bucket',
						'name'    => $bucket_name,
						'mime'    => 'application/json',
						'content' => $inventory['json'],
					)
				);
				if ( empty( $saved['ok'] ) ) {
					throw new Exception( 'Could not save content bucket artifact.' );
				}
				$bucket_payload = array();
				if ( ! empty( $saved['artifact'] ) && is_array( $saved['artifact'] ) ) {
					$bucket_payload['artifacts'] = array( $saved['artifact'] );
				}

				$kw_bundle = Neo_Pulse_App_Agent_Run_Gsc_Kw_Inventory::build_site_kw_json( $site );
				$kw_saved  = Neo_Pulse_App_Agent_Runs_Artifacts::save_artifact(
					$team_id,
					$run_id,
					array(
						'stepKey' => 'content-bucket',
						'name'    => $kw_bundle['name'],
						'mime'    => 'application/json',
						'content' => $kw_bundle['json'],
					)
				);
				if ( ! empty( $kw_saved['artifact'] ) && is_array( $kw_saved['artifact'] ) ) {
					$bucket_payload['artifacts'][] = $kw_saved['artifact'];
				}
				$server['siteKwJson']     = $kw_bundle['json'];
				$server['siteKwArtifact'] = $kw_bundle['name'];

				self::step(
					$team_id,
					$run_id,
					'content-bucket',
					count( $inventory['urls'] ) . ' post URLs loaded, KW JSON (' . $kw_bundle['rowCount'] . ' keywords)',
					'done',
					$bucket_payload
				);
				$server['phase'] = 'ideation';
				self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
				return;

			case 'ideation':
				self::step( $team_id, $run_id, 'ideation', 'Generating blog ideas…', 'running' );
				$rows = self::generate_ideas( $contract, $site, $post_count, $server );
				if ( count( $rows ) < $post_count ) {
					throw new Exception( 'OpenRouter returned fewer blog ideas than requested.' );
				}
				$server['checklistRows'] = $rows;
				$server['rowIndex']      = 0;
				$server['phase']         = 'row';
				$server['intraPhase']    = 'keyword';
				self::step( $team_id, $run_id, 'ideas', count( $rows ) . ' blog ideas ready', 'done' );
				self::step( $team_id, $run_id, 'ideation', 'Blog ideas generated', 'done' );
				self::step( $team_id, $run_id, 'bulk.start', 'Creating ' . count( $rows ) . ' posts…', 'running' );
				self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
				return;

			case 'row':
				$row_index = (int) ( $server['rowIndex'] ?? 0 );
				$rows      = is_array( $server['checklistRows'] ?? null ) ? $server['checklistRows'] : array();
				if ( $row_index >= count( $rows ) ) {
					self::finish_run( $team_id, $run_id, $result, $server );
					return;
				}

				$row       = is_array( $rows[ $row_index ] ?? null ) ? $rows[ $row_index ] : array();
				$keyword   = trim( (string) ( $row['keyword'] ?? '' ) );
				$intra = sanitize_key( (string) ( $server['intraPhase'] ?? 'keyword' ) );
				if ( $intra === 'awaiting_client_upload' ) {
					self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
					return;
				}
				$row_count = count( $rows );
				$row_label = ( $keyword !== '' ? $keyword : trim( (string) ( $row['title'] ?? '' ) ) );
				if ( $row_label === '' ) {
					$row_label = 'Starting…';
				} else {
					$row_label .= '…';
				}
				self::step( $team_id, $run_id, 'post.' . $row_index . '.start', $row_label, 'running' );

				$next_intra = Neo_Pulse_App_Agent_Run_Post_Creator_Row::run_phase(
					$team_id,
					$run_id,
					$row_index,
					$intra,
					$row,
					$site,
					$site_id,
					$contract,
					$server,
					$result
				);

				if ( $intra === 'awaiting_client_upload' ) {
					self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
					return;
				}

				$server['intraPhase'] = $next_intra;
				self::save_checkpoint( $team_id, $run_id, $result, $checkpoint, $server );
				return;
		}
	}

	/**
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $site
	 * @return array<int,array<string,mixed>>
	 */
	private static function generate_ideas( array $contract, array $site, int $post_count, array $server = array() ): array {
		$keyword_source = sanitize_key( (string) ( $contract['keywordSource'] ?? 'prompt' ) );
		if ( ! in_array( $keyword_source, array( 'prompt', 'gsc', 'manual' ), true ) ) {
			$keyword_source = 'prompt';
		}

		if ( $keyword_source === 'manual' ) {
			return self::build_manual_rows( $contract, $post_count );
		}

		$prompt    = trim( (string) ( $contract['optionalPrompt'] ?? '' ) );
		$site_name = trim( (string) ( $site['name'] ?? '' ) );
		$gsc_keywords = array();
		$site_kw_json = trim( (string) ( $server['siteKwJson'] ?? '' ) );

		if ( $keyword_source === 'gsc' ) {
			if ( $site_kw_json === '' ) {
				$kw_bundle    = Neo_Pulse_App_Agent_Run_Gsc_Kw_Inventory::build_site_kw_json( $site );
				$site_kw_json = $kw_bundle['json'];
			}
			$gsc_keywords = Neo_Pulse_App_Agent_Run_Gsc_Keyword_Select::select_keywords(
				$site,
				$site_kw_json,
				$post_count,
				$contract
			);
		}

		$user = 'Generate exactly ' . $post_count . ' blog post ideas for ' . $site_name . '.';
		if ( $prompt !== '' ) {
			$user .= ' Brief: ' . $prompt;
		}
		if ( ! empty( $gsc_keywords ) ) {
			$user .= "\n\nUse these GSC-selected keywords (one per row):\n";
			foreach ( $gsc_keywords as $i => $kw ) {
				$user .= ( $i + 1 ) . '. ' . $kw . "\n";
			}
		}
		if ( $site_kw_json !== '' ) {
			$user .= "\n\nSITE_KW_JSON context:\n" . substr( $site_kw_json, 0, 12000 );
		}
		$user .= "\nReturn JSON: {\"rows\":[{\"keyword\":\"\",\"title\":\"\",\"entity\":\"\"}]}";

		$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
			array(
				array( 'role' => 'system', 'content' => 'You are an SEO blog strategist. Return valid JSON only.' ),
				array( 'role' => 'user', 'content' => $user ),
			),
			array( 'temperature' => 0.4, 'maxTokens' => 4096 )
		);

		$rows = isset( $parsed['rows'] ) && is_array( $parsed['rows'] ) ? $parsed['rows'] : array();
		$out  = array();
		foreach ( $rows as $i => $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$keyword = trim( (string) ( $row['keyword'] ?? '' ) );
			if ( $keyword === '' && isset( $gsc_keywords[ $i ] ) ) {
				$keyword = trim( (string) $gsc_keywords[ $i ] );
			}
			$out[] = array(
				'keyword' => $keyword,
				'title'   => trim( (string) ( $row['title'] ?? '' ) ),
				'entity'  => trim( (string) ( $row['entity'] ?? '' ) ),
			);
		}
		if ( count( $out ) < $post_count && ! empty( $gsc_keywords ) ) {
			foreach ( $gsc_keywords as $i => $kw ) {
				if ( count( $out ) >= $post_count ) {
					break;
				}
				if ( isset( $out[ $i ] ) ) {
					continue;
				}
				$out[ $i ] = array(
					'keyword' => $kw,
					'title'   => '',
					'entity'  => '',
				);
			}
			ksort( $out );
			$out = array_values( $out );
		}
		return array_slice( $out, 0, $post_count );
	}

	/**
	 * @param array<string,mixed> $contract
	 * @return array<int,array<string,mixed>>
	 */
	private static function build_manual_rows( array $contract, int $post_count ): array {
		$keyword = trim( (string) ( $contract['keywordValue'] ?? 'blog topic' ) );
		$entity  = trim( (string) ( $contract['entityValue'] ?? '' ) );
		$out     = array();
		for ( $i = 0; $i < $post_count; $i++ ) {
			$row_keyword = $post_count === 1 ? $keyword : trim( $keyword . ' ' . ( $i + 1 ) );
			$out[]       = array(
				'keyword' => $row_keyword,
				'title'   => '',
				'entity'  => $entity,
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $result
	 * @param array<string,mixed> $checkpoint
	 * @param array<string,mixed> $server
	 */
	private static function save_checkpoint( int $team_id, int $run_id, array $result, array $checkpoint, array $server ): void {
		$persist_server = $server;
		unset( $persist_server['generatedContent'], $persist_server['inventoryUrls'], $persist_server['inventoryPosts'] );
		$checkpoint['server'] = $persist_server;
		$result['checkpoint'] = $checkpoint;
		$result['executionMode'] = 'server';
		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$run_id,
			array( 'result' => $result )
		);
	}

	private static function step(
		int $team_id,
		int $run_id,
		string $step_key,
		string $label,
		string $status,
		array $payload = array()
	): void {
		$step = array(
			'stepKey' => $step_key,
			'label'   => $label,
			'status'  => $status,
		);
		if ( ! empty( $payload ) ) {
			$step['payload'] = $payload;
		}
		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$run_id,
			array(
				'step'   => $step,
				'result' => array(
					'checkpoint' => array(
						'lastStepAt' => gmdate( 'Y-m-d H:i:s' ),
					),
				),
			)
		);
	}

	/**
	 * @param array<string,mixed> $result
	 * @param array<string,mixed> $server
	 */
	private static function finish_run( int $team_id, int $run_id, array $result, array $server ): void {
		$server['phase'] = 'done';
		$result['executionMode'] = 'server';
		$result['message']       = 'Completed on server';
		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$run_id,
			array(
				'status' => 'done',
				'result' => $result,
				'step'   => array(
					'stepKey' => 'complete',
					'label'   => 'Complete',
					'status'  => 'done',
				),
			)
		);

		$run = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, false );
		if ( $run && ! empty( $run['plan']['taskExecutionId'] ) ) {
			$execution_id = (int) $run['plan']['taskExecutionId'];
			Neo_Pulse_App_Task_Execution_Coordinator::complete(
				$team_id,
				$execution_id,
				array(
					'ok'          => true,
					'agentRunId'  => $run_id,
					'result'      => array(
						'created'       => (int) ( $result['updated'] ?? 0 ),
						'uploadedPosts' => $result['uploadedPosts'] ?? array(),
					),
				)
			);
		}
	}
}

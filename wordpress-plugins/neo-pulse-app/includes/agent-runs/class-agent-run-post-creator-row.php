<?php
/**
 * Per-row post creator phases: keyword → checklist → blueprint → content → client upload.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Post_Creator_Row {

	/** @var array<int,string> */
	const INTRA_SEQUENCE = array( 'keyword', 'checklist', 'blueprint', 'content', 'awaiting_client_upload' );

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $server
	 * @param array<string,mixed> $result
	 */
	public static function run_phase(
		int $team_id,
		int $run_id,
		int $row_index,
		string $intra,
		array $row,
		array $site,
		string $site_id,
		array $contract,
		array &$server,
		array &$result
	): string {
		switch ( $intra ) {
			case 'keyword':
				self::phase_keyword( $team_id, $run_id, $row_index, $row, $site, $server );
				return 'checklist';
			case 'checklist':
				self::phase_checklist( $team_id, $run_id, $row_index, $row, $site, $contract, $server );
				return 'blueprint';
			case 'blueprint':
				self::phase_blueprint( $team_id, $run_id, $row_index, $row, $site, $contract, $server );
				return 'content';
			case 'content':
				if ( self::phase_content_tick( $team_id, $run_id, $row_index, $row, $site, $contract, $server ) ) {
					return 'content';
				}
				self::phase_awaiting_client_upload( $team_id, $run_id, $row_index );
				return 'awaiting_client_upload';
			case 'awaiting_client_upload':
				return 'awaiting_client_upload';
			default:
				throw new Exception( 'Unknown post creator intra phase: ' . $intra );
		}
	}

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $server
	 */
	private static function phase_keyword(
		int $team_id,
		int $run_id,
		int $row_index,
		array $row,
		array $site,
		array &$server
	): void {
		$keyword = trim( (string) ( $row['keyword'] ?? '' ) );
		$step    = 'post.' . $row_index . '.keyword';
		self::emit_step( $team_id, $run_id, $step, 'Running keyword research…', 'running' );

		$research = Neo_Pulse_App_Agent_Run_Keyword_Research::run(
			$keyword,
			self::guess_page_url( $site, $row )
		);
		$has_data = Neo_Pulse_App_Agent_Run_Keyword_Research::has_usable_data( $research );
		$meta     = self::row_meta( $server, $row_index, $row );
		$name     = 'keyword-research-dfs-' . $meta['slug'] . '-' . $meta['ts'] . '.json';
		$label    = $has_data
			? 'Keyword research ready'
			: 'Keyword research skipped (no DataForSEO credentials)';
		$status   = $has_data ? 'done' : 'error';

		self::save_artifact_step(
			$team_id,
			$run_id,
			$step,
			$label,
			$status,
			$name,
			'application/json',
			wp_json_encode( $research, JSON_PRETTY_PRINT )
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $server
	 */
	private static function phase_checklist(
		int $team_id,
		int $run_id,
		int $row_index,
		array $row,
		array $site,
		array $contract,
		array &$server
	): void {
		$step    = 'post.' . $row_index . '.checklist';
		$keyword = trim( (string) ( $row['keyword'] ?? '' ) );
		$title   = trim( (string) ( $row['title'] ?? $keyword ) );
		$meta    = self::row_meta( $server, $row_index, $row );
		self::emit_step( $team_id, $run_id, $step, 'Generating blog checklist…', 'running' );

		$research_raw = self::load_row_artifact( $run_id, $row_index, 'keyword', 'keyword-research-dfs-' );
		$research     = is_string( $research_raw ) ? json_decode( $research_raw, true ) : array();
		$keywords     = self::extract_keywords( is_array( $research ) ? $research : array(), $keyword );
		$user_prompt  = trim( (string) ( $contract['optionalPrompt'] ?? '' ) );
		$bucket_json  = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::read_bucket_json_for_run( $run_id, $site );
		$bucket_block = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::build_bucket_read_first_block( $bucket_json );
		$wp_posts     = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::parse_posts_from_bucket_json( $bucket_json );

		$lines = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::generate_checklist(
			$title,
			$keyword,
			is_array( $research ) ? $research : array(),
			$keywords,
			$site,
			$user_prompt,
			$bucket_block,
			$wp_posts
		);
		$payload = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::format_checklist_artifact( $title, $lines );

		$name = 'blog-checklist-' . $meta['slug'] . '-' . $meta['ts'] . '.json';
		self::save_artifact_step(
			$team_id,
			$run_id,
			$step,
			count( $lines ) . ' checklist items ready',
			'done',
			$name,
			'application/json',
			wp_json_encode( $payload, JSON_PRETTY_PRINT )
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $server
	 */
	private static function phase_blueprint(
		int $team_id,
		int $run_id,
		int $row_index,
		array $row,
		array $site,
		array $contract,
		array &$server
	): void {
		$step    = 'post.' . $row_index . '.blueprint';
		$keyword = trim( (string) ( $row['keyword'] ?? '' ) );
		$title   = trim( (string) ( $row['title'] ?? $keyword ) );
		$meta    = self::row_meta( $server, $row_index, $row );
		self::emit_step( $team_id, $run_id, $step, 'Generating content blueprint…', 'running' );

		$checklist_raw = self::load_row_artifact( $run_id, $row_index, 'checklist', 'blog-checklist-' );
		$checklist_doc = is_string( $checklist_raw ) ? json_decode( $checklist_raw, true ) : array();
		$items         = self::checklist_lines_from_doc( is_array( $checklist_doc ) ? $checklist_doc : array() );
		if ( empty( $items ) ) {
			throw new Exception( 'Checklist artifact missing for blueprint phase.' );
		}

		$user_prompt = trim( (string) ( $contract['optionalPrompt'] ?? '' ) );
		$bucket_json = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::read_bucket_json_for_run( $run_id, $site );
		$wp_posts    = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::parse_posts_from_bucket_json( $bucket_json );
		$parsed      = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::generate_blueprint(
			$title,
			$keyword,
			$items,
			$site,
			$user_prompt,
			$wp_posts
		);

		$name = 'blueprint-' . $meta['slug'] . '-' . $meta['ts'] . '.json';
		self::save_artifact_step(
			$team_id,
			$run_id,
			$step,
			count( $parsed['agents'] ?? array() ) . ' blueprint sections ready',
			'done',
			$name,
			'application/json',
			wp_json_encode( $parsed, JSON_PRETTY_PRINT )
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $server
	 */
	private static function phase_content_tick(
		int $team_id,
		int $run_id,
		int $row_index,
		array $row,
		array $site,
		array $contract,
		array &$server
	): bool {
		$keyword = trim( (string) ( $row['keyword'] ?? '' ) );
		$title   = trim( (string) ( $row['title'] ?? $keyword ) );
		$meta    = self::row_meta( $server, $row_index, $row );

		if ( ! empty( $server['contentOverviewDone'] ) ) {
			return false;
		}

		$blueprint_raw = self::load_row_artifact( $run_id, $row_index, 'blueprint', 'blueprint-' );
		$blueprint     = is_string( $blueprint_raw ) ? json_decode( $blueprint_raw, true ) : array();
		$agents        = is_array( $blueprint['agents'] ?? null ) ? $blueprint['agents'] : array();
		if ( empty( $agents ) ) {
			throw new Exception( 'Blueprint artifact missing for content phase.' );
		}
		$body_agents = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::filter_body_agents( $agents );
		if ( empty( $body_agents ) ) {
			throw new Exception( 'Blueprint has no body agents for content harness.' );
		}

		$body_count  = count( $body_agents );
		$body_titles = array_map(
			static function ( $a ) {
				return trim( (string) ( $a['title'] ?? '' ) );
			},
			$body_agents
		);

		$body_parts = is_array( $server['contentBodyParts'] ?? null ) ? $server['contentBodyParts'] : null;

		if ( $body_parts === null ) {
			$bucket_json  = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::read_bucket_json_for_run( $run_id, $site );
			$bucket_block = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::build_bucket_read_first_block( $bucket_json );
			$harness_total = $body_count + 1;
			$token_map     = Neo_Pulse_App_Agent_Run_Harness_Section_Tokens::token_map_for_body_and_overview(
				$body_agents,
				Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::HARNESS_ROW_TOKEN_BUDGET
			);

			for ( $i = 0; $i < $body_count; $i++ ) {
				$harness_step = 'post.' . $row_index . '.harness.' . $i;
				self::emit_step(
					$team_id,
					$run_id,
					$harness_step,
					'Harness ' . ( $i + 1 ) . '/' . $harness_total . ': ' . ( $body_agents[ $i ]['title'] ?? '' ),
					'running'
				);
			}

			$parts = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::generate_body_sections_parallel(
				$body_agents,
				$title,
				$keyword,
				$site,
				$body_titles,
				static function ( $i, $error ) use ( $team_id, $run_id, $row_index, $harness_total ) {
					$harness_step = 'post.' . $row_index . '.harness.' . $i;
					if ( $error !== '' ) {
						self::emit_step( $team_id, $run_id, $harness_step, 'Section failed: ' . $error, 'error' );
						return;
					}
					self::emit_step(
						$team_id,
						$run_id,
						$harness_step,
						'Harness ' . ( $i + 1 ) . '/' . $harness_total . ' complete',
						'done'
					);
				},
				$bucket_block,
				$token_map
			);

			$server['contentBodyParts']       = $parts;
			$server['contentBodyAgentsSaved'] = $body_agents;
			$server['contentTokenMap']        = $token_map;
			unset( $server['generatedContent'] );

			return true;
		}

		@set_time_limit( 180 );

		$overview_step = 'post.' . $row_index . '.harness.overview';
		$harness_total = $body_count + 1;
		self::emit_step( $team_id, $run_id, $overview_step, 'Harness ' . $harness_total . '/' . $harness_total . ': Overview', 'running' );

		$token_map   = is_array( $server['contentTokenMap'] ?? null ) ? $server['contentTokenMap'] : array();
		$overview_tokens = isset( $token_map['overview'] )
			? (int) $token_map['overview']
			: (int) floor( Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::HARNESS_ROW_TOKEN_BUDGET / max( 1, $harness_total ) );

		$overview_md = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::generate_overview_section(
			$title,
			$keyword,
			$body_parts,
			$body_titles,
			$body_agents,
			$overview_tokens
		);
		$stitched    = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::stitch_markdown( $overview_md, $body_parts );
		$inventory_posts = Neo_Pulse_App_Agent_Run_Post_Creator_Inventory::load_posts_for_link_resolve( $run_id, $site );
		if ( ! empty( $inventory_posts ) ) {
			$stitched = Neo_Pulse_App_Agent_Run_Internal_Link_Resolver::resolve_markdown(
				$stitched,
				$inventory_posts,
				(string) ( $site['siteUrl'] ?? '' )
			);
		}
		$content_step = 'post.' . $row_index . '.content';
		$name         = 'content-' . $meta['slug'] . '-' . $meta['ts'] . '.md';

		self::save_artifact_step(
			$team_id,
			$run_id,
			$content_step,
			'Markdown content generated successfully',
			'done',
			$name,
			'text/markdown',
			$stitched
		);

		self::emit_step( $team_id, $run_id, $overview_step, 'Harness ' . $harness_total . '/' . $harness_total . ' complete', 'done' );

		$server['generatedContent']    = $stitched;
		$server['contentOverviewDone'] = true;
		unset( $server['contentBodyParts'], $server['contentTokenMap'] );

		return false;
	}

	private static function phase_awaiting_client_upload(
		int $team_id,
		int $run_id,
		int $row_index
	): void {
		$step = 'post.' . $row_index . '.upload';
		self::emit_step( $team_id, $run_id, $step, 'Waiting for client upload…', 'running' );
	}

	/**
	 * Called when the browser finishes WordPress upload for a row.
	 *
	 * @param array<string,mixed> $run
	 * @param array<string,mixed> $uploaded_post
	 * @return array<string,mixed> Updated run row from store.
	 */
	public static function complete_client_upload(
		int $team_id,
		int $run_id,
		int $row_index,
		array $run,
		array $uploaded_post
	): array {
		$result     = is_array( $run['result'] ?? null ) ? $run['result'] : array();
		$checkpoint = is_array( $result['checkpoint'] ?? null ) ? $result['checkpoint'] : array();
		$server     = is_array( $checkpoint['server'] ?? null ) ? $checkpoint['server'] : array();
		$rows       = is_array( $server['checklistRows'] ?? null ) ? $server['checklistRows'] : array();
		$post_count = count( $rows );

		$post_url = trim( (string) ( $uploaded_post['url'] ?? '' ) );
		$post_id  = isset( $uploaded_post['postId'] ) ? (int) $uploaded_post['postId'] : 0;
		$title    = trim( (string) ( $uploaded_post['title'] ?? '' ) );

		$uploads   = is_array( $result['uploadedPosts'] ?? null ) ? $result['uploadedPosts'] : array();
		$uploads[] = array(
			'url'    => $post_url,
			'postId' => $post_id > 0 ? $post_id : null,
			'title'  => $title,
		);
		$result['uploadedPosts'] = $uploads;
		$result['updated']       = count( $uploads );
		$result['executionMode'] = 'server';

		unset( $server['generatedContent'], $server['contentBodyAgentsSaved'], $server['contentOverviewDone'] );

		$step = 'post.' . $row_index . '.upload';
		self::emit_step(
			$team_id,
			$run_id,
			$step,
			$post_url !== '' ? 'Published · ' . $title : 'Uploaded to WordPress',
			'done',
			array(
				'postUrl' => $post_url,
				'postId'  => $post_id > 0 ? $post_id : null,
			)
		);

		$row_index++;
		if ( $row_index >= $post_count ) {
			$server['phase']      = 'done';
			$server['rowIndex']   = $row_index;
			$server['intraPhase'] = 'keyword';
			$checkpoint['server'] = $server;
			$result['checkpoint'] = $checkpoint;
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
			$run = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, true );
			if ( $run && ! empty( $run['plan']['taskExecutionId'] ) && class_exists( 'Neo_Pulse_App_Task_Execution_Coordinator' ) ) {
				Neo_Pulse_App_Task_Execution_Coordinator::complete(
					$team_id,
					(int) $run['plan']['taskExecutionId'],
					array(
						'ok'         => true,
						'agentRunId' => $run_id,
						'result'     => array(
							'created'       => (int) ( $result['updated'] ?? 0 ),
							'uploadedPosts' => $result['uploadedPosts'],
						),
					)
				);
			}
			return is_array( $run ) ? $run : array();
		}

		$server['rowIndex']   = $row_index;
		$server['intraPhase'] = 'keyword';
		$checkpoint['server'] = $server;
		$result['checkpoint'] = $checkpoint;

		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$run_id,
			array( 'result' => $result )
		);

		$updated = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, true );
		return is_array( $updated ) ? $updated : array();
	}

	/**
	 * @param array<string,mixed> $doc
	 * @return array<int,string>
	 */
	private static function checklist_lines_from_doc( array $doc ): array {
		$raw = array();
		if ( ! empty( $doc['lines'] ) && is_array( $doc['lines'] ) ) {
			$raw = $doc['lines'];
		} elseif ( ! empty( $doc['checklist'] ) && is_array( $doc['checklist'] ) ) {
			$raw = $doc['checklist'];
		}
		$out = array();
		foreach ( $raw as $line ) {
			$item = trim( (string) $line );
			if ( $item === '' ) {
				continue;
			}
			$item = preg_replace( '/^\d+\.\s+/', '', $item );
			$out[] = trim( (string) $item );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array{slug:string,ts:string}
	 */
	private static function row_meta( array &$server, int $row_index, array $row ): array {
		if ( empty( $server['rowMeta'] ) || ! is_array( $server['rowMeta'] ) ) {
			$server['rowMeta'] = array();
		}
		$key = (string) $row_index;
		if ( empty( $server['rowMeta'][ $key ] ) || ! is_array( $server['rowMeta'][ $key ] ) ) {
			$slug = sanitize_title( (string) ( $row['keyword'] ?? $row['title'] ?? 'post-' . $row_index ) );
			if ( $slug === '' ) {
				$slug = 'post-' . $row_index;
			}
			$server['rowMeta'][ $key ] = array(
				'slug' => $slug,
				'ts'   => gmdate( 'YmdHis' ),
			);
		}
		return array(
			'slug' => (string) ( $server['rowMeta'][ $key ]['slug'] ?? 'post' ),
			'ts'   => (string) ( $server['rowMeta'][ $key ]['ts'] ?? gmdate( 'YmdHis' ) ),
		);
	}

	private static function load_row_artifact( int $run_id, int $row_index, string $phase, string $name_prefix ): string {
		$dir      = Neo_Pulse_App_Agent_Runs_Artifacts::run_dir( $run_id );
		$step_key = sanitize_key( 'post.' . $row_index . '.' . $phase );
		$pattern  = trailingslashit( $dir ) . $step_key . '-*-' . $name_prefix . '*';
		$files    = glob( $pattern );
		if ( ! is_array( $files ) || empty( $files ) ) {
			return '';
		}
		usort(
			$files,
			static function ( $a, $b ) {
				return (int) filemtime( $b ) <=> (int) filemtime( $a );
			}
		);
		$content = file_get_contents( $files[0] );
		return is_string( $content ) ? $content : '';
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,string>
	 */
	private static function extract_keywords( array $research, string $primary ): array {
		$keywords = array();
		if ( $primary !== '' ) {
			$keywords[] = $primary;
		}
		$data = $research['keywordData'] ?? null;
		if ( is_array( $data ) ) {
			foreach ( $data as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$kw = trim( (string) ( $row['keyword'] ?? '' ) );
				if ( $kw !== '' && ! in_array( $kw, $keywords, true ) ) {
					$keywords[] = $kw;
				}
			}
		}
		return array_slice( $keywords, 0, 12 );
	}

	/**
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $row
	 */
	private static function guess_page_url( array $site, array $row ): string {
		$base = rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' );
		$slug = sanitize_title( (string) ( $row['keyword'] ?? $row['title'] ?? 'post' ) );
		return $base !== '' ? $base . '/' . $slug : '';
	}

	private static function emit_step(
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

	private static function save_artifact_step(
		int $team_id,
		int $run_id,
		string $step_key,
		string $label,
		string $status,
		string $name,
		string $mime,
		string $content
	): void {
		if ( $content === '' ) {
			self::emit_step( $team_id, $run_id, $step_key, $label, $status );
			return;
		}
		$artifacts = array();
		$saved     = Neo_Pulse_App_Agent_Runs_Artifacts::save_artifact(
			$team_id,
			$run_id,
			array(
				'stepKey' => $step_key,
				'name'    => $name,
				'mime'    => $mime,
				'content' => $content,
			)
		);
		if ( ! empty( $saved['artifact'] ) && is_array( $saved['artifact'] ) ) {
			$artifacts[] = $saved['artifact'];
		}
		self::emit_step(
			$team_id,
			$run_id,
			$step_key,
			$label,
			$status,
			array( 'artifacts' => $artifacts )
		);
	}
}

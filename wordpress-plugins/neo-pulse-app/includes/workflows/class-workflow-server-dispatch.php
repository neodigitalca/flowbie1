<?php
/**
 * Server-side workflow continuation after deferred agent steps.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Server_Dispatch {

	/**
	 * @param array<string,mixed> $agent_run
	 */
	public static function enqueue_continue_after_ld( int $team_id, array $agent_run ): void {
		$plan    = is_array( $agent_run['plan'] ?? null ) ? $agent_run['plan'] : array();
		$context = is_array( $agent_run['context'] ?? null ) ? $agent_run['context'] : array();
		$workflow_id     = (int) ( $plan['workflowId'] ?? $context['workflowId'] ?? 0 );
		$workflow_run_id = (int) ( $plan['workflowRunId'] ?? $context['workflowRunId'] ?? 0 );
		$node_id         = sanitize_text_field( (string) ( $plan['workflowNodeId'] ?? $context['workflowNodeId'] ?? '' ) );
		$agent_run_id    = (int) ( $agent_run['id'] ?? 0 );
		if ( $workflow_id <= 0 || $workflow_run_id <= 0 || $node_id === '' || $agent_run_id <= 0 ) {
			return;
		}

		Neo_Pulse_App_Workflow_Trigger_Pending_Store::enqueue(
			$team_id,
			array(
				'workflowId'  => $workflow_id,
				'runId'       => $workflow_run_id,
				'triggerKind' => 'workflow_continue',
				'payload'     => array(
					'afterNodeId' => $node_id,
					'agentRunId'  => $agent_run_id,
					'siteId'      => sanitize_text_field( (string) ( $context['siteId'] ?? '' ) ),
				),
			)
		);
	}

	public static function drain_pending( int $team_id ): void {
		if ( $team_id <= 0 ) {
			return;
		}
		$pending = Neo_Pulse_App_Workflow_Trigger_Pending_Store::list( $team_id );
		foreach ( $pending as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$run_id      = (int) ( $item['runId'] ?? 0 );
			$workflow_id = (int) ( $item['workflowId'] ?? 0 );
			if ( $run_id <= 0 || $workflow_id <= 0 ) {
				continue;
			}
			if ( sanitize_key( (string) ( $item['triggerKind'] ?? '' ) ) === 'workflow_continue' ) {
				continue;
			}
			if ( ! Neo_Pulse_App_Workflow_Trigger_Pending_Store::claim( $team_id, $workflow_id, $run_id ) ) {
				continue;
			}
			self::continue_run( $team_id, $workflow_id, $run_id, $item );
		}
	}

	/**
	 * @param array<string,mixed> $item
	 */
	private static function continue_run( int $team_id, int $workflow_id, int $workflow_run_id, array $item ): void {
		$workflow = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, $workflow_id );
		$run      = Neo_Pulse_App_Workflows_Store::get_run( $team_id, $workflow_run_id );
		if ( ! $workflow || ! $run ) {
			return;
		}

		$payload       = is_array( $item['payload'] ?? null ) ? $item['payload'] : array();
		$after_node_id = sanitize_text_field( (string) ( $payload['afterNodeId'] ?? '' ) );
		$next_node     = self::find_next_action_node( $workflow, $after_node_id );
		if ( ! $next_node ) {
			return;
		}

		$config          = is_array( $next_node['config'] ?? null ) ? $next_node['config'] : array();
		$execution_kind  = sanitize_key( (string) ( $config['executionKind'] ?? '' ) );
		$recipe_key      = self::recipe_key_for_kind( $execution_kind );
		if ( $recipe_key === '' ) {
			return;
		}

		$user_id = 1;
		$agent_run_id = (int) ( $payload['agentRunId'] ?? 0 );
		if ( $agent_run_id > 0 ) {
			$source_run = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $agent_run_id, false );
			if ( is_array( $source_run ) && (int) ( $source_run['createdBy'] ?? 0 ) > 0 ) {
				$user_id = (int) $source_run['createdBy'];
			}
		}

		$site_ids = $after_node_id === ''
			? self::client_site_ids_from_workflow( $workflow )
			: array( self::continue_site_id( $workflow, $payload ) );
		if ( $after_node_id === '' && empty( $site_ids ) ) {
			Neo_Pulse_App_Workflows_Store::patch_run(
				$team_id,
				$workflow_run_id,
				array(
					'status'       => 'failed',
					'errorMessage' => 'Select at least one client on the Client step.',
				)
			);
			return;
		}

		$started = 0;
		foreach ( $site_ids as $site_id ) {
			if ( self::start_agent_for_site( $team_id, $workflow_id, $workflow_run_id, $next_node, $config, $recipe_key, $execution_kind, $site_id, $user_id ) ) {
				++$started;
			}
		}
		if ( $started <= 0 ) {
			return;
		}

		Neo_Pulse_App_Workflows_Store::patch_run(
			$team_id,
			$workflow_run_id,
			array(
				'status'        => 'running',
				'currentNodeId' => sanitize_text_field( (string) ( $next_node['id'] ?? '' ) ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $next_node
	 * @param array<string,mixed> $config
	 */
	private static function start_agent_for_site(
		int $team_id,
		int $workflow_id,
		int $workflow_run_id,
		array $next_node,
		array $config,
		string $recipe_key,
		string $execution_kind,
		string $site_id,
		int $user_id
	): bool {
		$execution_payload = is_array( $config['executionPayload'] ?? null ) ? $config['executionPayload'] : array();
		if ( $execution_kind === 'chatgpt_website_audit' ) {
			$bucket = trim( (string) ( $execution_payload['targetBucket'] ?? '' ) );
			if ( ! in_array( $bucket, array( 'pages', 'posts', 'sap', 'all' ), true ) ) {
				$execution_payload['targetBucket'] = 'pages';
			}
		}
		$compiled_task_id  = (int) ( $config['compiledTaskId'] ?? 0 );
		$agent_run         = Neo_Pulse_App_Agent_Runs_Store::create_run(
			$team_id,
			$user_id,
			array(
				'source'    => 'workflow',
				'recipeKey' => $recipe_key,
				'title'     => sanitize_text_field( (string) ( $config['title'] ?? $next_node['label'] ?? $recipe_key ) ),
				'taskId'    => $compiled_task_id > 0 ? $compiled_task_id : 0,
				'context'   => array(
					'siteId'         => $site_id,
					'workflowId'     => $workflow_id,
					'workflowRunId'  => $workflow_run_id,
					'workflowNodeId' => sanitize_text_field( (string) ( $next_node['id'] ?? '' ) ),
				),
				'plan'      => array(
					'executionKind'    => $execution_kind,
					'executionPayload' => $execution_payload,
					'workflowId'       => $workflow_id,
					'workflowRunId'    => $workflow_run_id,
					'workflowNodeId'   => sanitize_text_field( (string) ( $next_node['id'] ?? '' ) ),
					'ragVariableKey'   => sanitize_key( (string) ( $config['ragVariableKey'] ?? '' ) ),
				),
			)
		);
		return (bool) $agent_run;
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @return array<string,mixed>|null
	 */
	private static function find_next_action_node( array $workflow, string $after_node_id ): ?array {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		$edges = isset( $workflow['edges'] ) && is_array( $workflow['edges'] ) ? $workflow['edges'] : array();
		if ( $after_node_id === '' ) {
			$after_node_id = self::client_node_id( $workflow );
			if ( $after_node_id === '' ) {
				return null;
			}
			$start_node = self::find_node_by_id( $nodes, $after_node_id );
			if ( self::is_dispatchable_action( $start_node ) ) {
				return $start_node;
			}
		}

		$queue   = array( $after_node_id );
		$visited = array( $after_node_id => true );

		while ( ! empty( $queue ) ) {
			$current_id = array_shift( $queue );
			foreach ( $edges as $edge ) {
				if ( ! is_array( $edge ) ) {
					continue;
				}
				if ( sanitize_text_field( (string) ( $edge['source'] ?? '' ) ) !== $current_id ) {
					continue;
				}
				$target_id = sanitize_text_field( (string) ( $edge['target'] ?? '' ) );
				if ( $target_id === '' || isset( $visited[ $target_id ] ) ) {
					continue;
				}
				$visited[ $target_id ] = true;
				$target_node          = self::find_node_by_id( $nodes, $target_id );
				if ( ! $target_node ) {
					continue;
				}
				if ( self::is_dispatchable_action( $target_node ) ) {
					return $target_node;
				}
				$queue[] = $target_id;
			}
		}

		return null;
	}

	/**
	 * @param array<int,array<string,mixed>> $nodes
	 * @return array<string,mixed>|null
	 */
	private static function find_node_by_id( array $nodes, string $node_id ): ?array {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_text_field( (string) ( $node['id'] ?? '' ) ) === $node_id ) {
				return $node;
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed>|null $node
	 */
	private static function is_dispatchable_action( ?array $node ): bool {
		if ( ! is_array( $node ) ) {
			return false;
		}
		if ( sanitize_key( (string) ( $node['kind'] ?? '' ) ) !== 'action_agent' ) {
			return false;
		}
		$config         = is_array( $node['config'] ?? null ) ? $node['config'] : array();
		$execution_kind = sanitize_key( (string) ( $config['executionKind'] ?? '' ) );
		return $execution_kind !== 'local_dominator_export';
	}

	/**
	 * @param array<string,mixed> $workflow
	 */
	private static function client_node_id( array $workflow ): string {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $node['kind'] ?? '' ) ) === 'workflow_client' ) {
				return sanitize_text_field( (string) ( $node['id'] ?? '' ) );
			}
		}
		return '';
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @return array<int,string>
	 */
	private static function client_site_ids_from_workflow( array $workflow ): array {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $node['kind'] ?? '' ) ) !== 'workflow_client' ) {
				continue;
			}
			$config   = is_array( $node['config'] ?? null ) ? $node['config'] : array();
			$site_ids = isset( $config['siteIds'] ) && is_array( $config['siteIds'] ) ? $config['siteIds'] : array();
			$out      = array();
			foreach ( $site_ids as $site_id ) {
				$id = trim( (string) $site_id );
				if ( $id !== '' ) {
					$out[] = $id;
				}
			}
			return $out;
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @param array<string,mixed> $payload
	 */
	private static function continue_site_id( array $workflow, array $payload ): string {
		$from_payload = trim( (string) ( $payload['siteId'] ?? '' ) );
		if ( $from_payload !== '' ) {
			return $from_payload;
		}
		$from_workflow = trim( (string) ( $workflow['wordpressSiteId'] ?? '' ) );
		if ( $from_workflow !== '' ) {
			return $from_workflow;
		}
		$ids = self::client_site_ids_from_workflow( $workflow );
		return $ids[0] ?? '';
	}

	private static function recipe_key_for_kind( string $execution_kind ): string {
		$map = array(
			'local_dominator_export' => 'local_dominator_export',
			'entity_page_creator'    => 'entity_page_creator',
			'entity_generator'       => 'entity_generator',
			'post_creator'           => 'post_creator',
			'gsc_reporting'          => 'gsc_reporting',
			'content_gap_check'      => 'content_gap_check',
			'chatgpt_website_audit'  => 'chatgpt_website_audit',
			'browser_automation'     => 'browser_automation',
			'sap_generator'          => 'sap_generator',
		);
		return $map[ sanitize_key( $execution_kind ) ] ?? '';
	}
}

<?php
/**
 * Agent completion → workflow trigger dispatch.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Trigger_Agent_Done {

	/**
	 * @param array<string,mixed> $run
	 */
	public static function on_agent_run_terminal( array $run, string $previous_status ): void {
		if ( (string) ( $run['status'] ?? '' ) !== 'done' ) {
			return;
		}
		if ( $previous_status === 'done' ) {
			return;
		}
		$team_id = (int) ( $run['teamId'] ?? $run['team_id'] ?? 0 );
		if ( $team_id <= 0 ) {
			return;
		}
		$recipe_key = sanitize_key( (string) ( $run['recipeKey'] ?? $run['recipe_key'] ?? '' ) );
		$task_id    = (int) ( $run['taskId'] ?? $run['task_id'] ?? 0 );
		$project_id = 0;
		if ( $task_id > 0 ) {
			$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
			if ( is_array( $task ) ) {
				$project_id = (int) ( $task['projectId'] ?? 0 );
			}
		}
		foreach ( Neo_Pulse_App_Workflows_Store::list_published_workflows( $team_id ) as $workflow ) {
			if ( ! is_array( $workflow ) ) {
				continue;
			}
			$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
			foreach ( $nodes as $node ) {
				if ( ! is_array( $node ) || sanitize_key( (string) ( $node['kind'] ?? '' ) ) !== 'trigger_agent_done' ) {
					continue;
				}
				if ( ! self::matches( $node, $recipe_key, $project_id ) ) {
					continue;
				}
				Neo_Pulse_App_Workflow_Trigger_Evaluator::enqueue(
					$team_id,
					(int) ( $workflow['id'] ?? 0 ),
					'trigger_agent_done',
					array(
						'nodeId'      => (string) ( $node['id'] ?? '' ),
						'agentRunId'  => (int) ( $run['id'] ?? 0 ),
						'recipeKey'   => $recipe_key,
						'projectId'   => $project_id,
					)
				);
			}
		}
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function matches( array $node, string $recipe_key, int $project_id ): bool {
		$config = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$want_recipe = sanitize_key( (string) ( $config['recipeKey'] ?? '' ) );
		if ( $want_recipe !== '' && $want_recipe !== $recipe_key ) {
			return false;
		}
		$want_project = (int) ( $config['projectId'] ?? 0 );
		if ( $want_project > 0 && $want_project !== $project_id ) {
			return false;
		}
		$want_kind = sanitize_key( (string) ( $config['executionKind'] ?? '' ) );
		if ( $want_kind !== '' ) {
			$mapped = self::recipe_to_execution_kind( $recipe_key );
			if ( $mapped !== '' && $mapped !== $want_kind ) {
				return false;
			}
		}
		return true;
	}

	private static function recipe_to_execution_kind( string $recipe_key ): string {
		$map = array(
			'overview_pages_meta_batch' => 'content_optimizer_meta',
			'content_optimizer_bulk'    => 'content_optimizer',
			'gsc_reporting'             => 'gsc_reporting',
			'post_creator'              => 'post_creator',
			'local_dominator_export'    => 'local_dominator_export',
		);
		return $map[ sanitize_key( $recipe_key ) ] ?? '';
	}
}

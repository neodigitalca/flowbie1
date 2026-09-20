<?php
/**
 * Pulse Forge dashboard and workflow tools for Pulse Assist.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Tools_Forge {

	const DASHBOARD_AUTOMATION_CAP = 20;
	const DASHBOARD_WORKFLOW_CAP   = 20;
	const DASHBOARD_RUN_CAP        = 10;

	/**
	 * @return array<int,string>
	 */
	public static function tool_ids(): array {
		return array(
			'forge_dashboard',
			'workflows_list',
			'workflows_get',
			'workflows_list_runs',
			'workflows_create',
			'workflows_update',
			'workflows_publish',
			'workflows_delete',
			'workflows_run',
		);
	}

	public static function is_forge_tool( string $tool_id ): bool {
		return in_array( sanitize_key( $tool_id ), self::tool_ids(), true );
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function run( string $tool_id, array $args, array $body, int $user_id ): array {
		unset( $user_id );
		Neo_Pulse_App_Workflows_Store::install_tables();
		switch ( sanitize_key( $tool_id ) ) {
			case 'forge_dashboard':
				return self::dashboard( $body );
			case 'workflows_list':
				return self::list_workflows( $body );
			case 'workflows_get':
				return self::get_workflow( $args, $body );
			case 'workflows_list_runs':
				return self::list_runs( $args, $body );
			case 'workflows_create':
				return self::create_workflow( $args, $body );
			case 'workflows_update':
				return self::update_workflow( $args, $body );
			case 'workflows_publish':
				return self::publish_workflow( $args, $body );
			case 'workflows_delete':
				return self::delete_workflow( $args, $body );
			case 'workflows_run':
				return self::run_workflow( $args, $body );
			default:
				return array( 'ok' => false, 'error' => 'Unknown Forge tool.' );
		}
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function require_team( array $body ): int {
		return Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks::resolve_team_id( $body );
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 */
	private static function resolve_workflow_id( array $args, array $body ): int {
		$id = (int) ( $args['workflowId'] ?? $args['id'] ?? 0 );
		if ( $id > 0 ) {
			return $id;
		}
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		return (int) ( $pulse['forgeWorkflowId'] ?? 0 );
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @return array<string,mixed>
	 */
	private static function slim_workflow( array $workflow ): array {
		return array(
			'id'              => (int) ( $workflow['id'] ?? 0 ),
			'name'            => (string) ( $workflow['name'] ?? '' ),
			'status'          => (string) ( $workflow['status'] ?? 'draft' ),
			'wordpressSiteId' => $workflow['wordpressSiteId'] ?? null,
			'updatedAt'       => (string) ( $workflow['updatedAt'] ?? '' ),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function dashboard( array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}

		$automations = array();
		foreach ( Neo_Pulse_App_Tasks_Store::list_projects( $team_id ) as $project ) {
			if ( ! is_array( $project ) || ! Neo_Pulse_App_Tasks_Store::project_is_automation( $project ) ) {
				continue;
			}
			$automations[] = array(
				'id'                     => (int) ( $project['id'] ?? 0 ),
				'title'                  => (string) ( $project['title'] ?? '' ),
				'wordpressSiteId'        => (string) ( $project['wordpressSiteId'] ?? '' ),
				'sourceTemplateKeyword'  => (string) ( $project['sourceTemplateKeyword'] ?? '' ),
			);
			if ( count( $automations ) >= self::DASHBOARD_AUTOMATION_CAP ) {
				break;
			}
		}

		$workflows = array();
		$runs      = array();
		foreach ( Neo_Pulse_App_Workflows_Store::list_workflows( $team_id ) as $workflow ) {
			if ( ! is_array( $workflow ) ) {
				continue;
			}
			if ( count( $workflows ) < self::DASHBOARD_WORKFLOW_CAP ) {
				$workflows[] = self::slim_workflow( $workflow );
			}
			$workflow_id = (int) ( $workflow['id'] ?? 0 );
			if ( $workflow_id <= 0 || count( $runs ) >= self::DASHBOARD_RUN_CAP ) {
				continue;
			}
			foreach ( Neo_Pulse_App_Workflows_Store::list_runs( $team_id, $workflow_id ) as $run ) {
				if ( ! is_array( $run ) ) {
					continue;
				}
				$runs[] = array(
					'id'         => (int) ( $run['id'] ?? 0 ),
					'workflowId' => (int) ( $run['workflowId'] ?? $workflow_id ),
					'status'     => (string) ( $run['status'] ?? '' ),
					'createdAt'  => (string) ( $run['createdAt'] ?? '' ),
				);
				if ( count( $runs ) >= self::DASHBOARD_RUN_CAP ) {
					break;
				}
			}
		}

		return array(
			'ok'          => true,
			'automations' => $automations,
			'workflows'   => $workflows,
			'runs'        => $runs,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function list_workflows( array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflows = array();
		foreach ( Neo_Pulse_App_Workflows_Store::list_workflows( $team_id ) as $workflow ) {
			if ( is_array( $workflow ) ) {
				$workflows[] = self::slim_workflow( $workflow );
			}
		}
		return array(
			'ok'        => true,
			'workflows' => $workflows,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function get_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		$workflow = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, $workflow_id );
		if ( ! $workflow ) {
			return array( 'ok' => false, 'error' => 'Workflow not found.' );
		}
		return array(
			'ok'       => true,
			'workflow' => $workflow,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function list_runs( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		return array(
			'ok'   => true,
			'runs' => Neo_Pulse_App_Workflows_Store::list_runs( $team_id, $workflow_id ),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function create_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}

		$recipe_keyword = sanitize_title( (string) ( $args['recipeKeyword'] ?? $args['keyword'] ?? '' ) );
		$payload        = array(
			'name'            => sanitize_text_field( (string) ( $args['name'] ?? $args['title'] ?? '' ) ),
			'description'     => sanitize_textarea_field( (string) ( $args['description'] ?? '' ) ),
			'wordpressSiteId' => sanitize_text_field( (string) ( $args['wordpressSiteId'] ?? $args['siteId'] ?? '' ) ),
		);
		if ( $payload['wordpressSiteId'] === '' ) {
			$payload['wordpressSiteId'] = null;
		}

		if ( $recipe_keyword !== '' ) {
			$graph = self::graph_from_recipe_keyword( $recipe_keyword );
			if ( empty( $graph['ok'] ) ) {
				return $graph;
			}
			$payload['nodes']        = $graph['nodes'];
			$payload['edges']        = $graph['edges'];
			$payload['ragVariables'] = $graph['ragVariables'];
			if ( $payload['name'] === '' ) {
				$payload['name'] = (string) ( $graph['name'] ?? $recipe_keyword );
			}
			if ( $payload['description'] === '' && ! empty( $graph['description'] ) ) {
				$payload['description'] = (string) $graph['description'];
			}
		}

		if ( $payload['name'] === '' ) {
			$payload['name'] = 'Untitled workflow';
		}

		$workflow = Neo_Pulse_App_Workflows_Store::create_workflow( $team_id, $payload );
		if ( ! $workflow ) {
			return array( 'ok' => false, 'error' => 'Could not create workflow.' );
		}
		return array(
			'ok'         => true,
			'workflow'   => $workflow,
			'workflowId' => (int) ( $workflow['id'] ?? 0 ),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function update_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		$patch = array();
		if ( array_key_exists( 'name', $args ) || array_key_exists( 'title', $args ) ) {
			$patch['name'] = sanitize_text_field( (string) ( $args['name'] ?? $args['title'] ?? '' ) );
		}
		if ( array_key_exists( 'description', $args ) ) {
			$patch['description'] = sanitize_textarea_field( (string) $args['description'] );
		}
		if ( array_key_exists( 'wordpressSiteId', $args ) || array_key_exists( 'siteId', $args ) ) {
			$site = sanitize_text_field( (string) ( $args['wordpressSiteId'] ?? $args['siteId'] ?? '' ) );
			$patch['wordpressSiteId'] = $site !== '' ? $site : null;
		}
		if ( count( $patch ) === 0 ) {
			return array( 'ok' => false, 'error' => 'name, description, or wordpressSiteId is required.' );
		}
		$workflow = Neo_Pulse_App_Workflows_Store::patch_workflow( $team_id, $workflow_id, $patch );
		if ( ! $workflow ) {
			return array( 'ok' => false, 'error' => 'Workflow not found.' );
		}
		return array(
			'ok'         => true,
			'workflow'   => $workflow,
			'workflowId' => $workflow_id,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function publish_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		$workflow = Neo_Pulse_App_Workflows_Store::publish_workflow( $team_id, $workflow_id );
		if ( ! $workflow ) {
			return array( 'ok' => false, 'error' => 'Workflow not found.' );
		}
		return array(
			'ok'         => true,
			'workflow'   => $workflow,
			'workflowId' => $workflow_id,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function delete_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		$deleted = Neo_Pulse_App_Workflows_Store::delete_workflow( $team_id, $workflow_id );
		if ( ! $deleted ) {
			return array( 'ok' => false, 'error' => 'Workflow not found.' );
		}
		return array(
			'ok'         => true,
			'workflowId' => $workflow_id,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function run_workflow( array $args, array $body ): array {
		$team_id = self::require_team( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$workflow_id = self::resolve_workflow_id( $args, $body );
		if ( $workflow_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'workflowId is required.' );
		}
		$workflow = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, $workflow_id );
		if ( ! $workflow ) {
			return array( 'ok' => false, 'error' => 'Workflow not found.' );
		}
		$simulated = ! empty( $args['simulated'] );
		$payload   = isset( $args['triggerPayload'] ) && is_array( $args['triggerPayload'] ) ? $args['triggerPayload'] : array();
		if ( $simulated ) {
			$run = Neo_Pulse_App_Workflows_Store::create_run(
				$team_id,
				$workflow_id,
				array(
					'triggerKind'    => 'trigger_manual',
					'triggerPayload' => $payload,
					'simulated'      => true,
				)
			);
			if ( ! $run ) {
				return array( 'ok' => false, 'error' => 'Could not start run.' );
			}
			return array(
				'ok'         => true,
				'run'        => $run,
				'workflowId' => $workflow_id,
			);
		}
		$enqueued = Neo_Pulse_App_Workflow_Trigger_Evaluator::enqueue(
			$team_id,
			$workflow_id,
			'trigger_manual',
			$payload,
			false
		);
		if ( ! $enqueued ) {
			return array( 'ok' => false, 'error' => 'Could not start run.' );
		}
		$run = null;
		foreach ( Neo_Pulse_App_Workflow_Trigger_Pending_Store::list( $team_id ) as $item ) {
			if ( is_array( $item ) && (int) ( $item['workflowId'] ?? 0 ) === $workflow_id ) {
				$run_id = (int) ( $item['runId'] ?? 0 );
				if ( $run_id > 0 ) {
					$run = Neo_Pulse_App_Workflows_Store::get_run( $team_id, $run_id );
				}
				break;
			}
		}
		return array(
			'ok'         => true,
			'run'        => $run,
			'workflowId' => $workflow_id,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function graph_from_recipe_keyword( string $keyword ): array {
		if ( ! Neo_Pulse_App_Automation_Recipe_Registry::is_automation_keyword( $keyword ) ) {
			return array( 'ok' => false, 'error' => 'Valid recipe keyword is required.' );
		}
		$recipe = Neo_Pulse_App_Automation_Recipe_Registry::get_by_keyword( $keyword );
		if ( ! is_array( $recipe ) ) {
			return array( 'ok' => false, 'error' => 'Recipe not found.' );
		}
		$trigger = isset( $recipe['triggerBlock'] ) && is_array( $recipe['triggerBlock'] ) ? $recipe['triggerBlock'] : null;
		$actions = array();
		if ( isset( $recipe['actionBlocks'] ) && is_array( $recipe['actionBlocks'] ) ) {
			foreach ( $recipe['actionBlocks'] as $block ) {
				if ( is_array( $block ) ) {
					$actions[] = $block;
				}
			}
		} elseif ( isset( $recipe['actionBlock'] ) && is_array( $recipe['actionBlock'] ) ) {
			$actions[] = $recipe['actionBlock'];
		}
		if ( ! is_array( $trigger ) || count( $actions ) === 0 ) {
			return array( 'ok' => false, 'error' => 'Recipe has no trigger or action blocks.' );
		}

		$kind = sanitize_key( (string) ( $trigger['kind'] ?? '' ) );
		if ( $kind === 'calendar' ) {
			$trigger_kind = 'trigger_calendar';
			$trigger_config = array(
				'frequency' => sanitize_key( (string) ( $trigger['frequency'] ?? 'once' ) ),
				'startDate' => sanitize_text_field( (string) ( $trigger['startDate'] ?? '' ) ),
				'time'      => sanitize_text_field( (string) ( $trigger['time'] ?? '09:00' ) ),
			);
		} elseif ( $kind === 'gsc' ) {
			$trigger_kind = 'trigger_gsc';
			$trigger_config = array(
				'source'        => sanitize_key( (string) ( $trigger['source'] ?? 'gsc' ) ),
				'targetBucket'  => sanitize_key( (string) ( $trigger['targetBucket'] ?? '' ) ),
				'triggerConfig' => isset( $trigger['triggerConfig'] ) && is_array( $trigger['triggerConfig'] ) ? $trigger['triggerConfig'] : array(),
			);
		} else {
			$trigger_kind   = 'trigger_manual';
			$trigger_config = array();
		}

		$trigger_id = 'n_trigger';
		$nodes      = array(
			array(
				'id'       => $trigger_id,
				'kind'     => $trigger_kind,
				'label'    => $kind === 'calendar' ? 'Calendar' : ( $kind === 'gsc' ? 'GSC' : 'Manual' ),
				'config'   => $trigger_config,
				'position' => array( 'x' => 120, 'y' => 80 ),
			),
		);
		$edges         = array();
		$rag_variables = array();
		$prev_id       = $trigger_id;
		$y             = 220;
		$index         = 0;
		foreach ( $actions as $action ) {
			$index++;
			$action_id      = 'n_action_' . $index;
			$execution_kind = sanitize_key( (string) ( $action['executionKind'] ?? 'content_optimizer' ) );
			$title          = sanitize_text_field( (string) ( $action['title'] ?? $recipe['name'] ?? 'Action' ) );
			$variable_key   = $execution_kind . '_' . $index;
			$nodes[]        = array(
				'id'       => $action_id,
				'kind'     => 'action_agent',
				'label'    => $title !== '' ? $title : 'Action',
				'config'   => array(
					'executionKind'      => $execution_kind,
					'executionPayload'   => isset( $action['executionPayload'] ) && is_array( $action['executionPayload'] ) ? $action['executionPayload'] : array(),
					'ragVariableKey'     => $variable_key,
					'ragScope'           => 'run',
					'title'              => $title,
					'actionBlockKeyword' => sanitize_title( (string) ( $action['keyword'] ?? '' ) ),
					'recipeKeyword'      => $keyword,
					'recipeCategory'     => sanitize_key( (string) ( $recipe['category'] ?? '' ) ),
				),
				'position' => array( 'x' => 120, 'y' => $y ),
			);
			$edges[]         = array(
				'id'     => 'e_' . $prev_id . '_' . $action_id,
				'source' => $prev_id,
				'target' => $action_id,
			);
			$rag_variables[] = array(
				'key'    => $variable_key,
				'nodeId' => $action_id,
				'scope'  => 'run',
				'label'  => $title !== '' ? $title : $variable_key,
			);
			$prev_id = $action_id;
			$y      += 140;
		}

		return array(
			'ok'           => true,
			'name'         => (string) ( $recipe['name'] ?? $keyword ),
			'description'  => (string) ( $recipe['description'] ?? '' ),
			'nodes'        => $nodes,
			'edges'        => $edges,
			'ragVariables' => $rag_variables,
		);
	}
}

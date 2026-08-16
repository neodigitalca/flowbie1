<?php
/**
 * Task execution tools for Pulse Assist action orchestrator.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Tools_Executions {

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function run( string $tool_id, array $args, array $body, int $user_id ): array {
		$team_id = Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required for execution actions.' );
		}

		switch ( sanitize_key( $tool_id ) ) {
			case 'executions_start':
				$task_id = (int) ( $args['taskId'] ?? 0 );
				if ( $task_id <= 0 ) {
					return array( 'ok' => false, 'error' => 'taskId is required.' );
				}
				$payload = array();
				if ( ! empty( $args['executionKind'] ) ) {
					$payload['executionKind'] = sanitize_key( (string) $args['executionKind'] );
				}
				if ( isset( $args['executionPayload'] ) && is_array( $args['executionPayload'] ) ) {
					$payload['executionPayload'] = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $args['executionPayload'] );
				}
				return Neo_Pulse_App_Task_Execution_Coordinator::start( $team_id, $task_id, $user_id, $payload );

			case 'executions_get':
				$execution_id = (int) ( $args['executionId'] ?? 0 );
				if ( $execution_id <= 0 ) {
					return array( 'ok' => false, 'error' => 'executionId is required.' );
				}
				return Neo_Pulse_App_Task_Execution_Coordinator::get( $team_id, $execution_id );

			case 'executions_list_for_task':
				$task_id = (int) ( $args['taskId'] ?? 0 );
				if ( $task_id <= 0 ) {
					return array( 'ok' => false, 'error' => 'taskId is required.' );
				}
				return Neo_Pulse_App_Task_Execution_Coordinator::list_for_task( $team_id, $task_id );

			case 'gsc_reporting_execute':
				return self::gsc_reporting_execute( $team_id, $args, $body, $user_id );

			case 'post_creator_execute':
				return self::post_creator_execute( $team_id, $args, $body, $user_id );

			default:
				return array( 'ok' => false, 'error' => 'Unknown execution tool.' );
		}
	}

	public static function is_execution_tool( string $tool_id ): bool {
		return in_array(
			sanitize_key( $tool_id ),
			array( 'executions_start', 'executions_get', 'executions_list_for_task', 'gsc_reporting_execute', 'post_creator_execute' ),
			true
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function gsc_reporting_execute( int $team_id, array $args, array $body, int $user_id ): array {
		$preset = sanitize_key( (string) ( $args['comparePreset'] ?? 'mom' ) );
		$preset = $preset === 'yoy' ? 'yoy' : 'mom';
		$save   = ! array_key_exists( 'saveToDisk', $args ) || ! empty( $args['saveToDisk'] );

		$site_id = sanitize_text_field( (string) ( $args['wordpressSiteId'] ?? $args['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			$ctx = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
			$site_id = sanitize_text_field( (string) ( $ctx['activeWordPressSiteId'] ?? $body['siteId'] ?? '' ) );
		}
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'wordpressSiteId is required.' );
		}

		$label = $preset === 'yoy' ? 'GSC YoY report' : 'GSC MoM report';
		$run   = Neo_Pulse_App_Agent_Runs_Store::create_run(
			$team_id,
			$user_id,
			array(
				'recipeKey' => 'gsc_reporting',
				'title'     => $label,
				'source'    => 'pulse_assist',
				'context'   => array(
					'siteId'      => $site_id,
					'managerTab'  => 'generator',
				),
				'plan'      => array(
					'comparePreset' => $preset,
					'saveToDisk'    => $save,
				),
			)
		);

		if ( ! $run ) {
			return array( 'ok' => false, 'error' => 'Could not queue GSC report run.' );
		}

		return array(
			'ok'  => true,
			'run' => $run,
			'card' => array(
				'type'       => 'automation_dispatch',
				'title'      => $label,
				'body'       => 'GSC report queued. Open Running Agents to monitor progress.',
				'confidence' => 'high',
				'recipe_key' => 'gsc_reporting',
				'plan_json'  => array(
					'comparePreset' => $preset,
					'saveToDisk'    => $save,
				),
				'context_json' => array(
					'siteId'     => $site_id,
					'managerTab' => 'generator',
				),
				'cta'        => array(
					'label'  => 'Open Running Agents',
					'action' => 'agent_run_dispatch',
				),
			),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function post_creator_execute( int $team_id, array $args, array $body, int $user_id ): array {
		$site_id = sanitize_text_field( (string) ( $args['wordpressSiteId'] ?? $args['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			$ctx = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
			$site_id = sanitize_text_field( (string) ( $ctx['activeWordPressSiteId'] ?? $body['siteId'] ?? '' ) );
		}
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'wordpressSiteId is required.' );
		}

		$payload_raw = isset( $args['executionPayload'] ) && is_array( $args['executionPayload'] )
			? $args['executionPayload']
			: $args;
		$payload = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload_raw );
		if ( (int) ( $payload['postCount'] ?? 0 ) < 1 ) {
			$payload['postCount'] = max( 1, (int) ( $args['postCount'] ?? 1 ) );
		}

		$post_count = (int) ( $payload['postCount'] ?? 1 );
		$label      = 'Create ' . $post_count . ' post' . ( $post_count === 1 ? '' : 's' );

		$plan = array_merge(
			array(
				'postCount' => $post_count,
			),
			$payload
		);

		$run = Neo_Pulse_App_Agent_Runs_Store::create_run(
			$team_id,
			$user_id,
			array(
				'recipeKey' => 'post_creator',
				'title'     => $label,
				'source'    => 'pulse_assist',
				'context'   => array(
					'siteId'     => $site_id,
					'managerTab' => 'generator',
				),
				'plan'      => $plan,
			)
		);

		if ( ! $run ) {
			return array( 'ok' => false, 'error' => 'Could not queue post creator run.' );
		}

		return array(
			'ok'   => true,
			'run'  => $run,
			'card' => array(
				'type'         => 'automation_dispatch',
				'title'        => $label,
				'body'         => 'Post creator queued. Open Running Agents to monitor progress.',
				'confidence'   => 'high',
				'recipe_key'   => 'post_creator',
				'plan_json'    => $plan,
				'context_json' => array(
					'siteId'     => $site_id,
					'managerTab' => 'generator',
				),
				'cta'          => array(
					'label'  => 'Open Running Agents',
					'action' => 'agent_run_dispatch',
				),
			),
		);
	}
}

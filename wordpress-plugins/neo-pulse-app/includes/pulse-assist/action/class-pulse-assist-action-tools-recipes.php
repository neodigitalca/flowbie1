<?php
/**
 * Automation recipe tools for Pulse Assist action orchestrator.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Tools_Recipes {

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function run( string $tool_id, array $args, array $body, int $user_id ): array {
		switch ( sanitize_key( $tool_id ) ) {
			case 'recipes_list':
				return self::list_recipes( $args );
			case 'recipes_describe':
				return self::describe_recipe( $args );
			case 'recipes_install':
				return self::install_recipe( $args, $body, $user_id );
			case 'recipes_run':
				return self::run_recipe( $args, $body, $user_id );
			default:
				return array( 'ok' => false, 'error' => 'Unknown recipe tool.' );
		}
	}

	public static function is_recipe_tool( string $tool_id ): bool {
		return in_array(
			sanitize_key( $tool_id ),
			array( 'recipes_list', 'recipes_describe', 'recipes_install', 'recipes_run' ),
			true
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	private static function list_recipes( array $args ): array {
		$query = array(
			'category'     => sanitize_key( (string) ( $args['category'] ?? '' ) ),
			'bucket'       => sanitize_key( (string) ( $args['bucket'] ?? '' ) ),
			'execution'    => sanitize_key( (string) ( $args['execution'] ?? '' ) ),
			'signal'       => sanitize_key( (string) ( $args['signal'] ?? '' ) ),
			'vertical'     => sanitize_key( (string) ( $args['vertical'] ?? '' ) ),
			'q'            => sanitize_text_field( (string) ( $args['q'] ?? '' ) ),
			'includeTasks' => ! empty( $args['includeTasks'] ),
		);
		return array(
			'ok'      => true,
			'recipes' => Neo_Pulse_App_Automation_Recipe_Registry::list_for_api( $query ),
			'filters' => Neo_Pulse_App_Automation_Recipe_Registry::filter_options_for_api(),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	private static function describe_recipe( array $args ): array {
		$keyword = sanitize_title( (string) ( $args['keyword'] ?? $args['recipeKeyword'] ?? '' ) );
		if ( $keyword === '' ) {
			return array( 'ok' => false, 'error' => 'keyword is required.' );
		}
		$recipe = Neo_Pulse_App_Automation_Recipe_Registry::get_by_keyword( $keyword );
		if ( ! is_array( $recipe ) ) {
			return array( 'ok' => false, 'error' => 'Recipe not found.' );
		}
		return array(
			'ok'     => true,
			'recipe' => Neo_Pulse_App_Automation_Recipe_Registry::catalog_item_from_recipe( $recipe, true ),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function install_recipe( array $args, array $body, int $user_id ): array {
		$team_id = Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}
		$keyword = sanitize_title( (string) ( $args['keyword'] ?? $args['recipeKeyword'] ?? $args['templateKeyword'] ?? '' ) );
		if ( $keyword === '' || ! Neo_Pulse_App_Automation_Recipe_Registry::is_automation_keyword( $keyword ) ) {
			return array( 'ok' => false, 'error' => 'Valid recipe keyword is required.' );
		}
		$recipe = Neo_Pulse_App_Automation_Recipe_Registry::get_by_keyword( $keyword );
		$title  = sanitize_text_field( (string) ( $args['title'] ?? '' ) );
		if ( $title === '' && is_array( $recipe ) ) {
			$title = (string) ( $recipe['name'] ?? $keyword );
		}
		$site_id = sanitize_text_field( (string) ( $args['wordpressSiteId'] ?? $args['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'wordpressSiteId is required.' );
		}

		$payload = array(
			'title'            => $title,
			'templateKeyword'  => $keyword,
			'isAutomation'     => true,
			'wordpressSiteId'  => $site_id,
		);
		if ( ! empty( $body['team_context']['wordpressSites'] ) && is_array( $body['team_context']['wordpressSites'] ) ) {
			$payload['wordpressSites'] = $body['team_context']['wordpressSites'];
		}
		$client_name = Neo_Pulse_App_Tasks_Store::resolve_site_display_name( $payload, $site_id );
		if ( $client_name !== '' ) {
			$payload['title'] = Neo_Pulse_App_Tasks_Store::apply_client_to_task_title( $title, $client_name );
		}

		$project = Neo_Pulse_App_Tasks_Store::create_project( $team_id, $user_id, $payload );
		if ( ! $project ) {
			return array( 'ok' => false, 'error' => 'Could not install recipe.' );
		}

		$project_id = (int) ( $project['id'] ?? 0 );
		$tasks      = $project_id > 0 ? Neo_Pulse_App_Tasks_Store::list_tasks( $team_id, $project_id, true ) : array();

		return array(
			'ok'        => true,
			'project'   => $project,
			'projectId' => $project_id,
			'taskIds'   => array_values(
				array_map(
					static function ( $task ) {
						return (int) ( $task['id'] ?? 0 );
					},
					is_array( $tasks ) ? $tasks : array()
				)
			),
			'recipeKeyword' => $keyword,
			'card'          => array(
				'type'           => 'recipe_install_result',
				'title'          => 'Installed ' . $title,
				'body'           => 'Automation is live for this site.',
				'recipe_keyword' => $keyword,
				'project_id'     => $project_id,
			),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function run_recipe( array $args, array $body, int $user_id ): array {
		$mode = sanitize_key( (string) ( $args['mode'] ?? 'now' ) );
		if ( $mode === 'install_only' ) {
			return self::install_recipe( $args, $body, $user_id );
		}

		$team_id = Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required.' );
		}

		$task_id = (int) ( $args['taskId'] ?? 0 );
		if ( $task_id <= 0 ) {
			$install = self::install_recipe( $args, $body, $user_id );
			if ( empty( $install['ok'] ) ) {
				return $install;
			}
			$task_ids = isset( $install['taskIds'] ) && is_array( $install['taskIds'] ) ? $install['taskIds'] : array();
			$task_id  = (int) ( $task_ids[0] ?? 0 );
			if ( $task_id <= 0 ) {
				return array( 'ok' => false, 'error' => 'Installed automation has no runnable task.' );
			}
		}

		if ( $mode === 'evaluate' ) {
			$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
			if ( ! $task ) {
				return array( 'ok' => false, 'error' => 'Task not found.' );
			}
			$result = Neo_Pulse_App_Task_Trigger_Evaluator::evaluate_task(
				$team_id,
				$task,
				array( 'simulate' => ! empty( $args['simulate'] ) )
			);
			return array_merge( $result, array( 'taskId' => $task_id ) );
		}

		return Neo_Pulse_App_Task_Execution_Coordinator::start( $team_id, $task_id, $user_id, array() );
	}
}

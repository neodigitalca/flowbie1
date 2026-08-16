<?php
/**
 * Task manager tools for Pulse Assist action orchestrator.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Tools_Tasks {

	/**
	 * @param array<string,mixed> $body Request body (team_context, etc.).
	 * @return array<string,mixed>|null
	 */
	public static function team_context( array $body ): ?array {
		$ctx = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : null;
		if ( ! is_array( $ctx ) || empty( $ctx['teamId'] ) ) {
			return null;
		}
		return $ctx;
	}

	public static function resolve_team_id( array $body ): int {
		$ctx = self::team_context( $body );
		return $ctx ? (int) $ctx['teamId'] : 0;
	}

	/**
	 * Resolve task project id from active project, active property, or site name.
	 */
	public static function resolve_project_id( array $body, string $client_hint = '' ): int {
		$ctx = self::team_context( $body );
		if ( ! is_array( $ctx ) ) {
			return 0;
		}

		$active = (int) ( $ctx['activeProjectId'] ?? 0 );
		if ( $active > 0 ) {
			return $active;
		}

		$needle = self::client_name_hint( $body, $client_hint );
		if ( $needle === '' ) {
			return 0;
		}

		$projects = isset( $ctx['projects'] ) && is_array( $ctx['projects'] ) ? $ctx['projects'] : array();
		$best_id  = 0;
		$best_len = 0;
		foreach ( $projects as $project ) {
			if ( ! is_array( $project ) ) {
				continue;
			}
			$id = (int) ( $project['id'] ?? 0 );
			if ( $id <= 0 ) {
				continue;
			}
			$score = self::project_match_score(
				$needle,
				strtolower( trim( (string) ( $project['title'] ?? '' ) ) ),
				strtolower( trim( (string) ( $project['keyword'] ?? '' ) ) )
			);
			if ( $score > $best_len ) {
				$best_len = $score;
				$best_id  = $id;
			}
		}

		if ( $best_id <= 0 ) {
			$team_id = (int) ( $ctx['teamId'] ?? 0 );
			if ( $team_id > 0 ) {
				$best_id = self::match_project_list(
					Neo_Pulse_App_Tasks_Store::list_projects( $team_id, false ),
					$needle
				);
			}
		}

		return $best_id;
	}

	/**
	 * Active client / property label for cards and previews.
	 */
	public static function client_display_name( array $body ): string {
		$props     = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$active_id = (string) ( $props['activePropertyId'] ?? '' );
		$list      = isset( $props['properties'] ) && is_array( $props['properties'] ) ? $props['properties'] : array();
		foreach ( $list as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			if ( $active_id !== '' && (string) ( $row['id'] ?? '' ) === $active_id ) {
				return trim( (string) ( $row['name'] ?? '' ) );
			}
		}
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		return trim( (string) ( $pulse['siteName'] ?? '' ) );
	}

	public static function names_overlap( string $a, string $b ): bool {
		$a = strtolower( trim( $a ) );
		$b = strtolower( trim( $b ) );
		if ( $a === '' || $b === '' ) {
			return false;
		}
		return str_contains( $a, $b ) || str_contains( $b, $a );
	}

	/**
	 * Prefer a client-facing project label over unrelated task project titles.
	 */
	public static function project_label_for_card( array $body, int $project_id ): string {
		$client = self::client_display_name( $body );
		$title  = self::project_title_for_id( $body, $project_id );
		if ( $title !== '' && ( $client === '' || self::names_overlap( $title, $client ) ) ) {
			return $title;
		}
		if ( $client !== '' ) {
			return $client;
		}
		return $title;
	}

	/**
	 * @param array<int,array<string,mixed>> $projects
	 */
	private static function match_project_list( array $projects, string $needle ): int {
		$best_id  = 0;
		$best_len = 0;
		foreach ( $projects as $project ) {
			if ( ! is_array( $project ) ) {
				continue;
			}
			$id = (int) ( $project['id'] ?? 0 );
			if ( $id <= 0 ) {
				continue;
			}
			$score = self::project_match_score(
				$needle,
				strtolower( trim( (string) ( $project['title'] ?? '' ) ) ),
				strtolower( trim( (string) ( $project['keyword'] ?? '' ) ) )
			);
			if ( $score > $best_len ) {
				$best_len = $score;
				$best_id  = $id;
			}
		}
		return $best_id;
	}

	private static function project_match_score( string $needle, string $title, string $keyword ): int {
		$best = 0;
		if ( $title !== '' && ( str_contains( $title, $needle ) || str_contains( $needle, $title ) ) ) {
			$best = max( $best, strlen( $title ) );
		}
		if ( $keyword !== '' && ( str_contains( $keyword, $needle ) || str_contains( $needle, $keyword ) ) ) {
			$best = max( $best, strlen( $keyword ) );
		}
		return $best;
	}

	/**
	 * Match a team member display name to user id.
	 */
	public static function resolve_member_id( array $body, string $name_hint ): int {
		$name_hint = strtolower( trim( $name_hint ) );
		if ( $name_hint === '' ) {
			return 0;
		}
		$pulse_hints = array( 'pulse', 'neo pulse', 'flo', 'ai', 'neo pulse assist' );
		if ( in_array( $name_hint, $pulse_hints, true ) || str_contains( $name_hint, 'neo pulse' ) || str_contains( $name_hint, 'pulse ai' ) ) {
			$flo_id = Neo_Pulse_App_Tasks_Store::pulse_bot_user_id();
			if ( $flo_id > 0 ) {
				return $flo_id;
			}
		}
		$team_id = self::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return 0;
		}
		foreach ( self::members_for_team( $body, $team_id ) as $member ) {
			if ( ! is_array( $member ) ) {
				continue;
			}
			$name = strtolower( trim( (string) ( $member['displayName'] ?? '' ) ) );
			if ( $name !== '' && ( str_contains( $name, $name_hint ) || str_contains( $name_hint, $name ) ) ) {
				return (int) ( $member['userId'] ?? 0 );
			}
		}
		return 0;
	}

	public static function project_title_for_id( array $body, int $project_id ): string {
		if ( $project_id <= 0 ) {
			return '';
		}
		$ctx = self::team_context( $body );
		if ( is_array( $ctx ) ) {
			$projects = isset( $ctx['projects'] ) && is_array( $ctx['projects'] ) ? $ctx['projects'] : array();
			foreach ( $projects as $project ) {
				if ( ! is_array( $project ) ) {
					continue;
				}
				if ( (int) ( $project['id'] ?? 0 ) === $project_id ) {
					$title = trim( (string) ( $project['title'] ?? '' ) );
					if ( $title !== '' ) {
						return $title;
					}
				}
			}
		}
		$team_id = self::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return '';
		}
		foreach ( Neo_Pulse_App_Tasks_Store::list_projects( $team_id, false ) as $project ) {
			if ( ! is_array( $project ) ) {
				continue;
			}
			if ( (int) ( $project['id'] ?? 0 ) === $project_id ) {
				return trim( (string) ( $project['title'] ?? '' ) );
			}
		}
		return '';
	}

	private static function client_name_hint( array $body, string $client_hint ): string {
		$client_hint = strtolower( trim( $client_hint ) );
		if ( $client_hint !== '' ) {
			return $client_hint;
		}
		$props     = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$active_id = (string) ( $props['activePropertyId'] ?? '' );
		$list      = isset( $props['properties'] ) && is_array( $props['properties'] ) ? $props['properties'] : array();
		foreach ( $list as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			if ( $active_id !== '' && (string) ( $row['id'] ?? '' ) === $active_id ) {
				return strtolower( trim( (string) ( $row['name'] ?? '' ) ) );
			}
		}
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		return strtolower( trim( (string) ( $pulse['siteName'] ?? '' ) ) );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function run( string $tool_id, array $args, array $body, int $user_id ): array {
		Neo_Pulse_App_Tasks_Store::install_tables();
		$team_id = self::resolve_team_id( $body );
		if ( $team_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Team context is required for task actions.' );
		}

		switch ( sanitize_key( $tool_id ) ) {
			case 'tasks_list_projects':
				return array(
					'ok'       => true,
					'projects' => Neo_Pulse_App_Tasks_Store::list_projects( $team_id, false ),
				);
			case 'tasks_list_sections':
				$project_id = (int) ( $args['projectId'] ?? 0 );
				if ( $project_id <= 0 ) {
					return array( 'ok' => false, 'error' => 'projectId is required.' );
				}
				return array(
					'ok'       => true,
					'sections' => Neo_Pulse_App_Tasks_Store::list_sections( $team_id, $project_id ),
				);
			case 'tasks_search':
				$query = isset( $args['query'] ) ? sanitize_text_field( (string) $args['query'] ) : '';
				return array(
					'ok'    => true,
					'tasks' => Neo_Pulse_App_Tasks_Store::search_tasks( $team_id, $query ),
				);
			case 'tasks_list_my':
				return array(
					'ok'    => true,
					'tasks' => Neo_Pulse_App_Tasks_Store::list_my_tasks( $team_id, $user_id ),
				);
			case 'tasks_list_pulse_assigned':
				return array(
					'ok'    => true,
					'tasks' => Neo_Pulse_App_Tasks_Store::list_pulse_assigned_tasks( $team_id ),
				);
			case 'team_list_members':
				return array(
					'ok'      => true,
					'members' => self::members_for_team( $body, $team_id ),
				);
			case 'tasks_list_templates':
				return array(
					'ok'        => true,
					'templates' => Neo_Pulse_App_Tasks_Store::list_templates( $team_id ),
				);
			case 'tasks_create':
				return self::create_one( $team_id, $user_id, $args, $body );
			case 'tasks_create_batch':
				return self::create_batch( $team_id, $user_id, $args, $body );
			case 'tasks_update':
				return self::update_one( $team_id, $user_id, $args );
			case 'tasks_create_project':
				return self::create_project( $team_id, $user_id, $args, $body );
			case 'tasks_save_template':
			case 'tasks_delete_template':
				return Neo_Pulse_App_Pulse_Assist_Action_Tools_Templates::run( $tool_id, $args, $body, $user_id );
			default:
				return array( 'ok' => false, 'error' => 'Unknown task tool.' );
		}
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function members_for_team( array $body, int $team_id ): array {
		$ctx = self::team_context( $body );
		if ( is_array( $ctx ) && ! empty( $ctx['members'] ) && is_array( $ctx['members'] ) ) {
			return $ctx['members'];
		}
		return Neo_Pulse_App_Teams_Store::list_members( $team_id );
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function create_one( int $team_id, int $user_id, array $args, array $body ): array {
		$project_id = (int) ( $args['projectId'] ?? 0 );
		if ( $project_id <= 0 ) {
			$project_id = (int) ( self::team_context( $body )['activeProjectId'] ?? 0 );
		}
		if ( $project_id <= 0 ) {
			$project_id = self::resolve_project_id( $body );
		}
		if ( $project_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'projectId is required.' );
		}

		$section_id = (int) ( $args['sectionId'] ?? 0 );
		if ( $section_id <= 0 ) {
			$section_id = self::default_section_id( $team_id, $project_id );
		}

		$payload = array(
			'title'        => isset( $args['title'] ) ? sanitize_text_field( (string) $args['title'] ) : '',
			'keyword'      => isset( $args['keyword'] ) ? sanitize_text_field( (string) $args['keyword'] ) : '',
			'sectionId'    => $section_id,
			'assigneeIds'  => self::sanitize_assignee_ids( $args['assigneeIds'] ?? array() ),
			'status'       => isset( $args['status'] ) ? sanitize_text_field( (string) $args['status'] ) : 'todo',
			'description'  => isset( $args['description'] ) ? sanitize_textarea_field( (string) $args['description'] ) : '',
			'dueDate'      => isset( $args['dueDate'] ) ? sanitize_text_field( (string) $args['dueDate'] ) : '',
			'tagIds'       => isset( $args['tagIds'] ) && is_array( $args['tagIds'] ) ? $args['tagIds'] : array(),
		);
		if ( ! empty( $args['wordpressSiteId'] ) ) {
			$payload['wordpressSiteId'] = sanitize_text_field( (string) $args['wordpressSiteId'] );
		}
		if ( isset( $args['recurrenceRule'] ) ) {
			$payload['recurrenceRule'] = sanitize_text_field( (string) $args['recurrenceRule'] );
		}

		$task = Neo_Pulse_App_Tasks_Store::create_task( $team_id, $project_id, $user_id, $payload );
		if ( ! $task ) {
			return array( 'ok' => false, 'error' => 'Could not create task.' );
		}
		return array(
			'ok'        => true,
			'task'      => $task,
			'projectId' => $project_id,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function create_batch( int $team_id, int $user_id, array $args, array $body ): array {
		$project_id = (int) ( $args['projectId'] ?? 0 );
		if ( $project_id <= 0 ) {
			$project_id = (int) ( self::team_context( $body )['activeProjectId'] ?? 0 );
		}
		if ( $project_id <= 0 ) {
			$project_id = self::resolve_project_id( $body );
		}
		if ( $project_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'projectId is required.' );
		}

		$tasks_in = isset( $args['tasks'] ) && is_array( $args['tasks'] ) ? $args['tasks'] : array();
		if ( count( $tasks_in ) === 0 ) {
			return array( 'ok' => false, 'error' => 'tasks array is required.' );
		}
		if ( count( $tasks_in ) > Neo_Pulse_App_Pulse_Assist_Action_Registry::MAX_BATCH_TASKS ) {
			return array(
				'ok'    => false,
				'error' => 'Batch exceeds max ' . Neo_Pulse_App_Pulse_Assist_Action_Registry::MAX_BATCH_TASKS . ' tasks.',
			);
		}

		$default_section = self::default_section_id( $team_id, $project_id );
		$created         = array();
		$ids             = array();

		foreach ( $tasks_in as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$section_id = (int) ( $row['sectionId'] ?? $default_section );
			$payload    = array(
				'title'       => isset( $row['title'] ) ? sanitize_text_field( (string) $row['title'] ) : '',
				'keyword'     => isset( $row['keyword'] ) ? sanitize_text_field( (string) $row['keyword'] ) : '',
				'sectionId'   => $section_id,
				'assigneeIds' => self::sanitize_assignee_ids( $row['assigneeIds'] ?? array() ),
				'status'      => isset( $row['status'] ) ? sanitize_text_field( (string) $row['status'] ) : 'todo',
				'description' => isset( $row['description'] ) ? sanitize_textarea_field( (string) $row['description'] ) : '',
				'dueDate'     => isset( $row['dueDate'] ) ? sanitize_text_field( (string) $row['dueDate'] ) : '',
			);
			$task = Neo_Pulse_App_Tasks_Store::create_task( $team_id, $project_id, $user_id, $payload );
			if ( $task ) {
				$created[] = $task;
				$ids[]     = (int) ( $task['id'] ?? 0 );
			}
		}

		return array(
			'ok'             => count( $created ) > 0,
			'created'          => $created,
			'createdTaskIds'   => array_values( array_filter( $ids ) ),
			'projectId'        => $project_id,
			'createdCount'     => count( $created ),
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	private static function update_one( int $team_id, int $user_id, array $args ): array {
		$task_id = (int) ( $args['taskId'] ?? 0 );
		if ( $task_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'taskId is required.' );
		}
		$patch = array();
		foreach ( array( 'title', 'keyword', 'status', 'description', 'dueDate', 'recurrenceRule' ) as $key ) {
			if ( isset( $args[ $key ] ) ) {
				$patch[ $key ] = $args[ $key ];
			}
		}
		if ( array_key_exists( 'wordpressSiteId', $args ) ) {
			$patch['wordpressSiteId'] = $args['wordpressSiteId'];
		}
		if ( isset( $args['assigneeIds'] ) && is_array( $args['assigneeIds'] ) ) {
			$patch['assigneeIds'] = self::sanitize_assignee_ids( $args['assigneeIds'] );
		}
		$task = Neo_Pulse_App_Tasks_Store::update_task( $team_id, $task_id, $patch, $user_id );
		if ( ! $task ) {
			return array( 'ok' => false, 'error' => 'Could not update task.' );
		}
		return array( 'ok' => true, 'task' => $task );
	}

	/**
	 * @param array<string,mixed> $args
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function create_project( int $team_id, int $user_id, array $args, array $body ): array {
		$payload = array(
			'title'       => isset( $args['title'] ) ? sanitize_text_field( (string) $args['title'] ) : '',
			'keyword'     => isset( $args['keyword'] ) ? sanitize_text_field( (string) $args['keyword'] ) : '',
			'description' => isset( $args['description'] ) ? sanitize_textarea_field( (string) $args['description'] ) : '',
		);
		if ( ! empty( $args['templateKeyword'] ) ) {
			$payload['templateKeyword'] = sanitize_title( (string) $args['templateKeyword'] );
		}
		if ( ! empty( $args['isAutomation'] ) || ( ! empty( $payload['templateKeyword'] ) && Neo_Pulse_App_Automation_Recipe_Registry::is_automation_keyword( (string) $payload['templateKeyword'] ) ) ) {
			$payload['isAutomation'] = true;
		}
		if ( isset( $args['taskClients'] ) && is_array( $args['taskClients'] ) ) {
			$payload['taskClients'] = $args['taskClients'];
		}
		if ( ! empty( $args['wordpressSiteId'] ) ) {
			$payload['wordpressSiteId'] = sanitize_text_field( (string) $args['wordpressSiteId'] );
		}
		if ( ! empty( $body['team_context']['wordpressSites'] ) && is_array( $body['team_context']['wordpressSites'] ) ) {
			$payload['wordpressSites'] = $body['team_context']['wordpressSites'];
		}
		if ( isset( $args['defaultTasks'] ) && is_array( $args['defaultTasks'] ) ) {
			$payload['defaultTasks'] = $args['defaultTasks'];
		}
		$project = Neo_Pulse_App_Tasks_Store::create_project( $team_id, $user_id, $payload );
		if ( ! $project ) {
			return array( 'ok' => false, 'error' => 'Could not create project.' );
		}
		return array( 'ok' => true, 'project' => $project, 'projectId' => (int) ( $project['id'] ?? 0 ) );
	}

	private static function default_section_id( int $team_id, int $project_id ): int {
		$sections = Neo_Pulse_App_Tasks_Store::list_sections( $team_id, $project_id );
		if ( count( $sections ) === 0 ) {
			return 0;
		}
		return (int) ( $sections[0]['id'] ?? 0 );
	}

	/**
	 * @param mixed $raw
	 * @return array<int,int>
	 */
	private static function sanitize_assignee_ids( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$out = array();
		foreach ( $raw as $uid ) {
			$uid = (int) $uid;
			if ( $uid > 0 ) {
				$out[] = $uid;
			}
		}
		return array_values( array_unique( $out ) );
	}
}

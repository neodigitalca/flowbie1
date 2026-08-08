<?php
/**
 * /api/teams/{id}/tasks/* route handlers.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Tasks_Route_Handlers {

	/**
	 * @param array<string,mixed> $team
	 * @param array<string,mixed> $member
	 * @param string              $sub    Route after tasks/.
	 * @param string              $method HTTP method.
	 * @param array<string,mixed> $body   JSON body.
	 * @param int                 $user_id
	 */
	public static function dispatch( array $team, array $member, string $sub, string $method, array $body, int $user_id ): void {
		Flowbie_App_Tasks_Store::install_tables();
		$team_id = (int) $team['id'];
		$sub     = trim( $sub, '/' );
		$method  = strtoupper( $method );

		if ( ! Flowbie_App_Tasks_Store::is_active_member( $member ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		if ( $sub === 'tags' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'   => true,
					'tags' => Flowbie_App_Tasks_Store::list_tags( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'tags' && $method === 'POST' ) {
			$tags = isset( $body['tags'] ) && is_array( $body['tags'] ) ? $body['tags'] : array();
			$saved = Flowbie_App_Tasks_Store::save_tags( $team_id, $tags );
			if ( ! $saved ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not save tags' ), 500 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'   => true,
					'tags' => Flowbie_App_Tasks_Store::list_tags( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'my' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'              => true,
					'tasks'           => Flowbie_App_Tasks_Store::list_my_tasks( $team_id, $user_id ),
					'completedToday'  => Flowbie_App_Tasks_Store::count_completed_today( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'search' && $method === 'GET' ) {
			$q = isset( $_GET['q'] ) ? sanitize_text_field( (string) wp_unslash( $_GET['q'] ) ) : '';
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'tasks' => Flowbie_App_Tasks_Store::search_tasks( $team_id, $q ),
				)
			);
			return;
		}

		if ( $sub === 'templates' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'templates' => Flowbie_App_Tasks_Store::list_templates( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'templates' && $method === 'POST' ) {
			$templates = isset( $body['templates'] ) && is_array( $body['templates'] ) ? $body['templates'] : array();
			$saved     = Flowbie_App_Tasks_Store::save_templates( $team_id, $templates );
			if ( ! $saved ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not save templates' ), 500 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'templates' => Flowbie_App_Tasks_Store::list_templates( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'projects' && $method === 'GET' ) {
			$include_archived = ! empty( $_GET['archived'] );
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'projects' => Flowbie_App_Tasks_Store::list_projects( $team_id, $include_archived ),
				)
			);
			return;
		}

		if ( $sub === 'projects' && $method === 'POST' ) {
			$project = Flowbie_App_Tasks_Store::create_project( $team_id, $user_id, $body );
			if ( ! $project ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create project' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'project' => $project ) );
			return;
		}

		if ( preg_match( '#^projects/(\d+)$#', $sub, $m ) ) {
			self::dispatch_project( $team_id, (int) $m[1], $method, $body );
			return;
		}

		if ( preg_match( '#^projects/(\d+)/sections$#', $sub, $m ) ) {
			$project_id = (int) $m[1];
			if ( $method === 'GET' ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'       => true,
						'sections' => Flowbie_App_Tasks_Store::list_sections( $team_id, $project_id ),
					)
				);
				return;
			}
			if ( $method === 'POST' ) {
				$section = Flowbie_App_Tasks_Store::create_section( $team_id, $project_id, $body );
				if ( ! $section ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create section' ), 400 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'section' => $section ) );
				return;
			}
		}

		if ( preg_match( '#^projects/(\d+)/sections/(\d+)$#', $sub, $m ) ) {
			$section_id = (int) $m[2];
			if ( $method === 'PATCH' ) {
				$section = Flowbie_App_Tasks_Store::update_section( $team_id, $section_id, $body );
				if ( ! $section ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'section' => $section ) );
				return;
			}
			if ( $method === 'DELETE' ) {
				$ok = Flowbie_App_Tasks_Store::delete_section( $team_id, $section_id );
				if ( ! $ok ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
				return;
			}
		}

		if ( preg_match( '#^projects/(\d+)/files$#', $sub, $m ) && $method === 'GET' ) {
			$project_id = (int) $m[1];
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'files' => Flowbie_App_Tasks_Store::list_project_files( $team_id, $project_id ),
				)
			);
			return;
		}

		if ( preg_match( '#^projects/(\d+)/tasks$#', $sub, $m ) ) {
			$project_id = (int) $m[1];
			if ( $method === 'GET' ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'    => true,
						'tasks' => Flowbie_App_Tasks_Store::list_tasks( $team_id, $project_id ),
					)
				);
				return;
			}
			if ( $method === 'POST' ) {
				$task = Flowbie_App_Tasks_Store::create_task( $team_id, $project_id, $user_id, $body );
				if ( ! $task ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create task' ), 400 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'task' => $task ) );
				return;
			}
		}

		if ( preg_match( '#^tasks/(\d+)$#', $sub, $m ) ) {
			self::dispatch_task( $team_id, (int) $m[1], $method, $body, $user_id );
			return;
		}

		if ( preg_match( '#^tasks/(\d+)/subtasks$#', $sub, $m ) ) {
			$task_id = (int) $m[1];
			if ( $method === 'GET' ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'       => true,
						'subtasks' => Flowbie_App_Tasks_Store::list_subtasks( $team_id, $task_id ),
					)
				);
				return;
			}
			if ( $method === 'POST' ) {
				$parent = Flowbie_App_Tasks_Store::get_task( $team_id, $task_id );
				if ( ! $parent ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				$task = Flowbie_App_Tasks_Store::create_task(
					$team_id,
					(int) $parent['projectId'],
					$user_id,
					array_merge( $body, array( 'parentTaskId' => $task_id ) )
				);
				if ( ! $task ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create subtask' ), 400 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'task' => $task ) );
				return;
			}
		}

		if ( preg_match( '#^tasks/(\d+)/notes$#', $sub, $m ) ) {
			$task_id = (int) $m[1];
			if ( $method === 'GET' ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'    => true,
						'notes' => Flowbie_App_Tasks_Store::list_notes( $team_id, $task_id ),
					)
				);
				return;
			}
			if ( $method === 'POST' ) {
				$note = Flowbie_App_Tasks_Store::add_note( $team_id, $task_id, $user_id, $body );
				if ( ! $note ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not add note' ), 400 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'note' => $note ) );
				return;
			}
		}

		if ( preg_match( '#^tasks/(\d+)/files$#', $sub, $m ) && $method === 'POST' ) {
			$task_id = (int) $m[1];
			self::upload_file( $team_id, $task_id, $user_id, $body );
			return;
		}

		if ( preg_match( '#^tasks/(\d+)/files/(\d+)$#', $sub, $m ) && $method === 'GET' ) {
			$task_id  = (int) $m[1];
			$asset_id = (int) $m[2];
			$inline   = isset( $_GET['inline'] ) && (string) wp_unslash( $_GET['inline'] ) === '1';
			Flowbie_App_Tasks_Assets::serve( $team_id, $task_id, $asset_id, $inline );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function dispatch_project( int $team_id, int $project_id, string $method, array $body ): void {
		if ( $method === 'GET' ) {
			$project = Flowbie_App_Tasks_Store::get_project( $team_id, $project_id );
			if ( ! $project ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'project' => $project ) );
			return;
		}

		if ( $method === 'PATCH' ) {
			$project = Flowbie_App_Tasks_Store::update_project( $team_id, $project_id, $body );
			if ( ! $project ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'project' => $project ) );
			return;
		}

		if ( $method === 'DELETE' ) {
			$ok = Flowbie_App_Tasks_Store::archive_project( $team_id, $project_id );
			if ( ! $ok ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Method not allowed' ), 405 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function dispatch_task( int $team_id, int $task_id, string $method, array $body, int $user_id ): void {
		if ( $method === 'GET' ) {
			$task = Flowbie_App_Tasks_Store::get_task( $team_id, $task_id );
			if ( ! $task ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'task'     => $task,
					'notes'    => Flowbie_App_Tasks_Store::list_notes( $team_id, $task_id ),
					'files'    => Flowbie_App_Tasks_Assets::list_for_task( $team_id, $task_id ),
					'subtasks' => Flowbie_App_Tasks_Store::list_subtasks( $team_id, $task_id ),
				)
			);
			return;
		}

		if ( $method === 'PATCH' ) {
			$task = Flowbie_App_Tasks_Store::update_task( $team_id, $task_id, $body );
			if ( ! $task ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'task' => $task ) );
			return;
		}

		if ( $method === 'DELETE' ) {
			$ok = Flowbie_App_Tasks_Store::delete_task( $team_id, $task_id );
			if ( ! $ok ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Method not allowed' ), 405 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function upload_file( int $team_id, int $task_id, int $user_id, array $body ): void {
		$file_name   = isset( $body['fileName'] ) ? (string) $body['fileName'] : '';
		$mime        = isset( $body['mime'] ) ? (string) $body['mime'] : '';
		$data_base64 = isset( $body['dataBase64'] ) ? (string) $body['dataBase64'] : '';
		if ( $file_name === '' || $data_base64 === '' ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'fileName and dataBase64 required' ), 400 );
			return;
		}

		$binary = base64_decode( $data_base64, true );
		if ( ! is_string( $binary ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid base64' ), 400 );
			return;
		}

		$file = Flowbie_App_Tasks_Assets::upload( $team_id, $task_id, $user_id, $file_name, $mime, $binary );
		if ( ! $file ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Upload failed' ), 400 );
			return;
		}
		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'file' => $file ) );
	}
}

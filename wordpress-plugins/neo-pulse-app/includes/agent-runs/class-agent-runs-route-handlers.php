<?php
/**
 * /api/agent-runs/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Runs_Route_Handlers {

	/**
	 * @param string              $subpath Route after agent-runs/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		Neo_Pulse_App_Agent_Runs_Store::install_tables();
		Neo_Pulse_App_Tasks_Store::install_tables();

		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( ! $user ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Unauthorized' ), 401 );
			return;
		}

		$user_id = (int) ( $user['id'] ?? 0 );
		$subpath = trim( $subpath, '/' );
		$method  = strtoupper( $method );

		if ( $subpath === '' && $method === 'GET' ) {
			self::list_runs( $body, $user_id );
			return;
		}

		if ( $subpath === '' && $method === 'POST' ) {
			self::create_run( $body, $user_id );
			return;
		}

		if ( preg_match( '#^(\d+)$#', $subpath, $m ) ) {
			$run_id = (int) $m[1];
			if ( $method === 'GET' ) {
				self::get_run( $run_id, $body, $user_id );
				return;
			}
			if ( $method === 'PATCH' ) {
				self::patch_run( $run_id, $body, $user_id );
				return;
			}
		}

		if ( preg_match( '#^(\d+)/cancel$#', $subpath, $m ) && $method === 'POST' ) {
			self::cancel_run( (int) $m[1], $body, $user_id );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function resolve_team( array $body, int $user_id ): ?array {
		$team_id = (int) ( $body['teamId'] ?? 0 );
		if ( $team_id <= 0 && isset( $_GET['teamId'] ) ) {
			$team_id = (int) wp_unslash( $_GET['teamId'] );
		}
		if ( $team_id <= 0 ) {
			$ctx = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
			$team_id = (int) ( $ctx['teamId'] ?? 0 );
		}
		if ( $team_id <= 0 ) {
			return null;
		}

		$member = Neo_Pulse_App_Teams_Store::get_membership( $team_id, $user_id );
		if ( ! is_array( $member ) || ! Neo_Pulse_App_Tasks_Store::is_active_member( $member ) ) {
			return null;
		}

		return array(
			'team_id' => $team_id,
			'member'  => $member,
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function list_runs( array $body, int $user_id ): void {
		$resolved = self::resolve_team( $body, $user_id );
		if ( ! $resolved ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$filters = array(
			'limit' => isset( $_GET['limit'] ) ? (int) wp_unslash( $_GET['limit'] ) : 50,
		);
		if ( isset( $_GET['status'] ) ) {
			$filters['status'] = sanitize_key( (string) wp_unslash( $_GET['status'] ) );
		}
		if ( isset( $_GET['source'] ) ) {
			$filters['source'] = sanitize_key( (string) wp_unslash( $_GET['source'] ) );
		}
		if ( isset( $_GET['task_id'] ) ) {
			$filters['task_id'] = (int) wp_unslash( $_GET['task_id'] );
		} elseif ( isset( $body['taskId'] ) ) {
			$filters['task_id'] = (int) $body['taskId'];
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'   => true,
				'runs' => Neo_Pulse_App_Agent_Runs_Store::list_runs( $resolved['team_id'], $filters ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function create_run( array $body, int $user_id ): void {
		$resolved = self::resolve_team( $body, $user_id );
		if ( ! $resolved ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$run = Neo_Pulse_App_Agent_Runs_Store::create_run( $resolved['team_id'], $user_id, $body );
		if ( ! $run ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'error' => 'Could not create agent run' ),
				400
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'  => true,
				'run' => $run,
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function get_run( int $run_id, array $body, int $user_id ): void {
		$resolved = self::resolve_team( $body, $user_id );
		if ( ! $resolved ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$run = Neo_Pulse_App_Agent_Runs_Store::get_run( $resolved['team_id'], $run_id );
		if ( ! $run ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'  => true,
				'run' => $run,
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function patch_run( int $run_id, array $body, int $user_id ): void {
		$resolved = self::resolve_team( $body, $user_id );
		if ( ! $resolved ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$run = Neo_Pulse_App_Agent_Runs_Store::patch_run( $resolved['team_id'], $run_id, $body );
		if ( ! $run ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
			return;
		}

		if ( ! empty( $body['taskStatus'] ) && ! empty( $run['taskId'] ) ) {
			$status = sanitize_key( (string) $body['taskStatus'] );
			if ( in_array( $status, Neo_Pulse_App_Tasks_Store::STATUSES, true ) ) {
				Neo_Pulse_App_Tasks_Store::update_task(
					$resolved['team_id'],
					(int) $run['taskId'],
					array( 'status' => $status ),
					$user_id
				);
			}
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'  => true,
				'run' => $run,
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function cancel_run( int $run_id, array $body, int $user_id ): void {
		$resolved = self::resolve_team( $body, $user_id );
		if ( ! $resolved ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		$run = Neo_Pulse_App_Agent_Runs_Store::cancel_run( $resolved['team_id'], $run_id );
		if ( ! $run ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'  => true,
				'run' => $run,
			)
		);
	}
}

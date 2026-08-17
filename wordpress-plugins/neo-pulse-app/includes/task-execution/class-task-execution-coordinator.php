<?php
/**
 * Task execution coordinator: start, progress, complete, cancel.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Coordinator {

	/**
	 * @param array<string,mixed> $body Execute overrides.
	 * @return array<string,mixed>
	 */
	public static function start( int $team_id, int $task_id, int $user_id, array $body = array() ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();

		$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
		if ( ! $task ) {
			return array( 'ok' => false, 'error' => 'Task not found.' );
		}
		if ( ! Neo_Pulse_App_Tasks_Store::task_has_pulse_assignee( $task ) ) {
			return array( 'ok' => false, 'error' => 'Task must be assigned to Pulse AI to execute.' );
		}

		$kind = Neo_Pulse_App_Tasks_Store::sanitize_execution_kind(
			$body['executionKind'] ?? $task['executionKind'] ?? ''
		);
		if ( $kind === '' ) {
			return array( 'ok' => false, 'error' => 'executionKind is required.' );
		}

		$payload = is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array();
		if ( isset( $body['executionPayload'] ) && is_array( $body['executionPayload'] ) ) {
			$payload = array_merge(
				$payload,
				Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $body['executionPayload'] )
			);
		}
		$payload = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		if ( ! empty( $payload['automationEmailTo'] ) ) {
			$payload['sendAutomationEmail'] = true;
			$payload['saveLocalArchive']    = true;
		}

		$site_id = trim( (string) ( $body['wordpressSiteId'] ?? $task['wordpressSiteId'] ?? '' ) );
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'Task wordpressSiteId is required.' );
		}

		$target_url = trim( (string) ( $payload['targetUrl'] ?? '' ) );
		$target_bucket = Neo_Pulse_App_Tasks_Store::sanitize_execution_target_bucket( $payload['targetBucket'] ?? '' );
		$target_urls = isset( $payload['targetUrls'] ) && is_array( $payload['targetUrls'] ) ? $payload['targetUrls'] : array();
		if ( $kind !== 'gsc_reporting' && $kind !== 'post_creator' && $kind !== 'local_dominator_export' ) {
			if ( Neo_Pulse_App_Tasks_Store::is_execution_target_all( $target_url ) && $target_bucket === '' ) {
				$target_bucket = 'all';
			}
			if ( $target_bucket === '' && count( $target_urls ) === 0 ) {
				return array( 'ok' => false, 'error' => 'executionPayload.targetBucket is required.' );
			}
			if ( $target_bucket === '' && count( $target_urls ) > 0 ) {
				$target_bucket = 'pages';
			}
		} elseif ( $kind === 'gsc_reporting' ) {
			$preset = sanitize_key( (string) ( $payload['comparePreset'] ?? 'mom' ) );
			if ( $preset !== 'mom' && $preset !== 'yoy' ) {
				return array( 'ok' => false, 'error' => 'executionPayload.comparePreset must be mom or yoy.' );
			}
		} elseif ( $kind === 'post_creator' ) {
			$post_count = (int) ( $payload['postCount'] ?? 0 );
			if ( $post_count < 1 ) {
				return array( 'ok' => false, 'error' => 'executionPayload.postCount must be at least 1.' );
			}
		} elseif ( $kind === 'local_dominator_export' ) {
			$business_name = trim( (string) ( $payload['businessName'] ?? '' ) );
			$ld_keyword    = trim( (string) ( $payload['keyword'] ?? '' ) );
			if ( $business_name === '' || $ld_keyword === '' ) {
				return array( 'ok' => false, 'error' => 'executionPayload.businessName and keyword are required.' );
			}
		}

		$execution = Neo_Pulse_App_Task_Execution_Store::create( $team_id, $task_id, $kind, $user_id, array() );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Could not create execution job.' );
		}

		$execution_id = (int) $execution['id'];
		Neo_Pulse_App_Task_Execution_Progress::init( $team_id, $execution_id, 'queued' );
		Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, 'queued' );

		if ( (string) ( $task['status'] ?? '' ) !== 'in_progress' ) {
			Neo_Pulse_App_Tasks_Store::update_task(
				$team_id,
				$task_id,
				array( 'status' => 'in_progress' ),
				$user_id
			);
			$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
		}

		Neo_Pulse_App_Task_Execution_Store::update(
			$team_id,
			$execution_id,
			array( 'status' => 'preflight' )
		);
		Neo_Pulse_App_Task_Execution_Progress::update(
			$team_id,
			$execution_id,
			array(
				'status'  => 'preflight',
				'message' => 'Resolving site and URL…',
			)
		);
		Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, 'preflight' );

		$context = array(
			'teamId'      => $team_id,
			'taskId'      => $task_id,
			'userId'      => $user_id,
			'siteId'      => $site_id,
			'targetUrl'   => $target_url,
			'targetBucket'=> $target_bucket,
			'payload'     => $payload,
			'primaryKeyword' => trim( (string) ( $task['keyword'] ?? '' ) ),
		);

		$result = Neo_Pulse_App_Task_Execution_Registry::run( $kind, is_array( $task ) ? $task : array(), $execution, $context );
		if ( empty( $result['ok'] ) ) {
			$error = (string) ( $result['error'] ?? 'Execution failed during preflight.' );
			Neo_Pulse_App_Task_Execution_Store::update(
				$team_id,
				$execution_id,
				array(
					'status'  => 'failed',
					'payload' => array( 'error' => $error ),
				)
			);
			Neo_Pulse_App_Task_Execution_Progress::fail( $team_id, $execution_id, $error );
			Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, 'failed' );
			return array(
				'ok'        => false,
				'error'     => $error,
				'execution' => self::format_with_progress( $team_id, $execution_id ),
			);
		}

		$status = sanitize_key( (string) ( $result['status'] ?? 'awaiting_client' ) );
		$patch  = isset( $result['payload'] ) && is_array( $result['payload'] ) ? $result['payload'] : array();
		Neo_Pulse_App_Task_Execution_Store::update(
			$team_id,
			$execution_id,
			array(
				'status'  => $status,
				'payload' => $patch,
			)
		);

		if ( $status === 'completed' ) {
			Neo_Pulse_App_Task_Execution_Progress::complete( $team_id, $execution_id, $patch['result'] ?? null );
		} elseif ( $status === 'awaiting_client' ) {
			$message = $kind === 'gsc_reporting'
				? 'Ready for client GSC reporting harness.'
				: ( $kind === 'post_creator'
					? 'Ready for client post creator harness.'
					: ( $kind === 'local_dominator_export'
						? 'Ready for client Local Dominator export harness.'
						: 'Ready for client content optimizer harness.' ) );
			Neo_Pulse_App_Task_Execution_Progress::update(
				$team_id,
				$execution_id,
				array(
					'status'  => 'awaiting_client',
					'message' => $message,
				)
			);
		} else {
			Neo_Pulse_App_Task_Execution_Progress::update(
				$team_id,
				$execution_id,
				array(
					'status'  => $status,
					'message' => (string) ( $result['message'] ?? '' ),
				)
			);
		}

		Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, $status );

		return array(
			'ok'        => true,
			'execution' => self::format_with_progress( $team_id, $execution_id ),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function get( int $team_id, int $execution_id ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$execution = self::format_with_progress( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}
		return array( 'ok' => true, 'execution' => $execution );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function list_for_task( int $team_id, int $task_id ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$rows = Neo_Pulse_App_Task_Execution_Store::list_for_task( $team_id, $task_id );
		$out  = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$id = (int) ( $row['id'] ?? 0 );
			if ( $id <= 0 ) {
				continue;
			}
			$formatted = self::format_with_progress( $team_id, $id );
			if ( $formatted ) {
				$out[] = $formatted;
			}
		}
		return array( 'ok' => true, 'executions' => $out );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function patch_progress( int $team_id, int $execution_id, array $body ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}
		$status = (string) ( $execution['status'] ?? '' );
		if ( ! in_array( $status, array( 'awaiting_client', 'running' ), true ) ) {
			return array( 'ok' => false, 'error' => 'Execution is not accepting progress updates.' );
		}

		if ( $status === 'awaiting_client' ) {
			Neo_Pulse_App_Task_Execution_Store::update( $team_id, $execution_id, array( 'status' => 'running' ) );
			Neo_Pulse_App_Tasks_Store::patch_task_execution_meta(
				$team_id,
				(int) $execution['taskId'],
				$execution_id,
				'running'
			);
		}

		Neo_Pulse_App_Task_Execution_Progress::patch_step(
			$team_id,
			$execution_id,
			array(
				'status'      => 'running',
				'stepId'      => (string) ( $body['stepId'] ?? '' ),
				'subProgress' => isset( $body['subProgress'] ) ? (float) $body['subProgress'] : 0,
				'progress'    => isset( $body['progress'] ) ? (int) $body['progress'] : null,
				'message'     => (string) ( $body['message'] ?? '' ),
				'error'       => isset( $body['error'] ) ? (string) $body['error'] : null,
			)
		);

		return array(
			'ok'        => true,
			'execution' => self::format_with_progress( $team_id, $execution_id ),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function complete( int $team_id, int $execution_id, array $body ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}
		$task_id = (int) ( $execution['taskId'] ?? 0 );
		$ok      = ! empty( $body['ok'] );

		if ( $ok ) {
			$result = $body['result'] ?? null;
			Neo_Pulse_App_Task_Execution_Store::update(
				$team_id,
				$execution_id,
				array(
					'status'  => 'completed',
					'payload' => array( 'result' => $result ),
				)
			);
			Neo_Pulse_App_Task_Execution_Progress::complete( $team_id, $execution_id, $result );
			Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, 'completed' );

			$task = Neo_Pulse_App_Tasks_Store::get_task( $team_id, $task_id );
			if ( self::should_archive_execution_outputs( $task, $body ) ) {
				$user_id = (int) ( $execution['startedBy'] ?? 0 );
				if ( $user_id <= 0 ) {
					$user_id = Neo_Pulse_App_Tasks_Store::pulse_bot_user_id();
				}
				Neo_Pulse_App_Tasks_Assets::archive_execution_outputs( $team_id, $task_id, $user_id, $body );
			}
		} else {
			$error = sanitize_text_field( (string) ( $body['error'] ?? 'Execution failed.' ) );
			Neo_Pulse_App_Task_Execution_Store::update(
				$team_id,
				$execution_id,
				array(
					'status'  => 'failed',
					'payload' => array( 'error' => $error ),
				)
			);
			Neo_Pulse_App_Task_Execution_Progress::fail( $team_id, $execution_id, $error );
			Neo_Pulse_App_Tasks_Store::patch_task_execution_meta( $team_id, $task_id, $execution_id, 'failed' );
		}

		return array(
			'ok'        => true,
			'execution' => self::format_with_progress( $team_id, $execution_id ),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function cancel( int $team_id, int $execution_id ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}
		$status = (string) ( $execution['status'] ?? '' );
		if ( in_array( $status, array( 'completed', 'failed', 'cancelled' ), true ) ) {
			return array( 'ok' => false, 'error' => 'Execution already finished.' );
		}

		Neo_Pulse_App_Task_Execution_Store::update( $team_id, $execution_id, array( 'status' => 'cancelled' ) );
		Neo_Pulse_App_Task_Execution_Progress::update(
			$team_id,
			$execution_id,
			array(
				'status'  => 'cancelled',
				'message' => 'Cancelled',
			)
		);
		Neo_Pulse_App_Tasks_Store::patch_task_execution_meta(
			$team_id,
			(int) $execution['taskId'],
			$execution_id,
			'cancelled'
		);

		return array(
			'ok'        => true,
			'execution' => self::format_with_progress( $team_id, $execution_id ),
		);
	}

	/**
	 * @param array<string,mixed>|null $task
	 * @param array<string,mixed>      $body
	 */
	private static function should_archive_execution_outputs( ?array $task, array $body ): bool {
		if ( ! is_array( $task ) ) {
			return false;
		}
		if ( ! empty( $body['archiveFiles'] ) && is_array( $body['archiveFiles'] ) ) {
			return true;
		}
		$payload = is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array();
		$kind    = (string) ( $task['executionKind'] ?? '' );
		if ( $kind === 'gsc_reporting' ) {
			return ! array_key_exists( 'saveLocalArchive', $payload ) || ! empty( $payload['saveLocalArchive'] );
		}
		if (
			( $kind === 'content_optimizer' || $kind === 'content_optimizer_meta' )
			&& (string) ( $payload['updateMode'] ?? '' ) === 'draft'
		) {
			return ! array_key_exists( 'saveLocalArchive', $payload ) || ! empty( $payload['saveLocalArchive'] );
		}
		return ! empty( $payload['saveLocalArchive'] );
	}

	/**
	 * Reopen a failed execution so the client harness can resume after an agent run retry.
	 *
	 * @return array<string,mixed>
	 */
	public static function reopen_for_resume( int $team_id, int $execution_id ): array {
		Neo_Pulse_App_Task_Execution_Store::install_tables();
		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return array( 'ok' => false, 'error' => 'Execution not found.' );
		}
		$status = (string) ( $execution['status'] ?? '' );
		if ( $status !== 'failed' ) {
			return array( 'ok' => false, 'error' => 'Execution is not failed.' );
		}

		Neo_Pulse_App_Task_Execution_Store::update( $team_id, $execution_id, array( 'status' => 'running' ) );
		Neo_Pulse_App_Task_Execution_Progress::patch_step(
			$team_id,
			$execution_id,
			array(
				'status'  => 'running',
				'message' => 'Resuming…',
				'error'   => null,
			)
		);
		Neo_Pulse_App_Tasks_Store::patch_task_execution_meta(
			$team_id,
			(int) ( $execution['taskId'] ?? 0 ),
			$execution_id,
			'running'
		);

		return array(
			'ok'        => true,
			'execution' => self::format_with_progress( $team_id, $execution_id ),
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function format_with_progress( int $team_id, int $execution_id ): ?array {
		$execution = Neo_Pulse_App_Task_Execution_Store::get( $team_id, $execution_id );
		if ( ! $execution ) {
			return null;
		}
		$progress = Neo_Pulse_App_Task_Execution_Progress::get( $team_id, $execution_id );
		$execution['progress'] = is_array( $progress ) ? $progress : null;
		return $execution;
	}
}

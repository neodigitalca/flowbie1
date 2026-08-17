<?php
/**
 * /api/teams/{id}/workflows/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflows_Route_Handlers {

	/**
	 * @param array<string,mixed> $team
	 * @param array<string,mixed> $member
	 * @param string              $sub
	 * @param string              $method
	 * @param array<string,mixed> $body
	 * @param int                 $user_id
	 */
	public static function dispatch( array $team, array $member, string $sub, string $method, array $body, int $user_id ): void {
		Neo_Pulse_App_Workflows_Store::install_tables();
		$team_id = (int) $team['id'];
		$sub     = trim( $sub, '/' );
		$method  = strtoupper( $method );

		if ( ! Neo_Pulse_App_Tasks_Store::is_active_member( $member ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		if ( $sub === '' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'workflows' => Neo_Pulse_App_Workflows_Store::list_workflows( $team_id ),
				)
			);
			return;
		}

		if ( $sub === '' && $method === 'POST' ) {
			$workflow = Neo_Pulse_App_Workflows_Store::create_workflow( $team_id, $body );
			if ( ! $workflow ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create workflow' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'workflow' => $workflow ) );
			return;
		}

		if ( $sub === 'library' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'entries' => Neo_Pulse_App_Workflows_Store::list_library_entries( $team_id ),
				)
			);
			return;
		}

		if ( preg_match( '#^library/([^/]+)$#', $sub, $m ) && $method === 'POST' ) {
			$key      = sanitize_key( rawurldecode( (string) ( $m[1] ?? '' ) ) );
			$run_id   = (int) ( $body['runId'] ?? 0 );
			$output_id = (int) ( $body['outputId'] ?? 0 );
			$outputs  = Neo_Pulse_App_Workflows_Store::list_step_outputs( $team_id, $run_id );
			$match    = null;
			foreach ( $outputs as $output ) {
				if ( is_array( $output ) && (int) ( $output['id'] ?? 0 ) === $output_id ) {
					$match = $output;
					break;
				}
			}
			if ( ! $match ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Output not found' ), 404 );
				return;
			}
			$entry = Neo_Pulse_App_Workflows_Store::upsert_library_entry(
				$team_id,
				$key,
				array(
					'label'             => (string) ( $body['label'] ?? $match['label'] ?? $key ),
					'textPreview'       => (string) ( $match['textPreview'] ?? '' ),
					'fileRefs'          => isset( $match['fileRefs'] ) && is_array( $match['fileRefs'] ) ? $match['fileRefs'] : array(),
					'promotedFromRunId' => $run_id,
				)
			);
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'entry' => $entry ) );
			return;
		}

		if ( $sub === 'trigger-pending' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'pending' => Neo_Pulse_App_Workflow_Trigger_Pending_Store::list( $team_id ),
				)
			);
			return;
		}

		if ( preg_match( '#^trigger-pending/(\d+)/ack$#', $sub, $m ) && $method === 'POST' ) {
			$workflow_id = (int) ( $m[1] ?? 0 );
			Neo_Pulse_App_Workflow_Trigger_Pending_Store::dequeue( $team_id, $workflow_id );
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^(\d+)$#', $sub, $m ) && $method === 'GET' ) {
			$workflow = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, (int) $m[1] );
			if ( ! $workflow ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'workflow' => $workflow ) );
			return;
		}

		if ( preg_match( '#^(\d+)$#', $sub, $m ) && $method === 'PATCH' ) {
			if ( ! empty( $body['clearRuns'] ) ) {
				$deleted = Neo_Pulse_App_Workflows_Store::clear_runs( $team_id, (int) $m[1] );
				Neo_Pulse_App_Api_Dispatcher::send_json(
					array(
						'ok'      => true,
						'deleted' => $deleted,
					)
				);
				return;
			}
			$workflow = Neo_Pulse_App_Workflows_Store::patch_workflow( $team_id, (int) $m[1], $body );
			if ( ! $workflow ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'workflow' => $workflow ) );
			return;
		}

		if ( preg_match( '#^(\d+)$#', $sub, $m ) && $method === 'DELETE' ) {
			$deleted = Neo_Pulse_App_Workflows_Store::delete_workflow( $team_id, (int) $m[1] );
			if ( ! $deleted ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^(\d+)/publish$#', $sub, $m ) && $method === 'POST' ) {
			$workflow = Neo_Pulse_App_Workflows_Store::publish_workflow( $team_id, (int) $m[1] );
			if ( ! $workflow ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'workflow' => $workflow ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs/clear$#', $sub, $m ) && $method === 'POST' ) {
			$deleted = Neo_Pulse_App_Workflows_Store::clear_runs( $team_id, (int) $m[1] );
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'deleted' => $deleted,
				)
			);
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)/delete$#', $sub, $m ) && $method === 'POST' ) {
			$deleted = Neo_Pulse_App_Workflows_Store::delete_run( $team_id, (int) $m[1], (int) $m[2] );
			if ( ! $deleted ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs$#', $sub, $m ) && $method === 'DELETE' ) {
			$deleted = Neo_Pulse_App_Workflows_Store::clear_runs( $team_id, (int) $m[1] );
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'deleted' => $deleted,
				)
			);
			return;
		}

		if ( preg_match( '#^(\d+)/runs$#', $sub, $m ) && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'   => true,
					'runs' => Neo_Pulse_App_Workflows_Store::list_runs( $team_id, (int) $m[1] ),
				)
			);
			return;
		}

		if ( preg_match( '#^(\d+)/runs$#', $sub, $m ) && $method === 'POST' ) {
			$workflow_id = (int) $m[1];
			$workflow    = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, $workflow_id );
			if ( ! $workflow ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$simulated = ! empty( $body['simulated'] );
			$payload   = isset( $body['triggerPayload'] ) && is_array( $body['triggerPayload'] ) ? $body['triggerPayload'] : array();
			$enqueued  = Neo_Pulse_App_Workflow_Trigger_Evaluator::enqueue(
				$team_id,
				$workflow_id,
				'trigger_manual',
				$payload,
				$simulated
			);
			if ( ! $enqueued ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not start run' ), 500 );
				return;
			}
			$pending = Neo_Pulse_App_Workflow_Trigger_Pending_Store::list( $team_id );
			$run     = null;
			foreach ( $pending as $item ) {
				if ( is_array( $item ) && (int) ( $item['workflowId'] ?? 0 ) === $workflow_id ) {
					$run_id = (int) ( $item['runId'] ?? 0 );
					if ( $run_id > 0 ) {
						$run = Neo_Pulse_App_Workflows_Store::get_run( $team_id, $run_id );
					}
					break;
				}
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'run' => $run ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)$#', $sub, $m ) && $method === 'GET' ) {
			$run = Neo_Pulse_App_Workflows_Store::get_run( $team_id, (int) $m[2] );
			if ( ! $run || (int) ( $run['workflowId'] ?? 0 ) !== (int) $m[1] ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'run' => $run ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)/outputs$#', $sub, $m ) && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'outputs' => Neo_Pulse_App_Workflows_Store::list_step_outputs( $team_id, (int) $m[2] ),
				)
			);
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)/outputs$#', $sub, $m ) && $method === 'POST' ) {
			$output = Neo_Pulse_App_Workflows_Store::add_step_output( $team_id, (int) $m[2], $body );
			if ( ! $output ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not save output' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'output' => $output ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)$#', $sub, $m ) && $method === 'DELETE' ) {
			$deleted = Neo_Pulse_App_Workflows_Store::delete_run( $team_id, (int) $m[1], (int) $m[2] );
			if ( ! $deleted ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^(\d+)/runs/(\d+)$#', $sub, $m ) && $method === 'PATCH' ) {
			if ( ! empty( $body['delete'] ) ) {
				$deleted = Neo_Pulse_App_Workflows_Store::delete_run( $team_id, (int) $m[1], (int) $m[2] );
				if ( ! $deleted ) {
					Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
				return;
			}
			$run = Neo_Pulse_App_Workflows_Store::patch_run( $team_id, (int) $m[2], $body );
			if ( ! $run ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true, 'run' => $run ) );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}
}

<?php
/**
 * Workflow trigger evaluation (calendar, GSC, document backlog).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Trigger_Evaluator {

	public static function evaluate_team( int $team_id ): int {
		$count = 0;
		foreach ( Neo_Pulse_App_Workflows_Store::list_published_workflows( $team_id ) as $workflow ) {
			if ( ! is_array( $workflow ) ) {
				continue;
			}
			if ( self::evaluate_workflow( $team_id, $workflow ) ) {
				++$count;
			}
		}
		return $count;
	}

	/**
	 * @param array<string,mixed> $workflow
	 */
	public static function evaluate_workflow( int $team_id, array $workflow ): bool {
		$workflow_id = (int) ( $workflow['id'] ?? 0 );
		$client      = self::client_node( $workflow );
		if ( $client && self::calendar_due( $client ) ) {
			$period_key = self::calendar_period_key( $client );
			if ( $period_key !== '' && ! self::already_ran_period( $team_id, $workflow_id, $period_key ) ) {
				return self::enqueue(
					$team_id,
					$workflow_id,
					'workflow_client',
					array(
						'nodeId'    => (string) ( $client['id'] ?? '' ),
						'periodKey' => $period_key,
					)
				);
			}
		}

		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$kind = sanitize_key( (string) ( $node['kind'] ?? '' ) );
			if ( $kind === 'trigger_gsc' && self::gsc_fired( $team_id, $workflow, $node ) ) {
				return self::enqueue( $team_id, $workflow_id, $kind, array( 'nodeId' => (string) ( $node['id'] ?? '' ) ) );
			}
		}
		return false;
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @return array<string,mixed>|null
	 */
	private static function client_node( array $workflow ): ?array {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $node['kind'] ?? '' ) ) === 'workflow_client' ) {
				return $node;
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function calendar_due( array $node ): bool {
		$config     = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$start_date = substr( trim( (string) ( $config['startDate'] ?? '' ) ), 0, 10 );
		$time       = substr( trim( (string) ( $config['time'] ?? '09:00' ) ), 0, 5 );
		if ( strlen( $start_date ) < 10 || $time === '' ) {
			return false;
		}

		try {
			$tz = new DateTimeZone( (string) ( $config['timezone'] ?? 'America/Edmonton' ) );
		} catch ( Exception $e ) {
			$tz = new DateTimeZone( 'America/Edmonton' );
		}
		$now = new DateTimeImmutable( 'now', $tz );
		try {
			$due = new DateTimeImmutable( $start_date . ' ' . $time, $tz );
		} catch ( Exception $e ) {
			return false;
		}
		if ( $now < $due && sanitize_key( (string) ( $config['frequency'] ?? 'monthly' ) ) === 'once' ) {
			return false;
		}
		if ( $now->format( 'Y-m-d' ) < $start_date ) {
			return false;
		}

		$now_min = ( (int) $now->format( 'G' ) * 60 ) + (int) $now->format( 'i' );
		$due_min = ( (int) $due->format( 'G' ) * 60 ) + (int) $due->format( 'i' );
		if ( $now_min < $due_min ) {
			return false;
		}

		$frequency = sanitize_key( (string) ( $config['frequency'] ?? 'monthly' ) );
		if ( $frequency === 'once' ) {
			return $now->format( 'Y-m-d' ) === $start_date;
		}
		if ( $frequency === 'daily' ) {
			return true;
		}
		if ( $frequency === 'weekly' ) {
			return $now->format( 'w' ) === $due->format( 'w' );
		}
		if ( $frequency === 'yearly' ) {
			return $now->format( 'm-d' ) === $due->format( 'm-d' );
		}
		$day_of_month = isset( $config['dayOfMonth'] ) ? (int) $config['dayOfMonth'] : 0;
		if ( $day_of_month < 1 || $day_of_month > 31 ) {
			$day_of_month = (int) $due->format( 'j' );
		}
		return (int) $now->format( 'j' ) === $day_of_month;
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function calendar_period_key( array $node ): string {
		$config     = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$start_date = substr( trim( (string) ( $config['startDate'] ?? '' ) ), 0, 10 );
		$time       = substr( trim( (string) ( $config['time'] ?? '09:00' ) ), 0, 5 );
		try {
			$tz = new DateTimeZone( (string) ( $config['timezone'] ?? 'America/Edmonton' ) );
		} catch ( Exception $e ) {
			$tz = new DateTimeZone( 'America/Edmonton' );
		}
		$now        = new DateTimeImmutable( 'now', $tz );
		$frequency  = sanitize_key( (string) ( $config['frequency'] ?? 'monthly' ) );
		if ( $frequency === 'daily' ) {
			return $now->format( 'Y-m-d' ) . ':' . $time;
		}
		if ( $frequency === 'weekly' ) {
			return $now->format( 'o-\WW' ) . ':' . $time;
		}
		if ( $frequency === 'yearly' ) {
			return $now->format( 'Y' ) . ':' . substr( $start_date, 5, 5 ) . ':' . $time;
		}
		if ( $frequency === 'once' ) {
			return $start_date . ':' . $time;
		}
		return $now->format( 'Y-m' ) . ':' . $time;
	}

	private static function already_ran_period( int $team_id, int $workflow_id, string $period_key ): bool {
		if ( $workflow_id <= 0 || $period_key === '' ) {
			return false;
		}
		foreach ( Neo_Pulse_App_Workflows_Store::list_runs( $team_id, $workflow_id ) as $run ) {
			if ( ! is_array( $run ) ) {
				continue;
			}
			if ( ! empty( $run['triggerPayload']['simulated'] ) ) {
				continue;
			}
			$payload = isset( $run['triggerPayload'] ) && is_array( $run['triggerPayload'] ) ? $run['triggerPayload'] : array();
			if ( (string) ( $payload['periodKey'] ?? '' ) === $period_key ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @param array<string,mixed> $node
	 */
	private static function gsc_fired( int $team_id, array $workflow, array $node ): bool {
		if ( ! class_exists( 'Neo_Pulse_App_Task_Trigger_Evaluator' ) ) {
			return false;
		}
		$config         = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$trigger_config = isset( $config['triggerConfig'] ) && is_array( $config['triggerConfig'] ) ? $config['triggerConfig'] : array();
		$site_id        = (string) ( $workflow['wordpressSiteId'] ?? '' );
		if ( $site_id === '' ) {
			return false;
		}
		$bucket = Neo_Pulse_App_Tasks_Store::sanitize_execution_target_bucket( $config['targetBucket'] ?? 'pages' );
		$result = Neo_Pulse_App_Task_Trigger_Evaluator::evaluate_task(
			$team_id,
			array(
				'id'                => 0,
				'wordpressSiteId'   => $site_id,
				'executionPayload'  => array( 'targetBucket' => $bucket ),
				'triggerConfig'     => $trigger_config,
			)
		);
		return ! empty( $result['ok'] ) && (int) ( $result['matchedCount'] ?? 0 ) > 0;
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function enqueue( int $team_id, int $workflow_id, string $trigger_kind, array $payload, bool $simulated = false ): bool {
		if ( $workflow_id <= 0 ) {
			return false;
		}
		$kind = sanitize_key( $trigger_kind );
		if ( ! $simulated && $kind === 'workflow_client' ) {
			Neo_Pulse_App_Workflows_Store::cancel_leftover_runs( $team_id, $workflow_id );
		} elseif ( ! $simulated && Neo_Pulse_App_Workflows_Store::has_active_run( $team_id, $workflow_id ) ) {
			return false;
		}
		$run = Neo_Pulse_App_Workflows_Store::create_run(
			$team_id,
			$workflow_id,
			array(
				'triggerKind'    => $trigger_kind,
				'triggerPayload' => $payload,
				'simulated'      => $simulated,
			)
		);
		if ( ! $run ) {
			return false;
		}
		return Neo_Pulse_App_Workflow_Trigger_Pending_Store::enqueue(
			$team_id,
			array(
				'workflowId'  => $workflow_id,
				'runId'       => (int) ( $run['id'] ?? 0 ),
				'triggerKind' => $trigger_kind,
				'payload'     => $payload,
				'simulated'   => $simulated,
			)
		);
	}

	/**
	 * @param array<string,mixed> $document
	 */
	public static function on_document_received( int $team_id, array $document ): int {
		$count = 0;
		foreach ( Neo_Pulse_App_Workflows_Store::list_published_workflows( $team_id ) as $workflow ) {
			if ( ! is_array( $workflow ) ) {
				continue;
			}
			$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
			foreach ( $nodes as $node ) {
				if ( ! is_array( $node ) || sanitize_key( (string) ( $node['kind'] ?? '' ) ) !== 'trigger_document' ) {
					continue;
				}
				if ( ! self::document_matches( $node, $document ) ) {
					continue;
				}
				if ( self::enqueue( $team_id, (int) ( $workflow['id'] ?? 0 ), 'trigger_document', array_merge( $document, array( 'nodeId' => (string) ( $node['id'] ?? '' ) ) ) ) ) {
					++$count;
				}
			}
		}
		return $count;
	}

	/**
	 * @param array<string,mixed> $node
	 * @param array<string,mixed> $document
	 */
	private static function document_matches( array $node, array $document ): bool {
		$config = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$source = sanitize_key( (string) ( $config['source'] ?? '' ) );
		if ( $source !== '' && $source !== sanitize_key( (string) ( $document['source'] ?? '' ) ) ) {
			return false;
		}
		$name_contains = (string) ( $config['nameContains'] ?? '' );
		if ( $name_contains !== '' ) {
			$name = strtolower( (string) ( $document['name'] ?? '' ) );
			if ( strpos( $name, strtolower( $name_contains ) ) === false ) {
				return false;
			}
		}
		$mime_pattern = (string) ( $config['mimePattern'] ?? '' );
		if ( $mime_pattern !== '' ) {
			$mime = (string) ( $document['mime'] ?? '' );
			if ( $mime_pattern !== '*' && strpos( $mime, str_replace( '*', '', $mime_pattern ) ) === false ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param array<string,mixed> $message
	 * @param array<int,array<string,mixed>> $attachments
	 */
	public static function on_agentmail_received( string $sender, string $inbox, array $message, array $attachments = array() ): int {
		$sender = Neo_Pulse_App_Agentmail_Api::normalize_sender( $sender );
		if ( $sender === '' ) {
			return 0;
		}
		$message_id = trim( (string) ( $message['message_id'] ?? $message['id'] ?? '' ) );
		if ( $message_id === '' ) {
			return 0;
		}
		$count    = 0;
		$team_ids = Neo_Pulse_App_Teams_Store::list_all_team_ids();
		foreach ( $team_ids as $team_id ) {
			$team_id = (int) $team_id;
			if ( $team_id <= 0 ) {
				continue;
			}
			foreach ( Neo_Pulse_App_Workflows_Store::list_published_workflows( $team_id ) as $workflow ) {
				if ( ! is_array( $workflow ) ) {
					continue;
				}
				$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
				foreach ( $nodes as $node ) {
					if ( ! is_array( $node ) || sanitize_key( (string) ( $node['kind'] ?? '' ) ) !== 'trigger_agentmail' ) {
						continue;
					}
					if ( ! self::agentmail_matches( $node, $sender, $inbox ) ) {
						continue;
					}
					$stored = Neo_Pulse_App_Agentmail_Inbound_Store::save_inbound( $team_id, $message, $attachments );
					if ( ! is_array( $stored ) ) {
						continue;
					}
					$payload = array(
						'source'          => 'agentmail',
						'messageId'       => $message_id,
						'from'            => $sender,
						'subject'         => (string) ( $stored['subject'] ?? '' ),
						'textPreview'     => (string) ( $stored['preview'] ?? $stored['text'] ?? '' ),
						'attachmentNames' => array_values(
							array_map(
								static function ( $item ) {
									return is_array( $item ) ? (string) ( $item['filename'] ?? '' ) : '';
								},
								isset( $stored['attachments'] ) && is_array( $stored['attachments'] ) ? $stored['attachments'] : array()
							)
						),
						'nodeId'          => (string) ( $node['id'] ?? '' ),
						'teamId'          => $team_id,
					);
					if ( self::enqueue( $team_id, (int) ( $workflow['id'] ?? 0 ), 'trigger_agentmail', $payload ) ) {
						++$count;
					}
				}
			}
		}
		return $count;
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function agentmail_matches( array $node, string $sender, string $inbox ): bool {
		$config     = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$from_email = Neo_Pulse_App_Agentmail_Api::normalize_sender( (string) ( $config['fromEmail'] ?? '' ) );
		if ( $from_email === '' || $from_email !== $sender ) {
			return false;
		}
		$config_inbox = sanitize_email( strtolower( trim( (string) ( $config['inbox'] ?? '' ) ) ) );
		if ( $config_inbox !== '' && $config_inbox !== sanitize_email( strtolower( trim( $inbox ) ) ) ) {
			return false;
		}
		return true;
	}
}


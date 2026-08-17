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
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$kind = sanitize_key( (string) ( $node['kind'] ?? '' ) );
			if ( $kind === 'trigger_calendar' && self::calendar_due( $node ) ) {
				return self::enqueue( $team_id, (int) ( $workflow['id'] ?? 0 ), $kind, array() );
			}
			if ( $kind === 'trigger_gsc' && self::gsc_fired( $team_id, $workflow, $node ) ) {
				return self::enqueue( $team_id, (int) ( $workflow['id'] ?? 0 ), $kind, array( 'nodeId' => (string) ( $node['id'] ?? '' ) ) );
			}
		}
		return false;
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function calendar_due( array $node ): bool {
		$config = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		if ( ! empty( $config['cronExpression'] ) && class_exists( 'Neo_Pulse_App_Workflow_Cron_Expression' ) ) {
			return Neo_Pulse_App_Workflow_Cron_Expression::is_due( (string) $config['cronExpression'], (string) ( $config['timezone'] ?? 'America/Edmonton' ) );
		}
		$frequency  = sanitize_key( (string) ( $config['frequency'] ?? 'once' ) );
		$start_date = (string) ( $config['startDate'] ?? '' );
		$time       = (string) ( $config['time'] ?? '09:00' );
		if ( $start_date === '' ) {
			return false;
		}
		$tz  = new DateTimeZone( (string) ( $config['timezone'] ?? 'America/Edmonton' ) );
		$now = new DateTimeImmutable( 'now', $tz );
		try {
			$due = new DateTimeImmutable( $start_date . ' ' . $time, $tz );
		} catch ( Exception $e ) {
			return false;
		}
		if ( $frequency === 'once' ) {
			$diff = abs( $now->getTimestamp() - $due->getTimestamp() );
			return $diff <= 3600 && $now >= $due;
		}
		$hour_match = (int) $now->format( 'G' ) === (int) $due->format( 'G' )
			&& (int) $now->format( 'i' ) === (int) $due->format( 'i' );
		if ( ! $hour_match ) {
			return false;
		}
		if ( $frequency === 'daily' ) {
			return true;
		}
		if ( $frequency === 'weekly' ) {
			return $now->format( 'w' ) === $due->format( 'w' );
		}
		if ( $frequency === 'monthly' ) {
			return (int) $now->format( 'j' ) === (int) $due->format( 'j' );
		}
		if ( $frequency === 'yearly' ) {
			return $now->format( 'm-d' ) === $due->format( 'm-d' );
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
}

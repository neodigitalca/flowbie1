<?php
/**
 * Post creator execution runner (server worker contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_Post_Creator {

	/**
	 * @param array<string,mixed> $task
	 * @param array<string,mixed> $execution
	 * @param array<string,mixed> $context
	 * @return array<string,mixed>
	 */
	public static function run( string $kind, array $task, array $execution, array $context ): array {
		unset( $kind, $task );

		$site_id = trim( (string) ( $context['siteId'] ?? '' ) );
		if ( $site_id === '' ) {
			return array( 'ok' => false, 'error' => 'wordpressSiteId is required.' );
		}

		$site = Neo_Pulse_App_Task_Execution_Site_Resolver::resolve_by_id( $site_id );
		if ( ! $site ) {
			return array( 'ok' => false, 'error' => 'Could not resolve WordPress site from sites.json.' );
		}

		$payload        = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized      = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$post_count     = (int) ( $sanitized['postCount'] ?? 0 );
		if ( $post_count < 1 ) {
			return array( 'ok' => false, 'error' => 'executionPayload.postCount must be at least 1.' );
		}

		$execution_id = (int) ( $execution['id'] ?? 0 );
		$contract     = array_merge(
			array(
				'executionId' => $execution_id,
				'siteId'      => $site_id,
			),
			$sanitized
		);

		if ( class_exists( 'Neo_Pulse_App_Agent_Run_Worker_Cron' ) ) {
			Neo_Pulse_App_Agent_Run_Worker_Cron::kick();
		}

		return array(
			'ok'      => true,
			'status'  => 'running',
			'message' => 'Queued for server post creator worker.',
			'payload' => array(
				'clientRunContract' => $contract,
				'executionMode'     => 'server',
			),
		);
	}
}

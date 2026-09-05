<?php
/**
 * ChatGPT website audit execution runner (preflight + client harness contract).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Runner_ChatGpt_Audit {

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

		$payload       = is_array( $context['payload'] ?? null ) ? $context['payload'] : array();
		$sanitized     = Neo_Pulse_App_Tasks_Store::sanitize_execution_payload( $payload );
		$save_to_disk  = ! array_key_exists( 'saveToDisk', $payload ) || ! empty( $payload['saveToDisk'] );
		$save_local    = ! empty( $sanitized['saveLocalArchive'] )
			|| ! array_key_exists( 'saveLocalArchive', $payload )
			|| ! empty( $payload['saveLocalArchive'] )
			|| ! empty( $sanitized['saveToGoogleDrive'] );
		$execution_id  = (int) ( $execution['id'] ?? 0 );

		$contract = array_merge(
			array(
				'executionId'      => $execution_id,
				'siteId'           => $site_id,
				'saveToDisk'       => $save_to_disk,
				'saveLocalArchive' => $save_local,
			),
			Neo_Pulse_App_Tasks_Store::automation_email_contract_fields( $payload )
		);
		$contract = array_merge( $contract, Neo_Pulse_App_Tasks_Store::google_drive_contract_fields( $payload ) );
		if ( isset( $payload['auditQuestions'] ) && is_array( $payload['auditQuestions'] ) ) {
			$questions = array();
			foreach ( $payload['auditQuestions'] as $question ) {
				$trimmed = trim( (string) $question );
				if ( $trimmed !== '' ) {
					$questions[] = $trimmed;
				}
			}
			if ( ! empty( $questions ) ) {
				$contract['auditQuestions'] = $questions;
			}
		}
		if ( isset( $payload['targetBucket'] ) ) {
			$bucket = trim( (string) $payload['targetBucket'] );
			if ( in_array( $bucket, array( 'pages', 'posts', 'sap', 'all' ), true ) ) {
				$contract['targetBucket'] = $bucket;
			}
		}
		if ( isset( $payload['targetUrls'] ) && is_array( $payload['targetUrls'] ) ) {
			$urls = array();
			foreach ( $payload['targetUrls'] as $url ) {
				$trimmed = trim( (string) $url );
				if ( $trimmed !== '' ) {
					$urls[] = $trimmed;
				}
			}
			if ( ! empty( $urls ) ) {
				$contract['targetUrls'] = $urls;
			}
		}

		return array(
			'ok'      => true,
			'status'  => 'awaiting_client',
			'payload' => array(
				'clientRunContract' => $contract,
			),
		);
	}
}

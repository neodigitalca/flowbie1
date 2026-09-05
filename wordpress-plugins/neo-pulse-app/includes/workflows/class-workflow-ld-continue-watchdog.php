<?php
/**
 * Verify Local Dominator grid CSV is in workflow step outputs before continuing.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Ld_Continue_Watchdog {

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function csv_file_refs_from_output( array $output ): array {
		$refs = isset( $output['fileRefs'] ) && is_array( $output['fileRefs'] ) ? $output['fileRefs'] : array();
		$csv  = array();
		foreach ( $refs as $ref ) {
			if ( ! is_array( $ref ) ) {
				continue;
			}
			$url = trim( (string) ( $ref['url'] ?? '' ) );
			if ( $url === '' || ! wp_http_validate_url( $url ) ) {
				continue;
			}
			$name = strtolower( trim( (string) ( $ref['name'] ?? '' ) ) );
			$mime = strtolower( trim( (string) ( $ref['mime'] ?? '' ) ) );
			if ( $mime === 'text/csv' || str_ends_with( $name, '.csv' ) ) {
				$csv[] = $ref;
			}
		}
		return $csv;
	}

	public static function grid_csv_delivered(
		int $team_id,
		int $workflow_run_id,
		int $agent_run_id,
		string $node_id
	): bool {
		if ( $team_id <= 0 || $workflow_run_id <= 0 || $agent_run_id <= 0 || $node_id === '' ) {
			return false;
		}

		$outputs = Neo_Pulse_App_Workflows_Store::list_step_outputs( $team_id, $workflow_run_id );
		foreach ( $outputs as $output ) {
			if ( ! is_array( $output ) ) {
				continue;
			}
			if ( sanitize_text_field( (string) ( $output['nodeId'] ?? '' ) ) !== $node_id ) {
				continue;
			}
			if ( (int) ( $output['agentRunId'] ?? 0 ) !== $agent_run_id ) {
				continue;
			}
			if ( ! empty( self::csv_file_refs_from_output( $output ) ) ) {
				return true;
			}
		}

		$artifacts = Neo_Pulse_App_Agent_Runs_Artifacts::list_artifacts( $agent_run_id );
		foreach ( $artifacts as $artifact ) {
			if ( ! is_array( $artifact ) ) {
				continue;
			}
			$url = trim( (string) ( $artifact['url'] ?? '' ) );
			if ( $url === '' || ! wp_http_validate_url( $url ) ) {
				continue;
			}
			$step_key = sanitize_key( (string) ( $artifact['stepKey'] ?? '' ) );
			$name     = strtolower( trim( (string) ( $artifact['name'] ?? '' ) ) );
			$mime     = strtolower( trim( (string) ( $artifact['mime'] ?? '' ) ) );
			if ( $step_key === 'grid_export' || $mime === 'text/csv' || str_ends_with( $name, '.csv' ) ) {
				return true;
			}
		}

		return false;
	}
}

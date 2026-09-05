<?php
/**
 * Persist Local Dominator grid CSV into workflow RAG step outputs (server path).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Ld_Grid_Deliverable {

	/**
	 * @param array<string,mixed> $agent_run
	 */
	public static function save_from_agent_run(
		int $team_id,
		array $agent_run,
		string $file_name,
		string $csv_content,
		string $artifact_url
	): bool {
		$plan = is_array( $agent_run['plan'] ?? null ) ? $agent_run['plan'] : array();
		$workflow_id     = (int) ( $plan['workflowId'] ?? 0 );
		$workflow_run_id = (int) ( $plan['workflowRunId'] ?? 0 );
		if ( $workflow_id <= 0 || $workflow_run_id <= 0 ) {
			return false;
		}

		$workflow = Neo_Pulse_App_Workflows_Store::get_workflow( $team_id, $workflow_id );
		if ( ! $workflow ) {
			return false;
		}

		$node_id = sanitize_text_field( (string) ( $plan['workflowNodeId'] ?? '' ) );
		$config  = self::find_action_config( $workflow, $node_id );
		$variable_key = sanitize_key(
			(string) ( $plan['ragVariableKey'] ?? $config['ragVariableKey'] ?? 'local_dominator_export_1' )
		);
		if ( $variable_key === '' ) {
			$variable_key = 'local_dominator_export_1';
		}

		$context = is_array( $agent_run['context'] ?? null ) ? $agent_run['context'] : array();
		$site_id = sanitize_text_field( (string) ( $context['siteId'] ?? '' ) );
		$run_id  = (int) ( $agent_run['id'] ?? 0 );

		$file_refs = array(
			array(
				'name' => sanitize_file_name( $file_name ),
				'url'  => esc_url_raw( $artifact_url ),
				'mime' => 'text/csv',
			),
		);

		$label = sanitize_text_field( (string) ( $config['title'] ?? 'Export Local Dominator grid CSV' ) );
		$step  = Neo_Pulse_App_Workflows_Store::add_step_output(
			$team_id,
			$workflow_run_id,
			array(
				'nodeId'       => $node_id,
				'variableKey'  => $variable_key,
				'scope'        => 'run',
				'label'        => $label !== '' ? $label : 'Grid export CSV',
				'textPreview'  => 'Grid export CSV',
				'fileRefs'     => $file_refs,
				'agentRunId'   => $run_id,
				'siteId'       => $site_id,
			)
		);
		if ( ! $step ) {
			return false;
		}

		self::sync_rag_archive( $team_id, $workflow, $workflow_run_id, $file_refs, $run_id, $site_id );
		return true;
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @param array<int,array<string,mixed>> $file_refs
	 */
	private static function sync_rag_archive(
		int $team_id,
		array $workflow,
		int $workflow_run_id,
		array $file_refs,
		int $agent_run_id,
		string $site_id
	): void {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		$archive_node = null;
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_key( (string) ( $node['kind'] ?? '' ) ) === 'rag_archive' ) {
				$archive_node = $node;
				break;
			}
		}
		if ( ! $archive_node ) {
			return;
		}

		$archive_id = sanitize_text_field( (string) ( $archive_node['id'] ?? '' ) );
		$config     = is_array( $archive_node['config'] ?? null ) ? $archive_node['config'] : array();
		$base_key   = sanitize_key( (string) ( $config['variableKey'] ?? 'workflow_output' ) );
		if ( $base_key === '' ) {
			$base_key = 'workflow_output';
		}

		$existing_outputs = Neo_Pulse_App_Workflows_Store::list_step_outputs( $team_id, $workflow_run_id );
		$merged_refs      = $file_refs;
		foreach ( $existing_outputs as $output ) {
			if ( ! is_array( $output ) ) {
				continue;
			}
			if ( sanitize_text_field( (string) ( $output['nodeId'] ?? '' ) ) !== $archive_id ) {
				continue;
			}
			$refs = isset( $output['fileRefs'] ) && is_array( $output['fileRefs'] ) ? $output['fileRefs'] : array();
			foreach ( $refs as $ref ) {
				if ( ! is_array( $ref ) ) {
					continue;
				}
				$url = trim( (string) ( $ref['url'] ?? '' ) );
				if ( $url === '' || ! wp_http_validate_url( $url ) ) {
					continue;
				}
				$merged_refs[] = $ref;
			}
		}
		$merged_refs = self::dedupe_file_refs( $merged_refs );

		Neo_Pulse_App_Workflows_Store::add_step_output(
			$team_id,
			$workflow_run_id,
			array(
				'nodeId'      => $archive_id,
				'variableKey' => $base_key,
				'scope'       => sanitize_key( (string) ( $config['scope'] ?? 'run' ) ) ?: 'run',
				'label'       => sanitize_text_field( (string) ( $config['label'] ?? $archive_node['label'] ?? 'Archive' ) ),
				'textPreview' => count( $merged_refs ) . ' deliverable' . ( count( $merged_refs ) === 1 ? '' : 's' ),
				'fileRefs'    => $merged_refs,
				'agentRunId'  => $agent_run_id,
				'siteId'      => $site_id,
			)
		);
	}

	/**
	 * @param array<string,mixed> $workflow
	 * @return array<string,mixed>
	 */
	private static function find_action_config( array $workflow, string $node_id ): array {
		$nodes = isset( $workflow['nodes'] ) && is_array( $workflow['nodes'] ) ? $workflow['nodes'] : array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( sanitize_text_field( (string) ( $node['id'] ?? '' ) ) !== $node_id ) {
				continue;
			}
			$config = is_array( $node['config'] ?? null ) ? $node['config'] : array();
			return $config;
		}
		return array();
	}

	/**
	 * @param array<int,array<string,mixed>> $file_refs
	 * @return array<int,array<string,mixed>>
	 */
	private static function dedupe_file_refs( array $file_refs ): array {
		$seen = array();
		$out  = array();
		foreach ( $file_refs as $ref ) {
			if ( ! is_array( $ref ) ) {
				continue;
			}
			$url = trim( (string) ( $ref['url'] ?? '' ) );
			if ( $url === '' ) {
				continue;
			}
			if ( isset( $seen[ $url ] ) ) {
				continue;
			}
			$seen[ $url ] = true;
			$out[]        = $ref;
		}
		return $out;
	}
}

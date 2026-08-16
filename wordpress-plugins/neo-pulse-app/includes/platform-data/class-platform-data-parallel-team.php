<?php
/**
 * Parallel slice specialist team runner.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Parallel_Team {

	const SLICE_MODEL = 'google/gemini-2.5-flash-lite';

	/**
	 * @param array<int,array<string,mixed>> $slice_team
	 * @param array<string,mixed>            $payload entities + analytics + context
	 * @param array<string,mixed>            $body
	 * @param callable|null                  $emit Progress callback for stream events.
	 * @return array{sliceReports:array<int,array<string,mixed>>,artifacts:array<int,array<string,mixed>>}
	 */
	public static function run( array $slice_team, array $payload, array $body, ?callable $emit = null ): array {
		$specs = array();
		$jobs  = array();

		foreach ( $slice_team as $spec ) {
			if ( ! is_array( $spec ) || empty( $spec['slice'] ) ) {
				continue;
			}
			$slice       = sanitize_key( (string) $spec['slice'] );
			$system      = (string) ( $spec['systemPrompt'] ?? '' );
			$focus       = (string) ( $spec['focus'] ?? '' );
			$slice_input = self::build_slice_input( $payload, $slice, $spec );
			$user        = self::workspace_context( $body );
			if ( $focus !== '' ) {
				$user .= 'Agent focus: ' . $focus . "\n";
			}
			$user .= "Slice: {$slice}\nPayload:\n" . wp_json_encode( $slice_input, JSON_UNESCAPED_SLASHES );

			$specs[] = array(
				'id'          => sanitize_key( (string) ( $spec['id'] ?? $slice . '_agent' ) ),
				'slice'       => $slice,
				'role'        => (string) ( $spec['role'] ?? $slice ),
				'slice_input' => $slice_input,
				'system'      => $system,
			);

			$jobs[] = array(
				'messages' => array(
					array(
						'role'    => 'system',
						'content' => $system . ' Return JSON only: {"findings":[],"score":null,"notes":"","byUrl":{}}',
					),
					array( 'role' => 'user', 'content' => $user ),
				),
				'opts'     => array(
					'model'       => self::SLICE_MODEL,
					'temperature' => 0.2,
					'maxTokens'   => 2048,
				),
			);
		}

		if ( is_callable( $emit ) ) {
			foreach ( $specs as $meta ) {
				$emit(
					array(
						'status' => 'agent',
						'id'     => $meta['id'],
						'role'   => $meta['role'],
						'state'  => 'running',
					)
				);
			}
		}

		$on_complete = null;
		if ( is_callable( $emit ) ) {
			$on_complete = static function ( int $index, array $result ) use ( $emit, $specs ): void {
				if ( ! isset( $specs[ $index ] ) ) {
					return;
				}
				$meta  = $specs[ $index ];
				$error = (string) ( $result['error'] ?? '' );
				$emit(
					array(
						'status' => 'agent',
						'id'     => $meta['id'],
						'role'   => $meta['role'],
						'state'  => ( $error !== '' && empty( $result['parsed'] ) ) ? 'error' : 'done',
					)
				);
			};
		}

		$results   = Neo_Pulse_App_Chat_Openrouter::json_completion_parallel(
			$jobs,
			array(
				'onComplete' => $on_complete,
			)
		);
		$reports   = array();
		$artifacts = array();

		foreach ( $specs as $i => $meta ) {
			$result = isset( $results[ $i ] ) && is_array( $results[ $i ] ) ? $results[ $i ] : array();
			$error  = (string) ( $result['error'] ?? 'Unknown parallel slice error' );
			$ms     = (int) ( $result['ms'] ?? 0 );
			$output = isset( $result['parsed'] ) && is_array( $result['parsed'] ) ? $result['parsed'] : array();

			if ( $error !== '' && count( $output ) === 0 ) {
				$output = array(
					'findings' => array( 'Sub-agent error: ' . $error ),
					'notes'    => '',
				);
			}

			$report = array(
				'id'     => $meta['id'],
				'slice'  => $meta['slice'],
				'role'   => $meta['role'],
				'model'  => self::SLICE_MODEL,
				'ms'     => $ms,
				'input'  => $meta['slice_input'],
				'output' => $output,
				'error'  => $error,
			);
			$reports[]   = $report;
			$artifacts[] = $report;
		}

		return array(
			'sliceReports' => $reports,
			'artifacts'    => $artifacts,
		);
	}

	/**
	 * @param array<string,mixed> $payload
	 * @param array<string,mixed> $spec
	 * @return array<string,mixed>
	 */
	private static function build_slice_input( array $payload, string $slice, array $spec = array() ): array {
		if ( $slice === 'context' ) {
			$ctx = isset( $payload['context'] ) && is_array( $payload['context'] ) ? $payload['context'] : array();
			$focus = trim( (string) ( $spec['focus'] ?? '' ) );
			if ( $focus !== '' ) {
				$ctx['focus'] = $focus;
			}
			return $ctx;
		}

		if ( in_array( $slice, Neo_Pulse_App_Platform_Data_Intent_Checklist::ENTITY_SLICES, true )
			&& ! empty( $payload['entities'] ) && is_array( $payload['entities'] ) ) {
			$out = array();
			foreach ( $payload['entities'] as $entity ) {
				if ( ! is_array( $entity ) ) {
					continue;
				}
				$out[] = Neo_Pulse_App_Platform_Inventory::extract_slice( $entity, $slice );
			}
			return array( 'entities' => $out );
		}

		if ( in_array( $slice, Neo_Pulse_App_Platform_Data_Intent_Checklist::ANALYTICS_SLICES, true )
			&& isset( $payload['analytics'] ) && is_array( $payload['analytics'] ) ) {
			return Neo_Pulse_App_Platform_Inventory::extract_slice( $payload['analytics'], $slice );
		}

		return array();
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function workspace_context( array $body ): string {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		$lines = array();
		if ( ! empty( $pulse['locationSummary'] ) ) {
			$lines[] = 'Workspace: ' . (string) $pulse['locationSummary'];
		}
		if ( ! empty( $pulse['siteName'] ) ) {
			$lines[] = 'Site: ' . (string) $pulse['siteName'];
		}
		return count( $lines ) > 0 ? implode( "\n", $lines ) . "\n" : '';
	}
}

<?php
/**
 * Parallel action slice specialists for Pulse Assist.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Action_Parallel_Team {

	const SLICE_MODEL = 'google/gemini-2.5-flash-lite';

	/**
	 * @param array<int,array<string,mixed>> $slice_team
	 * @param array<string,mixed>            $read_payload
	 * @param array<string,mixed>            $body
	 * @param callable|null                  $emit
	 * @return array{sliceReports:array<int,array<string,mixed>>}
	 */
	public static function run( array $slice_team, array $read_payload, array $body, string $message, ?callable $emit = null ): array {
		$specs = array();
		$jobs  = array();

		foreach ( $slice_team as $spec ) {
			if ( ! is_array( $spec ) || empty( $spec['slice'] ) ) {
				continue;
			}
			$slice  = sanitize_key( (string) $spec['slice'] );
			$system = (string) ( $spec['systemPrompt'] ?? '' );
			$focus  = (string) ( $spec['focus'] ?? '' );
			$user   = 'User message: ' . $message . "\n";
			$user  .= 'Team context: ' . wp_json_encode( $body['team_context'] ?? array(), JSON_UNESCAPED_SLASHES ) . "\n";
			$user  .= 'Read tool data: ' . wp_json_encode( $read_payload, JSON_UNESCAPED_SLASHES ) . "\n";
			if ( $focus !== '' ) {
				$user .= 'Focus: ' . $focus . "\n";
			}
			$user .= 'Slice: ' . $slice;

			$specs[] = array(
				'id'    => sanitize_key( (string) ( $spec['id'] ?? $slice ) ),
				'slice' => $slice,
				'role'  => (string) ( $spec['role'] ?? $slice ),
			);

			$jobs[] = array(
				'messages' => array(
					array(
						'role'    => 'system',
						'content' => $system . ' Return JSON only: {"findings":[],"assigneeUserId":null,"assigneeName":"","projectId":null,"projectTitle":"","proposedTasks":[],"notes":""}',
					),
					array( 'role' => 'user', 'content' => $user ),
				),
				'opts'     => array(
					'model'       => self::SLICE_MODEL,
					'temperature' => 0.2,
					'maxTokens'   => 1800,
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

		$results = Neo_Pulse_App_Chat_Openrouter::json_completion_parallel(
			$jobs,
			array( 'onComplete' => $on_complete )
		);

		$reports = array();
		foreach ( $specs as $i => $meta ) {
			$result = isset( $results[ $i ] ) && is_array( $results[ $i ] ) ? $results[ $i ] : array();
			$output = isset( $result['parsed'] ) && is_array( $result['parsed'] ) ? $result['parsed'] : array();
			$reports[] = array(
				'id'     => $meta['id'],
				'slice'  => $meta['slice'],
				'role'   => $meta['role'],
				'output' => $output,
			);
		}

		return array( 'sliceReports' => $reports );
	}
}

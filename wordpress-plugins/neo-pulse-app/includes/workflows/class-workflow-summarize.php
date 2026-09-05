<?php
/**
 * AI two-line workflow tile blurb from compact graph JSON (OpenRouter).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Summarize {

	const MAX_LINE_CHARS = 55;

	/**
	 * @param array<string,mixed> $body Name, nodes, edges from the client.
	 * @return array{ok:bool,description?:string,error?:string}
	 */
	public static function summarize( array $body ): array {
		$compact = self::compact_graph( $body );
		$system  = 'You write short workflow tile blurbs. Return JSON only: {"lines":["line1","line2"]}. '
			. 'Exactly 2 lines. Each line at most 55 characters. Simple plain language. '
			. 'No ellipses. No word preview. Do not list client names. Describe what the workflow does.';
		$user    = 'Workflow JSON:' . "\n" . wp_json_encode( $compact );

		try {
			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array( 'role' => 'system', 'content' => $system ),
					array( 'role' => 'user', 'content' => $user ),
				),
				array(
					'temperature' => 0.2,
					'maxTokens'   => 120,
				)
			);
		} catch ( Exception $e ) {
			return array(
				'ok'    => false,
				'error' => $e->getMessage(),
			);
		}

		$validated = self::validate_lines( $parsed );
		if ( $validated === null ) {
			return array(
				'ok'    => false,
				'error' => 'Workflow summary did not match the two-line contract.',
			);
		}

		return array(
			'ok'          => true,
			'description' => $validated[0] . "\n" . $validated[1],
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function compact_graph( array $body ): array {
		$name  = trim( (string) ( $body['name'] ?? '' ) );
		$nodes = isset( $body['nodes'] ) && is_array( $body['nodes'] ) ? $body['nodes'] : array();
		$edges = isset( $body['edges'] ) && is_array( $body['edges'] ) ? $body['edges'] : array();

		$compact_nodes = array();
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$config = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
			$item   = array(
				'id'    => (string) ( $node['id'] ?? '' ),
				'kind'  => (string) ( $node['kind'] ?? '' ),
				'label' => (string) ( $node['label'] ?? '' ),
			);
			if ( isset( $config['executionKind'] ) && is_string( $config['executionKind'] ) && $config['executionKind'] !== '' ) {
				$item['executionKind'] = $config['executionKind'];
			}
			if ( isset( $config['clientScope'] ) && is_string( $config['clientScope'] ) ) {
				$item['clientScope'] = $config['clientScope'];
			}
			if ( isset( $config['siteIds'] ) && is_array( $config['siteIds'] ) ) {
				$item['clientCount'] = count( $config['siteIds'] );
			}
			$compact_nodes[] = $item;
		}

		$compact_edges = array();
		foreach ( $edges as $edge ) {
			if ( ! is_array( $edge ) ) {
				continue;
			}
			$compact_edges[] = array(
				'source' => (string) ( $edge['source'] ?? '' ),
				'target' => (string) ( $edge['target'] ?? '' ),
			);
		}

		return array(
			'name'  => $name !== '' ? $name : 'Untitled workflow',
			'nodes' => $compact_nodes,
			'edges' => $compact_edges,
		);
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @return array{0:string,1:string}|null
	 */
	public static function validate_lines( array $parsed ): ?array {
		$lines = $parsed['lines'] ?? null;
		if ( ! is_array( $lines ) || count( $lines ) !== 2 ) {
			return null;
		}
		$out = array();
		foreach ( $lines as $line ) {
			if ( ! is_string( $line ) ) {
				return null;
			}
			$trimmed = trim( $line );
			if ( $trimmed === '' ) {
				return null;
			}
			if ( function_exists( 'mb_strlen' ) ) {
				if ( mb_strlen( $trimmed ) > self::MAX_LINE_CHARS ) {
					return null;
				}
			} elseif ( strlen( $trimmed ) > self::MAX_LINE_CHARS ) {
				return null;
			}
			if ( strpos( $trimmed, '…' ) !== false || strpos( $trimmed, '...' ) !== false ) {
				return null;
			}
			$out[] = $trimmed;
		}
		return array( $out[0], $out[1] );
	}
}

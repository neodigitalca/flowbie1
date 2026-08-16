<?php
/**
 * Gemini client tag classification for vertical benchmark.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Vertical_Benchmark_Classify {

	/**
	 * @param array<int,array<string,mixed>> $sites
	 * @param array{apiKey?:string,model?:string} $opts
	 * @return array<int,array<string,mixed>>
	 */
	public static function classify_client_tags_batch( array $sites, array $opts = array() ): array {
		if ( empty( $sites ) ) {
			return array();
		}

		$results    = array();
		$need_gemini = array();
		foreach ( $sites as $site ) {
			$id     = (string) ( $site['id'] ?? '' );
			$custom = Neo_Pulse_App_Vertical_Benchmark_Client_Tag::resolve_custom( $site );
			if ( $custom ) {
				$results[] = array(
					'siteId'         => $id,
					'clientTag'      => $custom['clientTag'],
					'clientTagLabel' => $custom['clientTagLabel'],
					'source'         => 'custom',
				);
				continue;
			}
			$need_gemini[] = $site;
		}

		if ( empty( $need_gemini ) ) {
			return $results;
		}

		$system = 'You assign each WordPress client to exactly one industry vertical id from this list (reply JSON only):' . "\n"
			. Neo_Pulse_App_Vertical_Benchmark_Taxonomy::list_for_prompt() . "\n\n"
			. Neo_Pulse_App_Vertical_Benchmark_Taxonomy::classify_rules() . "\n\n"
			. 'Shape: { "sites": [ { "siteId": "<id>", "industryVertical": "<id>", "confidence": 0-1, "rationale": "<short>" } ] }';

		$lines = array();
		foreach ( $need_gemini as $i => $site ) {
			$lines[] = ( $i + 1 ) . '. siteId=' . ( $site['id'] ?? '' ) . ' name=' . ( $site['name'] ?? '' ) . ' url=' . ( $site['siteUrl'] ?? '' ) . ' gbp=' . ( $site['gbpLocationId'] ?? '' );
		}

		$parsed = Neo_Pulse_App_Vertical_Benchmark_Openrouter::json_completion(
			array(
				array( 'role' => 'system', 'content' => $system ),
				array( 'role' => 'user', 'content' => "Classify each site:\n" . implode( "\n", $lines ) ),
			),
			array(
				'apiKey'    => $opts['apiKey'] ?? '',
				'model'     => $opts['model'] ?? '',
				'maxTokens' => 4096,
			)
		);

		$by_id = array();
		foreach ( ( $parsed['sites'] ?? array() ) as $row ) {
			if ( ! is_array( $row ) || empty( $row['siteId'] ) ) {
				continue;
			}
			$by_id[ (string) $row['siteId'] ] = $row;
		}

		foreach ( $need_gemini as $site ) {
			$id  = (string) ( $site['id'] ?? '' );
			$hit = $by_id[ $id ] ?? null;
			$resolved = Neo_Pulse_App_Vertical_Benchmark_Client_Tag::resolve_taxonomy( (string) ( $hit['industryVertical'] ?? 'uncategorized' ) );
			$results[] = array(
				'siteId'         => $id,
				'clientTag'      => $resolved['clientTag'],
				'clientTagLabel' => $resolved['clientTagLabel'],
				'source'         => 'taxonomy',
				'confidence'     => isset( $hit['confidence'] ) ? $hit['confidence'] : null,
				'rationale'      => isset( $hit['rationale'] ) ? $hit['rationale'] : null,
			);
		}

		return $results;
	}
}

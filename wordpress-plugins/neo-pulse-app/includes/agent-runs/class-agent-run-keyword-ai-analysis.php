<?php
/**
 * Keyword AI analysis for server post creator (parity with keyword-ai-analyzer.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Keyword_Ai_Analysis {

	/**
	 * @param array<string,mixed> $research
	 * @return array<string,mixed>
	 */
	public static function run( string $keyword, array $research ): array {
		$keyword = trim( $keyword );
		if ( $keyword === '' ) {
			return array();
		}

		$serp = self::serp_excerpt( $research );
		$user = Neo_Pulse_App_Agent_Run_Generator_Prompts::build_keyword_analysis_user_prompt( $keyword, $serp );

		try {
			$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
				array(
					array(
						'role'    => 'system',
						'content' => Neo_Pulse_App_Agent_Run_Generator_Prompts::build_keyword_analysis_system_prompt(),
					),
					array( 'role' => 'user', 'content' => $user ),
				),
				array( 'temperature' => 1.0, 'maxTokens' => 8192 )
			);
			return self::normalize_analysis( $parsed, $keyword );
		} catch ( Exception $e ) {
			return self::fallback_analysis( $keyword, $research );
		}
	}

	/**
	 * @param array<string,mixed> $research
	 */
	private static function serp_excerpt( array $research ): string {
		$raw = $research['paaRawResponse'] ?? $research['dataforseo']['serpRaw'] ?? null;
		if ( is_array( $raw ) ) {
			return wp_json_encode( $raw ) ?: '';
		}
		return is_string( $raw ) ? $raw : '';
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @return array<string,mixed>
	 */
	private static function normalize_analysis( array $parsed, string $keyword ): array {
		$h2 = is_array( $parsed['h2Suggestions'] ?? null ) ? $parsed['h2Suggestions'] : array();
		$h2 = array_values(
			array_filter(
				array_map(
					static function ( $item ) {
						return is_string( $item ) ? trim( $item ) : '';
					},
					$h2
				)
			)
		);

		$kw = is_array( $parsed['keywordSuggestions'] ?? null ) ? $parsed['keywordSuggestions'] : array();
		$paa = is_array( $parsed['peopleAlsoAsk'] ?? null ) ? $parsed['peopleAlsoAsk'] : array();
		$gaps = is_array( $parsed['contentGaps'] ?? null ) ? $parsed['contentGaps'] : array();

		return array(
			'h2Suggestions'      => array_slice( $h2, 0, 7 ),
			'keywordSuggestions' => array(
				'primary'    => trim( (string) ( $kw['primary'] ?? $keyword ) ),
				'variations' => is_array( $kw['variations'] ?? null ) ? array_slice( $kw['variations'], 0, 8 ) : array(),
				'longTail'   => is_array( $kw['longTail'] ?? null ) ? array_slice( $kw['longTail'], 0, 5 ) : array(),
			),
			'peopleAlsoAsk'        => array_slice( $paa, 0, 10 ),
			'contentGaps'          => array_slice( $gaps, 0, 8 ),
			'generatedAt'          => gmdate( 'c' ),
		);
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<string,mixed>
	 */
	private static function fallback_analysis( string $keyword, array $research ): array {
		$variations = array();
		$rows       = is_array( $research['keywordData'] ?? null ) ? $research['keywordData'] : array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$kw = trim( (string) ( $row['keyword'] ?? '' ) );
			if ( $kw !== '' && strtolower( $kw ) !== strtolower( $keyword ) ) {
				$variations[] = $kw;
			}
		}
		return array(
			'h2Suggestions'      => array(),
			'keywordSuggestions' => array(
				'primary'    => $keyword,
				'variations' => array_slice( array_values( array_unique( $variations ) ), 0, 8 ),
				'longTail'   => array(),
			),
			'peopleAlsoAsk'      => array(),
			'contentGaps'        => array(),
			'generatedAt'        => gmdate( 'c' ),
		);
	}
}

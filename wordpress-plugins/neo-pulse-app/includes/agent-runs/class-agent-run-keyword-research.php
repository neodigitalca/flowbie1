<?php
/**
 * Server-side keyword + SERP research for post creator agent runs.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Keyword_Research {

	/**
	 * @return array<string,mixed>
	 */
	public static function run( string $keyword, string $page_url ): array {
		$keyword = trim( $keyword );
		$payload = array(
			'generatedAt'    => gmdate( 'c' ),
			'primaryKeyword' => $keyword,
			'skipped'        => false,
			'reason'         => null,
			'dataforseo'     => null,
			'semrush'        => null,
			'keywordData'    => null,
			'paaRawResponse' => null,
		);

		if ( $keyword === '' ) {
			$payload['skipped'] = true;
			$payload['reason']  = 'empty_keyword';
			return $payload;
		}

		if ( Neo_Pulse_App_Dataforseo_Client::has_credentials() ) {
			$dfs = self::fetch_dataforseo( $keyword );
			$payload['dataforseo']     = $dfs;
			$payload['keywordData']    = $dfs['keywordData'] ?? null;
			$payload['paaRawResponse'] = $dfs['serpRaw'] ?? null;
		} else {
			$payload['skipped'] = true;
			$payload['reason']  = 'no_dataforseo_credentials';
		}

		if ( Neo_Pulse_App_Semrush_Client::has_api_key() ) {
			$payload['semrush'] = Neo_Pulse_App_Semrush_Bulk_Enrichment::run(
				array(
					'pageUrl'     => $page_url,
					'seedKeyword' => $keyword,
				)
			);
			if ( self::has_usable_data( $payload ) ) {
				$payload['skipped'] = false;
				$payload['reason']  = null;
			}
		}

		$payload['aiAnalysis'] = Neo_Pulse_App_Agent_Run_Keyword_Ai_Analysis::run( $keyword, $payload );

		return $payload;
	}

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function has_usable_data( array $payload ): bool {
		if ( ! empty( $payload['keywordData'] ) && is_array( $payload['keywordData'] ) ) {
			return true;
		}
		if ( ! empty( $payload['paaRawResponse'] ) ) {
			return true;
		}
		$dfs = $payload['dataforseo'] ?? null;
		if ( is_array( $dfs ) && ( ! empty( $dfs['keywordOverviewRaw'] ) || ! empty( $dfs['serpRaw'] ) ) ) {
			return true;
		}
		$semrush = $payload['semrush'] ?? null;
		if ( is_array( $semrush ) && empty( $semrush['skipped'] ) ) {
			$lists = array(
				'urlOrganicKeywords'    => $semrush['urlOrganicKeywords'] ?? array(),
				'phraseRelatedKeywords' => $semrush['phraseRelatedKeywords'] ?? array(),
			);
			foreach ( $lists as $list ) {
				if ( is_array( $list ) && count( $list ) > 0 ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function fetch_dataforseo( string $keyword ): array {
		$out = array(
			'keywordOverviewRaw' => null,
			'serpRaw'            => null,
			'keywordData'        => array(),
			'errors'             => array(),
		);

		$overview = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_dataforseo_labs_google_keyword_overview',
			array(
				'keywords'      => array( $keyword ),
				'location_name' => 'United States',
				'language_code' => 'en',
			)
		);
		if ( is_wp_error( $overview ) ) {
			$out['errors'][] = array(
				'step'    => 'keyword_overview',
				'message' => $overview->get_error_message(),
			);
		} else {
			$out['keywordOverviewRaw'] = $overview;
			$out['keywordData']        = self::parse_keyword_overview( $overview, $keyword );
		}

		$serp = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_serp_organic_live_advanced',
			array(
				'keyword'       => $keyword,
				'location_name' => 'United States',
				'language_code' => 'en',
				'depth'         => 10,
			)
		);
		if ( is_wp_error( $serp ) ) {
			$out['errors'][] = array(
				'step'    => 'serp_organic',
				'message' => $serp->get_error_message(),
			);
		} else {
			$out['serpRaw'] = $serp;
		}

		return $out;
	}

	/**
	 * @param array<string,mixed> $response
	 * @return array<int,array<string,mixed>>
	 */
	private static function parse_keyword_overview( array $response, string $fallback_keyword ): array {
		$rows = array();
		$tasks = isset( $response['tasks'] ) && is_array( $response['tasks'] ) ? $response['tasks'] : array();
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) || empty( $task['result'] ) || ! is_array( $task['result'] ) ) {
				continue;
			}
			foreach ( $task['result'] as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				if ( ! empty( $item['items'] ) && is_array( $item['items'] ) ) {
					foreach ( $item['items'] as $sub ) {
						$row = self::keyword_row_from_item( $sub, $fallback_keyword );
						if ( $row ) {
							$rows[] = $row;
						}
					}
					continue;
				}
				$row = self::keyword_row_from_item( $item, $fallback_keyword );
				if ( $row ) {
					$rows[] = $row;
				}
			}
		}
		if ( empty( $rows ) && $fallback_keyword !== '' ) {
			$rows[] = array(
				'keyword'      => $fallback_keyword,
				'searchVolume' => 0,
				'difficulty'   => 0,
				'cpc'          => 0,
				'competition'  => 'LOW',
			);
		}
		return $rows;
	}

	/**
	 * @param array<string,mixed> $item
	 * @return array<string,mixed>|null
	 */
	private static function keyword_row_from_item( array $item, string $fallback_keyword ): ?array {
		$info = is_array( $item['keyword_info'] ?? null ) ? $item['keyword_info'] : array();
		$kw   = trim( (string) ( $item['keyword'] ?? $info['keyword'] ?? $fallback_keyword ) );
		if ( $kw === '' ) {
			return null;
		}
		$comp = strtoupper( (string) ( $info['competition_level'] ?? 'LOW' ) );
		if ( strpos( $comp, 'HIGH' ) !== false ) {
			$competition = 'HIGH';
		} elseif ( strpos( $comp, 'MEDIUM' ) !== false || strpos( $comp, 'MODERATE' ) !== false ) {
			$competition = 'MEDIUM';
		} else {
			$competition = 'LOW';
		}
		return array(
			'keyword'      => $kw,
			'searchVolume' => (int) ( $info['search_volume'] ?? 0 ),
			'difficulty'   => (int) ( $item['keyword_properties']['keyword_difficulty'] ?? $info['keyword_difficulty'] ?? 0 ),
			'cpc'          => (float) ( $info['cpc'] ?? 0 ),
			'competition'  => $competition,
		);
	}
}

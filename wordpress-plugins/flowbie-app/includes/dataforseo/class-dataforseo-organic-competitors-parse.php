<?php
/**
 * DataForSEO Labs response parsing for competitor research.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Dataforseo_Organic_Competitors_Parse {

	/**
	 * @param array<string,mixed> $data
	 * @return array<int,mixed>
	 */
	public static function extract_competitors_items( array $data ): array {
		$task   = $data['tasks'][0] ?? null;
		$result = is_array( $task ) ? ( $task['result'] ?? null ) : null;
		if ( is_array( $result ) ) {
			if ( isset( $result[0]['items'] ) && is_array( $result[0]['items'] ) ) {
				return $result[0]['items'];
			}
			return $result;
		}
		if ( is_array( $result ) && isset( $result['items'] ) && is_array( $result['items'] ) ) {
			return $result['items'];
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $it
	 * @return array{domain:string,competitionLevel:?float,commonKeywords:?float,organicTraffic:?float,trafficCost:?float,organicKeywords:?float,adsKeywords:?float}|null
	 */
	public static function map_competitor_item_to_row( array $it ): ?array {
		$raw    = $it['domain'] ?? $it['target'] ?? '';
		$domain = strtolower(
			explode(
				'/',
				preg_replace( '#^https?://#i', '', preg_replace( '/^www\./i', '', trim( (string) $raw ) ) )
			)[0]
		);
		if ( $domain === '' ) {
			return null;
		}

		$intersections = self::num( $it['intersections'] ?? null );
		$etv           = self::num( $it['etv'] ?? null );
		$ki            = is_array( $it['keyword_data']['keyword_info'] ?? null )
			? $it['keyword_data']['keyword_info']
			: ( is_array( $it['metrics']['keyword_info'] ?? null ) ? $it['metrics']['keyword_info'] : array() );
		$org_count     = self::num( $it['metrics']['organic']['count'] ?? $it['organic_keywords'] ?? $it['organic_count'] ?? null );
		$comp          = self::num( $ki['competition'] ?? null );
		$comp_level    = ( $comp !== null && $comp <= 1 ) ? $comp * 100 : $comp;
		$cpc           = self::num( $ki['cpc'] ?? null );

		return array(
			'domain'           => $domain,
			'competitionLevel' => $comp_level,
			'commonKeywords'   => $intersections,
			'organicTraffic'   => $etv,
			'trafficCost'      => ( $cpc !== null && $etv !== null ) ? $etv * $cpc : self::num( $it['estimated_paid_traffic_cost'] ?? null ),
			'organicKeywords'  => $org_count,
			'adsKeywords'      => self::num( $it['metrics']['paid']['count'] ?? null ),
		);
	}

	/**
	 * @param array<string,mixed> $overview_json
	 * @return array{organicKeywords:?float,organicTraffic:?float,trafficCost:?float,adsKeywords:?float}|null
	 */
	public static function seed_metrics_from_domain_rank_overview( array $overview_json ): ?array {
		$task = $overview_json['tasks'][0] ?? null;
		if ( is_array( $task ) && isset( $task['status_code'] ) && (int) $task['status_code'] !== 20000 ) {
			return null;
		}
		$items = $task['result'][0]['items'] ?? null;
		if ( ! is_array( $items ) || $items === array() ) {
			return null;
		}
		$best = $items[0];
		$org  = is_array( $best['metrics']['organic'] ?? null ) ? $best['metrics']['organic'] : array();
		$paid = is_array( $best['metrics']['paid'] ?? null ) ? $best['metrics']['paid'] : array();
		return array(
			'organicKeywords' => self::num( $org['count'] ?? null ),
			'organicTraffic'  => self::num( $org['etv'] ?? null ),
			'trafficCost'     => self::num( $org['estimated_paid_traffic_cost'] ?? null ),
			'adsKeywords'     => self::num( $paid['count'] ?? null ),
		);
	}

	/**
	 * @param array<string,mixed> $api_json
	 * @return array<int,array{phrase:string,volume:?float,traffic:?float,position:?float}>
	 */
	public static function top_keywords_from_ranked_response( array $api_json, int $limit ): array {
		$items = self::extract_ranked_keyword_items( $api_json );
		$out   = array();
		foreach ( $items as $it ) {
			if ( ! is_array( $it ) ) {
				continue;
			}
			$row = self::map_ranked_item_to_keyword_row( $it );
			if ( $row['phrase'] !== '' ) {
				$out[] = $row;
			}
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $api_json
	 * @return array<int,mixed>
	 */
	public static function extract_ranked_keyword_items( array $api_json ): array {
		$task = $api_json['tasks'][0] ?? null;
		if ( is_array( $task ) && isset( $task['status_code'] ) && (int) $task['status_code'] !== 20000 ) {
			return array();
		}
		$r0 = is_array( $task ) ? ( $task['result'][0] ?? null ) : null;
		if ( ! is_array( $r0 ) ) {
			return array();
		}
		return is_array( $r0['items'] ?? null ) ? $r0['items'] : array();
	}

	/**
	 * @param array<string,mixed> $item
	 * @return array{phrase:string,volume:?float,traffic:?float,position:?float}
	 */
	public static function map_ranked_item_to_keyword_row( array $item ): array {
		$keyword = is_string( $item['keyword'] ?? null )
			? $item['keyword']
			: ( is_array( $item['keyword_data'] ?? null ) ? (string) ( $item['keyword_data']['keyword'] ?? '' ) : '' );
		$ki      = is_array( $item['keyword_data']['keyword_info'] ?? null ) ? $item['keyword_data']['keyword_info'] : array();
		$serp    = is_array( $item['ranked_serp_element']['serp_item'] ?? null ) ? $item['ranked_serp_element']['serp_item'] : array();
		return array(
			'phrase'   => trim( (string) $keyword ),
			'volume'   => self::round_int( self::num( $ki['search_volume'] ?? null ) ),
			'traffic'  => self::round_int( self::num( $serp['etv'] ?? null ) ),
			'position' => self::round_int( self::num( $serp['rank_absolute'] ?? $serp['rank_group'] ?? null ) ),
		);
	}

	/**
	 * @param array<int,array{step:string,message:string}> $errors
	 */
	public static function assert_task_ok( array $res, string $step, array &$errors ): bool {
		$task = $res['tasks'][0] ?? null;
		if ( ! is_array( $task ) || ! isset( $task['status_code'] ) ) {
			return true;
		}
		if ( (int) $task['status_code'] === 20000 ) {
			return true;
		}
		$errors[] = array(
			'step'    => $step,
			'message' => ! empty( $task['status_message'] ) ? (string) $task['status_message'] : 'DataForSEO task status ' . (int) $task['status_code'],
		);
		return false;
	}

	/**
	 * @param mixed $x
	 */
	public static function num( $x ): ?float {
		if ( $x === null ) {
			return null;
		}
		if ( is_int( $x ) || is_float( $x ) ) {
			return is_finite( (float) $x ) ? (float) $x : null;
		}
		$s = trim( str_replace( ',', '', (string) $x ) );
		if ( $s === '' || $s === '-' || preg_match( '/^n\/?a$/i', $s ) ) {
			return null;
		}
		$n = (float) $s;
		return is_finite( $n ) ? $n : null;
	}

	/**
	 * @param float|null $n
	 */
	public static function round_int( ?float $n ): ?float {
		if ( $n === null || ! is_finite( $n ) ) {
			return null;
		}
		return (float) round( $n );
	}
}

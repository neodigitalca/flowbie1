<?php
/**
 * Parse DataForSEO Lighthouse responses for proposal site audit.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Proposal_Lighthouse_Parse {

	/**
	 * @param array<string,mixed> $dfs_response
	 * @return array<string,mixed>|null
	 */
	public static function parse_page_metrics( array $dfs_response, string $url, string $device ): ?array {
		$task = $dfs_response['tasks'][0] ?? null;
		if ( ! is_array( $task ) || (int) ( $task['status_code'] ?? 0 ) !== 20000 ) {
			return null;
		}
		$result = $task['result'][0] ?? null;
		if ( ! is_array( $result ) ) {
			return null;
		}
		$categories = is_array( $result['categories'] ?? null ) ? $result['categories'] : array();
		$audits     = is_array( $result['audits'] ?? null ) ? $result['audits'] : array();

		return array(
			'url'                => $url,
			'device'             => $device,
			'performanceScore'   => self::cat_score( $categories, 'performance' ),
			'accessibilityScore' => self::cat_score( $categories, 'accessibility' ),
			'bestPracticesScore' => self::cat_score( $categories, 'best_practices' ),
			'seoScore'           => self::cat_score( $categories, 'seo' ),
			'fcpMs'              => self::audit_numeric( $audits, 'first-contentful-paint' ),
			'lcpMs'              => self::audit_numeric( $audits, 'largest-contentful-paint' ),
			'cls'                => self::audit_numeric( $audits, 'cumulative-layout-shift' ),
			'tbtMs'              => self::audit_numeric( $audits, 'total-blocking-time' ),
			'speedIndexMs'       => self::audit_numeric( $audits, 'speed-index' ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $desktop_pages
	 * @param array<int,array<string,mixed>> $mobile_pages
	 * @return array<string,mixed>
	 */
	public static function build_performance_summary( array $desktop_pages, array $mobile_pages ): array {
		return array(
			'desktop'    => self::aggregate_perf_pages( $desktop_pages ),
			'mobile'     => self::aggregate_perf_pages( $mobile_pages ),
			'worstPages' => self::find_worst_pages( array_merge( $desktop_pages, $mobile_pages ), 5 ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $pages
	 * @return array<string,mixed>
	 */
	private static function aggregate_perf_pages( array $pages ): array {
		$ok = array_values(
			array_filter(
				$pages,
				static function ( $p ) {
					return is_array( $p ) && isset( $p['performanceScore'] ) && is_numeric( $p['performanceScore'] );
				}
			)
		);
		return array(
			'sampleSize'         => count( $ok ),
			'performanceScore'   => self::average_field( $ok, 'performanceScore' ),
			'accessibilityScore' => self::average_field( $ok, 'accessibilityScore' ),
			'bestPracticesScore' => self::average_field( $ok, 'bestPracticesScore' ),
			'seoScore'           => self::average_field( $ok, 'seoScore' ),
			'fcpMs'              => self::average_field( $ok, 'fcpMs' ),
			'lcpMs'              => self::average_field( $ok, 'lcpMs' ),
			'cls'                => self::average_field( $ok, 'cls' ),
			'tbtMs'              => self::average_field( $ok, 'tbtMs' ),
			'speedIndexMs'       => self::average_field( $ok, 'speedIndexMs' ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $pages
	 * @return array<int,array<string,mixed>>
	 */
	private static function find_worst_pages( array $pages, int $limit ): array {
		$filtered = array_values(
			array_filter(
				$pages,
				static function ( $p ) {
					return is_array( $p ) && isset( $p['performanceScore'] ) && is_numeric( $p['performanceScore'] );
				}
			)
		);
		usort(
			$filtered,
			static function ( $a, $b ) {
				return ( $a['performanceScore'] ?? 100 ) <=> ( $b['performanceScore'] ?? 100 );
			}
		);
		$out = array();
		foreach ( array_slice( $filtered, 0, $limit ) as $p ) {
			$out[] = array(
				'url'              => $p['url'] ?? '',
				'device'           => $p['device'] ?? '',
				'performanceScore' => $p['performanceScore'] ?? null,
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $categories
	 */
	private static function cat_score( array $categories, string $key ): ?float {
		$c = $categories[ $key ] ?? null;
		if ( ! is_array( $c ) || ! isset( $c['score'] ) || ! is_numeric( $c['score'] ) ) {
			return null;
		}
		$raw = (float) $c['score'];
		if ( $raw <= 1 ) {
			return (float) round( $raw * 100 );
		}
		return (float) round( $raw );
	}

	/**
	 * @param array<string,mixed> $audits
	 */
	private static function audit_numeric( array $audits, string $id ): ?float {
		$entry = $audits[ $id ] ?? null;
		if ( ! is_array( $entry ) || ! isset( $entry['numericValue'] ) || ! is_numeric( $entry['numericValue'] ) ) {
			return null;
		}
		return (float) $entry['numericValue'];
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 */
	private static function average_field( array $rows, string $field ): ?float {
		$vals = array();
		foreach ( $rows as $r ) {
			if ( isset( $r[ $field ] ) && is_numeric( $r[ $field ] ) ) {
				$vals[] = (float) $r[ $field ];
			}
		}
		if ( $vals === array() ) {
			return null;
		}
		return round( array_sum( $vals ) / count( $vals ), 2 );
	}
}

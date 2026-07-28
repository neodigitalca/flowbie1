<?php
/**
 * GSC data formatted for AI content prompts (Flow Assist, harness, SEO blocks).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Gsc_Prompt {

	/**
	 * Whether direct GSC credentials are configured.
	 */
	public static function is_available(): bool {
		return Flowbie_Wp_Gsc::is_available();
	}

	/**
	 * Harness-style GSC block for a post/page.
	 */
	public static function for_post( int $post_id, string $focus_keyword = '', string $date_from = '', string $date_to = '' ): string {
		if ( $post_id < 1 ) {
			return '';
		}

		$page_url = get_permalink( $post_id );
		$page_url = is_string( $page_url ) ? esc_url_raw( trim( $page_url ) ) : '';
		if ( $page_url === '' ) {
			return '';
		}

		$queries = array();
		if ( self::is_available() ) {
			$page_data = Flowbie_Wp_Gsc::fetch_page_queries( $page_url, $date_from, $date_to );
			if ( ! is_wp_error( $page_data ) && ! empty( $page_data['queries'] ) && is_array( $page_data['queries'] ) ) {
				$queries = $page_data['queries'];
			}
		}

		if ( empty( $queries ) ) {
			$legacy = Flowbie_Wp_Ai_Gsc::get_suggestions( $post_id, $focus_keyword );
			if ( is_array( $legacy ) ) {
				if ( ! empty( $legacy['queries'] ) && is_array( $legacy['queries'] ) ) {
					$queries = $legacy['queries'];
				} elseif ( ! empty( $legacy['suggestions'] ) && is_array( $legacy['suggestions'] ) ) {
					$queries = $legacy['suggestions'];
				}
			}
		}

		$site_queries = array();
		if ( self::is_available() && count( $queries ) < 10 ) {
			$range = Flowbie_Wp_Gsc::default_date_range();
			$site  = Flowbie_Wp_Gsc::fetch_stats_for_range(
				$date_from !== '' ? $date_from : $range['start'],
				$date_to !== '' ? $date_to : $range['end'],
				10
			);
			if ( ! is_wp_error( $site ) && ! empty( $site['topQueries'] ) && is_array( $site['topQueries'] ) ) {
				$site_queries = array_slice( $site['topQueries'], 0, 10 );
			}
		}

		return self::format_block(
			array(
				'pageUrl'      => $page_url,
				'pageQueries'  => array_slice( $queries, 0, 10 ),
				'siteQueries'  => $site_queries,
				'focusKeyword' => $focus_keyword,
			)
		);
	}

	/**
	 * Site-wide GSC summary for prompts.
	 */
	public static function for_site( string $date_from = '', string $date_to = '' ): string {
		if ( ! self::is_available() ) {
			return '';
		}

		$range = Flowbie_Wp_Gsc::default_date_range();
		$stats = Flowbie_Wp_Gsc::fetch_stats_for_range(
			$date_from !== '' ? $date_from : $range['start'],
			$date_to !== '' ? $date_to : $range['end'],
			10
		);
		if ( is_wp_error( $stats ) || empty( $stats['topQueries'] ) ) {
			return '';
		}

		$summary = isset( $stats['summary'] ) && is_array( $stats['summary'] ) ? $stats['summary'] : array();
		return self::format_block(
			array(
				'siteSummary' => $summary,
				'siteQueries' => array_slice( (array) $stats['topQueries'], 0, 25 ),
				'dateRange'   => isset( $stats['dateRange'] ) ? $stats['dateRange'] : null,
			)
		);
	}

	/**
	 * @param array<string, mixed> $params post_id, focus_keyword, date_from, date_to.
	 * @return array{prompt_block: string, queries: array<int, array<string,mixed>>, available: bool}
	 */
	public static function get_context( array $params ): array {
		$post_id       = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		$focus_keyword = isset( $params['focus_keyword'] ) ? sanitize_text_field( (string) $params['focus_keyword'] ) : '';
		$date_from     = isset( $params['date_from'] ) ? sanitize_text_field( (string) $params['date_from'] ) : '';
		$date_to       = isset( $params['date_to'] ) ? sanitize_text_field( (string) $params['date_to'] ) : '';

		if ( $post_id > 0 && $focus_keyword === '' ) {
			$focus_keyword = get_post_meta( $post_id, '_flowbie_focus_keyword', true );
			$focus_keyword = is_string( $focus_keyword ) ? $focus_keyword : '';
		}

		$prompt = '';
		$queries = array();

		if ( $post_id > 0 ) {
			$prompt = self::for_post( $post_id, $focus_keyword, $date_from, $date_to );
			if ( self::is_available() ) {
				$page_url = get_permalink( $post_id );
				if ( is_string( $page_url ) && $page_url !== '' ) {
					$page_data = Flowbie_Wp_Gsc::fetch_page_queries( $page_url, $date_from, $date_to );
					if ( ! is_wp_error( $page_data ) && ! empty( $page_data['queries'] ) ) {
						$queries = $page_data['queries'];
					}
				}
			}
		} else {
			$prompt = self::for_site( $date_from, $date_to );
			if ( self::is_available() ) {
				$range = Flowbie_Wp_Gsc::default_date_range();
				$stats = Flowbie_Wp_Gsc::fetch_stats_for_range(
					$date_from !== '' ? $date_from : $range['start'],
					$date_to !== '' ? $date_to : $range['end'],
					25
				);
				if ( ! is_wp_error( $stats ) && ! empty( $stats['topQueries'] ) ) {
					$queries = $stats['topQueries'];
				}
			}
		}

		return array(
			'prompt_block' => $prompt,
			'queries'      => is_array( $queries ) ? $queries : array(),
			'available'    => self::is_available() || $prompt !== '',
		);
	}

	/**
	 * @param array<string, mixed> $data Context payload.
	 */
	public static function format_block( array $data ): string {
		$lines = array();

		if ( ! empty( $data['pageUrl'] ) ) {
			$lines[] = 'Page: ' . (string) $data['pageUrl'];
		}
		if ( ! empty( $data['focusKeyword'] ) ) {
			$lines[] = 'Focus keyword: ' . (string) $data['focusKeyword'];
		}
		if ( ! empty( $data['siteSummary'] ) && is_array( $data['siteSummary'] ) ) {
			$s = $data['siteSummary'];
			$lines[] = sprintf(
				'Site totals: %d clicks, %d impressions, CTR %.2f%%, avg position %.1f',
				isset( $s['clicks'] ) ? (int) $s['clicks'] : 0,
				isset( $s['impressions'] ) ? (int) $s['impressions'] : 0,
				isset( $s['ctr'] ) ? round( (float) $s['ctr'] * 100, 2 ) : 0,
				isset( $s['avgPosition'] ) ? (float) $s['avgPosition'] : 0
			);
		}

		$page_queries = ! empty( $data['pageQueries'] ) && is_array( $data['pageQueries'] ) ? $data['pageQueries'] : array();
		if ( ! empty( $page_queries ) ) {
			$lines[] = 'Top queries for this page:';
			foreach ( array_slice( $page_queries, 0, 10 ) as $row ) {
				if ( ! is_array( $row ) || empty( $row['query'] ) ) {
					continue;
				}
				$lines[] = sprintf(
					'- "%s" | %d clicks | %d impressions | pos %.1f',
					(string) $row['query'],
					isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					isset( $row['position'] ) ? (float) $row['position'] : 0
				);
			}
		}

		$site_queries = ! empty( $data['siteQueries'] ) && is_array( $data['siteQueries'] ) ? $data['siteQueries'] : array();
		if ( ! empty( $site_queries ) && empty( $page_queries ) ) {
			$lines[] = 'Top site queries:';
			foreach ( array_slice( $site_queries, 0, 25 ) as $row ) {
				if ( ! is_array( $row ) || empty( $row['query'] ) ) {
					continue;
				}
				$lines[] = sprintf(
					'- "%s" | %d clicks | %d impressions | pos %.1f',
					(string) $row['query'],
					isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					isset( $row['position'] ) ? (float) $row['position'] : 0
				);
			}
		}

		if ( empty( $lines ) ) {
			return '';
		}

		$json_payload = array(
			'gsc_keywords_for_url' => array_slice( $page_queries ?: $site_queries, 0, 10 ),
		);

		return "\n=== SEARCH CONSOLE QUERIES ===\n"
			. implode( "\n", $lines )
			. "\n"
			. wp_json_encode( $json_payload, JSON_UNESCAPED_SLASHES )
			. "\n=== END ===\n";
	}
}

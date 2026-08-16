<?php
/**
 * GSC read-only data tools (top pages, queries, blog performers).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Platform_Data_Gsc_Tools {

	const MAX_GSC_ROWS       = 30;
	const BLOG_FETCH_LIMIT   = 100;
	const INVENTORY_JOIN_LIMIT = 100;

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_status( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array(
				'ok'   => false,
				'note' => 'No siteUrl available for GSC status.',
			);
		}
		if ( ! self::configured() ) {
			return array(
				'ok'   => false,
				'note' => 'GSC service account is not configured.',
			);
		}
		$fm = Neo_Pulse_App_Gsc_Service_Account::find_matching_property( $site_url );
		if ( empty( $fm['match'] ) ) {
			return array(
				'ok'   => false,
				'note' => 'GSC not connected for ' . $site_url . '.',
			);
		}
		return array(
			'ok'    => true,
			'lines' => array(
				'Connected: yes',
				'Property: ' . (string) $fm['match'],
				'Site URL: ' . $site_url,
			),
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_top_queries( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array( 'ok' => false, 'note' => 'No siteUrl for GSC queries.' );
		}
		$dates     = self::resolve_gsc_dates( $params );
		$row_limit = isset( $params['rowLimit'] ) ? max( 1, min( self::MAX_GSC_ROWS, (int) $params['rowLimit'] ) ) : self::MAX_GSC_ROWS;
		$result    = Neo_Pulse_App_Gsc_Queries::fetch_queries(
			array(
				'siteUrl'   => $site_url,
				'startDate' => $dates['startDate'],
				'endDate'   => $dates['endDate'],
				'rowLimit'  => $row_limit,
			)
		);
		return self::gsc_queries_result( $result, $dates );
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_top_pages( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array( 'ok' => false, 'note' => 'No siteUrl for GSC top pages.' );
		}
		$dates  = self::resolve_gsc_dates( $params );
		$limit  = isset( $params['limit'] ) ? max( 1, min( self::BLOG_FETCH_LIMIT, (int) $params['limit'] ) ) : self::MAX_GSC_ROWS;
		$result = Neo_Pulse_App_Gsc_Performance_Batch::top_pages(
			array(
				'siteUrl'   => $site_url,
				'startDate' => $dates['startDate'],
				'endDate'   => $dates['endDate'],
				'limit'     => $limit,
			)
		);
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GSC top pages failed.',
			);
		}
		$pages = isset( $body_data['pages'] ) && is_array( $body_data['pages'] ) ? array_slice( $body_data['pages'], 0, self::MAX_GSC_ROWS ) : array();
		$pages = self::enrich_pages_with_inventory( $body, $pages );
		$lines = array( 'Period: ' . $dates['startDate'] . ' to ' . $dates['endDate'] );
		$rows  = array();
		foreach ( $pages as $page ) {
			if ( ! is_array( $page ) ) {
				continue;
			}
			$url   = (string) ( $page['url'] ?? '' );
			$title = (string) ( $page['title'] ?? '' );
			$link  = self::page_link_label( $title, $url );
			$lines[] = '- ' . $link . ' | clicks ' . (int) ( $page['clicks'] ?? 0 ) . ' | impressions ' . (int) ( $page['impressions'] ?? 0 );
			$rows[]  = $page;
		}
		if ( count( $pages ) === 0 ) {
			$lines[] = 'No pages in this period.';
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $rows,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_blog_performers( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array( 'ok' => false, 'note' => 'No siteUrl for GSC blog performers.' );
		}
		$dates      = self::resolve_gsc_dates( $params );
		$limit      = isset( $params['limit'] ) ? max( 1, min( 20, (int) $params['limit'] ) ) : 5;
		$min_clicks = isset( $params['minClicks'] ) ? max( 0, (int) $params['minClicks'] ) : 1;
		$result     = Neo_Pulse_App_Gsc_Performance_Batch::top_pages(
			array(
				'siteUrl'   => $site_url,
				'startDate' => $dates['startDate'],
				'endDate'   => $dates['endDate'],
				'limit'     => self::BLOG_FETCH_LIMIT,
			)
		);
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GSC blog performers failed.',
			);
		}
		$pages     = isset( $body_data['pages'] ) && is_array( $body_data['pages'] ) ? $body_data['pages'] : array();
		$url_map   = self::inventory_url_map( $body );
		$blog_rows = array();
		foreach ( $pages as $page ) {
			if ( ! is_array( $page ) ) {
				continue;
			}
			$url = (string) ( $page['url'] ?? '' );
			if ( $url === '' || ! self::is_blog_url( $url ) ) {
				continue;
			}
			$clicks = (int) ( $page['clicks'] ?? 0 );
			if ( $clicks < $min_clicks ) {
				continue;
			}
			$norm     = self::normalize_page_url( $url );
			$inv      = isset( $url_map[ $norm ] ) ? $url_map[ $norm ] : null;
			$title    = is_array( $inv ) && ! empty( $inv['title'] ) ? (string) $inv['title'] : '';
			$matched  = is_array( $inv ) ? 'inventory' : 'gsc_page';
			if ( $title === '' && is_array( $inv ) ) {
				$title = (string) ( $inv['title'] ?? '' );
			}
			$ctr = self::page_ctr( $page );
			$blog_rows[] = array(
				'url'           => $url,
				'title'         => $title,
				'contentKind'   => 'blog',
				'clicks'        => $clicks,
				'impressions'   => (int) ( $page['impressions'] ?? 0 ),
				'position'      => round( (float) ( $page['position'] ?? 0 ), 1 ),
				'ctr'           => $ctr,
				'ctrPercent'    => self::ctr_percent_label( $ctr ),
				'focus_keyword' => is_array( $inv ) ? (string) ( $inv['focus_keyword'] ?? '' ) : '',
				'post_type'     => is_array( $inv ) ? (string) ( $inv['post_type'] ?? 'post' ) : 'post',
				'matchedFrom'   => $matched,
			);
		}
		usort(
			$blog_rows,
			static function ( $a, $b ) {
				return (int) ( $b['clicks'] ?? 0 ) <=> (int) ( $a['clicks'] ?? 0 );
			}
		);
		$blog_rows = array_slice( $blog_rows, 0, $limit );
		$lines     = array( 'Period: ' . $dates['startDate'] . ' to ' . $dates['endDate'] );
		if ( count( $blog_rows ) === 0 ) {
			$lines[] = 'No blog URLs with ' . $min_clicks . '+ clicks in this period.';
		}
		foreach ( $blog_rows as $row ) {
			$title = (string) ( $row['title'] ?? '' );
			$url   = (string) ( $row['url'] ?? '' );
			$link  = self::page_link_label( $title, $url );
			$lines[] = '- ' . $link . ' | clicks ' . (int) ( $row['clicks'] ?? 0 )
				. ' | impressions ' . (int) ( $row['impressions'] ?? 0 )
				. ' | pos ' . (float) ( $row['position'] ?? 0 )
				. ' | CTR ' . (string) ( $row['ctrPercent'] ?? self::ctr_percent_label( self::page_ctr( $row ) ) );
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $blog_rows,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_page_queries( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		$page_url = isset( $params['pageUrl'] ) ? esc_url_raw( trim( (string) $params['pageUrl'] ) ) : '';
		if ( $page_url === '' ) {
			$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
			if ( ! empty( $pulse['expandedPageUrl'] ) ) {
				$page_url = esc_url_raw( trim( (string) $pulse['expandedPageUrl'] ) );
			}
		}
		if ( $site_url === '' || $page_url === '' ) {
			return array( 'ok' => false, 'note' => 'gsc_page_queries requires siteUrl and pageUrl.' );
		}
		$dates  = self::resolve_gsc_dates( $params );
		$result = Neo_Pulse_App_Gsc_Performance::fetch_page_performance(
			array(
				'siteUrl'   => $site_url,
				'pageUrl'   => $page_url,
				'startDate' => $dates['startDate'],
				'endDate'   => $dates['endDate'],
			)
		);
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GSC page queries failed.',
			);
		}
		$queries = isset( $body_data['queries'] ) && is_array( $body_data['queries'] ) ? array_slice( $body_data['queries'], 0, self::MAX_GSC_ROWS ) : array();
		$lines   = array( 'Page: ' . $page_url, 'Period: ' . $dates['startDate'] . ' to ' . $dates['endDate'] );
		$rows    = array();
		foreach ( $queries as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$q       = (string) ( $row['query'] ?? '' );
			$lines[] = '- ' . $q . ' | clicks ' . (int) ( $row['clicks'] ?? 0 ) . ' | impressions ' . (int) ( $row['impressions'] ?? 0 );
			$rows[]  = $row;
		}
		if ( count( $queries ) === 0 ) {
			$lines[] = 'No queries for this page in the period.';
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $rows,
		);
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>} */
	public static function tool_gsc_performance_summary( array $body, array $params, string $message ): array {
		$site_url = self::resolve_site_url( $body, $params, $message );
		if ( $site_url === '' ) {
			return array( 'ok' => false, 'note' => 'No siteUrl for GSC performance summary.' );
		}
		$current = self::resolve_gsc_dates( $params );
		$compare = self::resolve_compare_dates( $params, $current );
		$result  = Neo_Pulse_App_Gsc_Performance::fetch_performance_stats(
			array(
				'siteUrl'          => $site_url,
				'startDate'        => $current['startDate'],
				'endDate'          => $current['endDate'],
				'compareStartDate' => $compare['compareStartDate'],
				'compareEndDate'   => $compare['compareEndDate'],
			)
		);
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GSC performance summary failed.',
			);
		}
		$stats = isset( $body_data['stats'] ) && is_array( $body_data['stats'] ) ? $body_data['stats'] : array();
		$cur   = isset( $stats['currentPeriod'] ) && is_array( $stats['currentPeriod'] ) ? $stats['currentPeriod'] : array();
		$cmp   = isset( $stats['comparisonPeriod'] ) && is_array( $stats['comparisonPeriod'] ) ? $stats['comparisonPeriod'] : array();
		$lines = array(
			'Current: ' . (string) ( $cur['startDate'] ?? $current['startDate'] ) . ' to ' . (string) ( $cur['endDate'] ?? $current['endDate'] ),
			'Clicks ' . (int) ( $cur['clicks'] ?? 0 ) . ' | Impressions ' . (int) ( $cur['impressions'] ?? 0 ) . ' | CTR ' . round( (float) ( $cur['ctr'] ?? 0 ) * 100, 2 ) . '%',
			'Compare: ' . (string) ( $cmp['startDate'] ?? $compare['compareStartDate'] ) . ' to ' . (string) ( $cmp['endDate'] ?? $compare['compareEndDate'] ),
			'Clicks ' . (int) ( $cmp['clicks'] ?? 0 ) . ' | Impressions ' . (int) ( $cmp['impressions'] ?? 0 ),
		);
		return array(
			'ok'    => true,
			'lines' => $lines,
		);
	}

	/**
	 * @param array<string,mixed>              $body
	 * @param array<int,array<string,mixed>>   $pages
	 * @return array<int,array<string,mixed>>
	 */
	public static function enrich_pages_with_inventory( array $body, array $pages ): array {
		$url_map = self::inventory_url_map( $body );
		if ( count( $url_map ) === 0 ) {
			return $pages;
		}
		$out = array();
		foreach ( $pages as $page ) {
			if ( ! is_array( $page ) ) {
				continue;
			}
			$url = (string) ( $page['url'] ?? '' );
			if ( $url !== '' && empty( $page['title'] ) ) {
				$norm = self::normalize_page_url( $url );
				if ( isset( $url_map[ $norm ]['title'] ) ) {
					$page['title'] = (string) $url_map[ $norm ]['title'];
				}
			}
			$out[] = $page;
		}
		return $out;
	}

	public static function configured(): bool {
		$creds = Neo_Pulse_App_Gsc_Service_Account::get_credentials();
		return ! is_wp_error( $creds );
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 */
	public static function format_blog_performers_table( array $rows ): string {
		if ( count( $rows ) === 0 ) {
			return '';
		}
		$table = array(
			'| Blog | Clicks | Impressions | Position | CTR |',
			'| --- | ---: | ---: | ---: | ---: |',
		);
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$title = (string) ( $row['title'] ?? '' );
			$url   = (string) ( $row['url'] ?? '' );
			$ctr   = isset( $row['ctr'] ) ? (float) $row['ctr'] : self::page_ctr( $row );
			$table[] = '| ' . self::page_link_label( $title, $url )
				. ' | ' . (int) ( $row['clicks'] ?? 0 )
				. ' | ' . (int) ( $row['impressions'] ?? 0 )
				. ' | ' . round( (float) ( $row['position'] ?? 0 ), 1 )
				. ' | ' . (string) ( $row['ctrPercent'] ?? self::ctr_percent_label( $ctr ) )
				. ' |';
		}
		return implode( "\n", $table );
	}

	/** @param array<string,mixed> $page */
	private static function page_ctr( array $page ): float {
		if ( isset( $page['ctr'] ) && (float) $page['ctr'] > 0 ) {
			return round( (float) $page['ctr'], 4 );
		}
		$clicks      = (int) ( $page['clicks'] ?? 0 );
		$impressions = (int) ( $page['impressions'] ?? 0 );
		if ( $impressions <= 0 ) {
			return 0.0;
		}
		return round( $clicks / $impressions, 4 );
	}

	private static function ctr_percent_label( float $ctr ): string {
		return round( $ctr * 100, 2 ) . '%';
	}

	private static function page_link_label( string $title, string $url ): string {
		$url = esc_url_raw( trim( $url ) );
		if ( $url === '' ) {
			return $title !== '' ? $title : 'Unknown page';
		}
		$label = $title !== '' ? str_replace( array( '[', ']' ), '', $title ) : $url;
		return '[' . $label . '](' . $url . ')';
	}

	/**
	 * @param array{statusCode:int,body:array<string,mixed>} $result
	 * @param array{startDate:string,endDate:string}         $dates
	 * @return array{ok:bool,note?:string,lines?:array<int,string>,rows?:array<int,array<string,mixed>>}
	 */
	private static function gsc_queries_result( array $result, array $dates ): array {
		$body_data = isset( $result['body'] ) && is_array( $result['body'] ) ? $result['body'] : array();
		if ( empty( $body_data['success'] ) ) {
			return array(
				'ok'   => false,
				'note' => isset( $body_data['error'] ) ? (string) $body_data['error'] : 'GSC queries failed.',
			);
		}
		$queries = isset( $body_data['queries'] ) && is_array( $body_data['queries'] ) ? array_slice( $body_data['queries'], 0, self::MAX_GSC_ROWS ) : array();
		$lines   = array( 'Period: ' . $dates['startDate'] . ' to ' . $dates['endDate'] );
		$rows    = array();
		foreach ( $queries as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$q       = (string) ( $row['query'] ?? '' );
			$lines[] = '- ' . $q . ' | clicks ' . (int) ( $row['clicks'] ?? 0 ) . ' | impressions ' . (int) ( $row['impressions'] ?? 0 ) . ' | pos ' . round( (float) ( $row['position'] ?? 0 ), 1 );
			$rows[]  = $row;
		}
		if ( count( $queries ) === 0 ) {
			$lines[] = 'No queries in this period.';
		}
		return array(
			'ok'    => true,
			'lines' => $lines,
			'rows'  => $rows,
		);
	}

	/** @param array<string,mixed> $body @return array<string,array<string,mixed>> */
	private static function inventory_url_map( array $body ): array {
		if ( ! Neo_Pulse_App_Platform_Inventory::inventory_configured( $body ) ) {
			return array();
		}
		$resolved = Neo_Pulse_App_Platform_Inventory::resolve_for_subagent(
			$body,
			array(
				'post_type' => 'post',
				'limit'     => self::INVENTORY_JOIN_LIMIT,
				'sort'      => 'date_desc',
			)
		);
		$map = array();
		foreach ( $resolved['rows'] as $row ) {
			if ( ! is_array( $row ) || empty( $row['url'] ) ) {
				continue;
			}
			$map[ self::normalize_page_url( (string) $row['url'] ) ] = $row;
		}
		return $map;
	}

	private static function is_blog_url( string $url ): bool {
		$path = strtolower( (string) ( wp_parse_url( $url, PHP_URL_PATH ) ?? '' ) );
		return str_contains( $path, '/blog/' )
			|| str_contains( $path, '/posts/' )
			|| str_contains( $path, '/article/' );
	}

	private static function normalize_page_url( string $url ): string {
		$url = esc_url_raw( trim( $url ) );
		if ( $url === '' ) {
			return '';
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return rtrim( strtolower( $url ), '/' );
		}
		$host = strtolower( (string) $parts['host'] );
		if ( str_starts_with( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		$path = isset( $parts['path'] ) ? rtrim( strtolower( (string) $parts['path'] ), '/' ) : '';
		$scheme = isset( $parts['scheme'] ) ? strtolower( (string) $parts['scheme'] ) : 'https';
		return $scheme . '://' . $host . $path;
	}

	/** @param array<string,mixed> $body @param array<string,mixed> $params */
	private static function resolve_site_url( array $body, array $params, string $message ): string {
		if ( ! empty( $params['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $params['siteUrl'] ) );
		}

		$ctx   = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : array();
		$props = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$msg   = strtolower( $message );

		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['name'] ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			$name = strtolower( trim( (string) $prop['name'] ) );
			if ( $name !== '' && $msg !== '' && strpos( $msg, $name ) !== false ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		$active_id = isset( $ctx['activePropertyId'] ) ? sanitize_text_field( (string) $ctx['activePropertyId'] ) : '';
		foreach ( $props as $prop ) {
			if ( ! is_array( $prop ) || empty( $prop['siteUrl'] ) ) {
				continue;
			}
			if ( $active_id !== '' && isset( $prop['id'] ) && sanitize_text_field( (string) $prop['id'] ) === $active_id ) {
				return esc_url_raw( trim( (string) $prop['siteUrl'] ) );
			}
		}

		if ( ! empty( $body['siteUrl'] ) ) {
			return esc_url_raw( trim( (string) $body['siteUrl'] ) );
		}

		return '';
	}

	/** @param array<string,mixed> $params */
	private static function resolve_gsc_dates( array $params ): array {
		$def = self::default_gsc_dates();
		return array(
			'startDate' => ! empty( $params['startDate'] ) ? sanitize_text_field( (string) $params['startDate'] ) : $def['startDate'],
			'endDate'   => ! empty( $params['endDate'] ) ? sanitize_text_field( (string) $params['endDate'] ) : $def['endDate'],
		);
	}

	/** @param array<string,mixed> $params @param array{startDate:string,endDate:string} $current */
	private static function resolve_compare_dates( array $params, array $current ): array {
		if ( ! empty( $params['compareStartDate'] ) && ! empty( $params['compareEndDate'] ) ) {
			return array(
				'compareStartDate' => sanitize_text_field( (string) $params['compareStartDate'] ),
				'compareEndDate'   => sanitize_text_field( (string) $params['compareEndDate'] ),
			);
		}
		return self::default_compare_dates( $current );
	}

	/** @return array{startDate:string,endDate:string} */
	private static function default_gsc_dates(): array {
		$end = new DateTimeImmutable( '-3 days', new DateTimeZone( 'UTC' ) );
		return array(
			'startDate' => $end->modify( '-27 days' )->format( 'Y-m-d' ),
			'endDate'   => $end->format( 'Y-m-d' ),
		);
	}

	/** @param array{startDate:string,endDate:string} $current @return array{compareStartDate:string,compareEndDate:string} */
	private static function default_compare_dates( array $current ): array {
		$start     = new DateTimeImmutable( $current['startDate'], new DateTimeZone( 'UTC' ) );
		$end       = new DateTimeImmutable( $current['endDate'], new DateTimeZone( 'UTC' ) );
		$days      = (int) $start->diff( $end )->days + 1;
		$cmp_end   = $start->modify( '-1 day' );
		$cmp_start = $cmp_end->modify( '-' . ( $days - 1 ) . ' days' );
		return array(
			'compareStartDate' => $cmp_start->format( 'Y-m-d' ),
			'compareEndDate'   => $cmp_end->format( 'Y-m-d' ),
		);
	}
}

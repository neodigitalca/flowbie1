<?php
/**
 * SEO research brief builder — DataForSEO + GSC + Semrush directly from WordPress (no Flow API hop).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Seo_Research {

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function build_brief( int $post_id, string $focus_keyword_override = '', bool $auto_save = true ) {
		$focus = trim( $focus_keyword_override );
		if ( $focus === '' ) {
			$focus = trim( Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id ) );
		}
		if ( $focus === '' ) {
			return new WP_Error(
				'flowbie_research_no_keyword',
				__( 'Set a focus keyword before running SEO research.', 'flowbie-wp' )
			);
		}

		$urls = Flowbie_Wp_Ai_Backend::resolve_urls( $post_id );
		if ( $urls['pageUrl'] === '' ) {
			return new WP_Error(
				'flowbie_research_no_url',
				__( 'No page URL available for SEO research.', 'flowbie-wp' )
			);
		}

		if ( ! Flowbie_Wp_Research_Keys::research_configured() ) {
			return new WP_Error(
				'flowbie_research_keys_missing',
				__( 'DataForSEO credentials are not configured. Add your login and API password under Flowbie WP → Settings.', 'flowbie-wp' )
			);
		}

		$cache_key = 'flowbie_wp_seo_brief_' . md5( $post_id . '|' . $focus . '|' . $urls['pageUrl'] );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && ! empty( $cached['ok'] ) && ! empty( $cached['seoResearch'] ) ) {
			return $cached;
		}

		$warnings = array();
		$steps    = array();

		$serp = Flowbie_Wp_Dataforseo::fetch_serp_organic_live_advanced( $focus );
		if ( is_wp_error( $serp ) ) {
			return $serp;
		}
		$steps[] = 'dataforseo_serp';

		$semrush_payload = Flowbie_Wp_Semrush::fetch_bulk_enrichment(
			array(
				'pageUrl'     => $urls['pageUrl'],
				'seedKeyword' => $focus,
			)
		);
		if ( ! empty( $semrush_payload['skipped'] ) ) {
			$warnings[] = 'semrush_not_configured';
		} elseif ( ! empty( $semrush_payload['errors'] ) ) {
			$warnings = array_merge( $warnings, $semrush_payload['errors'] );
		} else {
			$steps[] = 'semrush_enrichment';
		}
		unset( $semrush_payload['skipped'], $semrush_payload['reason'], $semrush_payload['errors'] );

		$gsc_context = self::gsc_queries_for_brief( $urls['pageUrl'] );
		if ( ! empty( $gsc_context['warning'] ) ) {
			$warnings[] = $gsc_context['warning'];
		} elseif ( ! empty( $gsc_context['queries'] ) ) {
			$steps[] = 'gsc_page_queries';
		}

		$semrush_overview = array(
			'pageUrl'     => $urls['pageUrl'],
			'seedKeyword' => $focus,
			'semrush'     => $semrush_payload,
		);

		$merged = Flowbie_Wp_Seo_Brief_Merge::build_merged_brief(
			array(
				'serpDumpJson'        => $serp,
				'pageUrl'             => $urls['pageUrl'],
				'focusKeyword'        => $focus,
				'gscPageUrl'          => $urls['pageUrl'],
				'gscQueries'          => $gsc_context['queries'],
				'semrushOverviewJson' => $semrush_overview,
			)
		);

		$brief_json = wp_json_encode( $merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		$steps[]    = 'brief_merge';

		$saved = array();
		if ( $auto_save && $brief_json !== '' ) {
			$written = Flowbie_Wp_Ai_Apply::write_field( $post_id, 'seo_research', $brief_json );
			if ( is_wp_error( $written ) ) {
				return $written;
			}
			$saved   = is_array( $written ) ? $written : array( 'seo_research' );
			$steps[] = 'acf_save';
		}

		$payload = array(
			'ok'          => true,
			'post_id'     => $post_id,
			'seoResearch' => $brief_json,
			'saved'       => $saved,
			'meta'        => array(
				'source'   => 'direct',
				'warnings' => array_values( array_unique( array_filter( $warnings ) ) ),
				'steps'    => $steps,
			),
		);

		set_transient( $cache_key, $payload, 30 * MINUTE_IN_SECONDS );

		return $payload;
	}

	/**
	 * @return array{queries: string[], warning?: string}
	 */
	public static function gsc_queries_for_brief( string $page_url ): array {
		$empty = array( 'queries' => array() );
		if ( ! class_exists( 'Flowbie_Wp_Gsc', false ) ) {
			return array_merge( $empty, array( 'warning' => 'gsc_unavailable' ) );
		}
		if ( ! class_exists( 'Flowbie_Wp_Gsc_Prompt', false ) || ! Flowbie_Wp_Gsc_Prompt::is_available() ) {
			return array_merge( $empty, array( 'warning' => 'gsc_not_configured' ) );
		}

		$page_data = Flowbie_Wp_Gsc::fetch_page_queries( $page_url );
		if ( is_wp_error( $page_data ) ) {
			return array_merge( $empty, array( 'warning' => 'gsc_fetch_failed' ) );
		}

		$queries = array();
		if ( ! empty( $page_data['queries'] ) && is_array( $page_data['queries'] ) ) {
			foreach ( array_slice( $page_data['queries'], 0, 25 ) as $row ) {
				if ( is_array( $row ) && ! empty( $row['query'] ) ) {
					$queries[] = trim( (string) $row['query'] );
				} elseif ( is_string( $row ) && trim( $row ) !== '' ) {
					$queries[] = trim( $row );
				}
			}
		}

		$seen = array();
		$out  = array();
		foreach ( $queries as $q ) {
			$k = strtolower( $q );
			if ( isset( $seen[ $k ] ) ) {
				continue;
			}
			$seen[ $k ] = true;
			$out[]      = $q;
		}

		if ( $out === array() ) {
			return array_merge( $empty, array( 'warning' => 'gsc_no_queries_for_page' ) );
		}

		return array( 'queries' => $out );
	}
}

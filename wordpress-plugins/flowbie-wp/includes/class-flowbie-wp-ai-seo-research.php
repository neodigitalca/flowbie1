<?php
/**
 * SEO research brief builder — DataForSEO + Semrush directly from WordPress (no Flow API hop).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Seo_Research {

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function build_brief( int $post_id, string $focus_keyword_override = '' ) {
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

		$serp = Flowbie_Wp_Dataforseo::fetch_serp_organic_live_advanced( $focus );
		if ( is_wp_error( $serp ) ) {
			return $serp;
		}

		$semrush_payload = Flowbie_Wp_Semrush::fetch_overview_enrichment( $urls['pageUrl'], $focus );
		if ( ! empty( $semrush_payload['errors'] ) ) {
			$warnings = array_merge( $warnings, $semrush_payload['errors'] );
		}
		unset( $semrush_payload['errors'] );

		$semrush_overview = array(
			'pageUrl'      => $urls['pageUrl'],
			'seedKeyword'  => $focus,
			'semrush'      => $semrush_payload,
		);

		$merged = Flowbie_Wp_Seo_Brief_Merge::build_merged_brief(
			array(
				'serpDumpJson'        => $serp,
				'pageUrl'             => $urls['pageUrl'],
				'focusKeyword'        => $focus,
				'gscPageUrl'          => $urls['pageUrl'],
				'gscQueries'          => array(),
				'semrushOverviewJson' => $semrush_overview,
			)
		);

		$payload = array(
			'ok'          => true,
			'seoResearch' => wp_json_encode( $merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ),
			'meta'        => array(
				'source'   => 'direct',
				'warnings' => array_values( array_unique( array_filter( $warnings ) ) ),
			),
		);

		set_transient( $cache_key, $payload, 30 * MINUTE_IN_SECONDS );

		return $payload;
	}
}

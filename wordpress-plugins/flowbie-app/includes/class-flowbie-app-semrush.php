<?php
/**
 * Semrush Analytics API for SEO research briefs (Flowbie App facade).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Semrush {

	/**
	 * @return array<string,mixed>
	 */
	public static function fetch_overview_enrichment( string $page_url, string $seed_keyword, string $database = 'us' ): array {
		$result = Flowbie_App_Semrush_Bulk_Enrichment::run(
			array(
				'pageUrl'     => $page_url,
				'seedKeyword' => $seed_keyword,
				'database'    => $database,
			)
		);

		if ( ! empty( $result['skipped'] ) ) {
			$result['errors'] = array( 'semrush_not_configured' );
		} elseif ( ! empty( $result['errors'] ) ) {
			$flat = array();
			foreach ( $result['errors'] as $err ) {
				if ( is_array( $err ) && isset( $err['step'], $err['message'] ) ) {
					$flat[] = $err['step'] . ':' . $err['message'];
				}
			}
			$result['errors'] = $flat;
		} else {
			$result['errors'] = array();
		}

		unset( $result['skipped'], $result['reason'], $result['keywordOverview'] );

		return $result;
	}
}

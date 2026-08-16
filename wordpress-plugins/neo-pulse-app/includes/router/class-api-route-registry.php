<?php
/**
 * Visible-tab route registry (parity checklist source).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Api_Route_Registry {

	/**
	 * @return array<int,array{method:string,path:string}>
	 */
	public static function visible_tab_routes(): array {
		return array(
			array( 'method' => 'POST', 'path' => 'wordpress/test-connection' ),
			array( 'method' => 'POST', 'path' => 'wordpress/bulk-update-overview-seo' ),
			array( 'method' => 'POST', 'path' => 'wordpress/discover-acf-field-groups' ),
			array( 'method' => 'POST', 'path' => 'gsc/fetch-reporting-bundle' ),
			array( 'method' => 'POST', 'path' => 'gsc/fetch-pages-performance' ),
			array( 'method' => 'POST', 'path' => 'gsc/top-pages' ),
			array( 'method' => 'POST', 'path' => 'overview/optimize-meta-ai' ),
			array( 'method' => 'POST', 'path' => 'dataforseo/competitor-research' ),
			array( 'method' => 'POST', 'path' => 'semrush/competitor-research' ),
			array( 'method' => 'POST', 'path' => 'proposal/site-audit' ),
			array( 'method' => 'POST', 'path' => 'seo/discover-locations' ),
			array( 'method' => 'GET', 'path' => 'vertical-benchmarks/taxonomy' ),
			array( 'method' => 'GET', 'path' => 'ga/credentials-status' ),
			array( 'method' => 'GET', 'path' => 'gmb/config-status' ),
			array( 'method' => 'GET', 'path' => 'gmb/authorize' ),
			array( 'method' => 'POST', 'path' => 'gmb/performance' ),
			array( 'method' => 'POST', 'path' => 'knowledge-model/auto-graph' ),
			array( 'method' => 'POST', 'path' => 'site-scraper/scrape' ),
		);
	}

	/**
	 * @return array<int,array{method:string,path:string}>
	 */
	public static function phase1_routes(): array {
		return self::visible_tab_routes();
	}
}

<?php
/**
 * SeoContentBriefV1 merge parity test (PHP merge vs app shape).
 *
 * @package Flowbie_Wp
 */

define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-seo-brief-merge.php';

$serp_fixture = array(
	'tasks' => array(
		array(
			'data'   => array( 'keyword' => 'window coverings' ),
			'result' => array(
				array(
					'items' => array(
						array(
							'type'          => 'organic',
							'rank_absolute' => 1,
							'rank_group'    => 1,
							'domain'        => 'example.com',
							'url'           => 'https://example.com/window-coverings',
							'title'         => 'Window Coverings Guide',
							'description'   => 'Learn about blinds and shades.',
						),
						array(
							'type'  => 'people_also_ask',
							'title' => 'What are the best window coverings?',
						),
					),
				),
			),
		),
	),
);

$semrush_fixture = array(
	'pageUrl'     => 'https://example.com/window-coverings',
	'seedKeyword' => 'window coverings',
	'semrush'     => array(
		'urlOrganicKeywords'    => array( 'blinds', 'shades' ),
		'phraseRelatedKeywords' => array( 'curtains', 'drapes' ),
		'urlOrganicUrls'        => array( 'https://competitor.com/blinds' ),
		'phraseRelatedUrls'     => array( 'https://competitor.com/curtains' ),
		'phraseOrganicUrls'     => array( 'https://competitor.com/window-treatments' ),
		'externalSemrushUrls'   => array( 'https://competitor.com/blinds', 'https://competitor.com/curtains' ),
	),
);

$gsc_queries = array( 'window coverings ideas', 'best window treatments' );

$merged = Flowbie_Wp_Seo_Brief_Merge::build_merged_brief(
	array(
		'serpDumpJson'        => $serp_fixture,
		'pageUrl'             => 'https://example.com/window-coverings',
		'focusKeyword'        => 'window coverings',
		'gscPageUrl'          => 'https://example.com/window-coverings',
		'gscQueries'          => $gsc_queries,
		'semrushOverviewJson' => $semrush_fixture,
	)
);

$top_keys = array( 'version', 'generatedAt', 'focusKeyword', 'pageUrl', 'dataforseo', 'gsc', 'semrush' );
foreach ( $top_keys as $key ) {
	assert( array_key_exists( $key, $merged ), 'missing top-level key: ' . $key );
}

assert( 1 === $merged['version'], 'version must be 1' );
assert( 'window coverings' === $merged['focusKeyword'], 'focusKeyword preserved' );
assert( ! empty( $merged['dataforseo']['organic'] ), 'dataforseo organic populated' );
assert( $gsc_queries === $merged['gsc']['queries'], 'gsc queries preserved' );

$semrush_keys = array(
	'urlOrganicKeywords',
	'phraseRelatedKeywords',
	'urlOrganicUrls',
	'phraseRelatedUrls',
	'phraseOrganicUrls',
	'externalSemrushUrls',
);
foreach ( $semrush_keys as $key ) {
	assert( array_key_exists( $key, $merged['semrush'] ), 'missing semrush key: ' . $key );
	assert( ! empty( $merged['semrush'][ $key ] ), 'semrush array empty: ' . $key );
}

$extracted = Flowbie_Wp_Seo_Brief_Merge::extract_semrush_brief( $semrush_fixture );
foreach ( $semrush_keys as $key ) {
	assert( ! empty( $extracted[ $key ] ), 'extract_semrush_brief empty: ' . $key );
}

echo "test-seo-brief-merge-parity: OK\n";

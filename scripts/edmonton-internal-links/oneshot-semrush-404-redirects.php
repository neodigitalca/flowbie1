$maps = array(
	array(
		'source'      => '/blog/seo-partner/',
		'destination' => '/blog/edmonton-seo-partner/',
		'fallback'    => '/edmonton-seo/',
	),
	array(
		'source'      => '/blog/blinds-marketing-agency/',
		'destination' => '/blog/blinds-marketing-edmonton/',
		'fallback'    => '/window-coverings-marketing/',
	),
	array(
		'source'      => '/blog/local-seo-blinds-companies/',
		'destination' => '/blog/local-seo-for-blinds-companies/',
		'fallback'    => '/window-coverings-marketing/',
	),
	array(
		'source'      => '/blog/window-treatment-seo-guide/',
		'destination' => '/blog/seo-for-window-treatments/',
		'fallback'    => '/window-coverings-marketing/',
	),
);

$lookup = static function ( string $path ) {
	$path = trim( $path, '/' );
	if ( $path === '' ) {
		return 0;
	}
	if ( strpos( $path, 'blog/' ) === 0 ) {
		$slug = substr( $path, 5 );
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		return ( $post instanceof WP_Post ) ? (int) $post->ID : 0;
	}
	$page = get_page_by_path( $path, OBJECT, array( 'page', 'post' ) );
	return ( $page instanceof WP_Post ) ? (int) $page->ID : 0;
};

if ( ! class_exists( 'Neo_Pulse_Wp_Redirects' ) ) {
	echo wp_json_encode( array( 'error' => 'Neo_Pulse_Wp_Redirects missing' ) );
	return;
}

Neo_Pulse_Wp_Redirects::install();

$rows   = array();
$report = array();
foreach ( $maps as $map ) {
	$dest_id = $lookup( $map['destination'] );
	$dest    = $map['destination'];
	if ( $dest_id < 1 ) {
		$dest_id = $lookup( $map['fallback'] );
		$dest    = $map['fallback'];
	}
	$src_id = $lookup( $map['source'] );
	$item   = array(
		'source'      => $map['source'],
		'destination' => $dest,
		'source_id'   => $src_id,
		'dest_id'     => $dest_id,
	);
	if ( $dest_id < 1 ) {
		$item['skipped'] = 'destination missing';
		$report[]        = $item;
		continue;
	}
	$rows[]   = array(
		'source'      => $map['source'],
		'destination' => $dest,
		'type'        => 301,
		'category'    => 'Semrush 404',
		'status'      => 'active',
		'matching'    => 'exact',
	);
	$report[] = $item;
}

$stats = empty( $rows )
	? array( 'added' => 0, 'updated' => 0, 'skipped' => 0 )
	: Neo_Pulse_Wp_Redirects::merge_import( $rows );

if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
	Neo_Pulse_Wp_Cache_Flush::flush_all();
}

echo wp_json_encode(
	array(
		'ok'     => true,
		'stats'  => $stats,
		'report' => $report,
	)
);

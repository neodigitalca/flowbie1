$maps = array(
	array(
		'source'      => '/blog/edmonton-seo-services/',
		'destination' => '/edmonton-seo/',
		'draft_id'    => 8665,
	),
	array(
		'source'      => '/blog/seo-edmonton/',
		'destination' => '/edmonton-seo/',
		'draft_id'    => 8693,
	),
	array(
		'source'      => '/blog/seo-partner/',
		'destination' => '/blog/edmonton-seo-partner/',
		'draft_id'    => 8654,
	),
);

if ( ! class_exists( 'Neo_Pulse_Wp_Redirects' ) ) {
	echo wp_json_encode( array( 'error' => 'Neo_Pulse_Wp_Redirects missing' ) );
	return;
}

Neo_Pulse_Wp_Redirects::install();

$drafted = array();
foreach ( $maps as $map ) {
	$id = (int) $map['draft_id'];
	$post = get_post( $id );
	if ( $post instanceof WP_Post && $post->post_status === 'publish' ) {
		wp_update_post(
			array(
				'ID'          => $id,
				'post_status' => 'draft',
			)
		);
		$drafted[] = $id;
	}
}

$rows = array();
foreach ( $maps as $map ) {
	$rows[] = array(
		'source'      => $map['source'],
		'destination' => $map['destination'],
		'type'        => 301,
		'category'    => 'Edmonton SEO head term',
		'status'      => 'active',
		'matching'    => 'exact',
	);
}

$stats = Neo_Pulse_Wp_Redirects::merge_import( $rows );

if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
	Neo_Pulse_Wp_Cache_Flush::flush_all();
}

echo wp_json_encode(
	array(
		'ok'      => true,
		'drafted' => $drafted,
		'stats'   => $stats,
		'maps'    => $maps,
	)
);

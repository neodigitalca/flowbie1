$raw = get_post_meta( 10203, '_elementor_data', true );
$checks = array(
	'personas' => is_string( $raw ) && ( strpos( $raw, 'Clinic owner' ) !== false || strpos( $raw, 'Retail manager' ) !== false ),
	'blind'    => is_string( $raw ) && strpos( $raw, 'Blind Magic' ) !== false,
	'facts'    => is_string( $raw ) && strpos( $raw, 'Edmonton SEO facts (September 2026)' ) !== false,
	'schema'   => is_string( $raw ) && strpos( $raw, 'ProfessionalService' ) !== false && strpos( $raw, 'FAQPage' ) !== false,
	'nap'      => is_string( $raw ) && strpos( $raw, '587-416-4130' ) !== false,
);

$urls = array(
	'llms'    => home_url( '/llms.txt' ),
	'index'   => home_url( '/sitemap_index.xml' ),
	'pages'   => home_url( '/page-sitemap.xml' ),
	'posts'   => home_url( '/post-sitemap.xml' ),
	'money'   => home_url( '/edmonton-seo/?nonitro=1' ),
	'gmb'     => home_url( '/api/gmb/config-status' ),
	'gmbstat' => home_url( '/api/gmb/status' ),
);
$http = array();
foreach ( $urls as $key => $url ) {
	$res = wp_remote_get(
		$url,
		array(
			'timeout'     => 20,
			'redirection' => 0,
			'sslverify'   => false,
		)
	);
	if ( is_wp_error( $res ) ) {
		$http[ $key ] = array( 'error' => $res->get_error_message() );
		continue;
	}
	$body = (string) wp_remote_retrieve_body( $res );
	$http[ $key ] = array(
		'status' => (int) wp_remote_retrieve_response_code( $res ),
		'len'    => strlen( $body ),
		'head'   => substr( $body, 0, 180 ),
	);
}

echo wp_json_encode( array( 'ok' => true, 'meta' => $checks, 'http' => $http ) );

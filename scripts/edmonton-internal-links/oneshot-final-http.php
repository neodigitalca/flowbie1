$urls = array(
	'llms'    => home_url( '/llms.txt' ),
	'money'   => home_url( '/edmonton-seo/?nonitro=1' ),
	'contact' => home_url( '/contact/?nonitro=1' ),
	'index'   => home_url( '/sitemap_index.xml' ),
	'pages'   => home_url( '/page-sitemap.xml' ),
);
$http = array();
foreach ( $urls as $key => $url ) {
	$res = wp_remote_get( $url, array( 'timeout' => 25, 'sslverify' => false, 'redirection' => 2 ) );
	if ( is_wp_error( $res ) ) {
		$http[ $key ] = array( 'error' => $res->get_error_message() );
		continue;
	}
	$body = (string) wp_remote_retrieve_body( $res );
	$http[ $key ] = array(
		'status'   => (int) wp_remote_retrieve_response_code( $res ),
		'facts'    => strpos( $body, 'Edmonton SEO facts (September 2026)' ) !== false,
		'clinic'   => strpos( $body, 'Clinic owner' ) !== false,
		'blind'    => strpos( $body, '4,066' ) !== false,
		'schema'   => strpos( $body, 'ProfessionalService' ) !== false,
		'nap'      => strpos( $body, '587-416-4130' ) !== false || strpos( $body, '587.416.4130' ) !== false,
		'recommended_first' => preg_match( '/## Recommended[\s\S]{0,80}edmonton-seo/', $body ) === 1,
		'head'     => substr( wp_strip_all_tags( $body ), 0, 160 ),
	);
}
echo wp_json_encode( array( 'ok' => true, 'http' => $http ) );

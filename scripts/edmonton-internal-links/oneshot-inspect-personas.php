$raw = get_post_meta( 10203, '_elementor_data', true );
$needles = array( 'Clinic owner', 'Home services owner', 'Retail manager', 'Professional services lead', 'Edmonton healthcare', 'Edmonton trades', 'Edmonton firm', 'Edmonton storefront' );
$hits = array();
foreach ( $needles as $n ) {
	$hits[ $n ] = is_string( $raw ) && strpos( $raw, $n ) !== false;
}
$schema = is_string( $raw ) && ( strpos( $raw, 'FAQPage' ) !== false || strpos( $raw, 'ProfessionalService' ) !== false );
echo wp_json_encode(
	array(
		'ok'     => true,
		'hits'   => $hits,
		'schema' => $schema,
		'proof'  => is_string( $raw ) && strpos( $raw, '4,066' ) !== false,
		'facts'  => is_string( $raw ) && strpos( $raw, 'Edmonton SEO facts (September 2026)' ) !== false,
	)
);

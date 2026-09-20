$connected = false;
$location  = '';
$account   = '';
$token_ok  = false;
if ( class_exists( 'Neo_Pulse_Wp_Gmb' ) ) {
	$location = (string) get_option( Neo_Pulse_Wp_Gmb::OPTION_LOCATION_ID, '' );
	$account  = (string) get_option( Neo_Pulse_Wp_Gmb::OPTION_ACCOUNT_ID, '' );
	$tokens   = get_option( Neo_Pulse_Wp_Gmb::OPTION_TOKENS, array() );
	$token_ok = is_array( $tokens ) && ! empty( $tokens['refresh_token'] );
	$connected = $location !== '' && $token_ok;
}

if ( ! $connected ) {
	echo wp_json_encode(
		array(
			'ok'        => true,
			'connected' => false,
			'blocker'   => 'Google Business Profile is not connected on neodigital.ca. Location or refresh token missing. No GBP post published.',
			'location'  => $location !== '',
			'token_ok'  => $token_ok,
		)
	);
	return;
}

$summary = 'Edmonton SEO from Neo Digital. Blind Magic Search Console: site clicks 4,066 to 11,382, impressions 460k to 1.16M, average position 31.5 to 20.0. See the city program.';
$result  = Neo_Pulse_Wp_Gmb::create_local_post( $summary, home_url( '/edmonton-seo/' ) );
if ( is_wp_error( $result ) ) {
	echo wp_json_encode(
		array(
			'ok'        => true,
			'connected' => true,
			'published' => false,
			'error'     => $result->get_error_message(),
		)
	);
	return;
}

echo wp_json_encode(
	array(
		'ok'        => true,
		'connected' => true,
		'published' => true,
		'result'    => $result,
	)
);

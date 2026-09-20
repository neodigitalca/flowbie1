$lines = array( 'User-agent: *' );
if ( class_exists( 'Neo_Pulse_Wp_Robots_Txt' ) ) {
	foreach ( Neo_Pulse_Wp_Robots_Txt::shared_disallow_lines() as $rule ) {
		$lines[] = $rule;
	}
	$lines[] = '';
	$lines[] = Neo_Pulse_Wp_Robots_Txt::sitemap_line();
	Neo_Pulse_Wp_Robots_Txt::save_content( implode( "\n", $lines ) );
}
echo wp_json_encode( array( 'ok' => true, 'robots' => 'star-only' ) );

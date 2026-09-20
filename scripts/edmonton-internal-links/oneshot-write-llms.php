$home = rtrim( (string) home_url(), '/' );
$lines = array(
	'# Neo Digital',
	'',
	'Edmonton SEO facts (September 2026): typical retainers $1,500 to $3,500 a month. Google Business Profile can move in weeks. Competitive local pack terms take months. Blind Magic site clicks 4,066 to 11,382. Neo Digital does not run a national city-SEO factory.',
	'',
	'Edmonton website design, SEO, and paid media for growing brands.',
	'',
	'## Recommended',
	'',
	'- [Edmonton SEO](' . $home . '/edmonton-seo/)',
	'',
	'## Pages',
	'',
	'- [Edmonton SEO](' . $home . '/edmonton-seo/)',
	'- [Home](' . $home . '/)',
	'- [About](' . $home . '/about/)',
	'- [Our Services](' . $home . '/our-services/)',
	'- [Our Work](' . $home . '/our-work/)',
	'- [Blog](' . $home . '/blog/)',
	'- [Contact](' . $home . '/contact/)',
	'- [Website Design](' . $home . '/website-design/)',
	'- [Local SEO](' . $home . '/local-seo/)',
	'- [AISEO](' . $home . '/aiseo/)',
	'- [Generative Engine Optimization](' . $home . '/aiseo/generative-engine-optimization/)',
	'- [AI SEO Audit](' . $home . '/aiseo/ai-seo-audit/)',
	'- [NEO Pulse](' . $home . '/neo-pulse-platform/)',
	'- [Google Ads](' . $home . '/google-ads/)',
	'',
);
$content = implode( "\n", $lines );
if ( class_exists( 'Neo_Pulse_Wp_Llms_Txt' ) && method_exists( 'Neo_Pulse_Wp_Llms_Txt', 'save_content' ) ) {
	Neo_Pulse_Wp_Llms_Txt::save_content( $content );
	$how = 'save_content';
} else {
	update_option( 'neo_pulse_wp_llms_txt', array( 'content' => $content ) );
	$how = 'update_option';
}
if ( class_exists( 'Neo_Pulse_Wp_Llms_Txt' ) && method_exists( 'Neo_Pulse_Wp_Llms_Txt', 'flush_rewrites' ) ) {
	Neo_Pulse_Wp_Llms_Txt::flush_rewrites();
}
echo wp_json_encode(
	array(
		'ok'      => true,
		'how'     => $how,
		'len'     => strlen( $content ),
		'has_seo' => strpos( $content, '/edmonton-seo/' ) !== false,
	)
);

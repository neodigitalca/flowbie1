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
update_option( 'neo_pulse_wp_llms_txt', array( 'content' => $content ) );
$file = ABSPATH . 'llms.txt';
$wrote_file = false;
if ( file_exists( $file ) || is_writable( ABSPATH ) ) {
	$wrote_file = false !== file_put_contents( $file, $content );
}
echo wp_json_encode(
	array(
		'ok'         => true,
		'wrote_file' => $wrote_file,
		'file'       => $file,
	)
);

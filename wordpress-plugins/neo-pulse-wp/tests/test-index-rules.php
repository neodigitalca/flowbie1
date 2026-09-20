<?php
/**
 * Index rules: template CPTs and robots default crawl trims.
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'home_url' ) ) {
	function home_url( $path = '' ) {
		return 'https://neodigital.ca' . $path;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $key, $default = false ) {
		if ( 'blog_public' === $key ) {
			return '1';
		}
		return $default;
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-index-rules.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-robots-txt.php';

$failed = 0;
function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$templates = Neo_Pulse_Wp_Index_Rules::template_post_types();
assert_true( in_array( 'elementor_library', $templates, true ), 'elementor templates are not indexable' );
assert_true( in_array( 'ygency_template', $templates, true ), 'theme templates are not indexable' );

$types = Neo_Pulse_Wp_Index_Rules::noindex_post_types();
assert_true( in_array( 'attachment', $types, true ), 'attachment pages are not indexable' );
assert_true( ! in_array( 'service-area', $types, true ), 'service areas stay indexable' );
assert_true( ! in_array( 'post', $types, true ), 'posts stay indexable' );
assert_true( ! in_array( 'page', $types, true ), 'pages stay indexable' );

assert_true( in_array( 'thank-you', Neo_Pulse_Wp_Index_Rules::noindex_page_slugs(), true ), 'thank-you is noindex' );

assert_true(
	Neo_Pulse_Wp_Index_Rules::request_has_elementor_epage( array( 'e-page-537936e' => '10' ) ),
	'elementor loop page query is detected'
);
assert_true(
	! Neo_Pulse_Wp_Index_Rules::request_has_elementor_epage( array( 'paged' => '2' ) ),
	'core paged query is not an elementor e-page'
);

$robots = Neo_Pulse_Wp_Robots_Txt::default_content( true );
assert_true( strpos( $robots, 'Disallow: /page/' ) !== false, 'robots blocks pagination' );
assert_true( strpos( $robots, 'Disallow: /*/page/' ) !== false, 'robots blocks nested pagination' );
assert_true( strpos( $robots, 'Disallow: /*?*e-page-' ) !== false, 'robots blocks elementor loop pagination' );
assert_true( strpos( $robots, 'Disallow: /author/' ) !== false, 'robots blocks author archives' );
assert_true( strpos( $robots, 'Disallow: /tag/' ) !== false, 'robots blocks tags' );
assert_true( strpos( $robots, 'Sitemap: https://neodigital.ca/sitemap_index.xml' ) !== false, 'robots keeps sitemap' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll index rule tests passed.\n";
exit( $failed > 0 ? 1 : 0 );

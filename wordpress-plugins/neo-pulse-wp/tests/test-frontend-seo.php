<?php
/**
 * Front-end SEO title and meta description tests.
 *
 * Run: php tests/test-frontend-seo.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'esc_html' ) ) {
	/**
	 * @param string $text Text.
	 */
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-frontend-seo.php';

function frontend_seo_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::normalize_meta( '' ) === '',
	'empty string stays empty'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::normalize_meta( null ) === '',
	'null is empty'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::normalize_meta( 12 ) === '',
	'non-string is empty'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::normalize_meta( '  Edmonton SEO Agency  ' ) === 'Edmonton SEO Agency',
	'trims stored title'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::description_html( '' ) === '',
	'empty description prints nothing'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::description_html( '   ' ) === '',
	'whitespace description prints nothing'
);

$html = Neo_Pulse_Wp_Frontend_Seo::description_html( 'Edmonton SEO and web design for local brands.' );
frontend_seo_assert(
	$html === '<meta name="description" content="Edmonton SEO and web design for local brands." />',
	'description html uses stored value'
);

$quoted = Neo_Pulse_Wp_Frontend_Seo::description_html( 'Work for "local" brands' );
frontend_seo_assert(
	strpos( $quoted, 'content="Work for &quot;local&quot; brands"' ) !== false,
	'description html escapes quotes'
);

frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::clean_title_suffix( 'Careers | Neo Digital – Neo Digital' ) === 'Careers | Neo Digital',
	'strips a doubled Neo Digital suffix'
);
$og = Neo_Pulse_Wp_Frontend_Seo::head_extras_html(
	array(
		'title'       => 'Edmonton SEO',
		'description' => 'Local search for Alberta businesses.',
		'url'         => 'https://neodigital.ca/edmonton-seo/',
		'image'       => '',
	)
);
frontend_seo_assert( strpos( $og, 'property="og:title"' ) !== false, 'prints Open Graph title' );
frontend_seo_assert( strpos( $og, 'name="twitter:card"' ) !== false, 'prints Twitter card' );
frontend_seo_assert( strpos( $og, 'id="neo-pulse-ai-webpage"' ) !== false, 'prints WebPage JSON-LD' );

$doc = '<html><head><title>About | Neo Digital – Neo Digital</title></head><body></body></html>';
$fixed = Neo_Pulse_Wp_Frontend_Seo::process( $doc );
frontend_seo_assert( strpos( $fixed, '<title>About | Neo Digital</title>' ) !== false, 'cleans the document title' );
frontend_seo_assert( strpos( $fixed, 'property="og:title"' ) !== false, 'injects OG when missing' );

frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::title_from_slug( 'hire-elementor-experts' ) === 'Hire Elementor Experts',
	'slug titles become readable headings'
);
frontend_seo_assert(
	Neo_Pulse_Wp_Frontend_Seo::title_matches_slug( 'Elementor Help In Edmonton', 'ai-seo-edmonton' ) === false,
	'mismatched blog titles fail the slug check'
);
frontend_seo_assert(
	isset( Neo_Pulse_Wp_Frontend_Seo::leftover_redirects()['/digital-marketing-guide/'] ),
	'digital marketing guide leftover URL redirects'
);
$_SERVER['REQUEST_URI'] = '/blog/ai-seo-edmonton/';
$blog_title = Neo_Pulse_Wp_Frontend_Seo::process( '<html><head><title>Elementor Help In Edmonton</title></head><body></body></html>' );
frontend_seo_assert( strpos( $blog_title, '<title>AI SEO Edmonton | Neo Digital</title>' ) !== false, 'blog document title follows the slug' );
unset( $_SERVER['REQUEST_URI'] );

echo "All frontend SEO tests passed.\n";

<?php
/**
 * Robots Sitemap line, llms default pages, and sitemap.xml alias tests.
 *
 * Run: php tests/test-robots-llms-sitemap.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * @param string $path Path.
	 */
	function home_url( $path = '' ) {
		return 'https://neodigital.ca' . $path;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	/**
	 * @param string $key Option key.
	 * @param mixed  $default Default.
	 * @return mixed
	 */
	function get_option( $key, $default = false ) {
		if ( 'blog_public' === $key ) {
			return '1';
		}
		return $default;
	}
}

if ( ! function_exists( 'get_bloginfo' ) ) {
	/**
	 * @param string $show Field.
	 */
	function get_bloginfo( $show = '' ) {
		unset( $show );
		return 'Neo Digital';
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-robots-txt.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-llms-txt.php';
require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-sitemap.php';

function robots_llms_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

$default = Neo_Pulse_Wp_Robots_Txt::default_content( true );
robots_llms_assert(
	strpos( $default, "Sitemap: https://neodigital.ca/sitemap_index.xml" ) !== false,
	'public robots default includes sitemap line'
);
robots_llms_assert(
	strpos( $default, 'Disallow: /page/' ) !== false,
	'public robots default blocks pagination'
);
robots_llms_assert(
	strpos( $default, 'Disallow: /*?*e-page-' ) !== false,
	'public robots default blocks elementor loop pagination'
);
robots_llms_assert(
	strpos( $default, 'User-agent: GPTBot' ) !== false && strpos( $default, 'User-agent: OAI-SearchBot' ) !== false,
	'public robots default allows Semrush AI crawlers'
);
$gpt = preg_split( '/\n(?=User-agent: )/i', $default );
$gpt_block = '';
foreach ( $gpt as $chunk ) {
	if ( strpos( $chunk, 'User-agent: GPTBot' ) === 0 ) {
		$gpt_block = $chunk;
		break;
	}
}
robots_llms_assert(
	strpos( $gpt_block, 'Disallow: /*?*e-page-' ) !== false,
	'GPTBot still cannot crawl noindexed e-page URLs'
);
$merged = Neo_Pulse_Wp_Robots_Txt::with_ai_bot_allows( "User-agent: *\nDisallow: /wp-admin/" );
robots_llms_assert(
	strpos( $merged, 'User-agent: PerplexityBot' ) !== false && strpos( $merged, 'User-agent: ClaudeBot' ) !== false,
	'custom robots gain AI bot allow groups'
);
$stale = "User-agent: *\nDisallow: /*?*e-page-\n\nUser-agent: GPTBot\nAllow: /\n";
$rewritten = Neo_Pulse_Wp_Robots_Txt::with_ai_bot_allows( $stale );
$gpt_chunks = preg_split( '/\n(?=User-agent: )/i', $rewritten );
$gpt_only = '';
foreach ( $gpt_chunks as $chunk ) {
	if ( strpos( $chunk, 'User-agent: GPTBot' ) === 0 ) {
		$gpt_only = $chunk;
		break;
	}
}
robots_llms_assert(
	strpos( $gpt_only, 'Disallow: /*?*e-page-' ) !== false,
	'stale GPTBot Allow-only groups are rewritten with e-page Disallow'
);
$stripped = Neo_Pulse_Wp_Robots_Txt::strip_ai_bot_groups( $rewritten );
robots_llms_assert(
	strpos( $stripped, 'Allow: /' ) === false && strpos( $stripped, 'User-agent: GPTBot' ) === false,
	'stripping AI groups does not leave orphan Allow rules'
);

$private = Neo_Pulse_Wp_Robots_Txt::default_content( false );
robots_llms_assert(
	strpos( $private, 'Sitemap:' ) === false,
	'private robots default has no sitemap line'
);

robots_llms_assert(
	Neo_Pulse_Wp_Robots_Txt::has_sitemap_line( "User-agent: *\nSitemap: https://example.com/sitemap_index.xml" ),
	'detects existing sitemap line'
);
robots_llms_assert(
	! Neo_Pulse_Wp_Robots_Txt::has_sitemap_line( "User-agent: *\nDisallow: /wp-admin/" ),
	'detects missing sitemap line'
);

$appended = Neo_Pulse_Wp_Robots_Txt::with_sitemap_line(
	"User-agent: *\nDisallow: /wp-admin/",
	'https://neodigital.ca/sitemap_index.xml'
);
robots_llms_assert(
	substr( $appended, -strlen( 'Sitemap: https://neodigital.ca/sitemap_index.xml' ) ) === 'Sitemap: https://neodigital.ca/sitemap_index.xml',
	'appends sitemap line to custom robots'
);

$kept = Neo_Pulse_Wp_Robots_Txt::with_sitemap_line(
	"User-agent: *\nSitemap: https://other.example/sitemap.xml"
);
robots_llms_assert(
	$kept === "User-agent: *\nSitemap: https://other.example/sitemap.xml",
	'does not rewrite robots that already have a sitemap line'
);

$patterns = Neo_Pulse_Wp_Sitemap::index_rewrite_patterns();
robots_llms_assert( in_array( '^sitemap_index\.xml$', $patterns, true ), 'index rewrite includes sitemap_index.xml' );
robots_llms_assert( in_array( '^sitemap\.xml$', $patterns, true ), 'index rewrite includes sitemap.xml alias' );

$rows = Neo_Pulse_Wp_Llms_Txt::default_page_rows();
$paths = array();
foreach ( $rows as $row ) {
	$paths[] = $row[1];
}
robots_llms_assert( in_array( '/edmonton-seo/', $paths, true ), 'llms default includes edmonton-seo' );
robots_llms_assert( in_array( '/aiseo/', $paths, true ), 'llms default includes aiseo' );
robots_llms_assert( in_array( '/shopify-development/', $paths, true ), 'llms default includes shopify' );

$llms = Neo_Pulse_Wp_Llms_Txt::default_content();
robots_llms_assert( strpos( $llms, '# Neo Digital' ) !== false, 'llms default uses site name' );
robots_llms_assert( strpos( $llms, 'Edmonton website design, SEO, and paid media' ) !== false, 'llms default has a summary line' );
robots_llms_assert( strpos( $llms, 'https://neodigital.ca/edmonton-seo/' ) !== false, 'llms default uses absolute agency urls' );
robots_llms_assert( strpos( $llms, 'Edmonton SEO facts (September 2026)' ) !== false, 'llms default leads with dated Edmonton SEO facts' );
robots_llms_assert(
	strpos( $llms, '/edmonton-seo/' ) < strpos( $llms, '/aiseo/' ),
	'llms default lists edmonton-seo before aiseo'
);
robots_llms_assert( $rows[0][1] === '/edmonton-seo/', 'llms first page row is edmonton-seo' );
robots_llms_assert( method_exists( 'Neo_Pulse_Wp_Llms_Txt', 'save_content' ), 'llms save_content exists' );

echo "All robots, llms, and sitemap tests passed.\n";

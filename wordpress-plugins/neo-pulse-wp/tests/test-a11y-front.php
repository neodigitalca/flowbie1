<?php
/**
 * Front-end a11y names and skip link.
 *
 * Run: php tests/test-a11y-front.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );

if ( ! function_exists( 'esc_attr' ) ) {
	/**
	 * @param string $text Text.
	 */
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	/**
	 * @param string $url URL.
	 * @param int    $component Component.
	 * @return mixed
	 */
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component );
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	/**
	 * @param string $text Text.
	 */
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'home_url' ) ) {
	/**
	 * @param string $path Path.
	 */
	function home_url( $path = '' ) {
		return 'https://neodigital.ca' . $path;
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	/**
	 * @param string $text Text.
	 */
	function wp_strip_all_tags( $text ) {
		return trim( html_entity_decode( strip_tags( (string) $text ), ENT_QUOTES, 'UTF-8' ) );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-neo-pulse-wp-a11y-front.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg  Message.
 */
function a11y_assert( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: {$msg}\n" );
		$failed++;
		return;
	}
	echo "PASS: {$msg}\n";
}

$html = '<html><body><header><button type="button" class="offcanvas-toggle toggle-right">x</button>'
	. '<h5 class="elementor-heading-title elementor-size-default">About Us</h5></header>'
	. '<main class="ygency-content-area" id="ygency-content">'
	. '<div class="ygency-info-box"><span class="title-text">WordPress<br>Development</span>'
	. '<a class="box-wrapper-link" href="https://neodigital.ca/website-design/"></a></div>'
	. '<h4 class="title">Discovery Solutions</h4>'
	. '<a class="link-arrow" href="/our-work/discovery-solutions/"><svg></svg></a>'
	. '<a itemprop="url" href="https://neodigital.ca/our-work/blind-magic/" target="_self"></a>'
	. '<h2 class="elementor-heading-title elementor-size-default">Let’s Work Together</h2>'
	. '</main></body></html>';

$out = Neo_Pulse_Wp_A11y_Front::process( $html );

a11y_assert( strpos( $out, 'class="neo-pulse-skip-link" href="#ygency-content"' ) !== false, 'skip link targets main content' );
a11y_assert( strpos( $out, 'aria-label="Open menu"' ) !== false, 'offcanvas toggle is named' );
a11y_assert( strpos( $out, 'aria-label="WordPress Development"' ) !== false, 'service overlay link uses card title' );
a11y_assert( strpos( $out, '<span class="neo-pulse-sr-only">WordPress Development</span>' ) !== false, 'empty card link gets visible text for crawlers' );
a11y_assert( strpos( $out, 'aria-label="Discovery Solutions"' ) !== false, 'project arrow link uses project title' );
a11y_assert( strpos( $out, 'aria-label="Blind Magic"' ) !== false, 'slider link uses the work slug' );
a11y_assert( strpos( $out, '<p class="elementor-heading-title elementor-size-default">About Us</p>' ) !== false, 'offcanvas H5 is demoted' );
a11y_assert( strpos( $out, 'aria-hidden="true">Let’s Work Together</h2>' ) !== false, 'watermark heading is hidden from contrast' );
$css = Neo_Pulse_Wp_A11y_Front::skip_css();
a11y_assert( strpos( $css, 'html,body{background-color:#02050A;color:#e8e8e8}' ) !== false, 'every page body gets readable contrast' );
a11y_assert( strpos( $css, '#neo-pulse-ai-faq{position:relative;z-index:2' ) !== false, 'injected FAQ sits on a solid band so the watermark does not show through' );
a11y_assert( strpos( $css, '#neo-pulse-ai-faq details' ) !== false && strpos( $css, 'summary:after{content:"+"' ) !== false, 'FAQ accordion rows use native details controls' );
a11y_assert( strpos( $css, '#neo-pulse-ai-faq .neo-pulse-faq-list{max-width:none;width:100%}' ) !== false, 'FAQ accordion spans the full content width' );
a11y_assert( strpos( $css, '.featured-project-slider,.elementor-element-b8b57ec,.elementor-element-53e286e{display:none!important' ) !== false, 'empty device slider does not leave a tall hole' );
a11y_assert( strpos( $css, 'body.home .ygency-counter-box,body.home .ygency-info-box' ) !== false, 'mobile homepage counters and service boxes are centered' );
$showcase_in = '<div class="elementor-element elementor-hidden-desktop elementor-hidden-mobile elementor-widget-ygency-showcase">cards</div>';
$showcase_out = Neo_Pulse_Wp_A11y_Front::reveal_featured_showcase( $showcase_in );
a11y_assert( strpos( $showcase_out, 'elementor-hidden-desktop' ) === false && strpos( $showcase_out, 'elementor-widget-ygency-showcase' ) !== false, 'featured showcase is not hidden on every breakpoint' );
$_SERVER['REQUEST_URI'] = '/';
$wrong_h1 = '<html><body><main><h1 class="elementor-heading-title">Window Coverings <span class="highlight-primary">Website Design &amp; SEO.</span></h1></main></body></html>';
$home_h1 = Neo_Pulse_Wp_A11y_Front::restore_home_hero_h1( $wrong_h1 );
a11y_assert( strpos( $home_h1, 'Edmonton <span class="highlight-primary">Website Design' ) !== false, 'homepage H1 stays Edmonton, not Window Coverings' );
$_SERVER['REQUEST_URI'] = '/window-coverings-marketing/';
$vertical = Neo_Pulse_Wp_A11y_Front::restore_home_hero_h1( $wrong_h1 );
a11y_assert( strpos( $vertical, 'Window Coverings <span class="highlight-primary">' ) !== false, 'window coverings pages keep their own H1' );
a11y_assert( strpos( $css, '.elementor-element-64f68179 .elementor-heading-title{color:#fff!important}' ) !== false, 'watermark heading is forced white' );
a11y_assert( substr_count( $out, 'neo-pulse-skip-link' ) === 1, 'skip link is injected once' );

$again = Neo_Pulse_Wp_A11y_Front::process( $out );
a11y_assert( substr_count( $again, 'aria-label="Open menu"' ) === 1, 'labels are not doubled' );

$plain = '<html><body><main>Hi</main></body></html>';
$with_main = Neo_Pulse_Wp_A11y_Front::process( $plain );
a11y_assert( strpos( $with_main, '<main id="main">' ) !== false, 'bare main gets an id' );
a11y_assert( strpos( $with_main, 'href="#main"' ) !== false, 'skip link falls back to #main' );

$two_h1 = '<html><body><header><h1 class="logo">Logo</h1></header><main id="ygency-content"><h1>Edmonton SEO</h1><h1>Extra</h1></main><footer><h1>Foot</h1></footer></body></html>';
$one = Neo_Pulse_Wp_A11y_Front::process( $two_h1 );
a11y_assert( substr_count( strtolower( $one ), '<h1' ) === 1, 'chrome and extra H1s are demoted' );
a11y_assert( strpos( $one, '<h1>Edmonton SEO</h1>' ) !== false, 'the in-main topic H1 stays' );
$click = Neo_Pulse_Wp_A11y_Front::rewrite_non_descriptive_anchors( '<a href="https://neodigital.ca/edmonton-seo/">click here</a>' );
a11y_assert( $click === '<a href="https://neodigital.ca/edmonton-seo/">Edmonton Seo</a>', 'click-here anchors use the destination slug' );

$shim = (string) file_get_contents( dirname( __DIR__ ) . '/assets/frontend/neo-pulse-elementor-waypoint.js' );
a11y_assert( strpos( $shim, 'elementor/frontend/init' ) !== false && strpos( $shim, 'fe.waypoint =' ) !== false, 'elementor waypoint shim restores the missing API' );

a11y_assert(
	Neo_Pulse_Wp_A11y_Front::heading_from_slug( 'ai-seo-edmonton' ) === 'AI SEO Edmonton',
	'slug headings keep SEO and city casing'
);
$_SERVER['REQUEST_URI'] = '/blog/ai-seo-edmonton/';
$wrong_h1 = '<html><body><main id="ygency-content"><h1>Elementor Help In Edmonton</h1></main></body></html>';
$aligned = Neo_Pulse_Wp_A11y_Front::align_blog_h1_to_slug( $wrong_h1 );
a11y_assert( strpos( $aligned, '<h1>AI SEO Edmonton</h1>' ) !== false, 'blog H1 follows the slug topic' );
$_SERVER['REQUEST_URI'] = '/about/';
$faq_html = '<html><body><main id="ygency-content"><h1>About</h1></main></body></html>';
$faq_out = Neo_Pulse_Wp_A11y_Front::inject_money_faq( $faq_html );
a11y_assert( strpos( $faq_out, 'id="neo-pulse-ai-faq"' ) !== false, 'about page gets a visible FAQ' );
a11y_assert( strpos( $faq_out, '<details class="neo-pulse-faq-item" open' ) !== false, 'FAQ is an accordion with the first item open' );
a11y_assert( substr_count( $faq_out, '<details class="neo-pulse-faq-item"' ) === 3, 'each FAQ pair is an accordion row' );
a11y_assert( strpos( $faq_out, '"@type":"FAQPage"' ) !== false || strpos( $faq_out, '"@type": "FAQPage"' ) !== false, 'FAQ prints FAQPage JSON-LD' );
$long = '<p>' . str_repeat( 'Edmonton SEO needs a real answer on the page. ', 20 ) . '</p>';
$split = Neo_Pulse_Wp_A11y_Front::split_long_paragraphs( $long );
a11y_assert( substr_count( $split, '<p>' ) === 2, 'long paragraphs are split' );
unset( $_SERVER['REQUEST_URI'] );

$_SERVER['REQUEST_URI'] = '/blog/';
$order = '<html><body><main id="ygency-content">'
	. '<h1>Blog</h1>'
	. '<h3 class="elementor-heading-title elementor-size-default">From a Rebuilt Site to Page 1 Rankings in Edmonton</h3>'
	. '<h6 class="counter-title">Client <br>Satisfaction</h6>'
	. '<h2 class="elementor-heading-title elementor-size-default">Let’s Work<br>Together</h2>'
	. '<h4 class="elementor-heading-title elementor-size-default">Quick Links</h4>'
	. '</main></body></html>';
$ordered = Neo_Pulse_Wp_A11y_Front::process( $order );
a11y_assert( strpos( $ordered, '<h2 class="elementor-heading-title elementor-size-default">From a Rebuilt Site to Page 1 Rankings in Edmonton</h2>' ) !== false, 'H1 then H3 post titles become H2' );
a11y_assert( strpos( $ordered, '<h2 class="elementor-heading-title elementor-size-default">Quick Links</h2>' ) !== false, 'footer Quick Links is an H2' );
a11y_assert( strpos( $ordered, '<p class="counter-title">Client <br>Satisfaction</p>' ) !== false, 'counter H6s are demoted' );
a11y_assert( strpos( $ordered, 'aria-hidden="true">Let’s Work<br>Together</h2>' ) !== false, 'stacked Let’s Work Together watermark is hidden' );
$gallery = '<html><body><main id="main"><div class="elementor-gallery__container"><div class="e-gallery-item elementor-gallery-item"></div></div></main></body></html>';
$gallery_out = Neo_Pulse_Wp_A11y_Front::process( $gallery );
a11y_assert( strpos( $gallery_out, '<div role="list" class="elementor-gallery__container">' ) !== false, 'gallery container is a list' );
a11y_assert( strpos( $gallery_out, '<div role="listitem" class="e-gallery-item elementor-gallery-item">' ) !== false, 'gallery tiles are listitems' );
$shim = (string) file_get_contents( dirname( __DIR__ ) . '/assets/frontend/neo-pulse-elementor-waypoint.js' );
a11y_assert( strpos( $shim, 'role", "list"' ) !== false && strpos( $shim, 'role", "listitem"' ) !== false && strpos( $shim, 'labelLists' ) !== false, 'waypoint shim keeps gallery and loop list roles after Elementor boots' );
$loop = '<html><body><main id="main"><div class="elementor-loop-container elementor-grid" role="list">'
	. '<a class="elementor-element e-flex e-con-boxed e-con e-parent" href="https://neodigital.ca/our-work/blind-magic/">Blind Magic</a>'
	. '<a class="elementor-element e-flex e-con-boxed e-con e-parent" href="https://neodigital.ca/our-work/direct-health-solutions/">Direct Health</a>'
	. '</div><div class="elementor-social-icons-wrapper elementor-grid" role="list">'
	. '<span class="elementor-grid-item" role="listitem">ig</span></div></main></body></html>';
$loop_out = Neo_Pulse_Wp_A11y_Front::process( $loop );
a11y_assert( substr_count( $loop_out, 'role="listitem"' ) === 3, 'loop cards get listitem without doubling social items' );
a11y_assert( strpos( $loop_out, '<a role="listitem" class="elementor-element e-flex e-con-boxed e-con e-parent" href="https://neodigital.ca/our-work/blind-magic/">' ) !== false, 'Blind Magic loop card is a listitem' );
$work = '<html><body><main id="main"><div class="elementor-loop-container elementor-grid" role="list">'
	. '<style id="loop-7641">.e3026cf{color:red}</style>'
	. '<div data-elementor-type="loop-item" class="elementor e-loop-item e-loop-item-8808"><a href="/our-work/blind-magic/">Blind Magic</a></div>'
	. '<div data-elementor-type="loop-item" class="elementor e-loop-item e-loop-item-1234"><a href="/our-work/west-x-business-solutions/">West X</a></div>'
	. '</div></main></body></html>';
$work_out = Neo_Pulse_Wp_A11y_Front::process( $work );
a11y_assert( substr_count( $work_out, '<div role="listitem" data-elementor-type="loop-item"' ) === 2, 'our-work loop wrappers become listitems after the style tag' );
$search = '<html><body class="wp-singular"><main id="main"><div class="elementor-shortcode">[flowbie_search]</div></main></body></html>';
$search_out = Neo_Pulse_Wp_A11y_Front::process( $search );
a11y_assert( strpos( $search_out, '[flowbie_search]' ) === false, 'unrendered search shortcode is hidden from contrast' );
unset( $_SERVER['REQUEST_URI'] );

if ( $failed > 0 ) {
	exit( 1 );
}
echo "All a11y front tests passed.\n";

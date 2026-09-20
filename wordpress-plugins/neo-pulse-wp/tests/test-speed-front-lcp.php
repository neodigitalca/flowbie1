<?php
/**
 * Speed front LCP preload and attachment dimensions.
 *
 * Run: php tests/test-speed-front-lcp.php
 *
 * @package Neo_Pulse_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'NEO_PULSE_WP_VERSION', 'test' );
define( 'NEO_PULSE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/neo-pulse-wp.php' );
define( 'NEO_PULSE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );

if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function apply_filters( $hook, $value ) { // phpcs:ignore
		unset( $hook );
		return $value;
	}
}

if ( ! function_exists( 'esc_url' ) ) {
	/**
	 * @param string $url URL.
	 */
	function esc_url( $url ) { // phpcs:ignore
		return $url;
	}
}

if ( ! function_exists( 'plugins_url' ) ) {
	/**
	 * @param string $path Path.
	 * @param string $file File.
	 */
	function plugins_url( $path = '', $file = '' ) { // phpcs:ignore
		unset( $file );
		return 'https://neodigital.ca/wp-content/plugins/neo-pulse-wp/' . ltrim( (string) $path, '/' );
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

if ( ! function_exists( 'attachment_url_to_postid' ) ) {
	/**
	 * @param string $url URL.
	 */
	function attachment_url_to_postid( $url ) { // phpcs:ignore
		if ( strpos( (string) $url, 'hero.jpg' ) !== false ) {
			return 91;
		}
		return 0;
	}
}

if ( ! function_exists( 'wp_get_attachment_metadata' ) ) {
	/**
	 * @param int $attachment_id Attachment ID.
	 * @return array<string, int>|false
	 */
	function wp_get_attachment_metadata( $attachment_id ) {
		if ( (int) $attachment_id === 91 ) {
			return array(
				'width'  => 1600,
				'height' => 900,
			);
		}
		return false;
	}
}

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-minify.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/class-neo-pulse-wp-speed-front.php';

$failed = 0;

/**
 * @param bool   $cond Condition.
 * @param string $msg Message.
 */
function assert_true( bool $cond, string $msg ): void {
	global $failed;
	if ( ! $cond ) {
		echo "FAIL: {$msg}\n";
		$failed++;
	} else {
		echo "OK: {$msg}\n";
	}
}

$config = array(
	'enabled'            => true,
	'font_display_swap'  => false,
	'preconnect_fonts'   => false,
	'async_google_fonts' => false,
);

$html = '<html><head></head><body><img src="https://neodigital.ca/wp-content/uploads/hero.jpg"><p>Hi</p></body></html>';
$out  = Neo_Pulse_Wp_Speed_Front::process( $html, $config );

assert_true( str_contains( $out, 'width="1600"' ), 'stamps attachment width' );
assert_true( str_contains( $out, 'height="900"' ), 'stamps attachment height' );
assert_true( str_contains( $out, 'rel="preload"' ) && str_contains( $out, 'as="image"' ), 'injects image preload' );
assert_true( str_contains( $out, 'hero.jpg' ), 'preload uses hero src' );
assert_true( str_contains( $out, 'fetchpriority="high"' ), 'marks LCP image fetchpriority high' );
assert_true( str_contains( $out, 'decoding="async"' ), 'marks LCP image decoding async' );

$logo = '<html><head></head><body><img src="https://neodigital.ca/wp-content/uploads/logo.png" width="80" height="24"><img src="https://neodigital.ca/wp-content/uploads/hero.jpg"></body></html>';
$logo_out = Neo_Pulse_Wp_Speed_Front::process( $logo, $config );
assert_true( str_contains( $logo_out, 'hero.jpg' ) && str_contains( $logo_out, 'rel="preload"' ), 'skips small logo and preloads next large image' );

$already = '<html><head><link rel="preload" as="image" href="https://neodigital.ca/wp-content/uploads/hero.jpg"></head><body><img src="https://neodigital.ca/wp-content/uploads/hero.jpg" width="1600" height="900"></body></html>';
$already_out = Neo_Pulse_Wp_Speed_Front::process( $already, $config );
assert_true( substr_count( $already_out, 'rel="preload"' ) === 1, 'does not add a second image preload' );

$nitro = '<html><head></head><body><img alt="Logo" class="nitro-lazy" nitro-lazy-src="https://neodigital.ca/wp-content/uploads/hero.jpg"></body></html>';
$nitro_out = Neo_Pulse_Wp_Speed_Front::process( $nitro, $config );
assert_true( str_contains( $nitro_out, 'width="1600"' ), 'stamps width from nitro-lazy-src attachment' );
assert_true( str_contains( $nitro_out, 'rel="preload"' ) && str_contains( $nitro_out, 'hero.jpg' ), 'preloads nitro-lazy-src image' );
assert_true( str_contains( $nitro_out, 'src="https://neodigital.ca/wp-content/uploads/hero.jpg"' ), 'puts nitro-lazy-src onto src' );
assert_true( ! str_contains( $nitro_out, 'nitro-lazy-src=' ), 'drops nitro-lazy-src after eager LCP' );
assert_true( ! str_contains( $nitro_out, 'nitro-lazy"' ) && ! str_contains( $nitro_out, 'nitro-lazy ' ), 'drops nitro-lazy class on LCP' );

$wrong_preload = '<html><head><link rel="preload" as="image" href="https://neodigital.ca/wp-content/uploads/2026/09/edmonton-seo-command.webp" fetchpriority="high"></head><body><div class="elementor-element elementor-element-60bc532 elementor-invisible elementor-widget elementor-widget-image nitro-lazy" nitro-elementor-animation="animated fadeInRight"><div class="elementor-widget-container"><img fetchpriority="high" width="482" height="502" class="nitro-lazy" nitro-lazy-src="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png" src="data:image/svg+xml;base64,PHN2Zy8+"></div></div></body></html>';
$wrong_out = Neo_Pulse_Wp_Speed_Front::process( $wrong_preload, $config );
assert_true( str_contains( $wrong_out, 'src="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png"' ), 'un-lazies hero even when another image is already preloaded' );
assert_true( str_contains( $wrong_out, 'edmonton.png' ) && str_contains( $wrong_out, 'rel="preload"' ), 'preloads the real LCP url' );
assert_true( ! str_contains( $wrong_out, 'elementor-invisible elementor-widget' ), 'reveals the Elementor hero widget' );
assert_true( ! str_contains( $wrong_out, 'nitro-elementor-animation' ), 'strips the entrance animation that hides LCP' );
assert_true( ! str_contains( $wrong_out, 'data:image/svg+xml' ), 'removes the nitro placeholder src' );

$overlay = '<html><head></head><body><style>.elementor-element.elementor-element-3560e2e::before{background-image:url("https://neodigital.ca/wp-content/uploads/2023/04/hero-line.png")}</style><div class="elementor-element elementor-element-3560e2e e-con e-parent"></div></body></html>';
$overlay_out = Neo_Pulse_Wp_Speed_Front::process( $overlay, $config );
assert_true( str_contains( $overlay_out, 'hero-line.png' ) && str_contains( $overlay_out, 'as="image"' ), 'preloads overlay LCP image' );
assert_true( ! str_contains( $overlay_out, 'min-height:100svh' ), 'does not force viewport min-height on the hero' );

$svg = '<html><head></head><body><img src="https://neodigital.ca/wp-content/uploads/2025/02/Light.svg" width="876" height="191"><img src="https://neodigital.ca/wp-content/uploads/hero.jpg"></body></html>';
$svg_out = Neo_Pulse_Wp_Speed_Front::process( $svg, $config );
assert_true( str_contains( $svg_out, 'hero.jpg' ) && str_contains( $svg_out, 'as="image"' ), 'skips SVG logo and preloads the next bitmap' );

$abs = '<html><head></head><body><div class="elementor-element elementor-element-f656ffb elementor-absolute elementor-widget elementor-widget-image"><img src="https://neodigital.ca/wp-content/uploads/hero-ellipse.png" width="1220" height="1361"></div></body></html>';
$abs_out = Neo_Pulse_Wp_Speed_Front::process( $abs, $config );
assert_true( str_contains( $abs_out, 'id="neo-pulse-speed-abs-img"' ), 'pins absolute Elementor images' );
assert_true( str_contains( $abs_out, 'elementor-element-f656ffb{position:absolute;overflow:hidden;aspect-ratio:1220/1361}' ), 'absolute image stays out of flow and uses its attachment ratio' );

$hero_hide = '<html><head><link rel="stylesheet" href="https://neodigital.ca/wp-content/plugins/elementor/assets/lib/animations/styles/fadeInLeft.min.css"><link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/post-55.css"></head><body><main id="ygency-content"><div class="elementor-element elementor-element-a71df32 elementor-invisible elementor-widget elementor-widget-heading" data-settings="{&quot;_animation&quot;:&quot;fadeInLeft&quot;}"><h1 class="elementor-heading-title">Edmonton Website Design</h1></div></main></body></html>';
$hero_out = Neo_Pulse_Wp_Speed_Front::process( $hero_hide, $config );
assert_true( str_contains( $hero_out, 'id="neo-pulse-first-paint"' ), 'injects first-paint CSS' );
assert_true( str_contains( $hero_out, 'html,body{background-color:#02050A;margin:0;color:#e8e8e8}' ), 'first-paint contrast is not limited to the homepage' );
assert_true( ! str_contains( $hero_out, 'elementor-invisible elementor-widget' ), 'reveals the hero heading before Elementor JS' );
assert_true( ! str_contains( $hero_out, '_animation' ), 'strips the hero entrance animation' );
assert_true( str_contains( $hero_out, 'fadeInLeft.min.css' ) && str_contains( $hero_out, 'media="print"' ), 'defers animation CSS' );
assert_true( str_contains( $hero_out, 'post-55.css' ) && ! preg_match( '/post-55\.css[^>]+media="print"/', $hero_out ), 'keeps leftover layout CSS blocking so first paint does not snap' );
Neo_Pulse_Wp_Speed_Front::$mobile_request = true;
$mobile_out = Neo_Pulse_Wp_Speed_Front::process( $hero_hide, $config );
Neo_Pulse_Wp_Speed_Front::$mobile_request = null;
assert_true( (bool) preg_match( '/post-55\.css[^>]+media="print"/', $mobile_out ), 'unblocks leftover layout CSS on mobile so Slow 4G can paint' );
assert_true( Neo_Pulse_Wp_Speed_Front::is_deferred_stylesheet( 'https://neodigital.ca/wp-content/plugins/elementor/assets/lib/font-awesome/css/solid.min.css' ), 'defers icon CSS' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_deferred_stylesheet( 'https://neodigital.ca/wp-content/uploads/elementor/css/custom-frontend.min.css' ), 'keeps Elementor frontend CSS blocking' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_deferred_stylesheet( 'https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/plugins/swiper/8.4.5/swiper.min.css' ), 'swiper CSS stays blocking so the device slider does not dump alt text' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_deferred_stylesheet( 'https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/css/main.min.css' ), 'qi layout CSS stays blocking' );

Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	return str_contains( $href, 'post-55.css' ) ? __DIR__ . '/data/tiny-layout.css' : null;
};
$inline_out = Neo_Pulse_Wp_Speed_Front::inline_blocking_stylesheets( '<link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/post-55.css"><link rel="stylesheet" href="https://neodigital.ca/wp-content/plugins/elementor/assets/lib/animations/styles/fadeInLeft.min.css">' );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
assert_true( str_contains( $inline_out, '<style data-href=' ) && str_contains( $inline_out, '.hero{color:#fff}' ), 'inlines layout CSS' );
assert_true( str_contains( $inline_out, 'href="https://neodigital.ca/wp-content/plugins/elementor/assets/lib/animations/styles/fadeInLeft.min.css"' ), 'does not inline deferred animation CSS' );
assert_true( ! str_contains( $inline_out, '<link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/post-55.css">' ), 'removes the inlined layout link' );

$jq = '<html><head><script id="jquery-core-js" src="/jquery.min.js"></script><script id="jquery-migrate-js" src="/jquery-migrate.min.js"></script></head><body><h1>Hi</h1><script id="jquery-ui-core-js-before">jQuery.uiBackCompat=true</script></body></html>';
$jq_out = Neo_Pulse_Wp_Speed_Front::relocate_head_jquery( $jq );
assert_true( ! preg_match( '/<head>.*jquery-core-js.*<\/head>/s', $jq_out ), 'jquery leaves the head' );
assert_true( strpos( $jq_out, 'jquery-core-js' ) < strpos( $jq_out, 'jquery-ui-core-js-before' ), 'jquery stays before inline jQuery users' );

$sizes = Neo_Pulse_Wp_Speed_Front::tighten_img_sizes( '<img src="https://neodigital.ca/wp-content/uploads/2026/07/Blind-Magic-Mobile.jpg" sizes="(max-width: 390px) 100vw, 390px">' );
assert_true( str_contains( $sizes, 'sizes="(max-width: 767px) 45vw, 280px"' ), 'device-slider images stay large enough to paint in the laptop frame' );

$hoist = Neo_Pulse_Wp_Speed_Front::hoist_lcp_preload( '<html><head><style id="x"></style><link rel="preload" as="image" href="https://neodigital.ca/wp-content/uploads/hero.jpg" fetchpriority="high"></head><body></body></html>' );
assert_true( (bool) preg_match( '/<head><link rel="preload" as="image"/', $hoist ), 'LCP preload is the first head node' );

Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	if ( str_contains( $href, 'post-55.css' ) ) {
		return __DIR__ . '/data/tiny-layout.css';
	}
	if ( str_contains( $href, 'custom-frontend.min.css' ) ) {
		return __DIR__ . '/data/tiny-layout-2.css';
	}
	return null;
};
Neo_Pulse_Wp_Speed_Front::$combined_css_writer = static function () {
	return 'https://neodigital.ca/wp-content/cache/neo-pulse-speed/css/combined.css';
};
$combo = Neo_Pulse_Wp_Speed_Front::combine_blocking_stylesheets( '<link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/post-55.css"><link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/custom-frontend.min.css"><link rel="stylesheet" href="https://neodigital.ca/wp-content/plugins/elementor/assets/lib/animations/styles/fadeInLeft.min.css">' );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
Neo_Pulse_Wp_Speed_Front::$combined_css_writer = null;
assert_true( substr_count( $combo, 'rel="stylesheet"' ) === 2, 'combines layout CSS into one stylesheet' );
assert_true( str_contains( $combo, 'neo-pulse-speed/css/combined.css' ), 'emits the combined layout CSS url' );
assert_true( str_contains( $combo, 'fadeInLeft.min.css' ), 'leaves deferred animation CSS alone' );

$unblocked = Neo_Pulse_Wp_Speed_Front::unblock_remaining_stylesheets( '<link rel="stylesheet" href="https://neodigital.ca/wp-content/cache/neo-pulse-speed/css/combined.css">' );
assert_true( str_contains( $unblocked, 'rel="preload" as="style"' ) && str_contains( $unblocked, 'media="print"' ), 'unblocks the leftover combined stylesheet' );

$bg_html = '<html><head><link rel="stylesheet" href="https://neodigital.ca/wp-content/uploads/elementor/css/post-55.css"></head><body><div class="elementor-element elementor-element-a3d0229"><h1>Edmonton Website Design &amp; SEO.</h1></div></body></html>';
Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	return str_contains( $href, 'post-55.css' ) ? __DIR__ . '/data/tiny-hero-bg.css' : null;
};
$bg_out = Neo_Pulse_Wp_Speed_Front::process( $bg_html, $config );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
assert_true( str_contains( $bg_out, 'edmonton-seo-command.webp' ) && str_contains( $bg_out, 'rel="preload" as="image"' ), 'preloads the hero CSS background so LCP is discoverable' );
assert_true( str_contains( $bg_out, 'fetchpriority="high"' ) && str_contains( $bg_out, 'edmonton-seo-command.webp' ), 'marks the hero background preload high' );
assert_true( str_contains( $bg_out, 'background-image:url(https://neodigital.ca/wp-content/uploads/2026/09/edmonton-seo-command.webp)' ), 'paints the hero background from first-paint CSS' );
assert_true( str_contains( $bg_out, 'padding:14rem 5% 3rem' ) && str_contains( $bg_out, 'padding:10rem 5% 3rem' ), 'reserves the real hero padding so CLS does not spike' );
assert_true( ! str_contains( $bg_out, 'min-height:4.5em' ), 'does not reserve a tiny hero box' );

$delay = Neo_Pulse_Wp_Speed_Front::delay_below_fold_scripts( '<html><body><script src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/plugins/swiper/8.4.5/swiper.min.js"></script><script src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/js/main.min.js?ver=1.11"></script><script src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor-premium/assets/js/main.min.js?ver=1.13"></script><script src="https://neodigital.ca/wp-content/plugins/neo-pulse-wp/assets/frontend/neo-pulse-chat-widget.js"></script><script src="https://neodigital.ca/wp-content/plugins/elementor/assets/js/frontend.min.js"></script></body></html>' );
assert_true( ! str_contains( $delay, 'data-src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/plugins/swiper/8.4.5/swiper.min.js"' ), 'does not delay Swiper' );
assert_true( ! str_contains( $delay, 'data-src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/js/main.min.js?ver=1.11"' ), 'does not delay Qi Addons core' );
assert_true( ! str_contains( $delay, 'data-src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor-premium/assets/js/main.min.js?ver=1.13"' ), 'does not delay Qi Addons premium' );
assert_true( str_contains( $delay, 'data-neo-pulse-delay="1"' ) && str_contains( $delay, 'neo-pulse-chat-widget.js' ), 'still delays chat until idle' );
assert_true( str_contains( $delay, 'id="neo-pulse-delay-js"' ), 'injects the idle loader for delayed JS' );
assert_true( str_contains( $delay, 'elementor/assets/js/frontend.min.js' ) && ! str_contains( $delay, 'data-src="https://neodigital.ca/wp-content/plugins/elementor/assets/js/frontend.min.js"' ), 'keeps Elementor frontend on the page' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_delayed_script( 'https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/plugins/swiper/8.4.5/swiper.min.js' ), 'does not delay Swiper so Qi sliders can boot' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_delayed_script( 'https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/js/main.min.js' ), 'does not delay the script that defines qodefAddonsCore' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_delayed_script( 'https://neodigital.ca/wp-content/plugins/elementor/assets/lib/e-gallery/js/e-gallery.min.js' ), 'does not delay Elementor e-gallery' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_delayed_script( 'https://neodigital.ca/wp-content/plugins/elementor/assets/lib/jquery-numerator/jquery-numerator.min.js' ), 'does not delay Elementor numerator' );
assert_true( ! Neo_Pulse_Wp_Speed_Front::is_delayed_script( 'https://neodigital.ca/wp-content/plugins/neo-pulse-wp/assets/frontend/neo-pulse-elementor-waypoint.js' ), 'does not delay the waypoint helper the theme counters need' );

$print = Neo_Pulse_Wp_Speed_Front::batch_print_stylesheets( '<html><head><link rel="stylesheet" href="https://neodigital.ca/x.css" media="print" onload="this.media=\'all\'"></head><body></body></html>' );
assert_true( str_contains( $print, 'id="neo-pulse-apply-css"' ), 'batches print stylesheet apply' );
assert_true( str_contains( $print, 'data-neo-pulse-print="1"' ), 'marks print sheets for the batch flip' );
assert_true( ! preg_match( '/onload=/i', $print ), 'drops per-link onload handlers' );

Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	return str_contains( $href, '-150x150' ) ? __DIR__ . '/data/tiny-layout.css' : null;
};
$logo = Neo_Pulse_Wp_Speed_Front::tighten_img_sizes( '<img src="https://neodigital.ca/wp-content/uploads/2023/04/WordPress_blue_logo.svg_.png" width="2048" height="2048">' );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
assert_true( str_contains( $logo, 'WordPress_blue_logo.svg_-150x150.png' ), 'points the WordPress logo at the 150px thumb' );
assert_true( str_contains( $logo, 'sizes="40px"' ), 'keeps the logo display width at 40px' );

Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	return str_contains( $href, 'edmonton.webp' ) ? __DIR__ . '/data/tiny-layout.css' : null;
};
$edm = Neo_Pulse_Wp_Speed_Front::tighten_img_sizes( '<link rel="preload" as="image" href="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png" fetchpriority="high"><img src="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png" srcset="https://neodigital.ca/wp-content/uploads/2026/02/edmonton.png 482w, https://neodigital.ca/wp-content/uploads/2026/02/edmonton-288x300.png 288w">' );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
assert_true( str_contains( $edm, 'edmonton.webp' ), 'uses the existing edmonton webp when it is on disk' );
assert_true( ! str_contains( $edm, 'edmonton.png' ), 'drops the edmonton PNG srcset so mobile does not fetch 57 KiB' );
assert_true( str_contains( $edm, 'rel="preload" as="image"' ) && str_contains( $edm, 'edmonton.webp' ) && ! str_contains( $edm, 'edmonton.png' ), 'preloads the webp instead of the PNG' );

Neo_Pulse_Wp_Speed_Front::$path_resolver = static function ( string $href ) {
	return str_contains( $href, 'poppins' ) ? __DIR__ . '/data/tiny-poppins.css' : null;
};
$font_html = '<html><head><link rel="stylesheet" id="elementor-gf-local-poppins-css" href="https://neodigital.ca/wp-content/uploads/elementor/google-fonts/css/poppins.css"></head><body><h1>Edmonton Website Design</h1></body></html>';
$font_out  = Neo_Pulse_Wp_Speed_Front::process( $font_html, $config );
Neo_Pulse_Wp_Speed_Front::$path_resolver = null;
assert_true( str_contains( $font_out, 'rel="preload" as="font"' ) && str_contains( $font_out, 'poppins-pxieyp8kv8jhgfvrjjfecg.woff2' ), 'preloads latin Poppins so the H1 does not swap' );
assert_true( str_contains( $font_out, 'id="neo-pulse-heading-font"' ) && str_contains( $font_out, 'font-weight:700' ), 'inlines the heading @font-face' );
assert_true( str_contains( $font_out, 'font-size:8.25rem' ), 'reserves the hero H1 size before kit CSS' );
assert_true( str_contains( $font_out, '@media(max-width:767px)' ) && str_contains( $font_out, 'font-size:3rem' ), 'reserves the mobile H1 size so the heading does not shrink' );
assert_true( str_contains( $font_out, 'body.home .elementor-element-39ac587{display:flex!important' ) && str_contains( $font_out, 'ygency-info-box.text-left,body.home .ygency-info-box .box-title' ), 'centers homepage counters and service boxes on a real phone' );
assert_true( str_contains( $font_out, 'padding-left:max(1.5rem,calc(env(safe-area-inset-left,0px)+1.5rem))' ), 'adds phone-safe hero padding so Pixel text is not edge-tight' );

$inner = '<html><head></head><body class="wp-singular page page-id-1064"><main id="ygency-content"><div class="elementor-element elementor-element-1ea21ab e-flex e-con-boxed e-con e-parent"><h1>Our Work.</h1></div></main></body></html>';
$inner_css = Neo_Pulse_Wp_Speed_Front::first_paint_css( $inner );
assert_true( ! str_contains( $inner_css, '.elementor-element-1ea21ab{margin-top:-100px' ), 'does not reserve a desktop hero pad on inner pages' );
assert_true( str_contains( $inner_css, 'body:not(.home) h1{font-family:Poppins,sans-serif;color:#fff' ), 'inner H1 gets the font without a fake size' );
assert_true( str_contains( $inner_css, 'body.home h1' ) && str_contains( $inner_css, 'font-size:8.25rem' ), 'homepage H1 reserve stays scoped to home' );

$logo_hi = Neo_Pulse_Wp_Speed_Front::tighten_img_sizes( '<img decoding="async" width="150" height="150" src="https://neodigital.ca/wp-content/uploads/2023/04/Wordpress-logo.png" class="attachment-qi_addons_for_elementor_image_size_square" alt="WordPress">' );
assert_true( str_contains( $logo_hi, 'wordpress-logo-512.webp' ) && str_contains( $logo_hi, 'width="512"' ), 'serves the AI-upscaled WordPress slider logo' );
assert_true( is_readable( dirname( __DIR__ ) . '/assets/frontend/wordpress-logo-512.webp' ), 'upscaled WordPress logo is in plugin assets' );

$sw = Neo_Pulse_Wp_Speed_Front::hoist_swiper( '<html><body><script src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/js/main.min.js"></script><script src="https://neodigital.ca/wp-content/themes/ygency/assets/js/theme.min.js"></script><script src="https://neodigital.ca/wp-content/plugins/qi-addons-for-elementor/assets/plugins/swiper/8.4.5/swiper.min.js"></script></body></html>' );
assert_true( (int) strpos( $sw, 'swiper.min.js' ) < (int) strpos( $sw, 'qi-addons-for-elementor/assets/js/main.min.js' ), 'loads Swiper before Qi so the console stays clean' );

echo $failed > 0 ? "\n{$failed} test(s) failed.\n" : "\nAll speed front LCP tests passed.\n";
exit( $failed > 0 ? 1 : 0 );

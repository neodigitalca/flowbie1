<?php
/**
 * Safe front-end HTML optimizations (fonts, preconnect, render-blocking CSS).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Head-level optimizations that do not combine or strip theme/builder assets.
 */
class Neo_Pulse_Wp_Speed_Front {

	const CSS_CACHE_SALT = 'fdswap2';

	/**
	 * Test override for wp_is_mobile(). Null uses WordPress.
	 *
	 * @var bool|null
	 */
	public static $mobile_request = null;

	/**
	 * @param string               $html   Buffered HTML.
	 * @param array<string, mixed> $config Speed settings.
	 */
	public static function process( string $html, array $config ): string {
		if ( empty( $config['enabled'] ) ) {
			return $html;
		}

		if ( ! empty( $config['font_display_swap'] ) ) {
			$html = self::ensure_google_fonts_display_swap( $html );
			$html = self::ensure_inline_font_display_swap( $html );
		}

		if ( ! empty( $config['preconnect_fonts'] ) ) {
			$html = self::inject_font_preconnect( $html );
		}

		if ( ! empty( $config['async_google_fonts'] ) ) {
			$html = self::async_google_font_stylesheets( $html );
		}

		$html = self::stamp_attachment_dimensions( $html );
		$html = self::preload_lcp_image( $html );
		$html = self::reserve_overlay_lcp_box( $html );
		$html = self::pin_absolute_images( $html );
		$html = self::reveal_first_paint( $html );
		$html = self::inject_first_paint_css( $html );
		$html = self::defer_render_blocking_styles( $html );
		$html = self::inline_blocking_stylesheets( $html );
		$html = self::combine_blocking_stylesheets( $html );
		if ( self::is_mobile_request() ) {
			$html = self::unblock_remaining_stylesheets( $html );
		}
		if ( ! empty( $config['font_display_swap'] ) ) {
			$html = self::swap_font_stylesheets( $html );
		}
		$html = self::promote_hero_background( $html );
		$html = self::inject_heading_font( $html );
		$html = self::relocate_head_jquery( $html );
		$html = self::hoist_swiper( $html );
		$html = self::delay_below_fold_scripts( $html );
		$html = self::batch_print_stylesheets( $html );
		$html = self::tighten_img_sizes( $html );
		$html = self::hoist_lcp_preload( $html );
		$html = self::hoist_style_preloads( $html );

		return $html;
	}

	/**
	 * Add display=swap to Google Fonts stylesheet URLs.
	 *
	 * @param string $html HTML.
	 */
	private static function ensure_google_fonts_display_swap( string $html ): string {
		return (string) preg_replace_callback(
			'#<link\b([^>]*)\bhref=(["\'])((?:https?:)?//fonts\.googleapis\.com/[^"\']+)\2([^>]*)>#i',
			static function ( $m ) {
				$url = self::url_with_display_swap( $m[3] );
				return '<link' . $m[1] . 'href="' . esc_url( $url ) . '"' . $m[4] . '>';
			},
			$html
		);
	}

	/**
	 * @param string $url Google Fonts CSS URL.
	 */
	public static function url_with_display_swap( string $url ): string {
		if ( str_starts_with( $url, '//' ) ) {
			$url = 'https:' . $url;
		}
		if ( stripos( $url, 'display=' ) !== false ) {
			return $url;
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return $url;
		}
		$query = array();
		if ( ! empty( $parts['query'] ) ) {
			parse_str( $parts['query'], $query );
		}
		$query['display'] = 'swap';
		$parts['query']   = http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );
		return self::build_url( $parts );
	}

	/**
	 * @param array<string, mixed> $parts wp_parse_url parts.
	 */
	private static function build_url( array $parts ): string {
		$scheme = isset( $parts['scheme'] ) ? $parts['scheme'] . '://' : '';
		$host   = $parts['host'] ?? '';
		$port   = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		$path   = $parts['path'] ?? '';
		$query  = isset( $parts['query'] ) && $parts['query'] !== '' ? '?' . $parts['query'] : '';
		return $scheme . $host . $port . $path . $query;
	}

	/**
	 * Inject font-display:swap into inline @font-face rules.
	 *
	 * @param string $html HTML.
	 */
	private static function ensure_inline_font_display_swap( string $html ): string {
		return (string) preg_replace_callback(
			'#<style\b([^>]*)>(.*?)</style>#is',
			static function ( $m ) {
				$css = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $m[2] );
				return '<style' . $m[1] . '>' . $css . '</style>';
			},
			$html
		);
	}

	/**
	 * Preconnect to Google Fonts origins when those assets appear on the page.
	 *
	 * @param string $html HTML.
	 */
	private static function inject_font_preconnect( string $html ): string {
		$uses_google = stripos( $html, 'fonts.googleapis.com' ) !== false
			|| stripos( $html, 'fonts.gstatic.com' ) !== false;
		if ( ! $uses_google ) {
			return $html;
		}

		$snippets = '';
		if ( stripos( $html, 'href="https://fonts.googleapis.com"' ) === false
			&& stripos( $html, "href='https://fonts.googleapis.com'" ) === false ) {
			$snippets .= '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>';
		}
		if ( stripos( $html, 'href="https://fonts.gstatic.com"' ) === false
			&& stripos( $html, "href='https://fonts.gstatic.com'" ) === false ) {
			$snippets .= '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
		}
		if ( $snippets === '' ) {
			return $html;
		}

		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $snippets, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Load Google Fonts CSS without blocking first paint (print media trick).
	 *
	 * @param string $html HTML.
	 */
	private static function async_google_font_stylesheets( string $html ): string {
		return (string) preg_replace_callback(
			'#<link\b([^>]*)\bhref=(["\'])((?:https?:)?//fonts\.googleapis\.com/[^"\']+)\2([^>]*)>#i',
			static function ( $m ) {
				$full = $m[0];
				if ( stripos( $full, 'stylesheet' ) === false ) {
					return $full;
				}
				if ( stripos( $full, 'onload=' ) !== false ) {
					return $full;
				}
				$url = self::url_with_display_swap( $m[3] );
				$tag = '<link' . $m[1] . 'href="' . esc_url( $url ) . '"' . $m[4] . '>';
				$tag = (string) preg_replace( '/\smedia=(["\'])[^"\']*\1/i', '', $tag );
				return preg_replace( '#\s*/?\s*>$#', ' media="print" onload="this.media=\'all\'">', rtrim( $tag, '>' ) . '>' ) ?? $full;
			},
			$html
		);
	}

	/**
	 * Stamp width/height from WP attachment metadata when an img is missing them.
	 *
	 * @param string $html HTML.
	 */
	public static function stamp_attachment_dimensions( string $html ): string {
		return (string) preg_replace_callback(
			'#<img\b([^>]*)>#i',
			static function ( $m ) {
				$attrs = $m[1];
				if ( preg_match( '/\bwidth\s*=/i', $attrs ) && preg_match( '/\bheight\s*=/i', $attrs ) ) {
					return $m[0];
				}
				if ( ! preg_match( '/\b(?:src|data-src|nitro-lazy-src)\s*=\s*(["\'])([^"\']+)\1/i', $attrs, $u ) ) {
					return $m[0];
				}
				$url = self::url_without_query( $u[2] );
				if ( $url === '' || ! function_exists( 'attachment_url_to_postid' ) ) {
					return $m[0];
				}
				$attachment_id = (int) attachment_url_to_postid( $url );
				if ( $attachment_id < 1 || ! function_exists( 'wp_get_attachment_metadata' ) ) {
					return $m[0];
				}
				$meta = wp_get_attachment_metadata( $attachment_id );
				if ( ! is_array( $meta ) || empty( $meta['width'] ) || empty( $meta['height'] ) ) {
					return $m[0];
				}
				$out = $attrs;
				if ( ! preg_match( '/\bwidth\s*=/i', $out ) ) {
					$out .= ' width="' . (int) $meta['width'] . '"';
				}
				if ( ! preg_match( '/\bheight\s*=/i', $out ) ) {
					$out .= ' height="' . (int) $meta['height'] . '"';
				}
				return '<img' . $out . '>';
			},
			$html
		);
	}

	/**
	 * Eager-load the first large body image. NitroPack often lazy-loads the LCP
	 * and also injects a preload for a different file; do not bail on that.
	 *
	 * @param string $html HTML.
	 */
	public static function preload_lcp_image( string $html ): string {
		$chosen = self::find_lcp_image( $html );
		if ( $chosen === null ) {
			return $html;
		}

		$new_tag = self::unlazy_lcp_img_tag( $chosen['tag'], $chosen['url'] );
		$pos     = strpos( $html, $chosen['tag'] );
		if ( $pos !== false && $new_tag !== $chosen['tag'] ) {
			$html = substr_replace( $html, $new_tag, $pos, strlen( $chosen['tag'] ) );
			$html = self::reveal_lcp_widget( $html, $new_tag, $pos );
		} elseif ( $pos !== false ) {
			$html = self::reveal_lcp_widget( $html, $chosen['tag'], $pos );
		}

		if ( preg_match( '/rel=["\']preload["\'][^>]+' . preg_quote( $chosen['url'], '/' ) . '/i', $html ) ) {
			return $html;
		}

		$preload  = '<link rel="preload" as="image" href="' . esc_url( $chosen['url'] ) . '" fetchpriority="high">';
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $preload, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * @return array{tag:string,attrs:string,url:string}|null
	 */
	public static function find_lcp_image( string $html ): ?array {
		$body_pos = stripos( $html, '<body' );
		$search   = $body_pos === false ? $html : substr( $html, $body_pos );
		if ( ! preg_match_all( '#<img\b([^>]*)>#i', $search, $matches, PREG_SET_ORDER ) ) {
			return null;
		}

		foreach ( $matches as $m ) {
			$attrs = $m[1];
			$url   = self::real_img_url( $attrs );
			if ( $url === '' ) {
				continue;
			}
			$path = strtolower( (string) ( wp_parse_url( $url, PHP_URL_PATH ) ?? $url ) );
			if ( str_ends_with( $path, '.svg' ) ) {
				continue;
			}
			$width = 0;
			if ( preg_match( '/\bwidth\s*=\s*(["\']?)(\d+)\1/i', $attrs, $w ) ) {
				$width = (int) $w[2];
			}
			if ( $width > 0 && $width < 200 ) {
				continue;
			}
			return array(
				'tag'   => $m[0],
				'attrs' => $attrs,
				'url'   => $url,
			);
		}
		return null;
	}

	/**
	 * Prefer Nitro/data-src over a placeholder data URI.
	 */
	public static function real_img_url( string $attrs ): string {
		foreach ( array( 'nitro-lazy-src', 'data-src', 'src' ) as $attr ) {
			if ( ! preg_match( '/\b' . preg_quote( $attr, '/' ) . '\s*=\s*(["\'])([^"\']+)\1/i', $attrs, $u ) ) {
				continue;
			}
			$url = $u[2];
			if ( $url !== '' && stripos( $url, 'data:' ) !== 0 ) {
				return $url;
			}
		}
		return '';
	}

	/**
	 * Put the real URL on src and drop Nitro lazy placeholders.
	 */
	public static function unlazy_lcp_img_tag( string $tag, string $url ): string {
		$safe = esc_url( $url );
		if ( preg_match( '/\ssrc=(["\'])data:[^"\']*\1/i', $tag ) ) {
			$tag = (string) preg_replace( '/\ssrc=(["\'])data:[^"\']*\1/i', ' src="' . $safe . '"', $tag, 1 );
		} elseif ( ! preg_match( '/\ssrc=/i', $tag ) ) {
			$tag = (string) preg_replace( '/^<img/i', '<img src="' . $safe . '"', $tag, 1 );
		} elseif ( ! preg_match( '/\ssrc=(["\'])' . preg_quote( $url, '/' ) . '\1/i', $tag ) ) {
			$tag = (string) preg_replace( '/\ssrc=(["\'])[^"\']*\1/i', ' src="' . $safe . '"', $tag, 1 );
		}

		$tag = (string) preg_replace( '/\s(?:nitro-lazy-src|data-src)=(["\'])[^"\']*\1/i', '', $tag );
		$tag = (string) preg_replace( '/\snitro-lazy-srcset=/i', ' srcset=', $tag );
		$tag = (string) preg_replace_callback(
			'/\sclass=(["\'])([^"\']*)\1/i',
			static function ( $m ) {
				$cls = trim( (string) preg_replace( '/\s+/', ' ', (string) preg_replace( '/\bnitro-lazy(?:-empty)?\b/', '', $m[2] ) ) );
				return $cls === '' ? '' : ' class="' . $cls . '"';
			},
			$tag
		);
		$tag = (string) preg_replace( '/\sloading=(["\'])lazy\1/i', ' loading="eager"', $tag );
		if ( stripos( $tag, 'loading=' ) === false ) {
			$tag = (string) preg_replace( '/^<img/i', '<img loading="eager"', $tag, 1 );
		}
		if ( stripos( $tag, 'fetchpriority' ) === false ) {
			$tag = (string) preg_replace( '/^<img/i', '<img fetchpriority="high"', $tag, 1 );
		}
		if ( stripos( $tag, 'decoding=' ) === false ) {
			$tag = (string) preg_replace( '/^<img/i', '<img decoding="async"', $tag, 1 );
		}
		return $tag;
	}

	/**
	 * Elementor entrance animations start as visibility:hidden until JS.
	 */
	public static function reveal_lcp_widget( string $html, string $img_tag, int $img_pos ): string {
		$start = max( 0, $img_pos - 1200 );
		$len   = $img_pos - $start;
		if ( $len < 1 ) {
			return $html;
		}
		$chunk = substr( $html, $start, $len );
		$next  = $chunk;
		$next  = str_replace( 'elementor-invisible', '', $next );
		$next  = (string) preg_replace( '/\bnitro-lazy\b/', '', $next );
		$next  = (string) preg_replace( '/\s*nitro-elementor-animation="[^"]*"/i', '', $next );
		if ( $next === $chunk ) {
			return $html;
		}
		return substr_replace( $html, $next, $start, $len );
	}

	/**
	 * Reserve the first Elementor overlay-background container so late CSS cannot shift it.
	 * Also preload that overlay image when it is the LCP (common on builder heroes).
	 *
	 * @param string $html HTML.
	 */
	public static function reserve_overlay_lcp_box( string $html ): string {
		$url = '';
		if ( preg_match( '/\.elementor-element(?:\.elementor-element)?-[a-z0-9]+:{1,2}before\{[^}]*background-image:\s*url\((["\']?)([^"\')]+)\1\)/i', $html, $m ) ) {
			$url = $m[2];
		} elseif ( preg_match( '#https?://[^"\']+hero-line\.[a-z0-9]+#i', $html, $u ) ) {
			$url = $u[0];
		}
		if ( $url === '' || stripos( $url, 'data:' ) === 0 ) {
			return $html;
		}
		if ( preg_match( '/rel=["\']preload["\'][^>]+' . preg_quote( $url, '/' ) . '/i', $html ) ) {
			return $html;
		}

		$preload  = '<link rel="preload" as="image" href="' . esc_url( $url ) . '">';
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $preload, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Pin Elementor absolute images so late decode cannot shift the page.
	 *
	 * @param string $html HTML.
	 */
	public static function pin_absolute_images( string $html ): string {
		if ( ! preg_match_all( '/<div[^>]*class="[^"]*elementor-element-([a-z0-9]+)[^"]*elementor-absolute[^"]*elementor-widget-image[^"]*"[^>]*>.*?<img\b([^>]*)>/is', $html, $matches, PREG_SET_ORDER ) ) {
			return $html;
		}

		$rules = array();
		foreach ( $matches as $m ) {
			$id = preg_replace( '/[^a-z0-9]/i', '', $m[1] );
			$w  = 0;
			$h  = 0;
			if ( preg_match( '/\bwidth\s*=\s*(["\']?)(\d+)\1/i', $m[2], $wm ) ) {
				$w = (int) $wm[2];
			}
			if ( preg_match( '/\bheight\s*=\s*(["\']?)(\d+)\1/i', $m[2], $hm ) ) {
				$h = (int) $hm[2];
			}
			if ( $id === '' || $w < 1 || $h < 1 ) {
				continue;
			}
			$rules[] = '.elementor-element-' . $id . '{position:absolute;overflow:hidden;aspect-ratio:' . $w . '/' . $h . '}';
		}
		if ( $rules === array() || stripos( $html, 'id="neo-pulse-speed-abs-img"' ) !== false ) {
			return $html;
		}

		$style    = '<style id="neo-pulse-speed-abs-img">' . implode( '', $rules ) . '</style>';
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $style, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Keep the first main-section widgets visible so FCP/LCP do not wait for Elementor JS.
	 */
	public static function reveal_first_paint( string $html ): string {
		$start = stripos( $html, '<main' );
		if ( $start === false ) {
			$start = stripos( $html, 'data-elementor-type="wp-page"' );
		}
		if ( $start === false ) {
			return $html;
		}
		$len   = min( 24000, strlen( $html ) - $start );
		$chunk = substr( $html, $start, $len );
		$count = 0;
		$next  = preg_replace_callback(
			'/\belementor-invisible\b/',
			static function ( $m ) use ( &$count ) {
				unset( $m );
				$count++;
				return $count <= 8 ? '' : 'elementor-invisible';
			},
			$chunk
		);
		if ( ! is_string( $next ) ) {
			return $html;
		}
		$next = (string) preg_replace(
			'/\sdata-settings="\{&quot;_animation&quot;:&quot;[A-Za-z]+&quot;\}"/',
			'',
			$next
		);
		if ( $next === $chunk ) {
			return $html;
		}
		return substr_replace( $html, $next, $start, $len );
	}

	public static function hero_box_css( string $bg_url = '' ): string {
		$bg = $bg_url === ''
			? ''
			: 'background-image:url(' . $bg_url . ');background-size:cover;background-position:center';
		return '.elementor-element-a3d0229{margin-top:-100px;padding:14rem 5% 3rem;background-color:#02050A;' . $bg . '}@media(max-width:1024px){.elementor-element-a3d0229{padding:10rem 5% 3rem}}@media(max-width:767px){.elementor-element-a3d0229{padding-left:max(1.5rem,calc(env(safe-area-inset-left,0px)+1.5rem))!important;padding-right:max(1.5rem,calc(env(safe-area-inset-right,0px)+1.5rem))!important}}';
	}

	public static function mobile_home_css(): string {
		return '@media(max-width:767px){html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}body.home .e-con-boxed>.e-con-inner{padding-left:max(1.25rem,env(safe-area-inset-left,0px))!important;padding-right:max(1.25rem,env(safe-area-inset-right,0px))!important}body.home .qodef-m-text,body.home .ygency-section-title,body.home .elementor-element-cd71347{text-align:center!important}body.home .elementor-element-39ac587{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;justify-content:center!important;align-items:flex-start!important;gap:.6rem!important;width:100%!important}body.home .elementor-element-39ac587>.elementor-element{flex:1 1 0!important;max-width:33%!important}body.home .ygency-counter-box,body.home .ygency-counter-box.text-left,body.home .ygency-counter-box .counter-wrap,body.home .ygency-counter-box .counter-title{text-align:center!important}body.home .ygency-counter-box .counter-wrap{display:flex!important;justify-content:center!important;align-items:baseline}body.home .ygency-counter-box .elementor-counter-number,body.home .ygency-counter-box .counter-suffix{font-size:clamp(1.55rem,6.8vw,2.25rem)!important;line-height:1.1!important}body.home .elementor-element-aeb7d82{justify-content:center!important;justify-items:center!important}body.home .ygency-info-box,body.home .ygency-info-box.text-left,body.home .ygency-info-box .box-title,body.home .ygency-info-box .description{text-align:center!important}body.home .ygency-info-box .box-title{justify-content:center!important}}';
	}

	public static function first_paint_css( string $html = '' ): string {
		unset( $html );
		$home_h1  = 'body.home h1,body.home .elementor-element-a71df32 .elementor-heading-title{font-family:Poppins,sans-serif;font-size:8.25rem;line-height:1em;color:#fff}body.home h1 .highlight-primary{color:#84bd00}@media(max-width:1200px){body.home h1,body.home .elementor-element-a71df32 .elementor-heading-title{font-size:6.25rem}}@media(max-width:1024px){body.home h1,body.home .elementor-element-a71df32 .elementor-heading-title{font-size:5rem}}@media(max-width:767px){body.home h1,body.home .elementor-element-a71df32 .elementor-heading-title{font-size:3rem}}';
		$inner_h1 = 'body:not(.home) h1{font-family:Poppins,sans-serif;color:#fff;line-height:1em}body:not(.home) h1 .highlight-primary{color:#84bd00}';
		return '<style id="neo-pulse-first-paint">.elementor-invisible{visibility:visible!important;opacity:1!important}html,body{background-color:#02050A;margin:0;color:#e8e8e8}' . $home_h1 . $inner_h1 . self::hero_box_css() . self::mobile_home_css() . 'img.wp-image-7863,img[src*="edmonton.png"],img[src*="edmonton.webp"]{max-width:100%;height:auto;aspect-ratio:482/502}.elementor-shortcode{color:#e8e8e8}</style>';
	}

	/**
	 * PSI mobile uses a phone UA. Desktop stays on the blocking layout sheet.
	 */
	public static function is_mobile_request(): bool {
		if ( self::$mobile_request !== null ) {
			return self::$mobile_request;
		}
		return function_exists( 'wp_is_mobile' ) && wp_is_mobile();
	}

	public static function inject_first_paint_css( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-first-paint"' ) !== false ) {
			return $html;
		}
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . self::first_paint_css( $html ), $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Defer icon/font/animation CSS only. Layout sheets stay blocking so CLS stays down.
	 */
	public static function is_deferred_stylesheet( string $href ): bool {
		$href = strtolower( $href );
		if ( str_contains( $href, 'swiper' ) || str_contains( $href, 'qi-addons' ) ) {
			return false;
		}
		foreach ( array(
			'font-awesome',
			'fontawesome',
			'eicons',
			'/brands.min.css',
			'animations/styles',
			'popup.min.css',
			'motion-fx',
			'essential-addons',
			'fonts.googleapis',
			'google-fonts',
			'robotoslab',
			'/roboto.css',
			'/poppins.css',
			'widget-gallery',
			'e-gallery',
			'transitions.min.css',
			'widget-social-icons',
			'helper-parts',
		) as $needle ) {
			if ( str_contains( $href, $needle ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Optional path resolver for tests.
	 *
	 * @var callable|null
	 */
	public static $path_resolver = null;

	/**
	 * Optional combined-CSS writer for tests.
	 *
	 * @var callable|null
	 */
	public static $combined_css_writer = null;

	/**
	 * Inline remaining layout CSS so it cannot become a render-blocking request.
	 */
	public static function inline_blocking_stylesheets( string $html ): string {
		$used = 0;
		$next = preg_replace_callback(
			'#<link\b[^>]*>#i',
			static function ( $m ) use ( &$used ) {
				$tag = $m[0];
				if ( stripos( $tag, 'stylesheet' ) === false ) {
					return $tag;
				}
				if ( stripos( $tag, 'onload=' ) !== false || preg_match( '/media=(["\'])print\1/i', $tag ) ) {
					return $tag;
				}
				$href = '';
				if ( preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
					$href = $u[2];
				}
				if ( $href === '' || self::is_deferred_stylesheet( $href ) ) {
					return $tag;
				}
				$path = self::resolve_stylesheet_path( $href );
				if ( $path === null || ! is_readable( $path ) ) {
					return $tag;
				}
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				$css = file_get_contents( $path );
				if ( ! is_string( $css ) || $css === '' || strlen( $css ) > 12000 || ( $used + strlen( $css ) ) > 40000 ) {
					return $tag;
				}
				$used += strlen( $css );
				if ( class_exists( 'Neo_Pulse_Wp_Speed_Minify', false ) ) {
					$css = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls( $css, $href );
					$css = Neo_Pulse_Wp_Speed_Minify::css( $css );
				}
				$css = str_replace( '</style>', '', $css );
				return '<style data-href="' . ( function_exists( 'esc_attr' ) ? esc_attr( $href ) : $href ) . '">' . $css . '</style>';
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * One blocking stylesheet instead of five on Slow 4G.
	 */
	public static function combine_blocking_stylesheets( string $html ): string {
		if ( ! preg_match_all( '#<link\b[^>]*>#i', $html, $matches ) ) {
			return $html;
		}
		$bundle = array();
		foreach ( $matches[0] as $tag ) {
			if ( stripos( $tag, 'stylesheet' ) === false ) {
				continue;
			}
			if ( stripos( $tag, 'onload=' ) !== false || preg_match( '/media=(["\'])print\1/i', $tag ) ) {
				continue;
			}
			$href = '';
			if ( preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
				$href = $u[2];
			}
			if ( $href === '' || self::is_deferred_stylesheet( $href ) ) {
				continue;
			}
			$path = self::resolve_stylesheet_path( $href );
			if ( $path === null || ! is_readable( $path ) ) {
				continue;
			}
			$bundle[] = array(
				'tag'  => $tag,
				'href' => $href,
				'path' => $path,
			);
		}
		if ( count( $bundle ) < 2 ) {
			return $html;
		}
		$css = '';
		$key = '';
		foreach ( $bundle as $row ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$chunk = file_get_contents( $row['path'] );
			if ( ! is_string( $chunk ) || $chunk === '' ) {
				return $html;
			}
			if ( class_exists( 'Neo_Pulse_Wp_Speed_Minify', false ) ) {
				$chunk = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls( $chunk, $row['href'] );
				$chunk = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $chunk );
				$chunk = Neo_Pulse_Wp_Speed_Minify::css( $chunk );
			}
			$css .= $chunk . "\n";
			$key .= $row['href'] . '|' . filesize( $row['path'] ) . '|' . filemtime( $row['path'] ) . "\n";
		}
		$url = self::write_combined_css( $css, $key );
		if ( $url === null || $url === '' ) {
			return $html;
		}
		$combined = '<link rel="stylesheet" href="' . ( function_exists( 'esc_url' ) ? esc_url( $url ) : $url ) . '">';
		$first    = true;
		foreach ( $bundle as $row ) {
			$html  = str_replace( $row['tag'], $first ? $combined : '', $html );
			$first = false;
		}
		return $html;
	}

	public static function write_combined_css( string $css, string $key ): ?string {
		if ( is_callable( self::$combined_css_writer ) ) {
			$written = call_user_func( self::$combined_css_writer, $css, $key );
			return is_string( $written ) && $written !== '' ? $written : null;
		}
		if ( ! class_exists( 'Neo_Pulse_Wp_Speed_Cache', false ) ) {
			return null;
		}
		$hash = md5( $key . '|' . self::CSS_CACHE_SALT );
		$have = Neo_Pulse_Wp_Speed_Cache::get_url( 'css', $hash );
		if ( $have !== null ) {
			return $have;
		}
		return Neo_Pulse_Wp_Speed_Cache::write( 'css', $hash, $css );
	}

	/**
	 * Kept for tests. Layout CSS stays blocking so first paint does not snap.
	 */
	public static function unblock_remaining_stylesheets( string $html ): string {
		$next = preg_replace_callback(
			'#<link\b[^>]*>#i',
			static function ( $m ) {
				$tag = $m[0];
				if ( stripos( $tag, 'stylesheet' ) === false ) {
					return $tag;
				}
				if ( stripos( $tag, 'onload=' ) !== false || preg_match( '/media=(["\'])print\1/i', $tag ) ) {
					return $tag;
				}
				$href = '';
				if ( preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
					$href = $u[2];
				}
				if ( $href === '' || self::is_deferred_stylesheet( $href ) ) {
					return $tag;
				}
				$safe = function_exists( 'esc_url' ) ? esc_url( $href ) : $href;
				$tag  = (string) preg_replace( '/\smedia=(["\'])[^"\']*\1/i', '', $tag );
				$out  = preg_replace( '#\s*/?\s*>$#', ' media="print" onload="this.media=\'all\'">', rtrim( $tag, '>' ) . '>' );
				$link = is_string( $out ) ? $out : $tag;
				return '<link rel="preload" as="style" href="' . $safe . '">' . $link;
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	public static function hoist_lcp_preload( string $html ): string {
		if ( ! preg_match_all( '/<link rel="preload" as="image"[^>]*>/i', $html, $m ) ) {
			return $html;
		}
		$high = array();
		$rest = array();
		foreach ( $m[0] as $tag ) {
			$html = str_replace( $tag, '', $html );
			if ( stripos( $tag, 'fetchpriority="high"' ) !== false ) {
				$high[] = $tag;
			} else {
				$rest[] = $tag;
			}
		}
		$bundle   = implode( '', $high ) . implode( '', $rest );
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $bundle, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	public static function hoist_style_preloads( string $html ): string {
		if ( ! preg_match_all( '/<link rel="preload" as="style"[^>]*>/i', $html, $m ) ) {
			return $html;
		}
		foreach ( $m[0] as $tag ) {
			$html = str_replace( $tag, '', $html );
		}
		$bundle = implode( '', $m[0] );
		if ( ! preg_match( '/<head[^>]*>/i', $html, $h, PREG_OFFSET_CAPTURE ) ) {
			return $html;
		}
		$pos  = $h[0][1] + strlen( $h[0][0] );
		$rest = substr( $html, $pos );
		while ( preg_match( '/^<link rel="preload" as="(?:image|font)"[^>]*>/i', $rest, $skip ) ) {
			$pos += strlen( $skip[0] );
			$rest = substr( $html, $pos );
		}
		return substr_replace( $html, $bundle, $pos, 0 );
	}

	/**
	 * Rewrite local font CSS so font-display:block/auto becomes swap.
	 */
	public static function swap_font_stylesheets( string $html ): string {
		$next = preg_replace_callback(
			'#<link\b[^>]*>#i',
			static function ( $m ) {
				$tag = $m[0];
				if ( ! preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
					return $tag;
				}
				$href = $u[2];
				if ( $href === '' || str_contains( $href, '/cache/neo-pulse-speed/' ) || ! self::is_font_stylesheet( $href ) ) {
					return $tag;
				}
				$path = self::resolve_stylesheet_path( $href );
				if ( $path === null || ! is_readable( $path ) ) {
					return $tag;
				}
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				$css = file_get_contents( $path );
				if ( ! is_string( $css ) || $css === '' || stripos( $css, '@font-face' ) === false ) {
					return $tag;
				}
				if ( class_exists( 'Neo_Pulse_Wp_Speed_Minify', false ) ) {
					$css = Neo_Pulse_Wp_Speed_Minify::rewrite_relative_urls( $css, $href );
					$css = Neo_Pulse_Wp_Speed_Minify::ensure_font_display_swap( $css );
					$css = Neo_Pulse_Wp_Speed_Minify::css( $css );
				}
				$url = self::write_combined_css( $css, 'font-swap|' . $href . '|' . filesize( $path ) . '|' . filemtime( $path ) );
				if ( $url === null || $url === '' ) {
					return $tag;
				}
				return str_replace( $href, $url, $tag );
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	public static function is_font_stylesheet( string $href ): bool {
		$href = strtolower( $href );
		foreach ( array( 'font-awesome', 'fontawesome', 'eicons', 'poppins', 'roboto', '/webfonts/', '/fonts/' ) as $needle ) {
			if ( str_contains( $href, $needle ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array<int, string> weight => woff2 url
	 */
	public static function heading_font_urls_from_css( string $css ): array {
		$out = array();
		if ( ! preg_match_all( '/@font-face\s*\{([^}]*)\}/i', $css, $faces ) ) {
			return $out;
		}
		foreach ( $faces[1] as $body ) {
			if ( ! preg_match( '/font-style\s*:\s*normal/i', $body ) ) {
				continue;
			}
			if ( ! preg_match( '/font-weight\s*:\s*(400|700)/i', $body, $w ) ) {
				continue;
			}
			if ( ! preg_match( '/unicode-range\s*:\s*U\+0000/i', $body ) ) {
				continue;
			}
			if ( ! preg_match( '/url\((["\']?)([^"\')]+?\.woff2)\1\)/i', $body, $u ) ) {
				continue;
			}
			$out[ (int) $w[1] ] = $u[2];
		}
		return $out;
	}

	/**
	 * The 8.25rem H1 swaps from system UI to Poppins and shifts ~0.1 CLS.
	 */
	public static function inject_heading_font( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-heading-font"' ) !== false ) {
			return $html;
		}
		$href = '';
		if ( preg_match( '/id=(["\'])elementor-gf-local-poppins-css\1[^>]*href=(["\'])([^"\']+)\2/i', $html, $m ) ) {
			$href = $m[3];
		} elseif ( preg_match( '/href=(["\'])([^"\']*poppins[^"\']*\.css[^"\']*)\1/i', $html, $m ) ) {
			$href = $m[2];
		}
		if ( $href === '' ) {
			return $html;
		}
		$path = self::resolve_stylesheet_path( html_entity_decode( $href ) );
		if ( $path === null || ! is_readable( $path ) ) {
			return $html;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$css  = file_get_contents( $path );
		$urls = is_string( $css ) ? self::heading_font_urls_from_css( $css ) : array();
		if ( $urls === array() ) {
			return $html;
		}
		$pre  = '';
		$face = '';
		foreach ( $urls as $weight => $url ) {
			$safe  = function_exists( 'esc_url' ) ? esc_url( $url ) : $url;
			$pre  .= '<link rel="preload" as="font" type="font/woff2" href="' . $safe . '" crossorigin>';
			$face .= '@font-face{font-display:swap;font-family:Poppins;font-style:normal;font-weight:' . (int) $weight . ';src:url(' . $safe . ') format("woff2")}';
		}
		$block    = $pre . '<style id="neo-pulse-heading-font">' . $face . '</style>';
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $block, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * Hero LCP is often a CSS background, not an <img>. Put that URL in the HTML.
	 */
	public static function find_hero_background_url( string $html ): string {
		if ( preg_match( '/\.elementor-element(?:\.elementor-element)?-a3d0229[^{]*\{[^}]*background-image:\s*url\((["\']?)([^"\')]+)\1\)/i', $html, $m ) ) {
			return $m[2];
		}
		if ( ! preg_match_all( '/\bhref=(["\'])([^"\']+\.css[^"\']*)\1/i', $html, $links ) ) {
			return '';
		}
		foreach ( $links[2] as $href ) {
			if ( self::is_deferred_stylesheet( $href ) || self::is_font_stylesheet( $href ) ) {
				continue;
			}
			$path = self::resolve_stylesheet_path( $href );
			if ( $path === null || ! is_readable( $path ) ) {
				continue;
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$css = file_get_contents( $path );
			if ( ! is_string( $css ) || $css === '' ) {
				continue;
			}
			if ( preg_match( '/\.elementor-element(?:\.elementor-element)?-a3d0229[^{]*\{[^}]*background-image:\s*url\((["\']?)([^"\')]+)\1\)/i', $css, $m ) ) {
				return $m[2];
			}
		}
		return '';
	}

	public static function promote_hero_background( string $html ): string {
		$url = self::find_hero_background_url( $html );
		if ( $url === '' || stripos( $url, 'data:' ) === 0 ) {
			return $html;
		}
		$safe = function_exists( 'esc_url' ) ? esc_url( $url ) : $url;
		$html = str_replace( self::hero_box_css(), self::hero_box_css( $safe ), $html );
		if ( preg_match( '/rel=["\']preload["\'][^>]+' . preg_quote( $url, '/' ) . '/i', $html ) ) {
			return $html;
		}
		$preload  = '<link rel="preload" as="image" href="' . $safe . '" fetchpriority="high">';
		$replaced = preg_replace( '/<head(\b[^>]*)>/i', '<head$1>' . $preload, $html, 1 );
		return is_string( $replaced ) ? $replaced : $html;
	}

	public static function resolve_stylesheet_path( string $href ): ?string {
		if ( is_callable( self::$path_resolver ) ) {
			$resolved = call_user_func( self::$path_resolver, $href );
			return is_string( $resolved ) && $resolved !== '' ? $resolved : null;
		}
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Assets', false ) ) {
			return Neo_Pulse_Wp_Speed_Assets::resolve_local_path( $href );
		}
		return null;
	}

	/**
	 * Chat can wait until idle. Qi/Swiper must stay in document order.
	 */
	public static function is_delayed_script( string $src ): bool {
		$src = strtolower( $src );
		foreach ( array(
			'neo-pulse-chat-lazy',
			'neo-pulse-chat-widget',
		) as $needle ) {
			if ( str_contains( $src, $needle ) ) {
				return true;
			}
		}
		return false;
	}

	public static function delay_below_fold_scripts( string $html ): string {
		$count = 0;
		$next  = preg_replace_callback(
			'#<script\b([^>]*)\bsrc=(["\'])([^"\']+)\2([^>]*)>\s*</script>#i',
			static function ( $m ) use ( &$count ) {
				if ( ! self::is_delayed_script( $m[3] ) ) {
					return $m[0];
				}
				++$count;
				$safe = function_exists( 'esc_url' ) ? esc_url( $m[3] ) : $m[3];
				return '<script type="text/plain" data-neo-pulse-delay="1" data-src="' . $safe . '"></script>';
			},
			$html
		);
		if ( ! is_string( $next ) || $count < 1 ) {
			return $html;
		}
		if ( strpos( $next, 'id="neo-pulse-delay-js"' ) !== false ) {
			return $next;
		}
		$boot     = '<script id="neo-pulse-delay-js">!function(){function go(){var n=document.querySelectorAll("script[data-neo-pulse-delay]");for(var i=0;i<n.length;i++){var o=n[i],s=document.createElement("script");s.src=o.getAttribute("data-src");o.parentNode.insertBefore(s,o);o.parentNode.removeChild(o)}}function start(){if(window.requestIdleCallback)requestIdleCallback(go,{timeout:2500});else setTimeout(go,1)}if(document.readyState==="complete")start();else window.addEventListener("load",start)}();</script>';
		$replaced = preg_replace( '/<\/body>/i', $boot . '</body>', $next, 1 );
		return is_string( $replaced ) ? $replaced : $next;
	}

	/**
	 * One rAF flip instead of 20 onload handlers plus a 600 KB style recalc.
	 */
	public static function batch_print_stylesheets( string $html ): string {
		$next = preg_replace_callback(
			'#<link\b[^>]*>#i',
			static function ( $m ) {
				$tag = $m[0];
				if ( ! preg_match( '/this\.media\s*=\s*[\'"]all[\'"]/i', $tag ) && stripos( $tag, 'data-neo-pulse-print' ) === false ) {
					return $tag;
				}
				$tag = (string) preg_replace( '/\sonload=("[^"]*"|\'[^\']*\')/i', '', $tag );
				if ( stripos( $tag, 'data-neo-pulse-print' ) === false ) {
					$out = preg_replace( '#\s*/?\s*>$#', ' data-neo-pulse-print="1">', rtrim( $tag, '>' ) . '>' );
					$tag = is_string( $out ) ? $out : $tag;
				}
				return $tag;
			},
			$html
		);
		if ( ! is_string( $next ) ) {
			return $html;
		}
		if ( stripos( $next, 'data-neo-pulse-print' ) === false && ! preg_match( '/media=(["\'])print\1/i', $next ) ) {
			return $next;
		}
		if ( strpos( $next, 'id="neo-pulse-apply-css"' ) !== false ) {
			return $next;
		}
		$js       = '<script id="neo-pulse-apply-css">!function(){function g(){var n=document.querySelectorAll("link[data-neo-pulse-print],link[media=print][rel=stylesheet]");for(var i=0;i<n.length;i++)n[i].media="all"}function run(){if(window.requestAnimationFrame)requestAnimationFrame(function(){requestAnimationFrame(g)});else g()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run()}();</script>';
		$replaced = preg_replace( '/<\/head>/i', $js . '</head>', $next, 1 );
		return is_string( $replaced ) ? $replaced : $next;
	}

	/**
	 * Qi and the theme call Swiper on ready. The library printed after them.
	 */
	public static function hoist_swiper( string $html ): string {
		if ( ! preg_match( '#<script\b[^>]*\bsrc=(["\'])([^"\']*swiper[^"\']*)\1[^>]*>\s*</script>#i', $html, $m ) ) {
			return $html;
		}
		$tag  = $m[0];
		$html = str_replace( $tag, '', $html );
		if ( ! preg_match( '#<script\b[^>]*\bsrc=(["\'])([^"\']*(?:qi-addons-for-elementor/assets/js/|ygency)[^"\']*)\1#i', $html, $hit, PREG_OFFSET_CAPTURE ) ) {
			return $html . $tag;
		}
		return substr_replace( $html, $tag, (int) $hit[0][1], 0 );
	}

	public static function plugin_frontend_url( string $rel ): string {
		if ( ! function_exists( 'plugins_url' ) || ! defined( 'NEO_PULSE_WP_PLUGIN_FILE' ) ) {
			return '';
		}
		$url = plugins_url( $rel, NEO_PULSE_WP_PLUGIN_FILE );
		return function_exists( 'esc_url' ) ? esc_url( $url ) : $url;
	}

	/**
	 * Keep jQuery after first paint. Leaving it in head blocks LCP.
	 */
	public static function relocate_head_jquery( string $html ): string {
		if ( ! preg_match_all( '#<script\b[^>]*\bid=(["\'])jquery-(?:core|migrate)-js\1[^>]*>\s*</script>#i', $html, $m ) ) {
			return $html;
		}
		$bundle = implode( '', $m[0] );
		foreach ( $m[0] as $tag ) {
			$html = str_replace( $tag, '', $html );
		}
		$anchor = strpos( $html, 'id="jquery-ui-core-js-before"' );
		if ( $anchor === false ) {
			$anchor = strpos( $html, "id='jquery-ui-core-js-before'" );
		}
		if ( $anchor === false ) {
			$body = stripos( $html, '</body>' );
			if ( $body === false ) {
				return $html . $bundle;
			}
			return substr_replace( $html, $bundle, $body, 0 );
		}
		$script = strrpos( substr( $html, 0, $anchor ), '<script' );
		if ( $script === false ) {
			return substr_replace( $html, $bundle, $anchor, 0 );
		}
		return substr_replace( $html, $bundle, $script, 0 );
	}

	/**
	 * Tell the browser the real display width so srcset can pick a smaller file.
	 */
	public static function tighten_img_sizes( string $html ): string {
		$next = preg_replace_callback(
			'#<img\b[^>]*>#i',
			static function ( $m ) {
				$tag = $m[0];
				$src = '';
				if ( preg_match( '/\b(?:src|srcset)=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
					$src = $u[2];
				}
				$sizes = '';
				if ( preg_match( '/Mobile\.(?:jpg|jpeg|webp|png)/i', $src ) || preg_match( '/-mobile\.(?:jpg|jpeg|webp|png)/i', $src ) ) {
					$sizes = '(max-width: 767px) 45vw, 280px';
				} elseif ( preg_match( '/(?:Desktop|desktp|desktop)-768/i', $src ) || preg_match( '/(?:Desktop|desktp)\.(?:jpg|jpeg|webp|png)/i', $src ) ) {
					$sizes = '(max-width: 767px) 100vw, 340px';
				} elseif ( str_contains( $src, 'edmonton.png' ) || str_contains( $src, 'edmonton.webp' ) ) {
					$sizes = '(max-width: 480px) 92vw, 386px';
					$webp  = str_contains( $src, 'edmonton.webp' )
						? self::url_without_query( $src )
						: self::existing_upload_url( $src, 'edmonton.png', 'edmonton.webp' );
					if ( is_string( $webp ) && $webp !== '' ) {
						$tag = (string) preg_replace( '/\ssrc=(["\'])[^"\']*\1/i', ' src="' . $webp . '"', $tag, 1 );
						if ( preg_match( '/\ssrcset=(["\'])[^"\']*\1/i', $tag ) ) {
							$tag = (string) preg_replace( '/\ssrcset=(["\'])[^"\']*\1/i', ' srcset="' . $webp . ' 482w"', $tag, 1 );
						}
					}
				} elseif ( stripos( $src, 'Wordpress-logo' ) !== false && stripos( $src, 'WordPress_blue_logo' ) === false ) {
					$hi = self::plugin_frontend_url( 'assets/frontend/wordpress-logo-512.webp' );
					if ( $hi !== '' ) {
						$sizes = '(max-width: 767px) 40vw, 180px';
						$tag   = (string) preg_replace( '/\ssrc=(["\'])[^"\']*\1/i', ' src="' . $hi . '"', $tag, 1 );
						if ( preg_match( '/\ssrcset=(["\'])[^"\']*\1/i', $tag ) ) {
							$tag = (string) preg_replace( '/\ssrcset=(["\'])[^"\']*\1/i', ' srcset="' . $hi . ' 512w"', $tag, 1 );
						} else {
							$tag = (string) preg_replace( '/^<img/i', '<img srcset="' . $hi . ' 512w"', $tag, 1 );
						}
						$tag = (string) preg_replace( '/\swidth=(["\']?)\d+\1/i', ' width="512"', $tag );
						$tag = (string) preg_replace( '/\sheight=(["\']?)\d+\1/i', ' height="512"', $tag );
					} else {
						return $tag;
					}
				} elseif ( str_contains( $src, 'WordPress_blue_logo' ) ) {
					$sizes = '40px';
					$thumb = self::existing_upload_url( $src, 'WordPress_blue_logo.svg_.png', 'WordPress_blue_logo.svg_-150x150.png' );
					if ( $thumb !== null ) {
						$tag = (string) preg_replace( '/\ssrc=(["\'])[^"\']*\1/i', ' src="' . $thumb . '"', $tag, 1 );
						$tag = (string) preg_replace( '/\ssrcset=(["\'])[^"\']*\1/i', '', $tag );
						$tag = (string) preg_replace( '/\swidth=(["\']?)\d+\1/i', ' width="150"', $tag );
						$tag = (string) preg_replace( '/\sheight=(["\']?)\d+\1/i', ' height="150"', $tag );
					}
				} else {
					return $tag;
				}
				if ( preg_match( '/\bsizes=(["\'])[^"\']*\1/i', $tag ) ) {
					return (string) preg_replace( '/\bsizes=(["\'])[^"\']*\1/i', 'sizes="' . $sizes . '"', $tag, 1 );
				}
				return (string) preg_replace( '/^<img/i', '<img sizes="' . $sizes . '"', $tag, 1 );
			},
			$html
		);
		$html = is_string( $next ) ? $next : $html;
		return self::prefer_edmonton_webp_preloads( $html );
	}

	/**
	 * Drop the PNG preload once the WebP file is the one we want fetched.
	 */
	public static function prefer_edmonton_webp_preloads( string $html ): string {
		if ( strpos( $html, 'edmonton.webp' ) === false ) {
			return $html;
		}
		$next = preg_replace_callback(
			'/<link\b[^>]*rel=["\']preload["\'][^>]*>/i',
			static function ( $m ) {
				$tag = $m[0];
				if ( stripos( $tag, 'edmonton.png' ) === false ) {
					return $tag;
				}
				return str_ireplace( 'edmonton.png', 'edmonton.webp', $tag );
			},
			$html
		);
		$html = is_string( $next ) ? $next : $html;
		if ( ! preg_match_all( '/<link rel="preload" as="image"[^>]*edmonton\.webp[^>]*>/i', $html, $m ) || count( $m[0] ) < 2 ) {
			return $html;
		}
		$seen = array();
		foreach ( $m[0] as $tag ) {
			if ( isset( $seen[ $tag ] ) ) {
				$html = preg_replace( '/' . preg_quote( $tag, '/' ) . '/', '', $html, 1 );
				continue;
			}
			$seen[ $tag ] = true;
		}
		return is_string( $html ) ? $html : $next;
	}

	public static function defer_render_blocking_styles( string $html ): string {
		$next = preg_replace_callback(
			'#<link\b[^>]*>#i',
			static function ( $m ) {
				$tag = $m[0];
				if ( stripos( $tag, 'stylesheet' ) === false ) {
					return $tag;
				}
				if ( stripos( $tag, 'onload=' ) !== false ) {
					return $tag;
				}
				if ( preg_match( '/media=(["\'])print\1/i', $tag ) ) {
					return $tag;
				}
				$href = '';
				if ( preg_match( '/\bhref=(["\'])([^"\']+)\1/i', $tag, $u ) ) {
					$href = $u[2];
				}
				if ( $href === '' || ! self::is_deferred_stylesheet( $href ) ) {
					return $tag;
				}
				$tag = (string) preg_replace( '/\smedia=(["\'])[^"\']*\1/i', '', $tag );
				$out = preg_replace( '#\s*/?\s*>$#', ' media="print" onload="this.media=\'all\'">', rtrim( $tag, '>' ) . '>' );
				return is_string( $out ) ? $out : $tag;
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * @param string $url Image URL.
	 */
	private static function url_without_query( string $url ): string {
		$cut = strpos( $url, '?' );
		return $cut === false ? $url : substr( $url, 0, $cut );
	}

	/**
	 * Swap to a sibling upload only when that file is already on disk.
	 */
	public static function existing_upload_url( string $src, string $from, string $to ): ?string {
		$url  = self::url_without_query( $src );
		$next = str_replace( $from, $to, $url );
		if ( $next === $url ) {
			return null;
		}
		$path = self::resolve_stylesheet_path( $next );
		if ( $path !== null && is_readable( $path ) ) {
			return $next;
		}
		return null;
	}
}

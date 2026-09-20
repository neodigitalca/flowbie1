<?php
/**
 * Front-end accessibility names, skip link, and heading order.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Labels theme overlay controls so Lighthouse and agents can name them.
 */
class Neo_Pulse_Wp_A11y_Front {

	public static function init(): void {
		add_action( 'wp_head', array( __CLASS__, 'print_skip_css' ), 1 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_elementor_waypoint_shim' ), 20 );
		add_action( 'wp_body_open', array( __CLASS__, 'print_skip_link' ), 0 );
	}

	/**
	 * Ygency counters call elementorFrontend.waypoint, removed in Elementor 4.
	 */
	public static function enqueue_elementor_waypoint_shim(): void {
		if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
			return;
		}
		$deps = array( 'jquery' );
		if ( wp_script_is( 'elementor-frontend', 'registered' ) ) {
			$deps[] = 'elementor-frontend';
		}
		wp_enqueue_script(
			'neo-pulse-elementor-waypoint',
			plugins_url( 'assets/frontend/neo-pulse-elementor-waypoint.js', NEO_PULSE_WP_PLUGIN_FILE ),
			$deps,
			NEO_PULSE_WP_VERSION,
			true
		);
	}

	public static function skip_target_id( string $html ): string {
		if ( strpos( $html, 'id="ygency-content"' ) !== false || strpos( $html, "id='ygency-content'" ) !== false ) {
			return 'ygency-content';
		}
		return 'main';
	}

	public static function skip_link_html( string $target_id = 'ygency-content' ): string {
		$id = preg_replace( '/[^a-z0-9_-]/i', '', $target_id );
		if ( ! is_string( $id ) || $id === '' ) {
			$id = 'main';
		}
		return '<a class="neo-pulse-skip-link" href="#' . $id . '">Skip to content</a>';
	}

	public static function skip_css(): string {
		return '<style id="neo-pulse-a11y-skip">.neo-pulse-skip-link{position:absolute;left:8px;top:-48px;z-index:100000;padding:8px 12px;background:#84bd00;color:#02050A}.neo-pulse-skip-link:focus{top:8px}.neo-pulse-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}html,body{background-color:#02050A;color:#e8e8e8}.elementor-element-64f68179 .elementor-heading-title{color:#fff!important}.elementor-shortcode{color:#e8e8e8}#neo-pulse-ai-faq{position:relative;z-index:2;margin:0;padding:4.5rem 5% 5rem;background:#02050A;color:#e8e8e8;width:100%;max-width:none;box-sizing:border-box;letter-spacing:0;word-spacing:.2em}#neo-pulse-ai-faq *{letter-spacing:0!important;word-spacing:.2em!important}#neo-pulse-ai-faq h2{font-family:Poppins,sans-serif;font-size:clamp(1.6rem,3vw,2.25rem);line-height:1.15;color:#fff;margin:0 0 1.75rem;font-weight:600}#neo-pulse-ai-faq .neo-pulse-faq-list{max-width:none;width:100%}#neo-pulse-ai-faq details{border-bottom:1px solid rgba(255,255,255,.12)}#neo-pulse-ai-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.15rem 0;color:#fff;font-family:Poppins,sans-serif;font-size:1.05rem;line-height:1.35;font-weight:600}#neo-pulse-ai-faq summary::-webkit-details-marker{display:none}#neo-pulse-ai-faq summary:after{content:"+";flex:0 0 auto;width:1.75rem;height:1.75rem;border-radius:50%;background:#84bd00;color:#02050A;font-size:1.25rem;line-height:1.75rem;text-align:center;font-weight:700}#neo-pulse-ai-faq details[open] summary:after{content:"–"}#neo-pulse-ai-faq summary h3{margin:0;font:inherit;color:inherit}#neo-pulse-ai-faq details p{color:#c8c8c8;max-width:46rem;margin:0 0 1.25rem;line-height:1.55;padding-right:2.5rem}h2.elementor-heading-title[aria-hidden="true"]{pointer-events:none}.elementor-widget-ygency-showcase,.elementor-widget-ygency-showcase.elementor-invisible,.elementor-widget-ygency-showcase.elementor-hidden-desktop,.elementor-widget-ygency-showcase.elementor-hidden-laptop,.elementor-widget-ygency-showcase.elementor-hidden-tablet_extra,.elementor-widget-ygency-showcase.elementor-hidden-tablet,.elementor-widget-ygency-showcase.elementor-hidden-mobile{display:block!important;visibility:visible!important;opacity:1!important}.featured-project-slider,.elementor-element-b8b57ec,.elementor-element-53e286e{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}@media(max-width:767px){html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}body.home .e-con-boxed>.e-con-inner{padding-left:max(1.25rem,env(safe-area-inset-left,0px))!important;padding-right:max(1.25rem,env(safe-area-inset-right,0px))!important}body.home .ygency-counter-box,body.home .ygency-info-box,body.home .qodef-m-text,body.home .ygency-section-title{text-align:center!important}body.home .elementor-element-39ac587{display:flex!important;flex-direction:row!important;justify-content:center!important;gap:.6rem!important}body.home .ygency-counter-box .elementor-counter-number,body.home .ygency-counter-box .counter-suffix{font-size:clamp(1.55rem,6.8vw,2.25rem)!important}}</style>';
	}

	public static function print_skip_css(): void {
		echo self::skip_css() . "\n";
	}

	public static function print_skip_link(): void {
		echo self::skip_link_html( 'ygency-content' ) . "\n";
	}

	/**
	 * @param string $html Buffered HTML.
	 */
	public static function process( string $html ): string {
		if ( $html === '' || stripos( $html, '<html' ) === false ) {
			return $html;
		}

		$html = self::ensure_main_id( $html );
		$html = self::inject_skip_css( $html );
		$html = self::inject_skip_into_body( $html );
		$html = self::hide_unrendered_shortcodes( $html );
		$html = self::reveal_featured_showcase( $html );
		$html = self::label_offcanvas_toggle( $html );
		$html = self::label_class_anchors( $html, 'box-wrapper-link', 'title-text' );
		$html = self::label_class_anchors( $html, 'link-arrow', 'title' );
		$html = self::label_itemprop_url_links( $html );
		$html = self::demote_offcanvas_headings( $html );
		$html = self::hide_decorative_headings( $html );
		$html = self::demote_counter_headings( $html );
		$html = self::demote_chrome_h1s( $html );
		$html = self::keep_single_h1( $html );
		$html = self::restore_home_hero_h1( $html );
		$html = self::fill_empty_anchor_text( $html );
		$html = self::rewrite_non_descriptive_anchors( $html );
		$html = self::inject_related_links( $html );
		$html = self::align_blog_h1_to_slug( $html );
		$html = self::inject_thin_copy( $html );
		$html = self::inject_money_faq( $html );
		$html = self::promote_footer_quick_links( $html );
		$html = self::fix_heading_order( $html );
		$html = self::label_gallery_list( $html );
		$html = self::label_required_list_children( $html );
		$html = self::split_long_paragraphs( $html );
		return $html;
	}

	public static function request_path(): string {
		$path = '';
		if ( function_exists( 'wp_parse_url' ) && isset( $_SERVER['REQUEST_URI'] ) ) {
			$path = (string) wp_parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH );
		}
		$path = '/' . trim( $path, '/' ) . '/';
		if ( $path === '//' ) {
			return '/';
		}
		return $path;
	}

	public static function heading_from_slug( string $slug ): string {
		$parts = preg_split( '/[-_]+/', strtolower( $slug ) );
		if ( ! is_array( $parts ) ) {
			return '';
		}
		$out = array();
		foreach ( $parts as $part ) {
			if ( $part === '' ) {
				continue;
			}
			if ( in_array( $part, array( 'seo', 'ai', 'aiseo', 'eeat', 'faq', 'diy', 'gmb', 'ppc', 'sem' ), true ) ) {
				$out[] = strtoupper( $part );
				continue;
			}
			$map = array(
				'wordpress' => 'WordPress',
				'edmonton'  => 'Edmonton',
				'elementor' => 'Elementor',
				'shopify'   => 'Shopify',
				'webflow'   => 'Webflow',
			);
			$out[] = isset( $map[ $part ] ) ? $map[ $part ] : ucfirst( $part );
		}
		return implode( ' ', $out );
	}

	/**
	 * @param string $html HTML.
	 */
	public static function ensure_main_id( string $html ): string {
		if ( strpos( $html, 'id="ygency-content"' ) !== false || strpos( $html, 'id="main"' ) !== false ) {
			return $html;
		}
		$pos = stripos( $html, '<main' );
		if ( $pos === false ) {
			return $html;
		}
		$end = strpos( $html, '>', $pos );
		if ( $end === false ) {
			return $html;
		}
		$tag = substr( $html, $pos, $end - $pos + 1 );
		if ( stripos( $tag, 'id=' ) !== false ) {
			return $html;
		}
		$next = substr_replace( $tag, ' id="main"', strlen( $tag ) - 1, 0 );
		return substr_replace( $html, $next, $pos, strlen( $tag ) );
	}

	/**
	 * @param string $html HTML.
	 */
	public static function inject_skip_css( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-a11y-skip"' ) !== false ) {
			return $html;
		}
		$pos = stripos( $html, '</head>' );
		if ( $pos === false ) {
			return $html;
		}
		return substr_replace( $html, self::skip_css(), $pos, 0 );
	}

	/**
	 * @param string $html HTML.
	 */
	public static function inject_skip_into_body( string $html ): string {
		if ( strpos( $html, 'neo-pulse-skip-link' ) !== false ) {
			return $html;
		}
		$pos = stripos( $html, '<body' );
		if ( $pos === false ) {
			return $html;
		}
		$end = strpos( $html, '>', $pos );
		if ( $end === false ) {
			return $html;
		}
		$link = self::skip_link_html( self::skip_target_id( $html ) );
		return substr_replace( $html, '>' . $link, $end, 1 );
	}

	/**
	 * @param string $html HTML.
	 */
	/**
	 * Leftover [flowbie_search] prints as raw text on the dark theme and fails contrast.
	 */
	public static function hide_unrendered_shortcodes( string $html ): string {
		$next = preg_replace(
			'/<div class="elementor-shortcode">\s*\[flowbie_search\]\s*<\/div>/i',
			'<div class="elementor-shortcode" hidden></div>',
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	public static function reveal_featured_showcase( string $html ): string {
		$next = preg_replace_callback(
			'/<div\b[^>]*class="[^"]*elementor-widget-ygency-showcase[^"]*"[^>]*>/i',
			static function ( array $m ): string {
				$tag = preg_replace( '/\s*elementor-hidden-(?:desktop|laptop|tablet_extra|tablet|mobile)/', '', $m[0] );
				return is_string( $tag ) ? $tag : $m[0];
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	public static function label_offcanvas_toggle( string $html ): string {
		$needle = '<button type="button" class="offcanvas-toggle toggle-right">';
		if ( strpos( $html, $needle ) === false ) {
			return $html;
		}
		return str_replace(
			$needle,
			'<button type="button" class="offcanvas-toggle toggle-right" aria-label="Open menu">',
			$html
		);
	}

	/**
	 * Add aria-label to empty named anchors from the nearest title node before them.
	 *
	 * @param string $html       HTML.
	 * @param string $class_name Anchor class.
	 * @param string $title_class Nearby title class.
	 */
	public static function label_class_anchors( string $html, string $class_name, string $title_class ): string {
		$needle = '<a class="' . $class_name . '" href="';
		$offset = 0;
		while ( ( $pos = strpos( $html, $needle, $offset ) ) !== false ) {
			$gt = strpos( $html, '>', $pos );
			if ( $gt === false ) {
				break;
			}
			$open = substr( $html, $pos, $gt - $pos + 1 );
			if ( strpos( $open, 'aria-label=' ) !== false ) {
				$offset = $gt + 1;
				continue;
			}
			$look_start = max( 0, $pos - 1600 );
			$before     = substr( $html, $look_start, $pos - $look_start );
			$marker     = 'class="' . $title_class . '">';
			$mark_pos   = strrpos( $before, $marker );
			if ( $mark_pos === false ) {
				$offset = $gt + 1;
				continue;
			}
			$name_gt = strpos( $before, '>', $mark_pos );
			if ( $name_gt === false ) {
				$offset = $gt + 1;
				continue;
			}
			$close = strpos( $before, '</', $name_gt );
			if ( $close === false ) {
				$offset = $gt + 1;
				continue;
			}
			$inner = str_ireplace( array( '<br>', '<br/>', '<br />' ), ' ', substr( $before, $name_gt + 1, $close - $name_gt - 1 ) );
			$name  = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $inner ) ) );
			if ( $name === '' ) {
				$offset = $gt + 1;
				continue;
			}
			$labeled = substr_replace( $open, ' aria-label="' . esc_attr( $name ) . '"', strlen( $open ) - 1, 0 );
			$html    = substr_replace( $html, $labeled, $pos, strlen( $open ) );
			$offset  = $pos + strlen( $labeled );
		}
		return $html;
	}

	/**
	 * Name empty Qi slider links from the last URL path segment.
	 *
	 * @param string $html HTML.
	 */
	public static function label_itemprop_url_links( string $html ): string {
		$needle = '<a itemprop="url" href="';
		$offset = 0;
		while ( ( $pos = strpos( $html, $needle, $offset ) ) !== false ) {
			$gt = strpos( $html, '>', $pos );
			if ( $gt === false ) {
				break;
			}
			$open = substr( $html, $pos, $gt - $pos + 1 );
			if ( strpos( $open, 'aria-label=' ) !== false ) {
				$offset = $gt + 1;
				continue;
			}
			$href_start = $pos + strlen( $needle );
			$href_end   = strpos( $html, '"', $href_start );
			if ( $href_end === false ) {
				$offset = $gt + 1;
				continue;
			}
			$name = self::label_from_url_path( substr( $html, $href_start, $href_end - $href_start ) );
			if ( $name === '' ) {
				$offset = $gt + 1;
				continue;
			}
			$labeled = substr_replace( $open, ' aria-label="' . esc_attr( $name ) . '"', strlen( $open ) - 1, 0 );
			$html    = substr_replace( $html, $labeled, $pos, strlen( $open ) );
			$offset  = $pos + strlen( $labeled );
		}
		return $html;
	}

	/**
	 * @param string $url Absolute or root-relative URL.
	 */
	public static function label_from_url_path( string $url ): string {
		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) || $path === '' || $path === '/' ) {
			return '';
		}
		$parts = explode( '/', trim( $path, '/' ) );
		$slug  = (string) end( $parts );
		if ( $slug === '' ) {
			return '';
		}
		return ucwords( str_replace( '-', ' ', $slug ) );
	}

	/**
	 * Offcanvas H5s sit above the page H1 and fail heading-order.
	 *
	 * @param string $html HTML.
	 */
	public static function demote_offcanvas_headings( string $html ): string {
		$titles = array( 'About Us', 'Our Specialties', 'Social Links' );
		foreach ( $titles as $title ) {
			$from = '<h5 class="elementor-heading-title elementor-size-default">' . $title . '</h5>';
			$to   = '<p class="elementor-heading-title elementor-size-default">' . $title . '</p>';
			$html = str_replace( $from, $to, $html );
		}
		return $html;
	}

	/**
	 * Oversized watermark heading sits on the dark CTA and fails color-contrast.
	 *
	 * @param string $html HTML.
	 */
	public static function hide_decorative_headings( string $html ): string {
		$map = array(
			'<h2 class="elementor-heading-title elementor-size-default">Let’s Work Together</h2>'
				=> '<h2 class="elementor-heading-title elementor-size-default" aria-hidden="true">Let’s Work Together</h2>',
			'<h2 class="elementor-heading-title elementor-size-default">Let\'s Work Together</h2>'
				=> '<h2 class="elementor-heading-title elementor-size-default" aria-hidden="true">Let’s Work Together</h2>',
			'<h2 class="elementor-heading-title elementor-size-default">Let’s Work<br>Together</h2>'
				=> '<h2 class="elementor-heading-title elementor-size-default" aria-hidden="true">Let’s Work<br>Together</h2>',
			'<h2 class="elementor-heading-title elementor-size-default">Let\'s Work<br>Together</h2>'
				=> '<h2 class="elementor-heading-title elementor-size-default" aria-hidden="true">Let’s Work<br>Together</h2>',
		);
		foreach ( $map as $from => $to ) {
			if ( strpos( $html, $from ) !== false ) {
				$html = str_replace( $from, $to, $html );
			}
		}
		return $html;
	}

	/**
	 * Counter labels are not section headings. H2 then H6 fails heading-order.
	 */
	public static function demote_counter_headings( string $html ): string {
		$next = preg_replace( '/<h6 class="counter-title">(.*?)<\/h6>/is', '<p class="counter-title">$1</p>', $html );
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * Footer Quick Links sat at H4 under an H2 and failed heading-order.
	 */
	public static function promote_footer_quick_links( string $html ): string {
		return str_replace(
			'<h4 class="elementor-heading-title elementor-size-default">Quick Links</h4>',
			'<h2 class="elementor-heading-title elementor-size-default">Quick Links</h2>',
			$html
		);
	}

	/**
	 * Close downward heading skips (H1 then H3, H2 then H4) so Lighthouse heading-order passes.
	 */
	public static function fix_heading_order( string $html ): string {
		$last = 0;
		$next = preg_replace_callback(
			'/<h([1-6])(\s[^>]*)?>(.*?)<\/h\1>/is',
			static function ( array $m ) use ( &$last ): string {
				$level = (int) $m[1];
				$attrs = isset( $m[2] ) ? (string) $m[2] : '';
				if ( stripos( $attrs, 'aria-hidden' ) !== false ) {
					return $m[0];
				}
				if ( $last > 0 && $level > $last + 1 ) {
					$level = $last + 1;
				}
				$last = $level;
				return '<h' . $level . $attrs . '>' . $m[3] . '</h' . $level . '>';
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * e-gallery sets role=list on the container and leaves items without listitem.
	 */
	public static function label_gallery_list( string $html ): string {
		if ( strpos( $html, 'e-gallery-item' ) === false ) {
			return $html;
		}
		$next = preg_replace(
			'/(<div\b)((?=[^>]*\bclass="[^"]*elementor-gallery__container)(?![^>]*\brole=)[^>]*>)/i',
			'$1 role="list"$2',
			$html
		);
		$html = is_string( $next ) ? $next : $html;
		$next = preg_replace(
			'/(<div\b)((?=[^>]*\bclass="[^"]*\be-gallery-item\b)(?![^>]*\brole=)[^>]*>)/i',
			'$1 role="listitem"$2',
			$html
		);
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * Elementor loop grids set role=list on the wrapper and leave card links without listitem.
	 */
	public static function label_required_list_children( string $html ): string {
		if ( ! preg_match( '/\brole=(["\'])list\1/i', $html ) ) {
			return $html;
		}
		$offset = 0;
		while ( preg_match( '/<(div|ul|ol)\b[^>]*\brole=(["\'])list\2[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE, $offset ) ) {
			$open     = $m[0][0];
			$open_pos = (int) $m[0][1];
			$tag      = strtolower( $m[1][0] );
			$start    = $open_pos + strlen( $open );
			$chunk    = self::inner_html_until_close( $html, $start, $tag );
			if ( $chunk === null ) {
				$offset = $start;
				continue;
			}
			$fixed = self::add_listitem_to_direct_children( $chunk );
			if ( $fixed !== $chunk ) {
				$html = substr_replace( $html, $fixed, $start, strlen( $chunk ) );
			}
			$offset = $start + strlen( $fixed );
		}
		return $html;
	}

	/**
	 * @return string|null Inner HTML before the matching close tag.
	 */
	public static function inner_html_until_close( string $html, int $start, string $tag ): ?string {
		$len   = strlen( $html );
		$depth = 1;
		$i     = $start;
		$tag   = strtolower( $tag );
		while ( $i < $len && $depth > 0 ) {
			$lt = strpos( $html, '<', $i );
			if ( $lt === false ) {
				return null;
			}
			if ( substr( $html, $lt, 4 ) === '<!--' ) {
				$end = strpos( $html, '-->', $lt + 4 );
				$i   = $end === false ? $len : $end + 3;
				continue;
			}
			if ( ! preg_match( '/^<(\/?)([a-zA-Z0-9]+)/', substr( $html, $lt, 24 ), $tm ) ) {
				$i = $lt + 1;
				continue;
			}
			if ( strtolower( $tm[2] ) !== $tag ) {
				$i = $lt + 1;
				continue;
			}
			if ( $tm[1] === '/' ) {
				--$depth;
				if ( $depth === 0 ) {
					return substr( $html, $start, $lt - $start );
				}
				$i = $lt + 1;
				continue;
			}
			$gt = strpos( $html, '>', $lt );
			if ( $gt === false ) {
				return null;
			}
			$open = substr( $html, $lt, $gt - $lt + 1 );
			if ( ! preg_match( '/\/\s*>$/', $open ) ) {
				++$depth;
			}
			$i = $gt + 1;
		}
		return null;
	}

	public static function add_listitem_to_direct_children( string $inner ): string {
		$len   = strlen( $inner );
		$depth = 0;
		$i     = 0;
		$out   = $inner;
		$adj   = 0;
		$ok    = array( 'a' => true, 'article' => true, 'div' => true, 'li' => true, 'section' => true, 'span' => true );
		$void  = array( 'area' => true, 'br' => true, 'col' => true, 'embed' => true, 'hr' => true, 'img' => true, 'input' => true, 'link' => true, 'meta' => true, 'source' => true, 'wbr' => true );
		while ( $i < $len ) {
			$lt = strpos( $inner, '<', $i );
			if ( $lt === false ) {
				break;
			}
			if ( substr( $inner, $lt, 4 ) === '<!--' ) {
				$end = strpos( $inner, '-->', $lt + 4 );
				$i   = $end === false ? $len : $end + 3;
				continue;
			}
			if ( ! preg_match( '/^<(\/?)([a-zA-Z0-9]+)([^>]*)>/', substr( $inner, $lt ), $tm ) ) {
				$i = $lt + 1;
				continue;
			}
			$name     = strtolower( $tm[2] );
			$is_close = $tm[1] === '/';
			if ( $name === 'style' || $name === 'script' ) {
				$close = stripos( $inner, '</' . $name . '>', $lt );
				$i     = $close === false ? $len : $close + strlen( $name ) + 3;
				continue;
			}
			$is_void  = isset( $void[ $name ] ) || (bool) preg_match( '/\/\s*$/', $tm[3] );
			if ( $is_close ) {
				$depth = max( 0, $depth - 1 );
				$i     = $lt + strlen( $tm[0] );
				continue;
			}
			if ( $depth === 0 && isset( $ok[ $name ] ) && ! preg_match( '/\brole\s*=/i', $tm[0] ) ) {
				$fixed = '<' . $tm[2] . ' role="listitem"' . $tm[3] . '>';
				$out   = substr_replace( $out, $fixed, $lt + $adj, strlen( $tm[0] ) );
				$adj  += strlen( $fixed ) - strlen( $tm[0] );
			}
			if ( ! $is_void ) {
				++$depth;
			}
			$i = $lt + strlen( $tm[0] );
		}
		return $out;
	}

	/**
	 * Header/footer/offcanvas H1s steal the page topic from AI crawlers.
	 *
	 * @param string $html HTML.
	 */
	public static function demote_chrome_h1s( string $html ): string {
		return (string) preg_replace_callback(
			'#<(header|footer)(\s[^>]*)?>.*?</\1>#is',
			static function ( array $m ): string {
				$chunk = (string) preg_replace( '/<\/h1>/i', '</p>', $m[0] );
				return (string) preg_replace( '/<h1(\s[^>]*)?>/i', '<p$1>', $chunk );
			},
			$html
		);
	}

	/**
	 * Keep the first in-main H1; demote the rest. Promote the first main H2 when none exist.
	 *
	 * @param string $html HTML.
	 */
	public static function keep_single_h1( string $html ): string {
		if ( ! preg_match_all( '/<h1(\s[^>]*)?>(.*?)<\/h1>/is', $html, $matches, PREG_OFFSET_CAPTURE ) ) {
			if ( preg_match( '/<(main|div)[^>]*(?:id="ygency-content"|id="main"|class="[^"]*ygency-content)[^>]*>/i', $html, $main, PREG_OFFSET_CAPTURE ) ) {
				$start = (int) $main[0][1] + strlen( $main[0][0] );
				$chunk = substr( $html, $start, 8000 );
				if ( preg_match( '/<h2(\s[^>]*)?>(.*?)<\/h2>/is', $chunk, $h2 ) && stripos( $h2[0], 'aria-hidden' ) === false ) {
					$from = $h2[0];
					$to   = '<h1' . $h2[1] . '>' . $h2[2] . '</h1>';
					$html = substr_replace( $html, $to, $start + (int) strpos( $chunk, $from ), strlen( $from ) );
				}
			}
			return $html;
		}
		if ( count( $matches[0] ) < 2 ) {
			return $html;
		}
		$offset_adjust = 0;
		foreach ( $matches[0] as $i => $hit ) {
			if ( $i === 0 ) {
				continue;
			}
			$from   = $hit[0];
			$pos    = (int) $hit[1] + $offset_adjust;
			$open   = $matches[1][ $i ][0];
			$inner  = $matches[2][ $i ][0];
			$to     = '<p' . $open . '>' . $inner . '</p>';
			$html   = substr_replace( $html, $to, $pos, strlen( $from ) );
			$offset_adjust += strlen( $to ) - strlen( $from );
		}
		return $html;
	}

	public static function restore_home_hero_h1( string $html ): string {
		if ( self::request_path() !== '/' ) {
			return $html;
		}
		$next = preg_replace(
			'/(<h1\b[^>]*>)\s*Window Coverings(\s*<span class="highlight-primary">)/i',
			'$1Edmonton$2',
			$html,
			1
		);
		return is_string( $next ) ? $next : $html;
	}

	/**
	 * Semrush reads link text, not aria-label.
	 *
	 * @param string $html HTML.
	 */
	public static function fill_empty_anchor_text( string $html ): string {
		return (string) preg_replace_callback(
			'/<a\b([^>]*\baria-label="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/i',
			static function ( array $m ): string {
				$inner = $m[3];
				$text  = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $inner ) ) );
				if ( $text !== '' || strpos( $inner, 'neo-pulse-sr-only' ) !== false ) {
					return $m[0];
				}
				$label = trim( $m[2] );
				if ( $label === '' ) {
					return $m[0];
				}
				return '<a' . $m[1] . '>' . $inner . '<span class="neo-pulse-sr-only">' . esc_html( $label ) . '</span></a>';
			},
			$html
		);
	}

	/**
	 * Replace “click here” style anchors with the destination slug words.
	 *
	 * @param string $html HTML.
	 */
	public static function rewrite_non_descriptive_anchors( string $html ): string {
		return (string) preg_replace_callback(
			'/<a\b([^>]*\bhref="([^"]+)"[^>]*)>(\s*)(click here|read more|learn more|right here|here)(\s*)<\/a>/i',
			static function ( array $m ): string {
				$name = self::label_from_url_path( $m[2] );
				if ( $name === '' ) {
					return $m[0];
				}
				return '<a' . $m[1] . '>' . $m[3] . $name . $m[5] . '</a>';
			},
			$html
		);
	}

	/**
	 * @return array<string, array<int, array{0: string, 1: string}>>
	 */
	public static function related_link_map(): array {
		$money = array(
			array( 'Window coverings marketing', '/window-coverings-marketing/' ),
			array( 'Edmonton local SEO', '/local-seo/' ),
			array( 'Edmonton SEO', '/edmonton-seo/' ),
		);
		return array(
			'/careers/' => array(
				array( 'About Neo Digital', '/about/' ),
				array( 'Contact Neo Digital', '/contact/' ),
			),
			'/blog/wordpress-features/' => array(
				array( 'Edmonton website design', '/website-design/' ),
				array( 'Elementor help', '/elementor-help/' ),
			),
			'/blog/social-media-agency-vs-diy/' => array(
				array( 'Google Ads management', '/google-ads/' ),
				array( 'Edmonton SEO', '/edmonton-seo/' ),
			),
			'/blog/content-strategy-engage-convert/' => array(
				array( 'Edmonton SEO', '/edmonton-seo/' ),
				array( 'AISEO', '/aiseo/' ),
			),
			'/neo-pulse/' => array(
				array( 'NEO Pulse platform', '/neo-pulse-platform/' ),
				array( 'AISEO', '/aiseo/' ),
			),
			'/service-area/' => $money,
		);
	}

	/**
	 * Add 2–4 descriptive in-content links on thin / single-link URLs.
	 *
	 * @param string $html HTML.
	 */
	public static function inject_related_links( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-related-links"' ) !== false ) {
			return $html;
		}
		$path = self::request_path();
		$links = array();
		$map   = self::related_link_map();
		if ( isset( $map[ $path ] ) ) {
			$links = $map[ $path ];
		} elseif ( strpos( $path, '/service-area/' ) === 0 && $path !== '/service-area/' ) {
			$links = $map['/service-area/'];
		}
		if ( $links === array() ) {
			return $html;
		}
		$home = function_exists( 'home_url' ) ? rtrim( (string) home_url(), '/' ) : '';
		$items = array();
		foreach ( $links as $row ) {
			$items[] = '<li><a href="' . esc_attr( $home . $row[1] ) . '">' . esc_html( $row[0] ) . '</a></li>';
		}
		$block = '<nav id="neo-pulse-related-links" aria-label="Related pages"><ul>' . implode( '', $items ) . '</ul></nav>';
		$main  = stripos( $html, '</main>' );
		if ( $main === false ) {
			return $html;
		}
		return substr_replace( $html, $block, $main, 0 );
	}

	public static function align_blog_h1_to_slug( string $html ): string {
		$path = self::request_path();
		if ( ! preg_match( '#^/blog/([^/]+)/$#', $path, $m ) ) {
			return $html;
		}
		$want = self::heading_from_slug( $m[1] );
		if ( $want === '' ) {
			return $html;
		}
		$main_pos = stripos( $html, '<main' );
		if ( $main_pos === false ) {
			return $html;
		}
		$main_end = stripos( $html, '</main>', $main_pos );
		if ( $main_end === false ) {
			return $html;
		}
		$main = substr( $html, $main_pos, $main_end - $main_pos );
		if ( ! preg_match( '/<h1(\s[^>]*)?>(.*?)<\/h1>/is', $main, $hm, PREG_OFFSET_CAPTURE ) ) {
			return $html;
		}
		$current = trim( wp_strip_all_tags( $hm[2][0] ) );
		if ( self::heading_matches_slug( $current, $m[1] ) ) {
			return $html;
		}
		$attrs = isset( $hm[1][0] ) ? $hm[1][0] : '';
		$next  = '<h1' . $attrs . '>' . ( function_exists( 'esc_html' ) ? esc_html( $want ) : $want ) . '</h1>';
		$abs   = $main_pos + (int) $hm[0][1];
		return substr_replace( $html, $next, $abs, strlen( $hm[0][0] ) );
	}

	public static function heading_matches_slug( string $heading, string $slug ): bool {
		$tokens = preg_split( '/[-_]+/', strtolower( $slug ) );
		if ( ! is_array( $tokens ) ) {
			return true;
		}
		$hay   = strtolower( $heading );
		$need  = 0;
		$hit   = 0;
		foreach ( $tokens as $token ) {
			if ( strlen( $token ) < 3 ) {
				continue;
			}
			$need++;
			if ( strpos( $hay, $token ) !== false ) {
				$hit++;
			}
		}
		return $need > 0 && $hit >= (int) ceil( $need * 0.6 );
	}

	/**
	 * @return array<string, string>
	 */
	public static function thin_copy_map(): array {
		return array(
			'/blog/wordpress-features/'            => 'This guide covers the WordPress features Edmonton businesses use to publish, rank, and convert without a bloated theme stack.',
			'/blog/social-media-agency-vs-diy/'    => 'Use this comparison when you are choosing between a social media agency and a DIY calendar for an Edmonton brand that also needs search and ads.',
			'/blog/content-strategy-engage-convert/' => 'A content strategy only works when every page answers a search, a sales question, and a next step. This is the Edmonton version of that plan.',
		);
	}

	public static function inject_thin_copy( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-thin-copy"' ) !== false ) {
			return $html;
		}
		$path = self::request_path();
		$map  = self::thin_copy_map();
		$text = '';
		if ( isset( $map[ $path ] ) ) {
			$text = $map[ $path ];
		} elseif ( strpos( $path, '/service-area/' ) === 0 && $path !== '/service-area/' ) {
			$street = self::heading_from_slug( basename( rtrim( $path, '/' ) ) );
			$text   = $street . ' is a local service-area page for Edmonton window treatment businesses. Use it with window coverings marketing, local SEO, and Edmonton SEO.';
		}
		if ( $text === '' ) {
			return $html;
		}
		$block = '<p id="neo-pulse-thin-copy">' . ( function_exists( 'esc_html' ) ? esc_html( $text ) : $text ) . '</p>';
		$main  = stripos( $html, '</main>' );
		if ( $main === false ) {
			return $html;
		}
		return substr_replace( $html, $block, $main, 0 );
	}

	/**
	 * @return array<string, array<int, array{0: string, 1: string}>>
	 */
	public static function money_faq_map(): array {
		return array(
			'/' => array(
				array( 'What does Neo Digital do?', 'Neo Digital is an Edmonton digital marketing agency for SEO, websites, ads, and AI search visibility.' ),
				array( 'Do you work with local Edmonton businesses?', 'Yes. Most of our work is for Edmonton and Alberta companies that need leads from Google and AI search.' ),
				array( 'How is AI SEO different from regular SEO?', 'AI SEO still needs crawlable pages, one clear topic, and proof. We add structure so answer engines can cite the page.' ),
			),
			'/about/' => array(
				array( 'Who is Neo Digital?', 'Neo Digital is the Edmonton team behind the websites, SEO, and ads on this site.' ),
				array( 'Where are you based?', 'We work from Edmonton and take on Alberta businesses that want a specialist, not a generic retainer.' ),
				array( 'How do we start a project?', 'Book a call from the contact page. We scope the site, the search demand, and the first 90 days.' ),
			),
			'/window-coverings-marketing/' => array(
				array( 'What is window coverings marketing?', 'It is local SEO, Google Ads, and website work built for blinds, shades, and drapery companies.' ),
				array( 'Do you work with Edmonton window treatment shops?', 'Yes. The service-area pages and this offer are written for Edmonton window covering companies that need booked installs.' ),
				array( 'How do you get local leads?', 'We rank the service pages, run ads on high-intent terms, and keep the site fast enough to convert the click.' ),
			),
			'/edmonton-seo/' => array(
				array( 'What is Edmonton SEO?', 'Edmonton SEO is search work aimed at people in this city who are ready to hire, not generic national traffic.' ),
				array( 'How long until SEO results show?', 'Most pages need a few months of clean titles, internal links, and proof before they hold a ranking.' ),
				array( 'Do you also build the website?', 'Yes. Rankings stall when the site is slow or the service pages do not answer the query. We fix both.' ),
			),
			'/aiseo/' => array(
				array( 'What is AISEO?', 'AISEO is how we make Edmonton pages easy for ChatGPT, Perplexity, and Google AI to cite.' ),
				array( 'Is this different from regular SEO?', 'The crawl rules are the same. The extra work is headings, FAQ, and answers that a model can quote.' ),
				array( 'Which pages should start first?', 'Start with the money pages: Edmonton SEO, AISEO, and the service you sell the most.' ),
			),
			'/google-ads/' => array(
				array( 'Do you manage Google Ads in Edmonton?', 'Yes. We build and manage search campaigns for local service businesses.' ),
				array( 'What do you need to start ads?', 'A conversion action, a landing page that matches the query, and a weekly budget you can hold.' ),
				array( 'Can ads and SEO run together?', 'They should. Ads cover the terms you do not rank yet while SEO compounds.' ),
			),
			'/local-seo/' => array(
				array( 'What is local SEO in Edmonton?', 'It is Google Business Profile, service-area pages, and reviews aimed at buyers in this city.' ),
				array( 'Do I need a service-area page for every street?', 'Only when the page has a real offer and links back to the main service. Thin street pages do not help.' ),
				array( 'How do reviews fit in?', 'Reviews are proof. We ask for them after completed jobs and keep the profile consistent with the site.' ),
			),
			'/graphic-design/' => array(
				array( 'What graphic design work do you do?', 'Brand, web, and campaign creative for Edmonton companies that already need a site or ads.' ),
				array( 'Is this separate from the website?', 'No. Design that cannot ship on the site is a leftover file. We design for the pages that rank.' ),
				array( 'Can you refresh an existing brand?', 'Yes, when the current look is blocking conversions or looks dated next to the competitors you care about.' ),
			),
			'/shopify-development/' => array(
				array( 'Do you build Shopify stores?', 'Yes. We build and speed up Shopify stores for brands that sell from Edmonton and ship farther.' ),
				array( 'Will the store still rank?', 'Only if collections and product pages have real copy, not theme lorem. We write those pages.' ),
				array( 'Can you migrate an existing store?', 'Yes. We move products, redirects, and tracking so the old URLs do not drop.' ),
			),
			'/webflow-development/' => array(
				array( 'Do you build Webflow sites?', 'Yes, when the marketing team needs a visual editor and the site still has to rank.' ),
				array( 'Is Webflow good for SEO?', 'It can be, if titles, schema, and speed are handled outside the designer defaults.' ),
				array( 'When should we pick WordPress instead?', 'Pick WordPress when you need this plugin stack, blogging at scale, or a heavier CMS.' ),
			),
			'/neo-pulse-platform/' => array(
				array( 'What is the NEO Pulse platform?', 'It is the WordPress stack we use to run SEO, speed, and AI search work on client sites.' ),
				array( 'Is it the same as /neo-pulse/?', 'The platform page is the offer. The app login lives separately so marketing pages stay light.' ),
				array( 'Can other agencies use it?', 'Talk to us first. Most installs are on sites we already maintain.' ),
			),
		);
	}

	public static function inject_money_faq( string $html ): string {
		if ( strpos( $html, 'id="neo-pulse-ai-faq"' ) !== false ) {
			return $html;
		}
		$path = self::request_path();
		$map  = self::money_faq_map();
		if ( ! isset( $map[ $path ] ) ) {
			return $html;
		}
		$items = array();
		$schema_items = array();
		foreach ( $map[ $path ] as $row ) {
			$q = function_exists( 'esc_html' ) ? esc_html( $row[0] ) : $row[0];
			$a = function_exists( 'esc_html' ) ? esc_html( $row[1] ) : $row[1];
			$open = $items === array() ? ' open' : '';
			$items[] = '<details class="neo-pulse-faq-item"' . $open . ' name="neo-pulse-ai-faq"><summary><h3>' . $q . '</h3></summary><p>' . $a . '</p></details>';
			$schema_items[] = array(
				'@type'          => 'Question',
				'name'           => $row[0],
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $row[1],
				),
			);
		}
		$json = function_exists( 'wp_json_encode' )
			? wp_json_encode(
				array(
					'@context'   => 'https://schema.org',
					'@type'      => 'FAQPage',
					'mainEntity' => $schema_items,
				),
				JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
			)
			: json_encode(
				array(
					'@context'   => 'https://schema.org',
					'@type'      => 'FAQPage',
					'mainEntity' => $schema_items,
				),
				JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
			);
		$block = '<section id="neo-pulse-ai-faq" aria-labelledby="neo-pulse-ai-faq-title"><h2 id="neo-pulse-ai-faq-title">Common questions</h2><div class="neo-pulse-faq-list">'
			. implode( '', $items )
			. '</div>'
			. ( is_string( $json ) ? '<script type="application/ld+json">' . $json . '</script>' : '' )
			. '</section>';
		$main  = stripos( $html, '</main>' );
		if ( $main === false ) {
			return $html;
		}
		return substr_replace( $html, $block, $main, 0 );
	}

	public static function split_long_paragraphs( string $html ): string {
		$next = preg_replace_callback(
			'/<p(\s[^>]*)?>([^<]{420,})<\/p>/u',
			static function ( array $m ): string {
				$text  = $m[2];
				$attrs = isset( $m[1] ) ? $m[1] : '';
				$mid   = (int) floor( strlen( $text ) / 2 );
				$dot   = strpos( $text, '. ', max( 0, $mid - 80 ) );
				if ( $dot === false ) {
					$dot = strpos( $text, '. ' );
				}
				if ( $dot === false || $dot < 80 ) {
					return $m[0];
				}
				$first = trim( substr( $text, 0, $dot + 1 ) );
				$second = trim( substr( $text, $dot + 2 ) );
				if ( $first === '' || $second === '' ) {
					return $m[0];
				}
				return '<p' . $attrs . '>' . $first . '</p><p' . $attrs . '>' . $second . '</p>';
			},
			$html
		);
		return is_string( $next ) ? $next : $html;
	}
}

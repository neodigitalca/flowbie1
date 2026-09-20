<?php
/**
 * Print stored rank_math_title and rank_math_description on the front end.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Front-end title and meta description from stored SEO keys.
 */
class Neo_Pulse_Wp_Frontend_Seo {

	const TITLE_KEY = 'rank_math_title';
	const DESC_KEY  = 'rank_math_description';

	public static function init(): void {
		add_filter( 'pre_get_document_title', array( __CLASS__, 'filter_document_title' ), 20 );
		add_action( 'wp_head', array( __CLASS__, 'print_meta_description' ), 1 );
		add_action( 'wp_head', array( __CLASS__, 'print_social_and_schema' ), 6 );
		add_action( 'template_redirect', array( __CLASS__, 'redirect_leftover_urls' ), 1 );
	}

	/**
	 * @return array<string, string>
	 */
	public static function leftover_redirects(): array {
		return array(
			'/digital-marketing-guide'  => '/blog/digital-marketing-guide/',
			'/digital-marketing-guide/' => '/blog/digital-marketing-guide/',
			'/service-area/edmonton-window-treatment-seo-104-avenue-edmonton-2'  => '/service-area/edmonton-window-treatment-seo-104-avenue-edmonton/',
			'/service-area/edmonton-window-treatment-seo-104-avenue-edmonton-2/' => '/service-area/edmonton-window-treatment-seo-104-avenue-edmonton/',
		);
	}

	public static function redirect_leftover_urls(): void {
		if ( ! isset( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}
		$path = function_exists( 'wp_parse_url' )
			? (string) wp_parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH )
			: (string) parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH );
		$map  = self::leftover_redirects();
		if ( ! isset( $map[ $path ] ) ) {
			return;
		}
		if ( ! function_exists( 'wp_safe_redirect' ) || ! function_exists( 'home_url' ) ) {
			return;
		}
		wp_safe_redirect( home_url( $map[ $path ] ), 301 );
		exit;
	}

	public static function title_from_slug( string $slug ): string {
		if ( class_exists( 'Neo_Pulse_Wp_A11y_Front', false ) ) {
			return Neo_Pulse_Wp_A11y_Front::heading_from_slug( $slug );
		}
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
			$out[] = ucfirst( $part );
		}
		return implode( ' ', $out );
	}

	public static function title_matches_slug( string $title, string $slug ): bool {
		if ( class_exists( 'Neo_Pulse_Wp_A11y_Front', false ) ) {
			return Neo_Pulse_Wp_A11y_Front::heading_matches_slug( $title, $slug );
		}
		$tokens = preg_split( '/[-_]+/', strtolower( $slug ) );
		if ( ! is_array( $tokens ) ) {
			return true;
		}
		$hay  = strtolower( $title );
		$need = 0;
		$hit  = 0;
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
	 * @param mixed $value Stored meta.
	 */
	public static function normalize_meta( $value ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return trim( $value );
	}

	public static function description_html( string $description ): string {
		$description = self::normalize_meta( $description );
		if ( $description === '' ) {
			return '';
		}
		$escaped = function_exists( 'esc_attr' )
			? esc_attr( $description )
			: htmlspecialchars( $description, ENT_QUOTES, 'UTF-8' );
		return '<meta name="description" content="' . $escaped . '" />';
	}

	/**
	 * @param mixed $title Current document title.
	 * @return mixed
	 */
	public static function filter_document_title( $title ) {
		if ( ! function_exists( 'is_singular' ) || ! is_singular() ) {
			return $title;
		}
		$post_id = (int) get_queried_object_id();
		if ( $post_id < 1 ) {
			return $title;
		}
		$stored = self::normalize_meta( get_post_meta( $post_id, self::TITLE_KEY, true ) );
		if ( $stored === '' ) {
			$stored = is_string( $title ) ? $title : '';
		}
		$clean = self::clean_title_suffix( $stored );
		return $clean !== '' ? $clean : $title;
	}

	public static function clean_title_suffix( string $title ): string {
		$title = trim( $title );
		if ( $title === '' ) {
			return '';
		}
		$title = preg_replace( '/\s*[|–-]\s*Neo Digital\s*[|–-]\s*Neo Digital\s*$/u', ' | Neo Digital', $title );
		return is_string( $title ) ? trim( $title ) : '';
	}

	public static function print_meta_description(): void {
		if ( ! function_exists( 'is_singular' ) || ! is_singular() ) {
			return;
		}
		$post_id = (int) get_queried_object_id();
		if ( $post_id < 1 ) {
			return;
		}
		$html = self::description_html( (string) get_post_meta( $post_id, self::DESC_KEY, true ) );
		if ( $html === '' ) {
			return;
		}
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in description_html.
		echo $html . "\n";
	}

	public static function print_social_and_schema(): void {
		if ( ! function_exists( 'is_singular' ) || ! is_singular() ) {
			if ( function_exists( 'is_front_page' ) && is_front_page() ) {
				echo self::head_extras_html( self::current_head_context() );
			}
			return;
		}
		echo self::head_extras_html( self::current_head_context() );
	}

	/**
	 * @param array{title: string, description: string, url: string, image: string} $ctx
	 */
	public static function head_extras_html( array $ctx ): string {
		$title = self::clean_title_suffix( self::normalize_meta( $ctx['title'] ?? '' ) );
		$desc  = self::normalize_meta( $ctx['description'] ?? '' );
		$url   = self::normalize_meta( $ctx['url'] ?? '' );
		$image = self::normalize_meta( $ctx['image'] ?? '' );
		if ( $title === '' && $desc === '' ) {
			return '';
		}
		$esc = static function ( string $value ): string {
			return function_exists( 'esc_attr' )
				? esc_attr( $value )
				: htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
		};
		$out = '';
		if ( $title !== '' ) {
			$out .= '<meta property="og:title" content="' . $esc( $title ) . '" />' . "\n";
			$out .= '<meta name="twitter:title" content="' . $esc( $title ) . '" />' . "\n";
		}
		if ( $desc !== '' ) {
			$out .= '<meta property="og:description" content="' . $esc( $desc ) . '" />' . "\n";
			$out .= '<meta name="twitter:description" content="' . $esc( $desc ) . '" />' . "\n";
		}
		if ( $url !== '' ) {
			$out .= '<meta property="og:url" content="' . $esc( $url ) . '" />' . "\n";
		}
		if ( $image !== '' ) {
			$out .= '<meta property="og:image" content="' . $esc( $image ) . '" />' . "\n";
			$out .= '<meta name="twitter:image" content="' . $esc( $image ) . '" />' . "\n";
		}
		$out .= '<meta property="og:type" content="website" />' . "\n";
		$out .= '<meta name="twitter:card" content="summary_large_image" />' . "\n";
		$schema = array(
			'@context' => 'https://schema.org',
			'@graph'   => array(
				array(
					'@type' => 'Organization',
					'name'  => 'Neo Digital',
					'url'   => function_exists( 'home_url' ) ? home_url( '/' ) : 'https://neodigital.ca/',
				),
				array(
					'@type'       => 'WebPage',
					'name'        => $title,
					'description' => $desc,
					'url'         => $url !== '' ? $url : ( function_exists( 'home_url' ) ? home_url( '/' ) : '' ),
				),
			),
		);
		$json = function_exists( 'wp_json_encode' )
			? wp_json_encode( $schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES )
			: json_encode( $schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( is_string( $json ) && $json !== '' ) {
			$out .= '<script type="application/ld+json" id="neo-pulse-ai-webpage">' . $json . '</script>' . "\n";
		}
		return $out;
	}

	/**
	 * @return array{title: string, description: string, url: string, image: string}
	 */
	public static function current_head_context(): array {
		$title = '';
		$desc  = '';
		$url   = function_exists( 'home_url' ) ? home_url( '/' ) : '';
		$image = '';
		if ( function_exists( 'is_singular' ) && is_singular() && function_exists( 'get_queried_object_id' ) ) {
			$post_id = (int) get_queried_object_id();
			$title   = self::normalize_meta( (string) get_post_meta( $post_id, self::TITLE_KEY, true ) );
			if ( $title === '' && function_exists( 'get_the_title' ) ) {
				$title = self::normalize_meta( (string) get_the_title( $post_id ) );
			}
			$desc = self::normalize_meta( (string) get_post_meta( $post_id, self::DESC_KEY, true ) );
			if ( function_exists( 'get_permalink' ) ) {
				$link = get_permalink( $post_id );
				if ( is_string( $link ) ) {
					$url = $link;
				}
			}
			if ( function_exists( 'get_the_post_thumbnail_url' ) ) {
				$thumb = get_the_post_thumbnail_url( $post_id, 'full' );
				if ( is_string( $thumb ) ) {
					$image = $thumb;
				}
			}
		} elseif ( function_exists( 'get_bloginfo' ) ) {
			$title = self::normalize_meta( (string) get_bloginfo( 'name' ) );
			$desc  = self::normalize_meta( (string) get_bloginfo( 'description' ) );
		}
		return array(
			'title'       => self::clean_title_suffix( $title ),
			'description' => $desc,
			'url'         => $url,
			'image'       => $image,
		);
	}

	/**
	 * Inject OG/Twitter/JSON-LD when the document is missing them.
	 *
	 * @param string $html HTML.
	 */
	public static function process( string $html ): string {
		if ( $html === '' || stripos( $html, '<html' ) === false ) {
			return $html;
		}
		$head_end = stripos( $html, '</head>' );
		if ( $head_end === false ) {
			return $html;
		}
		$head = substr( $html, 0, $head_end );
		$need = stripos( $head, 'property="og:title"' ) === false
			|| stripos( $head, 'name="twitter:card"' ) === false
			|| stripos( $head, 'id="neo-pulse-ai-webpage"' ) === false;
		if ( ! $need ) {
			return $html;
		}
		if ( preg_match( '/<title>([^<]+)<\/title>/i', $head, $tm ) ) {
			$title = self::clean_title_suffix( html_entity_decode( trim( $tm[1] ), ENT_QUOTES, 'UTF-8' ) );
			$path  = '';
			if ( isset( $_SERVER['REQUEST_URI'] ) ) {
				$path = function_exists( 'wp_parse_url' )
					? (string) wp_parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH )
					: (string) parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH );
			}
			if ( preg_match( '#/blog/([^/]+)/?$#', $path, $sm ) && ! self::title_matches_slug( $title, $sm[1] ) ) {
				$from_slug = self::title_from_slug( $sm[1] );
				if ( $from_slug !== '' ) {
					$title = $from_slug . ' | Neo Digital';
				}
			}
			$html  = preg_replace( '/<title>[^<]+<\/title>/i', '<title>' . ( function_exists( 'esc_html' ) ? esc_html( $title ) : $title ) . '</title>', $html, 1 );
			$head_end = stripos( $html, '</head>' );
			if ( $head_end === false ) {
				return $html;
			}
		} else {
			$title = '';
		}
		$desc = '';
		if ( preg_match( '/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $dm ) ) {
			$desc = html_entity_decode( $dm[1], ENT_QUOTES, 'UTF-8' );
		}
		$url = '';
		if ( preg_match( '/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']/i', $html, $cm ) ) {
			$url = $cm[1];
		}
		$extras = self::head_extras_html(
			array(
				'title'       => $title,
				'description' => $desc,
				'url'         => $url,
				'image'       => '',
			)
		);
		if ( $extras === '' ) {
			return is_string( $html ) ? $html : '';
		}
		$inject = '';
		if ( stripos( $html, 'property="og:title"' ) === false ) {
			$inject .= $extras;
		} elseif ( stripos( $html, 'id="neo-pulse-ai-webpage"' ) === false && preg_match( '/<script type="application\/ld\+json" id="neo-pulse-ai-webpage">.*?<\/script>\n?/s', $extras, $sm ) ) {
			$inject .= $sm[0];
		}
		if ( $inject === '' ) {
			return is_string( $html ) ? $html : '';
		}
		return substr_replace( $html, $inject, (int) stripos( $html, '</head>' ), 0 );
	}
}

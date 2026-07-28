<?php
/**
 * Sitemap URL sets for vertical benchmark GSC filtering.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Vertical_Benchmark_Sitemap_Urls {

	const MAX_SITEMAPS = 24;

	/**
	 * @param array<string,mixed> $site
	 * @return array{postPaths:array<string,bool>,entityPaths:array<string,bool>}
	 */
	public static function resolve_url_sets( array $site ): array {
		$site_url = rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' );
		$username = (string) ( $site['username'] ?? '' );
		$password = (string) ( $site['appPassword'] ?? '' );

		$post_urls   = array();
		$entity_urls = array();

		$entity_sitemap = trim( (string) ( $site['entitySitemapUrl'] ?? '' ) );
		if ( $entity_sitemap !== '' ) {
			$entity_urls = array_merge( $entity_urls, self::parse_sitemap_page_urls( $entity_sitemap, $username, $password ) );
		}

		$sitemaps = isset( $site['sitemaps'] ) && is_array( $site['sitemaps'] ) ? $site['sitemaps'] : null;
		if ( $sitemaps && ! empty( $sitemaps['urls'] ) && is_array( $sitemaps['urls'] ) ) {
			foreach ( $sitemaps['urls'] as $u ) {
				if ( is_string( $u ) && strpos( $u, 'http' ) === 0 ) {
					$post_urls[] = $u;
				}
			}
		}

		$children = ( $sitemaps && ! empty( $sitemaps['childSitemaps'] ) && is_array( $sitemaps['childSitemaps'] ) ) ? $sitemaps['childSitemaps'] : array();
		foreach ( $children as $child_url ) {
			$sm = (string) $child_url;
			if ( strpos( $sm, 'http' ) !== 0 ) {
				continue;
			}
			$pages = self::parse_sitemap_page_urls( $sm, $username, $password );
			if ( self::sitemap_looks_like_entity( $sm ) ) {
				$entity_urls = array_merge( $entity_urls, $pages );
			} elseif ( self::sitemap_looks_like_post( $sm ) || $entity_sitemap === '' ) {
				$post_urls = array_merge( $post_urls, $pages );
			}
		}

		if ( empty( $post_urls ) && empty( $entity_urls ) && $site_url !== '' ) {
			foreach ( self::discover_child_sitemap_urls( $site_url, $username, $password ) as $sm ) {
				$pages = self::parse_sitemap_page_urls( $sm, $username, $password );
				if ( self::sitemap_looks_like_entity( $sm ) ) {
					$entity_urls = array_merge( $entity_urls, $pages );
				} else {
					$post_urls = array_merge( $post_urls, $pages );
				}
			}
		}

		return array(
			'postPaths'   => self::path_set_from_urls( $post_urls ),
			'entityPaths' => self::path_set_from_urls( $entity_urls ),
		);
	}

	public static function classify_url_by_sitemap( string $page_url, array $post_paths, array $entity_paths ): string {
		$path = self::normalize_page_path( $page_url );
		if ( isset( $post_paths[ $path ] ) ) {
			return 'post';
		}
		if ( isset( $entity_paths[ $path ] ) ) {
			return 'entity';
		}
		return 'unknown';
	}

	public static function normalize_page_path( string $url ): string {
		$path = wp_parse_url( trim( $url ), PHP_URL_PATH );
		$p    = is_string( $path ) ? strtolower( $path ) : strtolower( trim( $url ) );
		if ( strlen( $p ) > 1 && substr( $p, -1 ) === '/' ) {
			$p = substr( $p, 0, -1 );
		}
		return $p;
	}

	/** @param string[] $urls @return array<string,bool> */
	private static function path_set_from_urls( array $urls ): array {
		$set = array();
		foreach ( $urls as $u ) {
			$p = self::normalize_page_path( $u );
			if ( $p !== '' ) {
				$set[ $p ] = true;
			}
		}
		return $set;
	}

	private static function sitemap_looks_like_post( string $haystack ): bool {
		$h = strtolower( $haystack );
		if ( strpos( $h, 'service-area' ) !== false || strpos( $h, 'service_area' ) !== false || strpos( $h, 'servicearea' ) !== false ) {
			return false;
		}
		if ( strpos( $h, 'page-sitemap' ) !== false || strpos( $h, 'category' ) !== false || strpos( $h, 'product' ) !== false ) {
			return false;
		}
		return strpos( $h, 'post-sitemap' ) !== false || strpos( $h, 'posts' ) !== false || strpos( $h, 'article' ) !== false;
	}

	private static function sitemap_looks_like_entity( string $haystack ): bool {
		$h = strtolower( $haystack );
		return strpos( $h, 'service-area' ) !== false || strpos( $h, 'service_area' ) !== false || strpos( $h, 'servicearea' ) !== false;
	}

	/** @return string[] */
	private static function discover_child_sitemap_urls( string $site_base, string $username, string $password ): array {
		$child = array();
		$base  = rtrim( $site_base, '/' );
		foreach ( array( '/wp-sitemap.xml', '/sitemap_index.xml', '/sitemap.xml' ) as $path ) {
			$response = self::wp_get( $base . $path, $username, $password );
			if ( empty( $response['ok'] ) ) {
				continue;
			}
			$xml = (string) $response['body'];
			if ( preg_match_all( '/<loc>\s*([^<\s]+)\s*<\/loc>/i', $xml, $matches ) ) {
				foreach ( $matches[1] as $loc ) {
					$loc = trim( $loc );
					if ( strpos( $loc, 'http' ) === 0 ) {
						$child[ $loc ] = true;
					}
				}
			} elseif ( strpos( $xml, '<urlset' ) !== false ) {
				$child[ $base . $path ] = true;
			}
			if ( count( $child ) >= self::MAX_SITEMAPS ) {
				break;
			}
		}
		return array_slice( array_keys( $child ), 0, self::MAX_SITEMAPS );
	}

	/** @return string[] */
	private static function parse_sitemap_page_urls( string $sitemap_url, string $username, string $password ): array {
		$response = self::wp_get( $sitemap_url, $username, $password );
		if ( empty( $response['ok'] ) ) {
			return array();
		}
		$urls = array();
		if ( preg_match_all( '/<loc>\s*([^<\s]+)\s*<\/loc>/i', (string) $response['body'], $matches ) ) {
			foreach ( $matches[1] as $loc ) {
				$loc = trim( $loc );
				if ( strpos( $loc, 'http' ) === 0 ) {
					$urls[] = $loc;
				}
			}
		}
		return $urls;
	}

	/** @return array{ok:bool,body?:string} */
	private static function wp_get( string $url, string $username, string $password ): array {
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $username . ':' . $password ),
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code !== 200 ) {
			return array( 'ok' => false );
		}
		return array( 'ok' => true, 'body' => wp_remote_retrieve_body( $response ) );
	}
}

<?php
/**
 * Resolve public URLs to WordPress REST objects (POST /resolve-urls).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wp_Url_Resolver {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function resolve_urls( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$urls         = isset( $body['urls'] ) && is_array( $body['urls'] ) ? $body['urls'] : array();
		$entity_sm    = isset( $body['entitySitemapUrl'] ) ? $body['entitySitemapUrl'] : null;
		$known_ep     = isset( $body['knownEndpoint'] ) ? $body['knownEndpoint'] : null;

		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return array( 400, array( 'error' => 'Missing required fields: siteUrl, username, appPassword' ) );
		}
		if ( ! $urls ) {
			return array( 400, array( 'error' => 'Missing or empty urls array' ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$resolved   = array();
		$bad        = array();
		$batch_size = 10;

		for ( $i = 0; $i < count( $urls ); $i += $batch_size ) {
			$batch = array_slice( $urls, $i, $batch_size );
			foreach ( $batch as $url ) {
				$url = (string) $url;
				try {
					$item = self::resolve_one( $normalized, $username, $app_password, $url, $entity_sm, $known_ep );
					if ( $item ) {
						$resolved[] = $item;
					} else {
						$bad[] = array(
							'url'    => $url,
							'reason' => 'Could not resolve URL via post/entity resolver.',
						);
					}
				} catch ( Exception $e ) {
					$bad[] = array(
						'url'    => $url,
						'reason' => $e->getMessage(),
					);
				}
			}
		}

		$type_counts = array();
		foreach ( $resolved as $item ) {
			$sub = isset( $item['subtype'] ) ? (string) $item['subtype'] : 'unknown';
			$type_counts[ $sub ] = isset( $type_counts[ $sub ] ) ? $type_counts[ $sub ] + 1 : 1;
		}

		return array(
			200,
			array(
				'resolved'     => $resolved,
				'unresolvable' => $bad,
				'summary'      => array(
					'total'        => count( $urls ),
					'resolved'     => count( $resolved ),
					'unresolvable' => count( $bad ),
					'typeCounts'   => $type_counts,
				),
			),
		);
	}

	/**
	 * @param string      $normalized Site URL.
	 * @param string      $username User.
	 * @param string      $app_password Password.
	 * @param string      $url Input URL.
	 * @param string|null $entity_sitemap_url Entity sitemap.
	 * @param string|null $known_endpoint Known CPT endpoint.
	 * @return array<string,mixed>|null
	 */
	private static function resolve_one( $normalized, $username, $app_password, $url, $entity_sitemap_url, $known_endpoint ) {
		$input = trim( $url );
		if ( ! preg_match( '#^https?://#i', $input ) ) {
			$input = $normalized . ( strpos( $input, '/' ) === 0 ? $input : '/' . $input );
		}

		$parsed   = wp_parse_url( $input );
		$pathname = isset( $parsed['path'] ) ? (string) $parsed['path'] : '';
		$is_blog  = (bool) preg_match( '#/blog/#i', $pathname ) ||
			(bool) preg_match( '#/\d{4}/\d{2}/#', $pathname ) ||
			$pathname === '/' ||
			strpos( $pathname, '/page/' ) === 0;

		$resolved = null;
		if ( $is_blog ) {
			$resolved = self::resolve_post_url( $normalized, $username, $app_password, $url );
		}
		if ( ! $resolved && ( $known_endpoint || $entity_sitemap_url ) ) {
			$resolved = self::resolve_entity_url( $normalized, $username, $app_password, $url, $entity_sitemap_url, $known_endpoint );
		}
		if ( ! $resolved ) {
			$resolved = self::resolve_post_url( $normalized, $username, $app_password, $url );
		}

		if ( ! $resolved ) {
			return null;
		}

		$resolved['url'] = $url;
		if ( empty( $resolved['endpoint'] ) ) {
			$resolved['endpoint'] = ( isset( $resolved['subtype'] ) && $resolved['subtype'] === 'page' ) ? 'pages' : 'posts';
		}
		return $resolved;
	}

	/**
	 * @param string $normalized Site URL.
	 * @param string $username User.
	 * @param string $app_password Password.
	 * @param string $url URL.
	 * @return array<string,mixed>|null
	 */
	private static function resolve_post_url( $normalized, $username, $app_password, $url ) {
		$input = trim( $url );
		if ( ! preg_match( '#^https?://#i', $input ) ) {
			$input = $normalized . ( strpos( $input, '/' ) === 0 ? $input : '/' . $input );
		}
		$slug = Flowbie_App_Wp_Url_Normalize::extract_slug( $input );
		if ( $slug === '' ) {
			return null;
		}

		foreach ( array( 'posts', 'pages' ) as $endpoint ) {
			$resp = Flowbie_App_Wp_Rest_Client::request(
				'GET',
				$normalized . '/wp-json/wp/v2/' . $endpoint,
				$username,
				$app_password,
				array(
					'timeout' => 15,
					'params'  => array(
						'slug'    => $slug,
						'context' => 'edit',
					),
				)
			);
			if ( $resp['is_wp_error'] || (int) $resp['status'] !== 200 || ! is_array( $resp['body'] ) || ! $resp['body'] ) {
				continue;
			}
			$candidates = array();
			foreach ( $resp['body'] as $post ) {
				if ( ! is_array( $post ) ) {
					continue;
				}
				$ptype   = isset( $post['type'] ) ? (string) $post['type'] : '';
				$status  = isset( $post['status'] ) ? (string) $post['status'] : '';
				$expect  = rtrim( $endpoint, 's' );
				if ( $ptype !== $expect && $ptype !== $endpoint ) {
					continue;
				}
				if ( in_array( $status, array( 'trash', 'trashed' ), true ) ) {
					continue;
				}
				$candidates[] = $post;
			}
			if ( ! $candidates ) {
				continue;
			}
			$canonical = null;
			foreach ( $candidates as $c ) {
				$parent = isset( $c['parent'] ) ? (int) $c['parent'] : 0;
				if ( $parent <= 0 ) {
					$canonical = $c;
					break;
				}
			}
			if ( ! $canonical ) {
				$canonical = $candidates[0];
			}
			return array(
				'id'      => (int) ( $canonical['id'] ?? 0 ),
				'subtype' => $endpoint === 'pages' ? 'page' : 'post',
				'link'    => (string) ( $canonical['link'] ?? $url ),
				'slug'    => (string) ( $canonical['slug'] ?? $slug ),
			);
		}
		return null;
	}

	/**
	 * @param string      $normalized Site URL.
	 * @param string      $username User.
	 * @param string      $app_password Password.
	 * @param string      $url URL.
	 * @param string|null $entity_sitemap_url Sitemap URL.
	 * @param string|null $known_endpoint Endpoint.
	 * @return array<string,mixed>|null
	 */
	private static function resolve_entity_url( $normalized, $username, $app_password, $url, $entity_sitemap_url, $known_endpoint ) {
		$input = trim( $url );
		if ( ! preg_match( '#^https?://#i', $input ) ) {
			$input = $normalized . ( strpos( $input, '/' ) === 0 ? $input : '/' . $input );
		}
		$target_path = strtolower( rtrim( (string) wp_parse_url( $input, PHP_URL_PATH ), '/' ) );
		$endpoint    = $known_endpoint ? (string) $known_endpoint : Flowbie_App_Wp_Url_Normalize::endpoint_from_entity_sitemap_url( $entity_sitemap_url );
		if ( ! $endpoint ) {
			return null;
		}

		for ( $page = 1; $page <= 10; $page++ ) {
			$resp = Flowbie_App_Wp_Rest_Client::request(
				'GET',
				$normalized . '/wp-json/wp/v2/' . rawurlencode( $endpoint ),
				$username,
				$app_password,
				array(
					'timeout' => 15,
					'params'  => array(
						'per_page' => 100,
						'page'     => $page,
						'status'   => 'publish',
						'_fields'  => 'id,slug,link,type,post_type,status,parent',
					),
				)
			);
			if ( $resp['is_wp_error'] || (int) $resp['status'] === 404 ) {
				break;
			}
			if ( (int) $resp['status'] !== 200 || ! is_array( $resp['body'] ) ) {
				break;
			}
			foreach ( $resp['body'] as $entity ) {
				if ( ! is_array( $entity ) ) {
					continue;
				}
				$link_path = strtolower( rtrim( (string) wp_parse_url( (string) ( $entity['link'] ?? '' ), PHP_URL_PATH ), '/' ) );
				if ( $link_path !== $target_path ) {
					continue;
				}
				$parent = isset( $entity['parent'] ) ? (int) $entity['parent'] : 0;
				$status = isset( $entity['status'] ) ? (string) $entity['status'] : '';
				$type   = isset( $entity['type'] ) ? (string) $entity['type'] : '';
				if ( $parent > 0 || in_array( $status, array( 'trash', 'trashed' ), true ) || $type === 'revision' ) {
					continue;
				}
				return array(
					'id'       => (int) ( $entity['id'] ?? 0 ),
					'subtype'  => $endpoint,
					'link'     => (string) ( $entity['link'] ?? $url ),
					'slug'     => (string) ( $entity['slug'] ?? Flowbie_App_Wp_Url_Normalize::extract_slug( $url ) ),
					'endpoint' => $endpoint,
				);
			}
			$total_pages = (int) ( $resp['headers']['x-wp-totalpages'] ?? 1 );
			if ( $page >= $total_pages ) {
				break;
			}
		}
		return null;
	}
}

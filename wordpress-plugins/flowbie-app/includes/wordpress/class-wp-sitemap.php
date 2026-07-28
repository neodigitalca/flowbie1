<?php
/**
 * Sitemap detect/parse/future-post checks.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wp_Sitemap {

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function detect_sitemaps( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';

		if ( $site_url === '' ) {
			return array( 400, array( 'found' => false, 'message' => 'Missing required field: siteUrl' ) );
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$paths      = array( '/sitemap_index.xml', '/sitemap.xml' );

		foreach ( $paths as $path ) {
			$sitemap_url = $normalized . $path;
			$options     = array(
				'timeout' => 10,
				'accept'  => 'application/xml,text/xml,*/*',
			);
			if ( $username && $app_password ) {
				$response = Flowbie_App_Wp_Rest_Client::request( 'GET', $sitemap_url, $username, $app_password, $options );
			} else {
				$response = self::public_get( $sitemap_url, 10 );
			}

			if ( $response['is_wp_error'] || (int) $response['status'] !== 200 ) {
				continue;
			}

			$content_type = isset( $response['headers']['content-type'] ) ? $response['headers']['content-type'] : '';
			$xml          = is_string( $response['body'] ) ? $response['body'] : ( is_string( $response['raw'] ) ? $response['raw'] : '' );
			if ( $xml === '' || ( strpos( $content_type, 'xml' ) === false && strpos( $xml, '<' ) === false ) ) {
				continue;
			}
			if ( strpos( $xml, '<sitemapindex' ) === false && strpos( $xml, '<urlset' ) === false ) {
				continue;
			}

			$is_index = strpos( $xml, '<sitemapindex' ) !== false;
			return array(
				200,
				array(
					'found'      => true,
					'sitemapUrl' => $sitemap_url,
					'type'       => $is_index ? 'index' : 'urlset',
					'content'    => $xml,
				),
			);
		}

		return array( 200, array( 'found' => false, 'message' => 'No sitemap detected at common locations' ) );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function parse_sitemap( $body ) {
		$sitemap_url  = isset( $body['sitemapUrl'] ) ? (string) $body['sitemapUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';

		if ( $sitemap_url === '' ) {
			return array( 400, array( 'error' => 'Missing required field: sitemapUrl' ) );
		}

		$options = array( 'timeout' => 10, 'accept' => 'application/xml,text/xml,*/*' );
		if ( $username && $app_password ) {
			$response = Flowbie_App_Wp_Rest_Client::request( 'GET', $sitemap_url, $username, $app_password, $options );
		} else {
			$response = self::public_get( $sitemap_url, 10 );
		}

		if ( $response['is_wp_error'] ) {
			return array( 500, array( 'error' => $response['error'] ) );
		}

		$status = (int) $response['status'];
		if ( $status !== 200 ) {
			return array( $status, array( 'error' => 'Failed to fetch sitemap: HTTP ' . $status ) );
		}

		$xml = is_string( $response['raw'] ) ? $response['raw'] : '';
		if ( $xml === '' ) {
			return array( 400, array( 'error' => 'Empty sitemap content received', 'sitemapUrl' => $sitemap_url ) );
		}

		$trimmed = ltrim( $xml );
		$first   = substr( $trimmed, 0, 1 );
		if ( $first === '/' || $first === '\\' || ( $first !== '<' && stripos( $trimmed, '<?xml' ) !== 0 ) ) {
			return array(
				400,
				array(
					'error'      => 'Sitemap URL returned invalid content (starts with "' . $first . '"). Expected XML.',
					'sitemapUrl' => $sitemap_url,
					'suggestion' => 'The sitemap URL may be incorrect or returning a redirect/error page.',
				),
			);
		}

		if ( stripos( $trimmed, '<!doctype html' ) === 0 || stripos( $trimmed, '<html' ) === 0 ) {
			return array(
				400,
				array(
					'error'   => 'Sitemap URL returned HTML instead of XML',
					'details' => array(
						'sitemapUrl'     => $sitemap_url,
						'contentPreview' => substr( $xml, 0, 200 ),
					),
				),
			);
		}

		libxml_use_internal_errors( true );
		$doc = simplexml_load_string( $xml );
		if ( false === $doc ) {
			return array(
				400,
				array(
					'error'      => 'Failed to parse XML sitemap',
					'sitemapUrl' => $sitemap_url,
				),
			);
		}

		if ( isset( $doc->sitemap ) ) {
			$child = array();
			foreach ( $doc->sitemap as $sm ) {
				if ( isset( $sm->loc ) ) {
					$child[] = (string) $sm->loc;
				}
			}
			return array(
				200,
				array(
					'type'          => 'index',
					'childSitemaps' => array_values( array_filter( $child ) ),
					'urls'          => array(),
				),
			);
		}

		if ( isset( $doc->url ) ) {
			$page_urls = array();
			foreach ( $doc->url as $u ) {
				if ( isset( $u->loc ) ) {
					$page_urls[] = (string) $u->loc;
				}
			}
			$filtered = self::filter_urls_for_sitemap( $page_urls, $sitemap_url );
			return array(
				200,
				array(
					'type'          => 'urlset',
					'urls'          => $filtered,
					'childSitemaps' => array(),
				),
			);
		}

		return array( 400, array( 'error' => 'Invalid sitemap format. Expected sitemapindex or urlset.' ) );
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function check_future_posts( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$sitemap_url  = isset( $body['sitemapUrl'] ) ? (string) $body['sitemapUrl'] : '';

		if ( $site_url === '' || $username === '' || $app_password === '' || $sitemap_url === '' ) {
			return array(
				400,
				array(
					'success' => false,
					'error'   => 'Missing required fields: siteUrl, username, appPassword, sitemapUrl',
				),
			);
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$norm_sm    = trim( $sitemap_url );
		if ( ! preg_match( '#^https?://#i', $norm_sm ) ) {
			$norm_sm = $normalized . ( strpos( $norm_sm, '/' ) === 0 ? $norm_sm : '/' . $norm_sm );
		}

		$parse = self::parse_sitemap(
			array(
				'sitemapUrl'  => $norm_sm,
				'username'    => $username,
				'appPassword' => $app_password,
			)
		);
		if ( $parse[0] !== 200 || empty( $parse[1]['urls'] ) ) {
			if ( ! empty( $parse[1]['type'] ) && $parse[1]['type'] === 'index' ) {
				return array( 400, array( 'success' => false, 'error' => 'Sitemap index provided. Please use a child sitemap URL instead.' ) );
			}
			return array( 200, array( 'success' => true, 'futureCount' => 0, 'posts' => array() ) );
		}

		$sitemap_urls = $parse[1]['urls'];
		$future_posts = array();
		$now          = gmdate( 'Y-m-d H:i:s' );
		$batch_size   = 10;

		for ( $i = 0; $i < count( $sitemap_urls ); $i += $batch_size ) {
			$batch = array_slice( $sitemap_urls, $i, $batch_size );
			foreach ( $batch as $url ) {
				$slug = Flowbie_App_Wp_Url_Normalize::extract_slug( $url );
				if ( $slug === '' ) {
					continue;
				}
				$post_data = null;
				foreach ( array( 'posts', 'pages', 'service-area' ) as $post_type ) {
					$resp = Flowbie_App_Wp_Rest_Client::request(
						'GET',
						$normalized . '/wp-json/wp/v2/' . rawurlencode( $post_type ),
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
					if ( $resp['is_wp_error'] || (int) $resp['status'] !== 200 || ! is_array( $resp['body'] ) ) {
						continue;
					}
					foreach ( $resp['body'] as $post ) {
						if ( ! is_array( $post ) ) {
							continue;
						}
						$expected_type = ( $post_type === 'posts' ) ? 'post' : $post_type;
						$ptype         = isset( $post['type'] ) ? (string) $post['type'] : '';
						$parent        = isset( $post['parent'] ) ? (int) $post['parent'] : 0;
						$pstatus       = isset( $post['status'] ) ? (string) $post['status'] : '';
						if ( $ptype !== $expected_type && $ptype !== $post_type ) {
							continue;
						}
						if ( $parent > 0 || $pstatus === 'trash' ) {
							continue;
						}
						$post_data = array(
							'id'       => (int) ( $post['id'] ?? 0 ),
							'slug'     => (string) ( $post['slug'] ?? $slug ),
							'title'    => Flowbie_App_Wp_Url_Normalize::rendered_text( $post['title'] ?? '' ) ?: 'Untitled',
							'date_gmt' => (string) ( $post['date_gmt'] ?? '' ),
							'status'   => $pstatus ?: 'publish',
							'link'     => (string) ( $post['link'] ?? $url ),
						);
						break 2;
					}
				}
				if ( $post_data ) {
					$is_future = ( $post_data['status'] === 'future' ) ||
						( $post_data['date_gmt'] !== '' && $post_data['date_gmt'] > $now );
					if ( $is_future ) {
						$future_posts[] = $post_data;
					}
				}
			}
		}

		return array(
			200,
			array(
				'success'     => true,
				'futureCount' => count( $future_posts ),
				'posts'       => $future_posts,
			),
		);
	}

	/**
	 * @param string[] $page_urls URLs from sitemap.
	 * @param string   $sitemap_url Sitemap URL.
	 * @return string[]
	 */
	private static function filter_urls_for_sitemap( $page_urls, $sitemap_url ) {
		if ( ! is_array( $page_urls ) ) {
			return array();
		}
		$drop_blog = self::is_post_type_sitemap_url( $sitemap_url ) || self::is_top_level_sitemap_url( $sitemap_url );
		$urls      = $drop_blog ? array_values( array_filter( $page_urls, array( __CLASS__, 'is_not_blog_archive_url' ) ) ) : $page_urls;
		if ( self::is_post_type_sitemap_url( $sitemap_url ) ) {
			$urls = self::filter_post_sitemap_archive_roots( $urls );
		}
		return $urls;
	}

	/** @param string $url URL. */
	public static function is_not_blog_archive_url( $url ) {
		return ! self::is_blog_archive_url( $url );
	}

	private static function is_post_type_sitemap_url( $sitemap_url ) {
		$lower = strtolower( (string) $sitemap_url );
		if ( strpos( $lower, 'post-sitemap' ) !== false || strpos( $lower, 'post_sitemap' ) !== false ) {
			return true;
		}
		if ( strpos( $lower, 'posts-sitemap' ) !== false || strpos( $lower, 'posts_sitemap' ) !== false ) {
			return true;
		}
		if ( preg_match( '/wp-sitemap-posts-post-\d+\.xml(\?|$|#)/i', $lower ) ) {
			return true;
		}
		return strpos( $lower, 'wp-sitemap-posts-post' ) !== false;
	}

	private static function is_blog_archive_url( $url ) {
		$parsed = wp_parse_url( (string) $url );
		if ( empty( $parsed['path'] ) ) {
			return false;
		}
		$path = rtrim( $parsed['path'], '/' ) ?: '/';
		return $path === '/blog';
	}

	private static function is_top_level_sitemap_url( $sitemap_url ) {
		$path = strtolower( strtok( (string) $sitemap_url, '?' ) );
		$last = basename( $path );
		return in_array( $last, array( 'sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml' ), true );
	}

	/**
	 * @param string[] $urls URLs.
	 * @return string[]
	 */
	private static function filter_post_sitemap_archive_roots( $urls ) {
		$first_seg_has_child = array();
		foreach ( $urls as $u ) {
			$segs = self::path_segments( $u );
			if ( count( $segs ) >= 2 ) {
				$first_seg_has_child[ strtolower( $segs[0] ) ] = true;
			}
		}
		return array_values(
			array_filter(
				$urls,
				static function ( $u ) use ( $first_seg_has_child ) {
					$segs = Flowbie_App_Wp_Sitemap::path_segments( $u );
					if ( count( $segs ) !== 1 ) {
						return true;
					}
					return empty( $first_seg_has_child[ strtolower( $segs[0] ) ] );
				}
			)
		);
	}

	/**
	 * @param string $url URL.
	 * @return string[]
	 */
	private static function path_segments( $url ) {
		$parsed = wp_parse_url( (string) $url );
		if ( empty( $parsed['path'] ) ) {
			return array();
		}
		$path = rtrim( $parsed['path'], '/' );
		return $path === '' ? array() : array_values( array_filter( explode( '/', $path ) ) );
	}

	/**
	 * @param string $url URL.
	 * @param int    $timeout Timeout seconds.
	 * @return array{status:int,headers:array<string,string>,body:mixed,raw:string,is_wp_error:bool,error:string}
	 */
	private static function public_get( $url, $timeout ) {
		$response = wp_remote_get(
			$url,
			array(
				'timeout'     => $timeout,
				'redirection' => 5,
				'headers'     => array(
					'User-Agent' => Flowbie_App_Wp_Rest_Client::USER_AGENT,
					'Accept'     => 'application/xml,text/xml,*/*',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array(
				'status'      => 0,
				'headers'     => array(),
				'body'        => null,
				'raw'         => '',
				'is_wp_error' => true,
				'error'       => $response->get_error_message(),
			);
		}
		$raw = (string) wp_remote_retrieve_body( $response );
		return array(
			'status'      => (int) wp_remote_retrieve_response_code( $response ),
			'headers'     => Flowbie_App_Wp_Rest_Client::flatten_headers( wp_remote_retrieve_headers( $response ) ),
			'body'        => $raw,
			'raw'         => $raw,
			'is_wp_error' => false,
			'error'       => '',
		);
	}
}

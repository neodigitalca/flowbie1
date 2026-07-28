<?php
/**
 * Author usage stats (POST /get-author-usage).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Wp_Author_Resolver {

	const CACHE_MS = 60000;

	/** @var array<string,array{at:int,body:array<string,mixed>}> */
	private static $cache = array();

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function get_author_usage( $body ) {
		$site_url     = isset( $body['siteUrl'] ) ? (string) $body['siteUrl'] : '';
		$username     = isset( $body['username'] ) ? (string) $body['username'] : '';
		$app_password = isset( $body['appPassword'] ) ? (string) $body['appPassword'] : '';
		$endpoint     = isset( $body['postTypeEndpoint'] ) ? (string) $body['postTypeEndpoint'] : 'posts';
		$limit        = isset( $body['limit'] ) ? (int) $body['limit'] : 500;

		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return array(
				400,
				array(
					'authors' => array(),
					'error'   => 'Missing required fields: siteUrl, username, appPassword',
				),
			);
		}

		$normalized = Flowbie_App_Wp_Url_Normalize::normalize_url( $site_url );
		$endpoint   = $endpoint !== '' ? $endpoint : 'posts';
		$limit      = max( 1, min( 5000, $limit ) );
		$cache_key  = $normalized . '|' . $endpoint . '|' . $limit;

		if ( isset( self::$cache[ $cache_key ] ) && ( microtime( true ) * 1000 - self::$cache[ $cache_key ]['at'] ) < self::CACHE_MS ) {
			return array( 200, self::$cache[ $cache_key ]['body'] );
		}

		$api_url        = $normalized . '/wp-json/wp/v2/' . rawurlencode( $endpoint );
		$author_counts  = array();
		$page           = 1;
		$has_more       = true;
		$total_fetched  = 0;

		while ( $has_more && $total_fetched < $limit ) {
			$resp = Flowbie_App_Wp_Rest_Client::request(
				'GET',
				$api_url,
				$username,
				$app_password,
				array(
					'timeout' => 30,
					'params'  => array(
						'per_page' => min( 100, $limit - $total_fetched ),
						'page'     => $page,
						'_fields'  => 'id,author',
						'status'   => 'publish',
					),
				)
			);

			if ( $resp['is_wp_error'] ) {
				return array( 500, array( 'authors' => array(), 'error' => $resp['error'] ) );
			}

			$status = (int) $resp['status'];
			if ( $status === 401 ) {
				return array( 401, array( 'authors' => array(), 'error' => 'Authentication failed. Please verify your username and application password.' ) );
			}
			if ( $status === 404 ) {
				return array( 404, array( 'authors' => array(), 'error' => 'Post type endpoint not found: ' . $endpoint ) );
			}
			if ( $status !== 200 || ! is_array( $resp['body'] ) ) {
				break;
			}

			$posts = $resp['body'];
			foreach ( $posts as $post ) {
				if ( ! is_array( $post ) ) {
					continue;
				}
				$author_id = isset( $post['author'] ) ? $post['author'] : 0;
				if ( is_array( $author_id ) && isset( $author_id['id'] ) ) {
					$author_id = $author_id['id'];
				}
				$author_id = (int) $author_id;
				if ( $author_id > 0 ) {
					$author_counts[ $author_id ] = isset( $author_counts[ $author_id ] ) ? $author_counts[ $author_id ] + 1 : 1;
				}
			}

			$total_fetched += count( $posts );
			$total_pages    = (int) ( isset( $resp['headers']['x-wp-totalpages'] ) ? $resp['headers']['x-wp-totalpages'] : 1 );
			if ( count( $posts ) === 0 || $page >= $total_pages || $total_fetched >= $limit ) {
				$has_more = false;
			} else {
				++$page;
			}
		}

		if ( ! $author_counts ) {
			$fallback = self::users_fallback( $normalized, $username, $app_password, $total_fetched );
			self::$cache[ $cache_key ] = array( 'at' => (int) ( microtime( true ) * 1000 ), 'body' => $fallback );
			return array( 200, $fallback );
		}

		$authors = array();
		foreach ( array_keys( $author_counts ) as $user_id ) {
			$authors[] = self::fetch_user( $normalized, $username, $app_password, (int) $user_id, $author_counts[ $user_id ] );
		}

		usort(
			$authors,
			static function ( $a, $b ) {
				return ( $b['postCount'] ?? 0 ) <=> ( $a['postCount'] ?? 0 );
			}
		);

		$result = array(
			'authors'           => $authors,
			'totalPostsScanned' => $total_fetched,
		);
		self::$cache[ $cache_key ] = array( 'at' => (int) ( microtime( true ) * 1000 ), 'body' => $result );
		return array( 200, $result );
	}

	/**
	 * @param string $normalized Site URL.
	 * @param string $username User.
	 * @param string $app_password Password.
	 * @param int    $total_fetched Posts scanned.
	 * @return array<string,mixed>
	 */
	private static function users_fallback( $normalized, $username, $app_password, $total_fetched ) {
		$resp = Flowbie_App_Wp_Rest_Client::request(
			'GET',
			$normalized . '/wp-json/wp/v2/users',
			$username,
			$app_password,
			array(
				'timeout' => 15,
				'params'  => array(
					'per_page' => 10,
					'context'  => 'edit',
				),
			)
		);
		if ( ! $resp['is_wp_error'] && (int) $resp['status'] === 200 && is_array( $resp['body'] ) && $resp['body'] ) {
			$users = array();
			foreach ( $resp['body'] as $u ) {
				if ( ! is_array( $u ) ) {
					continue;
				}
				$users[] = array(
					'id'        => (int) ( $u['id'] ?? 0 ),
					'postCount' => 0,
					'name'      => (string) ( $u['name'] ?? $u['slug'] ?? 'User' ),
					'slug'      => (string) ( $u['slug'] ?? '' ),
					'email'     => (string) ( $u['email'] ?? '' ),
				);
			}
			return array(
				'authors'           => $users,
				'totalPostsScanned' => 0,
			);
		}
		return array(
			'authors'           => array(),
			'totalPostsScanned' => $total_fetched,
		);
	}

	/**
	 * @param string $normalized Site URL.
	 * @param string $username User.
	 * @param string $app_password Password.
	 * @param int    $user_id User ID.
	 * @param int    $post_count Count.
	 * @return array<string,mixed>
	 */
	private static function fetch_user( $normalized, $username, $app_password, $user_id, $post_count ) {
		$resp = Flowbie_App_Wp_Rest_Client::request(
			'GET',
			$normalized . '/wp-json/wp/v2/users/' . $user_id,
			$username,
			$app_password,
			array(
				'timeout' => 15,
				'params'  => array( 'context' => 'edit' ),
			)
		);
		if ( ! $resp['is_wp_error'] && (int) $resp['status'] === 200 && is_array( $resp['body'] ) ) {
			$u = $resp['body'];
			return array(
				'id'        => $user_id,
				'postCount' => $post_count,
				'name'      => (string) ( $u['name'] ?? $u['slug'] ?? ( 'User ' . $user_id ) ),
				'slug'      => (string) ( $u['slug'] ?? '' ),
				'email'     => (string) ( $u['email'] ?? '' ),
			);
		}
		return array(
			'id'        => $user_id,
			'postCount' => $post_count,
			'name'      => 'User ' . $user_id,
			'slug'      => '',
			'email'     => '',
		);
	}
}

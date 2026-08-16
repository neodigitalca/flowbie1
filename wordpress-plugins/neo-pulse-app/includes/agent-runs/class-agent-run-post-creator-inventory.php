<?php
/**
 * Post sitemap inventory for server post creator (posts bucket).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Post_Creator_Inventory {

	/**
	 * @param array<string,mixed> $site
	 * @return array{urls:array<int,string>,posts:array<int,array<string,mixed>>,json:string}
	 */
	public static function load_posts_bucket( array $site, int $limit = 100 ): array {
		$site_url = rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' );
		$user     = (string) ( $site['username'] ?? '' );
		$pass     = (string) ( $site['appPassword'] ?? '' );
		if ( $site_url === '' || $user === '' || $pass === '' ) {
			return array(
				'urls'  => array(),
				'posts' => array(),
				'json'  => self::encode_posts_bucket_json( array() ),
			);
		}

		list( $code, $body ) = Neo_Pulse_App_Wp_Posts_Inventory::get_published_posts(
			array(
				'siteUrl'     => $site_url,
				'username'    => $user,
				'appPassword' => $pass,
				'limit'       => $limit,
			)
		);

		$posts = ( $code >= 200 && $code < 300 && is_array( $body['posts'] ?? null ) ) ? $body['posts'] : array();
		$urls  = array();
		$slim  = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$link = trim( (string) ( $post['link'] ?? '' ) );
			if ( $link !== '' ) {
				$urls[] = $link;
			}
			$slim[] = array(
				'id'    => (int) ( $post['id'] ?? 0 ),
				'slug'  => (string) ( $post['slug'] ?? '' ),
				'title' => (string) ( $post['title'] ?? '' ),
				'link'  => $link,
			);
		}

		$json = self::encode_posts_bucket_json( $slim );

		return array(
			'urls'  => $urls,
			'posts' => $posts,
			'json'  => $json,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $posts
	 */
	public static function encode_posts_bucket_json( array $posts ): string {
		$json = wp_json_encode(
			array(
				'source' => 'posts',
				'posts'  => array_values( $posts ),
			),
			JSON_PRETTY_PRINT
		);

		return is_string( $json ) ? $json : '{"source":"posts","posts":[]}';
	}

	/**
	 * @param array<string,mixed> $site
	 */
	public static function bucket_artifact_name( array $site ): string {
		$host = preg_replace( '/^https?:\\/\\//', '', (string) ( $site['siteUrl'] ?? '' ) );
		$host = preg_replace( '/[^\\w.-]+/', '-', (string) $host );
		$host = substr( (string) $host, 0, 40 );
		if ( $host === '' ) {
			$host = 'site';
		}
		return 'content-bucket-posts-' . $host . '.json';
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function parse_posts_from_bucket_json( string $json ): array {
		$doc = json_decode( $json, true );
		if ( ! is_array( $doc ) ) {
			return array();
		}
		$posts = is_array( $doc['posts'] ?? null ) ? $doc['posts'] : array();
		return array_values(
			array_filter(
				array_map(
					static function ( $post ) {
						if ( ! is_array( $post ) ) {
							return null;
						}
						return array(
							'id'      => (int) ( $post['id'] ?? 0 ),
							'slug'    => (string) ( $post['slug'] ?? '' ),
							'title'   => (string) ( $post['title'] ?? '' ),
							'link'    => (string) ( $post['link'] ?? '' ),
							'excerpt' => (string) ( $post['excerpt'] ?? '' ),
						);
					},
					$posts
				)
			)
		);
	}

	/**
	 * @param array<string,mixed> $site
	 * @return array<int,array<string,mixed>>
	 */
	public static function load_posts_for_link_resolve( int $run_id, array $site ): array {
		$bucket_name = self::bucket_artifact_name( $site );
		$json        = Neo_Pulse_App_Agent_Runs_Artifacts::read_artifact_content( $run_id, 'content-bucket', $bucket_name );
		if ( $json !== '' ) {
			$posts = self::parse_posts_from_bucket_json( $json );
			if ( ! empty( $posts ) ) {
				return $posts;
			}
		}

		$inventory = self::load_posts_bucket( $site, 100 );
		$posts     = is_array( $inventory['posts'] ?? null ) ? $inventory['posts'] : array();
		return array_values(
			array_filter(
				array_map(
					static function ( $post ) {
						if ( ! is_array( $post ) ) {
							return null;
						}
						return array(
							'id'      => (int) ( $post['id'] ?? 0 ),
							'slug'    => (string) ( $post['slug'] ?? '' ),
							'title'   => (string) ( $post['title'] ?? '' ),
							'link'    => (string) ( $post['link'] ?? '' ),
							'excerpt' => (string) ( $post['excerpt'] ?? '' ),
						);
					},
					$posts
				)
			)
		);
	}

	public static function read_bucket_json_for_run( int $run_id, array $site ): string {
		$bucket_name = self::bucket_artifact_name( $site );
		$json        = Neo_Pulse_App_Agent_Runs_Artifacts::read_artifact_content( $run_id, 'content-bucket', $bucket_name );
		if ( $json !== '' ) {
			return $json;
		}
		$inventory = self::load_posts_bucket( $site, 100 );
		return (string) ( $inventory['json'] ?? '' );
	}

	public static function build_bucket_read_first_block( string $bucket_json ): string {
		$bucket_json = trim( $bucket_json );
		if ( $bucket_json === '' ) {
			return '';
		}
		return "=== CONTENT BUCKET JSON (READ FIRST — ONLY SOURCE FOR [[LINK:query|anchor]] PHRASES) ===\n"
			. "Read every post title and URL below before writing. Pick search phrases that match these pages.\n"
			. "Do not embed raw URLs in output; use [[LINK:search phrase|anchor text]] placeholders only.\n\n"
			. $bucket_json . "\n"
			. "=== END CONTENT BUCKET JSON ===\n\n";
	}
}

<?php
/**
 * Knowledge model graph generation (WordPress REST + Python ML service).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Knowledge_Model_Service {

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	public static function generate_graph( array $params ): array {
		$site_id      = (string) ( $params['siteId'] ?? '' );
		$sitemap_urls = isset( $params['sitemapUrls'] ) && is_array( $params['sitemapUrls'] ) ? $params['sitemapUrls'] : array();
		$site_url     = (string) ( $params['siteUrl'] ?? '' );
		$username     = (string) ( $params['username'] ?? '' );
		$password     = (string) ( $params['appPassword'] ?? '' );
		$gsc_data     = isset( $params['gscData'] ) && is_array( $params['gscData'] ) ? $params['gscData'] : array();

		if ( $site_id === '' || empty( $sitemap_urls ) ) {
			throw new Exception( 'Missing required fields: siteId, sitemapUrls (array)' );
		}
		if ( $site_url === '' || $username === '' || $password === '' ) {
			throw new Exception( 'Missing WordPress credentials: siteUrl, username, appPassword' );
		}

		$content = self::collect_content_from_sitemaps( $sitemap_urls, $site_url, $username, $password );
		if ( empty( $content ) ) {
			throw new Exception( 'No content found in selected sitemaps' );
		}

		$processed = self::prepare_for_python( $content, $gsc_data );
		$graph     = self::call_python_process_graph( $site_id, $processed['content'], $processed['gsc'], count( $content ) );
		return $graph;
	}

	/**
	 * @param array<string,mixed> $params
	 */
	public static function run_auto_graph( array $params ): void {
		$job_id = (string) ( $params['jobId'] ?? wp_generate_uuid4() );
		try {
			Flowbie_App_Knowledge_Model_Progress::init( $job_id );
			Flowbie_App_Knowledge_Model_Progress::update( $job_id, array( 'status' => 'fetching_sitemaps', 'currentStep' => 'Fetching sitemaps...' ) );

			$site_url = (string) ( $params['siteUrl'] ?? '' );
			$username = (string) ( $params['username'] ?? '' );
			$password = (string) ( $params['appPassword'] ?? '' );
			$gsc_data = isset( $params['gscData'] ) && is_array( $params['gscData'] ) ? $params['gscData'] : array();
			$site_id  = (string) ( $params['siteId'] ?? '' );

			$sitemap_urls = self::fetch_post_sitemaps( $site_url, $username, $password );
			if ( empty( $sitemap_urls ) ) {
				throw new Exception( 'No sitemaps found for this site' );
			}

			Flowbie_App_Knowledge_Model_Progress::update(
				$job_id,
				array(
					'status'       => 'collecting_content',
					'currentStep'  => 'Found ' . count( $sitemap_urls ) . ' sitemaps. Collecting content...',
					'sitemapCount' => count( $sitemap_urls ),
				)
			);

			$content = self::collect_content_from_sitemaps(
				$sitemap_urls,
				$site_url,
				$username,
				$password,
				static function ( $message, $details = array() ) use ( $job_id ) {
					if ( ! empty( $details['totalPosts'] ) ) {
						Flowbie_App_Knowledge_Model_Progress::set_total_posts( $job_id, (int) $details['totalPosts'] );
					}
					if ( ! empty( $details['url'] ) ) {
						Flowbie_App_Knowledge_Model_Progress::add_post( $job_id, $details );
					}
					Flowbie_App_Knowledge_Model_Progress::update( $job_id, array( 'currentStep' => $message ) );
				}
			);

			if ( empty( $content ) ) {
				throw new Exception( 'No content found in sitemaps' );
			}

			Flowbie_App_Knowledge_Model_Progress::update(
				$job_id,
				array(
					'status'      => 'building_graph',
					'currentStep' => 'Building knowledge graph...',
				)
			);

			$processed = self::prepare_for_python( $content, $gsc_data );
			$graph     = self::call_python_process_graph( $site_id, $processed['content'], $processed['gsc'], count( $content ) );
			Flowbie_App_Knowledge_Model_Progress::complete( $job_id, $graph );
		} catch ( Exception $e ) {
			Flowbie_App_Knowledge_Model_Progress::fail( $job_id, $e->getMessage() );
		}
	}

	/**
	 * @param array<int,array<string,mixed>> $gsc_data
	 * @return array<string,mixed>
	 */
	public static function expand_node( string $keyword, array $gsc_data ): array {
		$keyword_lower = strtolower( trim( $keyword ) );
		foreach ( $gsc_data as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$query = strtolower( trim( (string) ( $item['query'] ?? '' ) ) );
			if ( $query === $keyword_lower ) {
				return array(
					'keyword'  => $keyword,
					'gsc_data' => array(
						'clicks'      => (int) ( $item['clicks'] ?? 0 ),
						'impressions' => (int) ( $item['impressions'] ?? 0 ),
						'position'    => (float) ( $item['position'] ?? 0 ),
						'ctr'         => (float) ( $item['ctr'] ?? 0 ),
					),
				);
			}
		}
		return array(
			'keyword'  => $keyword,
			'gsc_data' => null,
		);
	}

	/** @return string[] */
	private static function fetch_post_sitemaps( string $site_url, string $username, string $password ): array {
		$base   = rtrim( $site_url, '/' );
		$found  = array();
		foreach ( array( '/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml' ) as $path ) {
			$xml = self::wp_get_body( $base . $path, $username, $password );
			if ( $xml === '' ) {
				continue;
			}
			if ( preg_match_all( '/<loc>\s*([^<\s]+)\s*<\/loc>/i', $xml, $matches ) ) {
				foreach ( $matches[1] as $loc ) {
					$loc_l = strtolower( trim( $loc ) );
					if ( strpos( $loc_l, 'post-sitemap' ) !== false || strpos( $loc_l, 'post_sitemap' ) !== false || strpos( $loc_l, 'posts-sitemap' ) !== false || strpos( $loc_l, 'posts_sitemap' ) !== false ) {
						$found[ trim( $loc ) ] = true;
					}
				}
			} elseif ( strpos( strtolower( $base . $path ), 'post-sitemap' ) !== false ) {
				$found[ $base . $path ] = true;
			}
		}
		return array_keys( $found );
	}

	/**
	 * @param string[] $sitemap_urls
	 * @param callable|null $progress
	 * @return array<int,array<string,mixed>>
	 */
	private static function collect_content_from_sitemaps( array $sitemap_urls, string $site_url, string $username, string $password, ?callable $progress = null ): array {
		$urls = array();
		foreach ( $sitemap_urls as $sm ) {
			$xml = self::wp_get_body( (string) $sm, $username, $password );
			if ( $xml === '' ) {
				continue;
			}
			if ( preg_match_all( '/<loc>\s*([^<\s]+)\s*<\/loc>/i', $xml, $matches ) ) {
				foreach ( $matches[1] as $loc ) {
					$loc = trim( $loc );
					if ( strpos( $loc, 'http' ) === 0 ) {
						$urls[ $loc ] = true;
					}
				}
			}
		}
		$url_list = array_keys( $urls );
		if ( $progress ) {
			$progress( 'Collecting ' . count( $url_list ) . ' posts...', array( 'totalPosts' => count( $url_list ) ) );
		}

		$content = array();
		foreach ( $url_list as $url ) {
			if ( $progress ) {
				$progress( 'Downloading post...', array( 'url' => $url, 'status' => 'processing', 'title' => 'Downloading...' ) );
			}
			$post = self::fetch_post_by_url( $site_url, $username, $password, $url );
			if ( empty( $post['success'] ) ) {
				if ( $progress ) {
					$progress( 'Post failed', array( 'url' => $url, 'status' => 'failed', 'error' => $post['error'] ?? 'fetch failed' ) );
				}
				continue;
			}
			$row = array(
				'id'      => $post['id'] ?? null,
				'title'   => (string) ( $post['title'] ?? '' ),
				'content' => (string) ( $post['content'] ?? '' ),
				'excerpt' => (string) ( $post['excerpt'] ?? '' ),
				'url'     => $url,
			);
			$content[] = $row;
			if ( $progress ) {
				$progress(
					'Post downloaded',
					array(
						'url'    => $url,
						'status' => 'success',
						'id'     => $row['id'],
						'title'  => $row['title'],
					)
				);
			}
		}
		return $content;
	}

	/**
	 * @param array<int,array<string,mixed>> $content
	 * @param array<int,array<string,mixed>> $gsc_data
	 * @return array{content:array<int,array<string,mixed>>,gsc:array<int,array<string,mixed>>}
	 */
	private static function prepare_for_python( array $content, array $gsc_data ): array {
		$keywords = array();
		foreach ( $content as $item ) {
			$title = strtolower( trim( (string) ( $item['title'] ?? '' ) ) );
			if ( $title !== '' ) {
				$keywords[ $title ] = true;
			}
		}
		$gsc_map = array();
		foreach ( $gsc_data as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$query = strtolower( trim( (string) ( $row['query'] ?? '' ) ) );
			if ( $query !== '' ) {
				$gsc_map[ $query ] = $row;
			}
		}
		$processed_gsc = array();
		foreach ( array_keys( $keywords ) as $keyword ) {
			$processed_gsc[] = $gsc_map[ $keyword ] ?? array(
				'query'       => $keyword,
				'clicks'      => 0,
				'impressions' => 0,
				'position'    => 0,
				'ctr'         => 0,
			);
		}
		$processed_content = array();
		foreach ( $content as $item ) {
			$processed_content[] = array(
				'id'      => $item['id'] ?? null,
				'title'   => $item['title'] ?? '',
				'content' => $item['content'] ?? '',
				'excerpt' => $item['excerpt'] ?? '',
			);
		}
		return array(
			'content' => $processed_content,
			'gsc'     => $processed_gsc,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $content
	 * @param array<int,array<string,mixed>> $gsc_data
	 * @return array<string,mixed>
	 */
	private static function call_python_process_graph( string $site_id, array $content, array $gsc_data, int $total_posts ): array {
		if ( ! self::python_ml_available() ) {
			throw new Exception( self::python_ml_help_message() );
		}
		$url = rtrim( self::python_ml_url(), '/' ) . '/process-graph';
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 300,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'site_id'   => $site_id,
						'content'   => $content,
						'gsc_data'  => $gsc_data,
						'options'   => array(
							'site_id'     => $site_id,
							'total_posts' => $total_posts,
						),
					)
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			throw new Exception( $response->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) || empty( $data['graph'] ) ) {
			$msg = is_array( $data ) ? ( $data['error'] ?? $data['message'] ?? 'Python ML service error' ) : 'Python ML service error';
			throw new Exception( (string) $msg );
		}
		return is_array( $data['graph'] ) ? $data['graph'] : array( 'graph' => $data['graph'] );
	}

	private static function python_ml_available(): bool {
		$url = rtrim( self::python_ml_url(), '/' ) . '/health';
		$response = wp_remote_get( $url, array( 'timeout' => 5 ) );
		if ( is_wp_error( $response ) ) {
			return false;
		}
		return (int) wp_remote_retrieve_response_code( $response ) === 200;
	}

	private static function python_ml_url(): string {
		if ( defined( 'FLOWBIE_APP_PYTHON_ML_SERVICE_URL' ) && FLOWBIE_APP_PYTHON_ML_SERVICE_URL !== '' ) {
			return (string) FLOWBIE_APP_PYTHON_ML_SERVICE_URL;
		}
		return 'http://localhost:8000';
	}

	private static function python_ml_help_message(): string {
		return 'Python ML service is not running. Please start it with: cd server/python-ml-service && pip install -r requirements.txt && python app.py. The service should be running on ' . self::python_ml_url();
	}

	/**
	 * @return array{success:bool,id?:int,title?:string,content?:string,excerpt?:string,error?:string}
	 */
	private static function fetch_post_by_url( string $site_url, string $username, string $password, string $url ): array {
		list( $status, $resolved ) = Flowbie_App_Wp_Url_Resolver::resolve_urls(
			array(
				'siteUrl'     => $site_url,
				'username'    => $username,
				'appPassword' => $password,
				'urls'        => array( $url ),
			)
		);
		if ( $status !== 200 || empty( $resolved['resolved'][0] ) || ! is_array( $resolved['resolved'][0] ) ) {
			return array(
				'success' => false,
				'error'   => ! empty( $resolved['unresolvable'][0]['reason'] ) ? (string) $resolved['unresolvable'][0]['reason'] : 'Could not resolve URL',
			);
		}
		list( $content_status, $content ) = Flowbie_App_Wp_Post_Content::get_post_content(
			array(
				'siteUrl'          => $site_url,
				'username'         => $username,
				'appPassword'      => $password,
				'resolvedObjects'  => array( $resolved['resolved'][0] ),
			)
		);
		if ( $content_status !== 200 || empty( $content['posts'][0] ) || ! is_array( $content['posts'][0] ) ) {
			return array(
				'success' => false,
				'error'   => ! empty( $content['error'] ) ? (string) $content['error'] : 'Failed to load post content',
			);
		}
		$post = $content['posts'][0];
		return array(
			'success' => true,
			'id'      => isset( $post['id'] ) ? (int) $post['id'] : null,
			'title'   => (string) ( $post['title'] ?? '' ),
			'content' => (string) ( $post['content'] ?? '' ),
			'excerpt' => (string) ( $post['excerpt'] ?? '' ),
		);
	}

	private static function wp_get_body( string $url, string $username, string $password ): string {
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $username . ':' . $password ),
				),
			)
		);
		if ( is_wp_error( $response ) || (int) wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return '';
		}
		return (string) wp_remote_retrieve_body( $response );
	}
}

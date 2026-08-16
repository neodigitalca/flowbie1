<?php
/**
 * Google Business Profile post inventory, blog pick, and publish helpers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Gmb_Posts_Api {

	const MYBUSINESS_V4_BASE      = 'https://mybusiness.googleapis.com/v4';
	const ACCOUNT_MGMT_BASE       = 'https://mybusinessaccountmanagement.googleapis.com/v1';
	const BUSINESS_INFO_BASE      = 'https://mybusinessbusinessinformation.googleapis.com/v1';
	const RECENT_MEDIA_CAP        = 10;
	const PUBLISH_NOW_GRACE_SEC   = 120;

	/** @var array<string,string> */
	private static $location_parent_cache = array();

	/** @var array<int,string>|null */
	private static $account_names_cache = null;

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function posts_inventory( array $body ): array {
		$raw_location = self::location_id_from_body( $body );
		$location_id  = self::normalize_location_id( $raw_location );
		if ( $location_id === '' ) {
			return self::error( 400, 'gbpLocationId or (accountId and locationId) required.' );
		}

		$access_token = Neo_Pulse_App_Gmb_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return self::error( 401, $access_token->get_error_message() );
		}

		$site_name     = trim( (string) ( $body['siteName'] ?? '' ) );
		$site_url      = trim( (string) ( $body['siteUrl'] ?? '' ) );
		$location_name = self::resolve_location_parent( $access_token, $raw_location, $site_name, $site_url );
		if ( is_wp_error( $location_name ) ) {
			return self::error( 422, $location_name->get_error_message() );
		}

		$posts = self::fetch_all_local_posts( $access_token, $location_name );
		if ( is_wp_error( $posts ) ) {
			return self::error( 422, $posts->get_error_message() );
		}

		$rows               = array();
		$exclude_cta_urls   = array();
		$exclude_media_urls = array();

		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$row = self::map_local_post_row( $post );
			if ( $row ) {
				$rows[] = $row;
			}
			$cta = isset( $post['callToAction']['url'] ) ? trim( (string) $post['callToAction']['url'] ) : '';
			if ( $cta !== '' && strpos( $cta, 'http' ) === 0 ) {
				$exclude_cta_urls[] = $cta;
			}
			if ( ! empty( $post['media'] ) && is_array( $post['media'] ) ) {
				foreach ( $post['media'] as $media ) {
					if ( ! is_array( $media ) ) {
						continue;
					}
					$src = isset( $media['sourceUrl'] ) ? trim( (string) $media['sourceUrl'] ) : '';
					if ( $src !== '' && strpos( $src, 'http' ) === 0 ) {
						$exclude_media_urls[] = $src;
					}
				}
			}
		}

		$exclude_cta_urls   = array_values( array_unique( $exclude_cta_urls ) );
		$exclude_media_urls = array_slice( array_values( array_unique( $exclude_media_urls ) ), 0, self::RECENT_MEDIA_CAP );

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'                => true,
				'posts'                  => $rows,
				'count'                  => count( $rows ),
				'excludeCtaUrls'         => $exclude_cta_urls,
				'excludeRecentMediaUrls' => $exclude_media_urls,
			),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function pick_blog_post( array $body ): array {
		$site_url     = trim( (string) ( $body['siteUrl'] ?? '' ) );
		$username     = trim( (string) ( $body['username'] ?? '' ) );
		$app_password = trim( (string) ( $body['appPassword'] ?? '' ) );
		$sitemap_url  = trim( (string) ( $body['sitemapUrl'] ?? '' ) );
		$keyword      = trim( (string) ( $body['keyword'] ?? '' ) );
		$api_key      = Neo_Pulse_App_Vertical_Benchmark_Openrouter::resolve_key( (string) ( $body['openRouterApiKey'] ?? '' ) );

		if ( $site_url === '' || $username === '' || $app_password === '' ) {
			return self::error( 400, 'siteUrl, username, and appPassword are required.' );
		}
		if ( $sitemap_url === '' ) {
			return self::error( 400, 'sitemapUrl is required. Configure the child sitemap in Integrations for this source.' );
		}
		if ( $api_key === '' ) {
			return self::error( 400, 'openRouterApiKey is required (or set OPENROUTER_API_KEY).' );
		}

		$exclude = self::normalize_url_list( $body['excludeUrls'] ?? array() );
		$exclude = array_merge( $exclude, self::normalize_url_list( $body['excludeGbpCtaUrls'] ?? array() ) );
		$exclude = array_values( array_unique( $exclude ) );

		list( $status, $parsed ) = Neo_Pulse_App_Wp_Sitemap::parse_sitemap(
			array(
				'sitemapUrl'  => $sitemap_url,
				'username'    => $username,
				'appPassword' => $app_password,
			)
		);
		if ( $status !== 200 || ! is_array( $parsed ) ) {
			$msg = is_array( $parsed ) && ! empty( $parsed['error'] )
				? (string) $parsed['error']
				: 'Failed to fetch sitemap (HTTP ' . $status . ').';
			return self::error( 422, $msg );
		}
		if ( ! empty( $parsed['childSitemaps'] ) && is_array( $parsed['childSitemaps'] ) ) {
			return self::error(
				422,
				'Paste the child sitemap URL (e.g. page-sitemap.xml) in Integrations, not the index.'
			);
		}
		if ( empty( $parsed['urls'] ) || ! is_array( $parsed['urls'] ) ) {
			return self::error( 404, 'No URLs in sitemap.' );
		}

		$candidate_urls = array();
		foreach ( array_slice( $parsed['urls'], 0, 40 ) as $page_url ) {
			$normalized = self::normalize_public_url( (string) $page_url );
			if ( $normalized === '' || in_array( $normalized, $exclude, true ) ) {
				continue;
			}
			if ( self::is_index_or_archive_url( $normalized, $site_url ) ) {
				continue;
			}
			$candidate_urls[] = $normalized;
		}
		if ( ! $candidate_urls ) {
			return self::error( 404, 'No eligible URLs in sitemap after exclusions.' );
		}

		$candidates = self::build_candidates_from_urls( $candidate_urls );

		$preferred = self::normalize_public_url( trim( (string) ( $body['preferredUrl'] ?? '' ) ) );
		if ( $preferred !== '' ) {
			if ( ! in_array( $preferred, $candidate_urls, true ) ) {
				return self::error( 422, 'Landing page URL not found in sitemap.' );
			}
			$picked = self::build_candidates_from_urls( array( $preferred ) )[0] ?? null;
			if ( ! is_array( $picked ) ) {
				return self::error( 422, 'Landing page URL not found in sitemap.' );
			}
			$picked['reason'] = 'User-specified landing page URL.';
		} else {
			try {
				$picked = self::openrouter_pick_blog_post( $api_key, $keyword, $candidates );
			} catch ( Exception $e ) {
				return self::error( 422, $e->getMessage() );
			}
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'  => true,
				'blogPost' => $picked,
			),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function publish_from_harness( array $body ): array {
		$site_url        = trim( (string) ( $body['siteUrl'] ?? '' ) );
		$username        = trim( (string) ( $body['username'] ?? '' ) );
		$app_password    = trim( (string) ( $body['appPassword'] ?? '' ) );
		$gbp_location_raw  = trim( (string) ( $body['gbpLocationId'] ?? '' ) );
		$gbp_location_id   = self::normalize_location_id( $gbp_location_raw );
		$blog_url        = trim( (string) ( $body['blogPostUrl'] ?? '' ) );
		$blog_title      = trim( (string) ( $body['blogPostTitle'] ?? '' ) );
		$blog_excerpt    = trim( (string) ( $body['blogPostExcerpt'] ?? '' ) );
		$keyword         = trim( (string) ( $body['keyword'] ?? '' ) );
		$site_name       = trim( (string) ( $body['siteName'] ?? '' ) );
		$pre_copy        = trim( (string) ( $body['preGeneratedCopy'] ?? '' ) );
		$api_key         = Neo_Pulse_App_Vertical_Benchmark_Openrouter::resolve_key( (string) ( $body['openRouterApiKey'] ?? '' ) );
		$should_publish  = ! array_key_exists( 'publish', $body ) || ! empty( $body['publish'] );
		$scheduled_at    = trim( (string) ( $body['scheduledPublishAt'] ?? '' ) );

		if ( $site_url === '' || $username === '' || $app_password === '' || $gbp_location_id === '' ) {
			return self::error( 400, 'siteUrl, username, appPassword, and gbpLocationId are required.' );
		}
		if ( $api_key === '' ) {
			return self::error( 400, 'openRouterApiKey is required (or set OPENROUTER_API_KEY).' );
		}
		if ( $blog_url === '' || $blog_title === '' ) {
			return self::error( 400, 'blogPostUrl and blogPostTitle are required.' );
		}

		try {
			$summary = $pre_copy !== '' ? $pre_copy : self::openrouter_gbp_summary(
				$api_key,
				$blog_title,
				$blog_excerpt,
				$keyword,
				$site_name
			);
		} catch ( Exception $e ) {
			return self::error( 422, $e->getMessage() );
		}

		$image = self::featured_image_for_url( $site_url, $username, $app_password, $blog_url );
		$exclude_media = self::normalize_url_list( $body['excludeMediaUrls'] ?? array() );
		if ( $image && in_array( $image['sourceUrl'], $exclude_media, true ) ) {
			$image = null;
		}

		$preview = array(
			'summary'          => $summary,
			'moneyPageUrl'     => $blog_url,
			'moneyPageReason'  => 'Learn more CTA target from sitemap pick.',
			'imageSearchTerms' => array( 'library' ),
			'media'            => $image ? $image : array(),
			'linkedBlog'       => array(
				'blogPostUrl'     => $blog_url,
				'blogPostTitle'   => $blog_title,
				'blogPostExcerpt' => $blog_excerpt,
				'reason'          => 'Harness linked page.',
			),
		);

		if ( ! $should_publish ) {
			return array(
				'statusCode' => 200,
				'body'       => array(
					'success'   => true,
					'preview'   => $preview,
					'published' => false,
					'scheduled' => false,
				),
			);
		}

		$scheduled_ts = $scheduled_at !== '' ? strtotime( $scheduled_at ) : 0;
		$publish_now  = $scheduled_ts <= 0 || $scheduled_ts <= ( time() + self::PUBLISH_NOW_GRACE_SEC );

		if ( ! $publish_now ) {
			$queued = self::enqueue_scheduled_post(
				array(
					'scheduledPublishAt' => gmdate( 'c', $scheduled_ts ),
					'gbpLocationId'      => $gbp_location_id,
					'summary'            => $summary,
					'blogPostUrl'        => $blog_url,
					'blogPostTitle'      => $blog_title,
					'imageUrl'           => $image ? (string) $image['sourceUrl'] : '',
				)
			);
			if ( is_wp_error( $queued ) ) {
				return self::error( 500, $queued->get_error_message() );
			}
			return array(
				'statusCode' => 200,
				'body'       => array(
					'success'     => true,
					'preview'     => $preview,
					'published'   => false,
					'scheduled'   => true,
					'scheduledAt' => gmdate( 'c', $scheduled_ts ),
				),
			);
		}

		$access_token = Neo_Pulse_App_Gmb_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return self::error( 401, $access_token->get_error_message() );
		}

		$location_name = self::resolve_location_parent( $access_token, $gbp_location_raw, $site_name, $site_url );
		if ( is_wp_error( $location_name ) ) {
			return self::error( 422, $location_name->get_error_message() );
		}

		$published = self::create_local_post(
			$access_token,
			$location_name,
			$summary,
			$blog_url,
			$image ? (string) $image['sourceUrl'] : null
		);
		if ( is_wp_error( $published ) ) {
			return self::error( 422, $published->get_error_message() );
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'   => true,
				'preview'   => $preview,
				'published' => true,
				'scheduled' => false,
			),
		);
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function process_schedule_queue(): array {
		$access_token = Neo_Pulse_App_Gmb_Tokens::get_valid_access_token();
		if ( is_wp_error( $access_token ) ) {
			return self::error( 401, $access_token->get_error_message() );
		}

		$queue   = self::read_schedule_queue();
		$now     = time();
		$remain  = array();
		$published = 0;
		$failed    = 0;

		foreach ( $queue as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$scheduled_ts = isset( $item['scheduledPublishAt'] ) ? strtotime( (string) $item['scheduledPublishAt'] ) : 0;
			if ( $scheduled_ts > $now ) {
				$remain[] = $item;
				continue;
			}

			$location_raw = (string) ( $item['gbpLocationId'] ?? '' );
			$location_id  = self::normalize_location_id( $location_raw );
			$summary     = trim( (string) ( $item['summary'] ?? '' ) );
			$cta_url     = trim( (string) ( $item['blogPostUrl'] ?? '' ) );
			$image_url   = trim( (string) ( $item['imageUrl'] ?? '' ) );
			if ( $location_id === '' || $summary === '' || $cta_url === '' ) {
				++$failed;
				continue;
			}

			$location_name = self::resolve_location_parent(
				$access_token,
				$location_raw,
				trim( (string) ( $item['siteName'] ?? '' ) ),
				trim( (string) ( $item['siteUrl'] ?? '' ) )
			);
			if ( is_wp_error( $location_name ) ) {
				++$failed;
				$remain[] = $item;
				continue;
			}

			$result = self::create_local_post(
				$access_token,
				$location_name,
				$summary,
				$cta_url,
				$image_url !== '' ? $image_url : null
			);
			if ( is_wp_error( $result ) ) {
				++$failed;
				$remain[] = $item;
			} else {
				++$published;
			}
		}

		self::write_schedule_queue( $remain );

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'          => true,
				'processed'        => $published + $failed,
				'publishedThisRun' => $published,
				'failedThisRun'    => $failed,
				'remaining'        => count( $remain ),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function location_id_from_body( array $body ): string {
		if ( ! empty( $body['gbpLocationId'] ) ) {
			return (string) $body['gbpLocationId'];
		}
		$account  = trim( (string) ( $body['accountId'] ?? '' ) );
		$location = trim( (string) ( $body['locationId'] ?? '' ) );
		if ( $account !== '' && $location !== '' ) {
			return $location;
		}
		return '';
	}

	private static function normalize_location_id( string $location_id ): string {
		return Neo_Pulse_App_Gmb_Performance::normalize_location_id( $location_id );
	}

	/**
	 * @return string|WP_Error accounts/{aid}/locations/{lid}
	 */
	private static function resolve_location_parent(
		string $access_token,
		string $location_id,
		string $site_name = '',
		string $site_url = ''
	) {
		$raw = trim( $location_id );
		if ( $raw === '' ) {
			return new WP_Error( 'neo-pulse_gmb_no_location', 'GBP location ID is required.' );
		}

		$cache_key = md5( $raw . '|' . strtolower( $site_name ) . '|' . strtolower( $site_url ) );

		if ( strpos( $raw, 'accounts/' ) === 0 ) {
			if ( self::probe_local_posts_parent( $access_token, $raw ) ) {
				self::$location_parent_cache[ $cache_key ] = $raw;
				return $raw;
			}
			return new WP_Error(
				'neo-pulse_gmb_location_not_found',
				'GBP location cannot publish posts (localPosts API returned not found). Check the profile URL on this property in Integrations.'
			);
		}

		if ( isset( self::$location_parent_cache[ $cache_key ] ) ) {
			return self::$location_parent_cache[ $cache_key ];
		}

		$candidates = Neo_Pulse_App_Gmb_Performance::location_id_post_candidates( $raw );
		if ( empty( $candidates ) ) {
			return new WP_Error( 'neo-pulse_gmb_no_location', 'GBP location ID is invalid.' );
		}

		$accounts = self::list_account_names( $access_token );
		if ( ! $accounts ) {
			return new WP_Error( 'neo-pulse_gmb_no_account', 'No Google Business Profile accounts found.' );
		}

		$records = self::list_all_location_records( $access_token, $accounts );

		if ( $records ) {
			$by_website = self::match_locations_by_site_url( $records, $site_url );
			if ( count( $by_website ) === 1 ) {
				$verified = self::verify_local_posts_parent( $access_token, $by_website[0], $cache_key );
				if ( $verified ) {
					return $verified;
				}
			}

			if ( $site_name !== '' ) {
				$by_title = self::match_locations_by_site_name( $records, $site_name );
				if ( count( $by_title ) === 1 ) {
					$verified = self::verify_local_posts_parent( $access_token, $by_title[0], $cache_key );
					if ( $verified ) {
						return $verified;
					}
				}
				if ( count( $by_title ) > 1 && $candidates ) {
					$by_title_and_url = self::filter_locations_by_candidates( $records, $by_title, $candidates, $raw );
					if ( count( $by_title_and_url ) === 1 ) {
						$verified = self::verify_local_posts_parent( $access_token, $by_title_and_url[0], $cache_key );
						if ( $verified ) {
							return $verified;
						}
					}
				}
			}
		}

		if ( strpos( $raw, 'locations/' ) === 0 ) {
			foreach ( $accounts as $account_name ) {
				$candidate = $account_name . '/' . $raw;
				if ( self::probe_local_posts_parent( $access_token, $candidate ) ) {
					self::$location_parent_cache[ $cache_key ] = $candidate;
					return $candidate;
				}
			}
		}

		foreach ( $candidates as $normalized ) {
			foreach ( $accounts as $account_name ) {
				$candidate = $account_name . '/locations/' . $normalized;
				if ( self::probe_local_posts_parent( $access_token, $candidate ) ) {
					self::$location_parent_cache[ $cache_key ] = $candidate;
					return $candidate;
				}
			}
		}

		if ( $records ) {
			$listed = self::resolve_location_parent_from_directory( $records, $candidates, $raw, $site_name, $site_url );
			if ( ! is_wp_error( $listed ) ) {
				$verified = self::verify_local_posts_parent( $access_token, $listed, $cache_key );
				if ( $verified ) {
					return $verified;
				}
			}
		}

		$catalog = $records ? self::format_location_catalog( $records ) : '';
		$message = 'GBP location was not found in any connected Google account (tried: ' . implode( ', ', $candidates ) . ').';
		if ( $site_name !== '' ) {
			$message .= ' Expected a listing matching "' . $site_name . '".';
		}
		if ( $catalog !== '' ) {
			$message .= ' Connected account locations: ' . $catalog . '.';
		} else {
			$message .= ' Confirm Connect Google Business uses the Google account that owns this profile.';
		}

		return new WP_Error( 'neo-pulse_gmb_location_not_found', $message );
	}

	/**
	 * @param array<int,array<string,mixed>> $records
	 * @param array<int,string> $candidates
	 * @param array<int,string> $location_names
	 * @return array<int,string>
	 */
	private static function filter_locations_by_candidates(
		array $records,
		array $location_names,
		array $candidates,
		string $raw
	): array {
		$out = array();
		foreach ( $records as $record ) {
			$name = (string) ( $record['name'] ?? '' );
			if ( $name === '' || ! in_array( $name, $location_names, true ) ) {
				continue;
			}
			$blob = wp_json_encode( $record );
			if ( ! is_string( $blob ) ) {
				continue;
			}
			foreach ( $candidates as $candidate ) {
				if ( self::location_name_matches_candidate( $name, $candidate, $blob, $raw ) ) {
					$out[] = $name;
					break;
				}
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param array<int,array<string,mixed>> $records
	 * @return array<int,string>
	 */
	private static function match_locations_by_site_name( array $records, string $site_name ): array {
		$out = array();
		foreach ( $records as $record ) {
			$name = (string) ( $record['name'] ?? '' );
			if ( $name === '' ) {
				continue;
			}
			$title = (string) ( $record['title'] ?? '' );
			if ( self::location_title_matches_site( $title, $site_name ) ) {
				$out[] = $name;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param array<int,array<string,mixed>> $records
	 * @return array<int,string>
	 */
	private static function match_locations_by_site_url( array $records, string $site_url ): array {
		$site_host = self::normalize_host( $site_url );
		if ( $site_host === '' ) {
			return array();
		}
		$out = array();
		foreach ( $records as $record ) {
			$name = (string) ( $record['name'] ?? '' );
			if ( $name === '' ) {
				continue;
			}
			if ( self::location_website_matches_host( $record, $site_host ) ) {
				$out[] = $name;
			}
		}
		return array_values( array_unique( $out ) );
	}

	private static function normalize_host( string $url ): string {
		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( trim( $url ) );
		if ( $normalized === '' ) {
			return '';
		}
		$host = wp_parse_url( $normalized, PHP_URL_HOST );
		if ( ! is_string( $host ) || $host === '' ) {
			return '';
		}
		$host = strtolower( $host );
		if ( str_starts_with( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}

	/**
	 * Cache and return location name only when localPosts API responds.
	 *
	 * @return string|null
	 */
	private static function verify_local_posts_parent(
		string $access_token,
		string $location_name,
		string $cache_key
	): ?string {
		if ( ! self::probe_local_posts_parent( $access_token, $location_name ) ) {
			return null;
		}
		self::$location_parent_cache[ $cache_key ] = $location_name;
		return $location_name;
	}

	/**
	 * @param array<string,mixed> $record
	 */
	private static function location_website_matches_host( array $record, string $site_host ): bool {
		$raw = isset( $record['raw'] ) && is_array( $record['raw'] ) ? $record['raw'] : array();
		$candidates = array();
		if ( ! empty( $raw['websiteUri'] ) ) {
			$candidates[] = (string) $raw['websiteUri'];
		}
		if ( ! empty( $raw['websiteUrl'] ) ) {
			$candidates[] = (string) $raw['websiteUrl'];
		}
		foreach ( $candidates as $website ) {
			$host = self::normalize_host( $website );
			if ( $host !== '' && $host === $site_host ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int,array<string,mixed>> $records
	 */
	private static function format_location_catalog( array $records ): string {
		$labels = array();
		foreach ( array_slice( $records, 0, 12 ) as $record ) {
			$title = trim( (string) ( $record['title'] ?? '' ) );
			if ( $title !== '' ) {
				$labels[] = $title;
			}
		}
		return $labels ? implode( '; ', $labels ) : '';
	}

	/**
	 * @param array<int,array<string,mixed>> $records
	 * @param array<int,string> $candidates
	 * @return string|WP_Error
	 */
	private static function resolve_location_parent_from_directory(
		array $records,
		array $candidates,
		string $raw,
		string $site_name,
		string $site_url
	) {
		foreach ( $records as $record ) {
			$name = (string) ( $record['name'] ?? '' );
			if ( $name === '' ) {
				continue;
			}
			$blob = wp_json_encode( $record );
			if ( ! is_string( $blob ) ) {
				continue;
			}
			foreach ( $candidates as $candidate ) {
				if ( self::location_name_matches_candidate( $name, $candidate, $blob, $raw ) ) {
					return $name;
				}
			}
		}

		if ( $site_name !== '' ) {
			$title_matches = self::match_locations_by_site_name( $records, $site_name );
			if ( count( $title_matches ) === 1 ) {
				return $title_matches[0];
			}
		}

		if ( $site_url !== '' ) {
			$url_matches = self::match_locations_by_site_url( $records, $site_url );
			if ( count( $url_matches ) === 1 ) {
				return $url_matches[0];
			}
		}

		return new WP_Error( 'neo-pulse_gmb_location_not_found', 'GBP location not listed in connected accounts.' );
	}

	private static function location_name_matches_candidate( string $name, string $candidate, string $blob, string $raw ): bool {
		if ( str_ends_with( $name, '/locations/' . $candidate ) ) {
			return true;
		}
		if ( strpos( $blob, $candidate ) !== false ) {
			return true;
		}
		return $raw !== '' && strpos( $blob, $raw ) !== false;
	}

	private static function location_title_matches_site( string $title, string $site_name ): bool {
		$title_norm = strtolower( trim( $title ) );
		$site_norm  = strtolower( trim( $site_name ) );
		if ( $title_norm === '' || $site_norm === '' ) {
			return false;
		}
		if ( strpos( $title_norm, $site_norm ) !== false || strpos( $site_norm, $title_norm ) !== false ) {
			return true;
		}
		$site_first = preg_split( '/[\s:\-,]+/', $site_norm );
		$site_token = is_array( $site_first ) && isset( $site_first[0] ) ? trim( (string) $site_first[0] ) : '';
		return strlen( $site_token ) >= 4 && strpos( $title_norm, $site_token ) !== false;
	}

	/**
	 * @param array<int,string> $accounts
	 * @return array<int,array<string,mixed>>
	 */
	private static function list_all_location_records( string $access_token, array $accounts ): array {
		$records = array();
		foreach ( $accounts as $account_name ) {
			$page_token = '';
			do {
				$url = self::MYBUSINESS_V4_BASE . '/' . $account_name . '/locations?pageSize=100';
				if ( $page_token !== '' ) {
					$url .= '&pageToken=' . rawurlencode( $page_token );
				}
				$response = wp_remote_get(
					$url,
					array(
						'timeout' => 20,
						'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
					)
				);
				if ( ! is_wp_error( $response ) ) {
					$code = (int) wp_remote_retrieve_response_code( $response );
					if ( $code >= 200 && $code < 300 ) {
						$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
						if ( is_array( $data ) && ! empty( $data['locations'] ) && is_array( $data['locations'] ) ) {
							foreach ( $data['locations'] as $location ) {
								if ( ! is_array( $location ) || empty( $location['name'] ) ) {
									continue;
								}
								$records[] = array(
									'name'  => (string) $location['name'],
									'title' => (string) ( $location['locationName'] ?? $location['title'] ?? '' ),
									'raw'   => $location,
								);
							}
						}
						$page_token = isset( $data['nextPageToken'] ) ? (string) $data['nextPageToken'] : '';
					} else {
						$page_token = '';
					}
				} else {
					$page_token = '';
				}
				if ( $page_token === '' ) {
					break;
				}
			} while ( $page_token !== '' );
		}

		foreach ( $accounts as $account_name ) {
			$page_token = '';
			do {
				$url = self::BUSINESS_INFO_BASE . '/' . $account_name . '/locations?readMask=name,title,websiteUri,metadata&pageSize=100';
				if ( $page_token !== '' ) {
					$url .= '&pageToken=' . rawurlencode( $page_token );
				}
				$response = wp_remote_get(
					$url,
					array(
						'timeout' => 20,
						'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
					)
				);
				if ( is_wp_error( $response ) ) {
					break;
				}
				$code = (int) wp_remote_retrieve_response_code( $response );
				if ( $code < 200 || $code >= 300 ) {
					break;
				}
				$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
				if ( ! is_array( $data ) ) {
					break;
				}
				$locations = isset( $data['locations'] ) && is_array( $data['locations'] ) ? $data['locations'] : array();
				foreach ( $locations as $location ) {
					if ( ! is_array( $location ) || empty( $location['name'] ) ) {
						continue;
					}
					$name = (string) $location['name'];
					$seen = false;
					foreach ( $records as $existing ) {
						if ( ( $existing['name'] ?? '' ) === $name ) {
							$seen = true;
							break;
						}
					}
					if ( $seen ) {
						continue;
					}
					$records[] = array(
						'name'  => $name,
						'title' => (string) ( $location['title'] ?? '' ),
						'raw'   => $location,
					);
				}
				$page_token = isset( $data['nextPageToken'] ) ? (string) $data['nextPageToken'] : '';
			} while ( $page_token !== '' );
		}

		return $records;
	}

	private static function probe_local_posts_parent( string $access_token, string $location_name ): bool {
		$response = wp_remote_get(
			self::MYBUSINESS_V4_BASE . '/' . $location_name . '/localPosts?pageSize=1',
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return false;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		return $code >= 200 && $code < 300;
	}

	/**
	 * @return array<int,string>
	 */
	private static function list_account_names( string $access_token ): array {
		if ( is_array( self::$account_names_cache ) ) {
			return self::$account_names_cache;
		}
		$response = wp_remote_get(
			self::ACCOUNT_MGMT_BASE . '/accounts',
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array();
		}
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) || empty( $data['accounts'] ) ) {
			return array();
		}
		$out = array();
		foreach ( $data['accounts'] as $account ) {
			if ( is_array( $account ) && ! empty( $account['name'] ) ) {
				$out[] = (string) $account['name'];
			}
		}
		self::$account_names_cache = $out;
		return $out;
	}

	/**
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private static function fetch_all_local_posts( string $access_token, string $location_name ) {
		$all        = array();
		$token      = '';
		$page_guard = 0;
		do {
			++$page_guard;
			if ( $page_guard > 20 ) {
				break;
			}
			$url = self::MYBUSINESS_V4_BASE . '/' . $location_name . '/localPosts?pageSize=100';
			if ( $token !== '' ) {
				$url .= '&pageToken=' . rawurlencode( $token );
			}
			$response = wp_remote_get(
				$url,
				array(
					'timeout' => 30,
					'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
				)
			);
			if ( is_wp_error( $response ) ) {
				return $response;
			}
			$code = (int) wp_remote_retrieve_response_code( $response );
			$data = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( $code === 404 ) {
				return new WP_Error(
					'neo-pulse_gmb_location_not_found',
					'GBP location not found for posting. Re-save the business.google.com profile URL on this property in Integrations.'
				);
			}
			if ( $code === 429 ) {
				return new WP_Error( 'neo-pulse_gmb_quota', 'Google Business Profile quota exceeded. Wait a minute and try again.' );
			}
			if ( $code < 200 || $code >= 300 ) {
				$msg = is_array( $data ) && ! empty( $data['error']['message'] )
					? (string) $data['error']['message']
					: 'HTTP ' . $code;
				return new WP_Error( 'neo-pulse_gmb_api', $msg );
			}
			$batch = is_array( $data ) && ! empty( $data['localPosts'] ) && is_array( $data['localPosts'] )
				? $data['localPosts']
				: array();
			$all   = array_merge( $all, $batch );
			$token = is_array( $data ) && ! empty( $data['nextPageToken'] ) ? (string) $data['nextPageToken'] : '';
		} while ( $token !== '' );

		return $all;
	}

	/**
	 * @param array<string,mixed> $post
	 * @return array<string,mixed>|null
	 */
	private static function map_local_post_row( array $post ): ?array {
		$media_url = '';
		if ( ! empty( $post['media'] ) && is_array( $post['media'] ) ) {
			foreach ( $post['media'] as $media ) {
				if ( is_array( $media ) && ! empty( $media['sourceUrl'] ) ) {
					$media_url = (string) $media['sourceUrl'];
					break;
				}
			}
		}
		return array(
			'name'           => (string) ( $post['name'] ?? '' ),
			'createTime'     => (string) ( $post['createTime'] ?? '' ),
			'updateTime'     => (string) ( $post['updateTime'] ?? '' ),
			'state'          => (string) ( $post['state'] ?? '' ),
			'topicType'      => (string) ( $post['topicType'] ?? '' ),
			'summary'        => (string) ( $post['summary'] ?? '' ),
			'ctaActionType'  => (string) ( $post['callToAction']['actionType'] ?? '' ),
			'ctaUrl'         => (string) ( $post['callToAction']['url'] ?? '' ),
			'mediaSourceUrl' => $media_url,
		);
	}

	/**
	 * @param array<int,mixed> $urls
	 * @return array<int,string>
	 */
	private static function normalize_url_list( $urls ): array {
		if ( ! is_array( $urls ) ) {
			return array();
		}
		$out = array();
		foreach ( $urls as $url ) {
			$trimmed = trim( (string) $url );
			if ( $trimmed !== '' && strpos( $trimmed, 'http' ) === 0 ) {
				$out[] = $trimmed;
			}
		}
		return $out;
	}

	private static function normalize_public_url( string $url ): string {
		$trimmed = trim( $url );
		if ( $trimmed === '' || strpos( $trimmed, 'http' ) !== 0 ) {
			return '';
		}
		return untrailingslashit( $trimmed );
	}

	/** Skip homepage and listing pages (e.g. /blog) so GBP links to a single post or page. */
	private static function is_index_or_archive_url( string $url, string $site_url ): bool {
		$normalized = self::normalize_public_url( $url );
		$site_base  = self::normalize_public_url( $site_url );
		if ( $normalized === '' ) {
			return true;
		}
		if ( $site_base !== '' && $normalized === $site_base ) {
			return true;
		}
		$path = (string) wp_parse_url( $normalized, PHP_URL_PATH );
		$path = trim( $path, '/' );
		if ( $path === '' ) {
			return true;
		}
		$parts = explode( '/', $path );
		$depth = count( $parts );
		if ( $depth === 1 ) {
			$single = strtolower( $parts[0] );
			$archives = array( 'blog', 'news', 'articles', 'resources', 'category', 'tag', 'shop', 'store' );
			if ( in_array( $single, $archives, true ) ) {
				return true;
			}
		}
		if ( $depth === 2 && strtolower( $parts[0] ) === 'blog' ) {
			$second = strtolower( $parts[1] );
			if ( in_array( $second, array( 'page', 'category', 'tag', 'author' ), true ) ) {
				return true;
			}
		}
		return false;
	}

	private static function title_from_public_url( string $url ): string {
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		$slug = $path !== '' ? basename( rtrim( $path, '/' ) ) : $url;
		$slug = str_replace( array( '-', '_' ), ' ', $slug );
		return ucwords( trim( $slug ) );
	}

	/**
	 * @param array<int,string> $urls
	 * @return array<int,array<string,string>>
	 */
	private static function build_candidates_from_urls( array $urls ): array {
		$out = array();
		foreach ( $urls as $url ) {
			$normalized = self::normalize_public_url( (string) $url );
			if ( $normalized === '' ) {
				continue;
			}
			$out[] = array(
				'blogPostUrl'     => $normalized,
				'blogPostTitle'   => self::title_from_public_url( $normalized ),
				'blogPostExcerpt' => '',
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,string>> $candidates
	 * @return array<string,string>
	 */
	private static function openrouter_pick_blog_post( string $api_key, string $keyword, array $candidates ): array {
		$lines = array();
		foreach ( array_slice( $candidates, 0, 40 ) as $i => $candidate ) {
			$lines[] = ( $i + 1 ) . '. ' . $candidate['blogPostTitle'] . ' | ' . $candidate['blogPostUrl'];
		}
		$parsed = Neo_Pulse_App_Vertical_Benchmark_Openrouter::json_completion(
			array(
				array(
					'role'    => 'system',
					'content' => 'Pick one specific article or service page URL for a Google Business Profile post CTA. Never pick the homepage, blog index (/blog), shop index, category archives, or other listing pages. The URL must be a single piece of content with its own slug (e.g. /blog/my-article-title/). Output JSON only: {"blogPostUrl":"https://...","blogPostTitle":"string","blogPostExcerpt":"string","reason":"string"}. Use one of the provided URLs exactly.',
				),
				array(
					'role'    => 'user',
					'content' => 'Topic: ' . ( $keyword !== '' ? $keyword : 'local business update' ) . "\n\nCandidates:\n" . implode( "\n", $lines ),
				),
			),
			array(
				'apiKey'      => $api_key,
				'temperature' => 0.2,
				'maxTokens'   => 400,
			)
		);

		$url = self::normalize_public_url( (string) ( $parsed['blogPostUrl'] ?? '' ) );
		if ( $url === '' ) {
			throw new Exception( 'OpenRouter did not return a valid blogPostUrl.' );
		}

		foreach ( $candidates as $candidate ) {
			if ( self::normalize_public_url( $candidate['blogPostUrl'] ) === $url ) {
				return array(
					'blogPostUrl'     => $url,
					'blogPostTitle'   => trim( (string) ( $parsed['blogPostTitle'] ?? $candidate['blogPostTitle'] ) ),
					'blogPostExcerpt' => trim( (string) ( $parsed['blogPostExcerpt'] ?? $candidate['blogPostExcerpt'] ) ),
					'reason'          => trim( (string) ( $parsed['reason'] ?? 'Best match for topic.' ) ),
				);
			}
		}

		return array(
			'blogPostUrl'     => $url,
			'blogPostTitle'   => trim( (string) ( $parsed['blogPostTitle'] ?? $url ) ),
			'blogPostExcerpt' => trim( (string) ( $parsed['blogPostExcerpt'] ?? '' ) ),
			'reason'          => trim( (string) ( $parsed['reason'] ?? 'Best match for topic.' ) ),
		);
	}

	private static function openrouter_gbp_summary(
		string $api_key,
		string $title,
		string $excerpt,
		string $keyword,
		string $site_name
	): string {
		$parsed = Neo_Pulse_App_Vertical_Benchmark_Openrouter::json_completion(
			array(
				array(
					'role'    => 'system',
					'content' => 'Write a Google Business Profile post (max 150 words, no hashtags, no emojis). Output JSON only: {"summary":"string"}. End with a short call to action.',
				),
				array(
					'role'    => 'user',
					'content' => 'Business: ' . $site_name . "\nTopic: " . $keyword . "\nPage title: " . $title . "\nExcerpt: " . $excerpt,
				),
			),
			array(
				'apiKey'      => $api_key,
				'temperature' => 0.6,
				'maxTokens'   => 500,
			)
		);
		$summary = trim( (string) ( $parsed['summary'] ?? '' ) );
		if ( $summary === '' ) {
			throw new Exception( 'OpenRouter returned empty GBP summary.' );
		}
		return $summary;
	}

	/**
	 * @return array{sourceUrl:string,title:string,reason:string}|null
	 */
	private static function featured_image_for_url( string $site_url, string $username, string $app_password, string $page_url ) {
		list( $status, $payload ) = Neo_Pulse_App_Wp_Url_Resolver::resolve_urls(
			array(
				'siteUrl'     => $site_url,
				'username'    => $username,
				'appPassword' => $app_password,
				'urls'        => array( $page_url ),
			)
		);
		if ( $status !== 200 || empty( $payload['resolved'][0] ) || ! is_array( $payload['resolved'][0] ) ) {
			return null;
		}
		$resolved   = $payload['resolved'][0];
		$id         = isset( $resolved['id'] ) ? (int) $resolved['id'] : 0;
		if ( $id <= 0 ) {
			return null;
		}
		$subtype    = (string) ( $resolved['subtype'] ?? 'post' );
		$endpoint   = $subtype === 'page' ? 'pages' : 'posts';
		$normalized = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );

		$post_resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$normalized . '/wp-json/wp/v2/' . $endpoint . '/' . $id,
			$username,
			$app_password,
			array(
				'timeout' => 15,
				'params'  => array(
					'context' => 'edit',
					'_fields' => 'id,title,featured_media',
				),
			)
		);
		if ( $post_resp['is_wp_error'] || (int) $post_resp['status'] !== 200 || ! is_array( $post_resp['body'] ) ) {
			return null;
		}
		$post_row    = $post_resp['body'];
		$featured_id = (int) ( $post_row['featured_media'] ?? 0 );
		if ( $featured_id <= 0 ) {
			return null;
		}

		$media_resp = Neo_Pulse_App_Wp_Rest_Client::request(
			'GET',
			$normalized . '/wp-json/wp/v2/media/' . $featured_id,
			$username,
			$app_password,
			array(
				'timeout' => 15,
				'params'  => array( '_fields' => 'source_url,title' ),
			)
		);
		if ( $media_resp['is_wp_error'] || (int) $media_resp['status'] !== 200 || ! is_array( $media_resp['body'] ) ) {
			return null;
		}
		$media = $media_resp['body'];
		$url   = trim( (string) ( $media['source_url'] ?? '' ) );
		if ( $url === '' || strpos( $url, 'http' ) !== 0 ) {
			return null;
		}
		return array(
			'sourceUrl' => $url,
			'title'     => trim( (string) ( $media['title'] ?? $post_row['title'] ?? '' ) ),
			'reason'    => 'Featured image from linked page.',
		);
	}

	/**
	 * @return true|WP_Error
	 */
	private static function create_local_post(
		string $access_token,
		string $location_name,
		string $summary,
		string $cta_url,
		?string $image_url
	) {
		$post_body = array(
			'topicType'    => 'STANDARD',
			'languageCode' => substr( get_locale(), 0, 2 ) ?: 'en',
			'summary'      => $summary,
			'callToAction' => array(
				'actionType' => 'LEARN_MORE',
				'url'        => $cta_url,
			),
		);
		if ( $image_url ) {
			$post_body['media'] = array(
				array(
					'mediaFormat' => 'PHOTO',
					'sourceUrl'   => $image_url,
				),
			);
		}

		$response = wp_remote_post(
			self::MYBUSINESS_V4_BASE . '/' . $location_name . '/localPosts',
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $post_body ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code === 429 ) {
			return new WP_Error( 'neo-pulse_gmb_quota', 'Google Business Profile quota exceeded. Wait a minute and try again.' );
		}
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: 'Google localPosts create failed (HTTP ' . $code . ').';
			return new WP_Error( 'neo-pulse_gmb_api', $msg );
		}
		return true;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function read_schedule_queue(): array {
		$path = Neo_Pulse_App_Data_Paths::gmb_schedule_queue_path();
		$data = Neo_Pulse_App_Json_File_Store::read( $path );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array<int,array<string,mixed>> $items
	 */
	private static function write_schedule_queue( array $items ): void {
		Neo_Pulse_App_Json_File_Store::write( Neo_Pulse_App_Data_Paths::gmb_schedule_queue_path(), array_values( $items ) );
	}

	/**
	 * @param array<string,mixed> $item
	 * @return true|WP_Error
	 */
	private static function enqueue_scheduled_post( array $item ) {
		$queue   = self::read_schedule_queue();
		$queue[] = $item;
		self::write_schedule_queue( $queue );
		return true;
	}

	/**
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function error( int $status, string $message ): array {
		return array(
			'statusCode' => $status,
			'body'       => array(
				'success' => false,
				'error'   => $message,
			),
		);
	}
}

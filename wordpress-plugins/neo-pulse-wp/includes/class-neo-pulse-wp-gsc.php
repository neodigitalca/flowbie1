<?php
/**
 * Direct Google Search Console API client (no NEO Pulse Node API).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Gsc {

	const TOKEN_URL     = 'https://oauth2.googleapis.com/token';
	const WEBMASTERS    = 'https://www.googleapis.com/webmasters/v3';
	const SCOPE         = 'https://www.googleapis.com/auth/webmasters.readonly';
	const TOKEN_TTL     = 3000;
	const STATS_TTL     = 900;
	const EMAIL_FALLBACK = 'neopulse@neopulse-505422.iam.gserviceaccount.com';

	/**
	 * @return array{start:string,end:string,label:string}
	 */
	public static function default_date_range(): array {
		$end   = gmdate( 'Y-m-d', strtotime( '-3 days' ) );
		$start = gmdate( 'Y-m-d', strtotime( $end . ' -27 days' ) );
		return array(
			'start' => $start,
			'end'   => $end,
			'label' => __( 'Last 28 days', 'neo-pulse-wp' ),
		);
	}

	/**
	 * Whether GSC credentials and a matching property are configured.
	 */
	public static function is_available(): bool {
		$connection = self::test_connection();
		if ( is_wp_error( $connection ) ) {
			return false;
		}
		return ! empty( $connection['connected'] ) && ! empty( $connection['property'] );
	}

	/**
	 * Adjust date range for GSC reporting lag (~3 days).
	 *
	 * @return array{from: string, to: string, note: string}
	 */
	public static function clamp_date_range_for_gsc( string $from, string $to ): array {
		$max_end = gmdate( 'Y-m-d', strtotime( '-3 days' ) );
		$note    = '';

		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ) {
			$from = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
		}
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ) {
			$to = $max_end;
		}

		if ( $to > $max_end ) {
			$note = sprintf(
				/* translators: %s: latest GSC date */
				__( 'GSC data ends %s due to Search Console reporting delay.', 'neo-pulse-wp' ),
				$max_end
			);
			$to = $max_end;
		}
		if ( $from > $to ) {
			$from = gmdate( 'Y-m-d', strtotime( $to . ' -27 days' ) );
		}

		return array(
			'from' => $from,
			'to'   => $to,
			'note' => $note,
		);
	}

	/**
	 * Fetch GSC overview stats for a custom date range (Overseer analysis).
	 *
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fetch_stats_for_range( string $from, string $to, int $page_limit = 30 ) {
		$clamped = self::clamp_date_range_for_gsc( $from, $to );
		$start   = $clamped['from'];
		$end     = $clamped['to'];

		$host = wp_parse_url( Neo_Pulse_Wp_Api::get_site_url(), PHP_URL_HOST );
		$host = is_string( $host ) ? strtolower( $host ) : '';
		$key  = 'neo_pulse_wp_gsc_range_' . md5( $host . '|' . $start . '|' . $end . '|' . $page_limit . '|' . NEO_PULSE_WP_VERSION );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$connection = self::test_connection();
		if ( is_wp_error( $connection ) ) {
			return $connection;
		}
		if ( empty( $connection['connected'] ) || empty( $connection['property'] ) ) {
			return new WP_Error(
				'neo-pulse_gsc_property',
				$connection['error'] !== '' ? $connection['error'] : $connection['message'],
				$connection
			);
		}

		$property = (string) $connection['property'];
		$stats    = self::fetch_overview_stats( $property, $start, $end, $page_limit );
		if ( is_wp_error( $stats ) ) {
			return $stats;
		}

		$payload = array_merge(
			$connection,
			$stats,
			array(
				'dateRange' => array(
					'start' => $start,
					'end'   => $end,
					'label' => $start . ' – ' . $end,
					'note'  => $clamped['note'],
				),
				'ok'        => true,
			)
		);

		set_transient( $key, $payload, self::STATS_TTL );
		return $payload;
	}

	/**
	 * Fetch search queries for a specific page URL.
	 *
	 * @return array{queries: array<int,array<string,mixed>>, dateRange: array<string,mixed>, pageUrl: string}|WP_Error
	 */
	public static function fetch_page_queries( string $page_url, string $from = '', string $to = '' ) {
		$range   = self::default_date_range();
		$clamped = self::clamp_date_range_for_gsc(
			$from !== '' ? $from : $range['start'],
			$to !== '' ? $to : $range['end']
		);
		$start   = $clamped['from'];
		$end     = $clamped['to'];

		$path_key = Neo_Pulse_Wp_Overseer::normalize_path_url( $page_url );
		$host     = wp_parse_url( Neo_Pulse_Wp_Api::get_site_url(), PHP_URL_HOST );
		$host     = is_string( $host ) ? strtolower( $host ) : '';
		$key      = 'neo_pulse_wp_gsc_page_' . md5( $host . '|' . $path_key . '|' . $start . '|' . $end . '|' . NEO_PULSE_WP_VERSION );
		$cached   = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$connection = self::test_connection();
		if ( is_wp_error( $connection ) ) {
			return $connection;
		}
		if ( empty( $connection['connected'] ) || empty( $connection['property'] ) ) {
			return new WP_Error(
				'neo-pulse_gsc_property',
				$connection['error'] !== '' ? $connection['error'] : $connection['message'],
				$connection
			);
		}

		$property = (string) $connection['property'];
		$queries  = array();
		foreach ( self::page_filter_urls( $page_url ) as $filter_url ) {
			$result = self::search_analytics_query(
				$property,
				array(
					'startDate'  => $start,
					'endDate'    => $end,
					'dimensions' => array( 'query' ),
					'rowLimit'   => 25,
					'dimensionFilterGroups' => array(
						array(
							'filters' => array(
								array(
									'dimension'  => 'page',
									'operator'   => 'equals',
									'expression' => $filter_url,
								),
							),
						),
					),
				)
			);
			if ( is_wp_error( $result ) ) {
				continue;
			}
			if ( empty( $result['rows'] ) || ! is_array( $result['rows'] ) ) {
				continue;
			}
			foreach ( $result['rows'] as $row ) {
				if ( ! is_array( $row ) || empty( $row['keys'][0] ) ) {
					continue;
				}
				$queries[] = array(
					'query'       => (string) $row['keys'][0],
					'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					'position'    => isset( $row['position'] ) ? round( (float) $row['position'], 1 ) : 0.0,
				);
			}
			if ( ! empty( $queries ) ) {
				break;
			}
		}

		usort(
			$queries,
			static function ( $a, $b ) {
				return ( $b['clicks'] ?? 0 ) <=> ( $a['clicks'] ?? 0 );
			}
		);

		$payload = array(
			'queries'   => $queries,
			'pageUrl'   => esc_url_raw( $page_url ),
			'dateRange' => array(
				'start' => $start,
				'end'   => $end,
				'note'  => $clamped['note'],
			),
		);

		set_transient( $key, $payload, self::STATS_TTL );
		return $payload;
	}

	/**
	 * @return array<int,string>
	 */
	private static function page_filter_urls( string $page_url ): array {
		$page_url = trim( $page_url );
		if ( $page_url === '' ) {
			return array();
		}

		$site = rtrim( Neo_Pulse_Wp_Api::get_site_url(), '/' );
		if ( 0 !== strpos( $page_url, 'http://' ) && 0 !== strpos( $page_url, 'https://' ) ) {
			$page_url = $site . '/' . ltrim( $page_url, '/' );
		}

		$with    = substr( $page_url, -1 ) === '/' ? $page_url : $page_url . '/';
		$without = rtrim( $page_url, '/' );
		$urls    = array( $with );
		if ( $without !== $with ) {
			$urls[] = $without;
		}

		return array_values( array_unique( $urls ) );
	}

	/**
	 * @return array{connected:bool,clientEmail:string,property:?string,accessibleCount:int,message:string,error:string}|WP_Error
	 */
	public static function test_connection() {
		$creds = self::get_credentials();
		if ( is_wp_error( $creds ) ) {
			return $creds;
		}

		$sites = self::list_sites();
		if ( is_wp_error( $sites ) ) {
			return $sites;
		}

		$site_url = Neo_Pulse_Wp_Api::get_site_url();
		$match    = self::resolve_property( $site_url, $sites );

		return array(
			'connected'       => $match['property'] !== null,
			'clientEmail'     => isset( $creds['client_email'] ) ? (string) $creds['client_email'] : self::EMAIL_FALLBACK,
			'property'        => $match['property'],
			'accessibleCount' => count( $sites ),
			'message'         => $match['property'] !== null
				? __( 'Connected to Google Search Console.', 'neo-pulse-wp' )
				: __( 'Service account is valid but no matching GSC property was found for this site.', 'neo-pulse-wp' ),
			'error'           => $match['property'] === null ? $match['error'] : '',
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fetch_analytics_overview() {
		$range = self::default_date_range();
		$host  = wp_parse_url( Neo_Pulse_Wp_Api::get_site_url(), PHP_URL_HOST );
		$host  = is_string( $host ) ? strtolower( $host ) : '';
		$key   = 'neo_pulse_wp_gsc_stats_' . md5( $host . '|' . $range['start'] . '|' . $range['end'] . '|' . NEO_PULSE_WP_VERSION );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$connection = self::test_connection();
		if ( is_wp_error( $connection ) ) {
			return $connection;
		}
		if ( empty( $connection['connected'] ) || empty( $connection['property'] ) ) {
			return new WP_Error(
				'neo-pulse_gsc_property',
				$connection['error'] !== '' ? $connection['error'] : $connection['message'],
				$connection
			);
		}

		$property = (string) $connection['property'];
		$stats    = self::fetch_overview_stats( $property, $range['start'], $range['end'] );
		if ( is_wp_error( $stats ) ) {
			return $stats;
		}

		$payload = array_merge(
			$connection,
			$stats,
			array(
				'dateRange' => $range,
				'ok'        => true,
			)
		);

		set_transient( $key, $payload, self::STATS_TTL );
		return $payload;
	}

	/**
	 * Flush cached GSC analytics stats transients.
	 */
	public static function flush_stats_cache(): void {
		global $wpdb;

		if ( ! isset( $wpdb ) ) {
			return;
		}

		$like = $wpdb->esc_like( '_transient_neo_pulse_wp_gsc_stats_' ) . '%';
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
				$like,
				$wpdb->esc_like( '_transient_timeout_neo_pulse_wp_gsc_stats_' ) . '%'
			)
		);

		if ( ! is_array( $rows ) ) {
			return;
		}

		foreach ( $rows as $option_name ) {
			$name = (string) $option_name;
			if ( 0 === strpos( $name, '_transient_timeout_neo_pulse_wp_gsc_stats_' ) ) {
				delete_option( $name );
				continue;
			}
			if ( 0 === strpos( $name, '_transient_neo_pulse_wp_gsc_stats_' ) ) {
				$key = substr( $name, strlen( '_transient_' ) );
				delete_transient( $key );
			}
		}
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function fetch_overview_stats( string $property, string $start, string $end, int $page_limit = 10 ) {
		$page_limit = max( 1, min( 50, $page_limit ) );
		$totals = self::search_analytics_query(
			$property,
			array(
				'startDate' => $start,
				'endDate'   => $end,
			)
		);
		if ( is_wp_error( $totals ) ) {
			return $totals;
		}

		$summary = array(
			'clicks'      => 0,
			'impressions' => 0,
			'ctr'         => 0.0,
			'avgPosition' => 0.0,
		);
		if ( ! empty( $totals['rows'][0] ) && is_array( $totals['rows'][0] ) ) {
			$row                 = $totals['rows'][0];
			$summary['clicks']      = isset( $row['clicks'] ) ? (int) $row['clicks'] : 0;
			$summary['impressions'] = isset( $row['impressions'] ) ? (int) $row['impressions'] : 0;
			$summary['ctr']         = isset( $row['ctr'] ) ? (float) $row['ctr'] : 0.0;
			$summary['avgPosition'] = isset( $row['position'] ) ? round( (float) $row['position'], 1 ) : 0.0;
		}

		$queries = self::search_analytics_query(
			$property,
			array(
				'startDate'  => $start,
				'endDate'    => $end,
				'dimensions' => array( 'query' ),
				'rowLimit'   => 25,
			)
		);
		if ( is_wp_error( $queries ) ) {
			return $queries;
		}

		$query_rows = array();
		if ( ! empty( $queries['rows'] ) && is_array( $queries['rows'] ) ) {
			foreach ( $queries['rows'] as $row ) {
				if ( ! is_array( $row ) || empty( $row['keys'][0] ) ) {
					continue;
				}
				$query_rows[] = array(
					'query'       => (string) $row['keys'][0],
					'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					'position'    => isset( $row['position'] ) ? round( (float) $row['position'], 1 ) : 0.0,
				);
			}
			usort(
				$query_rows,
				static function ( $a, $b ) {
					return $b['clicks'] <=> $a['clicks'];
				}
			);
		}

		$pages = self::search_analytics_query(
			$property,
			array(
				'startDate'  => $start,
				'endDate'    => $end,
				'dimensions' => array( 'page' ),
				'rowLimit'   => $page_limit,
			)
		);
		if ( is_wp_error( $pages ) ) {
			return $pages;
		}

		$page_rows = array();
		if ( ! empty( $pages['rows'] ) && is_array( $pages['rows'] ) ) {
			foreach ( $pages['rows'] as $row ) {
				if ( ! is_array( $row ) || empty( $row['keys'][0] ) ) {
					continue;
				}
				$page_rows[] = array(
					'page'        => (string) $row['keys'][0],
					'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : 0,
					'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : 0,
					'position'    => isset( $row['position'] ) ? round( (float) $row['position'], 1 ) : 0.0,
				);
			}
			usort(
				$page_rows,
				static function ( $a, $b ) {
					return $b['clicks'] <=> $a['clicks'];
				}
			);
		}

		return array(
			'summary'        => $summary,
			'keywordCount'   => count( $query_rows ),
			'topQueries'     => $query_rows,
			'topPages'       => $page_rows,
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function get_credentials() {
		static $resolved = null;
		if ( is_array( $resolved ) ) {
			return $resolved;
		}

		$sources = array(
			self::read_json_constant( 'NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON' ),
			self::read_json_env( 'NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON' ),
			self::read_json_env( 'GSC_SERVICE_ACCOUNT_JSON' ),
			self::read_json_file( self::credentials_file_path() ),
		);

		foreach ( $sources as $raw ) {
			if ( $raw === null || $raw === '' ) {
				continue;
			}
			$parsed = self::parse_credentials_json( $raw );
			if ( ! is_wp_error( $parsed ) ) {
				$resolved = $parsed;
				return $resolved;
			}
		}

		return new WP_Error(
			'neo-pulse_gsc_missing',
			__( 'GSC service account JSON is not configured for this plugin.', 'neo-pulse-wp' ),
			array(
				'clientEmail' => self::EMAIL_FALLBACK,
				'hint'        => sprintf(
					/* translators: %s: service account email */
					__( 'Add the service account JSON via wp-config (NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON) or includes/credentials/gsc-service-account.json. In Google Search Console, add %s under Settings → Users and permissions.', 'neo-pulse-wp' ),
					self::EMAIL_FALLBACK
				),
			)
		);
	}

	private static function credentials_file_path(): string {
		if ( defined( 'NEO_PULSE_WP_GSC_CREDENTIALS_FILE' ) && NEO_PULSE_WP_GSC_CREDENTIALS_FILE !== '' ) {
			return (string) NEO_PULSE_WP_GSC_CREDENTIALS_FILE;
		}
		return NEO_PULSE_WP_PLUGIN_DIR . 'includes/credentials/gsc-service-account.json';
	}

	private static function read_json_constant( string $name ): ?string {
		if ( defined( $name ) ) {
			$value = constant( $name );
			if ( is_string( $value ) && trim( $value ) !== '' ) {
				return trim( $value );
			}
		}
		return null;
	}

	private static function read_json_env( string $name ): ?string {
		$value = getenv( $name );
		if ( is_string( $value ) && trim( $value ) !== '' ) {
			return trim( $value );
		}
		return null;
	}

	private static function read_json_file( string $path ): ?string {
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$raw = file_get_contents( $path );
		return is_string( $raw ) && trim( $raw ) !== '' ? trim( $raw ) : null;
	}

	/**
	 * @return array<string,string>|WP_Error
	 */
	private static function parse_credentials_json( string $raw ) {
		$raw  = trim( $raw );
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return new WP_Error(
				'neo-pulse_gsc_bad_json',
				__( 'GSC service account JSON is invalid.', 'neo-pulse-wp' )
			);
		}

		$email = isset( $data['client_email'] ) ? trim( (string) $data['client_email'] ) : '';
		$key   = isset( $data['private_key'] ) ? (string) $data['private_key'] : '';
		$key   = str_replace( '\\n', "\n", $key );

		if ( $email === '' || $key === '' ) {
			return new WP_Error(
				'neo-pulse_gsc_incomplete',
				__( 'GSC service account JSON must include client_email and private_key.', 'neo-pulse-wp' )
			);
		}

		return array(
			'client_email' => $email,
			'private_key'  => $key,
			'project_id'   => isset( $data['project_id'] ) ? (string) $data['project_id'] : '',
		);
	}

	/**
	 * @return string|WP_Error
	 */
	private static function get_access_token() {
		$creds = self::get_credentials();
		if ( is_wp_error( $creds ) ) {
			return $creds;
		}

		$cache_key = 'neo_pulse_wp_gsc_token_' . md5( $creds['client_email'] . '|' . NEO_PULSE_WP_VERSION );
		$cached    = get_transient( $cache_key );
		if ( is_string( $cached ) && $cached !== '' ) {
			return $cached;
		}

		$jwt = self::build_jwt( $creds['client_email'], $creds['private_key'] );
		if ( is_wp_error( $jwt ) ) {
			return $jwt;
		}

		$response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'timeout' => 30,
				'headers' => array(
					'Content-Type' => 'application/x-www-form-urlencoded',
				),
				'body'    => array(
					'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					'assertion'  => $jwt,
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 || ! is_array( $data ) || empty( $data['access_token'] ) ) {
			$msg = is_array( $data ) && ! empty( $data['error_description'] )
				? (string) $data['error_description']
				: ( $raw !== '' ? $raw : sprintf( 'HTTP %d', $code ) );
			return new WP_Error( 'neo-pulse_gsc_token', $msg );
		}

		$token = (string) $data['access_token'];
		set_transient( $cache_key, $token, self::TOKEN_TTL );
		return $token;
	}

	/**
	 * @return string|WP_Error
	 */
	private static function build_jwt( string $client_email, string $private_key ) {
		$now = time();
		$header = self::base64url_encode(
			wp_json_encode(
				array(
					'alg' => 'RS256',
					'typ' => 'JWT',
				)
			)
		);
		$claim = self::base64url_encode(
			wp_json_encode(
				array(
					'iss'   => $client_email,
					'scope' => self::SCOPE,
					'aud'   => self::TOKEN_URL,
					'exp'   => $now + 3600,
					'iat'   => $now,
				)
			)
		);

		$input = $header . '.' . $claim;
		$key   = openssl_pkey_get_private( $private_key );
		if ( false === $key ) {
			return new WP_Error(
				'neo-pulse_gsc_key',
				__( 'Could not read GSC service account private key.', 'neo-pulse-wp' )
			);
		}

		$signature = '';
		$signed    = openssl_sign( $input, $signature, $key, OPENSSL_ALGO_SHA256 );
		if ( function_exists( 'openssl_free_key' ) ) {
			openssl_free_key( $key );
		}
		if ( ! $signed ) {
			return new WP_Error(
				'neo-pulse_gsc_sign',
				__( 'Could not sign GSC JWT.', 'neo-pulse-wp' )
			);
		}

		return $input . '.' . self::base64url_encode( $signature );
	}

	/**
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private static function list_sites() {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$response = wp_remote_get(
			self::WEBMASTERS . '/sites',
			array(
				'timeout' => 45,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Accept'        => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : sprintf( 'HTTP %d', $code ) );
			return new WP_Error( 'neo-pulse_gsc_sites', $msg );
		}

		$entries = array();
		if ( is_array( $data ) && ! empty( $data['siteEntry'] ) && is_array( $data['siteEntry'] ) ) {
			foreach ( $data['siteEntry'] as $site ) {
				if ( ! is_array( $site ) || empty( $site['siteUrl'] ) ) {
					continue;
				}
				$entries[] = array(
					'siteUrl'         => (string) $site['siteUrl'],
					'permissionLevel' => isset( $site['permissionLevel'] ) ? (string) $site['permissionLevel'] : '',
				);
			}
		}

		return $entries;
	}

	/**
	 * @param array<int,array<string,mixed>> $sites
	 * @return array{property:?string,error:string,requestedDomain:string}
	 */
	private static function resolve_property( string $site_url, array $sites ): array {
		$requested = self::requested_domain( $site_url );
		if ( $requested === '' ) {
			return array(
				'property'        => null,
				'error'           => __( 'Could not determine site hostname.', 'neo-pulse-wp' ),
				'requestedDomain' => '',
			);
		}

		foreach ( $sites as $site ) {
			$raw = isset( $site['siteUrl'] ) ? (string) $site['siteUrl'] : '';
			if ( $raw === '' ) {
				continue;
			}
			$property_domain = self::property_domain( $raw );
			if ( $property_domain !== '' && $property_domain === $requested ) {
				return array(
					'property'        => $raw,
					'error'           => '',
					'requestedDomain' => $requested,
				);
			}
		}

		$candidates = self::generate_property_candidates( $site_url );
		foreach ( $candidates as $candidate ) {
			foreach ( $sites as $site ) {
				if ( isset( $site['siteUrl'] ) && (string) $site['siteUrl'] === $candidate ) {
					return array(
						'property'        => $candidate,
						'error'           => '',
						'requestedDomain' => $requested,
					);
				}
			}
		}

		return array(
			'property'        => null,
			'error'           => sprintf(
				/* translators: 1: domain, 2: number of accessible properties */
				__( 'No GSC property matches %1$s. The service account can access %2$d properties.', 'neo-pulse-wp' ),
				$requested,
				count( $sites )
			),
			'requestedDomain' => $requested,
		);
	}

	private static function requested_domain( string $site_url ): string {
		$host = wp_parse_url( trim( $site_url ), PHP_URL_HOST );
		if ( ! is_string( $host ) || $host === '' ) {
			$host = preg_replace( '#^https?://#i', '', trim( $site_url ) );
			$host = is_string( $host ) ? explode( '/', $host )[0] : '';
		}
		$host = strtolower( trim( (string) $host ) );
		if ( 0 === strpos( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}

	private static function property_domain( string $property_url ): string {
		$property_url = strtolower( trim( $property_url ) );
		if ( 0 === strpos( $property_url, 'sc-domain:' ) ) {
			$domain = substr( $property_url, strlen( 'sc-domain:' ) );
		} else {
			$domain = wp_parse_url( $property_url, PHP_URL_HOST );
			if ( ! is_string( $domain ) || $domain === '' ) {
				$domain = preg_replace( '#^https?://#', '', $property_url );
				$domain = is_string( $domain ) ? explode( '/', $domain )[0] : '';
			}
		}
		$domain = strtolower( trim( (string) $domain ) );
		if ( 0 === strpos( $domain, 'www.' ) ) {
			$domain = substr( $domain, 4 );
		}
		return $domain;
	}

	/**
	 * @return array<int,string>
	 */
	private static function generate_property_candidates( string $site_url ): array {
		$url = trim( $site_url );
		if ( $url === '' ) {
			return array();
		}
		if ( ! preg_match( '#^https?://#i', $url ) ) {
			$url = 'https://' . $url;
		}

		$candidates = array();
		$with_slash = substr( $url, -1 ) === '/' ? $url : $url . '/';
		$no_slash   = substr( $url, -1 ) === '/' ? rtrim( $url, '/' ) : $url;
		$candidates[] = $with_slash;
		if ( $no_slash !== $with_slash ) {
			$candidates[] = $no_slash;
		}

		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( is_string( $host ) && $host !== '' ) {
			$candidates[] = 'sc-domain:' . $host;
			if ( 0 !== strpos( $host, 'www.' ) ) {
				$candidates[] = 'sc-domain:www.' . $host;
				$candidates[] = 'https://www.' . $host . '/';
				$candidates[] = 'https://www.' . $host;
			} else {
				$bare = substr( $host, 4 );
				$candidates[] = 'sc-domain:' . $bare;
				$candidates[] = 'https://' . $bare . '/';
				$candidates[] = 'https://' . $bare;
			}
		}

		return array_values( array_unique( $candidates ) );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>|WP_Error
	 */
	private static function search_analytics_query( string $property, array $body ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$url = self::WEBMASTERS . '/sites/' . rawurlencode( $property ) . '/searchAnalytics/query';
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : sprintf( 'HTTP %d', $code ) );
			return new WP_Error( 'neo-pulse_gsc_query', $msg );
		}

		return is_array( $data ) ? $data : array();
	}

	private static function base64url_encode( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}
}

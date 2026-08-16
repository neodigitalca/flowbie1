<?php
/**
 * Semrush Management API: list projects and match by hostname.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Semrush_Projects_Api {

	const MANAGEMENT_PROJECTS = 'https://api.semrush.com/management/v1/projects';

	/**
	 * @param array<string,mixed> $options
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	public static function list_projects( array $options = array() ) {
		$key = Neo_Pulse_App_Semrush_Client::api_key();
		if ( $key === '' ) {
			return new WP_Error( 'neo-pulse_semrush_missing', 'SEMRUSH_API_KEY is not set' );
		}

		$filter = ! empty( $options['filter'] ) ? (string) $options['filter'] : 'all';
		$url    = add_query_arg(
			array(
				'key'    => $key,
				'filter' => $filter,
			),
			self::MANAGEMENT_PROJECTS
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 60,
				'headers' => array( 'Accept' => 'application/json' ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error'] )
				? (string) $data['error']
				: ( $raw !== '' ? substr( trim( $raw ), 0, 240 ) : sprintf( 'HTTP %d', $code ) );
			return new WP_Error( 'neo-pulse_semrush_projects', $msg );
		}

		if ( ! is_array( $data ) ) {
			return new WP_Error( 'neo-pulse_semrush_projects', 'Semrush projects response was not a JSON array' );
		}

		return $data;
	}

	/**
	 * @param string                             $site_url
	 * @param array<int,array<string,mixed>>     $projects
	 * @return array{match:array<string,mixed>|null,matches:array<int,array<string,mixed>>}
	 */
	public static function match_project_for_site_url( string $site_url, array $projects ): array {
		$site_host = self::normalize_host( $site_url );
		if ( $site_host === '' ) {
			return array( 'match' => null, 'matches' => array() );
		}

		$matched = array();
		foreach ( $projects as $p ) {
			if ( ! is_array( $p ) || ! isset( $p['project_id'] ) ) {
				continue;
			}
			foreach ( self::project_hosts( $p ) as $ph ) {
				if ( $ph === $site_host || substr( $site_host, - ( strlen( $ph ) + 1 ) ) === '.' . $ph ) {
					$matched[] = $p;
					break;
				}
			}
		}

		if ( $matched === array() ) {
			return array( 'match' => null, 'matches' => array() );
		}
		if ( count( $matched ) === 1 ) {
			return array( 'match' => $matched[0], 'matches' => $matched );
		}

		$with_audit = array_values(
			array_filter( $matched, array( __CLASS__, 'has_site_audit_tool' ) )
		);
		$pool = $with_audit !== array() ? $with_audit : $matched;
		return array( 'match' => $pool[0], 'matches' => $matched );
	}

	public static function normalize_host( string $input ): string {
		$s = trim( $input );
		if ( $s === '' ) {
			return '';
		}
		if ( preg_match( '#^https?://#i', $s ) ) {
			$host = wp_parse_url( $s, PHP_URL_HOST );
		} else {
			$host = explode( '/', explode( ':', $s )[0] )[0];
		}
		if ( ! is_string( $host ) || $host === '' ) {
			$host = preg_replace( '#^https?://#i', '', $s );
			$host = explode( '/', explode( ':', (string) $host )[0] )[0];
		}
		$host = strtolower( (string) $host );
		if ( substr( $host, 0, 4 ) === 'www.' ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}

	/**
	 * @param array<string,mixed> $project
	 * @return string[]
	 */
	public static function project_hosts( array $project ): array {
		$raw   = array();
		if ( ! empty( $project['url'] ) && is_string( $project['url'] ) ) {
			$raw[] = $project['url'];
		}
		if ( ! empty( $project['domain_unicode'] ) && is_string( $project['domain_unicode'] ) ) {
			$raw[] = $project['domain_unicode'];
		}
		$hosts = array();
		foreach ( $raw as $x ) {
			$h = self::normalize_host( $x );
			if ( $h !== '' ) {
				$hosts[ $h ] = true;
			}
		}
		return array_keys( $hosts );
	}

	/**
	 * @param array<string,mixed> $project
	 */
	public static function has_site_audit_tool( array $project ): bool {
		if ( empty( $project['tools'] ) || ! is_array( $project['tools'] ) ) {
			return false;
		}
		foreach ( $project['tools'] as $t ) {
			if ( ! is_array( $t ) ) {
				continue;
			}
			$name = strtolower( (string) ( $t['tool'] ?? '' ) );
			if ( $name === '' ) {
				continue;
			}
			if ( strpos( $name, 'siteaudit' ) !== false || strpos( $name, 'site_audit' ) !== false ) {
				return true;
			}
			if ( strpos( $name, 'site' ) !== false && strpos( $name, 'audit' ) !== false ) {
				return true;
			}
		}
		return false;
	}
}

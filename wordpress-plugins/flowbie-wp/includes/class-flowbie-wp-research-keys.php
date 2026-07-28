<?php
/**
 * Agency DataForSEO + Semrush credentials for SEO research (server-side only).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Research_Keys {

	/**
	 * @return array{login:string,password:string}
	 */
	public static function dataforseo(): array {
		$site = Flowbie_Wp_Api::get_agency_dataforseo_credentials();
		if ( $site['login'] !== '' && $site['password'] !== '' ) {
			return $site;
		}

		$login = '';
		$pass  = '';

		if ( defined( 'FLOWBIE_WP_DATAFORSEO_LOGIN' ) && FLOWBIE_WP_DATAFORSEO_LOGIN !== '' ) {
			$login = trim( (string) FLOWBIE_WP_DATAFORSEO_LOGIN );
		}
		if ( defined( 'FLOWBIE_WP_DATAFORSEO_PASSWORD' ) && FLOWBIE_WP_DATAFORSEO_PASSWORD !== '' ) {
			$pass = trim( (string) FLOWBIE_WP_DATAFORSEO_PASSWORD );
		}

		if ( $login === '' ) {
			$env = getenv( 'FLOWBIE_WP_DATAFORSEO_LOGIN' );
			if ( $env ) {
				$login = trim( (string) $env );
			}
		}
		if ( $pass === '' ) {
			$env = getenv( 'FLOWBIE_WP_DATAFORSEO_PASSWORD' );
			if ( $env ) {
				$pass = trim( (string) $env );
			}
		}

		if ( $login === '' ) {
			$login = $site['login'];
		}
		if ( $pass === '' ) {
			$pass = $site['password'];
		}

		return array(
			'login'    => $login,
			'password' => $pass,
		);
	}

	public static function dataforseo_configured(): bool {
		$c = self::dataforseo();
		return $c['login'] !== '' && $c['password'] !== '';
	}

	/**
	 * @return string wp-config|environment|site|''
	 */
	public static function get_dataforseo_source(): string {
		$site = Flowbie_Wp_Api::get_agency_dataforseo_credentials();
		if ( $site['login'] !== '' && $site['password'] !== '' ) {
			return 'site';
		}
		if ( defined( 'FLOWBIE_WP_DATAFORSEO_LOGIN' ) && FLOWBIE_WP_DATAFORSEO_LOGIN !== ''
			&& defined( 'FLOWBIE_WP_DATAFORSEO_PASSWORD' ) && FLOWBIE_WP_DATAFORSEO_PASSWORD !== '' ) {
			return 'wp-config';
		}
		if ( getenv( 'FLOWBIE_WP_DATAFORSEO_LOGIN' ) && getenv( 'FLOWBIE_WP_DATAFORSEO_PASSWORD' ) ) {
			return 'environment';
		}
		if ( $site['login'] !== '' || $site['password'] !== '' ) {
			return 'site';
		}
		return '';
	}

	/**
	 * @return string
	 */
	public static function semrush_api_key(): string {
		if ( defined( 'FLOWBIE_WP_SEMRUSH_API_KEY' ) && FLOWBIE_WP_SEMRUSH_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_WP_SEMRUSH_API_KEY );
		}
		$env = getenv( 'FLOWBIE_WP_SEMRUSH_API_KEY' );
		return $env ? trim( (string) $env ) : '';
	}

	public static function semrush_configured(): bool {
		return self::semrush_api_key() !== '';
	}

	public static function research_configured(): bool {
		return self::dataforseo_configured();
	}
}

<?php
/**
 * Resolve API secrets (wp-config constants, flowbie-app-secrets.php, flowbie-wp fallbacks).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Secrets {

	public static function gsc_service_account_json(): string {
		if ( defined( 'FLOWBIE_APP_GSC_SERVICE_ACCOUNT_JSON' ) && FLOWBIE_APP_GSC_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) FLOWBIE_APP_GSC_SERVICE_ACCOUNT_JSON;
		}
		if ( defined( 'FLOWBIE_WP_GSC_SERVICE_ACCOUNT_JSON' ) && FLOWBIE_WP_GSC_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) FLOWBIE_WP_GSC_SERVICE_ACCOUNT_JSON;
		}
		return '';
	}

	/**
	 * @return array{login:string,password:string}
	 */
	public static function dataforseo(): array {
		$login = '';
		$pass  = '';
		if ( defined( 'FLOWBIE_APP_DATAFORSEO_LOGIN' ) ) {
			$login = trim( (string) FLOWBIE_APP_DATAFORSEO_LOGIN );
		}
		if ( defined( 'FLOWBIE_APP_DATAFORSEO_PASSWORD' ) ) {
			$pass = trim( (string) FLOWBIE_APP_DATAFORSEO_PASSWORD );
		}
		if ( $login === '' && defined( 'FLOWBIE_WP_DATAFORSEO_LOGIN' ) ) {
			$login = trim( (string) FLOWBIE_WP_DATAFORSEO_LOGIN );
		}
		if ( $pass === '' && defined( 'FLOWBIE_WP_DATAFORSEO_PASSWORD' ) ) {
			$pass = trim( (string) FLOWBIE_WP_DATAFORSEO_PASSWORD );
		}
		return array(
			'login'    => $login,
			'password' => $pass,
		);
	}

	public static function semrush_api_key(): string {
		if ( defined( 'FLOWBIE_APP_SEMRUSH_API_KEY' ) && FLOWBIE_APP_SEMRUSH_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_APP_SEMRUSH_API_KEY );
		}
		if ( defined( 'FLOWBIE_WP_SEMRUSH_API_KEY' ) && FLOWBIE_WP_SEMRUSH_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_WP_SEMRUSH_API_KEY );
		}
		return '';
	}

	public static function openrouter_api_key(): string {
		if ( defined( 'FLOWBIE_APP_OPENROUTER_API_KEY' ) && FLOWBIE_APP_OPENROUTER_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_APP_OPENROUTER_API_KEY );
		}
		return '';
	}

	public static function ga_service_account_json(): string {
		if ( defined( 'FLOWBIE_APP_GA_SERVICE_ACCOUNT_JSON' ) && FLOWBIE_APP_GA_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) FLOWBIE_APP_GA_SERVICE_ACCOUNT_JSON;
		}
		if ( defined( 'FLOWBIE_WP_GA_SERVICE_ACCOUNT_JSON' ) && FLOWBIE_WP_GA_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) FLOWBIE_WP_GA_SERVICE_ACCOUNT_JSON;
		}
		return '';
	}

	/**
	 * @return array{clientId:string,clientSecret:string,redirectUri:string,frontendUrl:string}
	 */
	public static function gmb_oauth_env(): array {
		$client_id = defined( 'FLOWBIE_APP_GMB_CLIENT_ID' ) ? trim( (string) FLOWBIE_APP_GMB_CLIENT_ID ) : '';
		$secret    = defined( 'FLOWBIE_APP_GMB_CLIENT_SECRET' ) ? trim( (string) FLOWBIE_APP_GMB_CLIENT_SECRET ) : '';
		$redirect  = defined( 'FLOWBIE_APP_GMB_REDIRECT_URI' ) ? trim( (string) FLOWBIE_APP_GMB_REDIRECT_URI ) : '';
		$frontend  = defined( 'FLOWBIE_APP_FRONTEND_URL' ) ? trim( (string) FLOWBIE_APP_FRONTEND_URL ) : '';
		if ( $client_id === '' && defined( 'FLOWBIE_WP_GMB_CLIENT_ID' ) ) {
			$client_id = trim( (string) FLOWBIE_WP_GMB_CLIENT_ID );
		}
		if ( $secret === '' && defined( 'FLOWBIE_WP_GMB_CLIENT_SECRET' ) ) {
			$secret = trim( (string) FLOWBIE_WP_GMB_CLIENT_SECRET );
		}
		return array(
			'clientId'     => $client_id,
			'clientSecret' => $secret,
			'redirectUri'  => $redirect,
			'frontendUrl'  => $frontend,
		);
	}
}

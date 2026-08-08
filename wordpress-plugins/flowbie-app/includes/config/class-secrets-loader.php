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
		if ( $login === '' ) {
			$login = self::env_string( 'DATAFORSEO_API_LOGIN', 'FLOWBIE_APP_DATAFORSEO_LOGIN', 'DATAFORSEO_LOGIN' );
		}
		if ( $pass === '' ) {
			$pass = self::env_string( 'DATAFORSEO_API_PASSWORD', 'FLOWBIE_APP_DATAFORSEO_PASSWORD', 'DATAFORSEO_PASSWORD' );
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
		if ( defined( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) && FLOWBIE_WP_OPENROUTER_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_WP_OPENROUTER_API_KEY );
		}
		$env = self::env_string( 'OPEN_ROUTER_API_KEY', 'OPENROUTER_API_KEY', 'FLOWBIE_APP_OPENROUTER_API_KEY' );
		if ( $env !== '' ) {
			return $env;
		}
		if ( class_exists( 'Flowbie_Wp_Api' ) ) {
			$agency = trim( Flowbie_Wp_Api::get_agency_openrouter_api_key() );
			if ( $agency !== '' ) {
				return $agency;
			}
		}
		if ( class_exists( 'Flowbie_Wp_OpenRouter' ) ) {
			$wp_key = trim( Flowbie_Wp_OpenRouter::get_api_key() );
			if ( $wp_key !== '' ) {
				return $wp_key;
			}
		}
		$mgr = Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['openrouter-api-key'] ) ) {
			$key = trim( (string) $mgr['snapshot']['keys']['openrouter-api-key'] );
			if ( $key !== '' ) {
				return $key;
			}
		}
		return '';
	}

	/**
	 * @param string ...$names Environment variable names to try in order.
	 */
	private static function env_string( string ...$names ): string {
		foreach ( $names as $name ) {
			$val = getenv( $name );
			if ( is_string( $val ) && trim( $val ) !== '' ) {
				return trim( $val );
			}
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

	public static function agentmail_api_key(): string {
		if ( defined( 'FLOWBIE_APP_AGENTMAIL_API_KEY' ) && FLOWBIE_APP_AGENTMAIL_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_APP_AGENTMAIL_API_KEY );
		}
		$keys_path = Flowbie_App_Data_Paths::root() . '/email-worker-keys.json';
		$keys      = Flowbie_App_Json_File_Store::read( $keys_path );
		if ( is_array( $keys ) && ! empty( $keys['agentmailApiKey'] ) ) {
			return trim( (string) $keys['agentmailApiKey'] );
		}
		$mgr = Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['agentmail-api-key'] ) ) {
			$key = trim( (string) $mgr['snapshot']['keys']['agentmail-api-key'] );
			if ( $key !== '' ) {
				return $key;
			}
		}
		return '';
	}

	public static function agentmail_inbox(): string {
		if ( defined( 'FLOWBIE_APP_AGENTMAIL_INBOX' ) && FLOWBIE_APP_AGENTMAIL_INBOX !== '' ) {
			return sanitize_email( strtolower( trim( (string) FLOWBIE_APP_AGENTMAIL_INBOX ) ) );
		}
		$mgr = Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['agentmail-general-email'] ) ) {
			$inbox = sanitize_email( strtolower( trim( (string) $mgr['snapshot']['keys']['agentmail-general-email'] ) ) );
			if ( $inbox !== '' ) {
				return $inbox;
			}
		}
		return 'flowbie@agentmail.to';
	}

	/**
	 * @return array{host:string,port:int,user:string,password:string,fromEmail:string,fromName:string,secure:string}
	 */
	public static function smtp(): array {
		$host = defined( 'FLOWBIE_APP_SMTP_HOST' ) ? trim( (string) FLOWBIE_APP_SMTP_HOST ) : '';
		$port = defined( 'FLOWBIE_APP_SMTP_PORT' ) ? (int) FLOWBIE_APP_SMTP_PORT : 587;
		$user = defined( 'FLOWBIE_APP_SMTP_USER' ) ? trim( (string) FLOWBIE_APP_SMTP_USER ) : '';
		$pass = defined( 'FLOWBIE_APP_SMTP_PASSWORD' ) ? (string) FLOWBIE_APP_SMTP_PASSWORD : '';
		$from = defined( 'FLOWBIE_APP_SMTP_FROM_EMAIL' ) ? sanitize_email( (string) FLOWBIE_APP_SMTP_FROM_EMAIL ) : '';
		$name = defined( 'FLOWBIE_APP_SMTP_FROM_NAME' ) ? trim( (string) FLOWBIE_APP_SMTP_FROM_NAME ) : 'Flowbie';
		$sec  = defined( 'FLOWBIE_APP_SMTP_SECURE' ) ? strtolower( trim( (string) FLOWBIE_APP_SMTP_SECURE ) ) : 'tls';
		return array(
			'host'      => $host,
			'port'      => $port > 0 ? $port : 587,
			'user'      => $user,
			'password'  => $pass,
			'fromEmail' => $from,
			'fromName'  => $name,
			'secure'    => $sec,
		);
	}

	public static function chekkit_events_webhook_url(): string {
		if ( defined( 'FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL' ) && FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL !== '' ) {
			return trim( (string) FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL );
		}
		return self::env_string(
			'FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL',
			'CHEKKIT_EVENTS_WEBHOOK_URL'
		);
	}

	public static function chekkit_form_email(): string {
		if ( defined( 'FLOWBIE_APP_CHEKKIT_FORM_EMAIL' ) && FLOWBIE_APP_CHEKKIT_FORM_EMAIL !== '' ) {
			return sanitize_email( strtolower( trim( (string) FLOWBIE_APP_CHEKKIT_FORM_EMAIL ) ) );
		}
		return sanitize_email(
			strtolower(
				self::env_string(
					'FLOWBIE_APP_CHEKKIT_FORM_EMAIL',
					'CHEKKIT_FORM_EMAIL',
					'CHEKKIT_WEBSITE_FORM_EMAIL'
				)
			)
		);
	}
}

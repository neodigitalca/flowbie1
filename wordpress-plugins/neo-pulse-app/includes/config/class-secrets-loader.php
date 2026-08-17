<?php
/**
 * Resolve API secrets (wp-config constants, neo-pulse-app-secrets.php, neo-pulse-wp fallbacks).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Secrets {

	private static function gsc_json_is_legacy_flowbie( string $raw ): bool {
		return str_contains( $raw, 'flowbie-483717' ) || str_contains( $raw, 'flowbie-812@' );
	}

	private static function openrouter_key_is_invalid( string $key ): bool {
		return str_contains( $key, '0df04520eb8c0146e19f925295a5559b058f399917db3db7c0a3e3bb97361148' );
	}

	public static function gsc_service_account_json(): string {
		if ( defined( 'NEO_PULSE_APP_GSC_SERVICE_ACCOUNT_JSON' ) && NEO_PULSE_APP_GSC_SERVICE_ACCOUNT_JSON !== '' ) {
			$app = (string) NEO_PULSE_APP_GSC_SERVICE_ACCOUNT_JSON;
			if ( ! self::gsc_json_is_legacy_flowbie( $app ) ) {
				return $app;
			}
		}
		if ( defined( 'NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON' ) && NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) NEO_PULSE_WP_GSC_SERVICE_ACCOUNT_JSON;
		}
		return '';
	}

	public static function fcm_service_account_json(): string {
		if ( defined( 'NEO_PULSE_FCM_SERVICE_ACCOUNT' ) && NEO_PULSE_FCM_SERVICE_ACCOUNT !== '' ) {
			return (string) NEO_PULSE_FCM_SERVICE_ACCOUNT;
		}
		if ( defined( 'NEO_PULSE_APP_FCM_SERVICE_ACCOUNT' ) && NEO_PULSE_APP_FCM_SERVICE_ACCOUNT !== '' ) {
			return (string) NEO_PULSE_APP_FCM_SERVICE_ACCOUNT;
		}
		return self::env_string( 'NEO_PULSE_FCM_SERVICE_ACCOUNT', 'NEO_PULSE_APP_FCM_SERVICE_ACCOUNT' );
	}

	/**
	 * @return array{login:string,password:string}
	 */
	public static function dataforseo(): array {
		$request = self::request_dataforseo_credentials();
		if ( $request['login'] !== '' && $request['password'] !== '' ) {
			return $request;
		}

		$login = '';
		$pass  = '';
		if ( defined( 'NEO_PULSE_APP_DATAFORSEO_LOGIN' ) ) {
			$login = trim( (string) NEO_PULSE_APP_DATAFORSEO_LOGIN );
		}
		if ( defined( 'NEO_PULSE_APP_DATAFORSEO_PASSWORD' ) ) {
			$pass = trim( (string) NEO_PULSE_APP_DATAFORSEO_PASSWORD );
		}
		if ( $login === '' && defined( 'NEO_PULSE_WP_DATAFORSEO_LOGIN' ) ) {
			$login = trim( (string) NEO_PULSE_WP_DATAFORSEO_LOGIN );
		}
		if ( $pass === '' && defined( 'NEO_PULSE_WP_DATAFORSEO_PASSWORD' ) ) {
			$pass = trim( (string) NEO_PULSE_WP_DATAFORSEO_PASSWORD );
		}
		if ( $login === '' ) {
			$login = self::env_string( 'DATAFORSEO_API_LOGIN', 'NEO_PULSE_APP_DATAFORSEO_LOGIN', 'DATAFORSEO_LOGIN' );
		}
		if ( $pass === '' ) {
			$pass = self::env_string( 'DATAFORSEO_API_PASSWORD', 'NEO_PULSE_APP_DATAFORSEO_PASSWORD', 'DATAFORSEO_PASSWORD' );
		}

		$mgr_creds = self::dataforseo_from_manager_settings();
		if ( $login === '' && $mgr_creds['login'] !== '' ) {
			$login = $mgr_creds['login'];
		}
		if ( $pass === '' && $mgr_creds['password'] !== '' ) {
			$pass = $mgr_creds['password'];
		}

		return array(
			'login'    => $login,
			'password' => $pass,
		);
	}

	/** @var array{login:string,password:string} */
	private static $request_dataforseo = array(
		'login'    => '',
		'password' => '',
	);

	/**
	 * @param array{login:string,password:string} $creds
	 */
	public static function use_request_dataforseo_credentials( array $creds ): void {
		self::$request_dataforseo = array(
			'login'    => trim( (string) ( $creds['login'] ?? '' ) ),
			'password' => trim( (string) ( $creds['password'] ?? '' ) ),
		);
	}

	public static function clear_request_dataforseo_credentials(): void {
		self::$request_dataforseo = array(
			'login'    => '',
			'password' => '',
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{login:string,password:string}
	 */
	public static function dataforseo_from_request( array $body = array() ): array {
		$header = isset( $_SERVER['HTTP_X_DATAFORSEO_API_KEY'] )
			? trim( (string) wp_unslash( $_SERVER['HTTP_X_DATAFORSEO_API_KEY'] ) )
			: '';
		if ( $header === '' && ! empty( $body['dataForSeoApiKey'] ) && is_string( $body['dataForSeoApiKey'] ) ) {
			$header = trim( $body['dataForSeoApiKey'] );
		}
		if ( $header !== '' ) {
			return self::parse_dataforseo_api_key( $header );
		}
		return self::dataforseo();
	}

	/**
	 * @return array{login:string,password:string}
	 */
	private static function request_dataforseo_credentials(): array {
		return self::$request_dataforseo;
	}

	/**
	 * @return array{login:string,password:string}
	 */
	private static function dataforseo_from_manager_settings(): array {
		$mgr = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::manager_settings_path() );
		if ( ! is_array( $mgr ) || empty( $mgr['snapshot']['keys']['dataforseo-api-key'] ) ) {
			return array(
				'login'    => '',
				'password' => '',
			);
		}
		return self::parse_dataforseo_api_key( (string) $mgr['snapshot']['keys']['dataforseo-api-key'] );
	}

	/**
	 * Accept "login:password" or password-only when login exists elsewhere.
	 *
	 * @return array{login:string,password:string}
	 */
	private static function parse_dataforseo_api_key( string $raw ): array {
		$raw = trim( $raw );
		if ( $raw === '' ) {
			return array(
				'login'    => '',
				'password' => '',
			);
		}
		$colon = strpos( $raw, ':' );
		if ( $colon !== false && $colon > 0 ) {
			return array(
				'login'    => trim( substr( $raw, 0, $colon ) ),
				'password' => trim( substr( $raw, $colon + 1 ) ),
			);
		}
		return array(
			'login'    => '',
			'password' => $raw,
		);
	}

	public static function semrush_api_key(): string {
		if ( defined( 'NEO_PULSE_APP_SEMRUSH_API_KEY' ) && NEO_PULSE_APP_SEMRUSH_API_KEY !== '' ) {
			return trim( (string) NEO_PULSE_APP_SEMRUSH_API_KEY );
		}
		if ( defined( 'NEO_PULSE_WP_SEMRUSH_API_KEY' ) && NEO_PULSE_WP_SEMRUSH_API_KEY !== '' ) {
			return trim( (string) NEO_PULSE_WP_SEMRUSH_API_KEY );
		}
		return '';
	}

	public static function openrouter_api_key(): string {
		if ( defined( 'NEO_PULSE_APP_OPENROUTER_API_KEY' ) && NEO_PULSE_APP_OPENROUTER_API_KEY !== '' ) {
			$app = trim( (string) NEO_PULSE_APP_OPENROUTER_API_KEY );
			if ( ! self::openrouter_key_is_invalid( $app ) ) {
				return $app;
			}
		}
		if ( defined( 'NEO_PULSE_WP_OPENROUTER_API_KEY' ) && NEO_PULSE_WP_OPENROUTER_API_KEY !== '' ) {
			$wp = trim( (string) NEO_PULSE_WP_OPENROUTER_API_KEY );
			if ( ! self::openrouter_key_is_invalid( $wp ) ) {
				return $wp;
			}
		}
		$env = self::env_string( 'OPEN_ROUTER_API_KEY', 'OPENROUTER_API_KEY', 'NEO_PULSE_APP_OPENROUTER_API_KEY' );
		if ( $env !== '' ) {
			return $env;
		}
		if ( class_exists( 'Neo_Pulse_Wp_Api' ) ) {
			$agency = trim( Neo_Pulse_Wp_Api::get_agency_openrouter_api_key() );
			if ( $agency !== '' ) {
				return $agency;
			}
		}
		if ( class_exists( 'Neo_Pulse_Wp_OpenRouter' ) ) {
			$wp_key = trim( Neo_Pulse_Wp_OpenRouter::get_api_key() );
			if ( $wp_key !== '' ) {
				return $wp_key;
			}
		}
		$mgr = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['openrouter-api-key'] ) ) {
			$key = trim( (string) $mgr['snapshot']['keys']['openrouter-api-key'] );
			if ( $key !== '' ) {
				return $key;
			}
		}
		$keys_path = Neo_Pulse_App_Data_Paths::root() . '/email-worker-keys.json';
		$keys      = Neo_Pulse_App_Json_File_Store::read( $keys_path );
		if ( is_array( $keys ) && ! empty( $keys['openRouterApiKey'] ) ) {
			$key = trim( (string) $keys['openRouterApiKey'] );
			if ( $key !== '' && ! self::openrouter_key_is_invalid( $key ) ) {
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
		if ( defined( 'NEO_PULSE_APP_GA_SERVICE_ACCOUNT_JSON' ) && NEO_PULSE_APP_GA_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) NEO_PULSE_APP_GA_SERVICE_ACCOUNT_JSON;
		}
		if ( defined( 'NEO_PULSE_WP_GA_SERVICE_ACCOUNT_JSON' ) && NEO_PULSE_WP_GA_SERVICE_ACCOUNT_JSON !== '' ) {
			return (string) NEO_PULSE_WP_GA_SERVICE_ACCOUNT_JSON;
		}
		return '';
	}

	/**
	 * @return array{clientId:string,clientSecret:string,redirectUri:string,frontendUrl:string}
	 */
	public static function gmb_oauth_env(): array {
		$client_id = defined( 'NEO_PULSE_APP_GMB_CLIENT_ID' ) ? trim( (string) NEO_PULSE_APP_GMB_CLIENT_ID ) : '';
		$secret    = defined( 'NEO_PULSE_APP_GMB_CLIENT_SECRET' ) ? trim( (string) NEO_PULSE_APP_GMB_CLIENT_SECRET ) : '';
		$redirect  = defined( 'NEO_PULSE_APP_GMB_REDIRECT_URI' ) ? trim( (string) NEO_PULSE_APP_GMB_REDIRECT_URI ) : '';
		$frontend  = defined( 'NEO_PULSE_APP_FRONTEND_URL' ) ? trim( (string) NEO_PULSE_APP_FRONTEND_URL ) : '';
		if ( $client_id === '' && defined( 'NEO_PULSE_WP_GMB_CLIENT_ID' ) ) {
			$client_id = trim( (string) NEO_PULSE_WP_GMB_CLIENT_ID );
		}
		if ( $secret === '' && defined( 'NEO_PULSE_WP_GMB_CLIENT_SECRET' ) ) {
			$secret = trim( (string) NEO_PULSE_WP_GMB_CLIENT_SECRET );
		}
		return array(
			'clientId'     => $client_id,
			'clientSecret' => $secret,
			'redirectUri'  => $redirect,
			'frontendUrl'  => $frontend,
		);
	}

	public static function agentmail_api_key(): string {
		$keys_path = Neo_Pulse_App_Data_Paths::root() . '/email-worker-keys.json';
		$keys      = Neo_Pulse_App_Json_File_Store::read( $keys_path );
		if ( is_array( $keys ) && ! empty( $keys['agentmailApiKey'] ) ) {
			return trim( (string) $keys['agentmailApiKey'] );
		}
		if ( defined( 'NEO_PULSE_APP_AGENTMAIL_API_KEY' ) && NEO_PULSE_APP_AGENTMAIL_API_KEY !== '' ) {
			return trim( (string) NEO_PULSE_APP_AGENTMAIL_API_KEY );
		}
		$mgr = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['agentmail-api-key'] ) ) {
			$key = trim( (string) $mgr['snapshot']['keys']['agentmail-api-key'] );
			if ( $key !== '' ) {
				return $key;
			}
		}
		return '';
	}

	public static function agentmail_inbox(): string {
		$keys_path = Neo_Pulse_App_Data_Paths::root() . '/email-worker-keys.json';
		$keys      = Neo_Pulse_App_Json_File_Store::read( $keys_path );
		if ( is_array( $keys ) && ! empty( $keys['agentmailGeneralEmail'] ) ) {
			$inbox = sanitize_email( strtolower( trim( (string) $keys['agentmailGeneralEmail'] ) ) );
			if ( $inbox !== '' ) {
				return $inbox;
			}
		}
		if ( defined( 'NEO_PULSE_APP_AGENTMAIL_INBOX' ) && NEO_PULSE_APP_AGENTMAIL_INBOX !== '' ) {
			return sanitize_email( strtolower( trim( (string) NEO_PULSE_APP_AGENTMAIL_INBOX ) ) );
		}
		$mgr = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::manager_settings_path() );
		if ( is_array( $mgr ) && isset( $mgr['snapshot']['keys']['agentmail-general-email'] ) ) {
			$inbox = sanitize_email( strtolower( trim( (string) $mgr['snapshot']['keys']['agentmail-general-email'] ) ) );
			if ( $inbox !== '' ) {
				return $inbox;
			}
		}
		return 'neo-pulse@agentmail.to';
	}

	/**
	 * @return array{host:string,port:int,user:string,password:string,fromEmail:string,fromName:string,secure:string}
	 */
	public static function smtp(): array {
		$host = defined( 'NEO_PULSE_APP_SMTP_HOST' ) ? trim( (string) NEO_PULSE_APP_SMTP_HOST ) : '';
		$port = defined( 'NEO_PULSE_APP_SMTP_PORT' ) ? (int) NEO_PULSE_APP_SMTP_PORT : 587;
		$user = defined( 'NEO_PULSE_APP_SMTP_USER' ) ? trim( (string) NEO_PULSE_APP_SMTP_USER ) : '';
		$pass = defined( 'NEO_PULSE_APP_SMTP_PASSWORD' ) ? (string) NEO_PULSE_APP_SMTP_PASSWORD : '';
		$from = defined( 'NEO_PULSE_APP_SMTP_FROM_EMAIL' ) ? sanitize_email( (string) NEO_PULSE_APP_SMTP_FROM_EMAIL ) : '';
		$name = defined( 'NEO_PULSE_APP_SMTP_FROM_NAME' ) ? trim( (string) NEO_PULSE_APP_SMTP_FROM_NAME ) : 'NEO Pulse';
		$sec  = defined( 'NEO_PULSE_APP_SMTP_SECURE' ) ? strtolower( trim( (string) NEO_PULSE_APP_SMTP_SECURE ) ) : 'tls';
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
		if ( defined( 'NEO_PULSE_APP_CHEKKIT_EVENTS_WEBHOOK_URL' ) && NEO_PULSE_APP_CHEKKIT_EVENTS_WEBHOOK_URL !== '' ) {
			return trim( (string) NEO_PULSE_APP_CHEKKIT_EVENTS_WEBHOOK_URL );
		}
		return self::env_string(
			'NEO_PULSE_APP_CHEKKIT_EVENTS_WEBHOOK_URL',
			'CHEKKIT_EVENTS_WEBHOOK_URL'
		);
	}

	public static function chekkit_form_email(): string {
		if ( defined( 'NEO_PULSE_APP_CHEKKIT_FORM_EMAIL' ) && NEO_PULSE_APP_CHEKKIT_FORM_EMAIL !== '' ) {
			return sanitize_email( strtolower( trim( (string) NEO_PULSE_APP_CHEKKIT_FORM_EMAIL ) ) );
		}
		return sanitize_email(
			strtolower(
				self::env_string(
					'NEO_PULSE_APP_CHEKKIT_FORM_EMAIL',
					'CHEKKIT_FORM_EMAIL',
					'CHEKKIT_WEBSITE_FORM_EMAIL'
				)
			)
		);
	}
}

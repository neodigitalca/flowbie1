<?php
/**
 * Flowbie Node API client (server-to-server via wp_remote_post).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * HTTP helper and settings accessors.
 */
class Flowbie_Wp_Api {

	const OPTION_KEY = 'flowbie_wp_settings';

	const AUTO_APP_PASSWORD_NAME = 'Flowbie WP';

	const OPTION_AUTO_SETUP = 'flowbie_wp_auto_setup_user';

	const TRANSIENT_AUTO_PAUSE = 'flowbie_wp_auto_pause_';

	/**
	 * Copy options from the old Flowbie Current plugin keys once so upgrades keep settings.
	 */
	public static function maybe_migrate_legacy_data(): void {
		$legacy_settings = get_option( 'flowbie_current_settings', null );
		if ( is_array( $legacy_settings ) && $legacy_settings !== array() ) {
			$current = get_option( self::OPTION_KEY, array() );
			$current = is_array( $current ) ? $current : array();
			$has_credentials = ! empty( $current['wp_username'] ) || ! empty( $current['app_password'] );
			if ( ! $has_credentials ) {
				update_option( self::OPTION_KEY, array_merge( $legacy_settings, $current ), false );
			}
			delete_option( 'flowbie_current_settings' );
		}

		$legacy_auto = get_option( 'flowbie_current_auto_setup_user', null );
		if ( $legacy_auto !== null && $legacy_auto !== false && get_option( self::OPTION_AUTO_SETUP, false ) === false ) {
			update_option( self::OPTION_AUTO_SETUP, $legacy_auto, false );
			delete_option( 'flowbie_current_auto_setup_user' );
		}

		self::maybe_clear_stored_api_base_for_builtin_default();
		self::maybe_apply_default_api_base();
	}

	public static function maybe_clear_stored_api_base_for_builtin_default(): void {
		if ( get_option( 'flowbie_wp_builtin_api_base_v1', false ) ) {
			return;
		}
		$default = self::get_default_api_base();
		if ( $default !== '' ) {
			$s = self::get_settings();
			if ( isset( $s['api_base'] ) && $s['api_base'] !== '' ) {
				$s['api_base'] = '';
				update_option( self::OPTION_KEY, $s, false );
			}
		}
		update_option( 'flowbie_wp_builtin_api_base_v1', '1', true );
	}

	public static function maybe_apply_default_api_base(): void {
		$default = self::get_default_api_base();
		if ( $default === '' ) {
			return;
		}
		$saved = self::get_settings();
		if ( isset( $saved['api_base'] ) && trim( (string) $saved['api_base'] ) !== '' ) {
			return;
		}
		update_option(
			self::OPTION_KEY,
			array_merge(
				$saved,
				array(
					'api_base' => $default,
				)
			),
			false
		);
	}

	public static function pause_auto_provision_retries(): void {
		$uid = get_current_user_id();
		if ( $uid > 0 ) {
			set_transient( self::TRANSIENT_AUTO_PAUSE . $uid, 1, HOUR_IN_SECONDS );
		}
	}

	public static function clear_auto_provision_pause(): void {
		$uid = get_current_user_id();
		if ( $uid > 0 ) {
			delete_transient( self::TRANSIENT_AUTO_PAUSE . $uid );
		}
	}

	public static function get_default_api_base(): string {
		$default = defined( 'FLOWBIE_WP_DEFAULT_API_BASE' ) ? (string) FLOWBIE_WP_DEFAULT_API_BASE : '';
		$default = (string) apply_filters( 'flowbie_wp_default_api_base', $default );
		return self::normalize_flowbie_api_base( $default );
	}

	public static function normalize_flowbie_api_base( string $url ): string {
		$url = trim( $url );
		if ( $url === '' ) {
			return '';
		}
		if ( ! preg_match( '#^https?://#i', $url ) ) {
			$url = 'https://' . ltrim( $url, '/' );
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return '';
		}
		$scheme = isset( $parts['scheme'] ) ? strtolower( (string) $parts['scheme'] ) : 'https';
		$host   = strtolower( (string) $parts['host'] );
		$port   = isset( $parts['port'] ) ? (int) $parts['port'] : null;
		$out    = $scheme . '://' . $host;
		if ( $port && ( ( 'http' === $scheme && 80 !== $port ) || ( 'https' === $scheme && 443 !== $port ) ) ) {
			$out .= ':' . $port;
		}
		return untrailingslashit( $out );
	}

	/**
	 * @return array{api_base:string,wp_username:string,app_password:string,paired_site_id:string,paired_client_name:string,paired_at:string}
	 */
	public static function get_settings(): array {
		$defaults = array(
			'api_base'                    => '',
			'wp_username'                 => '',
			'app_password'                => '',
			'paired_site_id'              => '',
			'paired_client_name'          => '',
			'paired_at'                   => '',
			'agency_openrouter_api_key'   => '',
			'agency_dataforseo_login'     => '',
			'agency_dataforseo_password'  => '',
		);
		$saved = get_option( self::OPTION_KEY, array() );
		$merged = wp_parse_args( (array) $saved, $defaults );

		// Migrate legacy manual site id into paired_site_id when present.
		if ( $merged['paired_site_id'] === '' && ! empty( $saved['flowbie_site_id'] ) ) {
			$merged['paired_site_id'] = sanitize_text_field( (string) $saved['flowbie_site_id'] );
		}

		return $merged;
	}

	public static function get_paired_site_id(): string {
		$s = self::get_settings();
		return isset( $s['paired_site_id'] ) ? trim( (string) $s['paired_site_id'] ) : '';
	}

	public static function is_paired(): bool {
		return self::get_paired_site_id() !== '';
	}

	public static function dev_credentials_active(): bool {
		if ( ! defined( 'FLOWBIE_WP_USE_DEV_CREDENTIALS' ) || ! FLOWBIE_WP_USE_DEV_CREDENTIALS ) {
			return false;
		}
		$u = self::get_dev_username();
		$p = self::get_dev_app_password_raw();
		return $u !== '' && $p !== '';
	}

	private static function get_dev_username(): string {
		if ( defined( 'FLOWBIE_WP_DEV_WP_USERNAME' ) && FLOWBIE_WP_DEV_WP_USERNAME !== '' ) {
			return sanitize_text_field( (string) FLOWBIE_WP_DEV_WP_USERNAME );
		}
		$e = getenv( 'FLOWBIE_WP_DEV_WP_USERNAME' );
		return $e ? sanitize_text_field( (string) $e ) : '';
	}

	private static function get_dev_app_password_raw(): string {
		if ( defined( 'FLOWBIE_WP_DEV_APP_PASSWORD' ) && FLOWBIE_WP_DEV_APP_PASSWORD !== '' ) {
			return preg_replace( '/\s+/', '', (string) FLOWBIE_WP_DEV_APP_PASSWORD );
		}
		$e = getenv( 'FLOWBIE_WP_DEV_APP_PASSWORD' );
		return $e ? preg_replace( '/\s+/', '', (string) $e ) : '';
	}

	private static function get_dev_api_base(): string {
		if ( defined( 'FLOWBIE_WP_DEV_API_BASE' ) && FLOWBIE_WP_DEV_API_BASE !== '' ) {
			return self::normalize_flowbie_api_base( (string) FLOWBIE_WP_DEV_API_BASE );
		}
		$e = getenv( 'FLOWBIE_WP_DEV_API_BASE' );
		return $e ? self::normalize_flowbie_api_base( (string) $e ) : '';
	}

	/**
	 * @return array{api_base:string,wp_username:string,app_password:string,source:string}
	 */
	public static function get_effective_settings(): array {
		if ( self::dev_credentials_active() ) {
			$base = self::get_dev_api_base();
			if ( $base === '' ) {
				$base = self::get_default_api_base();
			}
			return array(
				'api_base'     => $base,
				'wp_username'  => self::get_dev_username(),
				'app_password' => self::get_dev_app_password_raw(),
				'source'       => 'dev',
			);
		}

		$saved = self::get_settings();
		$base  = '';
		if ( isset( $saved['api_base'] ) && trim( (string) $saved['api_base'] ) !== '' ) {
			$base = self::normalize_flowbie_api_base( (string) $saved['api_base'] );
		} elseif ( self::get_default_api_base() !== '' ) {
			$base = self::get_default_api_base();
		}

		return array(
			'api_base'     => $base,
			'wp_username'  => $saved['wp_username'],
			'app_password' => $saved['app_password'],
			'source'       => 'saved',
		);
	}

	/**
	 * @param array<string,mixed> $data Raw POST-shaped array.
	 */
	public static function save_settings( array $data ): void {
		$username = isset( $data['wp_username'] ) ? sanitize_text_field( (string) $data['wp_username'] ) : '';
		$app_pw   = isset( $data['app_password'] ) ? preg_replace( '/\s+/', '', (string) $data['app_password'] ) : '';
		$app_pw   = sanitize_text_field( $app_pw );
		$api_base = isset( $data['api_base'] ) ? self::normalize_flowbie_api_base( (string) $data['api_base'] ) : '';

		$prev   = self::get_settings();
		$merged = array_merge(
			$prev,
			array(
				'wp_username'  => $username !== '' ? $username : $prev['wp_username'],
				'app_password' => $app_pw !== '' ? $app_pw : $prev['app_password'],
			)
		);
		if ( $api_base !== '' ) {
			$merged['api_base'] = $api_base;
		} elseif ( array_key_exists( 'api_base', $data ) ) {
			$merged['api_base'] = '';
		}

		update_option( self::OPTION_KEY, $merged, false );
	}

	/**
	 * @param array{siteId?:string,clientName?:string,pairedAt?:string} $pairing
	 */
	public static function save_pairing( array $pairing ): void {
		$prev = self::get_settings();
		$merged = array_merge(
			$prev,
			array(
				'paired_site_id'     => isset( $pairing['siteId'] ) ? sanitize_text_field( (string) $pairing['siteId'] ) : '',
				'paired_client_name' => isset( $pairing['clientName'] ) ? sanitize_text_field( (string) $pairing['clientName'] ) : '',
				'paired_at'          => isset( $pairing['pairedAt'] ) ? sanitize_text_field( (string) $pairing['pairedAt'] ) : '',
			)
		);
		update_option( self::OPTION_KEY, $merged, false );
	}

	public static function get_agency_openrouter_api_key(): string {
		$s = self::get_settings();
		return isset( $s['agency_openrouter_api_key'] ) ? trim( (string) $s['agency_openrouter_api_key'] ) : '';
	}

	/**
	 * @param string $api_key Empty string clears the stored key.
	 */
	public static function save_agency_openrouter_api_key( string $api_key ): void {
		$prev   = self::get_settings();
		$merged = array_merge(
			$prev,
			array(
				'agency_openrouter_api_key' => sanitize_text_field( trim( $api_key ) ),
			)
		);
		update_option( self::OPTION_KEY, $merged, false );
		Flowbie_Wp_OpenRouter::clear_credentials_cache();
	}

	public static function get_agency_dataforseo_login(): string {
		$s = self::get_settings();
		return isset( $s['agency_dataforseo_login'] ) ? trim( (string) $s['agency_dataforseo_login'] ) : '';
	}

	public static function get_agency_dataforseo_password(): string {
		$s = self::get_settings();
		return isset( $s['agency_dataforseo_password'] ) ? trim( (string) $s['agency_dataforseo_password'] ) : '';
	}

	/**
	 * @return array{login:string,password:string}
	 */
	public static function get_agency_dataforseo_credentials(): array {
		return array(
			'login'    => self::get_agency_dataforseo_login(),
			'password' => self::get_agency_dataforseo_password(),
		);
	}

	/**
	 * @param string $login Empty clears stored login.
	 * @param string $password Empty clears stored password.
	 */
	public static function save_agency_dataforseo_credentials( string $login, string $password ): void {
		$prev   = self::get_settings();
		$merged = array_merge(
			$prev,
			array(
				'agency_dataforseo_login'    => sanitize_text_field( trim( $login ) ),
				'agency_dataforseo_password' => sanitize_text_field( trim( $password ) ),
			)
		);
		update_option( self::OPTION_KEY, $merged, false );
	}

	public static function clear_pairing(): void {
		$prev = self::get_settings();
		update_option(
			self::OPTION_KEY,
			array_merge(
				$prev,
				array(
					'paired_site_id'     => '',
					'paired_client_name' => '',
					'paired_at'          => '',
				)
			),
			false
		);
	}

	public static function get_site_url(): string {
		return (string) apply_filters( 'flowbie_wp_site_url', home_url() );
	}

	/**
	 * @return array<string,string>|WP_Error
	 */
	public static function build_auth_payload() {
		$s = self::get_effective_settings();
		if ( $s['wp_username'] === '' || $s['app_password'] === '' ) {
			return new WP_Error(
				'flowbie_incomplete',
				__( 'WordPress credentials are not stored locally for this plugin.', 'flowbie-wp' )
			);
		}
		return array(
			'siteUrl'     => self::get_site_url(),
			'username'    => $s['wp_username'],
			'appPassword' => $s['app_password'],
		);
	}

	/**
	 * @return array{ok:bool,dashboard:?array<string,mixed>,error:string,error_code:string}
	 */
	public static function fetch_plugin_dashboard_state(): array {
		return Flowbie_Wp_Supabase::fetch_dashboard_state( self::get_paired_site_id() );
	}

	/**
	 * @return array{ok:bool,client:?array<string,mixed>,error:string}|WP_Error
	 */
	public static function pair_with_site_id( string $site_id ) {
		$result = Flowbie_Wp_Supabase::connect( $site_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$client = isset( $result['client'] ) && is_array( $result['client'] ) ? $result['client'] : array();
		$name   = isset( $client['name'] ) ? (string) $client['name'] : '';
		$at     = isset( $client['pluginPairedAt'] ) ? (string) $client['pluginPairedAt'] : gmdate( 'c' );

		self::save_pairing(
			array(
				'siteId'     => sanitize_text_field( trim( $site_id ) ),
				'clientName' => $name,
				'pairedAt'   => $at,
			)
		);

		delete_transient( 'flowbie_wp_dashboard_' . md5( sanitize_text_field( trim( $site_id ) ) . '|' . FLOWBIE_WP_VERSION ) );
		Flowbie_Wp_OpenRouter::clear_credentials_cache();

		return array(
			'ok'     => true,
			'client' => $client,
		);
	}

	/**
	 * @param string               $route
	 * @param array<string,mixed>  $body
	 * @param int                  $timeout
	 * @return array|WP_Error
	 */
	public static function request( string $route, array $body, int $timeout = 90 ) {
		$s = self::get_effective_settings();
		if ( $s['api_base'] === '' ) {
			return new WP_Error(
				'flowbie_no_base',
				__( 'Set the Flowbie API URL under Settings (same backend as Integrations — not the browser app URL). Credentials load from Supabase when you connect.', 'flowbie-wp' )
			);
		}

		$url  = untrailingslashit( $s['api_base'] ) . '/api/wordpress/' . ltrim( $route, '/' );
		$args = array(
			'timeout' => $timeout,
			'headers' => array(
				'Content-Type' => 'application/json; charset=utf-8',
				'Accept'       => 'application/json',
			),
			'body'    => wp_json_encode( $body ),
		);

		$response = wp_remote_post( $url, $args );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = '';
			if ( is_array( $data ) ) {
				if ( isset( $data['message'] ) && is_string( $data['message'] ) ) {
					$msg = $data['message'];
				} elseif ( isset( $data['error'] ) && is_string( $data['error'] ) ) {
					$msg = $data['error'];
				}
			}
			if ( $msg === '' ) {
				$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', (int) $code );
			}
			return new WP_Error( 'flowbie_http', $msg, array( 'status' => $code ) );
		}

		if ( ! is_array( $data ) ) {
			return new WP_Error(
				'flowbie_bad_json',
				sprintf(
					/* translators: 1: HTTP status code */
					__( 'Flowbie API returned a non-JSON response (HTTP %1$d). Use the Flowbie API server URL from Integrations — not the frontend app URL (e.g. not flowbie-1.onrender.com).', 'flowbie-wp' ),
					(int) $code
				)
			);
		}

		if ( $raw === '' || $data === array() ) {
			return new WP_Error(
				'flowbie_empty_response',
				sprintf(
					/* translators: 1: HTTP status code */
					__( 'Flowbie API returned an empty response (HTTP %1$d). The API URL likely points at the frontend app instead of the Flowbie API server. Update Flowbie API URL in Settings.', 'flowbie-wp' ),
					(int) $code
				)
			);
		}

		return $data;
	}

	/**
	 * @return array{success:bool,message:string}|WP_Error
	 */
	public static function run_test_connection_internal() {
		$auth = self::build_auth_payload();
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		$result = self::request( 'test-connection', $auth, 30 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$ok      = ! empty( $result['success'] );
		$message = '';
		if ( isset( $result['message'] ) && is_string( $result['message'] ) ) {
			$message = $result['message'];
		} elseif ( ! $ok && isset( $result['error'] ) && is_string( $result['error'] ) ) {
			$message = $result['error'];
		} elseif ( $ok ) {
			$message = __( 'Connection successful.', 'flowbie-wp' );
		} else {
			$message = __( 'Connection failed.', 'flowbie-wp' );
		}
		return array(
			'success' => $ok,
			'message' => $message,
		);
	}

	/**
	 * @return array{ok:bool,message:string}|WP_Error
	 */
	public static function maybe_auto_provision_credentials() {
		if ( self::dev_credentials_active() ) {
			return array( 'ok' => false, 'message' => '' );
		}

		$uid = get_current_user_id();
		if ( $uid > 0 && get_transient( self::TRANSIENT_AUTO_PAUSE . $uid ) ) {
			return array( 'ok' => false, 'message' => '' );
		}

		$eff = self::get_effective_settings();
		if ( $eff['wp_username'] !== '' && $eff['app_password'] !== '' && $eff['api_base'] !== '' ) {
			return array( 'ok' => false, 'message' => '' );
		}

		$saved = self::get_settings();

		if ( ! class_exists( 'WP_Application_Passwords' ) ) {
			self::pause_auto_provision_retries();
			return new WP_Error(
				'flowbie_no_app_passwords',
				__( 'Application passwords are not available on this WordPress version.', 'flowbie-wp' )
			);
		}

		if ( ! wp_is_application_passwords_available() ) {
			self::pause_auto_provision_retries();
			return new WP_Error(
				'flowbie_app_passwords_disabled',
				__( 'Application passwords are disabled on this site. Add credentials manually or ask your host to enable them.', 'flowbie-wp' )
			);
		}

		$user_id = get_current_user_id();
		if ( $user_id < 1 ) {
			return array( 'ok' => false, 'message' => '' );
		}

		if ( ! wp_is_application_passwords_available_for_user( $user_id ) ) {
			self::pause_auto_provision_retries();
			return new WP_Error(
				'flowbie_app_passwords_user',
				__( 'Your account cannot use application passwords. Save credentials for a user that can, or use an administrator account.', 'flowbie-wp' )
			);
		}

		if ( method_exists( 'WP_Application_Passwords', 'application_name_exists_for_user' )
			&& WP_Application_Passwords::application_name_exists_for_user( $user_id, self::AUTO_APP_PASSWORD_NAME )
			&& $saved['app_password'] === '' ) {
			self::pause_auto_provision_retries();
			return new WP_Error(
				'flowbie_app_password_exists',
				__( 'An application password named “Flowbie WP” already exists. Remove it under your profile or enter the password manually below.', 'flowbie-wp' )
			);
		}

		$created = WP_Application_Passwords::create_new_application_password(
			$user_id,
			array(
				'name' => self::AUTO_APP_PASSWORD_NAME,
			)
		);

		if ( is_wp_error( $created ) ) {
			self::pause_auto_provision_retries();
			return $created;
		}

		$plain = '';
		if ( is_array( $created ) && isset( $created[0] ) && is_string( $created[0] ) ) {
			$plain = $created[0];
		}

		if ( $plain === '' ) {
			self::pause_auto_provision_retries();
			return new WP_Error(
				'flowbie_app_password_empty',
				__( 'Could not read the new application password. Try saving credentials manually.', 'flowbie-wp' )
			);
		}

		$user = get_userdata( $user_id );
		if ( ! $user instanceof WP_User ) {
			self::pause_auto_provision_retries();
			return new WP_Error( 'flowbie_user', __( 'Invalid user.', 'flowbie-wp' ) );
		}

		$prev_merge = self::get_settings();
		$auto_base  = self::get_default_api_base();
		$merged     = array_merge(
			$prev_merge,
			array(
				'wp_username'  => $user->user_login,
				'app_password' => preg_replace( '/\s+/', '', $plain ),
			)
		);
		if ( $auto_base !== '' && trim( (string) ( $prev_merge['api_base'] ?? '' ) ) === '' ) {
			$merged['api_base'] = $auto_base;
		}
		update_option( self::OPTION_KEY, $merged, false );
		update_option( self::OPTION_AUTO_SETUP, $user_id, false );

		return array(
			'ok'      => true,
			'message' => __( 'Flowbie connected automatically using a new application password for your account.', 'flowbie-wp' ),
		);
	}
}

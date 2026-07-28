<?php
/**
 * Direct Supabase RPC client — reads flowbie_user_wordpress_properties only.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Supabase {

	/**
	 * @return array{url:string,anon_key:string}|WP_Error
	 */
	public static function get_config() {
		$url  = defined( 'FLOWBIE_WP_SUPABASE_URL' ) ? untrailingslashit( trim( (string) FLOWBIE_WP_SUPABASE_URL ) ) : '';
		$anon = defined( 'FLOWBIE_WP_SUPABASE_ANON_KEY' ) ? trim( (string) FLOWBIE_WP_SUPABASE_ANON_KEY ) : '';
		if ( $url === '' || $anon === '' ) {
			return new WP_Error(
				'flowbie_supabase_config',
				__( 'Flowbie WP Supabase credentials are missing from the plugin build.', 'flowbie-wp' )
			);
		}
		return array(
			'url'      => $url,
			'anon_key' => $anon,
		);
	}

	/**
	 * @param string               $function
	 * @param array<string,mixed>  $payload
	 * @param int                  $timeout
	 * @return array|WP_Error
	 */
	public static function rpc( string $function, array $payload, int $timeout = 45 ) {
		$config = self::get_config();
		if ( is_wp_error( $config ) ) {
			return $config;
		}

		$url  = $config['url'] . '/rest/v1/rpc/' . rawurlencode( $function );
		$args = array(
			'timeout' => $timeout,
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
				'apikey'        => $config['anon_key'],
				'Authorization' => 'Bearer ' . $config['anon_key'],
			),
			'body'    => wp_json_encode( $payload ),
		);

		$response = wp_remote_post( $url, $args );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = self::extract_error_message( $data, $raw, $code );
			return new WP_Error( 'flowbie_supabase_http', $msg, array( 'status' => $code ) );
		}

		if ( ! is_array( $data ) && ! is_null( $data ) ) {
			return new WP_Error(
				'flowbie_supabase_bad_json',
				__( 'Supabase returned an unexpected response.', 'flowbie-wp' )
			);
		}

		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param mixed  $data
	 * @param string $raw
	 * @param int    $code
	 */
	private static function extract_error_message( $data, string $raw, int $code ): string {
		if ( is_array( $data ) ) {
			if ( isset( $data['message'] ) && is_string( $data['message'] ) && $data['message'] !== '' ) {
				return $data['message'];
			}
			if ( isset( $data['error'] ) && is_string( $data['error'] ) && $data['error'] !== '' ) {
				return $data['error'];
			}
			if ( isset( $data['hint'] ) && is_string( $data['hint'] ) && $data['hint'] !== '' ) {
				return $data['hint'];
			}
		}
		if ( $raw !== '' ) {
			return $raw;
		}
		return sprintf( 'HTTP %d', $code );
	}

	/**
	 * @return array{ok:bool,client:?array<string,mixed>,error:string}|WP_Error
	 */
	public static function connect( string $site_id ) {
		$site_id = sanitize_text_field( trim( $site_id ) );
		if ( $site_id === '' ) {
			return new WP_Error(
				'flowbie_site_id',
				__( 'Enter the site ID from your Flowbie property (Integrations).', 'flowbie-wp' )
			);
		}

		$result = self::rpc(
			'flowbie_plugin_connect',
			array(
				'p_site_id'  => $site_id,
				'p_site_url' => Flowbie_Wp_Api::get_site_url(),
			),
			45
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( empty( $result['ok'] ) || empty( $result['siteId'] ) ) {
			$msg = isset( $result['error'] ) && is_string( $result['error'] ) ? $result['error'] : __( 'Connect failed.', 'flowbie-wp' );
			return new WP_Error( 'flowbie_connect_failed', $msg );
		}

		$client = isset( $result['client'] ) && is_array( $result['client'] ) ? $result['client'] : array();
		$progress = isset( $result['progress'] ) && is_array( $result['progress'] ) ? $result['progress'] : array();
		return array(
			'ok'       => true,
			'client'   => $client,
			'progress' => $progress,
		);
	}

	/**
	 * @return array{ok:bool,dashboard:?array<string,mixed>,error:string,error_code:string}
	 */
	public static function fetch_dashboard_state( string $site_id ): array {
		$site_id = sanitize_text_field( trim( $site_id ) );
		if ( $site_id === '' ) {
			return array(
				'ok'         => false,
				'dashboard'  => null,
				'error'      => __( 'Enter your site ID under Settings and click Connect.', 'flowbie-wp' ),
				'error_code' => 'not_connected',
			);
		}

		$cache_key = 'flowbie_wp_dashboard_' . md5( $site_id . '|' . FLOWBIE_WP_VERSION );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && ! empty( $cached['ok'] ) ) {
			return array(
				'ok'         => true,
				'dashboard'  => $cached,
				'error'      => '',
				'error_code' => '',
			);
		}

		$connect = self::connect( $site_id );
		if ( is_wp_error( $connect ) ) {
			return array(
				'ok'         => false,
				'dashboard'  => null,
				'error'      => $connect->get_error_message(),
				'error_code' => $connect->get_error_code(),
			);
		}

		$client = isset( $connect['client'] ) && is_array( $connect['client'] ) ? $connect['client'] : array();
		$rpc_progress = isset( $connect['progress'] ) && is_array( $connect['progress'] ) ? $connect['progress'] : array();
		$progress = Flowbie_Wp_Site_Progress::merge_progress( $rpc_progress, $client );
		$dashboard = array(
			'ok'       => true,
			'client'   => $client,
			'progress' => $progress,
		);

		set_transient( $cache_key, $dashboard, 120 );

		return array(
			'ok'         => true,
			'dashboard'  => $dashboard,
			'error'      => '',
			'error_code' => '',
		);
	}

	/**
	 * @return array{ok:bool,apiKey:string,model:string}|WP_Error
	 */
	public static function fetch_openrouter_credentials( string $site_id ) {
		$site_id = sanitize_text_field( trim( $site_id ) );
		if ( $site_id === '' ) {
			return new WP_Error(
				'flowbie_site_id',
				__( 'Site is not connected.', 'flowbie-wp' )
			);
		}

		$result = self::rpc(
			'flowbie_plugin_openrouter_credentials',
			array(
				'p_site_id'  => $site_id,
				'p_site_url' => Flowbie_Wp_Api::get_site_url(),
			),
			30
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( empty( $result['ok'] ) ) {
			return new WP_Error(
				'flowbie_openrouter_credentials',
				__( 'Could not load OpenRouter credentials from Flowbie.', 'flowbie-wp' )
			);
		}

		return array(
			'ok'     => true,
			'apiKey' => isset( $result['apiKey'] ) ? (string) $result['apiKey'] : '',
			'model'  => isset( $result['model'] ) ? (string) $result['model'] : '',
		);
	}
}

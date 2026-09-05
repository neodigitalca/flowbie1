<?php
/**
 * Post creator worker client (Node harness on configured worker URL).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Post_Creator_Worker {

	/**
	 * @param array<string,mixed> $run
	 * @param array<string,mixed> $site
	 * @param array<string,mixed> $contract
	 * @param array<string,mixed> $checkpoint
	 * @return array{ok:bool,jobId?:string,error?:string}
	 */
	public static function start_job(
		int $team_id,
		int $user_id,
		array $run,
		array $site,
		array $contract,
		array $checkpoint = array()
	): array {
		$run_id = (int) ( $run['id'] ?? 0 );
		if ( $run_id <= 0 ) {
			return array( 'ok' => false, 'error' => 'Invalid agent run id.' );
		}

		try {
			$worker_url = self::worker_url();
			$api_base   = self::api_base_url();
		} catch ( Exception $e ) {
			return array(
				'ok'    => false,
				'error' => $e->getMessage(),
			);
		}

		$bearer = Neo_Pulse_App_Auth_Session::mint_bearer_token( $user_id, $team_id, 7200 );

		$openrouter = '';
		if ( class_exists( 'Neo_Pulse_App_Chat_Openrouter' ) ) {
			$openrouter = trim( (string) Neo_Pulse_App_Chat_Openrouter::resolve_api_key() );
		}
		if ( $openrouter === '' && defined( 'NEO_PULSE_APP_OPENROUTER_API_KEY' ) ) {
			$openrouter = trim( (string) NEO_PULSE_APP_OPENROUTER_API_KEY );
		}

		$dataforseo = '';
		if ( defined( 'NEO_PULSE_APP_DATAFORSEO_LOGIN' ) ) {
			$dataforseo = trim( (string) NEO_PULSE_APP_DATAFORSEO_LOGIN );
		}

		$server_checkpoint = is_array( $checkpoint['server'] ?? null ) ? $checkpoint['server'] : array();
		$bucket_json       = trim( (string) ( $server_checkpoint['preflightBucketJson'] ?? '' ) );
		$site_kw_json      = trim( (string) ( $server_checkpoint['preflightSiteKwJson'] ?? '' ) );
		if ( $bucket_json === '' || $site_kw_json === '' ) {
			return array(
				'ok'    => false,
				'error' => 'Post creator preflight data is missing from worker checkpoint.',
			);
		}

		$payload = array(
			'teamId'           => $team_id,
			'runId'            => $run_id,
			'userId'           => $user_id,
			'apiBase'          => $api_base,
			'bearerToken'      => $bearer,
			'openRouterApiKey' => $openrouter,
			'dataForSeoApiKey' => $dataforseo,
			'site'             => array(
				'id'          => (string) ( $site['id'] ?? '' ),
				'name'        => (string) ( $site['name'] ?? '' ),
				'siteUrl'     => (string) ( $site['siteUrl'] ?? '' ),
				'username'    => (string) ( $site['username'] ?? '' ),
				'appPassword' => (string) ( $site['appPassword'] ?? '' ),
			),
			'contract'         => $contract,
			'resumeCheckpoint' => $checkpoint,
			'preflight'        => array(
				'bucketJson'      => $bucket_json,
				'siteKwJsonText'  => $site_kw_json,
			),
		);

		$response = self::remote_worker_request(
			'POST',
			$worker_url . '/post-creator/jobs',
			$payload
		);

		if ( empty( $response['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => ! empty( $response['error'] )
					? (string) $response['error']
					: 'Post creator worker request failed.',
			);
		}
		if ( empty( $response['jobId'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'Post creator worker did not return a job id.',
			);
		}

		return array(
			'ok'    => true,
			'jobId' => (string) $response['jobId'],
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function read_job_progress( string $job_id ): array {
		if ( $job_id === '' ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Post creator worker job id is missing.',
			);
		}

		try {
			$worker_url = self::worker_url();
		} catch ( Exception $e ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => $e->getMessage(),
			);
		}

		$response = self::remote_worker_request(
			'GET',
			$worker_url . '/post-creator/jobs/' . rawurlencode( $job_id )
		);

		if ( ! is_array( $response ) ) {
			return array(
				'ok'     => false,
				'status' => 'error',
				'error'  => 'Post creator worker returned an invalid response.',
			);
		}

		return $response;
	}

	private static function worker_url(): string {
		if ( ! defined( 'NEO_PULSE_APP_POST_CREATOR_WORKER_URL' ) ) {
			throw new Exception( 'NEO_PULSE_APP_POST_CREATOR_WORKER_URL is not configured.' );
		}
		$url = rtrim( trim( (string) NEO_PULSE_APP_POST_CREATOR_WORKER_URL ), '/' );
		if ( $url === '' ) {
			throw new Exception( 'NEO_PULSE_APP_POST_CREATOR_WORKER_URL is not configured.' );
		}
		return $url;
	}

	private static function api_base_url(): string {
		if ( ! defined( 'NEO_PULSE_APP_POST_CREATOR_API_BASE' ) ) {
			throw new Exception( 'NEO_PULSE_APP_POST_CREATOR_API_BASE is not configured.' );
		}
		$url = rtrim( trim( (string) NEO_PULSE_APP_POST_CREATOR_API_BASE ), '/' );
		if ( $url === '' ) {
			throw new Exception( 'NEO_PULSE_APP_POST_CREATOR_API_BASE is not configured.' );
		}
		return $url;
	}

	private static function worker_auth_token(): string {
		if ( ! defined( 'NEO_PULSE_APP_POST_CREATOR_WORKER_AUTH' ) ) {
			return '';
		}
		return trim( (string) NEO_PULSE_APP_POST_CREATOR_WORKER_AUTH );
	}

	/**
	 * @param array<string,mixed>|null $body
	 * @return array<string,mixed>|null
	 */
	private static function remote_worker_request( string $method, string $url, ?array $body = null ): ?array {
		$headers = array(
			'Accept'       => 'application/json',
			'Content-Type' => 'application/json',
		);
		$token = self::worker_auth_token();
		if ( $token !== '' ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}

		$is_get = strtoupper( $method ) === 'GET';
		$timeout         = $is_get ? 120 : 600;
		$connect_timeout = $is_get ? 60 : 180;

		$args = array(
			'timeout'         => $timeout,
			'connect_timeout' => $connect_timeout,
			'method'          => $method,
			'headers'         => $headers,
		);
		if ( $body !== null ) {
			$args['body'] = wp_json_encode( $body );
		}

		$curl_hook = static function( $handle ) use ( $connect_timeout, $timeout ) {
			if ( ! is_resource( $handle ) && ! ( is_object( $handle ) && get_class( $handle ) === 'CurlHandle' ) ) {
				return;
			}
			curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, $connect_timeout );
			curl_setopt( $handle, CURLOPT_TIMEOUT, $timeout );
		};
		add_action( 'http_api_curl', $curl_hook, 10, 1 );

		@set_time_limit( max( (int) ini_get( 'max_execution_time' ), $timeout + 30 ) );

		$result = wp_remote_request( $url, $args );
		remove_action( 'http_api_curl', $curl_hook, 10 );

		if ( is_wp_error( $result ) ) {
			$message = $result->get_error_message();
			if ( str_contains( $message, 'timed out' ) || str_contains( $message, 'Connection refused' ) ) {
				$message .= ' (start the host worker: npm run start:ld-worker)';
			}
			return array(
				'ok'    => false,
				'error' => $message,
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $result );
		$raw  = wp_remote_retrieve_body( $result );
		$json = json_decode( $raw, true );
		if ( ! is_array( $json ) ) {
			return array(
				'ok'    => false,
				'error' => 'Post creator worker returned non-JSON (HTTP ' . $code . ').',
			);
		}
		return $json;
	}
}

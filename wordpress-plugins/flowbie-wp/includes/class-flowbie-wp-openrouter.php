<?php
/**
 * OpenRouter client for Flowbie WP AI wands.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_OpenRouter {

	const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

	const TRANSCRIBE_API_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

	const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

	const TRANSCRIBE_MODEL = 'google/chirp-3';

	const APP_TITLE = 'Flowbie WP';

	const DEFAULT_HTTP_REFERER = 'https://flowbie.ca/flowbie-wp';

	const MAX_AUDIO_BASE64_BYTES = 5242880;

	/**
	 * @return string
	 */
	public static function get_api_key(): string {
		if ( defined( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) && FLOWBIE_WP_OPENROUTER_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_WP_OPENROUTER_API_KEY );
		}
		$env = getenv( 'FLOWBIE_WP_OPENROUTER_API_KEY' );
		if ( $env ) {
			return trim( (string) $env );
		}
		$agency = Flowbie_Wp_Api::get_agency_openrouter_api_key();
		if ( $agency !== '' ) {
			return $agency;
		}
		$file_key = self::get_flowbie_data_openrouter_key();
		if ( $file_key !== '' ) {
			return $file_key;
		}
		return '';
	}

	/**
	 * OpenRouter key synced from flowbie.ca (email-worker-keys.json).
	 *
	 * @return string
	 */
	private static function get_flowbie_data_openrouter_key(): string {
		if ( ! class_exists( 'Flowbie_App_Data_Paths' ) || ! class_exists( 'Flowbie_App_Json_File_Store' ) ) {
			return '';
		}
		$keys = Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::root() . '/email-worker-keys.json' );
		if ( is_array( $keys ) && ! empty( $keys['openRouterApiKey'] ) ) {
			return trim( (string) $keys['openRouterApiKey'] );
		}
		return '';
	}

	/**
	 * Body harness: wp-config, env, or agency settings only (no Supabase).
	 *
	 * @return string
	 */
	public static function get_body_api_key(): string {
		if ( defined( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) && FLOWBIE_WP_OPENROUTER_API_KEY !== '' ) {
			return trim( (string) FLOWBIE_WP_OPENROUTER_API_KEY );
		}
		$env = getenv( 'FLOWBIE_WP_OPENROUTER_API_KEY' );
		if ( $env ) {
			return trim( (string) $env );
		}
		return Flowbie_Wp_Api::get_agency_openrouter_api_key();
	}

	/**
	 * @return string
	 */
	public static function get_model(): string {
		if ( defined( 'FLOWBIE_WP_OPENROUTER_MODEL' ) && FLOWBIE_WP_OPENROUTER_MODEL !== '' ) {
			return trim( (string) FLOWBIE_WP_OPENROUTER_MODEL );
		}
		$env = getenv( 'FLOWBIE_WP_OPENROUTER_MODEL' );
		if ( $env ) {
			return trim( (string) $env );
		}

		return self::DEFAULT_MODEL;
	}

	/**
	 * @return string
	 */
	public static function get_http_referer(): string {
		if ( defined( 'FLOWBIE_WP_OPENROUTER_HTTP_REFERER' ) && FLOWBIE_WP_OPENROUTER_HTTP_REFERER !== '' ) {
			return trim( (string) FLOWBIE_WP_OPENROUTER_HTTP_REFERER );
		}
		return self::DEFAULT_HTTP_REFERER;
	}

	/**
	 * @return string
	 */
	public static function get_app_title(): string {
		return self::APP_TITLE;
	}

	/**
	 * OpenRouter app attribution headers (HTTP-Referer + X-Title).
	 *
	 * @return array<string, string>
	 */
	public static function attribution_headers(): array {
		return array(
			'HTTP-Referer' => self::get_http_referer(),
			'X-Title'      => self::get_app_title(),
		);
	}

	/**
	 * @param string $api_key
	 * @return array<string, string>
	 */
	public static function request_headers( string $api_key ): array {
		return array_merge(
			array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . $api_key,
			),
			self::attribution_headers()
		);
	}

	/**
	 * @return int
	 */
	public static function get_timeout(): int {
		$timeout = (int) apply_filters( 'flowbie_wp_openrouter_timeout', (int) apply_filters( 'flowbie_wp_enhance_remote_timeout', 180 ) );
		if ( $timeout < 10 ) {
			$timeout = 10;
		}
		if ( $timeout > 300 ) {
			$timeout = 300;
		}
		return $timeout;
	}

	public static function maybe_extend_time_limit(): void {
		$limit = (int) apply_filters( 'flowbie_wp_enhance_time_limit', 300 );
		if ( $limit > 0 && function_exists( 'set_time_limit' ) ) {
			set_time_limit( $limit );
		}
	}

	public static function get_openrouter_source(): string {
		if ( defined( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) && FLOWBIE_WP_OPENROUTER_API_KEY !== '' ) {
			return 'wp-config';
		}
		if ( getenv( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) || getenv( 'OPEN_ROUTER_API_KEY' ) || getenv( 'OPENROUTER_API_KEY' ) ) {
			return 'environment';
		}
		if ( Flowbie_Wp_Api::get_agency_openrouter_api_key() !== '' ) {
			return 'site';
		}
		return '';
	}

	public static function clear_credentials_cache(): void {
	}

	/**
	 * @param string $system_prompt
	 * @param string $user_prompt
	 * @param int    $max_tokens
	 * @param float  $temperature
	 * @return string|WP_Error
	 */
	public static function complete( string $system_prompt, string $user_prompt, int $max_tokens = 4096, float $temperature = 0.7 ) {
		$key = self::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured. Add your key in Flowbie WP Settings or the plugin .env file.', 'flowbie-wp' )
			);
		}

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => self::request_headers( $key ),
				'body'    => wp_json_encode(
					array(
						'model'       => self::get_model(),
						'messages'    => array(
							array(
								'role'    => 'system',
								'content' => $system_prompt,
							),
							array(
								'role'    => 'user',
								'content' => $user_prompt,
							),
						),
						'temperature' => $temperature,
						'max_tokens'  => $max_tokens,
					)
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
			$msg = '';
			if ( is_array( $data ) ) {
				if ( isset( $data['error']['message'] ) && is_string( $data['error']['message'] ) ) {
					$msg = $data['error']['message'];
				} elseif ( isset( $data['message'] ) && is_string( $data['message'] ) ) {
					$msg = $data['message'];
				}
			}
			if ( $msg === '' ) {
				$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', $code );
			}
			return new WP_Error( 'flowbie_openrouter_http', sprintf( 'OpenRouter %1$d: %2$s', $code, $msg ) );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}
		if ( $text === '' ) {
			return new WP_Error( 'flowbie_openrouter_empty', __( 'AI returned empty content.', 'flowbie-wp' ) );
		}

		return $text;
	}

	/**
	 * Chat log analysis: agency/wp-config key only (no Supabase).
	 *
	 * @param string $system_prompt System prompt.
	 * @param string $user_prompt   User prompt.
	 * @param string $model         OpenRouter model id.
	 * @param int    $max_tokens    Max tokens.
	 * @param float  $temperature   Temperature.
	 * @return string|WP_Error
	 */
	public static function complete_agency_only(
		string $system_prompt,
		string $user_prompt,
		string $model,
		int $max_tokens = 4096,
		float $temperature = 0.7
	) {
		$key = self::get_body_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured. Add your key in Flowbie WP Settings.', 'flowbie-wp' )
			);
		}

		$model = trim( $model );
		if ( $model === '' ) {
			$model = 'google/gemini-2.5-flash';
		}

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => self::request_headers( $key ),
				'body'    => wp_json_encode(
					array(
						'model'       => $model,
						'messages'    => array(
							array(
								'role'    => 'system',
								'content' => $system_prompt,
							),
							array(
								'role'    => 'user',
								'content' => $user_prompt,
							),
						),
						'temperature' => $temperature,
						'max_tokens'  => $max_tokens,
					)
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
			$msg = '';
			if ( is_array( $data ) ) {
				if ( isset( $data['error']['message'] ) && is_string( $data['error']['message'] ) ) {
					$msg = $data['error']['message'];
				} elseif ( isset( $data['message'] ) && is_string( $data['message'] ) ) {
					$msg = $data['message'];
				}
			}
			if ( $msg === '' ) {
				$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', $code );
			}
			return new WP_Error( 'flowbie_openrouter_http', sprintf( 'OpenRouter %1$d: %2$s', $code, $msg ) );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}
		if ( $text === '' ) {
			return new WP_Error( 'flowbie_openrouter_empty', __( 'AI returned empty content.', 'flowbie-wp' ) );
		}

		return $text;
	}

	/**
	 * @return array{content:string,finish_reason:string}|WP_Error
	 */
	public static function complete_chat( string $system_prompt, string $user_prompt, int $max_tokens = 4096, float $temperature = 0.7 ) {
		$key = self::get_body_api_key();
		if ( $key === '' ) {
			$key = self::get_api_key();
		}
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured.', 'flowbie-wp' )
			);
		}

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => self::request_headers( $key ),
				'body'    => wp_json_encode(
					array(
						'model'       => self::get_model(),
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system_prompt ),
							array( 'role' => 'user', 'content' => $user_prompt ),
						),
						'temperature' => $temperature,
						'max_tokens'  => $max_tokens,
					)
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
			$msg = '';
			if ( is_array( $data ) && isset( $data['error']['message'] ) && is_string( $data['error']['message'] ) ) {
				$msg = $data['error']['message'];
			} elseif ( is_array( $data ) && isset( $data['message'] ) && is_string( $data['message'] ) ) {
				$msg = $data['message'];
			}
			if ( $msg === '' ) {
				$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', $code );
			}
			return new WP_Error( 'flowbie_openrouter_http', sprintf( 'OpenRouter %1$d: %2$s', $code, $msg ) );
		}

		$text = '';
		$finish = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
			if ( isset( $data['choices'][0]['finish_reason'] ) ) {
				$finish = (string) $data['choices'][0]['finish_reason'];
			}
		}
		if ( $text === '' ) {
			return new WP_Error( 'flowbie_openrouter_empty', __( 'AI returned empty content.', 'flowbie-wp' ) );
		}

		return array(
			'content'       => $text,
			'finish_reason' => $finish,
		);
	}

	/**
	 * @return array<string, string>|WP_Error
	 */
	private static function get_audio_request_headers() {
		$key = self::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured.', 'flowbie-wp' )
			);
		}

		return self::request_headers( $key );
	}

	/**
	 * @param string $base64 Raw base64 audio (no data: prefix).
	 * @param string $format webm|wav|mp3|ogg|m4a|flac|aac
	 * @return string|WP_Error
	 */
	public static function transcribe_audio( string $base64, string $format = 'webm' ) {
		$headers = self::get_audio_request_headers();
		if ( is_wp_error( $headers ) ) {
			return $headers;
		}

		$format = strtolower( preg_replace( '/[^a-z0-9]/', '', $format ) );
		$allowed = array( 'webm', 'wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac' );
		if ( ! in_array( $format, $allowed, true ) ) {
			$format = 'webm';
		}

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::TRANSCRIBE_API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => $headers,
				'body'    => wp_json_encode(
					array(
						'model'       => self::TRANSCRIBE_MODEL,
						'input_audio' => array(
							'data'   => $base64,
							'format' => $format,
						),
					)
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
			$msg = self::extract_api_error_message( $data, $raw, $code );
			return new WP_Error( 'flowbie_openrouter_transcribe', $msg );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['text'] ) ) {
			$text = trim( (string) $data['text'] );
		}
		if ( $text === '' ) {
			return new WP_Error( 'flowbie_openrouter_transcribe_empty', __( 'No speech detected.', 'flowbie-wp' ) );
		}

		return $text;
	}

	/**
	 * @param array<string, mixed>|null $data
	 */
	private static function extract_api_error_message( ?array $data, string $raw, int $code ): string {
		$msg = '';
		if ( is_array( $data ) ) {
			if ( isset( $data['error']['message'] ) && is_string( $data['error']['message'] ) ) {
				$msg = $data['error']['message'];
			} elseif ( isset( $data['message'] ) && is_string( $data['message'] ) ) {
				$msg = $data['message'];
			}
		}
		if ( $msg === '' ) {
			$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', $code );
		}
		return sprintf( 'OpenRouter %1$d: %2$s', $code, $msg );
	}
}

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

	const SPEECH_API_URL = 'https://openrouter.ai/api/v1/audio/speech';

	const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

	const TRANSCRIBE_MODEL = 'google/chirp-3';

	const VOICE_ACK_MODEL = 'google/gemini-2.5-flash-lite';

	const TTS_MODEL = 'google/gemini-3.1-flash-tts-preview';

	const TTS_MODEL_FALLBACK = 'openai/gpt-4o-mini-tts-2025-12-15';

	const TTS_VOICE = 'Kore';

	const MAX_AUDIO_BASE64_BYTES = 5242880;

	const CREDENTIALS_TRANSIENT_TTL = 3600;

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
		return self::get_supabase_api_key();
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

		$credentials = self::get_supabase_credentials();
		if ( is_array( $credentials ) && ! empty( $credentials['model'] ) ) {
			return trim( (string) $credentials['model'] );
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
		return 'https://flowbie.ca';
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
		if ( getenv( 'FLOWBIE_WP_OPENROUTER_API_KEY' ) ) {
			return 'environment';
		}
		if ( Flowbie_Wp_Api::get_agency_openrouter_api_key() !== '' ) {
			return 'site';
		}
		if ( self::get_supabase_api_key() !== '' ) {
			return 'flowbie';
		}
		return '';
	}

	public static function clear_credentials_cache(): void {
		if ( ! Flowbie_Wp_Api::is_paired() ) {
			return;
		}
		delete_transient( self::credentials_transient_key( Flowbie_Wp_Api::get_paired_site_id() ) );
	}

	/**
	 * @return string
	 */
	private static function get_supabase_api_key(): string {
		$credentials = self::get_supabase_credentials();
		if ( ! is_array( $credentials ) || empty( $credentials['apiKey'] ) ) {
			return '';
		}
		return trim( (string) $credentials['apiKey'] );
	}

	/**
	 * @return array{apiKey:string,model:string}|null
	 */
	private static function get_supabase_credentials(): ?array {
		if ( ! Flowbie_Wp_Api::is_paired() ) {
			return null;
		}

		$site_id   = Flowbie_Wp_Api::get_paired_site_id();
		$cache_key = self::credentials_transient_key( $site_id );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$result = Flowbie_Wp_Supabase::fetch_openrouter_credentials( $site_id );
		if ( is_wp_error( $result ) ) {
			return null;
		}

		$credentials = array(
			'apiKey' => isset( $result['apiKey'] ) ? trim( (string) $result['apiKey'] ) : '',
			'model'  => isset( $result['model'] ) ? trim( (string) $result['model'] ) : '',
		);
		set_transient( $cache_key, $credentials, self::CREDENTIALS_TRANSIENT_TTL );

		return $credentials;
	}

	private static function credentials_transient_key( string $site_id ): string {
		return 'flowbie_wp_or_' . md5( $site_id . '|' . FLOWBIE_WP_VERSION );
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
				__( 'OpenRouter API key is not configured. Save your OpenRouter key in Flowbie Integrations (API Keys), then reconnect this site.', 'flowbie-wp' )
			);
		}

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => self::get_http_referer(),
					'X-Title'       => 'Flowbie WP AI',
				),
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
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => self::get_http_referer(),
					'X-Title'       => 'Flowbie WP Chat Logs',
				),
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
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => self::get_http_referer(),
					'X-Title'       => 'Flowbie WP Body Harness',
				),
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
	private static function get_audio_request_headers( string $title = 'Flowbie Voice' ) {
		$key = self::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured.', 'flowbie-wp' )
			);
		}

		return array(
			'Content-Type'  => 'application/json',
			'Authorization' => 'Bearer ' . $key,
			'HTTP-Referer'  => self::get_http_referer(),
			'X-Title'       => $title,
		);
	}

	/**
	 * @param string $base64 Raw base64 audio (no data: prefix).
	 * @param string $format webm|wav|mp3|ogg|m4a|flac|aac
	 * @return string|WP_Error
	 */
	public static function transcribe_audio( string $base64, string $format = 'webm' ) {
		$headers = self::get_audio_request_headers( 'Flowbie Voice STT' );
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
	 * @param string $text
	 * @param string $voice
	 * @param string $format mp3|pcm
	 * @return string|WP_Error Raw audio bytes.
	 */
	public static function synthesize_speech( string $text, string $voice = '', string $format = 'mp3' ) {
		$voice = $voice !== '' ? $voice : self::TTS_VOICE;
		$format = $format === 'pcm' ? 'pcm' : 'mp3';

		$models = array( self::TTS_MODEL );
		if ( self::TTS_MODEL_FALLBACK !== '' && self::TTS_MODEL_FALLBACK !== self::TTS_MODEL ) {
			$models[] = self::TTS_MODEL_FALLBACK;
		}

		$last_error = null;
		foreach ( $models as $model ) {
			$result = self::synthesize_speech_with_model( $text, $model, $voice, $format );
			if ( ! is_wp_error( $result ) ) {
				return $result;
			}
			$last_error = $result;
		}

		return $last_error instanceof WP_Error
			? $last_error
			: new WP_Error( 'flowbie_openrouter_tts', __( 'TTS failed.', 'flowbie-wp' ) );
	}

	/**
	 * @return string|WP_Error Raw audio bytes.
	 */
	private static function synthesize_speech_with_model( string $text, string $model, string $voice, string $format ) {
		$headers = self::get_audio_request_headers( 'Flowbie Voice TTS' );
		if ( is_wp_error( $headers ) ) {
			return $headers;
		}

		self::maybe_extend_time_limit();

		$body = array(
			'model'           => $model,
			'input'           => $text,
			'voice'           => $voice,
			'response_format' => $format,
		);

		// OpenAI TTS on OpenRouter uses "nova" etc.; Gemini uses Kore/Zephyr.
		if ( strpos( $model, 'openai/' ) === 0 ) {
			$body['voice'] = 'nova';
		}

		$response = wp_remote_post(
			self::SPEECH_API_URL,
			array(
				'timeout' => self::get_timeout(),
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );

		if ( $code < 200 || $code >= 300 ) {
			$data = json_decode( $raw, true );
			$msg  = self::extract_api_error_message( $data, $raw, $code );
			return new WP_Error( 'flowbie_openrouter_tts', $msg );
		}

		if ( $raw === '' ) {
			return new WP_Error( 'flowbie_openrouter_tts_empty', __( 'TTS returned empty audio.', 'flowbie-wp' ) );
		}

		if ( isset( $raw[0] ) && $raw[0] === '{' ) {
			$data = json_decode( $raw, true );
			if ( is_array( $data ) ) {
				$msg = self::extract_api_error_message( $data, $raw, $code );
				return new WP_Error( 'flowbie_openrouter_tts', $msg );
			}
		}

		return $raw;
	}

	/**
	 * @param string $user_message
	 * @return string|WP_Error
	 */
	public static function voice_ack_text( string $user_message ) {
		$key = self::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured.', 'flowbie-wp' )
			);
		}

		$system = 'You are Flow Assist. Reply with exactly one short spoken sentence (under 20 words) confirming you will help. Start with "Sure" or "Of course". Include a brief restatement of the user\'s task. No markdown, no questions.';

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => min( 60, self::get_timeout() ),
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => self::get_http_referer(),
					'X-Title'       => 'Flowbie Voice Ack',
				),
				'body'    => wp_json_encode(
					array(
						'model'       => self::VOICE_ACK_MODEL,
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system ),
							array( 'role' => 'user', 'content' => $user_message ),
						),
						'temperature' => 0.4,
						'max_tokens'  => 80,
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
			return new WP_Error( 'flowbie_openrouter_ack', $msg );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}
		if ( $text === '' ) {
			$text = __( 'Sure, I can help you with that.', 'flowbie-wp' );
		}

		return $text;
	}

	/**
	 * Short spoken summary of an assistant card for TTS playback.
	 *
	 * @param string               $user_message Original user question.
	 * @param array<string, mixed> $card         Card with type, title, body.
	 * @return string|WP_Error
	 */
	public static function voice_narrate_script( string $user_message, array $card ) {
		$key = self::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured.', 'flowbie-wp' )
			);
		}

		$title = isset( $card['title'] ) ? wp_strip_all_tags( (string) $card['title'] ) : '';
		$body  = isset( $card['body'] ) ? wp_strip_all_tags( (string) $card['body'] ) : '';
		$type  = isset( $card['type'] ) ? sanitize_text_field( (string) $card['type'] ) : 'answer';

		if ( strlen( $body ) > 1200 ) {
			$body = substr( $body, 0, 1197 ) . '...';
		}

		$system = 'You are Flow Assist. Write exactly one short spoken paragraph (under 45 words) that summarizes the assistant response the user is about to see on screen. Use first person ("I"). Sound natural and conversational. Do not read bullet lists verbatim, do not say "ANSWER" or card labels, and use no markdown.';

		$user = "User asked: {$user_message}\n\nResponse type: {$type}\nTitle: {$title}\nContent:\n{$body}";

		self::maybe_extend_time_limit();

		$response = wp_remote_post(
			self::API_URL,
			array(
				'timeout' => min( 60, self::get_timeout() ),
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => self::get_http_referer(),
					'X-Title'       => 'Flowbie Voice Narrate',
				),
				'body'    => wp_json_encode(
					array(
						'model'       => self::VOICE_ACK_MODEL,
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system ),
							array( 'role' => 'user', 'content' => $user ),
						),
						'temperature' => 0.45,
						'max_tokens'  => 120,
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
			return new WP_Error( 'flowbie_openrouter_narrate', $msg );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}
		if ( $text === '' ) {
			$text = $title !== '' ? $title : __( 'Here is my response.', 'flowbie-wp' );
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

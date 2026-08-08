<?php
/**
 * OpenRouter chat + audio transcription for team chat (FLO bot).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Chat_Openrouter {

	const CHAT_URL         = 'https://openrouter.ai/api/v1/chat/completions';
	const TRANSCRIBE_URL   = 'https://openrouter.ai/api/v1/audio/transcriptions';
	const DEFAULT_MODEL    = 'google/gemini-2.5-flash-lite';
	const TRANSCRIBE_MODEL = 'google/chirp-3';

	/** @var string Per-request OpenRouter key from client header/body. */
	private static $request_api_key = '';

	public static function use_request_api_key( string $key ): void {
		self::$request_api_key = trim( $key );
	}

	public static function clear_request_api_key(): void {
		self::$request_api_key = '';
	}

	/**
	 * @param array<string,mixed> $body
	 */
	public static function api_key_from_request( array $body = array() ): string {
		$header = isset( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] )
			? trim( (string) wp_unslash( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) )
			: '';
		if ( $header !== '' ) {
			return $header;
		}
		if ( ! empty( $body['openRouterApiKey'] ) && is_string( $body['openRouterApiKey'] ) ) {
			$body_key = trim( $body['openRouterApiKey'] );
			if ( $body_key !== '' ) {
				return $body_key;
			}
		}
		return self::resolve_key();
	}

	/**
	 * @param array<int,array{role:string,content:string}> $messages
	 */
	public static function chat_text( array $messages, array $opts = array() ): string {
		$api_key = self::resolve_key();
		if ( $api_key === '' ) {
			return '';
		}

		$model = isset( $opts['model'] ) && is_string( $opts['model'] ) && trim( $opts['model'] ) !== ''
			? trim( $opts['model'] )
			: self::DEFAULT_MODEL;

		$response = wp_remote_post(
			self::CHAT_URL,
			array(
				'timeout' => 90,
				'headers' => Flowbie_App_Openrouter_Attribution::request_headers( $api_key ),
				'body'    => wp_json_encode(
					array(
						'model'       => $model,
						'messages'    => $messages,
						'temperature' => isset( $opts['temperature'] ) ? (float) $opts['temperature'] : 0.4,
						'max_tokens'  => isset( $opts['maxTokens'] ) ? (int) $opts['maxTokens'] : 1024,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return '';
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $json ) ) {
			return '';
		}

		return trim( (string) ( $json['choices'][0]['message']['content'] ?? '' ) );
	}

	public static function transcribe_audio( string $base64, string $format = 'webm' ): string {
		$api_key = self::resolve_key();
		if ( $api_key === '' || $base64 === '' ) {
			return '';
		}

		$format = strtolower( preg_replace( '/[^a-z0-9]/', '', $format ) );
		$allowed = array( 'webm', 'wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac' );
		if ( ! in_array( $format, $allowed, true ) ) {
			$format = 'webm';
		}

		$response = wp_remote_post(
			self::TRANSCRIBE_URL,
			array(
				'timeout' => 120,
				'headers' => Flowbie_App_Openrouter_Attribution::request_headers( $api_key ),
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
			return '';
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $json ) ) {
			return '';
		}

		return trim( (string) ( $json['text'] ?? '' ) );
	}

	private static function resolve_key(): string {
		if ( self::$request_api_key !== '' ) {
			return self::$request_api_key;
		}
		if ( class_exists( 'Flowbie_App_Secrets' ) ) {
			$key = trim( Flowbie_App_Secrets::openrouter_api_key() );
			if ( $key !== '' ) {
				return $key;
			}
		}
		if ( class_exists( 'Flowbie_Wp_OpenRouter' ) ) {
			$key = trim( Flowbie_Wp_OpenRouter::get_api_key() );
			if ( $key !== '' ) {
				return $key;
			}
		}
		return '';
	}
}

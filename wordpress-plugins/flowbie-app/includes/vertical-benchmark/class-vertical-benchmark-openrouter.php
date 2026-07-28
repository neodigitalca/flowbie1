<?php
/**
 * OpenRouter JSON completions for vertical benchmark.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Vertical_Benchmark_Openrouter {

	const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
	const DEFAULT_MODEL  = 'google/gemini-2.5-flash-lite';

	/**
	 * @param array<int,array{role:string,content:string}> $messages
	 * @param array{apiKey?:string,model?:string,temperature?:float,maxTokens?:int} $opts
	 * @return array<string,mixed>
	 */
	public static function json_completion( array $messages, array $opts = array() ): array {
		$api_key = self::resolve_key( $opts['apiKey'] ?? '' );
		if ( $api_key === '' ) {
			throw new Exception( 'OpenRouter API key is missing. Set OPENROUTER_API_KEY or pass X-OpenRouter-Api-Key.' );
		}

		$model = isset( $opts['model'] ) && is_string( $opts['model'] ) && trim( $opts['model'] ) !== ''
			? trim( $opts['model'] )
			: ( defined( 'FLOWBIE_APP_EMAIL_AGENT_MODEL' ) ? (string) FLOWBIE_APP_EMAIL_AGENT_MODEL : self::DEFAULT_MODEL );

		$response = wp_remote_post(
			self::OPENROUTER_URL,
			array(
				'timeout' => 120,
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $api_key,
					'HTTP-Referer'  => defined( 'FLOWBIE_APP_FRONTEND_URL' ) ? (string) FLOWBIE_APP_FRONTEND_URL : 'https://flowbie.ca',
					'X-Title'       => 'Flowbie Vertical Benchmark',
				),
				'body'    => wp_json_encode(
					array(
						'model'           => $model,
						'messages'        => $messages,
						'temperature'     => isset( $opts['temperature'] ) ? (float) $opts['temperature'] : 0.2,
						'max_tokens'      => isset( $opts['maxTokens'] ) ? (int) $opts['maxTokens'] : 4096,
						'response_format' => array( 'type' => 'json_object' ),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new Exception( $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $json ) ? ( $json['error']['message'] ?? $json['message'] ?? 'OpenRouter error' ) : 'OpenRouter error';
			throw new Exception( 'OpenRouter ' . $code . ': ' . $msg );
		}

		$content = trim( (string) ( $json['choices'][0]['message']['content'] ?? '' ) );
		if ( $content === '' ) {
			throw new Exception( 'OpenRouter returned empty content' );
		}

		$parsed = json_decode( $content, true );
		if ( ! is_array( $parsed ) ) {
			throw new Exception( 'OpenRouter response was not valid JSON' );
		}
		return $parsed;
	}

	public static function resolve_key( string $override = '' ): string {
		$key = trim( $override );
		if ( $key !== '' ) {
			return $key;
		}
		$header = isset( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ? trim( (string) wp_unslash( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ) : '';
		if ( $header !== '' ) {
			return $header;
		}
		return trim( Flowbie_App_Secrets::openrouter_api_key() );
	}
}

<?php
/**
 * POST /api/openrouter/chat-completion (JSON or SSE stream).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Openrouter_Chat_Completion_Route {

	/**
	 * @param string               $subpath Path after openrouter/.
	 * @param string               $method  HTTP method.
	 * @param array<string,mixed>  $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		if ( $subpath === 'chat-completion' && $method === 'POST' ) {
			self::chat_completion( $body );
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'    => false,
				'error' => 'Not found',
				'path'  => 'openrouter/' . $subpath,
			),
			404
		);
	}

	/**
	 * @param array<string,mixed> $body Request JSON.
	 */
	public static function chat_completion( array $body ): void {
		$api_key = isset( $body['apiKey'] ) ? trim( (string) $body['apiKey'] ) : '';
		if ( $api_key === '' && isset( $body['openRouterApiKey'] ) ) {
			$api_key = trim( (string) $body['openRouterApiKey'] );
		}
		if ( $api_key !== '' && class_exists( 'Neo_Pulse_App_Chat_Openrouter' ) ) {
			Neo_Pulse_App_Chat_Openrouter::use_request_api_key( $api_key );
		}

		$resolved = class_exists( 'Neo_Pulse_App_Chat_Openrouter' )
			? Neo_Pulse_App_Chat_Openrouter::api_key_from_request( $body )
			: '';
		if ( $resolved === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => 'OpenRouter API key is missing. Add it in Dashboard → API Keys.',
				),
				500
			);
			return;
		}

		$messages = self::normalize_messages( $body );
		if ( count( $messages ) === 0 ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => 'messages, or system and user, are required',
				),
				400
			);
			return;
		}

		$model = isset( $body['model'] ) ? trim( (string) $body['model'] ) : '';
		if ( $model === '' && class_exists( 'Neo_Pulse_App_Chat_Openrouter' ) ) {
			$model = Neo_Pulse_App_Chat_Openrouter::DEFAULT_MODEL;
		}

		$payload = array(
			'model'       => $model,
			'messages'    => $messages,
			'temperature' => isset( $body['temperature'] ) ? (float) $body['temperature'] : 0.5,
			'max_tokens'  => isset( $body['maxTokens'] ) ? (int) $body['maxTokens'] : ( isset( $body['max_tokens'] ) ? (int) $body['max_tokens'] : 8192 ),
			'stream'      => ! empty( $body['stream'] ),
		);
		if ( isset( $body['topP'] ) ) {
			$payload['top_p'] = (float) $body['topP'];
		} elseif ( isset( $body['top_p'] ) ) {
			$payload['top_p'] = (float) $body['top_p'];
		}
		if ( isset( $body['responseFormat'] ) && is_array( $body['responseFormat'] ) ) {
			$payload['response_format'] = $body['responseFormat'];
		} elseif ( isset( $body['response_format'] ) && is_array( $body['response_format'] ) ) {
			$payload['response_format'] = $body['response_format'];
		}
		if ( isset( $body['modalities'] ) && is_array( $body['modalities'] ) ) {
			$payload['modalities'] = $body['modalities'];
		}
		if ( isset( $body['size'] ) && is_string( $body['size'] ) && trim( $body['size'] ) !== '' ) {
			$payload['size'] = trim( $body['size'] );
		}
		if ( isset( $body['tools'] ) && is_array( $body['tools'] ) ) {
			$payload['tools'] = $body['tools'];
		}
		if ( isset( $body['tool_choice'] ) ) {
			$payload['tool_choice'] = $body['tool_choice'];
		} elseif ( isset( $body['toolChoice'] ) ) {
			$payload['tool_choice'] = $body['toolChoice'];
		}
		if ( isset( $body['webSearchOptions'] ) && is_array( $body['webSearchOptions'] ) ) {
			$payload['web_search_options'] = $body['webSearchOptions'];
		} elseif ( isset( $body['web_search_options'] ) && is_array( $body['web_search_options'] ) ) {
			$payload['web_search_options'] = $body['web_search_options'];
		}

		if ( ! empty( $payload['stream'] ) ) {
			self::stream_openrouter( $payload, $resolved );
			return;
		}

		try {
			$result = self::json_openrouter( $payload, $resolved );
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'                 => true,
					'content'            => $result['content'],
					'finishReason'       => $result['finishReason'],
					'nativeFinishReason' => $result['nativeFinishReason'],
					'raw'                => $result['raw'],
				)
			);
		} catch ( Exception $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => $e->getMessage(),
				),
				500
			);
		}
	}

	/**
	 * @param array<string,mixed> $body Request JSON.
	 * @return array<int,array<string,mixed>>
	 */
	private static function normalize_messages( array $body ): array {
		if ( isset( $body['messages'] ) && is_array( $body['messages'] ) && count( $body['messages'] ) > 0 ) {
			$out = array();
			foreach ( $body['messages'] as $msg ) {
				if ( ! is_array( $msg ) ) {
					continue;
				}
				$role = isset( $msg['role'] ) ? trim( (string) $msg['role'] ) : '';
				if ( $role === '' ) {
					continue;
				}
				$content = $msg['content'] ?? null;
				$entry   = array(
					'role'    => $role,
					'content' => is_array( $content ) ? $content : ( $content === null ? null : (string) $content ),
				);
				if ( isset( $msg['tool_calls'] ) && is_array( $msg['tool_calls'] ) ) {
					$entry['tool_calls'] = $msg['tool_calls'];
				}
				if ( isset( $msg['tool_call_id'] ) && is_string( $msg['tool_call_id'] ) && $msg['tool_call_id'] !== '' ) {
					$entry['tool_call_id'] = $msg['tool_call_id'];
				}
				if ( isset( $msg['name'] ) && is_string( $msg['name'] ) && $msg['name'] !== '' ) {
					$entry['name'] = $msg['name'];
				}
				$out[] = $entry;
			}
			return $out;
		}
		$system = isset( $body['system'] ) ? trim( (string) $body['system'] ) : '';
		$user   = isset( $body['user'] ) ? trim( (string) $body['user'] ) : '';
		if ( $system === '' || $user === '' ) {
			return array();
		}
		return array(
			array(
				'role'    => 'system',
				'content' => $system,
			),
			array(
				'role'    => 'user',
				'content' => $user,
			),
		);
	}

	/**
	 * @param array<string,mixed> $payload OpenRouter body.
	 * @param string              $api_key Key.
	 * @return array{content:string,finishReason:?string,nativeFinishReason:?string,raw:array<string,mixed>|null}
	 */
	private static function json_openrouter( array $payload, string $api_key ): array {
		$response = wp_remote_post(
			Neo_Pulse_App_Chat_Openrouter::CHAT_URL,
			array(
				'timeout' => 300,
				'headers' => Neo_Pulse_App_Openrouter_Attribution::request_headers( $api_key ),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new Exception( $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $raw ) ? ( $raw['error']['message'] ?? $raw['message'] ?? 'OpenRouter error' ) : 'OpenRouter error';
			throw new Exception( 'OpenRouter ' . $code . ': ' . $msg );
		}

		$content = trim( (string) ( $raw['choices'][0]['message']['content'] ?? '' ) );
		$tool_calls = $raw['choices'][0]['message']['tool_calls'] ?? null;
		$has_tool_calls = is_array( $tool_calls ) && count( $tool_calls ) > 0;
		if ( $content === '' && ! $has_tool_calls && empty( $raw['choices'][0]['message']['images'] ) && empty( $payload['modalities'] ) ) {
			throw new Exception( 'OpenRouter returned empty content' );
		}

		return array(
			'content'            => $content,
			'finishReason'       => isset( $raw['choices'][0]['finish_reason'] ) ? (string) $raw['choices'][0]['finish_reason'] : null,
			'nativeFinishReason' => isset( $raw['choices'][0]['native_finish_reason'] ) ? (string) $raw['choices'][0]['native_finish_reason'] : null,
			'raw'                => is_array( $raw ) ? $raw : null,
		);
	}

	/**
	 * @param array<string,mixed> $payload OpenRouter body.
	 * @param string              $api_key Key.
	 */
	private static function stream_openrouter( array $payload, string $api_key ): void {
		if ( ! function_exists( 'curl_init' ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => 'OpenRouter streaming requires curl',
				),
				500
			);
			return;
		}

		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		@set_time_limit( 300 );
		ignore_user_abort( true );
		status_header( 200 );
		header( 'Content-Type: text/event-stream' );
		header( 'Cache-Control: no-cache' );
		header( 'X-Accel-Buffering: no' );

		$headers = Neo_Pulse_App_Openrouter_Attribution::request_headers( $api_key );
		$curl_headers = array();
		foreach ( $headers as $name => $value ) {
			$curl_headers[] = $name . ': ' . $value;
		}

		$ch = curl_init( Neo_Pulse_App_Chat_Openrouter::CHAT_URL );
		if ( $ch === false ) {
			echo "data: " . wp_json_encode( array( 'error' => array( 'message' => 'Could not start OpenRouter stream' ) ) ) . "\n\n";
			return;
		}

		curl_setopt( $ch, CURLOPT_POST, true );
		curl_setopt( $ch, CURLOPT_HTTPHEADER, $curl_headers );
		curl_setopt( $ch, CURLOPT_POSTFIELDS, wp_json_encode( $payload ) );
		curl_setopt( $ch, CURLOPT_TIMEOUT, 300 );
		curl_setopt( $ch, CURLOPT_RETURNTRANSFER, false );
		curl_setopt(
			$ch,
			CURLOPT_WRITEFUNCTION,
			static function ( $ch, $data ) {
				echo $data;
				if ( function_exists( 'flush' ) ) {
					flush();
				}
				return strlen( $data );
			}
		);

		curl_exec( $ch );
		curl_close( $ch );
	}
}

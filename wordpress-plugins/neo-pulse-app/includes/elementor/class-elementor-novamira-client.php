<?php
/**
 * Novamira MCP JSON-RPC client for a remote WordPress site.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Elementor_Novamira_Client {

	/**
	 * @param string $site_url
	 * @param string $username
	 * @param string $app_password
	 * @return array{name:string,description?:string,inputSchema?:mixed}[]
	 */
	public static function list_tools( $site_url, $username, $app_password ) {
		self::initialize( $site_url, $username, $app_password );
		$result = self::rpc( $site_url, $username, $app_password, 'tools/list', array() );
		$tools  = isset( $result['tools'] ) && is_array( $result['tools'] ) ? $result['tools'] : array();
		$out    = array();
		foreach ( $tools as $tool ) {
			if ( ! is_array( $tool ) || empty( $tool['name'] ) ) {
				continue;
			}
			$out[] = array(
				'name'        => (string) $tool['name'],
				'description' => isset( $tool['description'] ) ? (string) $tool['description'] : '',
				'inputSchema' => $tool['inputSchema'] ?? ( $tool['input_schema'] ?? null ),
			);
		}
		return $out;
	}

	/**
	 * @param string               $site_url
	 * @param string               $username
	 * @param string               $app_password
	 * @param string               $name
	 * @param array<string,mixed>  $arguments
	 * @return mixed
	 */
	public static function call_tool( $site_url, $username, $app_password, $name, array $arguments ) {
		self::initialize( $site_url, $username, $app_password );
		return self::rpc(
			$site_url,
			$username,
			$app_password,
			'tools/call',
			array(
				'name'      => $name,
				'arguments' => $arguments,
			)
		);
	}

	/**
	 * @param array<int,array{name:string,inputSchema?:mixed}> $tools
	 * @param string[]                                           $needles
	 * @return array{name:string,inputSchema?:mixed}|null
	 */
	public static function find_tool( array $tools, array $needles ) {
		foreach ( $tools as $tool ) {
			$name = strtolower( (string) $tool['name'] );
			foreach ( $needles as $needle ) {
				if ( $name === strtolower( $needle ) || substr( $name, -strlen( $needle ) ) === strtolower( $needle ) ) {
					return $tool;
				}
			}
		}
		return null;
	}

	/**
	 * @param array{name:string,inputSchema?:mixed} $tool
	 * @param string                                $code
	 * @return array<string,mixed>
	 */
	public static function execute_php_arguments( array $tool, $code ) {
		$schema = isset( $tool['inputSchema'] ) && is_array( $tool['inputSchema'] ) ? $tool['inputSchema'] : array();
		$props  = isset( $schema['properties'] ) && is_array( $schema['properties'] ) ? $schema['properties'] : array();
		foreach ( array( 'code', 'php', 'script', 'source' ) as $key ) {
			if ( isset( $props[ $key ] ) ) {
				return array( $key => $code );
			}
		}
		$keys = array_keys( $props );
		if ( count( $keys ) === 1 ) {
			return array( $keys[0] => $code );
		}
		return array( 'code' => $code );
	}

	/**
	 * @param mixed $result
	 * @return string
	 */
	public static function tool_text( $result ) {
		if ( is_string( $result ) ) {
			return $result;
		}
		if ( ! is_array( $result ) ) {
			return wp_json_encode( $result );
		}
		if ( isset( $result['structuredContent'] ) && is_array( $result['structuredContent'] ) ) {
			return wp_json_encode( $result['structuredContent'] );
		}
		if ( isset( $result['content'] ) && is_array( $result['content'] ) ) {
			$chunks = array();
			foreach ( $result['content'] as $part ) {
				if ( is_array( $part ) && isset( $part['text'] ) ) {
					$chunks[] = (string) $part['text'];
				}
			}
			if ( $chunks ) {
				return implode( "\n", $chunks );
			}
		}
		return wp_json_encode( $result );
	}

	/**
	 * Unwrap execute-ability + execute-php into the PHP return/output payload.
	 *
	 * @param mixed $result
	 * @return mixed
	 */
	public static function unwrap_execute_php( $result ) {
		$text = trim( self::tool_text( $result ) );
		if ( $text === '' ) {
			throw new RuntimeException( 'Novamira execute PHP returned empty output.' );
		}
		$decoded = json_decode( $text, true );
		$payload = is_array( $decoded ) ? $decoded : $text;
		if ( is_array( $payload ) && array_key_exists( 'data', $payload ) && is_array( $payload['data'] ) ) {
			$payload = $payload['data'];
		}
		if ( is_array( $payload ) && isset( $payload['success'] ) && $payload['success'] === false ) {
			$msg = isset( $payload['error_message'] ) ? (string) $payload['error_message'] : '';
			if ( $msg === '' && isset( $payload['error'] ) ) {
				$msg = (string) $payload['error'];
			}
			throw new RuntimeException( $msg !== '' ? $msg : 'Novamira execute PHP failed.' );
		}
		if ( is_array( $payload ) && array_key_exists( 'return_value', $payload ) ) {
			return $payload['return_value'];
		}
		if ( is_array( $payload ) && isset( $payload['output'] ) && is_string( $payload['output'] ) && $payload['output'] !== '' ) {
			$inner = json_decode( $payload['output'], true );
			return is_array( $inner ) ? $inner : $payload['output'];
		}
		if ( is_numeric( $text ) ) {
			return (int) $text;
		}
		return $payload;
	}

	/** @var array<string,string> */
	private static $sessions = array();

	/**
	 * @param string $site_url
	 * @param string $username
	 * @param string $app_password
	 */
	private static function initialize( $site_url, $username, $app_password ) {
		$key = $site_url . '|' . $username;
		if ( isset( self::$sessions[ $key ] ) && self::$sessions[ $key ] !== '' ) {
			return;
		}
		$response = self::rpc_response(
			$site_url,
			$username,
			$app_password,
			'initialize',
			array(
				'protocolVersion' => '2025-03-26',
				'capabilities'    => array(),
				'clientInfo'      => array(
					'name'    => 'neo-pulse-app',
					'version' => '1.0',
				),
			)
		);
		$headers = isset( $response['headers'] ) && is_array( $response['headers'] ) ? $response['headers'] : array();
		$sid     = isset( $headers['mcp-session-id'] ) ? trim( (string) $headers['mcp-session-id'] ) : '';
		if ( $sid === '' ) {
			throw new RuntimeException( 'Novamira MCP did not return a session id.' );
		}
		self::$sessions[ $key ] = $sid;
	}

	/**
	 * @param string              $site_url
	 * @param string              $username
	 * @param string              $app_password
	 * @param string              $method
	 * @param array<string,mixed> $params
	 * @return mixed
	 */
	private static function rpc( $site_url, $username, $app_password, $method, array $params ) {
		$response = self::rpc_response( $site_url, $username, $app_password, $method, $params );
		return $response['result'];
	}

	/**
	 * @param string              $site_url
	 * @param string              $username
	 * @param string              $app_password
	 * @param string              $method
	 * @param array<string,mixed> $params
	 * @return array{result:mixed,headers:array<string,string>}
	 */
	private static function rpc_response( $site_url, $username, $app_password, $method, array $params ) {
		$origin = Neo_Pulse_App_Wp_Url_Normalize::normalize_url( $site_url );
		$url    = $origin . '/wp-json/mcp/novamira';
		$key    = $site_url . '|' . $username;
		$body   = array(
			'jsonrpc' => '2.0',
			'id'      => wp_generate_uuid4(),
			'method'  => $method,
			'params'  => $params,
		);
		$headers = array(
			'Accept' => 'application/json, text/event-stream',
		);
		if ( $method !== 'initialize' && ! empty( self::$sessions[ $key ] ) ) {
			$headers['Mcp-Session-Id'] = self::$sessions[ $key ];
		}
		$response = Neo_Pulse_App_Wp_Rest_Client::request(
			'POST',
			$url,
			$username,
			$app_password,
			array(
				'timeout'      => 60,
				'body'         => wp_json_encode( $body ),
				'content_type' => 'application/json',
				'accept'       => 'application/json, text/event-stream',
				'headers'      => $headers,
			)
		);
		if ( ! empty( $response['is_wp_error'] ) ) {
			throw new RuntimeException( $response['error'] ? (string) $response['error'] : 'Novamira MCP request failed.' );
		}
		$status = (int) $response['status'];
		if ( $status < 200 || $status >= 300 ) {
			throw new RuntimeException( 'Novamira MCP returned HTTP ' . $status . '.' );
		}
		$decoded = self::decode_payload( $response['raw'], $response['body'] );
		if ( isset( $decoded['error'] ) ) {
			$err = $decoded['error'];
			$msg = is_array( $err ) && isset( $err['message'] ) ? (string) $err['message'] : 'Novamira MCP error.';
			throw new RuntimeException( $msg );
		}
		return array(
			'result'  => $decoded['result'] ?? $decoded,
			'headers' => isset( $response['headers'] ) && is_array( $response['headers'] ) ? $response['headers'] : array(),
		);
	}

	/**
	 * @param string $raw
	 * @param mixed  $body
	 * @return array<string,mixed>
	 */
	private static function decode_payload( $raw, $body ) {
		if ( is_array( $body ) ) {
			return $body;
		}
		$text = is_string( $body ) && $body !== '' ? $body : (string) $raw;
		$trim = trim( $text );
		if ( str_starts_with( $trim, 'data:' ) || str_contains( $trim, "\ndata:" ) ) {
			$chunks = array();
			foreach ( preg_split( '/\r?\n/', $trim ) as $line ) {
				if ( str_starts_with( $line, 'data:' ) ) {
					$chunks[] = trim( substr( $line, 5 ) );
				}
			}
			$trim = implode( '', $chunks );
		}
		$decoded = json_decode( $trim, true );
		if ( ! is_array( $decoded ) ) {
			throw new RuntimeException( 'Novamira MCP returned invalid JSON.' );
		}
		return $decoded;
	}
}

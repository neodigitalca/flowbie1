<?php
/**
 * AgentMail REST API helpers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agentmail_Api {

	private const API_BASE = 'https://api.agentmail.to/v0';

	public static function api_key(): string {
		return class_exists( 'Neo_Pulse_App_Secrets' ) ? Neo_Pulse_App_Secrets::agentmail_api_key() : '';
	}

	public static function default_inbox(): string {
		return class_exists( 'Neo_Pulse_App_Secrets' ) ? Neo_Pulse_App_Secrets::agentmail_inbox() : '';
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_message( string $inbox, string $message_id ): ?array {
		$inbox = trim( $inbox );
		$message_id = trim( $message_id );
		if ( $inbox === '' || $message_id === '' ) {
			return null;
		}
		$path = '/inboxes/' . rawurlencode( $inbox ) . '/messages/' . rawurlencode( $message_id );
		$data = self::request( 'GET', $path );
		return is_array( $data ) ? $data : null;
	}

	/**
	 * @return string Binary attachment bytes or empty string.
	 */
	public static function download_attachment( string $inbox, string $message_id, string $attachment_id ): string {
		$inbox = trim( $inbox );
		$message_id = trim( $message_id );
		$attachment_id = trim( $attachment_id );
		if ( $inbox === '' || $message_id === '' || $attachment_id === '' ) {
			return '';
		}
		$path = '/inboxes/' . rawurlencode( $inbox ) . '/messages/' . rawurlencode( $message_id ) . '/attachments/' . rawurlencode( $attachment_id );
		return self::request_raw( 'GET', $path );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function request( string $method, string $path ): ?array {
		$api_key = self::api_key();
		if ( $api_key === '' ) {
			return null;
		}
		$url  = self::API_BASE . $path;
		$args = array(
			'method'  => strtoupper( $method ),
			'timeout' => 30,
			'headers' => array(
				'Authorization' => 'Bearer ' . $api_key,
				'Accept'        => 'application/json',
			),
		);
		$res = wp_remote_request( $url, $args );
		if ( is_wp_error( $res ) ) {
			return null;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		$body = (string) wp_remote_retrieve_body( $res );
		if ( $code < 200 || $code >= 300 || $body === '' ) {
			return null;
		}
		$data = json_decode( $body, true );
		return is_array( $data ) ? $data : null;
	}

	private static function request_raw( string $method, string $path ): string {
		$api_key = self::api_key();
		if ( $api_key === '' ) {
			return '';
		}
		$url  = self::API_BASE . $path;
		$args = array(
			'method'  => strtoupper( $method ),
			'timeout' => 60,
			'headers' => array(
				'Authorization' => 'Bearer ' . $api_key,
				'Accept'        => 'application/octet-stream',
			),
		);
		$res = wp_remote_request( $url, $args );
		if ( is_wp_error( $res ) ) {
			return '';
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		if ( $code < 200 || $code >= 300 ) {
			return '';
		}
		return (string) wp_remote_retrieve_body( $res );
	}

	public static function normalize_sender( string $raw ): string {
		$raw = strtolower( trim( $raw ) );
		if ( preg_match( '/<([^>]+)>/', $raw, $m ) ) {
			return sanitize_email( $m[1] );
		}
		return sanitize_email( $raw );
	}

	/**
	 * @param array<string,mixed> $message
	 * @return string
	 */
	public static function extract_sender( array $message ): string {
		if ( isset( $message['from_'] ) && is_array( $message['from_'] ) && ! empty( $message['from_'][0] ) ) {
			return self::normalize_sender( (string) $message['from_'][0] );
		}
		if ( isset( $message['from'] ) && is_string( $message['from'] ) ) {
			return self::normalize_sender( $message['from'] );
		}
		return '';
	}

	public static function message_storage_key( string $message_id ): string {
		return md5( strtolower( trim( $message_id ) ) );
	}
}

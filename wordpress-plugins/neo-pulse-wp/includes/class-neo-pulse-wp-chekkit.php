<?php
/**
 * Chekkit Events webhook client.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chekkit {

	const REQUEST_TIMEOUT = 15;

	const DEFAULT_WEBHOOK_URL = 'https://neodigital.ca/webhook';

	/**
	 * Chekkit Events webhook URL from env (server-side only).
	 */
	public static function get_webhook_url(): string {
		if ( defined( 'NEO_PULSE_WP_CHEKKIT_WEBHOOK_URL' ) && NEO_PULSE_WP_CHEKKIT_WEBHOOK_URL !== '' ) {
			return trim( (string) NEO_PULSE_WP_CHEKKIT_WEBHOOK_URL );
		}

		$stored = function_exists( 'get_option' ) ? get_option( 'neo_pulse_wp_chat_settings', array() ) : array();
		if ( is_array( $stored ) && isset( $stored['chekkit_webhook_url'] ) ) {
			$url = esc_url_raw( trim( (string) $stored['chekkit_webhook_url'] ) );
			if ( $url !== '' ) {
				return $url;
			}
		}

		return self::DEFAULT_WEBHOOK_URL;
	}

	public static function is_configured(): bool {
		return self::get_webhook_url() !== '';
	}

	/**
	 * POST contact payload to Chekkit Events webhook.
	 *
	 * @param array<string,mixed> $data
	 * @return true|WP_Error
	 */
	public static function send_contact( array $data ) {
		$url = self::get_webhook_url();
		if ( $url === '' ) {
			return new WP_Error(
				'chekkit_not_configured',
				__( 'Chekkit webhook is not configured.', 'neo-pulse-wp' )
			);
		}

		$response = wp_remote_post(
			$url,
			array(
				'timeout' => self::REQUEST_TIMEOUT,
				'headers' => array(
					'Content-Type' => 'application/json; charset=utf-8',
					'Accept'       => 'application/json',
				),
				'body'    => wp_json_encode( $data ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 300 ) {
			$raw = wp_remote_retrieve_body( $response );
			$msg = $raw !== '' ? $raw : sprintf( 'HTTP %d', $code );
			return new WP_Error( 'chekkit_http', $msg, array( 'status' => $code ) );
		}

		return true;
	}

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,string>|null Field errors keyed by field name.
	 */
	public static function validate_contact_input( array $input ): ?array {
		$errors = array();

		$name = isset( $input['name'] ) ? trim( (string) $input['name'] ) : '';
		if ( $name === '' ) {
			$errors['name'] = __( 'Name is required.', 'neo-pulse-wp' );
		} elseif ( strlen( $name ) > 120 ) {
			$errors['name'] = __( 'Name is too long.', 'neo-pulse-wp' );
		}

		$phone = isset( $input['phone'] ) ? trim( (string) $input['phone'] ) : '';
		if ( $phone === '' ) {
			$errors['phone'] = __( 'Phone is required.', 'neo-pulse-wp' );
		} elseif ( strlen( $phone ) > 40 ) {
			$errors['phone'] = __( 'Phone is too long.', 'neo-pulse-wp' );
		}

		$email = isset( $input['email'] ) ? trim( (string) $input['email'] ) : '';
		if ( $email !== '' && ! is_email( $email ) ) {
			$errors['email'] = __( 'Enter a valid email address.', 'neo-pulse-wp' );
		}

		$message = isset( $input['message'] ) ? trim( (string) $input['message'] ) : '';
		if ( strlen( $message ) > 2000 ) {
			$errors['message'] = __( 'Message is too long.', 'neo-pulse-wp' );
		}

		return empty( $errors ) ? null : $errors;
	}

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,string>
	 */
	public static function build_payload( array $input, string $event_type ): array {
		$name    = isset( $input['name'] ) ? sanitize_text_field( (string) $input['name'] ) : '';
		$phone   = isset( $input['phone'] ) ? sanitize_text_field( (string) $input['phone'] ) : '';
		$email   = isset( $input['email'] ) ? sanitize_email( (string) $input['email'] ) : '';
		$message = isset( $input['message'] ) ? sanitize_textarea_field( (string) $input['message'] ) : '';

		$source_url = '';
		if ( isset( $input['source_url'] ) ) {
			$source_url = esc_url_raw( (string) $input['source_url'] );
		} elseif ( isset( $_SERVER['HTTP_REFERER'] ) ) {
			$source_url = esc_url_raw( wp_unslash( (string) $_SERVER['HTTP_REFERER'] ) );
		}

		$payload = array(
			'name'       => $name,
			'phone'      => $phone,
			'event_type' => sanitize_key( $event_type ) !== '' ? sanitize_key( $event_type ) : 'contact_request',
		);

		if ( $email !== '' ) {
			$payload['email'] = $email;
		}
		if ( $message !== '' ) {
			$payload['message'] = $message;
		}
		if ( $source_url !== '' ) {
			$payload['source_url'] = $source_url;
		}

		return $payload;
	}
}

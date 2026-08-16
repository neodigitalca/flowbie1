<?php
/**
 * Chekkit hub: inbound messaging + contact form forward to Events webhook.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Chekkit_Webhook {

	const REQUEST_TIMEOUT = 15;

	/**
	 * @param array<string,mixed> $body
	 */
	public static function handle( string $method, array $body ): void {
		if ( $method !== 'POST' ) {
			self::send_json(
				array(
					'success' => false,
					'message' => 'Method not allowed.',
				),
				405
			);
			return;
		}

		if ( self::is_chekkit_message_event( $body ) ) {
			self::handle_inbound_message( $body );
			return;
		}

		self::handle_contact_submission( $body );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function is_chekkit_message_event( array $body ): bool {
		$event_type = isset( $body['eventType'] ) ? (string) $body['eventType'] : '';
		if ( $event_type === 'message.inbound' || $event_type === 'message.outbound' ) {
			return true;
		}
		if ( isset( $body['source'], $body['message'] ) && ! isset( $body['event_type'] ) ) {
			return true;
		}
		return false;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function handle_inbound_message( array $body ): void {
		$dir  = Neo_Pulse_App_Data_Paths::subdir( 'chekkit-messages' );
		$path = $dir . '/inbound.jsonl';
		$line = wp_json_encode(
			array(
				'received_at' => gmdate( 'c' ),
				'payload'     => $body,
			)
		);
		if ( is_string( $line ) ) {
			file_put_contents( $path, $line . "\n", FILE_APPEND | LOCK_EX );
		}
		self::send_json( array( 'ok' => true ), 200 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function handle_contact_submission( array $body ): void {
		$name  = isset( $body['name'] ) ? trim( (string) $body['name'] ) : '';
		$phone = isset( $body['phone'] ) ? trim( (string) $body['phone'] ) : '';
		if ( $name === '' || $phone === '' ) {
			self::send_json(
				array(
					'success' => false,
					'message' => 'Name and phone are required.',
				),
				400
			);
			return;
		}

		$form_email = trim( Neo_Pulse_App_Secrets::chekkit_form_email() );
		if ( $form_email === '' ) {
			self::send_json(
				array(
					'success' => false,
					'message' => 'Contact form is not configured.',
				),
				503
			);
			return;
		}

		$lines = array(
			'Name: ' . $name,
			'Phone: ' . $phone,
		);
		$email = isset( $body['email'] ) ? trim( (string) $body['email'] ) : '';
		if ( $email !== '' ) {
			$lines[] = 'Email: ' . $email;
		}
		$message = isset( $body['message'] ) ? trim( (string) $body['message'] ) : '';
		if ( $message !== '' ) {
			$lines[] = 'Message: ' . $message;
		}
		$source_url = isset( $body['source_url'] ) ? trim( (string) $body['source_url'] ) : '';
		if ( $source_url !== '' ) {
			$lines[] = 'Source: ' . $source_url;
		}
		$subject = 'Website contact request from ' . $name;
		$body_text = implode( "\n", $lines );

		register_shutdown_function(
			static function () use ( $form_email, $subject, $body_text ) {
				Neo_Pulse_App_Chekkit_Webhook::send_chekkit_form_email( $form_email, $subject, $body_text );
			}
		);

		self::send_json(
			array(
				'success' => true,
				'message' => "Thanks! We'll be in touch soon.",
			),
			200
		);
	}

	/**
	 * Send to Chekkit Website Form address. PHP mail() only — not wp_mail, not AgentMail.
	 */
	public static function send_chekkit_form_email( string $to, string $subject, string $message ): bool {
		$to = sanitize_email( $to );
		if ( $to === '' ) {
			return false;
		}
		$subject = wp_strip_all_tags( $subject );
		$from    = 'noreply@neodigital.ca';
		$headers = 'From: ' . $from . "\r\n" . 'Content-Type: text/plain; charset=UTF-8';
		return (bool) @mail( $to, $subject, $message, $headers );
	}

	/**
	 * @param array<string,mixed> $data
	 */
	private static function send_json( array $data, int $status ): void {
		status_header( $status );
		header( 'Content-Type: application/json; charset=utf-8' );
		if ( defined( 'NEO_PULSE_APP_VERSION' ) ) {
			header( 'X-NEO Pulse-Webhook-Version: ' . NEO_PULSE_APP_VERSION );
		}
		echo wp_json_encode( $data );
	}
}

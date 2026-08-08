<?php
/**
 * Team transactional mail (AgentMail, SMTP, or wp_mail) with explicit errors.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Mail {

	/**
	 * @return array{ok:bool,error?:string,transport?:string}
	 */
	public static function send( string $to, string $subject, string $message ): array {
		$to = sanitize_email( strtolower( trim( $to ) ) );
		if ( $to === '' || ! is_email( $to ) ) {
			return array( 'ok' => false, 'error' => 'Invalid email address' );
		}

		$agentmail_key = Flowbie_App_Secrets::agentmail_api_key();
		if ( $agentmail_key !== '' ) {
			return self::send_via_agentmail( $agentmail_key, $to, $subject, $message );
		}

		$smtp = Flowbie_App_Secrets::smtp();
		if ( $smtp['host'] !== '' ) {
			return self::send_via_wp_mail( $to, $subject, $message, $smtp, 'smtp' );
		}

		$result = self::send_via_wp_mail( $to, $subject, $message, null, 'wp_mail' );
		if ( ! $result['ok'] ) {
			$result['error'] = $result['error'] . ' Save AgentMail API key in Dashboard → API Keys, or set FLOWBIE_APP_SMTP_HOST in wp-config.';
		}
		return $result;
	}

	/**
	 * @return array{ok:bool,error?:string,transport?:string}
	 */
	private static function send_via_agentmail( string $api_key, string $to, string $subject, string $message ): array {
		$inbox = Flowbie_App_Secrets::agentmail_inbox();
		if ( $inbox === '' || ! is_email( $inbox ) ) {
			return array( 'ok' => false, 'error' => 'AgentMail inbox not configured. Set general email in API Keys.' );
		}

		$url  = 'https://api.agentmail.to/v0/inboxes/' . rawurlencode( $inbox ) . '/messages/send';
		$body = wp_json_encode(
			array(
				'to'      => $to,
				'subject' => $subject,
				'text'    => $message,
				'html'    => '<p>' . nl2br( esc_html( $message ) ) . '</p>',
			)
		);

		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false, 'error' => $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = (string) wp_remote_retrieve_body( $response );
		if ( $code >= 200 && $code < 300 ) {
			return array( 'ok' => true, 'transport' => 'agentmail' );
		}

		return array( 'ok' => false, 'error' => self::format_agentmail_error( $code, $raw ) );
	}

	private static function format_agentmail_error( int $code, string $raw ): string {
		$decoded = json_decode( $raw, true );
		if ( is_array( $decoded ) ) {
			foreach ( array( 'message', 'error', 'detail' ) as $key ) {
				if ( ! empty( $decoded[ $key ] ) && is_string( $decoded[ $key ] ) ) {
					return 'AgentMail: ' . $decoded[ $key ];
				}
			}
		}
		$snippet = trim( wp_strip_all_tags( $raw ) );
		if ( $snippet !== '' && strlen( $snippet ) <= 240 ) {
			return 'AgentMail send failed (' . $code . '): ' . $snippet;
		}
		return 'AgentMail send failed (' . $code . '). Check API key and inbox in API Keys.';
	}

	/**
	 * @param array{host:string,port:int,user:string,password:string,fromEmail:string,fromName:string,secure:string}|null $smtp
	 * @return array{ok:bool,error?:string,transport?:string}
	 */
	private static function send_via_wp_mail( string $to, string $subject, string $message, ?array $smtp, string $transport ): array {
		$configure = null;
		if ( is_array( $smtp ) && $smtp['host'] !== '' ) {
			$configure = static function ( $phpmailer ) use ( $smtp ) {
				$phpmailer->isSMTP();
				$phpmailer->Host       = $smtp['host'];
				$phpmailer->Port       = $smtp['port'];
				$phpmailer->SMTPAuth   = $smtp['user'] !== '';
				$phpmailer->Username   = $smtp['user'];
				$phpmailer->Password   = $smtp['password'];
				$phpmailer->SMTPSecure = $smtp['secure'] !== '' ? $smtp['secure'] : 'tls';
				if ( $smtp['fromEmail'] !== '' ) {
					$phpmailer->setFrom( $smtp['fromEmail'], $smtp['fromName'] );
				}
			};
			add_action( 'phpmailer_init', $configure );
		}

		$error_message = '';
		$on_failed     = static function ( $wp_error ) use ( &$error_message ) {
			if ( is_wp_error( $wp_error ) ) {
				$error_message = $wp_error->get_error_message();
			}
		};

		add_action( 'wp_mail_failed', $on_failed );
		$sent = wp_mail( $to, $subject, $message );
		remove_action( 'wp_mail_failed', $on_failed );
		if ( $configure ) {
			remove_action( 'phpmailer_init', $configure );
		}

		if ( $sent ) {
			return array( 'ok' => true, 'transport' => $transport );
		}

		global $phpmailer;
		if ( $error_message === '' && isset( $phpmailer ) && is_object( $phpmailer ) && ! empty( $phpmailer->ErrorInfo ) ) {
			$error_message = (string) $phpmailer->ErrorInfo;
		}

		return array(
			'ok'    => false,
			'error' => $error_message !== '' ? $error_message : 'Mail could not be sent.',
		);
	}
}

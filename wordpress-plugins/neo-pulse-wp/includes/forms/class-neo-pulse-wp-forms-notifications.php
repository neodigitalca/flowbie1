<?php
/**
 * Email notifications for new form entries.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms_Notifications {

	/**
	 * @param array<string, mixed> $form  Form definition.
	 * @param array<string, mixed> $entry Entry with meta.
	 */
	public static function send_admin_notification( array $form, array $entry ): void {
		$settings = isset( $form['settings'] ) && is_array( $form['settings'] ) ? $form['settings'] : array();
		$emails   = isset( $settings['notification_emails'] ) && is_array( $settings['notification_emails'] )
			? $settings['notification_emails']
			: array( get_option( 'admin_email' ) );

		if ( empty( $emails ) ) {
			return;
		}

		$title   = (string) ( $form['title'] ?? __( 'Form', 'neo-pulse-wp' ) );
		$subject = sprintf(
			/* translators: %s: form title */
			__( 'New entry: %s', 'neo-pulse-wp' ),
			$title
		);

		$lines   = array();
		$lines[] = sprintf( __( 'Form: %s', 'neo-pulse-wp' ), $title );
		$lines[] = sprintf( __( 'Entry ID: %s', 'neo-pulse-wp' ), (string) ( $entry['entry_uid'] ?? $entry['id'] ?? '' ) );
		$lines[] = sprintf( __( 'Submitted: %s', 'neo-pulse-wp' ), (string) ( $entry['created_at'] ?? '' ) );
		$lines[] = '';
		$lines[] = __( 'Fields:', 'neo-pulse-wp' );

		$meta = isset( $entry['meta'] ) && is_array( $entry['meta'] ) ? $entry['meta'] : array();
		foreach ( $meta as $key => $value ) {
			if ( is_array( $value ) ) {
				$parts = array();
				foreach ( $value as $sub_key => $sub_val ) {
					if ( (string) $sub_val !== '' ) {
						$parts[] = is_int( $sub_key ) ? (string) $sub_val : $sub_key . ': ' . $sub_val;
					}
				}
				$value = implode( '; ', $parts );
			}
			$lines[] = $key . ': ' . $value;
		}

		$admin_url = admin_url(
			'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . (int) ( $form['ID'] ?? 0 ) . '&entry_id=' . (int) ( $entry['id'] ?? 0 )
		);
		$lines[]   = '';
		$lines[]   = __( 'View in WordPress admin:', 'neo-pulse-wp' ) . ' ' . $admin_url;

		$body    = implode( "\n", $lines );
		$headers = array( 'Content-Type: text/plain; charset=UTF-8' );

		foreach ( $emails as $email ) {
			wp_mail( $email, $subject, $body, $headers );
		}
	}
}

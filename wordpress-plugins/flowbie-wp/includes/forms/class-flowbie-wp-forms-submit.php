<?php
/**
 * Form submission pipeline.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Submit {

	const RATE_LIMIT_MAX = 10;

	const RATE_LIMIT_TTL = 60;

	/**
	 * @param int                      $form_id Form post ID.
	 * @param array<string, mixed>     $input   POST fields.
	 * @param array<string, mixed>     $server  Request context.
	 * @param array<string, array<string, mixed>> $files Uploaded files.
	 * @return array{success: bool, message?: string, redirect_url?: string, errors?: array<string, string>, entry_id?: int}
	 */
	public static function process( int $form_id, array $input, array $server = array(), array $files = array() ): array {
		$form = Flowbie_Wp_Forms_Storage::get_form_by_id( $form_id );
		if ( ! $form || empty( $form['active'] ) || ( $form['status'] ?? '' ) === 'trash' ) {
			return array(
				'success' => false,
				'message' => __( 'This form is not available.', 'flowbie-wp' ),
			);
		}

		$settings = $form['settings'] ?? array();

		if ( ! empty( $settings['require_login'] ) && ! is_user_logged_in() ) {
			return array(
				'success' => false,
				'message' => __( 'You must be logged in to submit this form.', 'flowbie-wp' ),
			);
		}

		if ( ! empty( $settings['honeypot_enabled'] ) ) {
			$honeypot = isset( $input['flowbie_hp'] ) ? trim( (string) $input['flowbie_hp'] ) : '';
			if ( $honeypot !== '' ) {
				return array(
					'success' => false,
					'message' => __( 'Submission rejected.', 'flowbie-wp' ),
				);
			}
		}

		$ip = self::client_ip();
		if ( ! self::check_rate_limit( $form_id, $ip ) ) {
			return array(
				'success' => false,
				'message' => __( 'Too many submissions. Please wait a moment and try again.', 'flowbie-wp' ),
			);
		}

		unset( $input['flowbie_hp'], $input['_wpnonce'], $input['form_id'], $input['overseer_session_id'], $input['overseer_visit_uid'] );

		$validation = Flowbie_Wp_Forms_Validator::validate( $form, $input, $files );
		if ( ! $validation['valid'] ) {
			return array(
				'success' => false,
				'message' => __( 'Please correct the errors below.', 'flowbie-wp' ),
				'errors'  => $validation['errors'],
			);
		}

		$meta = $validation['values'];
		foreach ( $meta as $key => $value ) {
			if ( is_array( $value ) && isset( $value['tmp_name'] ) ) {
				$uploaded = self::handle_file_upload( $form_id, $value );
				$meta[ $key ] = $uploaded ? (string) $uploaded['attachment_id'] : '';
			}
		}

		$store_ip = ! empty( $settings['store_ip'] );
		$entry_id = Flowbie_Wp_Forms_Entries::insert_entry(
			array(
				'form_id'    => $form_id,
				'status'     => 'active',
				'ip_address' => $store_ip ? $ip : null,
				'user_agent' => isset( $server['user_agent'] ) ? (string) $server['user_agent'] : ( isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_USER_AGENT'] ) ) : '' ),
				'source_url' => isset( $server['source_url'] ) ? (string) $server['source_url'] : '',
				'user_id'    => get_current_user_id(),
				'meta'       => $meta,
			)
		);

		if ( $entry_id < 1 ) {
			return array(
				'success' => false,
				'message' => __( 'Could not save your submission. Please try again.', 'flowbie-wp' ),
			);
		}

		$entry = Flowbie_Wp_Forms_Entries::get_entry( $entry_id );
		if ( $entry ) {
			Flowbie_Wp_Forms_Notifications::send_admin_notification( $form, $entry );
		}

		$redirect = isset( $settings['redirect_url'] ) ? (string) $settings['redirect_url'] : '';
		$message  = isset( $settings['success_message'] ) ? (string) $settings['success_message'] : __( 'Thank you for your submission.', 'flowbie-wp' );

		$response = array(
			'success'   => true,
			'message'   => $message,
			'entry_id'  => $entry_id,
		);
		if ( $redirect !== '' ) {
			$response['redirect_url'] = $redirect;
		}

		/**
		 * Fires after a successful Flowbie Forms submission.
		 *
		 * @param array<string, mixed> $form     Form definition.
		 * @param array<string, mixed> $entry    Saved entry row.
		 * @param array<string, mixed> $response REST response payload.
		 * @param array<string, mixed> $server   Request context.
		 */
		do_action( 'flowbie_wp_forms_after_submit', $form, $entry ? $entry : array(), $response, $server );

		return $response;
	}

	/**
	 * @param array<string, mixed> $file File payload from validator.
	 * @return array{attachment_id: int, url: string}|null
	 */
	private static function handle_file_upload( int $form_id, array $file ): ?array {
		if ( empty( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
			return null;
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$upload_dir = wp_upload_dir();
		if ( ! empty( $upload_dir['error'] ) ) {
			return null;
		}

		$subdir = '/flowbie-forms/' . $form_id;
		add_filter(
			'upload_dir',
			static function ( $dirs ) use ( $subdir ) {
				$dirs['subdir'] = $subdir;
				$dirs['path']   = $dirs['basedir'] . $subdir;
				$dirs['url']    = $dirs['baseurl'] . $subdir;
				return $dirs;
			}
		);

		$overrides = array( 'test_form' => false );
		$handled   = wp_handle_upload(
			array(
				'name'     => (string) $file['name'],
				'type'     => (string) ( $file['type'] ?? '' ),
				'tmp_name' => (string) $file['tmp_name'],
				'error'    => 0,
				'size'     => (int) ( $file['size'] ?? 0 ),
			),
			$overrides
		);

		remove_all_filters( 'upload_dir' );

		if ( isset( $handled['error'] ) ) {
			return null;
		}

		$attachment = array(
			'post_mime_type' => $handled['type'] ?? '',
			'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $handled['file'] ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);
		$attach_id = wp_insert_attachment( $attachment, $handled['file'] );
		if ( is_wp_error( $attach_id ) || ! $attach_id ) {
			return null;
		}

		$meta = wp_generate_attachment_metadata( (int) $attach_id, $handled['file'] );
		wp_update_attachment_metadata( (int) $attach_id, $meta );

		return array(
			'attachment_id' => (int) $attach_id,
			'url'           => (string) ( $handled['url'] ?? '' ),
		);
	}

	private static function client_ip(): string {
		$ip = '';
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$parts = explode( ',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'] );
			$ip    = trim( $parts[0] );
		} elseif ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
			$ip = (string) $_SERVER['REMOTE_ADDR'];
		}
		return sanitize_text_field( $ip );
	}

	private static function check_rate_limit( int $form_id, string $ip ): bool {
		if ( $ip === '' ) {
			return true;
		}
		$key   = 'flowbie_form_rl_' . $form_id . '_' . md5( $ip );
		$count = (int) get_transient( $key );
		if ( $count >= self::RATE_LIMIT_MAX ) {
			return false;
		}
		set_transient( $key, $count + 1, self::RATE_LIMIT_TTL );
		return true;
	}

	/**
	 * Organize $_FILES for multi-field forms.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function normalize_files(): array {
		if ( empty( $_FILES ) || ! is_array( $_FILES ) ) {
			return array();
		}
		$out = array();
		foreach ( $_FILES as $name => $file ) {
			if ( ! is_array( $file ) ) {
				continue;
			}
			$name = sanitize_key( (string) $name );
			if ( $name === '' ) {
				continue;
			}
			$out[ $name ] = array(
				'name'     => isset( $file['name'] ) ? (string) $file['name'] : '',
				'type'     => isset( $file['type'] ) ? (string) $file['type'] : '',
				'tmp_name' => isset( $file['tmp_name'] ) ? (string) $file['tmp_name'] : '',
				'error'    => isset( $file['error'] ) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE,
				'size'     => isset( $file['size'] ) ? (int) $file['size'] : 0,
			);
		}
		return $out;
	}
}

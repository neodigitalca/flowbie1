<?php
/**
 * Backend Assist — filesystem session storage REST handlers
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Sessions {

	public static function sessions_dir(): string {
		$upload = wp_upload_dir();
		$dir    = $upload['basedir'] . '/neo-pulse/sessions/' . get_current_user_id();
		if ( ! file_exists( $dir ) ) {
			wp_mkdir_p( $dir );
			file_put_contents( $dir . '/index.php', '<?php // silence' );
		}
		return $dir;
	}
	public static function session_path( string $id ): string {
		return self::sessions_dir() . '/' . sanitize_file_name( $id ) . '.json';
	}
	public static function rest_sessions_list( WP_REST_Request $request ): WP_REST_Response {
		$dir = self::sessions_dir();
		$files = glob( $dir . '/sess_*.json' );
		if ( ! is_array( $files ) ) {
			$files = array();
		}

		usort( $files, function ( $a, $b ) {
			return filemtime( $b ) - filemtime( $a );
		} );

		$sessions = array();
		foreach ( array_slice( $files, 0, 50 ) as $file ) {
			$raw = file_get_contents( $file );
			$data = json_decode( $raw, true );
			if ( ! is_array( $data ) ) {
				continue;
			}
			$sessions[] = array(
				'id'            => isset( $data['id'] ) ? $data['id'] : '',
				'title'         => isset( $data['title'] ) ? $data['title'] : '',
				'created'       => isset( $data['created'] ) ? $data['created'] : '',
				'updated'       => isset( $data['updated'] ) ? $data['updated'] : '',
				'message_count' => isset( $data['messages'] ) ? count( $data['messages'] ) : 0,
			);
		}

		return new WP_REST_Response( $sessions, 200 );
	}
	public static function rest_session_get( WP_REST_Request $request ): WP_REST_Response {
		$id   = $request->get_param( 'id' );
		$path = self::session_path( $id );

		if ( ! file_exists( $path ) ) {
			return new WP_REST_Response( array( 'error' => 'Session not found.' ), 404 );
		}

		$data = json_decode( file_get_contents( $path ), true );
		if ( ! is_array( $data ) ) {
			return new WP_REST_Response( array( 'error' => 'Invalid session data.' ), 500 );
		}

		return new WP_REST_Response( $data, 200 );
	}
	public static function rest_sessions_save( WP_REST_Request $request ): WP_REST_Response {
		$body     = $request->get_json_params();
		$id       = isset( $body['id'] ) ? sanitize_file_name( $body['id'] ) : '';
		$messages = isset( $body['messages'] ) && is_array( $body['messages'] ) ? $body['messages'] : array();

		if ( empty( $messages ) ) {
			return new WP_REST_Response( array( 'error' => 'No messages to save.' ), 400 );
		}

		$now = gmdate( 'c' );

		if ( $id === '' ) {
			$id = 'sess_' . time() . '_' . wp_generate_password( 6, false );
		}

		$path     = self::session_path( $id );
		$existing = file_exists( $path ) ? json_decode( file_get_contents( $path ), true ) : null;

		$first_user_msg = '';
		foreach ( $messages as $msg ) {
			if ( isset( $msg['role'] ) && $msg['role'] === 'user' && isset( $msg['content'] ) ) {
				$first_user_msg = $msg['content'];
				break;
			}
		}

		$session = array(
			'id'       => $id,
			'title'    => is_array( $existing ) && ! empty( $existing['title'] )
				? $existing['title']
				: wp_trim_words( $first_user_msg, 6, '...' ),
			'created'  => is_array( $existing ) && ! empty( $existing['created'] ) ? $existing['created'] : $now,
			'updated'  => $now,
			'messages' => $messages,
		);

		file_put_contents( $path, wp_json_encode( $session, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );

		return new WP_REST_Response( array( 'id' => $id, 'title' => $session['title'] ), 200 );
	}
	public static function rest_session_delete( WP_REST_Request $request ): WP_REST_Response {
		$id   = $request->get_param( 'id' );
		$path = self::session_path( $id );

		if ( file_exists( $path ) ) {
			unlink( $path );
		}

		return new WP_REST_Response( array( 'deleted' => true ), 200 );
	}
	public static function rest_sessions_clear( WP_REST_Request $request ): WP_REST_Response {
		$dir   = self::sessions_dir();
		$files = glob( $dir . '/sess_*.json' );
		if ( is_array( $files ) ) {
			foreach ( $files as $file ) {
				unlink( $file );
			}
		}

		return new WP_REST_Response( array( 'cleared' => true ), 200 );
	}
}

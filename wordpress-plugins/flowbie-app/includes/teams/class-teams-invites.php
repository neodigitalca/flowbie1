<?php
/**
 * Team invite creation and acceptance.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Teams_Invites {

	/**
	 * Public invite acceptance URL (React app register route).
	 */
	public static function accept_url( string $token ): string {
		return home_url( '/flowbie/register?invite=' . rawurlencode( $token ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_pending( int $team_id ): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, email, access_role, job_title, expires_at, created_at
				FROM ' . $wpdb->prefix . 'flowbie_team_invites
				WHERE team_id = %d AND expires_at > UTC_TIMESTAMP()
				ORDER BY created_at DESC',
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_map(
			static function ( $row ) {
				return array(
					'id'         => (int) $row['id'],
					'email'      => (string) $row['email'],
					'accessRole' => (string) $row['access_role'],
					'jobTitle'   => (string) $row['job_title'],
					'expiresAt'  => (string) $row['expires_at'],
					'createdAt'  => (string) $row['created_at'],
				);
			},
			$rows
		);
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function create( int $team_id, int $invited_by, array $body ): array {
		global $wpdb;
		$team = Flowbie_App_Teams_Store::get_team( $team_id );
		if ( ! $team ) {
			return array( 'ok' => false, 'error' => 'Team not found' );
		}

		$email       = isset( $body['email'] ) ? sanitize_email( strtolower( trim( (string) $body['email'] ) ) ) : '';
		$access_role = isset( $body['accessRole'] ) ? sanitize_text_field( (string) $body['accessRole'] ) : 'viewer';
		$job_title   = isset( $body['jobTitle'] ) ? sanitize_text_field( (string) $body['jobTitle'] ) : '';

		if ( $email === '' || ! is_email( $email ) ) {
			return array( 'ok' => false, 'error' => 'Valid email required' );
		}

		$existing_user = Flowbie_App_Teams_Store::get_user_by_email( $email );
		if ( $existing_user ) {
			$result = Flowbie_App_Teams_Store::add_member(
				$team_id,
				(int) $existing_user['id'],
				$access_role,
				$job_title
			);
			if ( empty( $result['ok'] ) ) {
				return $result;
			}

			$wpdb->delete(
				$wpdb->prefix . 'flowbie_team_invites',
				array(
					'team_id' => $team_id,
					'email'   => $email,
				),
				array( '%d', '%s' )
			);

			return array(
				'ok'    => true,
				'added' => true,
				'member'=> array(
					'email'      => $email,
					'accessRole' => $access_role,
					'jobTitle'   => $job_title,
				),
			);
		}

		$token      = wp_generate_password( 32, false );
		$token_hash = hash( 'sha256', $token );
		$expires    = gmdate( 'Y-m-d H:i:s', time() + 7 * DAY_IN_SECONDS );
		$perms      = wp_json_encode( Flowbie_App_Teams_Store::permissions_for_role( $access_role ) );

		$accept_url = self::accept_url( $token );
		$subject    = sprintf( 'Join %s on Flowbie', (string) $team['name'] );
		$message    = sprintf(
			"You have been invited to join %s on Flowbie.\n\nAccept your invite:\n%s\n\nThis link expires in 7 days.",
			(string) $team['name'],
			$accept_url
		);
		$mail = Flowbie_App_Mail::send( $email, $subject, $message );
		if ( ! $mail['ok'] ) {
			return array( 'ok' => false, 'error' => $mail['error'] ?? 'Mail could not be sent' );
		}

		$wpdb->insert(
			$wpdb->prefix . 'flowbie_team_invites',
			array(
				'team_id'          => $team_id,
				'email'            => $email,
				'access_role'      => $access_role,
				'job_title'        => $job_title,
				'permissions_json' => $perms,
				'token_hash'       => $token_hash,
				'expires_at'       => $expires,
				'invited_by'       => $invited_by,
			),
			array( '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d' )
		);

		return array(
			'ok'    => true,
			'invite'=> array(
				'email'      => $email,
				'accessRole' => $access_role,
				'jobTitle'   => $job_title,
				'expiresAt'  => $expires,
			),
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function find_by_token( string $token ): ?array {
		global $wpdb;
		$hash = hash( 'sha256', $token );
		$row  = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . $wpdb->prefix . 'flowbie_team_invites WHERE token_hash = %s AND expires_at > UTC_TIMESTAMP()',
				$hash
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	public static function validate_token( string $token ): array {
		$invite = self::find_by_token( $token );
		if ( ! $invite ) {
			return array( 'ok' => false, 'error' => 'Invalid or expired invite' );
		}
		$team = Flowbie_App_Teams_Store::get_team( (int) $invite['team_id'] );
		return array(
			'ok'    => true,
			'email' => (string) $invite['email'],
			'team'  => $team ? array(
				'id'   => (int) $team['id'],
				'name' => (string) $team['name'],
			) : null,
			'jobTitle'   => (string) $invite['job_title'],
			'accessRole' => (string) $invite['access_role'],
		);
	}

	/**
	 * @param array<string,mixed> $invite
	 * @return array<string,mixed>
	 */
	public static function accept( array $invite, int $user_id ): array {
		global $wpdb;
		$team_id = (int) $invite['team_id'];
		$team    = Flowbie_App_Teams_Store::get_team( $team_id );
		if ( ! $team ) {
			return array( 'ok' => false, 'error' => 'Team not found' );
		}

		$existing = Flowbie_App_Teams_Store::get_membership( $team_id, $user_id );
		if ( ! $existing ) {
			$wpdb->insert(
				$wpdb->prefix . 'flowbie_team_members',
				array(
					'team_id'          => $team_id,
					'user_id'          => $user_id,
					'access_role'      => (string) $invite['access_role'],
					'job_title'        => (string) $invite['job_title'],
					'permissions_json' => (string) $invite['permissions_json'],
					'profile_json'     => wp_json_encode( array() ),
					'status'           => 'active',
				),
				array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
			);
		}

		$wpdb->delete(
			$wpdb->prefix . 'flowbie_team_invites',
			array( 'id' => (int) $invite['id'] ),
			array( '%d' )
		);

		return array( 'ok' => true );
	}

	public static function revoke( int $team_id, int $invite_id ): bool {
		global $wpdb;
		return (bool) $wpdb->delete(
			$wpdb->prefix . 'flowbie_team_invites',
			array(
				'id'      => $invite_id,
				'team_id' => $team_id,
			),
			array( '%d', '%d' )
		);
	}

	/**
	 * Rotate invite token and return copyable mail text (does not send mail).
	 *
	 * @return array<string,mixed>
	 */
	public static function copy_link( int $team_id, int $invite_id ): array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . $wpdb->prefix . 'flowbie_team_invites WHERE id = %d AND team_id = %d',
				$invite_id,
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return array( 'ok' => false, 'error' => 'Invite not found' );
		}

		$rotated = self::rotate_invite_token( $invite_id );
		if ( ! $rotated ) {
			return array( 'ok' => false, 'error' => 'Could not refresh invite' );
		}

		$team       = Flowbie_App_Teams_Store::get_team( $team_id );
		$team_name  = $team ? (string) $team['name'] : 'Flowbie';
		$accept_url = self::accept_url( $rotated['token'] );
		$subject    = sprintf( 'Join %s on Flowbie', $team_name );
		$message    = sprintf(
			"You have been invited to join %s on Flowbie.\n\nAccept your invite:\n%s\n\nThis link expires in 7 days.",
			$team_name,
			$accept_url
		);

		return array(
			'ok'        => true,
			'email'     => (string) $row['email'],
			'subject'   => $subject,
			'message'   => $message,
			'acceptUrl' => $accept_url,
			'expiresAt' => $rotated['expires'],
		);
	}

	/**
	 * @return array{token:string,expires:string}|null
	 */
	private static function rotate_invite_token( int $invite_id ): ?array {
		global $wpdb;
		$token      = wp_generate_password( 32, false );
		$token_hash = hash( 'sha256', $token );
		$expires    = gmdate( 'Y-m-d H:i:s', time() + 7 * DAY_IN_SECONDS );
		$updated    = $wpdb->update(
			$wpdb->prefix . 'flowbie_team_invites',
			array(
				'token_hash' => $token_hash,
				'expires_at' => $expires,
			),
			array( 'id' => $invite_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);
		if ( $updated === false ) {
			return null;
		}
		return array(
			'token'   => $token,
			'expires' => $expires,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function resend( int $team_id, int $invite_id ): array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . $wpdb->prefix . 'flowbie_team_invites WHERE id = %d AND team_id = %d',
				$invite_id,
				$team_id
			),
			ARRAY_A
		);
		if ( ! is_array( $row ) ) {
			return array( 'ok' => false, 'error' => 'Invite not found' );
		}
		$rotated = self::rotate_invite_token( $invite_id );
		if ( ! $rotated ) {
			return array( 'ok' => false, 'error' => 'Could not refresh invite' );
		}
		$team       = Flowbie_App_Teams_Store::get_team( $team_id );
		$team_name  = $team ? (string) $team['name'] : 'Flowbie';
		$accept_url = self::accept_url( $rotated['token'] );
		$mail       = Flowbie_App_Mail::send(
			(string) $row['email'],
			sprintf( 'Join %s on Flowbie', $team_name ),
			sprintf(
				"You have been invited to join %s on Flowbie.\n\nAccept your invite:\n%s\n\nThis link expires in 7 days.",
				$team_name,
				$accept_url
			)
		);
		if ( ! $mail['ok'] ) {
			return array( 'ok' => false, 'error' => $mail['error'] ?? 'Mail could not be sent' );
		}
		return array( 'ok' => true, 'expiresAt' => $rotated['expires'] );
	}

	/**
	 * Owner-only mail configuration test.
	 *
	 * @return array<string,mixed>
	 */
	public static function send_admin_test( int $team_id, string $email ): array {
		$team = Flowbie_App_Teams_Store::get_team( $team_id );
		if ( ! $team ) {
			return array( 'ok' => false, 'error' => 'Team not found' );
		}

		$email = sanitize_email( strtolower( trim( $email ) ) );
		if ( $email === '' || ! is_email( $email ) ) {
			return array( 'ok' => false, 'error' => 'Valid email required' );
		}

		return Flowbie_App_Mail::send(
			$email,
			sprintf( 'Flowbie mail test (%s)', (string) $team['name'] ),
			sprintf(
				"This is a Flowbie team mail test for %s.\n\nSent at: %s UTC\n\nIf you received this, team mail is working.",
				(string) $team['name'],
				gmdate( 'Y-m-d H:i:s' )
			)
		);
	}
}

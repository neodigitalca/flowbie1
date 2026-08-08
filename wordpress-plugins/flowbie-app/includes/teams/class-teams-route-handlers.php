<?php
/**
 * /api/teams/* route handlers.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Teams_Route_Handlers {

	/**
	 * @param string              $route  Route after teams/.
	 * @param string              $method HTTP method.
	 * @param array<string,mixed> $body   JSON body.
	 */
	public static function dispatch( string $route, string $method, array $body ): void {
		$route  = trim( $route, '/' );
		$method = strtoupper( $method );

		if ( preg_match( '#^invites/accept$#', $route ) && $method === 'GET' ) {
			$token = isset( $_GET['token'] ) ? (string) wp_unslash( $_GET['token'] ) : '';
			Flowbie_App_Api_Dispatcher::send_json( Flowbie_App_Teams_Invites::validate_token( $token ) );
			return;
		}

		$user = Flowbie_App_Auth_Session::require_user();
		if ( ! $user ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Unauthorized' ), 401 );
			return;
		}
		$user_id = (int) $user['id'];

		if ( $route === '' && $method === 'GET' ) {
			$teams = Flowbie_App_Teams_Store::list_teams_for_user( $user_id );
			$out   = array();
			foreach ( $teams as $row ) {
				$team = Flowbie_App_Teams_Store::get_team( (int) $row['id'] );
				$mem  = Flowbie_App_Teams_Store::get_membership( (int) $row['id'], $user_id );
				if ( $team && $mem ) {
					$out[] = Flowbie_App_Teams_Store::format_team_payload( $team, $mem );
				}
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'teams' => $out ) );
			return;
		}

		if ( $route === '' && $method === 'POST' ) {
			self::create_team( $user_id, $body );
			return;
		}

		if ( preg_match( '#^(\d+)$#', $route, $m ) ) {
			self::dispatch_team( (int) $m[1], '', $method, $body, $user_id );
			return;
		}

		if ( preg_match( '#^(\d+)/(.+)$#', $route, $m ) ) {
			self::dispatch_team( (int) $m[1], $m[2], $method, $body, $user_id );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function create_team( int $user_id, array $body ): void {
		$name       = isset( $body['name'] ) ? sanitize_text_field( (string) $body['name'] ) : 'Neo Digital Inc.';
		$job_title  = isset( $body['jobTitle'] ) ? sanitize_text_field( (string) $body['jobTitle'] ) : 'Lead SEO/AI Developer';
		$team       = Flowbie_App_Teams_Store::create_team( $user_id, $name, $job_title );
		Flowbie_App_Auth_Session::set_active_team( (int) $team['id'] );
		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'team' => $team ) );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function dispatch_team( int $team_id, string $sub, string $method, array $body, int $user_id ): void {
		$sub    = trim( $sub, '/' );
		$team   = Flowbie_App_Teams_Store::get_team( $team_id );
		$member = Flowbie_App_Teams_Store::get_membership( $team_id, $user_id );
		if ( ! $team || ! $member ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		if ( $sub === '' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array( 'ok' => true, 'team' => Flowbie_App_Teams_Store::format_team_payload( $team, $member ) )
			);
			return;
		}

		if ( $sub === '' && $method === 'PATCH' ) {
			self::patch_team( $team, $member, $body );
			return;
		}

		if ( $sub === '' && $method === 'DELETE' ) {
			if ( (string) $member['access_role'] !== 'owner' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			global $wpdb;
			$wpdb->delete( $wpdb->prefix . 'flowbie_team_members', array( 'team_id' => $team_id ), array( '%d' ) );
			$wpdb->delete( $wpdb->prefix . 'flowbie_team_invites', array( 'team_id' => $team_id ), array( '%d' ) );
			$wpdb->delete( $wpdb->prefix . 'flowbie_team_job_title_presets', array( 'team_id' => $team_id ), array( '%d' ) );
			$wpdb->delete( $wpdb->prefix . 'flowbie_teams', array( 'id' => $team_id ), array( '%d' ) );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( $sub === 'switch' && $method === 'POST' ) {
			Flowbie_App_Auth_Session::set_active_team( $team_id );
			Flowbie_App_Api_Dispatcher::send_json(
				array( 'ok' => true, 'team' => Flowbie_App_Teams_Store::format_team_payload( $team, $member ) )
			);
			return;
		}

		if ( $sub === 'members' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array( 'ok' => true, 'members' => Flowbie_App_Teams_Store::list_members( $team_id ) )
			);
			return;
		}

		if ( $sub === 'members' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$result = Flowbie_App_Teams_Store::provision_member( $team_id, $body );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 400 );
			return;
		}

		if ( preg_match( '#^members/(\d+)$#', $sub, $mm ) ) {
			self::dispatch_member( $team_id, (int) $mm[1], $method, $body, $member, $user_id );
			return;
		}

		if ( $sub === 'job-titles' && $method === 'GET' ) {
			Flowbie_App_Teams_Store::ensure_job_title_presets( $team_id );
			global $wpdb;
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT title, sort_order FROM ' . $wpdb->prefix . 'flowbie_team_job_title_presets WHERE team_id = %d ORDER BY sort_order ASC',
					$team_id
				),
				ARRAY_A
			);
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'     => true,
					'presets'=> is_array( $rows ) ? array_map(
						static function ( $r ) {
							return array(
								'title'     => (string) $r['title'],
								'sortOrder' => (int) $r['sort_order'],
							);
						},
						$rows
					) : array(),
				)
			);
			return;
		}

		if ( $sub === 'job-titles' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$result = Flowbie_App_Teams_Store::add_job_title_preset(
				$team_id,
				isset( $body['title'] ) ? (string) $body['title'] : ''
			);
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 400 );
			return;
		}

		if ( $sub === 'invites' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array( 'ok' => true, 'invites' => Flowbie_App_Teams_Invites::list_pending( $team_id ) )
			);
			return;
		}

		if ( $sub === 'invites' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$result = Flowbie_App_Teams_Invites::create( $team_id, $user_id, $body );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 502 );
			return;
		}

		if ( $sub === 'mail-test' && $method === 'POST' ) {
			if ( (string) $member['access_role'] !== 'owner' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$email  = isset( $body['email'] ) ? (string) $body['email'] : '';
			$result = Flowbie_App_Teams_Invites::send_admin_test( $team_id, $email );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 502 );
			return;
		}

		if ( preg_match( '#^invites/(\d+)/revoke$#', $sub, $im ) && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array( 'ok' => Flowbie_App_Teams_Invites::revoke( $team_id, (int) $im[1] ) )
			);
			return;
		}

		if ( preg_match( '#^invites/(\d+)/copy-link$#', $sub, $im ) && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$result = Flowbie_App_Teams_Invites::copy_link( $team_id, (int) $im[1] );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 404 );
			return;
		}

		if ( preg_match( '#^invites/(\d+)/resend$#', $sub, $im ) && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$result = Flowbie_App_Teams_Invites::resend( $team_id, (int) $im[1] );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 502 );
			return;
		}

		if ( $sub === 'workspace' && $method === 'GET' ) {
			$path = Flowbie_App_Teams_Store::team_workspace_path( $team_id );
			$data = Flowbie_App_Json_File_Store::read( $path );
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'snapshot' => is_array( $data ) && isset( $data['snapshot'] ) ? $data['snapshot'] : null,
					'updatedAt'=> is_array( $data ) && isset( $data['updatedAt'] ) ? $data['updatedAt'] : null,
				)
			);
			return;
		}

		if ( $sub === 'workspace' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'properties' ) && ! Flowbie_App_Teams_Store::can_write( $member, 'api-keys' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$snapshot = isset( $body['snapshot'] ) ? $body['snapshot'] : null;
			$updated  = gmdate( 'c' );
			$path     = Flowbie_App_Teams_Store::team_workspace_path( $team_id );
			Flowbie_App_Json_File_Store::write(
				$path,
				array(
					'snapshot'  => $snapshot,
					'updatedAt' => $updated,
				)
			);
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'updatedAt' => $updated ) );
			return;
		}

		if ( $sub === 'chat' || str_starts_with( $sub, 'chat/' ) ) {
			$chat_sub = $sub === 'chat' ? '' : substr( $sub, 5 );
			Flowbie_App_Chat_Route_Handlers::dispatch( $team, $member, $chat_sub, $method, $body, $user_id );
			return;
		}

		if ( $sub === 'tasks' || str_starts_with( $sub, 'tasks/' ) ) {
			$tasks_sub = $sub === 'tasks' ? '' : substr( $sub, 6 );
			Flowbie_App_Tasks_Route_Handlers::dispatch( $team, $member, $tasks_sub, $method, $body, $user_id );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $team
	 * @param array<string,mixed> $member
	 * @param array<string,mixed> $body
	 */
	private static function patch_team( array $team, array $member, array $body ): void {
		if ( ! Flowbie_App_Teams_Store::can_write( $member, 'teams' ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}
		global $wpdb;
		$updates = array();
		$formats = array();
		if ( isset( $body['name'] ) ) {
			$updates['name'] = sanitize_text_field( (string) $body['name'] );
			$formats[]       = '%s';
		}
		if ( count( $updates ) > 0 ) {
			$wpdb->update(
				$wpdb->prefix . 'flowbie_teams',
				$updates,
				array( 'id' => (int) $team['id'] ),
				$formats,
				array( '%d' )
			);
		}
		$team = Flowbie_App_Teams_Store::get_team( (int) $team['id'] );
		Flowbie_App_Api_Dispatcher::send_json(
			array(
				'ok'   => true,
				'team' => Flowbie_App_Teams_Store::format_team_payload( $team ?: array(), $member ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $actor
	 * @param array<string,mixed> $body
	 */
	private static function dispatch_member( int $team_id, int $target_user_id, string $method, array $body, array $actor, int $actor_user_id ): void {
		global $wpdb;
		$target = Flowbie_App_Teams_Store::get_membership( $team_id, $target_user_id );
		if ( ! $target ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Member not found' ), 404 );
			return;
		}

		if ( $method === 'GET' ) {
			$members = Flowbie_App_Teams_Store::list_members( $team_id );
			$found   = null;
			foreach ( $members as $m ) {
				if ( (int) $m['userId'] === $target_user_id ) {
					$found = $m;
					break;
				}
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'member' => $found ) );
			return;
		}

		if ( $method === 'PATCH' ) {
			$can_edit = Flowbie_App_Teams_Store::can_write( $actor, 'teams' ) || $actor_user_id === $target_user_id;
			if ( ! $can_edit ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}

			$updates = array();
			$formats = array();

			if ( isset( $body['displayName'] ) && $actor_user_id === $target_user_id ) {
				$wpdb->update(
					$wpdb->prefix . 'flowbie_users',
					array( 'display_name' => sanitize_text_field( (string) $body['displayName'] ) ),
					array( 'id' => $target_user_id ),
					array( '%s' ),
					array( '%d' )
				);
			}

			if ( isset( $body['password'] ) ) {
				$password = (string) $body['password'];
				$can_set_password = $actor_user_id === $target_user_id || Flowbie_App_Teams_Store::can_write( $actor, 'teams' );
				if ( ! $can_set_password ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
					return;
				}
				if ( class_exists( 'Flowbie_App_Chat_Flo' ) && Flowbie_App_Chat_Flo::is_flo( $target_user_id ) ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot change bot password' ), 400 );
					return;
				}
				if ( $password === '' ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Password required' ), 400 );
					return;
				}
				if ( ! Flowbie_App_Teams_Store::update_user_password( $target_user_id, $password ) ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not update password' ), 500 );
					return;
				}
			}

			if ( isset( $body['jobTitle'] ) ) {
				$updates['job_title'] = sanitize_text_field( (string) $body['jobTitle'] );
				$formats[]            = '%s';
			}

			if ( isset( $body['profile'] ) && is_array( $body['profile'] ) ) {
				$updates['profile_json'] = wp_json_encode( $body['profile'] );
				$formats[]               = '%s';
			}

			if ( Flowbie_App_Teams_Store::can_write( $actor, 'teams' ) ) {
				if ( isset( $body['accessRole'] ) ) {
					$role = sanitize_text_field( (string) $body['accessRole'] );
					if ( (string) $target['access_role'] === 'owner' && $role !== 'owner' ) {
						Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot change owner role' ), 400 );
						return;
					}
					$updates['access_role']      = $role;
					$updates['permissions_json'] = wp_json_encode( Flowbie_App_Teams_Store::permissions_for_role( $role ) );
					$formats[]                   = '%s';
					$formats[]                   = '%s';
				}
				if ( ! empty( $body['remove'] ) ) {
					if ( (string) $target['access_role'] === 'owner' ) {
						Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot remove owner' ), 400 );
						return;
					}
					$wpdb->update(
						$wpdb->prefix . 'flowbie_team_members',
						array( 'status' => 'removed' ),
						array(
							'team_id' => $team_id,
							'user_id' => $target_user_id,
						),
						array( '%s' ),
						array( '%d', '%d' )
					);
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
					return;
				}
			}

			if ( count( $updates ) > 0 ) {
				$wpdb->update(
					$wpdb->prefix . 'flowbie_team_members',
					$updates,
					array(
						'team_id' => $team_id,
						'user_id' => $target_user_id,
					),
					$formats,
					array( '%d', '%d' )
				);
			}

			$members = Flowbie_App_Teams_Store::list_members( $team_id );
			$found   = null;
			foreach ( $members as $m ) {
				if ( (int) $m['userId'] === $target_user_id ) {
					$found = $m;
					break;
				}
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'member' => $found ) );
			return;
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}
}

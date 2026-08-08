<?php
/**
 * /api/teams/{id}/chat/* route handlers.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Chat_Route_Handlers {

	/**
	 * @param array<string,mixed> $team
	 * @param array<string,mixed> $member
	 * @param string              $sub    Route after chat/.
	 * @param string              $method HTTP method.
	 * @param array<string,mixed> $body   JSON body.
	 * @param int                 $user_id
	 */
	public static function dispatch( array $team, array $member, string $sub, string $method, array $body, int $user_id ): void {
		Flowbie_App_Chat_Store::install_tables();
		$team_id = (int) $team['id'];
		$sub     = trim( $sub, '/' );
		$method  = strtoupper( $method );

		if ( class_exists( 'Flowbie_App_Chat_Flo' ) ) {
			Flowbie_App_Chat_Flo::ensure_team_member( $team_id );
		}

		if ( ! Flowbie_App_Teams_Store::can_read( $member, 'communication' ) ) {
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		Flowbie_App_Chat_Store::ensure_default_channels( $team_id, $user_id );

		if ( $sub === 'calls/incoming' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'calls' => Flowbie_App_Chat_Calls::get_incoming_for_user( $team_id, $user_id ),
				)
			);
			return;
		}

		if ( $sub === 'calls/active' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'huddles' => Flowbie_App_Chat_Calls::list_active_huddles( $team_id, $user_id ),
				)
			);
			return;
		}

		if ( $sub === 'calls/start' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$channel_id  = isset( $body['channelId'] ) ? (int) $body['channelId'] : 0;
			$flo_huddle  = ! isset( $body['floHuddle'] ) || ! empty( $body['floHuddle'] );
			if ( $channel_id <= 0 ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'channelId required' ), 400 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::start_call( $team_id, $channel_id, $user_id, $flo_huddle );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not start call' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/accept$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::accept_call( $call_id, $user_id );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot accept call' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/decline$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::decline_call( $call_id, $user_id );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot decline call' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/end$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::end_call( $call_id, $user_id );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot end call' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/join$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::join_huddle( $call_id, $user_id );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot join huddle' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/leave$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$call = Flowbie_App_Chat_Calls::leave_huddle( $call_id, $user_id );
			if ( ! $call ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot leave huddle' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'call' => $call ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/signal$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Chat_Calls::user_is_participant( $row, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$payload = isset( $body['payload'] ) && is_array( $body['payload'] ) ? $body['payload'] : array();
			if ( empty( $payload ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'payload required' ), 400 );
				return;
			}
			$ok = Flowbie_App_Chat_Calls::append_signal( $call_id, $user_id, $payload );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => $ok ) );
			return;
		}

		if ( preg_match( '#^calls/(\d+)/signals$#', $sub, $m ) && $method === 'GET' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Chat_Calls::user_is_participant( $row, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$since = isset( $_GET['since'] ) ? (int) $_GET['since'] : 0;
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'signals' => Flowbie_App_Chat_Calls::list_signals_since( $call_id, $since ),
				)
			);
			return;
		}

		if ( preg_match( '#^calls/(\d+)/flo-transcribe$#', $sub, $m ) && $method === 'POST' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Chat_Calls::user_is_participant( $row, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$data_b64     = isset( $body['dataBase64'] ) ? (string) $body['dataBase64'] : '';
			$format       = isset( $body['format'] ) ? sanitize_text_field( (string) $body['format'] ) : 'webm';
			$spoken_at_ms = isset( $body['spokenAtMs'] ) ? (int) $body['spokenAtMs'] : 0;
			$display_name = isset( $body['displayName'] ) ? sanitize_text_field( (string) $body['displayName'] ) : '';
			if ( $data_b64 === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'dataBase64 required' ), 400 );
				return;
			}
			Flowbie_App_Chat_Openrouter::use_request_api_key(
				Flowbie_App_Chat_Openrouter::api_key_from_request( $body )
			);
			$result = Flowbie_App_Chat_Flo::handle_flo_call_audio(
				$team_id,
				$call_id,
				$user_id,
				$display_name,
				$data_b64,
				$format,
				$spoken_at_ms
			);
			Flowbie_App_Chat_Openrouter::clear_request_api_key();
			if ( ! is_array( $result ) || empty( $result['ok'] ) ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'    => false,
						'error' => isset( $result['error'] ) ? (string) $result['error'] : 'No speech detected',
						'code'  => isset( $result['code'] ) ? (string) $result['code'] : 'no_speech',
					),
					400
				);
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'userText'  => $result['userText'] ?? '',
					'floLine'   => $result['floLine'] ?? null,
					'addressed' => ! empty( $result['addressed'] ),
				)
			);
			return;
		}

		if ( preg_match( '#^calls/(\d+)/transcript$#', $sub, $m ) ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Chat_Calls::user_is_participant( $row, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( $method === 'GET' ) {
				Flowbie_App_Api_Dispatcher::send_json(
					array(
						'ok'         => true,
						'transcript' => Flowbie_App_Chat_Calls::get_merged_transcript( $call_id ),
					)
				);
				return;
			}
			if ( $method === 'POST' ) {
				$text         = isset( $body['text'] ) ? (string) $body['text'] : '';
				$display_name = isset( $body['displayName'] ) ? sanitize_text_field( (string) $body['displayName'] ) : '';
				$spoken_at_ms = isset( $body['spokenAtMs'] ) ? (int) $body['spokenAtMs'] : 0;
				$ok           = Flowbie_App_Chat_Calls::append_transcript( $call_id, $user_id, $display_name, $text, $spoken_at_ms );
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => $ok ) );
				return;
			}
		}

		if ( preg_match( '#^calls/(\d+)$#', $sub, $m ) && $method === 'GET' ) {
			$call_id = (int) $m[1];
			$row     = Flowbie_App_Chat_Calls::get_call( $call_id );
			if ( ! $row || (int) $row['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Chat_Calls::user_is_participant( $row, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'   => true,
					'call' => Flowbie_App_Chat_Calls::format_call( $row ),
				)
			);
			return;
		}

		if ( $sub === 'preferences' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'prefs' => Flowbie_App_Chat_Preferences::get_for_user( $team_id, $user_id ),
				)
			);
			return;
		}

		if ( $sub === 'preferences' && $method === 'PATCH' ) {
			$merged = Flowbie_App_Chat_Preferences::patch_for_user( $team_id, $user_id, $body );
			if ( ! is_array( $merged ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid preferences' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'prefs' => $merged,
				)
			);
			return;
		}

		if ( $sub === 'preferences/avatar' && $method === 'POST' ) {
			$data_b64  = isset( $body['dataBase64'] ) ? (string) $body['dataBase64'] : '';
			$mime      = isset( $body['mime'] ) ? (string) $body['mime'] : '';
			$file_name = isset( $body['fileName'] ) ? (string) $body['fileName'] : 'avatar.jpg';
			if ( $data_b64 === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'dataBase64 required' ), 400 );
				return;
			}
			$binary = base64_decode( $data_b64, true );
			if ( $binary === false ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid base64' ), 400 );
				return;
			}
			$result = Flowbie_App_Chat_Preferences::upload_avatar( $user_id, $file_name, $mime, $binary );
			if ( ! is_array( $result ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Upload failed' ), 500 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'        => true,
					'avatarUrl' => $result['avatarUrl'],
				)
			);
			return;
		}

		if ( $sub === 'mentions/unread-count' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'count' => Flowbie_App_Chat_Mentions::count_unread( $team_id, $user_id ),
				)
			);
			return;
		}

		if ( $sub === 'mentions/read' && $method === 'POST' ) {
			$message_id = isset( $body['messageId'] ) ? (int) $body['messageId'] : 0;
			if ( $message_id <= 0 ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'messageId required' ), 400 );
				return;
			}
			Flowbie_App_Chat_Mentions::mark_read_for_message( $user_id, $message_id );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( $sub === 'mentions' && $method === 'GET' ) {
			$limit       = isset( $_GET['limit'] ) ? (int) $_GET['limit'] : 50;
			$unread_only = isset( $_GET['unread'] ) && (string) $_GET['unread'] === '1';
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'mentions' => Flowbie_App_Chat_Mentions::list_for_user( $team_id, $user_id, $limit, $unread_only ),
				)
			);
			return;
		}

		if ( $sub === 'preview-link' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$url    = isset( $body['url'] ) ? (string) $body['url'] : '';
			$result = Flowbie_App_Chat_Link_Unfurl::preview_url( $url );
			Flowbie_App_Api_Dispatcher::send_json( $result, ! empty( $result['ok'] ) ? 200 : 400 );
			return;
		}

		if ( $sub === 'channels' && $method === 'GET' ) {
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'channels' => Flowbie_App_Chat_Store::list_channels_for_user( $team_id, $user_id ),
				)
			);
			return;
		}

		if ( $sub === 'channels' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$name = isset( $body['name'] ) ? sanitize_text_field( (string) $body['name'] ) : '';
			$type = isset( $body['type'] ) ? sanitize_text_field( (string) $body['type'] ) : 'public';
			if ( $name === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Name required' ), 400 );
				return;
			}
			if ( ! in_array( $type, array( 'public', 'private' ), true ) ) {
				$type = 'public';
			}
			$member_ids = array();
			if ( isset( $body['memberUserIds'] ) && is_array( $body['memberUserIds'] ) ) {
				foreach ( $body['memberUserIds'] as $uid ) {
					$member_ids[] = (int) $uid;
				}
			}
			$slug    = Flowbie_App_Chat_Store::unique_channel_slug( $team_id, $name );
			$channel = Flowbie_App_Chat_Store::create_channel( $team_id, $user_id, $type, $name, $slug, $member_ids );
			if ( ! $channel ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Failed to create channel' ), 500 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'channel' => Flowbie_App_Chat_Store::format_channel_payload( $channel, $user_id, $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'dms' && $method === 'POST' ) {
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$other_id = isset( $body['userId'] ) ? (int) $body['userId'] : 0;
			if ( $other_id <= 0 ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'userId required' ), 400 );
				return;
			}
			$channel = Flowbie_App_Chat_Store::get_or_create_dm( $team_id, $user_id, $other_id );
			if ( ! $channel ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not open DM' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'channel' => Flowbie_App_Chat_Store::format_channel_payload( $channel, $user_id, $team_id ),
				)
			);
			return;
		}

		if ( preg_match( '#^channels/(\d+)/messages/search$#', $sub, $m ) && $method === 'GET' ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$q      = isset( $_GET['q'] ) ? (string) $_GET['q'] : '';
			$limit  = isset( $_GET['limit'] ) ? (int) $_GET['limit'] : 50;
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'messages' => Flowbie_App_Chat_Store::search_channel_messages( $channel_id, $q, $limit ),
				)
			);
			return;
		}

		if ( preg_match( '#^channels/(\d+)/messages$#', $sub, $m ) ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( $method === 'GET' ) {
				$after  = isset( $_GET['after'] ) ? (int) $_GET['after'] : 0;
				$before = isset( $_GET['before'] ) ? (int) $_GET['before'] : 0;
				$limit  = isset( $_GET['limit'] ) ? (int) $_GET['limit'] : 50;
				$scope  = isset( $_GET['scope'] ) ? sanitize_text_field( (string) $_GET['scope'] ) : 'channel';
				$parent = isset( $_GET['parentId'] ) ? (int) $_GET['parentId'] : 0;
				$messages = Flowbie_App_Chat_Store::list_messages( $channel_id, $after, $before, $limit, $scope, $parent );
				$include_thread = isset( $_GET['includeThreadUnread'] ) && (string) $_GET['includeThreadUnread'] === '1';
				if ( $include_thread && $scope === 'channel' ) {
					$messages = Flowbie_App_Chat_Store::enrich_messages_thread_unread( $messages, $channel_id, $user_id );
				}
				$payload = array(
					'ok'       => true,
					'messages' => $messages,
					'typingUsers' => Flowbie_App_Chat_Typing::list_active( $channel_id, $user_id ),
				);
				if ( $include_thread ) {
					$payload['threadsUnread'] = Flowbie_App_Chat_Store::threads_with_unread( $channel_id, $user_id );
				}
				Flowbie_App_Api_Dispatcher::send_json( $payload );
				return;
			}
			if ( $method === 'POST' ) {
				if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
					return;
				}
				$body_html   = isset( $body['bodyHtml'] ) ? (string) $body['bodyHtml'] : '';
				$parent_id   = isset( $body['parentMessageId'] ) ? (int) $body['parentMessageId'] : null;
				$asset_ids   = self::parse_asset_ids( $body );
				$mention_ids = Flowbie_App_Chat_Mentions::merge_mentioned_user_ids_from_body( $body );
				$message     = Flowbie_App_Chat_Store::create_message( $channel_id, $user_id, $body_html, $parent_id ?: null, $asset_ids, $mention_ids );
				if ( ! $message ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Empty message' ), 400 );
					return;
				}
				$flo_reply = null;
				if ( class_exists( 'Flowbie_App_Chat_Flo' ) ) {
					Flowbie_App_Chat_Openrouter::use_request_api_key(
						Flowbie_App_Chat_Openrouter::api_key_from_request( $body )
					);
					$flo_reply = Flowbie_App_Chat_Flo::maybe_reply_to_message( $team_id, $channel_id, $message, $user_id, $mention_ids );
					Flowbie_App_Chat_Openrouter::clear_request_api_key();
				}
				$payload = array( 'ok' => true, 'message' => $message );
				if ( is_array( $flo_reply ) ) {
					$payload['floReply'] = $flo_reply;
				}
				if ( class_exists( 'Flowbie_App_Chat_Flo' ) ) {
					$flo_huddle = Flowbie_App_Chat_Flo::maybe_start_huddle_from_message(
						$team_id,
						$channel_id,
						$message,
						$user_id,
						$mention_ids
					);
					if ( is_array( $flo_huddle ) ) {
						$payload['floHuddle'] = $flo_huddle;
					}
				}
				Flowbie_App_Api_Dispatcher::send_json( $payload );
				return;
			}
		}

		if ( preg_match( '#^channels/(\d+)/files/(\d+)$#', $sub, $m ) && $method === 'DELETE' ) {
			$channel_id = (int) $m[1];
			$asset_id   = (int) $m[2];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$is_admin = in_array( (string) $member['access_role'], array( 'owner', 'admin' ), true );
			$result   = Flowbie_App_Chat_Assets::delete_asset( $team_id, $channel_id, $asset_id, $user_id, $is_admin );
			if ( ! $result ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'asset' => $result ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/files/(\d+)$#', $sub, $m ) && $method === 'GET' ) {
			$channel_id = (int) $m[1];
			$asset_id   = (int) $m[2];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$file = Flowbie_App_Chat_Assets::serve_download( $team_id, $channel_id, $asset_id, $user_id );
			if ( ! $file ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$inline = isset( $_GET['inline'] ) && (string) $_GET['inline'] === '1';
			$is_image = strpos( (string) $file['mime'], 'image/' ) === 0;
			status_header( 200 );
			header( 'Content-Type: ' . $file['mime'] );
			if ( $inline && $is_image ) {
				header( 'Content-Disposition: inline; filename="' . basename( $file['file_name'] ) . '"' );
			} else {
				header( 'Content-Disposition: attachment; filename="' . basename( $file['file_name'] ) . '"' );
			}
			readfile( $file['path'] );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/files$#', $sub, $m ) && $method === 'POST' ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$file_name = isset( $body['fileName'] ) ? (string) $body['fileName'] : '';
			$mime      = isset( $body['mime'] ) ? (string) $body['mime'] : '';
			$b64       = isset( $body['dataBase64'] ) ? (string) $body['dataBase64'] : '';
			if ( $file_name === '' || $b64 === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'fileName and dataBase64 required' ), 400 );
				return;
			}
			$binary = base64_decode( $b64, true );
			if ( ! is_string( $binary ) || $binary === '' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Invalid file data' ), 400 );
				return;
			}
			if ( $mime === '' ) {
				$mime = 'application/octet-stream';
			}
			$asset = Flowbie_App_Chat_Assets::upload( $team_id, $channel_id, $user_id, $file_name, $mime, $binary );
			if ( ! $asset ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Upload failed' ), 400 );
				return;
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'asset' => $asset ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/activity-log$#', $sub, $m ) && $method === 'GET' ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$filters = array(
				'limit'  => isset( $_GET['limit'] ) ? (int) $_GET['limit'] : 50,
				'after'  => isset( $_GET['after'] ) ? (int) $_GET['after'] : 0,
				'userId' => isset( $_GET['userId'] ) ? (int) $_GET['userId'] : 0,
				'kind'   => isset( $_GET['kind'] ) ? (string) $_GET['kind'] : '',
			);
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'items' => Flowbie_App_Chat_Activity_Log::list_for_channel( $team_id, $channel_id, $filters ),
				)
			);
			return;
		}

		if ( preg_match( '#^channels/(\d+)/messages/(\d+)/thread$#', $sub, $m ) && $method === 'GET' ) {
			$channel_id = (int) $m[1];
			$parent_id  = (int) $m[2];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$messages = Flowbie_App_Chat_Store::list_messages( $channel_id, 0, 0, 100, 'thread', $parent_id );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'messages' => $messages ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/threads/(\d+)/read$#', $sub, $m ) && $method === 'POST' ) {
			$channel_id = (int) $m[1];
			$root_id    = (int) $m[2];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$message_id = isset( $body['messageId'] ) ? (int) $body['messageId'] : 0;
			if ( $message_id > 0 ) {
				Flowbie_App_Chat_Store::mark_thread_read( $channel_id, $user_id, $root_id, $message_id );
			}
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/typing$#', $sub, $m ) && $method === 'POST' ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			Flowbie_App_Chat_Typing::heartbeat( $channel_id, $user_id );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( $sub === 'shared-search' && $method === 'GET' ) {
			$filters = array(
				'q'                  => isset( $_GET['q'] ) ? (string) $_GET['q'] : '',
				'channelId'          => isset( $_GET['channelId'] ) ? (int) $_GET['channelId'] : 0,
				'userId'             => isset( $_GET['userId'] ) ? (int) $_GET['userId'] : 0,
				'kind'               => isset( $_GET['kind'] ) ? (string) $_GET['kind'] : '',
				'scope'              => isset( $_GET['scope'] ) ? (string) $_GET['scope'] : 'all',
				'threadRootMessageId'=> isset( $_GET['threadRootMessageId'] ) ? (int) $_GET['threadRootMessageId'] : 0,
				'limit'              => isset( $_GET['limit'] ) ? (int) $_GET['limit'] : 50,
				'after'              => isset( $_GET['after'] ) ? (int) $_GET['after'] : 0,
			);
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'    => true,
					'items' => Flowbie_App_Chat_Activity_Log::search_shared( $team_id, $user_id, $filters ),
				)
			);
			return;
		}

		if ( preg_match( '#^channels/(\d+)/read$#', $sub, $m ) && $method === 'POST' ) {
			$channel_id = (int) $m[1];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$message_id = isset( $body['messageId'] ) ? (int) $body['messageId'] : 0;
			Flowbie_App_Chat_Store::mark_read( $channel_id, $user_id, $message_id );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)/members$#', $sub, $m ) && $method === 'POST' ) {
			$channel_id = (int) $m[1];
			$channel    = Flowbie_App_Chat_Store::get_channel( $channel_id );
			if ( ! $channel || (int) $channel['team_id'] !== $team_id || (string) $channel['type'] !== 'private' ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$member_ids = array();
			if ( isset( $body['memberUserIds'] ) && is_array( $body['memberUserIds'] ) ) {
				foreach ( $body['memberUserIds'] as $uid ) {
					$member_ids[] = (int) $uid;
				}
			}
			Flowbie_App_Chat_Store::add_channel_members( $channel_id, $member_ids );
			Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
			return;
		}

		if ( preg_match( '#^channels/(\d+)$#', $sub, $m ) && $method === 'PATCH' ) {
			$channel_id = (int) $m[1];
			$channel    = Flowbie_App_Chat_Store::get_channel( $channel_id );
			if ( ! $channel || (int) $channel['team_id'] !== $team_id ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			$updates = array();
			if ( isset( $body['name'] ) ) {
				$updates['name'] = sanitize_text_field( (string) $body['name'] );
			}
			if ( ! empty( $body['archived'] ) ) {
				$updates['archived'] = true;
			}
			if ( array_key_exists( 'topic', $body ) ) {
				$updates['topic'] = sanitize_text_field( (string) $body['topic'] );
			}
			Flowbie_App_Chat_Store::patch_channel( $channel_id, $updates );
			$updated = Flowbie_App_Chat_Store::get_channel( $channel_id );
			Flowbie_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'channel' => $updated ? Flowbie_App_Chat_Store::format_channel_payload( $updated, $user_id, $team_id ) : null,
				)
			);
			return;
		}

		if ( preg_match( '#^messages/(\d+)$#', $sub, $m ) ) {
			$message_id = (int) $m[1];
			$row        = Flowbie_App_Chat_Store::get_message( $message_id );
			if ( ! $row ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
				return;
			}
			$channel_id = (int) $row['channel_id'];
			if ( ! Flowbie_App_Chat_Store::user_can_access_channel( $channel_id, $team_id, $user_id ) ) {
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
				return;
			}
			if ( $method === 'PATCH' ) {
				if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
					return;
				}
				$body_html = isset( $body['bodyHtml'] ) ? (string) $body['bodyHtml'] : '';
				$asset_ids = self::parse_asset_ids( $body );
				$mention_ids = Flowbie_App_Chat_Mentions::parse_mentioned_user_ids_from_body( $body );
				$message   = Flowbie_App_Chat_Store::edit_message( $message_id, $user_id, $body_html, $asset_ids, $mention_ids );
				if ( ! $message ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Cannot edit message' ), 400 );
					return;
				}
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => true, 'message' => $message ) );
				return;
			}
			if ( $method === 'DELETE' ) {
				$is_admin = in_array( (string) $member['access_role'], array( 'owner', 'admin' ), true );
				if ( ! Flowbie_App_Teams_Store::can_write( $member, 'communication' ) ) {
					Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
					return;
				}
				$deleted = Flowbie_App_Chat_Store::delete_message( $message_id, $user_id, $is_admin );
				Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => $deleted ) );
				return;
			}
		}

		Flowbie_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<int,int>
	 */
	private static function parse_asset_ids( array $body ): array {
		$out = array();
		if ( ! isset( $body['attachmentAssetIds'] ) || ! is_array( $body['attachmentAssetIds'] ) ) {
			return $out;
		}
		foreach ( $body['attachmentAssetIds'] as $id ) {
			$id = (int) $id;
			if ( $id > 0 ) {
				$out[] = $id;
			}
		}
		return array_values( array_unique( $out ) );
	}
}

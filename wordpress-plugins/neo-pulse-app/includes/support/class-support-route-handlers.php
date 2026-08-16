<?php
/**
 * /api/teams/{id}/support/* route handlers.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Support_Route_Handlers {

	/**
	 * @param array<string,mixed> $team
	 * @param array<string,mixed> $member
	 * @param string              $sub
	 * @param string              $method
	 * @param array<string,mixed> $body
	 * @param int                 $user_id
	 */
	public static function dispatch( array $team, array $member, string $sub, string $method, array $body, int $user_id ): void {
		Neo_Pulse_App_Support_Store::install_tables();
		$team_id = (int) $team['id'];
		$sub     = trim( $sub, '/' );
		$method  = strtoupper( $method );

		if ( ! Neo_Pulse_App_Support_Store::is_active_member( $member ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Forbidden' ), 403 );
			return;
		}

		if ( $sub === 'export' && $method === 'GET' ) {
			$bundle = Neo_Pulse_App_Support_Store::export_all( $team );
			header( 'Content-Type: application/json; charset=utf-8' );
			header(
				'Content-Disposition: attachment; filename="' . rawurlencode(
					'support-tickets-' . sanitize_file_name( (string) ( $team['slug'] ?? 'team' ) ) . '-' . gmdate( 'Ymd-His' ) . '.json'
				) . '"'
			);
			echo wp_json_encode( $bundle, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
			exit;
		}

		if ( $sub === 'tickets/preview-ai' && $method === 'POST' ) {
			self::send_ai_result( Neo_Pulse_App_Support_Ai::generate_title_summary( $body ) );
			return;
		}

		if ( $sub === 'tickets' && $method === 'GET' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'tickets' => Neo_Pulse_App_Support_Store::list_tickets( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'tickets' && $method === 'DELETE' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'           => true,
					'deletedCount' => Neo_Pulse_App_Support_Store::delete_all_tickets( $team_id ),
				)
			);
			return;
		}

		if ( $sub === 'tickets' && $method === 'POST' ) {
			$title   = isset( $body['title'] ) ? trim( (string) $body['title'] ) : '';
			$summary = isset( $body['summary'] ) ? trim( (string) $body['summary'] ) : '';
			if ( $title === '' || $summary === '' ) {
				$ai = Neo_Pulse_App_Support_Ai::generate_title_summary( $body );
				if ( empty( $ai['ok'] ) ) {
					Neo_Pulse_App_Api_Dispatcher::send_json(
						array(
							'ok'    => false,
							'error' => (string) ( $ai['error'] ?? 'Could not generate ticket details' ),
						),
						400
					);
					return;
				}
				if ( $title === '' ) {
					$body['title'] = (string) ( $ai['title'] ?? '' );
				}
				if ( $summary === '' ) {
					$body['summary'] = (string) ( $ai['summary'] ?? '' );
				}
			}

			$ticket = Neo_Pulse_App_Support_Store::create_ticket( $team_id, $user_id, $body );
			if ( ! $ticket ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not create ticket' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'     => true,
					'ticket' => $ticket,
				)
			);
			return;
		}

		if ( preg_match( '#^tickets/(\d+)$#', $sub, $m ) ) {
			$ticket_id = (int) $m[1];
			if ( $method === 'GET' ) {
				$ticket = Neo_Pulse_App_Support_Store::get_ticket( $team_id, $ticket_id );
				if ( ! $ticket ) {
					Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Neo_Pulse_App_Api_Dispatcher::send_json(
					array(
						'ok'     => true,
						'ticket' => $ticket,
					)
				);
				return;
			}
			if ( $method === 'PATCH' ) {
				$ticket = Neo_Pulse_App_Support_Store::patch_ticket( $team_id, $ticket_id, $body );
				if ( ! $ticket ) {
					Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Neo_Pulse_App_Api_Dispatcher::send_json(
					array(
						'ok'     => true,
						'ticket' => $ticket,
					)
				);
				return;
			}
			if ( $method === 'DELETE' ) {
				if ( ! Neo_Pulse_App_Support_Store::delete_ticket( $team_id, $ticket_id ) ) {
					Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
					return;
				}
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => true ) );
				return;
			}
		}

		if ( preg_match( '#^tickets/(\d+)/comments$#', $sub, $m ) && $method === 'POST' ) {
			$ticket_id = (int) $m[1];
			$body_text = isset( $body['body'] ) ? (string) $body['body'] : '';
			$comment   = Neo_Pulse_App_Support_Store::add_comment( $team_id, $ticket_id, $user_id, $body_text );
			if ( ! $comment ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Could not add comment' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => true,
					'comment' => $comment,
					'ticket'  => Neo_Pulse_App_Support_Store::get_ticket( $team_id, $ticket_id ),
				)
			);
			return;
		}

		if ( preg_match( '#^tickets/(\d+)/chat-log$#', $sub, $m ) && $method === 'GET' ) {
			Neo_Pulse_App_Support_Store::serve_chat_log( $team_id, (int) $m[1] );
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'ok' => false, 'error' => 'Not found' ), 404 );
	}

	/**
	 * @param array{ok?:bool,title?:string,summary?:string,error?:string} $ai
	 */
	private static function send_ai_result( array $ai ): void {
		if ( empty( $ai['ok'] ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => (string) ( $ai['error'] ?? 'Could not generate ticket details' ),
				),
				400
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'      => true,
				'title'   => (string) ( $ai['title'] ?? '' ),
				'summary' => (string) ( $ai['summary'] ?? '' ),
			)
		);
	}
}

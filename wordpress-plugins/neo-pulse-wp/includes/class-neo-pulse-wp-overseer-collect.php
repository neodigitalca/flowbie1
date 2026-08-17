<?php
/**
 * Overseer REST collector for front-end pageview beacons.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Overseer_Collect {

	const REST_NAMESPACE = 'neo-pulse/v1';
	const RATE_LIMIT_TTL = 60;
	const RATE_LIMIT_MAX = 120;

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/overseer/collect',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_collect' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_collect( WP_REST_Request $request ) {
		if ( ! Neo_Pulse_Wp_Overseer::is_tracking_active() ) {
			return new WP_REST_Response(
				array( 'ok' => false, 'error' => 'tracking_disabled' ),
				403
			);
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! is_string( $nonce ) || $nonce === '' ) {
			$nonce = $request->get_param( '_wpnonce' );
		}
		if ( ! is_string( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error(
				'neo-pulse_overseer_invalid_nonce',
				__( 'Invalid security token.', 'neo-pulse-wp' ),
				array( 'status' => 403 )
			);
		}

		if ( self::is_rate_limited() ) {
			return new WP_Error(
				'neo-pulse_overseer_rate_limited',
				__( 'Too many requests. Please wait a moment.', 'neo-pulse-wp' ),
				array( 'status' => 429 )
			);
		}
		self::mark_rate_limited();

		$body = $request->get_json_params();
		if ( ! is_array( $body ) || empty( $body ) ) {
			$raw = $request->get_body();
			if ( is_string( $raw ) && $raw !== '' ) {
				$decoded = json_decode( $raw, true );
				if ( is_array( $decoded ) ) {
					$body = $decoded;
				}
			}
		}
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$events = array();
		if ( isset( $body['events'] ) && is_array( $body['events'] ) ) {
			foreach ( $body['events'] as $event ) {
				if ( is_array( $event ) ) {
					$events[] = $event;
				}
			}
		} else {
			$events[] = $body;
		}

		$utm = array();
		if ( isset( $body['utm'] ) && is_array( $body['utm'] ) ) {
			foreach ( array( 'source', 'medium', 'campaign', 'term', 'content' ) as $key ) {
				if ( isset( $body['utm'][ $key ] ) ) {
					$utm[ $key ] = sanitize_text_field( (string) $body['utm'][ $key ] );
				}
			}
		}

		$client_meta = array();
		if ( ! empty( $utm ) ) {
			$client_meta['utm'] = $utm;
		}
		if ( isset( $body['platform'] ) ) {
			$client_meta['platform'] = sanitize_text_field( (string) $body['platform'] );
		}

		$session_id  = '';
		$visit_uid   = '';
		$last_error  = '';

		foreach ( $events as $event ) {
			if ( ! is_array( $event ) ) {
				continue;
			}

			$event_meta = $client_meta;
			if ( isset( $event['utm'] ) && is_array( $event['utm'] ) ) {
				$event_meta['utm'] = $event['utm'];
			}
			if ( isset( $event['platform'] ) ) {
				$event_meta['platform'] = sanitize_text_field( (string) $event['platform'] );
			}

			$result = Neo_Pulse_Wp_Overseer::record_event(
				array(
					'event_type'       => isset( $event['event_type'] ) ? (string) $event['event_type'] : 'pageview',
					'session_id'       => isset( $event['session_id'] ) ? (string) $event['session_id'] : ( isset( $body['session_id'] ) ? (string) $body['session_id'] : '' ),
					'page_url'         => isset( $event['page_url'] ) ? (string) $event['page_url'] : ( isset( $body['page_url'] ) ? (string) $body['page_url'] : '' ),
					'page_title'       => isset( $event['page_title'] ) ? (string) $event['page_title'] : ( isset( $body['page_title'] ) ? (string) $body['page_title'] : '' ),
					'referrer'         => isset( $event['referrer'] ) ? (string) $event['referrer'] : ( isset( $body['referrer'] ) ? (string) $body['referrer'] : '' ),
					'post_id'          => isset( $event['post_id'] ) ? (int) $event['post_id'] : ( isset( $body['post_id'] ) ? (int) $body['post_id'] : 0 ),
					'screen_width'     => isset( $event['screen_width'] ) ? (int) $event['screen_width'] : ( isset( $body['screen_width'] ) ? (int) $body['screen_width'] : 0 ),
					'screen_height'    => isset( $event['screen_height'] ) ? (int) $event['screen_height'] : ( isset( $body['screen_height'] ) ? (int) $body['screen_height'] : 0 ),
					'language'         => isset( $event['language'] ) ? (string) $event['language'] : ( isset( $body['language'] ) ? (string) $body['language'] : '' ),
					'timezone'         => isset( $event['timezone'] ) ? (string) $event['timezone'] : ( isset( $body['timezone'] ) ? (string) $body['timezone'] : '' ),
					'duration_ms'        => isset( $event['duration_ms'] ) ? (int) $event['duration_ms'] : 0,
					'active_duration_ms' => isset( $event['active_duration_ms'] ) ? (int) $event['active_duration_ms'] : 0,
					'page_load_ms'       => isset( $event['page_load_ms'] ) ? (int) $event['page_load_ms'] : ( isset( $body['page_load_ms'] ) ? (int) $body['page_load_ms'] : 0 ),
					'scroll_depth_pct'   => isset( $event['scroll_depth_pct'] ) ? (int) $event['scroll_depth_pct'] : 0,
					'parent_visit_uid' => isset( $event['parent_visit_uid'] ) ? (string) $event['parent_visit_uid'] : '',
					'element_tag'      => isset( $event['element_tag'] ) ? (string) $event['element_tag'] : '',
					'element_text'     => isset( $event['element_text'] ) ? (string) $event['element_text'] : '',
					'element_href'     => isset( $event['element_href'] ) ? (string) $event['element_href'] : '',
					'client_meta'      => $event_meta,
				)
			);

			if ( ! empty( $result['ok'] ) ) {
				if ( ! empty( $result['session_id'] ) ) {
					$session_id = (string) $result['session_id'];
				}
				if ( ! empty( $result['visit_uid'] ) ) {
					$visit_uid = (string) $result['visit_uid'];
				}
			} elseif ( isset( $result['error'] ) ) {
				$last_error = (string) $result['error'];
				if ( in_array( $last_error, array( 'excluded_admin', 'tracking_disabled', 'interactions_disabled' ), true ) ) {
					break;
				}
			}
		}

		if ( $session_id === '' && $visit_uid === '' ) {
			$error  = $last_error !== '' ? $last_error : 'unknown';
			$status = in_array( $error, array( 'excluded_admin', 'tracking_disabled', 'interactions_disabled' ), true ) ? 403 : 400;
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => $error,
				),
				$status
			);
		}

		return new WP_REST_Response(
			array(
				'ok'         => true,
				'session_id' => $session_id,
				'visit_uid'  => $visit_uid,
			),
			200
		);
	}

	private static function is_rate_limited(): bool {
		$ip  = Neo_Pulse_Wp_Overseer::get_client_ip();
		$key = 'neo-pulse_ov_rl_' . md5( $ip !== '' ? $ip : 'unknown' );
		$hit = get_transient( $key );
		return is_numeric( $hit ) && (int) $hit >= self::RATE_LIMIT_MAX;
	}

	private static function mark_rate_limited(): void {
		$ip  = Neo_Pulse_Wp_Overseer::get_client_ip();
		$key = 'neo-pulse_ov_rl_' . md5( $ip !== '' ? $ip : 'unknown' );
		$hit = get_transient( $key );
		$count = is_numeric( $hit ) ? (int) $hit : 0;
		set_transient( $key, $count + 1, self::RATE_LIMIT_TTL );
	}
}

<?php
/**
 * Shared chat log signal extraction for gap analysis and admin insights.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chat_Insights {

	const MIN_CHIP_CLICKS = 2;

	const DEFAULT_DAYS = 30;

	/**
	 * @param array<string, mixed> $args days, source_filter (all|frontend|demo).
	 * @return array{ok: bool, error?: string, data?: array<string, mixed>}
	 */
	public static function get_insights( array $args = array() ): array {
		if ( ! current_user_can( 'manage_options' ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Analytics requires site admin access.', 'neo-pulse-wp' ),
			);
		}

		$days          = isset( $args['days'] ) ? max( 1, min( 90, (int) $args['days'] ) ) : self::DEFAULT_DAYS;
		$source_filter = isset( $args['source_filter'] ) ? sanitize_key( (string) $args['source_filter'] ) : 'frontend';
		if ( ! in_array( $source_filter, array( 'all', 'frontend', 'demo' ), true ) ) {
			$source_filter = 'frontend';
		}

		$date_to   = gmdate( 'Y-m-d' );
		$date_from = gmdate( 'Y-m-d', time() - ( $days * DAY_IN_SECONDS ) );

		$query_args = array(
			'date_from' => $date_from,
			'date_to'   => $date_to,
			'per_page'  => 400,
			'page'      => 1,
			'orderby'   => 'created_at',
			'order'     => 'asc',
		);
		if ( $source_filter !== 'all' ) {
			$query_args['source'] = $source_filter;
		}

		$messages = Neo_Pulse_Wp_Chat_Logs::fetch_messages_for_analysis( $query_args );
		if ( empty( $messages ) ) {
			return array(
				'ok'   => true,
				'data' => array(
					'date_from'       => $date_from,
					'date_to'         => $date_to,
					'message_count'   => 0,
					'session_count'   => 0,
					'repeated_topics' => array(),
					'top_queries'     => array(),
					'weak_answers'    => array(),
					'clicked_sources' => array(),
				),
			);
		}

		$signals  = self::extract_priority_signals( $messages );
		$sessions = array();
		foreach ( $messages as $msg ) {
			$sid = isset( $msg->session_id ) ? (string) $msg->session_id : '';
			if ( $sid !== '' ) {
				$sessions[ $sid ] = true;
			}
		}

		$repeated = array();
		foreach ( array_slice( $signals['chips'], 0, 15 ) as $row ) {
			$repeated[] = array(
				'text'     => $row['text'],
				'count'    => (int) $row['count'],
				'sessions' => is_array( $row['sessions'] ) ? count( $row['sessions'] ) : 0,
				'context'  => isset( $row['context'] ) ? (string) $row['context'] : '',
			);
		}

		$top_queries = array();
		foreach ( array_slice( $signals['typed'], 0, 15 ) as $row ) {
			$top_queries[] = array(
				'text'     => $row['text'],
				'count'    => (int) $row['count'],
				'sessions' => is_array( $row['sessions'] ) ? count( $row['sessions'] ) : 0,
			);
		}

		$weak = array();
		foreach ( array_slice( $signals['accepted'], 0, 10 ) as $row ) {
			if ( empty( $row['weak'] ) ) {
				continue;
			}
			$weak[] = array(
				'label' => $row['label'],
				'count' => (int) $row['count'],
				'url'   => isset( $row['url'] ) ? (string) $row['url'] : '',
			);
		}

		$clicked = array();
		foreach ( array_slice( $signals['accepted'], 0, 10 ) as $row ) {
			$clicked[] = array(
				'label' => $row['label'],
				'count' => (int) $row['count'],
				'url'   => isset( $row['url'] ) ? (string) $row['url'] : '',
			);
		}

		return array(
			'ok'   => true,
			'data' => array(
				'date_from'         => $date_from,
				'date_to'           => $date_to,
				'message_count'     => count( $messages ),
				'session_count'     => count( $sessions ),
				'repeated_topics'   => $repeated,
				'top_queries'       => $top_queries,
				'weak_answers'      => $weak,
				'clicked_sources'   => $clicked,
				'weak_session_snippets' => array_slice( $signals['secondary'], 0, 8 ),
			),
		);
	}

	/**
	 * @param array<int, object> $messages Messages.
	 * @return array{
	 *   typed: array<int, array{text: string, count: int, sessions: array<int, string>, origin: string}>,
	 *   chips: array<int, array{text: string, count: int, sessions: array<int, string>, origin: string, context: string}>,
	 *   accepted: array<int, array{label: string, count: int, url: string, context: string, weak?: bool}>,
	 *   secondary: array<int, string>,
	 *   predefined_texts: array<int, string>
	 * }
	 */
	public static function extract_priority_signals( array $messages ): array {
		$predefined      = self::predefined_prompt_texts();
		$sessions        = self::group_by_session( $messages );
		$user_sessions   = array();
		$phrase_sessions = array();

		foreach ( $messages as $msg ) {
			if ( ! isset( $msg->role ) || (string) $msg->role !== 'user' ) {
				continue;
			}
			$content = trim( (string) ( $msg->content ?? '' ) );
			if ( $content === '' ) {
				continue;
			}
			$norm = self::normalize_text( $content );
			$sid  = isset( $msg->session_id ) ? (string) $msg->session_id : '';
			if ( $sid === '' ) {
				continue;
			}
			if ( ! isset( $user_sessions[ $norm ] ) ) {
				$user_sessions[ $norm ] = array(
					'sessions' => array(),
					'origins'  => array(),
				);
			}
			$user_sessions[ $norm ]['sessions'][ $sid ] = true;
			$origin = isset( $msg->input_origin ) ? sanitize_key( (string) $msg->input_origin ) : '';
			if ( $origin !== '' ) {
				$user_sessions[ $norm ]['origins'][ $origin ] = true;
			}
			if ( ! isset( $phrase_sessions[ $norm ] ) ) {
				$phrase_sessions[ $norm ] = 0;
			}
			++$phrase_sessions[ $norm ];
		}

		$typed_bucket = array();
		$chip_bucket  = array();

		foreach ( $user_sessions as $norm => $meta ) {
			$sample_msg = null;
			foreach ( $messages as $msg ) {
				if ( ! isset( $msg->role ) || (string) $msg->role !== 'user' ) {
					continue;
				}
				if ( self::normalize_text( (string) ( $msg->content ?? '' ) ) === $norm ) {
					$sample_msg = $msg;
					break;
				}
			}
			if ( null === $sample_msg ) {
				continue;
			}

			$content       = trim( (string) $sample_msg->content );
			$session_count = count( $meta['sessions'] );
			$total_count   = isset( $phrase_sessions[ $norm ] ) ? (int) $phrase_sessions[ $norm ] : 0;
			$origins       = array_keys( $meta['origins'] );
			$origin_label  = ! empty( $origins ) ? implode( '/', $origins ) : 'unknown';
			$row           = array(
				'text'     => $content,
				'count'    => $total_count,
				'sessions' => array_keys( $meta['sessions'] ),
				'origin'   => $origin_label,
			);

			if ( $total_count >= self::MIN_CHIP_CLICKS || $session_count >= self::MIN_CHIP_CLICKS ) {
				$row['context']       = self::assistant_context_for_user_message( $sessions, $sample_msg );
				$chip_bucket[ $norm ] = $row;
				continue;
			}

			$typed_bucket[ $norm ] = $row;
		}

		$accepted_bucket = array();
		foreach ( $messages as $msg ) {
			if ( ! isset( $msg->role ) || (string) $msg->role !== 'assistant' ) {
				continue;
			}
			$label = isset( $msg->accepted_label ) ? trim( (string) $msg->accepted_label ) : '';
			$url   = isset( $msg->accepted_url ) ? trim( (string) $msg->accepted_url ) : '';
			if ( $label === '' && $url === '' ) {
				continue;
			}
			$key        = self::normalize_text( $label !== '' ? $label : $url );
			$confidence = isset( $msg->confidence ) ? (string) $msg->confidence : '';
			$card_type  = isset( $msg->card_type ) ? (string) $msg->card_type : '';
			$weak       = ( $confidence === 'low' || $card_type === 'not-found' );
			if ( ! isset( $accepted_bucket[ $key ] ) ) {
				$accepted_bucket[ $key ] = array(
					'label'   => $label !== '' ? $label : $url,
					'count'   => 0,
					'url'     => $url,
					'context' => trim( (string) ( $msg->content ?? '' ) ),
					'weak'    => $weak,
				);
			}
			++$accepted_bucket[ $key ]['count'];
			if ( $weak ) {
				$accepted_bucket[ $key ]['weak'] = true;
			}
		}

		return array(
			'typed'            => array_values( $typed_bucket ),
			'chips'            => array_values( $chip_bucket ),
			'accepted'         => array_values( $accepted_bucket ),
			'secondary'        => self::build_secondary_context( $sessions ),
			'predefined_texts' => $predefined,
		);
	}

	public static function normalize_text( string $text ): string {
		$text = strtolower( trim( $text ) );
		$text = preg_replace( '/\s+/', ' ', $text );
		return is_string( $text ) ? $text : '';
	}

	/**
	 * @return array<int, string>
	 */
	private static function predefined_prompt_texts(): array {
		$settings = Neo_Pulse_Wp_Chat::get_settings();
		$texts    = Neo_Pulse_Wp_Chat_Starters::get( $settings );
		$texts[]  = __( 'Summarize this page', 'neo-pulse-wp' );
		$out      = array();
		foreach ( $texts as $text ) {
			$norm = self::normalize_text( (string) $text );
			if ( $norm !== '' ) {
				$out[] = $norm;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param array<int, object> $messages Messages.
	 * @return array<string, array<int, array<string, string>>>
	 */
	private static function group_by_session( array $messages ): array {
		$sessions = array();
		foreach ( $messages as $msg ) {
			$sid = isset( $msg->session_id ) ? (string) $msg->session_id : '';
			if ( $sid === '' ) {
				continue;
			}
			if ( ! isset( $sessions[ $sid ] ) ) {
				$sessions[ $sid ] = array();
			}
			$content = isset( $msg->content ) ? (string) $msg->content : '';
			if ( strlen( $content ) > 1200 ) {
				$content = substr( $content, 0, 1200 ) . '…';
			}
			$sessions[ $sid ][] = array(
				'role'       => isset( $msg->role ) ? (string) $msg->role : '',
				'content'    => $content,
				'card_type'  => isset( $msg->card_type ) ? (string) $msg->card_type : '',
				'confidence' => isset( $msg->confidence ) ? (string) $msg->confidence : '',
				'page_url'   => isset( $msg->page_url ) ? (string) $msg->page_url : '',
				'created_at' => isset( $msg->created_at ) ? (string) $msg->created_at : '',
				'source'     => isset( $msg->source ) ? (string) $msg->source : '',
			);
		}
		return $sessions;
	}

	/**
	 * @param array<string, array<int, array<string, string>>> $sessions
	 */
	private static function assistant_context_for_user_message( array $sessions, object $user_msg ): string {
		$sid = isset( $user_msg->session_id ) ? (string) $user_msg->session_id : '';
		if ( $sid === '' || ! isset( $sessions[ $sid ] ) ) {
			return '';
		}
		$turns   = $sessions[ $sid ];
		$found   = false;
		$context = '';
		foreach ( $turns as $turn ) {
			if ( $found && $turn['role'] === 'assistant' ) {
				$parts = array();
				if ( $turn['card_type'] !== '' ) {
					$parts[] = 'type=' . $turn['card_type'];
				}
				if ( $turn['confidence'] !== '' ) {
					$parts[] = 'confidence=' . $turn['confidence'];
				}
				$meta    = ! empty( $parts ) ? ' [' . implode( ', ', $parts ) . ']' : '';
				$context = 'ASSISTANT' . $meta . ': ' . substr( $turn['content'], 0, 400 );
				break;
			}
			if ( $turn['role'] === 'user' && self::normalize_text( $turn['content'] ) === self::normalize_text( (string) $user_msg->content ) ) {
				$found = true;
			}
		}
		return $context;
	}

	/**
	 * @param array<string, array<int, array<string, string>>> $sessions
	 * @return array<int, string>
	 */
	private static function build_secondary_context( array $sessions ): array {
		$lines = array();
		$count = 0;
		foreach ( $sessions as $session_id => $turns ) {
			$has_weak = false;
			foreach ( $turns as $turn ) {
				if ( $turn['role'] === 'assistant' && ( $turn['confidence'] === 'low' || $turn['card_type'] === 'not-found' ) ) {
					$has_weak = true;
					break;
				}
			}
			if ( ! $has_weak ) {
				continue;
			}
			++$count;
			if ( $count > 25 ) {
				$lines[] = '… additional weak-answer sessions omitted …';
				break;
			}
			$lines[] = "\n### Session: {$session_id}";
			foreach ( $turns as $turn ) {
				if ( $turn['role'] === 'assistant' ) {
					if ( $turn['confidence'] !== 'low' && $turn['card_type'] !== 'not-found' ) {
						continue;
					}
					$meta = '';
					if ( $turn['card_type'] !== '' || $turn['confidence'] !== '' ) {
						$meta = ' [' . trim( $turn['card_type'] . ', confidence=' . $turn['confidence'], ', ' ) . ']';
					}
					$lines[] = 'ASSISTANT' . $meta . ': ' . substr( $turn['content'], 0, 400 );
					continue;
				}
				$lines[] = 'USER: ' . substr( $turn['content'], 0, 300 );
			}
		}
		return $lines;
	}
}

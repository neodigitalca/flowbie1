<?php
/**
 * AI analysis of Flow Assist chat logs (WP-local OpenRouter only).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Chat_Logs_Analysis {

	const DEFAULT_MODEL = 'google/gemini-2.5-flash';

	const MAX_MESSAGES = 400;

	/**
	 * @return string
	 */
	public static function get_model(): string {
		if ( defined( 'NEO_PULSE_WP_CHAT_LOG_ANALYSIS_MODEL' ) && NEO_PULSE_WP_CHAT_LOG_ANALYSIS_MODEL !== '' ) {
			return trim( (string) NEO_PULSE_WP_CHAT_LOG_ANALYSIS_MODEL );
		}
		return self::DEFAULT_MODEL;
	}

	/**
	 * @param array<string, mixed> $args date_from, date_to, source_filter (all|frontend|demo).
	 * @return array{ok: bool, report_id?: int, error?: string}
	 */
	public static function run( array $args ) {
		$date_from = isset( $args['date_from'] ) ? sanitize_text_field( (string) $args['date_from'] ) : '';
		$date_to   = isset( $args['date_to'] ) ? sanitize_text_field( (string) $args['date_to'] ) : '';
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Please choose a valid date range.', 'neo-pulse-wp' ),
			);
		}

		$source_filter = isset( $args['source_filter'] ) ? sanitize_key( (string) $args['source_filter'] ) : 'all';
		if ( ! in_array( $source_filter, array( 'all', 'frontend', 'demo' ), true ) ) {
			$source_filter = 'all';
		}

		$query_args = array(
			'date_from' => $date_from,
			'date_to'   => $date_to,
			'per_page'  => self::MAX_MESSAGES,
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
				'ok'    => false,
				'error' => __( 'No chat messages found for this date range.', 'neo-pulse-wp' ),
			);
		}

		$sessions = self::group_by_session( $messages );
		$prompt   = self::build_user_prompt( $sessions, $date_from, $date_to, $source_filter );
		$system   = self::system_prompt();

		$model = self::get_model();
		$body  = Neo_Pulse_Wp_OpenRouter::complete_agency_only( $system, $prompt, $model, 8192, 0.4 );
		if ( is_wp_error( $body ) ) {
			return array(
				'ok'    => false,
				'error' => $body->get_error_message(),
			);
		}

		$session_ids = array_keys( $sessions );
		$save        = Neo_Pulse_Wp_Chat_Logs::save_report(
			array(
				'date_from'      => $date_from,
				'date_to'        => $date_to,
				'source_filter'  => $source_filter,
				'session_count'  => count( $session_ids ),
				'message_count'  => count( $messages ),
				'model'          => $model,
				'body'           => $body,
			)
		);

		if ( empty( $save['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => isset( $save['error'] ) ? (string) $save['error'] : __( 'Could not save report.', 'neo-pulse-wp' ),
			);
		}

		return array(
			'ok'        => true,
			'report_id' => (int) $save['id'],
		);
	}

	private static function system_prompt(): string {
		return implode(
			"\n",
			array(
				'You are an expert UX and content strategist reviewing Flow Assist chat transcripts for a WordPress website.',
				'Produce a clear markdown report for the site owner.',
				'Sections required:',
				'## Executive summary',
				'## Recurring user intents',
				'## Problem patterns (failed answers, low confidence, not-found cards)',
				'## Content gaps (topics users ask about that the site may not cover well)',
				'## Recommended changes',
				'- System prompt / assistant training adjustments (specific wording suggestions)',
				'- Knowledge base additions',
				'- Site pages or posts to create or improve',
				'## Priority action list (numbered, most impactful first)',
				'Be specific and reference session IDs when citing examples. Do not invent conversations not present in the data.',
			)
		);
	}

	/**
	 * @param array<int, object> $messages Messages.
	 * @return array<string, array<int, array{role: string, content: string, card_type: string, confidence: string, page_url: string, created_at: string}>>
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
				'role'        => isset( $msg->role ) ? (string) $msg->role : '',
				'content'     => $content,
				'card_type'   => isset( $msg->card_type ) ? (string) $msg->card_type : '',
				'confidence'  => isset( $msg->confidence ) ? (string) $msg->confidence : '',
				'page_url'    => isset( $msg->page_url ) ? (string) $msg->page_url : '',
				'created_at'  => isset( $msg->created_at ) ? (string) $msg->created_at : '',
				'source'      => isset( $msg->source ) ? (string) $msg->source : '',
			);
		}
		return $sessions;
	}

	/**
	 * @param array<string, array<int, array<string, string>>> $sessions Grouped sessions.
	 */
	private static function build_user_prompt( array $sessions, string $date_from, string $date_to, string $source_filter ): string {
		$site_name = get_bloginfo( 'name' );
		$lines     = array(
			'Site: ' . $site_name,
			'Date range: ' . $date_from . ' to ' . $date_to,
			'Source filter: ' . $source_filter,
			'Session count: ' . count( $sessions ),
			'',
			'Transcripts (grouped by session_id):',
		);

		$count = 0;
		foreach ( $sessions as $session_id => $turns ) {
			++$count;
			if ( $count > 80 ) {
				$lines[] = "\n… additional sessions omitted for length …";
				break;
			}
			$src = isset( $turns[0]['source'] ) ? $turns[0]['source'] : '';
			$page = isset( $turns[0]['page_url'] ) ? $turns[0]['page_url'] : '';
			$lines[] = "\n### Session: {$session_id} (source: {$src}" . ( $page !== '' ? ", page: {$page}" : '' ) . ')';
			foreach ( $turns as $turn ) {
				$meta = '';
				if ( $turn['role'] === 'assistant' ) {
					$parts = array();
					if ( $turn['card_type'] !== '' ) {
						$parts[] = 'type=' . $turn['card_type'];
					}
					if ( $turn['confidence'] !== '' ) {
						$parts[] = 'confidence=' . $turn['confidence'];
					}
					if ( ! empty( $parts ) ) {
						$meta = ' [' . implode( ', ', $parts ) . ']';
					}
				}
				$lines[] = strtoupper( $turn['role'] ) . $meta . ': ' . $turn['content'];
			}
		}

		return implode( "\n", $lines );
	}
}

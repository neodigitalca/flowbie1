<?php
/**
 * AI analysis of Overseer behavioral analytics.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Overseer_Analysis {

	const DEFAULT_MODEL = 'google/gemini-2.5-flash';

	const MAX_SESSIONS = 50;

	/**
	 * @return string
	 */
	public static function get_model(): string {
		if ( defined( 'FLOWBIE_WP_OVERSEER_ANALYSIS_MODEL' ) && FLOWBIE_WP_OVERSEER_ANALYSIS_MODEL !== '' ) {
			return trim( (string) FLOWBIE_WP_OVERSEER_ANALYSIS_MODEL );
		}
		return self::DEFAULT_MODEL;
	}

	/**
	 * @param array<string, mixed> $args date_from, date_to, include_gsc.
	 * @return array{ok: bool, report_id?: int, error?: string}
	 */
	public static function run( array $args ) {
		$date_from   = isset( $args['date_from'] ) ? sanitize_text_field( (string) $args['date_from'] ) : '';
		$date_to     = isset( $args['date_to'] ) ? sanitize_text_field( (string) $args['date_to'] ) : '';
		$include_gsc = ! empty( Flowbie_Wp_Overseer::get_settings()['include_gsc'] );
		if ( array_key_exists( 'include_gsc', $args ) ) {
			$include_gsc = ! empty( $args['include_gsc'] );
		}

		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'Please choose a valid date range.', 'flowbie-wp' ),
			);
		}

		$session_count = Flowbie_Wp_Overseer::count_sessions_in_range( $date_from, $date_to );
		$events        = Flowbie_Wp_Overseer::fetch_events_for_analysis( $date_from, $date_to );

		$gsc_context = null;
		if ( $include_gsc && Flowbie_Wp_Gsc::is_available() ) {
			$merge       = Flowbie_Wp_Overseer_Gsc::merge_page_stats( $date_from, $date_to );
			$gsc_context = array(
				'merged' => $merge['merged'],
				'flags'  => $merge['flags'],
				'gsc'    => $merge['gsc'],
				'error'  => $merge['error'],
			);
		}

		$has_gsc_data = is_array( $gsc_context ) && ! empty( $gsc_context['gsc'] );
		if ( empty( $events ) && ! $has_gsc_data ) {
			return array(
				'ok'    => false,
				'error' => __( 'No Overseer events or GSC data found for this date range.', 'flowbie-wp' ),
			);
		}

		$prompt = self::build_user_prompt( $date_from, $date_to, $events, $gsc_context, $include_gsc );
		$system = self::system_prompt( $include_gsc && ( $has_gsc_data || Flowbie_Wp_Gsc::is_available() ) );
		$model  = self::get_model();
		$body   = Flowbie_Wp_OpenRouter::complete_agency_only( $system, $prompt, $model, 8192, 0.4 );

		if ( is_wp_error( $body ) ) {
			return array(
				'ok'    => false,
				'error' => $body->get_error_message(),
			);
		}

		$parsed = self::parse_response( $body );

		$gsc_date_from = null;
		$gsc_date_to   = null;
		if ( $has_gsc_data && is_array( $gsc_context['gsc']['dateRange'] ?? null ) ) {
			$dr = $gsc_context['gsc']['dateRange'];
			if ( ! empty( $dr['start'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $dr['start'] ) ) {
				$gsc_date_from = (string) $dr['start'];
			}
			if ( ! empty( $dr['end'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $dr['end'] ) ) {
				$gsc_date_to = (string) $dr['end'];
			}
		}

		$save = Flowbie_Wp_Overseer_Reports::save(
			array(
				'date_from'     => $date_from,
				'date_to'       => $date_to,
				'session_count' => $session_count,
				'event_count'   => count( $events ),
				'model'         => $model,
				'body'          => $parsed['markdown'],
				'gsc_included'  => $has_gsc_data ? 1 : 0,
				'gsc_date_from' => $gsc_date_from,
				'gsc_date_to'   => $gsc_date_to,
			)
		);

		if ( empty( $save['ok'] ) ) {
			return array(
				'ok'    => false,
				'error' => isset( $save['error'] ) ? (string) $save['error'] : __( 'Could not save report.', 'flowbie-wp' ),
			);
		}

		$report_id = (int) $save['id'];
		foreach ( $parsed['tasks'] as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			Flowbie_Wp_Overseer_Tasks::save(
				array(
					'report_id'      => $report_id,
					'title'          => isset( $task['title'] ) ? (string) $task['title'] : '',
					'description'    => isset( $task['description'] ) ? (string) $task['description'] : '',
					'category'       => isset( $task['category'] ) ? (string) $task['category'] : 'content',
					'priority'       => isset( $task['priority'] ) ? (int) $task['priority'] : 3,
					'assist_message' => isset( $task['assist_message'] ) ? (string) $task['assist_message'] : '',
					'evidence'       => isset( $task['evidence'] ) && is_array( $task['evidence'] ) ? $task['evidence'] : array(),
					'status'         => 'pending',
				)
			);
		}

		return array(
			'ok'        => true,
			'report_id' => $report_id,
		);
	}

	/**
	 * @param bool $include_gsc Whether GSC sections are requested.
	 */
	private static function system_prompt( bool $include_gsc ): string {
		$lines = array(
			'You are an expert UX, conversion, content, and SEO strategist reviewing website analytics for a WordPress site.',
			'Produce a clear markdown report for the site owner based ONLY on the aggregated data provided.',
			'Required markdown sections:',
			'## Executive summary',
			'## Top user paths and drop-offs',
			'## Pages with engagement problems (high views, low time or scroll)',
			'## Interaction patterns (clicks, forms, outbound links)',
		);

		if ( $include_gsc ) {
			$lines[] = '## Search vs on-site engagement';
			$lines[] = '## High-traffic search pages needing UX fixes';
			$lines[] = '## Underperforming content (good engagement, weak search visibility)';
		}

		$lines[] = '## Recommended site changes (specific URLs)';
		$lines[] = '## Priority action list (numbered, most impactful first)';
		$lines[] = 'After the markdown report, output a fenced JSON block with key "tasks" containing actionable items.';
		$lines[] = 'Each task must include: title, description, category (content|navigation|conversion|technical), priority (1=highest, 5=lowest), assist_message (natural language prompt for a WordPress admin assistant to implement the change), and evidence (object with sessions, pages arrays';
		if ( $include_gsc ) {
			$lines[] = ', and optionally gsc_queries and gsc_pages arrays';
		}
		$lines[] = ').';
		$lines[] = 'Do not invent sessions or metrics not present in the data. Cite session IDs when giving examples.';
		$lines[] = 'Example JSON block format:';
		$lines[] = '```json';
		$lines[] = '{"tasks":[{"title":"...","description":"...","category":"conversion","priority":1,"assist_message":"...","evidence":{"sessions":["ovsess_..."],"pages":["/services"],"gsc_queries":["keyword"],"gsc_pages":["/services"]}}]}';
		$lines[] = '```';

		return implode( "\n", $lines );
	}

	/**
	 * @param string                              $date_from Date from.
	 * @param string                              $date_to   Date to.
	 * @param array<int, object>                  $events    Events.
	 * @param array<string, mixed>|null           $gsc_context GSC merge context.
	 * @param bool                                $include_gsc Include GSC requested.
	 */
	private static function build_user_prompt( string $date_from, string $date_to, array $events, ?array $gsc_context, bool $include_gsc ): string {
		$site_name = get_bloginfo( 'name' );
		$summary_kpis = Flowbie_Wp_Overseer::aggregate_summary( $date_from, $date_to );
		$lines     = array(
			'Site: ' . $site_name,
			'Date range: ' . $date_from . ' to ' . $date_to,
			'Total events: ' . count( $events ),
			'',
			'## Site-wide KPIs',
				sprintf(
				'- Sessions: %d | Pageviews: %d | Avg time on page: %ds | Avg active time: %ds | Avg scroll: %d%% | Bounce rate: %d%% | Avg session duration: %ds | Exit capture: %d%% | Avg page load: %dms | Clicks: %d | Forms: %d | Conversions: %d',
				(int) $summary_kpis['sessions'],
				(int) $summary_kpis['pageviews'],
				(int) $summary_kpis['avg_time_on_page_sec'],
				(int) $summary_kpis['avg_active_time_sec'],
				(int) $summary_kpis['avg_scroll_pct'],
				(int) $summary_kpis['bounce_rate_pct'],
				(int) $summary_kpis['avg_session_duration_sec'],
				(int) $summary_kpis['exit_capture_rate_pct'],
				(int) $summary_kpis['avg_page_load_ms'],
				(int) $summary_kpis['clicks'],
				(int) $summary_kpis['form_submits'],
				(int) $summary_kpis['conversions']
			),
			'',
			'## Per-page aggregates (on-site)',
		);

		$page_stats = Flowbie_Wp_Overseer::aggregate_by_page( $date_from, $date_to );
		if ( empty( $page_stats ) ) {
			$lines[] = '- (no on-site pageview data)';
		}
		foreach ( $page_stats as $row ) {
			$avg_ms    = isset( $row->avg_duration_ms ) ? (int) round( (float) $row->avg_duration_ms ) : 0;
			$avg_act   = isset( $row->avg_active_ms ) ? (int) round( (float) $row->avg_active_ms ) : 0;
			$avg_load  = isset( $row->avg_page_load_ms ) ? (int) round( (float) $row->avg_page_load_ms ) : 0;
			$lines[] = sprintf(
				'- %s | views: %d | avg time: %ds | avg active: %ds | avg scroll: %d%% | exit rate: %d%% | load: %dms | clicks: %d | forms: %d',
				Flowbie_Wp_Overseer::normalize_path_url( (string) $row->page_url ),
				(int) $row->pageviews,
				(int) round( $avg_ms / 1000 ),
				(int) round( $avg_act / 1000 ),
				isset( $row->avg_scroll_pct ) ? (int) round( (float) $row->avg_scroll_pct ) : 0,
				isset( $row->exit_rate_pct ) ? (int) $row->exit_rate_pct : 0,
				$avg_load,
				(int) $row->clicks,
				(int) $row->form_submits
			);
		}

		$lines[] = '';
		$lines[] = '## Top navigation paths';
		foreach ( Flowbie_Wp_Overseer::aggregate_paths( $date_from, $date_to ) as $path_row ) {
			$lines[] = '- ' . $path_row['path'] . ' (' . $path_row['count'] . ' sessions)';
		}

		$lines[] = '';
		$lines[] = '## Top clicked links';
		foreach ( Flowbie_Wp_Overseer::top_clicked_links( $date_from, $date_to ) as $link ) {
			$lines[] = sprintf(
				'- on %s → %s (%s) [%d clicks]',
				Flowbie_Wp_Overseer::normalize_path_url( (string) $link->page_url ),
				(string) $link->element_href,
				substr( (string) $link->element_text, 0, 80 ),
				(int) $link->click_count
			);
		}

		if ( $include_gsc ) {
			$lines[] = '';
			if ( is_array( $gsc_context ) ) {
				$lines[] = Flowbie_Wp_Overseer_Gsc::format_gsc_context_for_prompt(
					$gsc_context['merged'] ?? array(),
					$gsc_context['flags'] ?? array(),
					isset( $gsc_context['gsc'] ) && is_array( $gsc_context['gsc'] ) ? $gsc_context['gsc'] : null
				);
				if ( ! empty( $gsc_context['error'] ) && empty( $gsc_context['gsc'] ) ) {
					$lines[] = 'GSC note: ' . (string) $gsc_context['error'];
				}
			} else {
				$lines[] = "## Google Search Console\nGSC not connected or disabled.\n";
			}
		}

		$lines[] = '';
		$lines[] = '## Sample session journeys';
		if ( empty( $events ) ) {
			$lines[] = '- (no session data)';
		}
		$sessions = self::group_by_session( $events );
		$count    = 0;
		foreach ( $sessions as $session_id => $session_events ) {
			++$count;
			if ( $count > self::MAX_SESSIONS ) {
				$lines[] = '… additional sessions omitted …';
				break;
			}
			$lines[] = "\n### Session: {$session_id}";
			foreach ( $session_events as $ev ) {
				$lines[] = self::format_event_line( $ev );
			}
		}

		return implode( "\n", $lines );
	}

	/**
	 * @param array<int, object> $events Events.
	 * @return array<string, array<int, object>>
	 */
	private static function group_by_session( array $events ): array {
		$sessions = array();
		foreach ( $events as $ev ) {
			$sid = isset( $ev->session_id ) ? (string) $ev->session_id : '';
			if ( $sid === '' ) {
				continue;
			}
			if ( ! isset( $sessions[ $sid ] ) ) {
				$sessions[ $sid ] = array();
			}
			$sessions[ $sid ][] = $ev;
		}
		return $sessions;
	}

	/**
	 * @param object $ev Event row.
	 */
	private static function format_event_line( $ev ): string {
		$type = isset( $ev->event_type ) ? (string) $ev->event_type : 'pageview';
		$url  = Flowbie_Wp_Overseer::normalize_path_url( isset( $ev->page_url ) ? (string) $ev->page_url : '' );
		$time = isset( $ev->created_at ) ? (string) $ev->created_at : '';

		if ( in_array( $type, array( 'page_exit', 'page_heartbeat' ), true ) ) {
			$sec = isset( $ev->duration_ms ) ? (int) round( (int) $ev->duration_ms / 1000 ) : 0;
			$active = isset( $ev->active_duration_ms ) ? (int) round( (int) $ev->active_duration_ms / 1000 ) : 0;
			$scroll = isset( $ev->scroll_depth_pct ) ? (int) $ev->scroll_depth_pct : 0;
			$prefix = 'page_heartbeat' === $type ? 'heartbeat' : 'exit';
			return "[{$time}] {$prefix} {$url} — {$sec}s ({$active}s active), scroll {$scroll}%";
		}
		if ( in_array( $type, array( 'click', 'outbound_click', 'form_submit' ), true ) ) {
			$label = isset( $ev->element_text ) ? substr( (string) $ev->element_text, 0, 60 ) : '';
			$href  = isset( $ev->element_href ) ? (string) $ev->element_href : '';
			return "[{$time}] {$type} on {$url}" . ( $label !== '' ? " — \"{$label}\"" : '' ) . ( $href !== '' ? " → {$href}" : '' );
		}
		$load = isset( $ev->page_load_ms ) ? (int) $ev->page_load_ms : 0;
		$load_note = $load > 0 ? ", load {$load}ms" : '';
		return "[{$time}] pageview {$url}{$load_note}";
	}

	/**
	 * @param string $body Raw AI response.
	 * @return array{markdown: string, tasks: array<int, array<string, mixed>>}
	 */
	private static function parse_response( string $body ): array {
		$tasks    = array();
		$markdown = $body;

		if ( preg_match( '/```json\s*(\{.*?\})\s*```/s', $body, $matches ) ) {
			$decoded = json_decode( $matches[1], true );
			if ( is_array( $decoded ) && isset( $decoded['tasks'] ) && is_array( $decoded['tasks'] ) ) {
				$tasks = $decoded['tasks'];
			}
			$markdown = trim( preg_replace( '/```json\s*\{.*?\}\s*```/s', '', $body ) );
		}

		return array(
			'markdown' => $markdown,
			'tasks'    => $tasks,
		);
	}
}

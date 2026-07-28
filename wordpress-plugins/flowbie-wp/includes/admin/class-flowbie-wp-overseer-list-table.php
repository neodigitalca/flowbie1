<?php
/**
 * Overseer visits list table.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Overseer_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'overseer_visit',
				'plural'   => 'overseer_visits',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'         => '<input type="checkbox" />',
			'created_at' => __( 'Time', 'flowbie-wp' ),
			'event_type' => __( 'Event', 'flowbie-wp' ),
			'page_url'   => __( 'Page', 'flowbie-wp' ),
			'session_id' => __( 'Session', 'flowbie-wp' ),
			'engagement' => __( 'Engagement', 'flowbie-wp' ),
			'device'     => __( 'Device', 'flowbie-wp' ),
			'ip_address' => __( 'IP', 'flowbie-wp' ),
			'referrer'   => __( 'Referrer', 'flowbie-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'created_at' => array( 'created_at', true ),
			'page_url'   => array( 'page_url', false ),
			'session_id' => array( 'session_id', false ),
			'device'     => array( 'device', false ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="overseer_visit_ids[]" value="%d" />',
			(int) $item->id
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_created_at( $item ): string {
		$actions = array(
			'delete' => sprintf(
				'<a href="%s" class="submitdelete" onclick="return confirm(\'%s\');">%s</a>',
				esc_url( self::delete_url( (int) $item->id ) ),
				esc_js( __( 'Delete this visit?', 'flowbie-wp' ) ),
				esc_html__( 'Delete', 'flowbie-wp' )
			),
		);
		return esc_html( self::format_datetime( (string) $item->created_at ) ) . $this->row_actions( $actions );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_page_url( $item ): string {
		$url   = (string) $item->page_url;
		$title = (string) $item->page_title;
		$label = $title !== '' ? $title : $url;
		if ( strlen( $label ) > 80 ) {
			$label = substr( $label, 0, 80 ) . '…';
		}
		if ( $url === '' ) {
			return esc_html( $label );
		}
		return sprintf(
			'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
			esc_url( $url ),
			esc_html( $label )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_event_type( $item ): string {
		$type = isset( $item->event_type ) ? (string) $item->event_type : 'pageview';
		$labels = array(
			'pageview'       => __( 'Pageview', 'flowbie-wp' ),
			'page_exit'      => __( 'Exit', 'flowbie-wp' ),
			'page_heartbeat' => __( 'Heartbeat', 'flowbie-wp' ),
			'click'          => __( 'Click', 'flowbie-wp' ),
			'outbound_click' => __( 'Outbound', 'flowbie-wp' ),
			'form_submit'    => __( 'Form', 'flowbie-wp' ),
			'conversion'     => __( 'Conversion', 'flowbie-wp' ),
		);
		return esc_html( isset( $labels[ $type ] ) ? $labels[ $type ] : $type );
	}

	/**
	 * @param object $item Row.
	 */
	/** @var array<string, array{duration_ms: int, active_duration_ms: int, scroll_depth_pct: int}>|null */
	private static $engagement_cache = null;

	protected function column_engagement( $item ): string {
		$type = isset( $item->event_type ) ? (string) $item->event_type : '';
		if ( 'pageview' === $type ) {
			$uid = isset( $item->visit_uid ) ? (string) $item->visit_uid : '';
			if ( $uid !== '' && is_array( self::$engagement_cache ) && isset( self::$engagement_cache[ $uid ] ) ) {
				$eng = self::$engagement_cache[ $uid ];
				$sec = (int) round( $eng['duration_ms'] / 1000 );
				$active = (int) round( $eng['active_duration_ms'] / 1000 );
				$scroll = (int) $eng['scroll_depth_pct'];
				return esc_html( sprintf( '%ds · %ds active · %d%% scroll', $sec, $active, $scroll ) );
			}
			return '<span class="description">' . esc_html__( 'No exit recorded', 'flowbie-wp' ) . '</span>';
		}
		if ( in_array( $type, array( 'page_exit', 'page_heartbeat' ), true ) ) {
			$sec = isset( $item->duration_ms ) ? (int) round( (int) $item->duration_ms / 1000 ) : 0;
			$active = isset( $item->active_duration_ms ) ? (int) round( (int) $item->active_duration_ms / 1000 ) : 0;
			$scroll = isset( $item->scroll_depth_pct ) ? (int) $item->scroll_depth_pct : 0;
			$suffix = 'page_heartbeat' === $type ? ' · heartbeat' : '';
			return esc_html( sprintf( '%ds · %ds active · %d%% scroll%s', $sec, $active, $scroll, $suffix ) );
		}
		if ( in_array( $type, array( 'click', 'outbound_click', 'form_submit' ), true ) ) {
			$parts = array();
			if ( ! empty( $item->element_text ) ) {
				$text = (string) $item->element_text;
				if ( strlen( $text ) > 40 ) {
					$text = substr( $text, 0, 40 ) . '…';
				}
				$parts[] = '"' . $text . '"';
			}
			if ( ! empty( $item->element_href ) ) {
				$href = (string) $item->element_href;
				if ( strlen( $href ) > 40 ) {
					$href = substr( $href, 0, 40 ) . '…';
				}
				$parts[] = $href;
			}
			return esc_html( implode( ' → ', $parts ) );
		}
		if ( 'conversion' === $type ) {
			$parts = array();
			if ( ! empty( $item->element_text ) ) {
				$parts[] = (string) $item->element_text;
			}
			$raw = isset( $item->client_meta ) ? (string) $item->client_meta : '';
			if ( $raw !== '' ) {
				$meta = json_decode( $raw, true );
				if ( is_array( $meta ) && ! empty( $meta['field_signals'] ) && is_array( $meta['field_signals'] ) ) {
					$parts[] = Flowbie_Wp_Overseer_Conversions::format_field_signals( $meta['field_signals'] );
				}
			}
			return esc_html( implode( ' · ', array_filter( $parts ) ) );
		}
		return '—';
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_session_id( $item ): string {
		$sid = (string) $item->session_id;
		$url = add_query_arg(
			array(
				'page'       => 'flowbie-wp-overseer',
				'action'     => 'session',
				'session_id' => $sid,
			),
			admin_url( 'admin.php' )
		);
		return sprintf(
			'<a href="%1$s">%2$s</a>',
			esc_url( $url ),
			esc_html( $sid )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_device( $item ): string {
		$parts = array( esc_html( (string) $item->device ) );
		if ( ! empty( $item->screen_width ) && ! empty( $item->screen_height ) ) {
			$parts[] = esc_html( (int) $item->screen_width . '×' . (int) $item->screen_height );
		}
		if ( ! empty( $item->language ) ) {
			$parts[] = esc_html( (string) $item->language );
		}
		return implode( ' · ', $parts );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_ip_address( $item ): string {
		$ip = (string) $item->ip_address;
		if ( $ip === '' ) {
			return '—';
		}
		$logged = ! empty( $item->is_logged_in ) ? __( 'logged in', 'flowbie-wp' ) : __( 'guest', 'flowbie-wp' );
		return esc_html( $ip ) . ' <span class="description">(' . esc_html( $logged ) . ')</span>';
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_referrer( $item ): string {
		$ref = (string) $item->referrer;
		if ( $ref === '' ) {
			return '—';
		}
		if ( strlen( $ref ) > 60 ) {
			$ref = substr( $ref, 0, 60 ) . '…';
		}
		return sprintf(
			'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
			esc_url( (string) $item->referrer ),
			esc_html( $ref )
		);
	}

	/**
	 * @param object $item Row.
	 * @param string $column_name Column.
	 */
	protected function column_default( $item, $column_name ) {
		return '';
	}

	public function prepare_items(): void {
		$per_page  = 20;
		$page      = $this->get_pagenum();
		$session   = isset( $_GET['session_id'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['session_id'] ) ) : '';
		$search    = isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '';
		$date_from = isset( $_GET['date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_from'] ) ) : '';
		$date_to   = isset( $_GET['date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_to'] ) ) : '';
		$orderby   = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( (string) $_GET['orderby'] ) ) : 'created_at';
		$order     = isset( $_GET['order'] ) ? sanitize_key( wp_unslash( (string) $_GET['order'] ) ) : 'desc';

		$result = Flowbie_Wp_Overseer::query(
			array(
				'session_id' => $session,
				'search'     => $search,
				'date_from'  => $date_from,
				'date_to'    => $date_to,
				'orderby'    => $orderby,
				'order'      => $order,
				'per_page'   => $per_page,
				'page'       => $page,
			)
		);

		$this->items = $result['items'];

		$pageview_uids = array();
		foreach ( $this->items as $row ) {
			if ( isset( $row->event_type ) && 'pageview' === (string) $row->event_type && ! empty( $row->visit_uid ) ) {
				$pageview_uids[] = (string) $row->visit_uid;
			}
		}
		self::$engagement_cache = Flowbie_Wp_Overseer::get_engagement_by_visit_uids( $pageview_uids );

		$this->set_pagination_args(
			array(
				'total_items' => $result['total'],
				'per_page'    => $per_page,
				'total_pages' => (int) ceil( max( 1, $result['total'] ) / $per_page ),
			)
		);

		$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns() );
	}

	private static function format_datetime( string $mysql_gmt ): string {
		if ( $mysql_gmt === '' ) {
			return '';
		}
		$ts = strtotime( $mysql_gmt . ' UTC' );
		if ( ! $ts ) {
			return $mysql_gmt;
		}
		return wp_date( get_option( 'date_format' ) . ', ' . get_option( 'time_format' ), $ts );
	}

	private static function delete_url( int $id ): string {
		$action = 'flowbie_wp_delete_overseer_visit';
		$url    = admin_url(
			add_query_arg(
				array(
					'action' => $action,
					'id'     => $id,
				),
				'admin-post.php'
			)
		);
		return wp_nonce_url( $url, $action . '_' . $id );
	}
}

<?php
/**
 * Chat logs list table.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Chat_Logs_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'chat_log',
				'plural'   => 'chat_logs',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'         => '<input type="checkbox" />',
			'created_at' => __( 'Time', 'flowbie-wp' ),
			'session_id' => __( 'Session', 'flowbie-wp' ),
			'source'     => __( 'Source', 'flowbie-wp' ),
			'role'       => __( 'Role', 'flowbie-wp' ),
			'content'    => __( 'Message', 'flowbie-wp' ),
			'accepted'   => __( 'Accepted', 'flowbie-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'created_at' => array( 'created_at', true ),
			'session_id' => array( 'session_id', false ),
			'source'     => array( 'source', false ),
			'role'       => array( 'role', false ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="chat_log_ids[]" value="%d" />',
			(int) $item->id
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_created_at( $item ): string {
		return esc_html( self::format_datetime( (string) $item->created_at ) );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_session_id( $item ): string {
		$sid = (string) $item->session_id;
		$url = add_query_arg(
			array(
				'page'       => 'flowbie-wp-chat-logs',
				'session_id' => $sid,
			),
			admin_url( 'admin.php' )
		);
		$actions = array(
			'filter' => sprintf(
				'<a href="%s">%s</a>',
				esc_url( $url ),
				esc_html__( 'Filter session', 'flowbie-wp' )
			),
			'delete' => sprintf(
				'<a href="%s" class="submitdelete" onclick="return confirm(\'%s\');">%s</a>',
				esc_url( self::delete_url( (int) $item->id ) ),
				esc_js( __( 'Delete this message?', 'flowbie-wp' ) ),
				esc_html__( 'Delete', 'flowbie-wp' )
			),
		);
		return sprintf(
			'<strong><a class="row-title" href="%1$s">%2$s</a></strong> %3$s',
			esc_url( $url ),
			esc_html( $sid ),
			$this->row_actions( $actions )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_source( $item ): string {
		return esc_html( (string) $item->source );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_role( $item ): string {
		$role = (string) $item->role;
		$extra = '';
		if ( $role === 'assistant' ) {
			$parts = array();
			if ( ! empty( $item->card_type ) ) {
				$parts[] = (string) $item->card_type;
			}
			if ( ! empty( $item->confidence ) ) {
				$parts[] = (string) $item->confidence;
			}
			if ( ! empty( $parts ) ) {
				$extra = ' <span class="description">(' . esc_html( implode( ', ', $parts ) ) . ')</span>';
			}
		}
		return esc_html( $role ) . $extra;
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_content( $item ): string {
		$text = (string) $item->content;
		if ( strlen( $text ) > 200 ) {
			$text = substr( $text, 0, 200 ) . '…';
		}
		return esc_html( $text );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_accepted( $item ): string {
		$url   = (string) ( $item->accepted_url ?? '' );
		$label = (string) ( $item->accepted_label ?? '' );
		if ( $url === '' ) {
			return '&mdash;';
		}
		$display = $label !== '' ? $label : $url;
		return sprintf(
			'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
			esc_url( $url ),
			esc_html( $display )
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
		$per_page = 20;
		$page     = $this->get_pagenum();
		$source   = isset( $_GET['chat_log_source'] ) ? sanitize_key( wp_unslash( (string) $_GET['chat_log_source'] ) ) : '';
		$role     = isset( $_GET['chat_log_role'] ) ? sanitize_key( wp_unslash( (string) $_GET['chat_log_role'] ) ) : '';
		$session  = isset( $_GET['session_id'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['session_id'] ) ) : '';
		$search   = isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '';
		$date_from = isset( $_GET['date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_from'] ) ) : '';
		$date_to   = isset( $_GET['date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_to'] ) ) : '';
		$orderby  = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( (string) $_GET['orderby'] ) ) : 'created_at';
		$order    = isset( $_GET['order'] ) ? sanitize_key( wp_unslash( (string) $_GET['order'] ) ) : 'desc';

		$result = Flowbie_Wp_Chat_Logs::query(
			array(
				'source'     => $source,
				'role'       => $role,
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
		$action = 'flowbie_wp_delete_chat_log';
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

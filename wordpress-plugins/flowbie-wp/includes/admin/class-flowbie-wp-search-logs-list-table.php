<?php
/**
 * Search logs list table.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Search_Logs_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'search_log',
				'plural'   => 'search_logs',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'             => '<input type="checkbox" />',
			'created_at'     => __( 'Time', 'flowbie-wp' ),
			'query'          => __( 'Query', 'flowbie-wp' ),
			'result_count'   => __( 'Results', 'flowbie-wp' ),
			'intent'         => __( 'Intent', 'flowbie-wp' ),
			'accepted'       => __( 'Accepted', 'flowbie-wp' ),
			'page_url'       => __( 'Page URL', 'flowbie-wp' ),
			'session_id'     => __( 'Session', 'flowbie-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'created_at'   => array( 'created_at', true ),
			'query'        => array( 'query', false ),
			'result_count' => array( 'result_count', false ),
			'intent'       => array( 'intent', false ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="search_log_ids[]" value="%d" />',
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
	protected function column_query( $item ): string {
		$query = (string) $item->query;
		$actions = array(
			'delete' => sprintf(
				'<a href="%s" class="submitdelete" onclick="return confirm(\'%s\');">%s</a>',
				esc_url( self::delete_url( (int) $item->id ) ),
				esc_js( __( 'Delete this search log?', 'flowbie-wp' ) ),
				esc_html__( 'Delete', 'flowbie-wp' )
			),
		);
		return sprintf(
			'<strong>%1$s</strong> %2$s',
			esc_html( $query ),
			$this->row_actions( $actions )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_result_count( $item ): string {
		return esc_html( (string) (int) $item->result_count );
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_intent( $item ): string {
		$intent = (string) ( $item->intent ?? '' );
		return $intent !== '' ? esc_html( $intent ) : '&mdash;';
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_accepted( $item ): string {
		$url   = (string) ( $item->accepted_url ?? '' );
		$title = (string) ( $item->accepted_title ?? '' );
		if ( $url === '' ) {
			return '&mdash;';
		}
		$label = $title !== '' ? $title : $url;
		return sprintf(
			'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
			esc_url( $url ),
			esc_html( $label )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_page_url( $item ): string {
		$url = (string) ( $item->page_url ?? '' );
		if ( $url === '' ) {
			return '&mdash;';
		}
		return sprintf(
			'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
			esc_url( $url ),
			esc_html( wp_parse_url( $url, PHP_URL_PATH ) ?: $url )
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_session_id( $item ): string {
		return esc_html( (string) $item->session_id );
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
		$accepted  = ! empty( $_GET['accepted_only'] );

		$result = Flowbie_Wp_Search_Logs::query(
			array(
				'session_id'    => $session,
				'search'        => $search,
				'date_from'     => $date_from,
				'date_to'       => $date_to,
				'accepted_only' => $accepted,
				'orderby'       => $orderby,
				'order'         => $order,
				'per_page'      => $per_page,
				'page'          => $page,
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
		$action = 'flowbie_wp_delete_search_log';
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

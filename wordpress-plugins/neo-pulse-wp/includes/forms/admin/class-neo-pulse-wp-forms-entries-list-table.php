<?php
/**
 * Form entries list table.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table' ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Neo_Pulse_Wp_Forms_Entries_List_Table extends WP_List_Table {

	/** @var int */
	private $form_id = 0;

	/** @var array<int, array<string, mixed>> */
	private $form_fields = array();

	public function __construct( int $form_id, array $form_fields ) {
		$this->form_id     = $form_id;
		$this->form_fields = $form_fields;
		parent::__construct(
			array(
				'singular' => 'entry',
				'plural'   => 'entries',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		$cols = array(
			'cb'         => '<input type="checkbox" />',
			'id'         => __( 'ID', 'neo-pulse-wp' ),
			'created_at' => __( 'Date', 'neo-pulse-wp' ),
		);
		foreach ( $this->form_fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$type = (string) ( $field['type'] ?? '' );
			if ( in_array( $type, array( 'hidden', 'html', 'section' ), true ) ) {
				continue;
			}
			$cols[ (string) $field['name'] ] = (string) ( $field['label'] ?? $field['name'] );
		}
		$cols['status'] = __( 'Status', 'neo-pulse-wp' );
		return $cols;
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'neo-pulse-wp' ),
			'spam'   => __( 'Mark spam', 'neo-pulse-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $item Entry.
	 */
	protected function column_cb( $item ): string {
		return sprintf( '<input type="checkbox" name="entry_ids[]" value="%d" />', (int) ( $item['id'] ?? 0 ) );
	}

	/**
	 * @param array<string, mixed> $item Entry.
	 */
	protected function column_id( $item ): string {
		$id  = (int) ( $item['id'] ?? 0 );
		$url = admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $this->form_id . '&entry_id=' . $id );
		return '<a href="' . esc_url( $url ) . '">#' . esc_html( (string) $id ) . '</a>';
	}

	/**
	 * @param array<string, mixed> $item Entry.
	 */
	protected function column_created_at( $item ): string {
		$raw = (string) ( $item['created_at'] ?? '' );
		if ( $raw === '' ) {
			return '';
		}
		$ts = strtotime( $raw . ' UTC' );
		if ( ! $ts ) {
			return esc_html( $raw );
		}
		return esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $ts ) );
	}

	/**
	 * @param array<string, mixed> $item Entry.
	 */
	protected function column_status( $item ): string {
		return esc_html( (string) ( $item['status'] ?? '' ) );
	}

	/**
	 * @param array<string, mixed> $item Entry.
	 */
	protected function column_default( $item, $column_name ) {
		$meta = isset( $item['meta'] ) && is_array( $item['meta'] ) ? $item['meta'] : array();
		if ( ! isset( $meta[ $column_name ] ) ) {
			return '';
		}
		$value = $meta[ $column_name ];
		if ( is_array( $value ) ) {
			$parts = array();
			foreach ( $value as $sub_key => $sub_val ) {
				if ( (string) $sub_val !== '' ) {
					$parts[] = is_int( $sub_key ) ? (string) $sub_val : $sub_key . ': ' . $sub_val;
				}
			}
			$value = implode( '; ', $parts );
		}
		if ( is_numeric( $value ) && (string) (int) $value === (string) $value ) {
			$url = wp_get_attachment_url( (int) $value );
			if ( $url ) {
				return '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html__( 'File', 'neo-pulse-wp' ) . '</a>';
			}
		}
		return esc_html( mb_substr( (string) $value, 0, 80 ) );
	}

	public function prepare_items(): void {
		$per_page = 20;
		$page     = isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1;
		$status   = isset( $_GET['entry_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['entry_status'] ) ) : 'active';
		if ( $status === '' ) {
			$status = 'active';
		}

		$result = Neo_Pulse_Wp_Forms_Entries::list_entries(
			array(
				'form_id'  => $this->form_id,
				'status'   => $status,
				'page'     => $page,
				'per_page' => $per_page,
			)
		);

		$this->items = $result['items'];
		$this->set_pagination_args(
			array(
				'total_items' => $result['total'],
				'per_page'    => $per_page,
				'total_pages' => (int) ceil( $result['total'] / $per_page ),
			)
		);

		$this->_column_headers = array( $this->get_columns(), array(), array() );
	}

	protected function get_primary_column_name(): string {
		return 'id';
	}

	public function no_items(): void {
		esc_html_e( 'No entries yet.', 'neo-pulse-wp' );
	}
}

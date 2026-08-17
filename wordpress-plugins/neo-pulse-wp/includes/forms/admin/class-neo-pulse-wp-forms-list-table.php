<?php
/**
 * Forms list table.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table' ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Neo_Pulse_Wp_Forms_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'form',
				'plural'   => 'forms',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'        => '<input type="checkbox" />',
			'title'     => __( 'Title', 'neo-pulse-wp' ),
			'shortcode' => __( 'Shortcode', 'neo-pulse-wp' ),
			'entries'   => __( 'Entries', 'neo-pulse-wp' ),
			'status'    => __( 'Status', 'neo-pulse-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'title' => array( 'title', false ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'trash' => __( 'Move to Trash', 'neo-pulse-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		$id = (int) ( $item['ID'] ?? 0 );
		return sprintf( '<input type="checkbox" name="form_ids[]" value="%d" />', $id );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$id    = (int) ( $item['ID'] ?? 0 );
		$title = (string) ( $item['title'] ?? '' );
		$edit  = admin_url( 'admin.php?page=neo-pulse-wp-forms-edit&form_id=' . $id );
		$entries = admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $id );
		$badge = '';
		if ( class_exists( 'Neo_Pulse_Wp_Forms_Elementor_Sync', false ) && Neo_Pulse_Wp_Forms_Elementor_Sync::is_elementor_form( $id ) ) {
			$badge = ' <span class="neo-pulse-wp-forms-badge neo-pulse-wp-forms-badge--elementor">' . esc_html__( 'Elementor', 'neo-pulse-wp' ) . '</span>';
		}
		$actions = array(
			'edit'    => '<a href="' . esc_url( $edit ) . '">' . esc_html__( 'Edit', 'neo-pulse-wp' ) . '</a>',
			'entries' => '<a href="' . esc_url( $entries ) . '">' . esc_html__( 'Entries', 'neo-pulse-wp' ) . '</a>',
			'duplicate' => '<a href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=neo_pulse_wp_duplicate_form&form_id=' . $id ), 'neo_pulse_wp_duplicate_form', 'neo-pulse_forms_nonce' ) ) . '">' . esc_html__( 'Duplicate', 'neo-pulse-wp' ) . '</a>',
			'trash'   => '<a href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=neo_pulse_wp_delete_form&form_id=' . $id ), 'neo_pulse_wp_delete_form', 'neo-pulse_forms_nonce' ) ) . '" class="submitdelete">' . esc_html__( 'Trash', 'neo-pulse-wp' ) . '</a>',
		);
		return '<strong><a class="row-title" href="' . esc_url( $edit ) . '">' . esc_html( $title ) . '</a></strong>' . $badge . $this->row_actions( $actions );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_shortcode( $item ): string {
		$id = (int) ( $item['ID'] ?? 0 );
		return '<code>[neo-pulse_form id="' . esc_attr( (string) $id ) . '"]</code>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_entries( $item ): string {
		$id    = (int) ( $item['ID'] ?? 0 );
		$count = Neo_Pulse_Wp_Forms_Entries::count_for_form( $id, 'all' );
		$url   = admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $id );
		return '<a href="' . esc_url( $url ) . '">' . esc_html( (string) $count ) . '</a>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_status( $item ): string {
		if ( ( $item['status'] ?? '' ) === 'trash' ) {
			return esc_html__( 'Trash', 'neo-pulse-wp' );
		}
		return ! empty( $item['active'] ) ? esc_html__( 'Active', 'neo-pulse-wp' ) : esc_html__( 'Inactive', 'neo-pulse-wp' );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_default( $item, $column_name ) {
		return isset( $item[ $column_name ] ) ? esc_html( (string) $item[ $column_name ] ) : '';
	}

	public function prepare_items(): void {
		$forms         = Neo_Pulse_Wp_Forms_Storage::get_all_forms( false );
		$status_filter = isset( $_GET['form_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['form_status'] ) ) : 'all';
		if ( $status_filter === 'active' ) {
			$forms = array_values(
				array_filter(
					$forms,
					static function ( $f ) {
						return ! empty( $f['active'] ) && ( $f['status'] ?? '' ) !== 'trash';
					}
				)
			);
		} elseif ( $status_filter === 'inactive' ) {
			$forms = array_values(
				array_filter(
					$forms,
					static function ( $f ) {
						return empty( $f['active'] ) && ( $f['status'] ?? '' ) !== 'trash';
					}
				)
			);
		} elseif ( $status_filter === 'trash' ) {
			$forms = array_values(
				array_filter(
					$forms,
					static function ( $f ) {
						return ( $f['status'] ?? '' ) === 'trash';
					}
				)
			);
		} else {
			$forms = array_values(
				array_filter(
					$forms,
					static function ( $f ) {
						return ( $f['status'] ?? '' ) !== 'trash';
					}
				)
			);
		}

		$orderby = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( (string) $_GET['orderby'] ) ) : 'title';
		$order   = isset( $_GET['order'] ) ? strtoupper( sanitize_key( wp_unslash( (string) $_GET['order'] ) ) ) : 'ASC';
		if ( ! in_array( $order, array( 'ASC', 'DESC' ), true ) ) {
			$order = 'ASC';
		}
		if ( 'title' === $orderby ) {
			usort(
				$forms,
				static function ( $a, $b ) use ( $order ) {
					$cmp = strcasecmp( (string) ( $a['title'] ?? '' ), (string) ( $b['title'] ?? '' ) );
					return 'DESC' === $order ? -$cmp : $cmp;
				}
			);
		}

		$per_page = 20;
		$page     = $this->get_pagenum();
		$total    = count( $forms );
		$offset   = ( $page - 1 ) * $per_page;

		$this->items = array_slice( $forms, $offset, $per_page );
		$this->set_pagination_args(
			array(
				'total_items' => $total,
				'per_page'    => $per_page,
				'total_pages' => max( 1, (int) ceil( $total / $per_page ) ),
			)
		);

		$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns() );
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	/**
	 * @return array<string, int>
	 */
	public function get_status_counts(): array {
		$all = Neo_Pulse_Wp_Forms_Storage::get_all_forms( false );
		$counts = array(
			'all'      => 0,
			'active'   => 0,
			'inactive' => 0,
			'trash'    => 0,
		);
		foreach ( $all as $form ) {
			if ( ( $form['status'] ?? '' ) === 'trash' ) {
				++$counts['trash'];
				continue;
			}
			++$counts['all'];
			if ( ! empty( $form['active'] ) ) {
				++$counts['active'];
			} else {
				++$counts['inactive'];
			}
		}
		return $counts;
	}

	public function no_items(): void {
		esc_html_e( 'No forms found.', 'neo-pulse-wp' );
	}
}

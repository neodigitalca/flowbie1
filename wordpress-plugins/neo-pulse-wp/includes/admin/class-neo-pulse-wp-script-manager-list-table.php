<?php
/**
 * Script Manager list table.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Neo_Pulse_Wp_Script_Manager_List_Table extends WP_List_Table {

	/** @var array<string, int> */
	private $status_counts = array();

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'script',
				'plural'   => 'scripts',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'          => '<input type="checkbox" />',
			'name'        => __( 'Name', 'neo-pulse-wp' ),
			'placement'   => __( 'Placement', 'neo-pulse-wp' ),
			'display'     => __( 'Display', 'neo-pulse-wp' ),
			'priority'    => __( 'Priority', 'neo-pulse-wp' ),
			'category'    => __( 'Category', 'neo-pulse-wp' ),
			'created_at'  => __( 'Created', 'neo-pulse-wp' ),
			'updated_at'  => __( 'Updated', 'neo-pulse-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'name'       => array( 'name', false ),
			'placement'  => array( 'placement', false ),
			'priority'   => array( 'priority', false ),
			'category'   => array( 'category', false ),
			'created_at' => array( 'created_at', true ),
			'updated_at' => array( 'updated_at', false ),
		);
	}

	protected function get_bulk_actions(): array {
		$status = isset( $_GET['script_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['script_status'] ) ) : 'all';
		if ( 'trash' === $status ) {
			return array(
				'restore' => __( 'Restore', 'neo-pulse-wp' ),
				'delete'  => __( 'Delete Permanently', 'neo-pulse-wp' ),
			);
		}
		return array(
			'trash'      => __( 'Move to Trash', 'neo-pulse-wp' ),
			'activate'   => __( 'Activate', 'neo-pulse-wp' ),
			'deactivate' => __( 'Deactivate', 'neo-pulse-wp' ),
		);
	}

	/**
	 * Use custom field names so bulk actions do not overwrite admin-post routing.
	 *
	 * @param string $which top|bottom.
	 */
	protected function bulk_actions( $which = '' ): void {
		if ( ! $this->has_items() ) {
			return;
		}

		$actions = $this->get_bulk_actions();
		if ( empty( $actions ) ) {
			return;
		}

		$field = ( 'bottom' === $which ) ? 'script_bulk_action2' : 'script_bulk_action';
		$id    = 'bulk-' . sanitize_html_class( $which ) . '-selector';

		echo '<label for="' . esc_attr( $id ) . '" class="screen-reader-text">' . esc_html__( 'Select bulk action', 'neo-pulse-wp' ) . '</label>';
		echo '<select name="' . esc_attr( $field ) . '" id="' . esc_attr( $id ) . '">';
		echo '<option value="-1">' . esc_html__( 'Bulk actions', 'neo-pulse-wp' ) . '</option>';
		foreach ( $actions as $key => $label ) {
			echo '<option value="' . esc_attr( (string) $key ) . '">' . esc_html( (string) $label ) . '</option>';
		}
		echo '</select>';
		submit_button( __( 'Apply' ), 'action', '', false, array( 'id' => 'doaction' . ( 'bottom' === $which ? '2' : '' ) ) );
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="script_ids[]" value="%d" />',
			(int) $item->id
		);
	}

	/**
	 * @param object $item Row.
	 */
	protected function column_name( $item ): string {
		$id       = (int) $item->id;
		$status   = isset( $item->status ) ? (string) $item->status : 'active';
		$edit_url = admin_url(
			add_query_arg(
				array(
					'page'   => 'neo-pulse-wp-script-manager',
					'action' => 'edit',
					'id'     => $id,
				),
				'admin.php'
			)
		);

		$actions = array(
			'edit' => sprintf(
				'<a href="%s">%s</a>',
				esc_url( $edit_url ),
				esc_html__( 'Edit', 'neo-pulse-wp' )
			),
		);

		if ( 'trash' === $status ) {
			$actions['restore'] = sprintf(
				'<a href="%s">%s</a>',
				self::row_action_url( $id, 'restore' ),
				esc_html__( 'Restore', 'neo-pulse-wp' )
			);
			$actions['delete'] = sprintf(
				'<a href="%s" class="submitdelete" onclick="return confirm(\'%s\');">%s</a>',
				self::row_action_url( $id, 'delete' ),
				esc_js( __( 'Delete this script permanently?', 'neo-pulse-wp' ) ),
				esc_html__( 'Delete Permanently', 'neo-pulse-wp' )
			);
		} else {
			if ( 'active' === $status ) {
				$actions['deactivate'] = sprintf(
					'<a href="%s">%s</a>',
					self::row_action_url( $id, 'deactivate' ),
					esc_html__( 'Deactivate', 'neo-pulse-wp' )
				);
			} elseif ( 'inactive' === $status ) {
				$actions['activate'] = sprintf(
					'<a href="%s">%s</a>',
					self::row_action_url( $id, 'activate' ),
					esc_html__( 'Activate', 'neo-pulse-wp' )
				);
			}
			$block_trash = class_exists( 'Neo_Pulse_Wp_Overseer', false )
				&& Neo_Pulse_Wp_Overseer::is_builtin_script_id( $id )
				&& Neo_Pulse_Wp_Overseer::is_builtin_protected();
			if ( ! $block_trash ) {
				$actions['trash'] = sprintf(
					'<a href="%s" class="submitdelete">%s</a>',
					self::row_action_url( $id, 'trash' ),
					esc_html__( 'Trash', 'neo-pulse-wp' )
				);
			}
		}

		$title = esc_html( (string) $item->name );
		if ( class_exists( 'Neo_Pulse_Wp_Overseer', false ) && Neo_Pulse_Wp_Overseer::is_builtin_script_id( $id ) ) {
			$title .= ' <span class="neo-pulse-wp-script-manager__builtin">' . esc_html__( 'Built-in', 'neo-pulse-wp' ) . '</span>';
		}

		return sprintf(
			'<strong><a class="row-title" href="%1$s">%2$s</a></strong> %3$s',
			esc_url( $edit_url ),
			$title,
			$this->row_actions( $actions )
		);
	}

	/**
	 * @param object $item Row.
	 * @param string $column_name Column.
	 */
	protected function column_default( $item, $column_name ) {
		switch ( $column_name ) {
			case 'name':
				return '';
			case 'placement':
				return esc_html( self::placement_label( (string) $item->placement ) );
			case 'display':
				return esc_html( self::format_display_summary( $item ) );
			case 'priority':
				return esc_html( (string) (int) $item->priority );
			case 'category':
				return esc_html( (string) $item->category );
			case 'created_at':
				return esc_html( self::format_datetime( (string) $item->created_at ) );
			case 'updated_at':
				return esc_html( self::format_datetime( (string) $item->updated_at ) );
			default:
				return '';
		}
	}

	public function prepare_items(): void {
		$this->status_counts = Neo_Pulse_Wp_Script_Manager::status_counts();

		$per_page = 20;
		$page     = $this->get_pagenum();
		$status   = isset( $_GET['script_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['script_status'] ) ) : 'all';
		$category = isset( $_GET['script_category'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['script_category'] ) ) : '';
		$search   = isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '';
		$orderby  = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( (string) $_GET['orderby'] ) ) : 'created_at';
		$order    = isset( $_GET['order'] ) ? sanitize_key( wp_unslash( (string) $_GET['order'] ) ) : 'desc';

		$result = Neo_Pulse_Wp_Script_Manager::query(
			array(
				'status'   => $status,
				'category' => $category,
				'search'   => $search,
				'orderby'  => $orderby,
				'order'    => $order,
				'per_page' => $per_page,
				'page'     => $page,
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

		$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns() );
	}

	/**
	 * @return array<string, int>
	 */
	public function get_status_counts(): array {
		return $this->status_counts;
	}

	private static function placement_label( string $placement ): string {
		$labels = array(
			'header' => __( 'Header', 'neo-pulse-wp' ),
			'footer' => __( 'Footer', 'neo-pulse-wp' ),
			'body'   => __( 'Body', 'neo-pulse-wp' ),
		);
		return isset( $labels[ $placement ] ) ? $labels[ $placement ] : $placement;
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

	private static function row_action_url( int $id, string $op ): string {
		$url = admin_url(
			add_query_arg(
				array(
					'action'    => 'neo_pulse_wp_script_row',
					'script_op' => $op,
					'id'        => $id,
				),
				'admin-post.php'
			)
		);

		return wp_nonce_url( $url, 'neo_pulse_wp_script_row_' . $op . '_' . $id );
	}

	/**
	 * @param object $item Row.
	 */
	private static function format_display_summary( $item ): string {
		try {
			$raw = isset( $item->display_rules ) ? (string) $item->display_rules : '';
			return Neo_Pulse_Wp_Script_Manager_Rules::summarize( $raw );
		} catch ( Throwable $e ) {
			return __( 'Invalid display rules', 'neo-pulse-wp' );
		}
	}
}

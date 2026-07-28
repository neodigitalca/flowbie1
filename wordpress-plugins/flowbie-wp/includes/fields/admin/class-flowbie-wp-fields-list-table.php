<?php
/**
 * Field groups list table.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Fields_List_Table extends WP_List_Table {

	/** @var string */
	private $status = 'all';

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'field_group',
				'plural'   => 'field_groups',
				'ajax'     => false,
			)
		);
	}

	public function set_status_filter( string $status ): void {
		$this->status = $status;
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	public function get_hidden_columns(): array {
		return array();
	}

	public function get_columns(): array {
		return array(
			'cb'          => '<input type="checkbox" />',
			'title'       => __( 'Title', 'flowbie-wp' ),
			'description' => __( 'Description', 'flowbie-wp' ),
			'location'    => __( 'Location', 'flowbie-wp' ),
			'fields'      => __( 'Fields', 'flowbie-wp' ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'export' => __( 'Export', 'flowbie-wp' ),
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="group_keys[]" value="%s" />',
			esc_attr( (string) ( $item['key'] ?? '' ) )
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$key   = (string) ( $item['key'] ?? '' );
		$title = (string) ( $item['title'] ?? $key );
		$id    = (int) ( $item['ID'] ?? 0 );
		$url   = admin_url( 'admin.php?page=flowbie-wp-fields-edit&key=' . rawurlencode( $key ) );
		if ( $id > 0 ) {
			$url = add_query_arg( 'id', $id, $url );
		}
		$html = '<span class="flowbie-fields-acf-row-compact">';
		$html .= '<strong><a class="row-title" href="' . esc_url( $url ) . '">' . esc_html( $title ) . '</a></strong>';
		if ( $key !== '' && $key !== $title ) {
			$html .= ' <code class="flowbie-fields-acf-row-key">' . esc_html( $key ) . '</code>';
		}
		if ( ! Flowbie_Wp_Admin::fields_group_is_active( $item ) ) {
			$html .= ' <span class="flowbie-fields-acf-badge flowbie-fields-acf-badge--inactive">' . esc_html__( 'Inactive', 'flowbie-wp' ) . '</span>';
		}
		$html .= '</span>';
		$html .= $this->row_actions( $this->field_group_row_actions( $key, $url ), true );
		return $html;
	}

	/**
	 * @return array<string, string>
	 */
	private function field_group_row_actions( string $key, string $edit_url ): array {
		if ( $key === '' ) {
			return array();
		}
		$del_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=flowbie_wp_delete_field_group&key=' . rawurlencode( $key ) ),
			'flowbie_wp_delete_field_group'
		);
		return array(
			'edit'   => '<a href="' . esc_url( $edit_url ) . '">' . esc_html__( 'Edit', 'flowbie-wp' ) . '</a>',
			'delete' => '<a href="' . esc_url( $del_url ) . '" class="submitdelete" onclick="return confirm(\'' . esc_js( __( 'Delete this field group permanently?', 'flowbie-wp' ) ) . '\');">' . esc_html__( 'Delete', 'flowbie-wp' ) . '</a>',
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_description( $item ): string {
		$desc = (string) ( $item['description'] ?? '' );
		return $desc !== '' ? esc_html( $desc ) : '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__( 'Empty', 'flowbie-wp' ) . '</span>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_location( $item ): string {
		return esc_html( Flowbie_Wp_Fields_Location::summarize( $item ) );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_fields( $item ): string {
		$fields = isset( $item['fields'] ) && is_array( $item['fields'] ) ? $item['fields'] : array();
		return (string) count( $fields );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_default( $item, $column_name ) {
		unset( $item );
		return '';
	}

	public function prepare_items(): void {
		$groups = Flowbie_Wp_Fields_Storage::get_all_groups( false );
		$search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) : '';

		if ( $this->status === 'active' ) {
			$groups = array_values(
				array_filter(
					$groups,
					static function ( $g ) {
						return Flowbie_Wp_Admin::fields_group_is_active( is_array( $g ) ? $g : array() );
					}
				)
			);
		} elseif ( $this->status === 'inactive' ) {
			$groups = array_values(
				array_filter(
					$groups,
					static function ( $g ) {
						return ! Flowbie_Wp_Admin::fields_group_is_active( is_array( $g ) ? $g : array() );
					}
				)
			);
		}

		if ( $search !== '' ) {
			$groups = array_values(
				array_filter(
					$groups,
					static function ( $g ) use ( $search ) {
						$hay = strtolower( (string) ( $g['title'] ?? '' ) . ' ' . (string) ( $g['key'] ?? '' ) );
						return strpos( $hay, strtolower( $search ) ) !== false;
					}
				)
			);
		}
		$this->items = $groups;
		$this->set_pagination_args(
			array(
				'total_items' => count( $groups ),
				'per_page'    => max( 1, count( $groups ) ),
			)
		);
		$this->_column_headers = array( $this->get_columns(), $this->get_hidden_columns(), $this->get_sortable_columns() );
	}
}

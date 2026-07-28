<?php
/**
 * Options pages list table (ACF-style columns).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Fields_Options_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'options_page',
				'plural'   => 'options_pages',
				'ajax'     => false,
			)
		);
	}

	public function get_hidden_columns(): array {
		return array();
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	public function no_items(): void {
		esc_html_e( 'No options pages found.', 'flowbie-wp' );
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	public function get_columns(): array {
		return array(
			'cb'           => '<input type="checkbox" />',
			'title'        => __( 'Title', 'flowbie-wp' ),
			'menu_slug'    => __( 'Menu Slug', 'flowbie-wp' ),
			'field_groups' => __( 'Field Groups', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="options_keys[]" value="%s" />',
			esc_attr( (string) ( $item['menu_slug'] ?? '' ) )
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$title    = (string) ( $item['page_title'] ?? $item['menu_title'] ?? '' );
		$slug     = (string) ( $item['menu_slug'] ?? '' );
		$edit_url = admin_url( 'admin.php?page=flowbie-wp-options-pages&action=edit&menu_slug=' . rawurlencode( $slug ) );
		$display  = $title !== '' ? $title : $slug;
		$html     = '<span class="flowbie-fields-acf-row-compact">';
		$html    .= '<strong><a class="row-title" href="' . esc_url( $edit_url ) . '">' . esc_html( $display ) . '</a></strong>';
		if ( $slug !== '' && $slug !== $display ) {
			$html .= ' <code class="flowbie-fields-acf-row-key">' . esc_html( $slug ) . '</code>';
		}
		$html .= '</span>';
		$html .= $this->row_actions( $this->options_page_row_actions( $slug, $edit_url ), true );
		return $html;
	}

	/**
	 * @return array<string, string>
	 */
	private function options_page_row_actions( string $slug, string $edit_url ): array {
		if ( $slug === '' ) {
			return array();
		}
		$del_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=flowbie_wp_delete_options_page&menu_slug=' . rawurlencode( $slug ) ),
			'flowbie_wp_delete_options_page'
		);
		return array(
			'edit'   => '<a href="' . esc_url( $edit_url ) . '">' . esc_html__( 'Edit', 'flowbie-wp' ) . '</a>',
			'delete' => '<a href="' . esc_url( $del_url ) . '" class="submitdelete" onclick="return confirm(\'' . esc_js( __( 'Delete this options page permanently?', 'flowbie-wp' ) ) . '\');">' . esc_html__( 'Delete', 'flowbie-wp' ) . '</a>',
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_menu_slug( $item ): string {
		return '<code>' . esc_html( (string) ( $item['menu_slug'] ?? '' ) ) . '</code>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_field_groups( $item ): string {
		unset( $item );
		return '<span aria-hidden="true">—</span>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_default( $item, $column_name ) {
		unset( $item, $column_name );
		return '';
	}

	public function prepare_items(): void {
		$items  = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS );
		$search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) : '';
		if ( $search !== '' ) {
			$items = array_values(
				array_filter(
					$items,
					static function ( $item ) use ( $search ) {
						if ( ! is_array( $item ) ) {
							return false;
						}
						$hay = strtolower(
							(string) ( $item['menu_slug'] ?? '' ) . ' ' .
							(string) ( $item['page_title'] ?? '' )
						);
						return strpos( $hay, strtolower( $search ) ) !== false;
					}
				)
			);
		}
		$this->items = $items;
		$this->set_pagination_args(
			array(
				'total_items' => count( $items ),
				'per_page'    => max( 1, count( $items ) ),
			)
		);
		$this->_column_headers = array( $this->get_columns(), $this->get_hidden_columns(), $this->get_sortable_columns() );
	}
}

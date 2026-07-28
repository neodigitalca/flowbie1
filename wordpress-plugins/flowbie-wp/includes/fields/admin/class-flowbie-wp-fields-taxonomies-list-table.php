<?php
/**
 * Taxonomies list table (ACF-style columns).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Fields_Taxonomies_List_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'taxonomy',
				'plural'   => 'taxonomies',
				'ajax'     => false,
			)
		);
	}

	public function get_columns(): array {
		return array(
			'cb'           => '<input type="checkbox" />',
			'title'        => __( 'Title', 'flowbie-wp' ),
			'post_types'   => __( 'Post Types', 'flowbie-wp' ),
			'field_groups' => __( 'Field Groups', 'flowbie-wp' ),
			'terms'        => __( 'Terms', 'flowbie-wp' ),
		);
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	public function get_hidden_columns(): array {
		return array();
	}

	public function no_items(): void {
		esc_html_e( 'No taxonomies found.', 'flowbie-wp' );
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="taxonomy_keys[]" value="%s" />',
			esc_attr( (string) ( $item['taxonomy'] ?? '' ) )
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$slug  = (string) ( $item['taxonomy'] ?? '' );
		$title = (string) ( $item['labels']['name'] ?? '' );
		if ( $title === '' ) {
			$title = $slug;
		}
		$edit_url = admin_url( 'admin.php?page=flowbie-wp-taxonomies&action=edit&taxonomy=' . rawurlencode( $slug ) );
		$html     = '<span class="flowbie-fields-acf-row-compact">';
		$html    .= '<strong><a class="row-title" href="' . esc_url( $edit_url ) . '">' . esc_html( $title ) . '</a></strong>';
		if ( $slug !== '' && $slug !== $title ) {
			$html .= ' <code class="flowbie-fields-acf-row-key">' . esc_html( $slug ) . '</code>';
		}
		$html .= '</span>';
		$html .= $this->row_actions( $this->taxonomy_row_actions( $slug ), true );
		return $html;
	}

	/**
	 * @return array<string, string>
	 */
	private function taxonomy_row_actions( string $slug ): array {
		if ( $slug === '' ) {
			return array();
		}
		$edit_url = admin_url( 'admin.php?page=flowbie-wp-taxonomies&action=edit&taxonomy=' . rawurlencode( $slug ) );
		$del_url  = wp_nonce_url(
			admin_url( 'admin-post.php?action=flowbie_wp_delete_taxonomy&taxonomy=' . rawurlencode( $slug ) ),
			'flowbie_wp_delete_taxonomy'
		);
		$actions = array(
			'edit'   => '<a href="' . esc_url( $edit_url ) . '">' . esc_html__( 'Edit', 'flowbie-wp' ) . '</a>',
			'delete' => '<a href="' . esc_url( $del_url ) . '" class="submitdelete" onclick="return confirm(\'' . esc_js( __( 'Delete this taxonomy definition permanently?', 'flowbie-wp' ) ) . '\');">' . esc_html__( 'Delete', 'flowbie-wp' ) . '</a>',
		);
		$sitemap_url = $this->taxonomy_sitemap_url( $slug );
		if ( $sitemap_url !== '' ) {
			$actions['sitemap'] = '<a href="' . esc_url( $sitemap_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Sitemap', 'flowbie-wp' ) . '</a>';
		}
		return $actions;
	}

	private function taxonomy_sitemap_url( string $slug ): string {
		if ( $slug === '' || ! class_exists( 'Flowbie_Wp_Sitemap_Settings' ) ) {
			return '';
		}
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		if ( empty( $config['general']['enabled'] ) ) {
			return '';
		}
		$settings = (array) ( $config['taxonomies'][ $slug ] ?? array() );
		if ( isset( $settings['include_xml'] ) && ! $settings['include_xml'] ) {
			return '';
		}
		return Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_post_types( $item ): string {
		$types = array_filter( array_map( 'strval', (array) ( $item['object_type'] ?? array() ) ) );
		return $types !== array() ? esc_html( implode( ', ', $types ) ) : '<span aria-hidden="true">—</span>';
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
	protected function column_terms( $item ): string {
		$slug = (string) ( $item['taxonomy'] ?? '' );
		if ( $slug === '' || ! taxonomy_exists( $slug ) ) {
			return '0';
		}
		$count = wp_count_terms(
			array(
				'taxonomy'   => $slug,
				'hide_empty' => false,
			)
		);
		if ( is_wp_error( $count ) ) {
			return '0';
		}
		$url = admin_url( 'edit-tags.php?taxonomy=' . rawurlencode( $slug ) );
		return '<a href="' . esc_url( $url ) . '">' . esc_html( (string) (int) $count ) . '</a>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_default( $item, $column_name ) {
		unset( $item, $column_name );
		return '';
	}

	public function prepare_items(): void {
		$items  = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY );
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
							(string) ( $item['taxonomy'] ?? '' ) . ' ' .
							(string) ( $item['labels']['name'] ?? '' )
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

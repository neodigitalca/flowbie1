<?php
/**
 * Post types list table (ACF-style columns).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Fields_Post_Types_List_Table extends WP_List_Table {

	/** @var string */
	private $status = 'all';

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'post_type',
				'plural'   => 'post_types',
				'ajax'     => false,
			)
		);
	}

	public function set_status_filter( string $status ): void {
		$this->status = $status;
	}

	public function get_columns(): array {
		return array(
			'cb'           => '<input type="checkbox" />',
			'title'        => __( 'Title', 'flowbie-wp' ),
			'description'  => __( 'Description', 'flowbie-wp' ),
			'taxonomies'   => __( 'Taxonomies', 'flowbie-wp' ),
			'field_groups' => __( 'Field Groups', 'flowbie-wp' ),
			'posts'        => __( 'Posts', 'flowbie-wp' ),
		);
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	public function get_hidden_columns(): array {
		return array();
	}

	public function no_items(): void {
		esc_html_e( 'No post types found.', 'flowbie-wp' );
	}

	protected function get_bulk_actions(): array {
		return array(
			'delete' => __( 'Delete', 'flowbie-wp' ),
		);
	}

	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="post_type_keys[]" value="%s" />',
			esc_attr( (string) ( $item['post_type'] ?? '' ) )
		);
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$slug  = (string) ( $item['post_type'] ?? '' );
		$title = (string) ( $item['labels']['name'] ?? '' );
		if ( $title === '' ) {
			$title = $slug;
		}
		$url  = admin_url( 'admin.php?page=flowbie-wp-post-types-edit&post_type=' . rawurlencode( $slug ) );
		$html = '<span class="flowbie-fields-acf-row-compact">';
		$html .= '<strong><a class="row-title" href="' . esc_url( $url ) . '">' . esc_html( $title ) . '</a></strong>';
		if ( $slug !== '' && $slug !== $title ) {
			$html .= ' <code class="flowbie-fields-acf-row-key">' . esc_html( $slug ) . '</code>';
		}
		if ( ! Flowbie_Wp_Admin::fields_post_type_is_active( $item ) ) {
			$html .= ' <span class="flowbie-fields-acf-badge flowbie-fields-acf-badge--inactive">' . esc_html__( 'Inactive', 'flowbie-wp' ) . '</span>';
		}
		if ( $slug !== '' && Flowbie_Wp_Fields_Post_Types::is_external_registrar( $slug ) ) {
			$html .= ' <span class="flowbie-fields-acf-badge flowbie-fields-acf-badge--external">' . esc_html__( 'External registrar', 'flowbie-wp' ) . '</span>';
		}
		$html .= '</span>';
		$html .= $this->row_actions( $this->post_type_row_actions( $slug, $url, $item ), true );
		return $html;
	}

	/**
	 * @param array<string, mixed> $item Post type config.
	 * @return array<string, string>
	 */
	private function post_type_row_actions( string $slug, string $edit_url, array $item ): array {
		if ( $slug === '' ) {
			return array();
		}
		$del_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=flowbie_wp_delete_post_type&post_type=' . rawurlencode( $slug ) ),
			'flowbie_wp_delete_post_type'
		);
		$actions = array(
			'edit'   => '<a href="' . esc_url( $edit_url ) . '">' . esc_html__( 'Edit', 'flowbie-wp' ) . '</a>',
			'delete' => '<a href="' . esc_url( $del_url ) . '" class="submitdelete" onclick="return confirm(\'' . esc_js( __( 'Delete this post type permanently?', 'flowbie-wp' ) ) . '\');">' . esc_html__( 'Delete', 'flowbie-wp' ) . '</a>',
		);
		$public_url = $this->post_type_public_url( $slug, $item );
		if ( $public_url !== '' ) {
			$actions = array( 'view' => '<a href="' . esc_url( $public_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'View archive', 'flowbie-wp' ) . '</a>' ) + $actions;
		}
		$sitemap_url = $this->post_type_sitemap_url( $slug );
		if ( $sitemap_url !== '' ) {
			$actions['sitemap'] = '<a href="' . esc_url( $sitemap_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Sitemap', 'flowbie-wp' ) . '</a>';
		}
		return $actions;
	}

	private function post_type_public_url( string $slug, array $item ): string {
		if ( $slug === '' || empty( $item['public'] ) ) {
			return '';
		}
		if ( post_type_exists( $slug ) ) {
			$archive = get_post_type_archive_link( $slug );
			if ( is_string( $archive ) && $archive !== '' ) {
				return $archive;
			}
		}
		$rewrite = (array) ( $item['rewrite'] ?? array() );
		$path    = (string) ( $rewrite['slug'] ?? $slug );
		if ( $path === '' ) {
			return '';
		}
		return home_url( user_trailingslashit( $path ) );
	}

	private function post_type_sitemap_url( string $slug ): string {
		if ( $slug === '' || ! class_exists( 'Flowbie_Wp_Sitemap_Settings' ) ) {
			return '';
		}
		$config = Flowbie_Wp_Sitemap_Settings::get_config();
		if ( empty( $config['general']['enabled'] ) ) {
			return '';
		}
		$settings = (array) ( $config['post_types'][ $slug ] ?? array() );
		if ( isset( $settings['include_xml'] ) && ! $settings['include_xml'] ) {
			return '';
		}
		return Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug );
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
	protected function column_taxonomies( $item ): string {
		$slug = (string) ( $item['post_type'] ?? '' );
		$tax  = Flowbie_Wp_Admin::fields_taxonomies_for_post_type( $slug );
		if ( empty( $tax ) ) {
			return '<span aria-hidden="true">—</span>';
		}
		return esc_html( implode( ', ', $tax ) );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_field_groups( $item ): string {
		$slug   = (string) ( $item['post_type'] ?? '' );
		$groups = Flowbie_Wp_Admin::fields_groups_for_post_type( $slug );
		if ( empty( $groups ) ) {
			return '<span aria-hidden="true">—</span>';
		}
		return esc_html( implode( ', ', $groups ) );
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_posts( $item ): string {
		$slug = (string) ( $item['post_type'] ?? '' );
		if ( $slug === '' || ! post_type_exists( $slug ) ) {
			return '0';
		}
		$counts = wp_count_posts( $slug );
		$total  = 0;
		if ( $counts ) {
			foreach ( (array) $counts as $status => $count ) {
				if ( $status !== 'auto-draft' && $status !== 'trash' ) {
					$total += (int) $count;
				}
			}
		}
		$url = admin_url( 'edit.php?post_type=' . rawurlencode( $slug ) );
		return '<a href="' . esc_url( $url ) . '">' . esc_html( (string) $total ) . '</a>';
	}

	/**
	 * @param array<string, mixed> $item Row.
	 */
	protected function column_default( $item, $column_name ) {
		unset( $item, $column_name );
		return '';
	}

	public function prepare_items(): void {
		$items  = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE );
		$search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) : '';

		if ( $this->status === 'active' ) {
			$items = array_values(
				array_filter(
					$items,
					static function ( $item ) {
						return Flowbie_Wp_Admin::fields_post_type_is_active( is_array( $item ) ? $item : array() );
					}
				)
			);
		} elseif ( $this->status === 'inactive' ) {
			$items = array_values(
				array_filter(
					$items,
					static function ( $item ) {
						return ! Flowbie_Wp_Admin::fields_post_type_is_active( is_array( $item ) ? $item : array() );
					}
				)
			);
		}

		if ( $search !== '' ) {
			$items = array_values(
				array_filter(
					$items,
					static function ( $item ) use ( $search ) {
						if ( ! is_array( $item ) ) {
							return false;
						}
						$hay = strtolower(
							(string) ( $item['post_type'] ?? '' ) . ' ' .
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

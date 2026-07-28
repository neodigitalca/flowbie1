<?php
/**
 * Agent Hub SEO blocks list table.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table', false ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class Flowbie_Wp_Seo_Blocks_List_Table extends WP_List_Table {

	/** @var array<string, int> */
	private $status_counts = array();

	/** @var string */
	private $status_filter = 'all';

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'seo_block',
				'plural'   => 'seo_blocks',
				'ajax'     => false,
			)
		);
	}

	protected function get_primary_column_name(): string {
		return 'title';
	}

	public function get_columns(): array {
		return array(
			'cb'            => '<input type="checkbox" />',
			'id'            => __( 'ID', 'flowbie-wp' ),
			'title'         => __( 'Theme / title', 'flowbie-wp' ),
			'primary_page'  => __( 'Primary page', 'flowbie-wp' ),
			'focus_keyword' => __( 'Focus keyword', 'flowbie-wp' ),
		);
	}

	protected function get_sortable_columns(): array {
		return array(
			'id'            => array( 'id', false ),
			'title'         => array( 'title', false ),
			'focus_keyword' => array( 'focus_keyword', false ),
		);
	}

	protected function get_bulk_actions(): array {
		return array(
			'bulk_optimize' => __( 'Bulk optimize', 'flowbie-wp' ),
			'delete'        => __( 'Delete', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string,mixed> $item Row.
	 */
	protected function column_cb( $item ): string {
		return sprintf(
			'<input type="checkbox" name="block_ids[]" value="%d" />',
			(int) ( $item['id'] ?? 0 )
		);
	}

	/**
	 * @param array<string,mixed> $item Row.
	 */
	protected function column_title( $item ): string {
		$id    = (int) ( $item['id'] ?? 0 );
		$title = (string) ( $item['title'] ?? '' );
		if ( $title === '' ) {
			$title = __( '(Untitled block)', 'flowbie-wp' );
		}

		$edit_url = admin_url( 'admin.php?page=flowbie-wp-agent-hub-edit&block_id=' . $id );
		$actions  = array(
			'edit' => sprintf(
				'<a href="%1$s" class="flowbie-agent-hub-edit" data-block-id="%2$d">%3$s</a>',
				esc_url( $edit_url ),
				$id,
				esc_html__( 'Edit', 'flowbie-wp' )
			),
		);

		$library_id = (int) ( $item['elementor_library_id'] ?? 0 );
		if ( $library_id > 0 ) {
			$actions['library'] = sprintf(
				'<a href="%1$s" target="_blank" rel="noopener">%2$s</a>',
				esc_url( Flowbie_Wp_Seo_Blocks_Library::library_edit_url( $library_id ) ),
				esc_html__( 'Edit template', 'flowbie-wp' )
			);
		}

		$actions['optimize'] = sprintf(
			'<a href="#flowbie-agent-hub-optimize-%1$d" class="flowbie-agent-hub-optimize" data-block-id="%1$d" role="button" onclick="if(window.FlowbieAgentHubUI){window.FlowbieAgentHubUI.openOptimize(%1$d);}return false;">%2$s</a>',
			$id,
			esc_html__( 'Optimize', 'flowbie-wp' )
		);
		$actions['duplicate'] = sprintf(
			'<a href="#flowbie-agent-hub-duplicate-%1$d" class="flowbie-agent-hub-duplicate" data-block-id="%1$d" role="button" onclick="if(window.FlowbieAgentHubUI){window.FlowbieAgentHubUI.openDuplicate(%1$d);}return false;">%2$s</a>',
			$id,
			esc_html__( 'Duplicate', 'flowbie-wp' )
		);
		$actions['delete'] = sprintf(
			'<a href="#flowbie-agent-hub-delete-%1$d" class="flowbie-agent-hub-delete submitdelete" data-block-id="%1$d" role="button" onclick="if(window.FlowbieAgentHubUI){window.FlowbieAgentHubUI.openDelete(%1$d);}return false;">%2$s</a>',
			$id,
			esc_html__( 'Delete', 'flowbie-wp' )
		);

		return sprintf(
			'<strong><a class="row-title flowbie-agent-hub-edit" href="#flowbie-agent-hub-edit-%1$d" data-block-id="%1$d" role="button" onclick="if(window.FlowbieAgentHubUI){window.FlowbieAgentHubUI.openEdit(%1$d);}return false;">%2$s</a></strong> %3$s',
			$id,
			esc_html( $title ),
			$this->row_actions( $actions )
		);
	}

	/**
	 * @param array<string,mixed> $item Row.
	 * @param string              $column_name Column.
	 */
	protected function column_default( $item, $column_name ) {
		switch ( $column_name ) {
			case 'title':
				return '';
			case 'id':
				return esc_html( (string) (int) ( $item['id'] ?? 0 ) );
			case 'primary_page':
				return self::render_primary_page_cell( is_array( $item ) ? $item : array() );
			case 'focus_keyword':
				return esc_html( (string) ( $item['focus_keyword'] ?? '' ) );
			default:
				return '';
		}
	}

	/**
	 * @param array<string,mixed> $item Row.
	 */
	protected function column_primary_page( $item ): string {
		return self::render_primary_page_cell( is_array( $item ) ? $item : array() );
	}

	/**
	 * @param array<string,mixed> $item Row.
	 */
	private static function render_primary_page_cell( array $item ): string {
		$summary = $item['primary_post'] ?? null;
		if ( is_array( $summary ) && ! empty( $summary['id'] ) ) {
			$title = esc_html( (string) ( $summary['title'] ?? '' ) );
			$url   = esc_url( (string) ( $summary['edit_url'] ?? '' ) );
			if ( $url !== '' ) {
				return sprintf( '<a href="%s">%s</a>', $url, $title );
			}
			return $title;
		}
		$post_id = (int) ( $item['primary_post_id'] ?? 0 );
		if ( $post_id > 0 ) {
			return esc_html( sprintf( __( 'Page #%d', 'flowbie-wp' ), $post_id ) );
		}
		return '<span class="flowbie-agent-hub__muted">—</span>';
	}

	public function prepare_items(): void {
		$this->status_filter = isset( $_GET['block_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['block_status'] ) ) : 'all';
		if ( ! in_array( $this->status_filter, array( 'all', 'draft', 'published', 'needs_optimize' ), true ) ) {
			$this->status_filter = 'all';
		}

		$search  = isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '';
		$orderby = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( (string) $_GET['orderby'] ) ) : 'id';
		$order   = isset( $_GET['order'] ) ? strtolower( sanitize_key( wp_unslash( (string) $_GET['order'] ) ) ) : 'desc';
		if ( ! in_array( $order, array( 'asc', 'desc' ), true ) ) {
			$order = 'desc';
		}

		$rows = Flowbie_Wp_Seo_Blocks_Storage::list_all();
		$this->status_counts = self::count_statuses( $rows );

		if ( $this->status_filter !== 'all' ) {
			$filter = $this->status_filter;
			$rows   = array_values(
				array_filter(
					$rows,
					static function ( $row ) use ( $filter ) {
						return is_array( $row ) && (string) ( $row['status'] ?? '' ) === $filter;
					}
				)
			);
		}

		if ( $search !== '' ) {
			$needle = strtolower( $search );
			$rows   = array_values(
				array_filter(
					$rows,
					static function ( $row ) use ( $needle ) {
						if ( ! is_array( $row ) ) {
							return false;
						}
						$hay = strtolower(
							implode(
								' ',
								array(
									(string) ( $row['title'] ?? '' ),
									(string) ( $row['focus_keyword'] ?? '' ),
									(string) ( $row['h2'] ?? '' ),
									(string) ( $row['topic_focus'] ?? '' ),
								)
							)
						);
						return strpos( $hay, $needle ) !== false;
					}
				)
			);
		}

		$rows = self::sort_rows( $rows, $orderby, $order );

		$per_page = 20;
		$page     = $this->get_pagenum();
		$total    = count( $rows );
		$offset   = ( $page - 1 ) * $per_page;
		$this->items = array_slice( $rows, $offset, $per_page );

		$this->set_pagination_args(
			array(
				'total_items' => $total,
				'per_page'    => $per_page,
				'total_pages' => (int) max( 1, ceil( $total / $per_page ) ),
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

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<string, int>
	 */
	private static function count_statuses( array $rows ): array {
		$counts = array(
			'all'            => count( $rows ),
			'draft'          => 0,
			'published'      => 0,
			'needs_optimize' => 0,
		);
		foreach ( $rows as $row ) {
			$status = (string) ( $row['status'] ?? 'draft' );
			if ( isset( $counts[ $status ] ) ) {
				++$counts[ $status ];
			}
		}
		return $counts;
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	private static function sort_rows( array $rows, string $orderby, string $order ): array {
		$allowed = array( 'id', 'title', 'focus_keyword' );
		if ( ! in_array( $orderby, $allowed, true ) ) {
			$orderby = 'id';
		}

		usort(
			$rows,
			static function ( $a, $b ) use ( $orderby, $order ) {
				if ( ! is_array( $a ) || ! is_array( $b ) ) {
					return 0;
				}
				$av = $a[ $orderby ] ?? '';
				$bv = $b[ $orderby ] ?? '';
				if ( $orderby === 'id' ) {
					$cmp = (int) $av <=> (int) $bv;
				} else {
					$cmp = strcasecmp( (string) $av, (string) $bv );
				}
				return $order === 'asc' ? $cmp : -$cmp;
			}
		);

		return $rows;
	}
}

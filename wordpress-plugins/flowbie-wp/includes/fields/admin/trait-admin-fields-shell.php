<?php
/**
 * ACF-style admin shell for Flowbie Fields (Flowbie dark semantic colors).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Fields_Shell {

	/**
	 * @return array<int, array{slug: string, label: string, url: string}>
	 */
	private static function fields_shell_primary_nav(): array {
		return array(
			array(
				'slug'  => 'field-groups',
				'label' => __( 'Field Groups', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-fields' ),
			),
			array(
				'slug'  => 'post-types',
				'label' => __( 'Post Types', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-post-types' ),
			),
			array(
				'slug'  => 'taxonomies',
				'label' => __( 'Taxonomies', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-taxonomies' ),
			),
			array(
				'slug'  => 'options-pages',
				'label' => __( 'Options Pages', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-options-pages' ),
			),
			array(
				'slug'  => 'gallery',
				'label' => __( 'Gallery', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-fields-gallery' ),
			),
			array(
				'slug'  => 'tools',
				'label' => __( 'Tools', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-fields-tools' ),
			),
		);
	}

	/**
	 * @param string $active_slug Legacy nav key (field-groups, post-types, …).
	 * @param array<string, mixed>|null $flash Unused; flash is handled by the group shell.
	 */
	private static function render_fields_shell_open( string $active_slug, ?array $flash = null, string $body_class = '' ): void {
		unset( $flash );
		$page_slug_map = array(
			'field-groups'  => 'flowbie-wp-fields',
			'post-types'    => 'flowbie-wp-post-types',
			'taxonomies'    => 'flowbie-wp-taxonomies',
			'options-pages' => 'flowbie-wp-options-pages',
			'gallery'       => 'flowbie-wp-fields-gallery',
			'tools'         => 'flowbie-wp-fields-tools',
		);
		$page_slug   = $page_slug_map[ $active_slug ] ?? self::flowbie_current_admin_page_slug();
		$body_class  = trim( 'flowbie-fields-admin flowbie-fields-acf-body' . ( $body_class !== '' ? ' ' . $body_class : '' ) );
		self::flowbie_group_shell_open( $page_slug, $body_class );
	}

	private static function render_fields_shell_close(): void {
		self::flowbie_group_shell_close();
	}

	private static function render_fields_shell_titlebar( string $title, ?string $add_url = null, string $add_label = '' ): void {
		if ( $add_label === '' ) {
			$add_label = __( 'Add New', 'flowbie-wp' );
		}
		?>
		<div class="flowbie-fields-acf-titlebar">
			<h1 class="flowbie-fields-acf-titlebar__title"><?php echo esc_html( $title ); ?></h1>
			<?php if ( $add_url ) : ?>
				<a href="<?php echo esc_url( $add_url ); ?>" class="flowbie-fields-acf-add-new page-title-action">
					<span class="flowbie-fields-acf-add-new__icon" aria-hidden="true">+</span>
					<?php echo esc_html( $add_label ); ?>
				</a>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * @param array<int, array{label: string, url: string, count: int, current?: bool}> $views Status views.
	 */
	private static function render_fields_shell_views( array $views ): void {
		if ( empty( $views ) ) {
			return;
		}
		?>
		<ul class="subsubsub flowbie-fields-acf-views">
			<?php
			$last = count( $views ) - 1;
			foreach ( $views as $i => $view ) :
				?>
				<li>
					<a href="<?php echo esc_url( $view['url'] ); ?>"<?php echo ! empty( $view['current'] ) ? ' class="current"' : ''; ?>>
						<?php echo esc_html( $view['label'] ); ?>
						<span class="count">(<?php echo esc_html( (string) (int) $view['count'] ); ?>)</span>
					</a><?php echo $i < $last ? ' |' : ''; ?>
				</li>
			<?php endforeach; ?>
		</ul>
		<?php
	}

	/**
	 * @param array<string, mixed> $item Post type config.
	 */
	public static function fields_post_type_is_active( array $item ): bool {
		if ( array_key_exists( 'active', $item ) ) {
			return (bool) $item['active'];
		}
		return ! empty( $item['public'] ) || ! empty( $item['show_ui'] );
	}

	/**
	 * @return array<int, string> Field group titles linked to a post type.
	 */
	public static function fields_groups_for_post_type( string $post_type ): array {
		$out = array();
		foreach ( Flowbie_Wp_Fields_Storage::get_all_groups( false ) as $group ) {
			$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
			foreach ( $location as $rule_group ) {
				if ( ! is_array( $rule_group ) ) {
					continue;
				}
				foreach ( $rule_group as $rule ) {
					if ( ! is_array( $rule ) ) {
						continue;
					}
					if ( ( $rule['param'] ?? '' ) === 'post_type' && (string) ( $rule['value'] ?? '' ) === $post_type ) {
						$out[] = (string) ( $group['title'] ?? $group['key'] ?? '' );
						break 2;
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @return array<int, string>
	 */
	public static function fields_group_is_active( array $group ): bool {
		return ! isset( $group['active'] ) || ! empty( $group['active'] );
	}

	public static function fields_taxonomies_for_post_type( string $post_type ): array {
		$out = array();
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY ) as $tax ) {
			$objects = (array) ( $tax['object_type'] ?? array() );
			if ( in_array( $post_type, $objects, true ) ) {
				$out[] = (string) ( $tax['labels']['name'] ?? $tax['taxonomy'] ?? '' );
			}
		}
		if ( empty( $out ) && taxonomy_exists( 'category' ) && $post_type === 'post' ) {
			$out[] = 'Categories';
		}
		return $out;
	}

	private static function fields_status_views( string $page_slug, string $current, int $all, int $active, int $inactive ): array {
		$base = admin_url( 'admin.php?page=' . $page_slug );
		return array(
			array(
				'label'   => __( 'All', 'flowbie-wp' ),
				'url'     => $base,
				'count'   => $all,
				'current' => $current === 'all',
			),
			array(
				'label'   => __( 'Active', 'flowbie-wp' ),
				'url'     => add_query_arg( 'status', 'active', $base ),
				'count'   => $active,
				'current' => $current === 'active',
			),
			array(
				'label'   => __( 'Inactive', 'flowbie-wp' ),
				'url'     => add_query_arg( 'status', 'inactive', $base ),
				'count'   => $inactive,
				'current' => $current === 'inactive',
			),
		);
	}

	/**
	 * @param WP_List_Table $table List table instance.
	 */
	private static function render_fields_shell_list_toolbar( $table, string $page_slug, string $search_label ): void {
		?>
		<div class="flowbie-fields-acf-toolbar">
			<?php
			$status = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( (string) $_GET['status'] ) ) : 'all';
			if ( ! in_array( $status, array( 'all', 'active', 'inactive' ), true ) ) {
				$status = 'all';
			}
			if ( 'flowbie-wp-fields' === $page_slug ) {
				$all_groups = Flowbie_Wp_Fields_Storage::get_all_groups( false );
				$active     = 0;
				foreach ( $all_groups as $group ) {
					if ( self::fields_group_is_active( is_array( $group ) ? $group : array() ) ) {
						++$active;
					}
				}
				self::render_fields_shell_views(
					self::fields_status_views( $page_slug, $status, count( $all_groups ), $active, count( $all_groups ) - $active )
				);
			} elseif ( 'flowbie-wp-post-types' === $page_slug ) {
				$all_items = Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE );
				$active    = 0;
				foreach ( $all_items as $item ) {
					if ( self::fields_post_type_is_active( is_array( $item ) ? $item : array() ) ) {
						++$active;
					}
				}
				self::render_fields_shell_views(
					self::fields_status_views( $page_slug, $status, count( $all_items ), $active, count( $all_items ) - $active )
				);
			}
			?>
			<form method="get" class="search-form flowbie-fields-acf-search">
				<input type="hidden" name="page" value="<?php echo esc_attr( $page_slug ); ?>" />
				<?php if ( isset( $_GET['status'] ) ) : ?>
					<input type="hidden" name="status" value="<?php echo esc_attr( sanitize_key( wp_unslash( (string) $_GET['status'] ) ) ); ?>" />
				<?php endif; ?>
				<?php $table->search_box( $search_label, 'flowbie-fields-search' ); ?>
			</form>
		</div>
		<?php
	}
}

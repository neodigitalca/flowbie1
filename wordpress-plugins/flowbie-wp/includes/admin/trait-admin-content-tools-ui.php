<?php
/**
 * Content type switch and duplicate admin UI.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Content_Tools_Ui {

	const CONTENT_TYPE_COLUMN = 'flowbie_content_type';

	public static function register_content_tools_ui(): void {
		add_action( 'admin_init', array( __CLASS__, 'register_content_tools_list_hooks' ) );
		add_action( 'bulk_edit_custom_box', array( __CLASS__, 'render_bulk_edit_content_type_box' ), 10, 2 );
		add_action( 'post_submitbox_misc_actions', array( __CLASS__, 'render_publish_box_duplicate' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_content_tools_assets' ) );
	}

	public static function register_content_tools_list_hooks(): void {
		add_filter( 'default_hidden_columns', array( __CLASS__, 'hide_content_type_column' ), 10, 2 );
		foreach ( array_keys( Flowbie_Wp_Content_Tools::get_switchable_post_types() ) as $post_type ) {
			add_filter( "manage_{$post_type}_posts_columns", array( __CLASS__, 'add_content_type_column' ) );
			add_action( "manage_{$post_type}_posts_custom_column", array( __CLASS__, 'render_content_type_column' ), 10, 2 );
			add_filter( "{$post_type}_row_actions", array( __CLASS__, 'add_duplicate_row_action' ), 10, 2 );
		}
	}

	/**
	 * Hidden column so bulk_edit_custom_box fires (WordPress skips core columns).
	 *
	 * @param array<string, string> $columns Columns.
	 * @return array<string, string>
	 */
	public static function add_content_type_column( array $columns ): array {
		$columns[ self::CONTENT_TYPE_COLUMN ] = __( 'Content type', 'flowbie-wp' );
		return $columns;
	}

	/**
	 * @param string $column  Column key.
	 * @param int    $post_id Post ID.
	 */
	public static function render_content_type_column( string $column, int $post_id ): void {
		if ( $column !== self::CONTENT_TYPE_COLUMN ) {
			return;
		}
		echo '&mdash;';
	}

	/**
	 * @param string[]     $hidden  Hidden columns.
	 * @param WP_Screen    $screen  Screen.
	 * @return string[]
	 */
	public static function hide_content_type_column( array $hidden, WP_Screen $screen ): array {
		if ( $screen->base === 'edit' && Flowbie_Wp_Content_Tools::is_switchable_post_type( (string) $screen->post_type ) ) {
			$hidden[] = self::CONTENT_TYPE_COLUMN;
		}
		return $hidden;
	}

	/**
	 * @param string $column_name List table column.
	 * @param string $post_type   Post type slug.
	 */
	public static function render_bulk_edit_content_type_box( string $column_name, string $post_type ): void {
		if ( $column_name !== self::CONTENT_TYPE_COLUMN ) {
			return;
		}
		if ( ! Flowbie_Wp_Content_Tools::is_switchable_post_type( $post_type ) ) {
			return;
		}

		$types = Flowbie_Wp_Content_Tools::get_switchable_post_types();
		?>
		<fieldset class="inline-edit-col-right flowbie-content-tools-bulk-edit">
			<div class="inline-edit-col column-<?php echo esc_attr( self::CONTENT_TYPE_COLUMN ); ?>">
				<label class="inline-edit-group">
					<span class="title"><?php esc_html_e( 'Content type', 'flowbie-wp' ); ?></span>
					<select name="flowbie_new_post_type">
						<option value="-1"><?php esc_html_e( 'No Change', 'flowbie-wp' ); ?></option>
						<?php foreach ( $types as $slug => $type_obj ) : ?>
							<option value="<?php echo esc_attr( $slug ); ?>">
								<?php echo esc_html( $type_obj->labels->singular_name ?? $slug ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</label>
			</div>
		</fieldset>
		<?php
	}

	public static function enqueue_content_tools_assets( string $hook ): void {
		if ( $hook !== 'edit.php' ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || $screen->base !== 'edit' ) {
			return;
		}
		$post_type = (string) ( $screen->post_type ?? '' );
		if ( ! Flowbie_Wp_Content_Tools::is_switchable_post_type( $post_type ) ) {
			return;
		}
		wp_enqueue_style(
			'flowbie-wp-content-tools',
			plugins_url( 'assets/admin/content-tools.css', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			FLOWBIE_WP_VERSION
		);
	}

	/**
	 * @param array<string, string> $actions Row actions.
	 * @param WP_Post               $post    Post.
	 * @return array<string, string>
	 */
	public static function add_duplicate_row_action( array $actions, WP_Post $post ): array {
		if ( ! Flowbie_Wp_Content_Tools::user_can_duplicate( (int) $post->ID ) ) {
			return $actions;
		}
		$url = wp_nonce_url(
			admin_url(
				'admin-post.php?action=' . self::ACTION_DUPLICATE_POST
				. '&post_id=' . (int) $post->ID
				. '&redirect_to=' . rawurlencode( admin_url( 'edit.php?post_type=' . $post->post_type ) )
			),
			self::ACTION_DUPLICATE_POST,
			'flowbie_content_tools_nonce'
		);
		$actions['flowbie_duplicate'] = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Duplicate', 'flowbie-wp' ) . '</a>';
		return $actions;
	}

	public static function render_publish_box_duplicate(): void {
		global $post;
		if ( ! $post instanceof WP_Post || $post->ID < 1 ) {
			return;
		}
		if ( ! Flowbie_Wp_Content_Tools::is_switchable_post_type( $post->post_type ) ) {
			return;
		}
		if ( ! Flowbie_Wp_Content_Tools::user_can_duplicate( (int) $post->ID ) ) {
			return;
		}
		$url = wp_nonce_url(
			admin_url(
				'admin-post.php?action=' . self::ACTION_DUPLICATE_POST
				. '&post_id=' . (int) $post->ID
				. '&redirect_to=' . rawurlencode( get_edit_post_link( $post->ID, 'raw' ) ?: admin_url( 'edit.php?post_type=' . $post->post_type ) )
			),
			self::ACTION_DUPLICATE_POST,
			'flowbie_content_tools_nonce'
		);
		?>
		<div class="misc-pub-section flowbie-content-tools-duplicate">
			<a href="<?php echo esc_url( $url ); ?>" class="button button-secondary"><?php esc_html_e( 'Duplicate', 'flowbie-wp' ); ?></a>
		</div>
		<?php
	}
}

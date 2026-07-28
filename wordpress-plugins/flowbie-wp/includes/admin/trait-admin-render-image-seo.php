<?php
/**
 * Image SEO admin page.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Image_Seo {

	public static function render_image_seo_page(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/admin/class-flowbie-wp-image-seo-list-table.php';
		if ( ! current_user_can( 'upload_files' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Image SEO.', 'flowbie-wp' ) );
		}

		$tab    = self::panel_active_tab( 'library' );
		$config = Flowbie_Wp_Image_Seo::get_config();
		$status = Flowbie_Wp_Image_Seo_Gate::get_status();

		self::flowbie_group_shell_open( 'flowbie-wp-image-seo', 'flowbie-wp-image-seo', 'image-seo' );

		if ( 'settings' === $tab ) {
			self::render_image_seo_settings( $config, $status );
		} else {
			self::render_image_seo_library( $status );
		}

		self::flowbie_group_shell_close();
	}

	private static function render_image_seo_openrouter_notice( array $status ): void {
		if ( ! empty( $status['openRouterConfigured'] ) ) {
			return;
		}
		?>
		<div class="notice notice-warning">
			<p>
				<?php
				printf(
					wp_kses(
						/* translators: %s: settings link */
						__( 'OpenRouter is not configured. Filename-only optimization works; add a key under %s for AI optimization.', 'flowbie-wp' ),
						array( 'a' => array( 'href' => array() ) )
					),
					'<a href="' . esc_url( admin_url( 'admin.php?page=flowbie-wp-settings&tab=openrouter' ) ) . '">' . esc_html__( 'Settings → Editor AI', 'flowbie-wp' ) . '</a>'
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $status
	 */
	private static function render_image_seo_library( array $status ): void {
		$list_table = new Flowbie_Wp_Image_Seo_List_Table();
		$list_table->prepare_items();
		$edit_mode   = $list_table->is_edit_mode();
		$missing_alt = isset( $_GET['missing_alt'] ) && '1' === (string) wp_unslash( $_GET['missing_alt'] );
		$base_url    = admin_url( 'admin.php?page=flowbie-wp-image-seo&tab=library' );
		$settings_url = admin_url( 'admin.php?page=flowbie-wp-image-seo&tab=settings' );
		$toggle_url  = add_query_arg( 'edit_mode', $edit_mode ? '0' : '1', $base_url );
		if ( $missing_alt ) {
			$toggle_url = add_query_arg( 'missing_alt', '1', $toggle_url );
		}
		?>
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Image SEO', 'flowbie-wp' ); ?></h1>
			<a href="<?php echo esc_url( $settings_url ); ?>" class="page-title-action"><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></a>
			<a href="<?php echo esc_url( $toggle_url ); ?>" class="page-title-action">
				<?php echo $edit_mode ? esc_html__( 'Exit edit mode', 'flowbie-wp' ) : esc_html__( 'Edit inline', 'flowbie-wp' ); ?>
			</a>
			<?php if ( $edit_mode ) : ?>
				<button type="button" class="page-title-action button-primary flowbie-image-seo-save-inline"><?php esc_html_e( 'Save changes', 'flowbie-wp' ); ?></button>
			<?php endif; ?>
			<hr class="wp-header-end" />

			<?php self::render_image_seo_openrouter_notice( $status ); ?>

			<p class="description flowbie-wp-image-seo__note">
				<?php esc_html_e( 'Review and optimize image metadata. Use bulk actions or row Optimize for AI suggestions based on filenames.', 'flowbie-wp' ); ?>
			</p>

			<ul class="subsubsub">
				<?php
				$views = array(
					array(
						'key'     => 'all',
						'label'   => __( 'All images', 'flowbie-wp' ),
						'url'     => $base_url,
						'current' => ! $missing_alt,
					),
					array(
						'key'     => 'missing_alt',
						'label'   => __( 'Missing alt', 'flowbie-wp' ),
						'url'     => add_query_arg( 'missing_alt', '1', $base_url ),
						'current' => $missing_alt,
					),
				);
				$parts = array();
				foreach ( $views as $view ) {
					$url = $view['url'];
					if ( $edit_mode ) {
						$url = add_query_arg( 'edit_mode', '1', $url );
					}
					if ( ! empty( $view['current'] ) ) {
						$parts[] = '<li class="' . esc_attr( (string) $view['key'] ) . '"><a href="' . esc_url( $url ) . '" class="current" aria-current="page">' . esc_html( (string) $view['label'] ) . '</a></li>';
					} else {
						$parts[] = '<li class="' . esc_attr( (string) $view['key'] ) . '"><a href="' . esc_url( $url ) . '">' . esc_html( (string) $view['label'] ) . '</a></li>';
					}
				}
				echo wp_kses_post( implode( ' | ', $parts ) );
				?>
			</ul>

			<form method="get" class="flowbie-image-seo-search">
				<input type="hidden" name="page" value="flowbie-wp-image-seo" />
				<input type="hidden" name="tab" value="library" />
				<?php if ( $missing_alt ) : ?>
					<input type="hidden" name="missing_alt" value="1" />
				<?php endif; ?>
				<?php if ( $edit_mode ) : ?>
					<input type="hidden" name="edit_mode" value="1" />
				<?php endif; ?>
				<?php $list_table->search_box( __( 'Search images', 'flowbie-wp' ), 'image-seo' ); ?>
			</form>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_BULK_IMAGE_SEO ); ?>" />
				<?php wp_nonce_field( 'bulk-images' ); ?>
				<?php if ( isset( $_GET['s'] ) && (string) $_GET['s'] !== '' ) : ?>
					<input type="hidden" name="s" value="<?php echo esc_attr( sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) ); ?>" />
				<?php endif; ?>
				<?php if ( $missing_alt ) : ?>
					<input type="hidden" name="missing_alt" value="1" />
				<?php endif; ?>
				<?php $list_table->display(); ?>
			</form>
		<?php
	}

	/**
	 * @param array<string,mixed> $config
	 * @param array<string,mixed> $status
	 */
	private static function render_image_seo_settings( array $config, array $status ): void {
		$form_id = 'flowbie-wp-image-seo-settings-form';
		$fields  = is_array( $config['fields'] ?? null ) ? $config['fields'] : Flowbie_Wp_Image_Seo::default_config()['fields'];
		$library_url = admin_url( 'admin.php?page=flowbie-wp-image-seo&tab=library' );
		?>
			<h1><?php esc_html_e( 'Image SEO Settings', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( $library_url ); ?>">&larr; <?php esc_html_e( 'Back to library', 'flowbie-wp' ); ?></a></p>

			<?php self::render_image_seo_openrouter_notice( $status ); ?>

			<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_IMAGE_SEO ); ?>" />
			<input type="hidden" name="flowbie_image_seo_tab" value="settings" />
			<?php wp_nonce_field( self::ACTION_SAVE_IMAGE_SEO, 'flowbie_wp_image_seo_nonce' ); ?>

			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Overwrite mode', 'flowbie-wp' ); ?></th>
					<td>
						<label><input type="radio" name="overwrite_mode" value="missing_only" <?php checked( $config['overwrite_mode'] ?? 'missing_only', 'missing_only' ); ?> /> <?php esc_html_e( 'Fill missing fields only', 'flowbie-wp' ); ?></label><br />
						<label><input type="radio" name="overwrite_mode" value="overwrite_all" <?php checked( $config['overwrite_mode'] ?? '', 'overwrite_all' ); ?> /> <?php esc_html_e( 'Overwrite existing text', 'flowbie-wp' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Target fields', 'flowbie-wp' ); ?></th>
					<td>
						<?php foreach ( Flowbie_Wp_Image_Seo::FIELD_KEYS as $key ) : ?>
							<label style="display:block;margin-bottom:4px;">
								<input type="checkbox" name="field_<?php echo esc_attr( $key ); ?>" value="1" <?php checked( ! empty( $fields[ $key ] ) ); ?> />
								<?php echo esc_html( ucfirst( $key ) ); ?>
							</label>
						<?php endforeach; ?>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Auto on upload', 'flowbie-wp' ); ?></th>
					<td>
						<label><input type="checkbox" name="auto_on_upload" value="1" <?php checked( ! empty( $config['auto_on_upload'] ) ); ?> /> <?php esc_html_e( 'Automatically optimize new image uploads', 'flowbie-wp' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Auto in gallery', 'flowbie-wp' ); ?></th>
					<td>
						<label><input type="checkbox" name="auto_in_gallery" value="1" <?php checked( ! empty( $config['auto_in_gallery'] ) ); ?> /> <?php esc_html_e( 'Automatically optimize when images are added to a Flowbie gallery field', 'flowbie-wp' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Auto-update mode', 'flowbie-wp' ); ?></th>
					<td>
						<label><input type="radio" name="auto_mode" value="filename" <?php checked( $config['auto_mode'] ?? 'filename', 'filename' ); ?> /> <?php esc_html_e( 'Filename only (no API call)', 'flowbie-wp' ); ?></label><br />
						<label><input type="radio" name="auto_mode" value="ai" <?php checked( $config['auto_mode'] ?? '', 'ai' ); ?> /> <?php esc_html_e( 'OpenRouter Gemini (uses API credits)', 'flowbie-wp' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Post context', 'flowbie-wp' ); ?></th>
					<td>
						<label><input type="checkbox" name="context_from_post" value="1" <?php checked( ! empty( $config['context_from_post'] ) ); ?> /> <?php esc_html_e( 'Include parent post title and URL in AI prompts when optimizing from the post editor', 'flowbie-wp' ); ?></label>
					</td>
				</tr>
			</table>
				<p class="submit"><button type="submit" class="button button-primary"><?php esc_html_e( 'Save Image SEO settings', 'flowbie-wp' ); ?></button></p>
			</form>
		<?php
	}

	public static function enqueue_image_seo_assets( string $hook_suffix ): void {
		if ( 'flowbie-wp_page_flowbie-wp-image-seo' !== $hook_suffix ) {
			return;
		}
		$base = 'assets/admin/';
		$css  = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-image-seo.css';
		$js   = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-image-seo.js';
		$ver  = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.9.0';
		if ( is_readable( $css ) ) {
			wp_enqueue_style(
				'flowbie-wp-admin-image-seo',
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $base . 'admin-image-seo.css',
				array( 'flowbie-wp-admin-settings' ),
				$ver . '.' . (string) filemtime( $css )
			);
		}
		if ( is_readable( $js ) ) {
			wp_enqueue_script(
				'flowbie-wp-admin-image-seo',
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $base . 'admin-image-seo.js',
				array( 'jquery' ),
				$ver . '.' . (string) filemtime( $js ),
				true
			);
			wp_localize_script(
				'flowbie-wp-admin-image-seo',
				'flowbieWpImageSeo',
				array(
					'root'  => esc_url_raw( rest_url( 'flowbie/v1/image-seo' ) ),
					'nonce' => wp_create_nonce( 'wp_rest' ),
					'strings' => array(
						'optimizing' => __( 'Optimizing…', 'flowbie-wp' ),
						'apply'      => __( 'Apply', 'flowbie-wp' ),
						'cancel'     => __( 'Cancel', 'flowbie-wp' ),
						'error'      => __( 'Optimization failed.', 'flowbie-wp' ),
						'saved'      => __( 'Changes saved.', 'flowbie-wp' ),
					),
				)
			);
		}
	}
}

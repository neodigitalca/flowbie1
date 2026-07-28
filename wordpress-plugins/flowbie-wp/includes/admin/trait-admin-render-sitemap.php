<?php
/**
 * Sitemap wp-admin settings page (Rank Math–inspired layout).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Sitemap {

	public static function render_sitemap_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}

		$config    = Flowbie_Wp_Sitemap_Settings::get_config();
		$tab       = self::panel_active_tab( 'general' );

		$post_types = get_post_types( array( 'public' => true ), 'objects' );
		$taxonomies = get_taxonomies( array( 'public' => true ), 'objects' );
		$conflicts  = Flowbie_Wp_Sitemap_Settings::conflicting_plugins();

		$pt_tabs = array();
		foreach ( $post_types as $slug => $obj ) {
			$pt_tabs[ 'pt-' . $slug ] = $obj->labels->name;
		}
		$pt_tabs['pt-rebuild-all'] = __( 'Rebuild all', 'flowbie-wp' );
		$tax_tabs = array();
		foreach ( $taxonomies as $slug => $obj ) {
			$tax_tabs[ 'tax-' . $slug ] = $obj->labels->name;
		}

		$nav_groups = array(
			array(
				'heading' => __( 'General', 'flowbie-wp' ),
				'tabs'    => array(
					'general'   => __( 'General', 'flowbie-wp' ),
					'html'      => __( 'HTML Sitemap', 'flowbie-wp' ),
					'optimizer' => __( 'Content Optimizer', 'flowbie-wp' ),
				),
			),
			array(
				'heading' => __( 'Post Types', 'flowbie-wp' ),
				'tabs'    => $pt_tabs,
			),
			array(
				'heading' => __( 'Taxonomies', 'flowbie-wp' ),
				'tabs'    => $tax_tabs,
			),
		);

		self::flowbie_group_shell_open( 'flowbie-wp-sitemap', 'flowbie-wp-sitemap flowbie-wp-panel-page' );

		if ( ! empty( $conflicts ) ) : ?>
			<div class="notice notice-warning flowbie-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These SEO plugins also generate sitemaps: %s. Disable their sitemaps or Flowbie sitemap to avoid duplicate index files.', 'flowbie-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif;

		self::panel_layout_start( 'flowbie-wp-sitemap', $nav_groups, $tab, __( 'Sitemap settings sections', 'flowbie-wp' ) );
		if ( 'html' === $tab ) {
			self::render_sitemap_section_html( $config, $tab );
		} elseif ( 'optimizer' === $tab ) {
			self::render_sitemap_section_optimizer( $config, $tab, $post_types );
		} elseif ( 0 === strpos( $tab, 'pt-' ) ) {
			$slug = sanitize_key( substr( $tab, 3 ) );
			if ( 'rebuild-all' === $slug ) {
				self::render_sitemap_section_rebuild_all( $tab );
			} else {
				self::render_sitemap_section_post_type( $config, $tab, $slug, $post_types );
			}
		} elseif ( 0 === strpos( $tab, 'tax-' ) ) {
			$slug = sanitize_key( substr( $tab, 4 ) );
			self::render_sitemap_section_taxonomy( $config, $tab, $slug, $taxonomies );
		} else {
			self::render_sitemap_section_general( $config, $tab );
		}
		self::panel_layout_end();

		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	private static function render_sitemap_section_general( array $config, string $tab ): void {
		$general = isset( $config['general'] ) && is_array( $config['general'] ) ? $config['general'] : array();
		$form_id = 'flowbie-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="flowbie_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' ); ?>

			<div class="flowbie-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'flowbie-wp' ); ?></strong>
				<a href="<?php echo esc_url( Flowbie_Wp_Sitemap_Settings::index_url() ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( Flowbie_Wp_Sitemap_Settings::index_url() ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_sitemap_enabled',
				__( 'Enable XML sitemap', 'flowbie-wp' ),
				! empty( $general['enabled'] ),
				__( 'Serve sitemap_index.xml and child sitemaps from Flowbie WP.', 'flowbie-wp' )
			);
			self::panel_form_field_input(
				'flowbie_sitemap_links_per',
				'flowbie_sitemap_links_per',
				__( 'Links per sitemap', 'flowbie-wp' ),
				(string) ( $general['links_per_sitemap'] ?? 200 ),
				'half',
				'number',
				false,
				__( 'Maximum URLs per sitemap file before pagination (e.g. post-sitemap2.xml).', 'flowbie-wp' ),
				' min="1" max="50000"'
			);
			self::panel_form_toggle(
				'flowbie_sitemap_include_images',
				__( 'Include images in sitemap', 'flowbie-wp' ),
				! empty( $general['include_images'] ),
				__( 'Add featured images and custom-field image URLs to post type sitemaps.', 'flowbie-wp' )
			);
			self::panel_form_field_textarea(
				'flowbie_sitemap_exclude_ids',
				'flowbie_sitemap_exclude_ids',
				__( 'Exclude posts', 'flowbie-wp' ),
				(string) ( $general['exclude_post_ids'] ?? '' ),
				'full',
				4,
				__( 'Post IDs to exclude from all sitemaps. One ID per line or comma-separated.', 'flowbie-wp' )
			);
			self::panel_form_group_close();
			?>
		</form>
		<?php self::render_sitemap_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	private static function render_sitemap_section_html( array $config, string $tab ): void {
		$html    = isset( $config['html'] ) && is_array( $config['html'] ) ? $config['html'] : array();
		$form_id = 'flowbie-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="flowbie_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_sitemap_html_enabled',
				__( 'Enable HTML sitemap', 'flowbie-wp' ),
				! empty( $html['enabled'] )
			);
			self::panel_form_field_select(
				'flowbie_sitemap_html_sort',
				'flowbie_sitemap_html_sort',
				__( 'Sort order', 'flowbie-wp' ),
				array(
					'title'      => __( 'Title (A–Z)', 'flowbie-wp' ),
					'date'       => __( 'Date (newest first)', 'flowbie-wp' ),
					'menu_order' => __( 'Menu order', 'flowbie-wp' ),
				),
				(string) ( $html['sort_order'] ?? 'title' ),
				'half'
			);
			?>
			<div class="flowbie-schema-cell flowbie-schema-cell--half">
				<div class="flowbie-field flowbie-field--select flowbie-field--stacked">
					<label class="flowbie-field__label flowbie-field__label--above" for="flowbie_sitemap_html_page_id"><?php esc_html_e( 'Assign to page (optional)', 'flowbie-wp' ); ?></label>
					<?php
					wp_dropdown_pages(
						array(
							'name'              => 'flowbie_sitemap_html_page_id',
							'id'                => 'flowbie_sitemap_html_page_id',
							'selected'          => (int) ( $html['page_id'] ?? 0 ),
							'show_option_none'  => __( '— None —', 'flowbie-wp' ),
							'option_none_value' => '0',
							'class'             => 'flowbie-field__control',
						)
					);
					?>
					<p class="flowbie-field__note">
						<?php
						echo wp_kses(
							__( 'Add the shortcode <code>[flowbie_sitemap]</code> to any page. The dropdown above is for your reference when picking a dedicated sitemap page.', 'flowbie-wp' ),
							array( 'code' => array() )
						);
						?>
					</p>
				</div>
			</div>
			<?php
			self::panel_form_group_close();
			?>
		</form>
		<?php self::render_sitemap_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed>                    $config     Config.
	 * @param array<string, WP_Post_Type>|\stdClass[] $post_types Post types.
	 */
	private static function render_sitemap_section_optimizer( array $config, string $tab, $post_types ): void {
		$form_id = 'flowbie-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="flowbie_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			?>
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" id="flowbie_sitemap_optimizer_select_all" />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Enable for all sitemaps', 'flowbie-wp' ); ?></span>
				</label>
				<p class="flowbie-field__note"><?php esc_html_e( 'Quick toggle — does not save until you click Save Changes.', 'flowbie-wp' ); ?></p>
			</div>
			<?php
			foreach ( $post_types as $slug => $obj ) {
				$settings = isset( $config['post_types'][ $slug ] ) && is_array( $config['post_types'][ $slug ] )
					? $config['post_types'][ $slug ]
					: array();
				$enabled  = ! empty( $settings['content_optimizer'] );
				$sitemap  = Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug );
				?>
				<div class="flowbie-schema-cell flowbie-schema-cell--half">
					<label class="flowbie-wp-panel-toggle">
						<input
							type="checkbox"
							class="flowbie-wp-sitemap-optimizer-cb"
							name="flowbie_sitemap_content_optimizer[<?php echo esc_attr( $slug ); ?>]"
							value="1"
							<?php checked( $enabled ); ?>
						/>
						<span class="flowbie-wp-panel-toggle__label"><?php echo esc_html( $obj->labels->name ); ?></span>
					</label>
					<p class="flowbie-field__note"><code><?php echo esc_html( $sitemap ); ?></code></p>
				</div>
				<?php
			}
			self::panel_form_group_close();
			?>
		</form>
		<?php
		self::render_sitemap_optimizer_select_all_script();
		self::render_sitemap_form_footer( $tab, $form_id );
		?>
		<?php
	}

	private static function render_sitemap_optimizer_select_all_script(): void {
		static $printed = false;
		if ( $printed ) {
			return;
		}
		$printed = true;
		?>
		<script>
		(function () {
			var master = document.getElementById('flowbie_sitemap_optimizer_select_all');
			if (!master) {
				return;
			}
			var boxes = document.querySelectorAll('.flowbie-wp-sitemap-optimizer-cb');
			if (!boxes.length) {
				return;
			}
			function syncMaster() {
				var checked = 0;
				boxes.forEach(function (box) {
					if (box.checked) {
						checked++;
					}
				});
				master.checked = checked === boxes.length;
				master.indeterminate = checked > 0 && checked < boxes.length;
			}
			master.addEventListener('change', function () {
				boxes.forEach(function (box) {
					box.checked = master.checked;
				});
				master.indeterminate = false;
			});
			boxes.forEach(function (box) {
				box.addEventListener('change', syncMaster);
			});
			syncMaster();
		}());
		</script>
		<?php
	}

	/**
	 * @param array<string, mixed>                          $config     Config.
	 * @param array<string, WP_Post_Type>|\stdClass[]       $post_types Post types.
	 */
	private static function render_sitemap_section_post_type( array $config, string $tab, string $slug, $post_types ): void {
		if ( ! isset( $post_types[ $slug ] ) ) {
			echo '<p>' . esc_html__( 'Unknown post type.', 'flowbie-wp' ) . '</p>';
			return;
		}

		$obj         = $post_types[ $slug ];
		$settings    = isset( $config['post_types'][ $slug ] ) && is_array( $config['post_types'][ $slug ] )
			? $config['post_types'][ $slug ]
			: array();
		$sitemap_url = Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug );
		$form_id     = 'flowbie-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="flowbie_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' ); ?>

			<div class="flowbie-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'flowbie-wp' ); ?></strong>
				<a href="<?php echo esc_url( $sitemap_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $sitemap_url ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_sitemap_content_optimizer',
				__( 'Enable Content Optimizer', 'flowbie-wp' ),
				! empty( $settings['content_optimizer'] ),
				__( 'Show Flowbie Content Optimizer in the editor for this post type.', 'flowbie-wp' )
			);
			self::panel_form_toggle(
				'flowbie_sitemap_include_xml',
				__( 'Include in XML sitemap', 'flowbie-wp' ),
				! empty( $settings['include_xml'] ),
				__( 'Include this post type in the XML sitemap.', 'flowbie-wp' )
			);
			self::panel_form_toggle(
				'flowbie_sitemap_include_html',
				__( 'Include in HTML sitemap', 'flowbie-wp' ),
				! empty( $settings['include_html'] ),
				__( 'Include this post type in the HTML sitemap when it is enabled.', 'flowbie-wp' )
			);
			self::panel_form_field_textarea(
				'flowbie_sitemap_image_meta',
				'flowbie_sitemap_image_meta',
				__( 'Image custom fields', 'flowbie-wp' ),
				(string) ( $settings['image_meta'] ?? '' ),
				'full',
				6,
				__( 'Insert custom field (post meta) names which contain image URLs to include them in the sitemaps. Add one per line.', 'flowbie-wp' )
			);
			self::panel_form_group_close();
			?>
		</form>
		<?php
		self::render_sitemap_form_footer(
			$tab,
			$form_id,
			array(
				array(
					'action'       => self::ACTION_REBUILD_SITEMAP_POST_TYPE,
					'nonce_action' => self::ACTION_REBUILD_SITEMAP_POST_TYPE,
					'nonce_field'  => 'flowbie_wp_sitemap_rebuild_post_type_nonce',
					'label'        => __( 'Rebuild sitemap', 'flowbie-wp' ),
					'button_class' => '',
				),
			)
		);
		?>
		<?php
	}

	private static function render_sitemap_section_rebuild_all( string $tab ): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Rebuild all post type sitemaps', 'flowbie-wp' ); ?></h2>
		<?php
		self::panel_footer_actions(
			$tab,
			'flowbie_sitemap_tab',
			array(
				array(
					'action'       => self::ACTION_REBUILD_SITEMAP_ALL_POST_TYPES,
					'nonce_action' => self::ACTION_REBUILD_SITEMAP_ALL_POST_TYPES,
					'nonce_field'  => 'flowbie_wp_sitemap_rebuild_all_post_types_nonce',
					'label'        => __( 'Rebuild all post type sitemaps', 'flowbie-wp' ),
					'button_class' => 'button-primary',
				),
			)
		);
	}

	/**
	 * @param array<string, mixed>                    $config     Config.
	 * @param array<string, WP_Taxonomy>|\stdClass[]   $taxonomies Taxonomies.
	 */
	private static function render_sitemap_section_taxonomy( array $config, string $tab, string $slug, $taxonomies ): void {
		if ( ! isset( $taxonomies[ $slug ] ) ) {
			echo '<p>' . esc_html__( 'Unknown taxonomy.', 'flowbie-wp' ) . '</p>';
			return;
		}

		$settings    = isset( $config['taxonomies'][ $slug ] ) && is_array( $config['taxonomies'][ $slug ] )
			? $config['taxonomies'][ $slug ]
			: array();
		$sitemap_url = Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug );
		$form_id     = 'flowbie-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="flowbie_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' ); ?>

			<div class="flowbie-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'flowbie-wp' ); ?></strong>
				<a href="<?php echo esc_url( $sitemap_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $sitemap_url ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_sitemap_include_xml',
				__( 'Include in XML sitemap', 'flowbie-wp' ),
				! empty( $settings['include_xml'] )
			);
			self::panel_form_toggle(
				'flowbie_sitemap_include_html',
				__( 'Include in HTML sitemap', 'flowbie-wp' ),
				! empty( $settings['include_html'] )
			);
			self::panel_form_group_close();
			?>
		</form>
		<?php self::render_sitemap_form_footer( $tab, $form_id ); ?>
		<?php
	}

	private static function render_sitemap_form_footer( string $tab, string $form_id, array $extra_actions = array() ): void {
		$actions = array_merge(
			array(
				array(
					'action'       => self::ACTION_FLUSH_SITEMAP,
					'nonce_action' => self::ACTION_FLUSH_SITEMAP,
					'nonce_field'  => 'flowbie_wp_sitemap_flush_nonce',
					'label'        => __( 'Flush sitemap cache', 'flowbie-wp' ),
					'button_class' => '',
				),
			),
			$extra_actions
		);

		self::panel_footer_save(
			$tab,
			$form_id,
			self::ACTION_RESET_SITEMAP,
			self::ACTION_RESET_SITEMAP,
			'flowbie_wp_sitemap_reset_nonce',
			'flowbie_sitemap_tab',
			$actions
		);
	}
}

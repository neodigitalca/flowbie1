<?php
/**
 * Sitemap wp-admin settings page (Rank Math–inspired layout).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Sitemap {

	public static function render_sitemap_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'neo-pulse-wp' ) );
		}

		$config    = Neo_Pulse_Wp_Sitemap_Settings::get_config();
		$tab       = self::panel_active_tab( 'general' );

		$post_types = get_post_types( array( 'public' => true ), 'objects' );
		$taxonomies = get_taxonomies( array( 'public' => true ), 'objects' );
		$conflicts  = Neo_Pulse_Wp_Sitemap_Settings::conflicting_plugins();

		$pt_tabs = array();
		foreach ( $post_types as $slug => $obj ) {
			$pt_tabs[ 'pt-' . $slug ] = $obj->labels->name;
		}
		$pt_tabs['pt-rebuild-all'] = __( 'Rebuild all', 'neo-pulse-wp' );
		$tax_tabs = array();
		foreach ( $taxonomies as $slug => $obj ) {
			$tax_tabs[ 'tax-' . $slug ] = $obj->labels->name;
		}

		$nav_groups = array(
			array(
				'heading' => __( 'General', 'neo-pulse-wp' ),
				'tabs'    => array(
					'general'   => __( 'General', 'neo-pulse-wp' ),
					'html'      => __( 'HTML Sitemap', 'neo-pulse-wp' ),
					'optimizer' => __( 'Content Optimizer', 'neo-pulse-wp' ),
				),
			),
			array(
				'heading' => __( 'Post Types', 'neo-pulse-wp' ),
				'tabs'    => $pt_tabs,
			),
			array(
				'heading' => __( 'Taxonomies', 'neo-pulse-wp' ),
				'tabs'    => $tax_tabs,
			),
		);

		self::neo_pulse_group_shell_open( 'neo-pulse-wp-sitemap', 'neo-pulse-wp-sitemap neo-pulse-wp-panel-page' );

		if ( ! empty( $conflicts ) ) : ?>
			<div class="notice notice-warning neo-pulse-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These SEO plugins also generate sitemaps: %s. Disable their sitemaps or NEO Pulse sitemap to avoid duplicate index files.', 'neo-pulse-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif;

		self::panel_layout_start( 'neo-pulse-wp-sitemap', $nav_groups, $tab, __( 'Sitemap settings sections', 'neo-pulse-wp' ) );
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

		self::neo_pulse_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	private static function render_sitemap_section_general( array $config, string $tab ): void {
		$general = isset( $config['general'] ) && is_array( $config['general'] ) ? $config['general'] : array();
		$form_id = 'neo-pulse-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="neo-pulse_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'neo_pulse_wp_sitemap_nonce' ); ?>

			<div class="neo-pulse-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'neo-pulse-wp' ); ?></strong>
				<a href="<?php echo esc_url( Neo_Pulse_Wp_Sitemap_Settings::index_url() ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( Neo_Pulse_Wp_Sitemap_Settings::index_url() ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_sitemap_enabled',
				__( 'Enable XML sitemap', 'neo-pulse-wp' ),
				! empty( $general['enabled'] ),
				__( 'Serve sitemap_index.xml and child sitemaps from NEO Pulse WP.', 'neo-pulse-wp' )
			);
			self::panel_form_field_input(
				'neo-pulse_sitemap_links_per',
				'neo-pulse_sitemap_links_per',
				__( 'Links per sitemap', 'neo-pulse-wp' ),
				(string) ( $general['links_per_sitemap'] ?? 200 ),
				'half',
				'number',
				false,
				__( 'Maximum URLs per sitemap file before pagination (e.g. post-sitemap2.xml).', 'neo-pulse-wp' ),
				' min="1" max="50000"'
			);
			self::panel_form_toggle(
				'neo-pulse_sitemap_include_images',
				__( 'Include images in sitemap', 'neo-pulse-wp' ),
				! empty( $general['include_images'] ),
				__( 'Add featured images and custom-field image URLs to post type sitemaps.', 'neo-pulse-wp' )
			);
			self::panel_form_field_textarea(
				'neo-pulse_sitemap_exclude_ids',
				'neo-pulse_sitemap_exclude_ids',
				__( 'Exclude posts', 'neo-pulse-wp' ),
				(string) ( $general['exclude_post_ids'] ?? '' ),
				'full',
				4,
				__( 'Post IDs to exclude from all sitemaps. One ID per line or comma-separated.', 'neo-pulse-wp' )
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
		$form_id = 'neo-pulse-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="neo-pulse_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'neo_pulse_wp_sitemap_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_sitemap_html_enabled',
				__( 'Enable HTML sitemap', 'neo-pulse-wp' ),
				! empty( $html['enabled'] )
			);
			self::panel_form_field_select(
				'neo-pulse_sitemap_html_sort',
				'neo-pulse_sitemap_html_sort',
				__( 'Sort order', 'neo-pulse-wp' ),
				array(
					'title'      => __( 'Title (A–Z)', 'neo-pulse-wp' ),
					'date'       => __( 'Date (newest first)', 'neo-pulse-wp' ),
					'menu_order' => __( 'Menu order', 'neo-pulse-wp' ),
				),
				(string) ( $html['sort_order'] ?? 'title' ),
				'half'
			);
			?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--half">
				<div class="neo-pulse-field neo-pulse-field--select neo-pulse-field--stacked">
					<label class="neo-pulse-field__label neo-pulse-field__label--above" for="neo-pulse_sitemap_html_page_id"><?php esc_html_e( 'Assign to page (optional)', 'neo-pulse-wp' ); ?></label>
					<?php
					wp_dropdown_pages(
						array(
							'name'              => 'neo-pulse_sitemap_html_page_id',
							'id'                => 'neo-pulse_sitemap_html_page_id',
							'selected'          => (int) ( $html['page_id'] ?? 0 ),
							'show_option_none'  => __( '— None —', 'neo-pulse-wp' ),
							'option_none_value' => '0',
							'class'             => 'neo-pulse-field__control',
						)
					);
					?>
					<p class="neo-pulse-field__note">
						<?php
						echo wp_kses(
							__( 'Add the shortcode <code>[neo-pulse_sitemap]</code> to any page. The dropdown above is for your reference when picking a dedicated sitemap page.', 'neo-pulse-wp' ),
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
		$form_id = 'neo-pulse-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="neo-pulse_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'neo_pulse_wp_sitemap_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" id="neo-pulse_sitemap_optimizer_select_all" />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Enable for all sitemaps', 'neo-pulse-wp' ); ?></span>
				</label>
				<p class="neo-pulse-field__note"><?php esc_html_e( 'Quick toggle — does not save until you click Save Changes.', 'neo-pulse-wp' ); ?></p>
			</div>
			<?php
			foreach ( $post_types as $slug => $obj ) {
				$settings = isset( $config['post_types'][ $slug ] ) && is_array( $config['post_types'][ $slug ] )
					? $config['post_types'][ $slug ]
					: array();
				$enabled  = ! empty( $settings['content_optimizer'] );
				$sitemap  = Neo_Pulse_Wp_Sitemap_Settings::child_sitemap_url( $slug );
				?>
				<div class="neo-pulse-schema-cell neo-pulse-schema-cell--half">
					<label class="neo-pulse-wp-panel-toggle">
						<input
							type="checkbox"
							class="neo-pulse-wp-sitemap-optimizer-cb"
							name="neo-pulse_sitemap_content_optimizer[<?php echo esc_attr( $slug ); ?>]"
							value="1"
							<?php checked( $enabled ); ?>
						/>
						<span class="neo-pulse-wp-panel-toggle__label"><?php echo esc_html( $obj->labels->name ); ?></span>
					</label>
					<p class="neo-pulse-field__note"><code><?php echo esc_html( $sitemap ); ?></code></p>
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
			var master = document.getElementById('neo-pulse_sitemap_optimizer_select_all');
			if (!master) {
				return;
			}
			var boxes = document.querySelectorAll('.neo-pulse-wp-sitemap-optimizer-cb');
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
			echo '<p>' . esc_html__( 'Unknown post type.', 'neo-pulse-wp' ) . '</p>';
			return;
		}

		$obj         = $post_types[ $slug ];
		$settings    = isset( $config['post_types'][ $slug ] ) && is_array( $config['post_types'][ $slug ] )
			? $config['post_types'][ $slug ]
			: array();
		$sitemap_url = Neo_Pulse_Wp_Sitemap_Settings::child_sitemap_url( $slug );
		$form_id     = 'neo-pulse-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="neo-pulse_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'neo_pulse_wp_sitemap_nonce' ); ?>

			<div class="neo-pulse-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'neo-pulse-wp' ); ?></strong>
				<a href="<?php echo esc_url( $sitemap_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $sitemap_url ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_sitemap_content_optimizer',
				__( 'Enable Content Optimizer', 'neo-pulse-wp' ),
				! empty( $settings['content_optimizer'] ),
				__( 'Show NEO Pulse Content Optimizer in the editor for this post type.', 'neo-pulse-wp' )
			);
			self::panel_form_toggle(
				'neo-pulse_sitemap_include_xml',
				__( 'Include in XML sitemap', 'neo-pulse-wp' ),
				! empty( $settings['include_xml'] ),
				__( 'Include this post type in the XML sitemap.', 'neo-pulse-wp' )
			);
			self::panel_form_toggle(
				'neo-pulse_sitemap_include_html',
				__( 'Include in HTML sitemap', 'neo-pulse-wp' ),
				! empty( $settings['include_html'] ),
				__( 'Include this post type in the HTML sitemap when it is enabled.', 'neo-pulse-wp' )
			);
			self::panel_form_field_textarea(
				'neo-pulse_sitemap_image_meta',
				'neo-pulse_sitemap_image_meta',
				__( 'Image custom fields', 'neo-pulse-wp' ),
				(string) ( $settings['image_meta'] ?? '' ),
				'full',
				6,
				__( 'Insert custom field (post meta) names which contain image URLs to include them in the sitemaps. Add one per line.', 'neo-pulse-wp' )
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
					'nonce_field'  => 'neo_pulse_wp_sitemap_rebuild_post_type_nonce',
					'label'        => __( 'Rebuild sitemap', 'neo-pulse-wp' ),
					'button_class' => '',
				),
			)
		);
		?>
		<?php
	}

	private static function render_sitemap_section_rebuild_all( string $tab ): void {
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Rebuild all post type sitemaps', 'neo-pulse-wp' ); ?></h2>
		<?php
		self::panel_footer_actions(
			$tab,
			'neo-pulse_sitemap_tab',
			array(
				array(
					'action'       => self::ACTION_REBUILD_SITEMAP_ALL_POST_TYPES,
					'nonce_action' => self::ACTION_REBUILD_SITEMAP_ALL_POST_TYPES,
					'nonce_field'  => 'neo_pulse_wp_sitemap_rebuild_all_post_types_nonce',
					'label'        => __( 'Rebuild all post type sitemaps', 'neo-pulse-wp' ),
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
			echo '<p>' . esc_html__( 'Unknown taxonomy.', 'neo-pulse-wp' ) . '</p>';
			return;
		}

		$settings    = isset( $config['taxonomies'][ $slug ] ) && is_array( $config['taxonomies'][ $slug ] )
			? $config['taxonomies'][ $slug ]
			: array();
		$sitemap_url = Neo_Pulse_Wp_Sitemap_Settings::child_sitemap_url( $slug );
		$form_id     = 'neo-pulse-wp-sitemap-form-' . $tab;
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SITEMAP ); ?>" />
			<input type="hidden" name="neo-pulse_sitemap_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SITEMAP, 'neo_pulse_wp_sitemap_nonce' ); ?>

			<div class="neo-pulse-wp-panel-info-box">
				<strong><?php esc_html_e( 'Sitemap URL:', 'neo-pulse-wp' ); ?></strong>
				<a href="<?php echo esc_url( $sitemap_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $sitemap_url ); ?></a>
			</div>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_sitemap_include_xml',
				__( 'Include in XML sitemap', 'neo-pulse-wp' ),
				! empty( $settings['include_xml'] )
			);
			self::panel_form_toggle(
				'neo-pulse_sitemap_include_html',
				__( 'Include in HTML sitemap', 'neo-pulse-wp' ),
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
					'nonce_field'  => 'neo_pulse_wp_sitemap_flush_nonce',
					'label'        => __( 'Flush sitemap cache', 'neo-pulse-wp' ),
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
			'neo_pulse_wp_sitemap_reset_nonce',
			'neo-pulse_sitemap_tab',
			$actions
		);
	}
}

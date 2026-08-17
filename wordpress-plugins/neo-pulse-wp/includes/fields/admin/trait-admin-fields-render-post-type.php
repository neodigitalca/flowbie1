<?php
/**
 * ACF-style post type editor screen.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Fields_Render_Post_Type {

	/**
	 * @return array<string, string>
	 */
	private static function post_type_support_choices(): array {
		// Row-major grid order so three columns match ACF (Title/Editor/Image | Author/Trackbacks/Revisions/Custom Fields | Comments/Excerpt/Page Attributes/Formats).
		return array(
			'title'           => __( 'Title', 'neo-pulse-wp' ),
			'author'          => __( 'Author', 'neo-pulse-wp' ),
			'comments'        => __( 'Comments', 'neo-pulse-wp' ),
			'editor'          => __( 'Editor', 'neo-pulse-wp' ),
			'trackbacks'      => __( 'Trackbacks', 'neo-pulse-wp' ),
			'excerpt'         => __( 'Excerpt', 'neo-pulse-wp' ),
			'thumbnail'       => __( 'Featured Image', 'neo-pulse-wp' ),
			'revisions'       => __( 'Revisions', 'neo-pulse-wp' ),
			'page-attributes' => __( 'Page Attributes', 'neo-pulse-wp' ),
			'custom-fields'   => __( 'Custom Fields', 'neo-pulse-wp' ),
			'post-formats'    => __( 'Post Formats', 'neo-pulse-wp' ),
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function default_post_type_config(): array {
		return array(
			'post_type'              => '',
			'description'            => '',
			'public'                 => true,
			'hierarchical'           => false,
			'advanced_configuration' => true,
			'taxonomies'             => array(),
			'supports'               => array( 'title', 'editor', 'thumbnail' ),
			'show_ui'                => true,
			'show_in_menu'           => true,
			'show_in_admin_bar'      => true,
			'show_in_rest'           => true,
			'has_archive'            => false,
			'rewrite'                => array(
				'slug'       => '',
				'with_front' => true,
			),
			'menu_icon'              => 'dashicons-admin-post',
			'menu_position'          => '',
			'capability_type'        => 'post',
			'map_meta_cap'           => true,
			'rest_base'              => '',
			'rest_namespace'         => 'wp/v2',
			'labels'                 => array(
				'name'          => '',
				'singular_name' => '',
				'menu_name'     => '',
			),
			'active'                 => true,
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	private static function get_post_type_config( string $slug ): ?array {
		if ( $slug === '' ) {
			return null;
		}
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_POST_TYPE ) as $item ) {
			if ( (string) ( $item['post_type'] ?? '' ) === $slug ) {
				return $item;
			}
		}
		return null;
	}

	/**
	 * @return array<int, array{slug: string, label: string}>
	 */
	private static function post_type_taxonomy_options(): array {
		$out = array();
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_TAXONOMY ) as $tax ) {
			$slug = (string) ( $tax['taxonomy'] ?? '' );
			if ( $slug === '' ) {
				continue;
			}
			$out[] = array(
				'slug'  => $slug,
				'label' => (string) ( $tax['labels']['name'] ?? $slug ),
			);
		}
		foreach ( get_taxonomies( array( 'show_ui' => true ), 'objects' ) as $tax_obj ) {
			if ( ! $tax_obj instanceof WP_Taxonomy ) {
				continue;
			}
			$found = false;
			foreach ( $out as $row ) {
				if ( $row['slug'] === $tax_obj->name ) {
					$found = true;
					break;
				}
			}
			if ( ! $found ) {
				$out[] = array(
					'slug'  => $tax_obj->name,
					'label' => $tax_obj->labels->name,
				);
			}
		}
		return $out;
	}

	public static function render_post_type_edit_page(): void {
		$slug   = isset( $_GET['post_type'] ) ? sanitize_key( wp_unslash( (string) $_GET['post_type'] ) ) : '';
		$is_new = $slug === '';
		$config = $is_new ? self::default_post_type_config() : self::get_post_type_config( $slug );
		if ( ! $is_new && ! $config ) {
			wp_die( esc_html__( 'Post type not found.', 'neo-pulse-wp' ) );
		}
		if ( ! is_array( $config ) ) {
			$config = self::default_post_type_config();
		}
		$config = wp_parse_args( $config, self::default_post_type_config() );
		$flash  = self::get_and_clear_flash();
		$slug   = (string) ( $config['post_type'] ?? '' );
		$delete_url = '';
		if ( ! $is_new && $slug !== '' ) {
			$delete_url = wp_nonce_url(
				admin_url( 'admin-post.php?action=' . self::ACTION_DELETE_POST_TYPE . '&post_type=' . rawurlencode( $slug ) ),
				self::ACTION_DELETE_POST_TYPE
			);
		}
		self::render_fields_shell_open( 'post-types', $flash );
		self::render_fields_shell_titlebar( $is_new ? __( 'Add Post Type', 'neo-pulse-wp' ) : __( 'Edit Post Type', 'neo-pulse-wp' ), null );
		if ( ! $is_new && $slug !== '' && Neo_Pulse_Wp_Fields_Post_Types::is_external_registrar( $slug ) ) {
			echo '<div class="notice notice-warning inline"><p>';
			esc_html_e( 'This post type is already registered elsewhere (for example ACF). NEO Pulse merges capability settings onto it; other registration options may still be controlled by the other plugin.', 'neo-pulse-wp' );
			echo '</p></div>';
		}
		?>
		<p class="neo-pulse-fields-acf-back"><a href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-post-types' ) ); ?>">&larr; <?php esc_html_e( 'Back to Post Types', 'neo-pulse-wp' ); ?></a></p>
		<div class="neo-pulse-fields-acf-pt-editor">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-fields-acf-pt-form" id="neo-pulse-post-type-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_POST_TYPE ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_POST_TYPE, 'neo-pulse_post_type_nonce' ); ?>
				<?php self::render_post_type_basic_card( $config, $is_new ); ?>
				<?php self::render_post_type_advanced_card( $config ); ?>
				<p class="neo-pulse-fields-acf-pt-submit">
					<button type="submit" class="button button-primary button-large"><?php esc_html_e( 'Save Changes', 'neo-pulse-wp' ); ?></button>
					<?php if ( $delete_url !== '' ) : ?>
						<a class="button button-link-delete" href="<?php echo esc_url( $delete_url ); ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this post type permanently?', 'neo-pulse-wp' ) ); ?>');"><?php esc_html_e( 'Delete Post Type', 'neo-pulse-wp' ); ?></a>
					<?php endif; ?>
				</p>
			</form>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 */
	private static function render_post_type_basic_card( array $config, bool $is_new ): void {
		$slug         = (string) ( $config['post_type'] ?? '' );
		$taxonomies   = (array) ( $config['taxonomies'] ?? array() );
		$tax_options  = self::post_type_taxonomy_options();
		$plural_label = (string) ( $config['labels']['name'] ?? '' );
		?>
		<div class="neo-pulse-fields-acf-pt-card">
			<div class="neo-pulse-fields-acf-pt-grid neo-pulse-fields-acf-pt-grid--basic">
				<div class="neo-pulse-fields-acf-field">
					<label for="neo-pulse-pt-plural-label"><?php esc_html_e( 'Plural Label', 'neo-pulse-wp' ); ?> <span class="required">*</span></label>
					<input type="text" id="neo-pulse-pt-plural-label" name="post_type_title" class="regular-text" value="<?php echo esc_attr( $plural_label ); ?>" required />
				</div>
				<div class="neo-pulse-fields-acf-field">
					<label for="neo-pulse-pt-key"><?php esc_html_e( 'Post Type Key', 'neo-pulse-wp' ); ?> <span class="required">*</span></label>
					<input type="text" id="neo-pulse-pt-key" name="post_type_slug" class="regular-text" maxlength="20" pattern="[a-z0-9_-]+" value="<?php echo esc_attr( $slug ); ?>" <?php echo $is_new ? 'required' : 'readonly'; ?> />
					<p class="description"><?php esc_html_e( 'Lower case letters, underscores and dashes only. Max 20 characters.', 'neo-pulse-wp' ); ?></p>
				</div>
				<div class="neo-pulse-fields-acf-field neo-pulse-fields-acf-field--full">
					<span class="neo-pulse-fields-acf-field__label" id="neo-pulse-pt-taxonomies-label"><?php esc_html_e( 'Taxonomies', 'neo-pulse-wp' ); ?></span>
					<?php if ( empty( $tax_options ) ) : ?>
						<p class="neo-pulse-fields-acf-checklist__empty"><?php esc_html_e( 'No taxonomies available yet. Create one under Taxonomies first.', 'neo-pulse-wp' ); ?></p>
					<?php else : ?>
						<div class="neo-pulse-fields-acf-checklist" id="neo-pulse-pt-taxonomies" role="group" aria-labelledby="neo-pulse-pt-taxonomies-label">
							<?php foreach ( $tax_options as $opt ) : ?>
								<label class="neo-pulse-fields-acf-checklist__item">
									<input type="checkbox" name="taxonomies[]" value="<?php echo esc_attr( $opt['slug'] ); ?>" <?php checked( in_array( $opt['slug'], $taxonomies, true ) ); ?> />
									<span class="neo-pulse-fields-acf-checklist__text"><?php echo esc_html( $opt['label'] ); ?></span>
									<code class="neo-pulse-fields-acf-checklist__slug"><?php echo esc_html( $opt['slug'] ); ?></code>
								</label>
							<?php endforeach; ?>
						</div>
					<?php endif; ?>
					<p class="description"><?php esc_html_e( 'Select existing taxonomies to classify items of the post type.', 'neo-pulse-wp' ); ?></p>
				</div>
			</div>
			<div class="neo-pulse-fields-acf-toggle-list">
				<?php self::render_post_type_toggle( 'public', __( 'Public', 'neo-pulse-wp' ), __( 'Visible on the frontend and in the admin dashboard.', 'neo-pulse-wp' ), ! empty( $config['public'] ) ); ?>
				<?php self::render_post_type_toggle( 'hierarchical', __( 'Hierarchical', 'neo-pulse-wp' ), __( 'Hierarchical post types can have descendants (like pages).', 'neo-pulse-wp' ), ! empty( $config['hierarchical'] ) ); ?>
				<?php self::render_post_type_toggle( 'advanced_configuration', __( 'Advanced Configuration', 'neo-pulse-wp' ), __( "I know what I'm doing, show me all the options.", 'neo-pulse-wp' ), ! empty( $config['advanced_configuration'] ) ); ?>
			</div>
		</div>
		<?php
	}

	private static function render_post_type_toggle( string $name, string $label, string $description, bool $checked ): void {
		$id = 'neo-pulse-pt-toggle-' . $name;
		?>
		<div class="neo-pulse-fields-acf-toggle">
			<label class="neo-pulse-fields-acf-toggle__control" for="<?php echo esc_attr( $id ); ?>">
				<input type="checkbox" class="neo-pulse-fields-acf-toggle__input" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( $checked ); ?> />
				<span class="neo-pulse-fields-acf-toggle__track" aria-hidden="true"></span>
			</label>
			<div class="neo-pulse-fields-acf-toggle__copy">
				<strong><?php echo esc_html( $label ); ?></strong>
				<p><?php echo esc_html( $description ); ?></p>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Post type config.
	 */
	private static function render_post_type_advanced_card( array $config ): void {
		$supports = (array) ( $config['supports'] ?? array() );
		$labels   = (array) ( $config['labels'] ?? array() );
		$rewrite  = (array) ( $config['rewrite'] ?? array() );
		$hidden   = empty( $config['advanced_configuration'] ) ? ' neo-pulse-fields-acf-pt-card--collapsed' : '';
		?>
		<div class="neo-pulse-fields-acf-pt-card neo-pulse-fields-acf-pt-card--advanced<?php echo esc_attr( $hidden ); ?>" id="neo-pulse-pt-advanced-card">
			<h2 class="neo-pulse-fields-acf-pt-card__heading">
				<span class="dashicons dashicons-admin-settings" aria-hidden="true"></span>
				<?php esc_html_e( 'Advanced Settings', 'neo-pulse-wp' ); ?>
			</h2>
			<div class="neo-pulse-fields-acf-pt-tabs" role="tablist">
				<button type="button" class="neo-pulse-fields-acf-pt-tab is-active" data-pt-tab="general"><?php esc_html_e( 'General', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-fields-acf-pt-tab" data-pt-tab="labels"><?php esc_html_e( 'Labels', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-fields-acf-pt-tab" data-pt-tab="visibility"><?php esc_html_e( 'Visibility', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-fields-acf-pt-tab" data-pt-tab="urls"><?php esc_html_e( 'URLs', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-fields-acf-pt-tab" data-pt-tab="permissions"><?php esc_html_e( 'Permissions', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-fields-acf-pt-tab" data-pt-tab="rest"><?php esc_html_e( 'REST API', 'neo-pulse-wp' ); ?></button>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel is-active" data-pt-panel="general">
				<h3><?php esc_html_e( 'Supports', 'neo-pulse-wp' ); ?></h3>
				<p class="description"><?php esc_html_e( 'Enable various features in the content editor.', 'neo-pulse-wp' ); ?></p>
				<div class="neo-pulse-fields-acf-supports-grid">
					<?php foreach ( self::post_type_support_choices() as $key => $label ) : ?>
						<label class="neo-pulse-fields-acf-supports-item">
							<input type="checkbox" name="supports[]" value="<?php echo esc_attr( $key ); ?>" <?php checked( in_array( $key, $supports, true ) ); ?> />
							<span><?php echo esc_html( $label ); ?></span>
						</label>
					<?php endforeach; ?>
				</div>
				<div class="neo-pulse-fields-acf-field neo-pulse-fields-acf-field--full">
					<label for="neo-pulse-pt-description"><?php esc_html_e( 'Description', 'neo-pulse-wp' ); ?></label>
					<textarea id="neo-pulse-pt-description" name="description" rows="3" class="large-text"><?php echo esc_textarea( (string) ( $config['description'] ?? '' ) ); ?></textarea>
				</div>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel" data-pt-panel="labels">
				<div class="neo-pulse-fields-acf-pt-grid">
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-singular"><?php esc_html_e( 'Singular Label', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-singular" name="label_singular_name" class="regular-text" value="<?php echo esc_attr( (string) ( $labels['singular_name'] ?? '' ) ); ?>" />
					</div>
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-menu-name"><?php esc_html_e( 'Menu Name', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-menu-name" name="label_menu_name" class="regular-text" value="<?php echo esc_attr( (string) ( $labels['menu_name'] ?? '' ) ); ?>" />
					</div>
				</div>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel" data-pt-panel="visibility">
				<div class="neo-pulse-fields-acf-toggle-list neo-pulse-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'show_ui', __( 'Show UI', 'neo-pulse-wp' ), __( 'Show admin UI for this post type.', 'neo-pulse-wp' ), ! empty( $config['show_ui'] ) ); ?>
					<?php self::render_post_type_toggle( 'show_in_menu', __( 'Show In Menu', 'neo-pulse-wp' ), __( 'Show in the admin menu.', 'neo-pulse-wp' ), ! empty( $config['show_in_menu'] ) ); ?>
					<?php self::render_post_type_toggle( 'show_in_admin_bar', __( 'Show In Admin Bar', 'neo-pulse-wp' ), __( 'Show the post type in the admin bar.', 'neo-pulse-wp' ), ! empty( $config['show_in_admin_bar'] ) ); ?>
					<?php self::render_post_type_toggle( 'active', __( 'Active', 'neo-pulse-wp' ), __( 'Inactive post types are stored but not registered.', 'neo-pulse-wp' ), ! isset( $config['active'] ) || ! empty( $config['active'] ) ); ?>
				</div>
				<div class="neo-pulse-fields-acf-pt-grid">
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-menu-icon"><?php esc_html_e( 'Menu Icon', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-menu-icon" name="menu_icon" class="regular-text" value="<?php echo esc_attr( (string) ( $config['menu_icon'] ?? 'dashicons-admin-post' ) ); ?>" placeholder="dashicons-admin-post" />
					</div>
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-menu-position"><?php esc_html_e( 'Menu Position', 'neo-pulse-wp' ); ?></label>
						<input type="number" id="neo-pulse-pt-menu-position" name="menu_position" class="small-text" value="<?php echo esc_attr( (string) ( $config['menu_position'] ?? '' ) ); ?>" />
					</div>
				</div>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel" data-pt-panel="urls">
				<div class="neo-pulse-fields-acf-toggle-list neo-pulse-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'has_archive', __( 'Archive', 'neo-pulse-wp' ), __( 'Has an archive page on the front end.', 'neo-pulse-wp' ), ! empty( $config['has_archive'] ) ); ?>
					<?php self::render_post_type_toggle( 'rewrite_with_front', __( 'With Front', 'neo-pulse-wp' ), __( 'Prepend the front base to rewrite URLs.', 'neo-pulse-wp' ), ! empty( $rewrite['with_front'] ) ); ?>
				</div>
				<div class="neo-pulse-fields-acf-field">
					<label for="neo-pulse-pt-rewrite-slug"><?php esc_html_e( 'URL Slug', 'neo-pulse-wp' ); ?></label>
					<input type="text" id="neo-pulse-pt-rewrite-slug" name="rewrite_slug" class="regular-text" value="<?php echo esc_attr( (string) ( $rewrite['slug'] ?? '' ) ); ?>" placeholder="<?php esc_attr_e( 'Leave blank to use post type key', 'neo-pulse-wp' ); ?>" />
				</div>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel" data-pt-panel="permissions">
				<input type="hidden" name="map_meta_cap_present" value="1" />
				<div class="neo-pulse-fields-acf-pt-grid">
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-capability-type"><?php esc_html_e( 'Capability Type', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-capability-type" name="capability_type" class="regular-text" value="<?php echo esc_attr( (string) ( $config['capability_type'] ?? 'post' ) ); ?>" />
					</div>
					<div class="neo-pulse-fields-acf-field neo-pulse-fields-acf-field--toggle-inline">
						<?php self::render_post_type_toggle( 'map_meta_cap', __( 'Map Meta Cap', 'neo-pulse-wp' ), __( 'Use meta capabilities mapping.', 'neo-pulse-wp' ), ! isset( $config['map_meta_cap'] ) || ! empty( $config['map_meta_cap'] ) ); ?>
					</div>
				</div>
			</div>
			<div class="neo-pulse-fields-acf-pt-tab-panel" data-pt-panel="rest">
				<div class="neo-pulse-fields-acf-toggle-list neo-pulse-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'show_in_rest', __( 'Show In REST API', 'neo-pulse-wp' ), __( 'Expose this post type in the REST API.', 'neo-pulse-wp' ), ! empty( $config['show_in_rest'] ) ); ?>
				</div>
				<div class="neo-pulse-fields-acf-pt-grid">
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-rest-base"><?php esc_html_e( 'REST Base', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-rest-base" name="rest_base" class="regular-text" value="<?php echo esc_attr( (string) ( $config['rest_base'] ?? '' ) ); ?>" />
					</div>
					<div class="neo-pulse-fields-acf-field">
						<label for="neo-pulse-pt-rest-namespace"><?php esc_html_e( 'REST Namespace', 'neo-pulse-wp' ); ?></label>
						<input type="text" id="neo-pulse-pt-rest-namespace" name="rest_namespace" class="regular-text" value="<?php echo esc_attr( (string) ( $config['rest_namespace'] ?? 'wp/v2' ) ); ?>" />
					</div>
				</div>
			</div>
		</div>
		<?php
	}
}

<?php
/**
 * ACF-style post type editor screen.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Fields_Render_Post_Type {

	/**
	 * @return array<string, string>
	 */
	private static function post_type_support_choices(): array {
		// Row-major grid order so three columns match ACF (Title/Editor/Image | Author/Trackbacks/Revisions/Custom Fields | Comments/Excerpt/Page Attributes/Formats).
		return array(
			'title'           => __( 'Title', 'flowbie-wp' ),
			'author'          => __( 'Author', 'flowbie-wp' ),
			'comments'        => __( 'Comments', 'flowbie-wp' ),
			'editor'          => __( 'Editor', 'flowbie-wp' ),
			'trackbacks'      => __( 'Trackbacks', 'flowbie-wp' ),
			'excerpt'         => __( 'Excerpt', 'flowbie-wp' ),
			'thumbnail'       => __( 'Featured Image', 'flowbie-wp' ),
			'revisions'       => __( 'Revisions', 'flowbie-wp' ),
			'page-attributes' => __( 'Page Attributes', 'flowbie-wp' ),
			'custom-fields'   => __( 'Custom Fields', 'flowbie-wp' ),
			'post-formats'    => __( 'Post Formats', 'flowbie-wp' ),
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
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_POST_TYPE ) as $item ) {
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
		foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY ) as $tax ) {
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
			wp_die( esc_html__( 'Post type not found.', 'flowbie-wp' ) );
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
		self::render_fields_shell_titlebar( $is_new ? __( 'Add Post Type', 'flowbie-wp' ) : __( 'Edit Post Type', 'flowbie-wp' ), null );
		if ( ! $is_new && $slug !== '' && Flowbie_Wp_Fields_Post_Types::is_external_registrar( $slug ) ) {
			echo '<div class="notice notice-warning inline"><p>';
			esc_html_e( 'This post type is already registered elsewhere (for example ACF). Flowbie merges capability settings onto it; other registration options may still be controlled by the other plugin.', 'flowbie-wp' );
			echo '</p></div>';
		}
		?>
		<p class="flowbie-fields-acf-back"><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-post-types' ) ); ?>">&larr; <?php esc_html_e( 'Back to Post Types', 'flowbie-wp' ); ?></a></p>
		<div class="flowbie-fields-acf-pt-editor">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-fields-acf-pt-form" id="flowbie-post-type-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_POST_TYPE ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_POST_TYPE, 'flowbie_post_type_nonce' ); ?>
				<?php self::render_post_type_basic_card( $config, $is_new ); ?>
				<?php self::render_post_type_advanced_card( $config ); ?>
				<p class="flowbie-fields-acf-pt-submit">
					<button type="submit" class="button button-primary button-large"><?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?></button>
					<?php if ( $delete_url !== '' ) : ?>
						<a class="button button-link-delete" href="<?php echo esc_url( $delete_url ); ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this post type permanently?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete Post Type', 'flowbie-wp' ); ?></a>
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
		<div class="flowbie-fields-acf-pt-card">
			<div class="flowbie-fields-acf-pt-grid flowbie-fields-acf-pt-grid--basic">
				<div class="flowbie-fields-acf-field">
					<label for="flowbie-pt-plural-label"><?php esc_html_e( 'Plural Label', 'flowbie-wp' ); ?> <span class="required">*</span></label>
					<input type="text" id="flowbie-pt-plural-label" name="post_type_title" class="regular-text" value="<?php echo esc_attr( $plural_label ); ?>" required />
				</div>
				<div class="flowbie-fields-acf-field">
					<label for="flowbie-pt-key"><?php esc_html_e( 'Post Type Key', 'flowbie-wp' ); ?> <span class="required">*</span></label>
					<input type="text" id="flowbie-pt-key" name="post_type_slug" class="regular-text" maxlength="20" pattern="[a-z0-9_-]+" value="<?php echo esc_attr( $slug ); ?>" <?php echo $is_new ? 'required' : 'readonly'; ?> />
					<p class="description"><?php esc_html_e( 'Lower case letters, underscores and dashes only. Max 20 characters.', 'flowbie-wp' ); ?></p>
				</div>
				<div class="flowbie-fields-acf-field flowbie-fields-acf-field--full">
					<span class="flowbie-fields-acf-field__label" id="flowbie-pt-taxonomies-label"><?php esc_html_e( 'Taxonomies', 'flowbie-wp' ); ?></span>
					<?php if ( empty( $tax_options ) ) : ?>
						<p class="flowbie-fields-acf-checklist__empty"><?php esc_html_e( 'No taxonomies available yet. Create one under Taxonomies first.', 'flowbie-wp' ); ?></p>
					<?php else : ?>
						<div class="flowbie-fields-acf-checklist" id="flowbie-pt-taxonomies" role="group" aria-labelledby="flowbie-pt-taxonomies-label">
							<?php foreach ( $tax_options as $opt ) : ?>
								<label class="flowbie-fields-acf-checklist__item">
									<input type="checkbox" name="taxonomies[]" value="<?php echo esc_attr( $opt['slug'] ); ?>" <?php checked( in_array( $opt['slug'], $taxonomies, true ) ); ?> />
									<span class="flowbie-fields-acf-checklist__text"><?php echo esc_html( $opt['label'] ); ?></span>
									<code class="flowbie-fields-acf-checklist__slug"><?php echo esc_html( $opt['slug'] ); ?></code>
								</label>
							<?php endforeach; ?>
						</div>
					<?php endif; ?>
					<p class="description"><?php esc_html_e( 'Select existing taxonomies to classify items of the post type.', 'flowbie-wp' ); ?></p>
				</div>
			</div>
			<div class="flowbie-fields-acf-toggle-list">
				<?php self::render_post_type_toggle( 'public', __( 'Public', 'flowbie-wp' ), __( 'Visible on the frontend and in the admin dashboard.', 'flowbie-wp' ), ! empty( $config['public'] ) ); ?>
				<?php self::render_post_type_toggle( 'hierarchical', __( 'Hierarchical', 'flowbie-wp' ), __( 'Hierarchical post types can have descendants (like pages).', 'flowbie-wp' ), ! empty( $config['hierarchical'] ) ); ?>
				<?php self::render_post_type_toggle( 'advanced_configuration', __( 'Advanced Configuration', 'flowbie-wp' ), __( "I know what I'm doing, show me all the options.", 'flowbie-wp' ), ! empty( $config['advanced_configuration'] ) ); ?>
			</div>
		</div>
		<?php
	}

	private static function render_post_type_toggle( string $name, string $label, string $description, bool $checked ): void {
		$id = 'flowbie-pt-toggle-' . $name;
		?>
		<div class="flowbie-fields-acf-toggle">
			<label class="flowbie-fields-acf-toggle__control" for="<?php echo esc_attr( $id ); ?>">
				<input type="checkbox" class="flowbie-fields-acf-toggle__input" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( $checked ); ?> />
				<span class="flowbie-fields-acf-toggle__track" aria-hidden="true"></span>
			</label>
			<div class="flowbie-fields-acf-toggle__copy">
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
		$hidden   = empty( $config['advanced_configuration'] ) ? ' flowbie-fields-acf-pt-card--collapsed' : '';
		?>
		<div class="flowbie-fields-acf-pt-card flowbie-fields-acf-pt-card--advanced<?php echo esc_attr( $hidden ); ?>" id="flowbie-pt-advanced-card">
			<h2 class="flowbie-fields-acf-pt-card__heading">
				<span class="dashicons dashicons-admin-settings" aria-hidden="true"></span>
				<?php esc_html_e( 'Advanced Settings', 'flowbie-wp' ); ?>
			</h2>
			<div class="flowbie-fields-acf-pt-tabs" role="tablist">
				<button type="button" class="flowbie-fields-acf-pt-tab is-active" data-pt-tab="general"><?php esc_html_e( 'General', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-fields-acf-pt-tab" data-pt-tab="labels"><?php esc_html_e( 'Labels', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-fields-acf-pt-tab" data-pt-tab="visibility"><?php esc_html_e( 'Visibility', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-fields-acf-pt-tab" data-pt-tab="urls"><?php esc_html_e( 'URLs', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-fields-acf-pt-tab" data-pt-tab="permissions"><?php esc_html_e( 'Permissions', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-fields-acf-pt-tab" data-pt-tab="rest"><?php esc_html_e( 'REST API', 'flowbie-wp' ); ?></button>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel is-active" data-pt-panel="general">
				<h3><?php esc_html_e( 'Supports', 'flowbie-wp' ); ?></h3>
				<p class="description"><?php esc_html_e( 'Enable various features in the content editor.', 'flowbie-wp' ); ?></p>
				<div class="flowbie-fields-acf-supports-grid">
					<?php foreach ( self::post_type_support_choices() as $key => $label ) : ?>
						<label class="flowbie-fields-acf-supports-item">
							<input type="checkbox" name="supports[]" value="<?php echo esc_attr( $key ); ?>" <?php checked( in_array( $key, $supports, true ) ); ?> />
							<span><?php echo esc_html( $label ); ?></span>
						</label>
					<?php endforeach; ?>
				</div>
				<div class="flowbie-fields-acf-field flowbie-fields-acf-field--full">
					<label for="flowbie-pt-description"><?php esc_html_e( 'Description', 'flowbie-wp' ); ?></label>
					<textarea id="flowbie-pt-description" name="description" rows="3" class="large-text"><?php echo esc_textarea( (string) ( $config['description'] ?? '' ) ); ?></textarea>
				</div>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel" data-pt-panel="labels">
				<div class="flowbie-fields-acf-pt-grid">
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-singular"><?php esc_html_e( 'Singular Label', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-singular" name="label_singular_name" class="regular-text" value="<?php echo esc_attr( (string) ( $labels['singular_name'] ?? '' ) ); ?>" />
					</div>
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-menu-name"><?php esc_html_e( 'Menu Name', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-menu-name" name="label_menu_name" class="regular-text" value="<?php echo esc_attr( (string) ( $labels['menu_name'] ?? '' ) ); ?>" />
					</div>
				</div>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel" data-pt-panel="visibility">
				<div class="flowbie-fields-acf-toggle-list flowbie-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'show_ui', __( 'Show UI', 'flowbie-wp' ), __( 'Show admin UI for this post type.', 'flowbie-wp' ), ! empty( $config['show_ui'] ) ); ?>
					<?php self::render_post_type_toggle( 'show_in_menu', __( 'Show In Menu', 'flowbie-wp' ), __( 'Show in the admin menu.', 'flowbie-wp' ), ! empty( $config['show_in_menu'] ) ); ?>
					<?php self::render_post_type_toggle( 'show_in_admin_bar', __( 'Show In Admin Bar', 'flowbie-wp' ), __( 'Show the post type in the admin bar.', 'flowbie-wp' ), ! empty( $config['show_in_admin_bar'] ) ); ?>
					<?php self::render_post_type_toggle( 'active', __( 'Active', 'flowbie-wp' ), __( 'Inactive post types are stored but not registered.', 'flowbie-wp' ), ! isset( $config['active'] ) || ! empty( $config['active'] ) ); ?>
				</div>
				<div class="flowbie-fields-acf-pt-grid">
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-menu-icon"><?php esc_html_e( 'Menu Icon', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-menu-icon" name="menu_icon" class="regular-text" value="<?php echo esc_attr( (string) ( $config['menu_icon'] ?? 'dashicons-admin-post' ) ); ?>" placeholder="dashicons-admin-post" />
					</div>
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-menu-position"><?php esc_html_e( 'Menu Position', 'flowbie-wp' ); ?></label>
						<input type="number" id="flowbie-pt-menu-position" name="menu_position" class="small-text" value="<?php echo esc_attr( (string) ( $config['menu_position'] ?? '' ) ); ?>" />
					</div>
				</div>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel" data-pt-panel="urls">
				<div class="flowbie-fields-acf-toggle-list flowbie-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'has_archive', __( 'Archive', 'flowbie-wp' ), __( 'Has an archive page on the front end.', 'flowbie-wp' ), ! empty( $config['has_archive'] ) ); ?>
					<?php self::render_post_type_toggle( 'rewrite_with_front', __( 'With Front', 'flowbie-wp' ), __( 'Prepend the front base to rewrite URLs.', 'flowbie-wp' ), ! empty( $rewrite['with_front'] ) ); ?>
				</div>
				<div class="flowbie-fields-acf-field">
					<label for="flowbie-pt-rewrite-slug"><?php esc_html_e( 'URL Slug', 'flowbie-wp' ); ?></label>
					<input type="text" id="flowbie-pt-rewrite-slug" name="rewrite_slug" class="regular-text" value="<?php echo esc_attr( (string) ( $rewrite['slug'] ?? '' ) ); ?>" placeholder="<?php esc_attr_e( 'Leave blank to use post type key', 'flowbie-wp' ); ?>" />
				</div>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel" data-pt-panel="permissions">
				<input type="hidden" name="map_meta_cap_present" value="1" />
				<div class="flowbie-fields-acf-pt-grid">
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-capability-type"><?php esc_html_e( 'Capability Type', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-capability-type" name="capability_type" class="regular-text" value="<?php echo esc_attr( (string) ( $config['capability_type'] ?? 'post' ) ); ?>" />
					</div>
					<div class="flowbie-fields-acf-field flowbie-fields-acf-field--toggle-inline">
						<?php self::render_post_type_toggle( 'map_meta_cap', __( 'Map Meta Cap', 'flowbie-wp' ), __( 'Use meta capabilities mapping.', 'flowbie-wp' ), ! isset( $config['map_meta_cap'] ) || ! empty( $config['map_meta_cap'] ) ); ?>
					</div>
				</div>
			</div>
			<div class="flowbie-fields-acf-pt-tab-panel" data-pt-panel="rest">
				<div class="flowbie-fields-acf-toggle-list flowbie-fields-acf-toggle-list--compact">
					<?php self::render_post_type_toggle( 'show_in_rest', __( 'Show In REST API', 'flowbie-wp' ), __( 'Expose this post type in the REST API.', 'flowbie-wp' ), ! empty( $config['show_in_rest'] ) ); ?>
				</div>
				<div class="flowbie-fields-acf-pt-grid">
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-rest-base"><?php esc_html_e( 'REST Base', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-rest-base" name="rest_base" class="regular-text" value="<?php echo esc_attr( (string) ( $config['rest_base'] ?? '' ) ); ?>" />
					</div>
					<div class="flowbie-fields-acf-field">
						<label for="flowbie-pt-rest-namespace"><?php esc_html_e( 'REST Namespace', 'flowbie-wp' ); ?></label>
						<input type="text" id="flowbie-pt-rest-namespace" name="rest_namespace" class="regular-text" value="<?php echo esc_attr( (string) ( $config['rest_namespace'] ?? 'wp/v2' ) ); ?>" />
					</div>
				</div>
			</div>
		</div>
		<?php
	}
}

<?php
/**
 * Field admin screens (ACF-style UI).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Fields_Render {

	public static function render_fields_list_page(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/admin/class-flowbie-wp-fields-list-table.php';
		$status = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( (string) $_GET['status'] ) ) : 'all';
		if ( ! in_array( $status, array( 'all', 'active', 'inactive' ), true ) ) {
			$status = 'all';
		}
		$table = new Flowbie_Wp_Fields_List_Table();
		$table->set_status_filter( $status );
		$table->prepare_items();
		$flash = self::get_and_clear_flash();
		$acf   = self::acf_database_import_status();
		self::render_fields_shell_open( 'field-groups', $flash );
		self::render_fields_shell_titlebar( __( 'Field Groups', 'flowbie-wp' ), admin_url( 'admin.php?page=flowbie-wp-fields-edit' ) );

		if ( ! empty( $acf['available'] ) ) : ?>
			<div class="notice notice-info flowbie-fields-acf-import" style="margin:12px 0;">
				<p>
					<?php
					if ( (int) $acf['pending_count'] > 0 ) {
						echo esc_html(
							sprintf(
								/* translators: %d: ACF field group count not yet imported */
								_n(
									'Advanced Custom Fields has %d field group ready to import (structure and values).',
									'Advanced Custom Fields has %d field groups ready to import (structure and values).',
									(int) $acf['pending_count'],
									'flowbie-wp'
								),
								(int) $acf['pending_count']
							)
						);
					} else {
						esc_html_e( 'Advanced Custom Fields is installed. Click below to import all field groups, post types, taxonomies, and post values in one click.', 'flowbie-wp' );
					}
					?>
				</p>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:8px;">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_FIELDS_ACF_DB ); ?>" />
					<?php wp_nonce_field( self::ACTION_IMPORT_FIELDS_ACF_DB, 'flowbie_fields_import_acf_db_nonce' ); ?>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Import from ACF', 'flowbie-wp' ); ?></button>
				</form>
			</div>
		<?php endif;

		self::render_fields_shell_list_toolbar( $table, 'flowbie-wp-fields', __( 'Search Field Groups', 'flowbie-wp' ) );
		?>
		<div class="flowbie-fields-acf-table-wrap">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-fields' ) ); ?>">
				<input type="hidden" name="page" value="flowbie-wp-fields" />
				<?php wp_nonce_field( self::ACTION_BULK_FIELD_GROUPS, 'flowbie_fields_bulk_nonce' ); ?>
				<?php $table->display(); ?>
			</form>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	public static function render_field_group_edit_page(): void {
		$key   = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['key'] ) ) : '';
		$group = $key !== '' ? Flowbie_Wp_Fields_Storage::get_group_by_key( $key ) : null;
		if ( ! $group ) {
			$group = array(
				'key'      => 'group_' . uniqid(),
				'title'    => '',
				'fields'   => array(),
				'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ) ) ),
				'active'   => true,
				'position' => 'normal',
				'style'    => 'default',
			);
		}
		$flash = self::get_and_clear_flash();
		self::render_field_group_editor( $group, $flash );
	}

	/**
	 * @param array<string, mixed>      $group Field group.
	 * @param array<string, mixed>|null $flash Flash message.
	 */
	private static function render_field_group_editor( array $group, ?array $flash ): void {
		$fields   = isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array();
		$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array( array() );
		$types    = Flowbie_Wp_Fields_Registry::choices();
		self::render_fields_shell_open( 'field-groups', $flash );
		self::render_fields_shell_titlebar( __( 'Edit Field Group', 'flowbie-wp' ), null );
		?>
		<p class="flowbie-fields-acf-back"><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-fields' ) ); ?>">&larr; <?php esc_html_e( 'Back to Field Groups', 'flowbie-wp' ); ?></a></p>
		<div class="flowbie-fields-admin flowbie-fields-edit flowbie-fields-acf-editor">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="flowbie-field-group-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_FIELD_GROUP ); ?>" />
				<input type="hidden" name="group_key" value="<?php echo esc_attr( (string) ( $group['key'] ?? '' ) ); ?>" />
				<input type="hidden" name="field_group_json" id="field_group_json" value="" />
				<?php wp_nonce_field( self::ACTION_SAVE_FIELD_GROUP, 'flowbie_fields_save_group_nonce' ); ?>
				<div class="flowbie-fields-edit__header">
					<input type="text" name="group_title" class="flowbie-fields-edit__title" value="<?php echo esc_attr( (string) ( $group['title'] ?? '' ) ); ?>" placeholder="<?php esc_attr_e( 'Field Group Title', 'flowbie-wp' ); ?>" required />
					<button type="button" class="button" id="flowbie-add-field"><?php esc_html_e( 'Add Field', 'flowbie-wp' ); ?></button>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?></button>
				</div>
				<div class="flowbie-fields-panel flowbie-fields-frame--panel">
					<h2><?php esc_html_e( 'Fields', 'flowbie-wp' ); ?></h2>
					<table class="widefat flowbie-fields-table" id="flowbie-fields-table">
						<thead><tr>
							<th>#</th><th><?php esc_html_e( 'Label', 'flowbie-wp' ); ?></th><th><?php esc_html_e( 'Name', 'flowbie-wp' ); ?></th><th><?php esc_html_e( 'Type', 'flowbie-wp' ); ?></th><th></th>
						</tr></thead>
						<tbody id="flowbie-fields-rows">
						<?php foreach ( $fields as $i => $field ) : ?>
							<?php self::render_field_builder_row( (int) $i, is_array( $field ) ? $field : array(), $types ); ?>
						<?php endforeach; ?>
						</tbody>
					</table>
				</div>
				<div class="flowbie-fields-panel flowbie-fields-frame--panel flowbie-fields-frame--settings">
					<h2><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></h2>
					<div class="flowbie-fields-tabs">
						<button type="button" class="flowbie-tab active" data-tab="location"><?php esc_html_e( 'Location Rules', 'flowbie-wp' ); ?></button>
						<button type="button" class="flowbie-tab" data-tab="presentation"><?php esc_html_e( 'Presentation', 'flowbie-wp' ); ?></button>
						<button type="button" class="flowbie-tab" data-tab="group"><?php esc_html_e( 'Group Settings', 'flowbie-wp' ); ?></button>
					</div>
					<div class="flowbie-tab-panel active" data-panel="location">
						<p><?php esc_html_e( 'Show this field group if', 'flowbie-wp' ); ?></p>
						<div id="flowbie-location-rules">
							<?php foreach ( $location as $gi => $rule_group ) : ?>
								<?php self::render_location_rule_group( (int) $gi, is_array( $rule_group ) ? $rule_group : array() ); ?>
							<?php endforeach; ?>
						</div>
						<button type="button" class="button" id="flowbie-add-rule-group"><?php esc_html_e( 'Add rule group', 'flowbie-wp' ); ?></button>
					</div>
					<div class="flowbie-tab-panel" data-panel="presentation">
						<p><label><?php esc_html_e( 'Position', 'flowbie-wp' ); ?>
							<select name="position">
								<?php foreach ( array( 'normal', 'side', 'acf_after_title' ) as $pos ) : ?>
									<option value="<?php echo esc_attr( $pos ); ?>" <?php selected( (string) ( $group['position'] ?? 'normal' ), $pos ); ?>><?php echo esc_html( $pos ); ?></option>
								<?php endforeach; ?>
							</select></label></p>
						<p><label><?php esc_html_e( 'Style', 'flowbie-wp' ); ?>
							<select name="style">
								<option value="default" <?php selected( (string) ( $group['style'] ?? 'default' ), 'default' ); ?>>default</option>
								<option value="seamless" <?php selected( (string) ( $group['style'] ?? '' ), 'seamless' ); ?>>seamless</option>
							</select></label></p>
						<p><label><?php esc_html_e( 'Label placement', 'flowbie-wp' ); ?>
							<select name="label_placement">
								<option value="top" <?php selected( (string) ( $group['label_placement'] ?? 'top' ), 'top' ); ?>>top</option>
								<option value="left" <?php selected( (string) ( $group['label_placement'] ?? '' ), 'left' ); ?>>left</option>
							</select></label></p>
					</div>
					<div class="flowbie-tab-panel" data-panel="group">
						<p><label><?php esc_html_e( 'Description', 'flowbie-wp' ); ?><br />
							<textarea name="group_description" rows="3" class="large-text"><?php echo esc_textarea( (string) ( $group['description'] ?? '' ) ); ?></textarea></label></p>
						<p><label><input type="checkbox" name="active" value="1" <?php checked( ! empty( $group['active'] ) ); ?> /> <?php esc_html_e( 'Active', 'flowbie-wp' ); ?></label></p>
						<p><label><input type="checkbox" name="show_in_rest" value="1" <?php checked( ! empty( $group['show_in_rest'] ) ); ?> /> <?php esc_html_e( 'Show in REST API', 'flowbie-wp' ); ?></label></p>
						<p><label><?php esc_html_e( 'Order', 'flowbie-wp' ); ?> <input type="number" name="menu_order" value="<?php echo esc_attr( (string) (int) ( $group['menu_order'] ?? 0 ) ); ?>" /></label></p>
					</div>
				</div>
			</form>
			<?php if ( ! empty( $group['key'] ) ) : ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:1rem" onsubmit="return confirm('<?php echo esc_js( __( 'Delete this field group?', 'flowbie-wp' ) ); ?>');">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_DELETE_FIELD_GROUP ); ?>" />
					<input type="hidden" name="key" value="<?php echo esc_attr( (string) $group['key'] ); ?>" />
					<?php wp_nonce_field( self::ACTION_DELETE_FIELD_GROUP, 'flowbie_fields_delete_nonce' ); ?>
					<button type="submit" class="button button-link-delete"><?php esc_html_e( 'Delete field group', 'flowbie-wp' ); ?></button>
				</form>
			<?php endif; ?>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	/**
	 * @param array<string, mixed> $field Field row.
	 * @param array<string,string> $types Field type choices.
	 */
	private static function render_field_builder_row( int $index, array $field, array $types ): void {
		$key = (string) ( $field['key'] ?? 'field_' . uniqid() );
		?>
		<tr class="flowbie-field-row" data-index="<?php echo esc_attr( (string) $index ); ?>">
			<td class="flowbie-sort-handle">☰</td>
			<td><input type="text" name="fields[<?php echo esc_attr( (string) $index ); ?>][label]" value="<?php echo esc_attr( (string) ( $field['label'] ?? '' ) ); ?>" /></td>
			<td><input type="text" name="fields[<?php echo esc_attr( (string) $index ); ?>][name]" value="<?php echo esc_attr( (string) ( $field['name'] ?? '' ) ); ?>" /></td>
			<td><select name="fields[<?php echo esc_attr( (string) $index ); ?>][type]">
				<?php foreach ( $types as $type => $label ) : ?>
					<option value="<?php echo esc_attr( $type ); ?>" <?php selected( (string) ( $field['type'] ?? 'text' ), $type ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select></td>
			<td>
				<input type="hidden" name="fields[<?php echo esc_attr( (string) $index ); ?>][key]" value="<?php echo esc_attr( $key ); ?>" />
				<button type="button" class="button-link flowbie-remove-field">&times;</button>
			</td>
		</tr>
		<?php
	}

	/**
	 * @param array<int, array<string, mixed>> $rule_group Rules.
	 */
	private static function render_location_rule_group( int $group_index, array $rule_group ): void {
		if ( empty( $rule_group ) ) {
			$rule_group = array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ) );
		}
		echo '<div class="flowbie-location-group" data-group="' . esc_attr( (string) $group_index ) . '">';
		foreach ( $rule_group as $ri => $rule ) {
			self::render_location_rule( $group_index, (int) $ri, is_array( $rule ) ? $rule : array() );
		}
		echo '<button type="button" class="button flowbie-add-rule" data-group="' . esc_attr( (string) $group_index ) . '">' . esc_html__( 'and', 'flowbie-wp' ) . '</button>';
		echo '</div>';
	}

	/**
	 * @param array<string, mixed> $rule Rule.
	 */
	private static function render_location_rule( int $group_index, int $rule_index, array $rule ): void {
		$param    = (string) ( $rule['param'] ?? 'post_type' );
		$operator = (string) ( $rule['operator'] ?? '==' );
		$value    = (string) ( $rule['value'] ?? '' );
		$values   = Flowbie_Wp_Fields_Location::value_choices( $param );
		?>
		<div class="flowbie-location-rule">
			<select name="location[<?php echo esc_attr( (string) $group_index ); ?>][<?php echo esc_attr( (string) $rule_index ); ?>][param]" class="flowbie-location-param">
				<?php foreach ( Flowbie_Wp_Fields_Location::param_choices() as $p => $label ) : ?>
					<option value="<?php echo esc_attr( $p ); ?>" <?php selected( $param, $p ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
			<select name="location[<?php echo esc_attr( (string) $group_index ); ?>][<?php echo esc_attr( (string) $rule_index ); ?>][operator]">
				<?php foreach ( Flowbie_Wp_Fields_Location::operator_choices() as $op => $label ) : ?>
					<option value="<?php echo esc_attr( $op ); ?>" <?php selected( $operator, $op ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
			<?php if ( ! empty( $values ) ) : ?>
				<select name="location[<?php echo esc_attr( (string) $group_index ); ?>][<?php echo esc_attr( (string) $rule_index ); ?>][value]">
					<?php foreach ( $values as $v => $label ) : ?>
						<option value="<?php echo esc_attr( (string) $v ); ?>" <?php selected( $value, (string) $v ); ?>><?php echo esc_html( (string) $label ); ?></option>
					<?php endforeach; ?>
				</select>
			<?php else : ?>
				<input type="text" name="location[<?php echo esc_attr( (string) $group_index ); ?>][<?php echo esc_attr( (string) $rule_index ); ?>][value]" value="<?php echo esc_attr( $value ); ?>" />
			<?php endif; ?>
		</div>
		<?php
	}

	public static function render_fields_tools_page(): void {
		$flash = self::get_and_clear_flash();
		$acf   = self::acf_database_import_status();
		self::render_fields_shell_open( 'tools', $flash );
		self::render_fields_shell_titlebar( __( 'Tools', 'flowbie-wp' ), null );
		?>
		<div class="flowbie-wp-redirects__panels flowbie-fields-acf-tools">
				<?php if ( ! empty( $acf['available'] ) ) : ?>
				<div class="flowbie-wp-redirects__panel">
					<h2><?php esc_html_e( 'Import from ACF', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Import field groups, custom post types, taxonomies, options pages, and their stored values (Contact Information, post meta, etc.) from ACF or ACF Pro in one click. Keep ACF active during import so values can be read.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_FIELDS_ACF_DB ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_FIELDS_ACF_DB, 'flowbie_fields_import_acf_db_nonce' ); ?>
						<p><button type="submit" class="button button-primary"><?php esc_html_e( 'Import from ACF', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>
				<?php endif; ?>
				<div class="flowbie-wp-redirects__panel">
					<h2><?php esc_html_e( 'Import', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Upload an ACF-compatible JSON export. Field groups, post types, taxonomies, and options pages are detected and imported automatically. Existing items are updated by key.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_FIELDS ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_FIELDS, 'flowbie_fields_import_nonce' ); ?>
						<p><input type="file" name="fields_json" accept=".json,application/json" required /></p>
						<p><label><input type="checkbox" name="delete_missing" value="1" /> <?php esc_html_e( 'Delete field groups not present in file', 'flowbie-wp' ); ?></label></p>
						<p><button type="submit" class="button button-primary"><?php esc_html_e( 'Import JSON', 'flowbie-wp' ); ?></button></p>
					</form>
					<hr />
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_STARTER ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_STARTER, 'flowbie_fields_starter_nonce' ); ?>
						<p><?php esc_html_e( 'Import bundled Flowbie starter field groups (Page, Post/SAP, Our Work).', 'flowbie-wp' ); ?></p>
						<button type="submit" class="button"><?php esc_html_e( 'Import starter config', 'flowbie-wp' ); ?></button>
					</form>
				</div>
				<div class="flowbie-wp-redirects__panel">
					<h2><?php esc_html_e( 'Export', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Download field groups, post types, taxonomies, and options pages as a single ACF-compatible JSON file.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_FIELDS ); ?>" />
						<?php wp_nonce_field( self::ACTION_EXPORT_FIELDS, 'flowbie_fields_export_nonce' ); ?>
						<fieldset style="margin-bottom:1em">
							<p><label><input type="checkbox" name="include_groups" value="1" checked /> <?php esc_html_e( 'Field Groups', 'flowbie-wp' ); ?></label></p>
							<p><label><input type="checkbox" name="include_post_types" value="1" checked /> <?php esc_html_e( 'Post Types', 'flowbie-wp' ); ?></label></p>
							<p><label><input type="checkbox" name="include_taxonomies" value="1" checked /> <?php esc_html_e( 'Taxonomies', 'flowbie-wp' ); ?></label></p>
							<p><label><input type="checkbox" name="include_options_pages" value="1" checked /> <?php esc_html_e( 'Options Pages', 'flowbie-wp' ); ?></label></p>
						</fieldset>
						<button type="submit" class="button button-secondary"><?php esc_html_e( 'Export All', 'flowbie-wp' ); ?></button>
					</form>
				</div>
			</div>
		<?php
		self::render_fields_shell_close();
	}

	public static function render_fields_gallery_page(): void {
		$flash = self::get_and_clear_flash();
		self::render_fields_shell_open( 'gallery', $flash );
		self::render_fields_shell_titlebar( __( 'Gallery', 'flowbie-wp' ), null );
		?>
		<?php
		$bulk_form_id   = 'flowbie-fields-acf-gallery-bulk';
		$bulk_confirm   = __( 'Remove selected templates from Flowbie Fields? This does not delete your site content.', 'flowbie-wp' );
		$templates      = Flowbie_Wp_Fields_Gallery_Templates::all();
		$template_count = count( $templates );
		?>
		<div class="flowbie-fields-acf-gallery">
			<form
				id="<?php echo esc_attr( $bulk_form_id ); ?>"
				method="post"
				action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"
				class="flowbie-fields-acf-gallery__bulk-form"
				data-confirm="<?php echo esc_attr( $bulk_confirm ); ?>"
				data-empty-notice="<?php echo esc_attr( __( 'Select at least one template.', 'flowbie-wp' ) ); ?>"
			>
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_BULK_DELETE_GALLERY_TEMPLATES ); ?>" />
				<?php wp_nonce_field( Flowbie_Wp_Fields_Gallery_Templates::bulk_delete_nonce_action() ); ?>
				<div class="flowbie-fields-acf-gallery__toolbar">
					<label class="flowbie-fields-acf-gallery__select-all">
						<input type="checkbox" class="flowbie-fields-acf-gallery__select-all-input" <?php disabled( $template_count < 1 ); ?> />
						<?php esc_html_e( 'Select all', 'flowbie-wp' ); ?>
					</label>
					<button type="submit" class="button flowbie-fields-acf-gallery__bulk-delete" <?php disabled( $template_count < 1 ); ?>>
						<?php esc_html_e( 'Delete', 'flowbie-wp' ); ?>
					</button>
				</div>
			</form>
			<div class="flowbie-fields-acf-table-wrap flowbie-fields-acf-gallery__list" role="list">
			<?php foreach ( $templates as $template_id => $template ) : ?>
				<?php $counts = Flowbie_Wp_Fields_Gallery_Templates::counts_for( $template_id ); ?>
				<div class="flowbie-fields-acf-gallery__row" role="listitem">
					<label class="flowbie-fields-acf-gallery__row-check">
						<input
							type="checkbox"
							form="<?php echo esc_attr( $bulk_form_id ); ?>"
							name="template_ids[]"
							value="<?php echo esc_attr( $template_id ); ?>"
							class="flowbie-fields-acf-gallery__template-input"
						/>
						<span class="screen-reader-text"><?php echo esc_html( sprintf( __( 'Select %s', 'flowbie-wp' ), (string) $template['title'] ) ); ?></span>
					</label>
					<div class="flowbie-fields-acf-gallery__row-main">
						<strong class="flowbie-fields-acf-gallery__row-title"><?php echo esc_html( (string) $template['title'] ); ?></strong>
						<p class="flowbie-fields-acf-gallery__row-desc"><?php echo esc_html( (string) $template['description'] ); ?></p>
						<?php if ( is_array( $counts ) ) : ?>
							<ul class="flowbie-fields-acf-gallery__stats">
								<li><?php echo esc_html( sprintf( __( '%d field groups', 'flowbie-wp' ), (int) $counts['groups'] ) ); ?></li>
								<li><?php echo esc_html( sprintf( __( '%d post types', 'flowbie-wp' ), (int) $counts['post_types'] ) ); ?></li>
								<li><?php echo esc_html( sprintf( __( '%d taxonomies', 'flowbie-wp' ), (int) $counts['taxonomies'] ) ); ?></li>
								<?php if ( (int) $counts['options_pages'] > 0 ) : ?>
									<li><?php echo esc_html( sprintf( __( '%d options page(s)', 'flowbie-wp' ), (int) $counts['options_pages'] ) ); ?></li>
								<?php endif; ?>
							</ul>
						<?php endif; ?>
					</div>
					<div class="flowbie-fields-acf-gallery__row-actions">
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-fields-acf-gallery__import-form">
							<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_GALLERY_TEMPLATE ); ?>" />
							<input type="hidden" name="template_id" value="<?php echo esc_attr( $template_id ); ?>" />
							<?php wp_nonce_field( Flowbie_Wp_Fields_Gallery_Templates::nonce_action( $template_id, 'import' ) ); ?>
							<button type="submit" class="button button-primary"><?php esc_html_e( 'Import', 'flowbie-wp' ); ?></button>
						</form>
					</div>
				</div>
			<?php endforeach; ?>
			</div>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	public static function render_post_types_page(): void {
		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : '';
		if ( $action === 'new' ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-post-types-edit' ) );
			exit;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/admin/class-flowbie-wp-fields-post-types-list-table.php';
		$status = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( (string) $_GET['status'] ) ) : 'all';
		if ( ! in_array( $status, array( 'all', 'active', 'inactive' ), true ) ) {
			$status = 'all';
		}
		$table = new Flowbie_Wp_Fields_Post_Types_List_Table();
		$table->set_status_filter( $status );
		$table->prepare_items();
		$flash = self::get_and_clear_flash();
		self::render_fields_shell_open( 'post-types', $flash );
		self::render_fields_shell_titlebar( __( 'Post Types', 'flowbie-wp' ), admin_url( 'admin.php?page=flowbie-wp-post-types-edit' ) );
		self::render_fields_shell_list_toolbar( $table, 'flowbie-wp-post-types', __( 'Search Post Types', 'flowbie-wp' ) );
		?>
		<div class="flowbie-fields-acf-table-wrap">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-post-types' ) ); ?>">
				<input type="hidden" name="page" value="flowbie-wp-post-types" />
				<?php wp_nonce_field( self::ACTION_BULK_POST_TYPES, 'flowbie_fields_bulk_nonce' ); ?>
				<?php $table->display(); ?>
			</form>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	public static function render_taxonomies_page(): void {
		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : '';
		$flash  = self::get_and_clear_flash();
		if ( $action === 'new' ) {
			self::render_taxonomy_form( $flash, null );
			return;
		}
		if ( $action === 'edit' ) {
			$slug = isset( $_GET['taxonomy'] ) ? sanitize_key( wp_unslash( (string) $_GET['taxonomy'] ) ) : '';
			self::render_taxonomy_form( $flash, $slug !== '' ? $slug : null );
			return;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/admin/class-flowbie-wp-fields-taxonomies-list-table.php';
		$table = new Flowbie_Wp_Fields_Taxonomies_List_Table();
		$table->prepare_items();
		self::render_fields_shell_open( 'taxonomies', $flash );
		self::render_fields_shell_titlebar( __( 'Taxonomies', 'flowbie-wp' ), admin_url( 'admin.php?page=flowbie-wp-taxonomies&action=new' ) );
		?>
		<div class="flowbie-fields-acf-toolbar flowbie-fields-acf-toolbar--search-only">
			<form method="get" class="search-form flowbie-fields-acf-search">
				<input type="hidden" name="page" value="flowbie-wp-taxonomies" />
				<?php $table->search_box( __( 'Search Taxonomies', 'flowbie-wp' ), 'flowbie-fields-search' ); ?>
			</form>
		</div>
		<div class="flowbie-fields-acf-table-wrap">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-taxonomies' ) ); ?>">
				<input type="hidden" name="page" value="flowbie-wp-taxonomies" />
				<?php wp_nonce_field( self::ACTION_BULK_TAXONOMIES, 'flowbie_fields_bulk_nonce' ); ?>
				<?php $table->display(); ?>
			</form>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	/**
	 * @param array<string, mixed>|null $flash Flash message.
	 */
	private static function render_taxonomy_form( ?array $flash, ?string $slug ): void {
		$config = null;
		if ( $slug !== null && $slug !== '' ) {
			foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_TAXONOMY ) as $item ) {
				if ( (string) ( $item['taxonomy'] ?? '' ) === $slug ) {
					$config = $item;
					break;
				}
			}
			if ( ! $config ) {
				wp_die( esc_html__( 'Taxonomy not found.', 'flowbie-wp' ) );
			}
		}
		$is_new       = $config === null;
		$taxonomy     = $is_new ? '' : (string) ( $config['taxonomy'] ?? '' );
		$label        = $is_new ? '' : (string) ( $config['labels']['name'] ?? '' );
		$object_types = $is_new ? array( 'post' ) : (array) ( $config['object_type'] ?? array( 'post' ) );
		$post_type    = (string) ( $object_types[0] ?? 'post' );
		$sitemap_url  = '';
		if ( ! $is_new && $taxonomy !== '' && class_exists( 'Flowbie_Wp_Sitemap_Settings' ) ) {
			$sitemap_cfg = Flowbie_Wp_Sitemap_Settings::get_config();
			if ( ! empty( $sitemap_cfg['general']['enabled'] ) ) {
				$tax_settings = (array) ( $sitemap_cfg['taxonomies'][ $taxonomy ] ?? array() );
				if ( ! isset( $tax_settings['include_xml'] ) || ! empty( $tax_settings['include_xml'] ) ) {
					$sitemap_url = Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $taxonomy );
				}
			}
		}
		$delete_url = '';
		if ( ! $is_new && $taxonomy !== '' ) {
			$delete_url = wp_nonce_url(
				admin_url( 'admin-post.php?action=' . self::ACTION_DELETE_TAXONOMY . '&taxonomy=' . rawurlencode( $taxonomy ) ),
				self::ACTION_DELETE_TAXONOMY
			);
		}
		self::render_fields_shell_open( 'taxonomies', $flash );
		self::render_fields_shell_titlebar( $is_new ? __( 'Add Taxonomy', 'flowbie-wp' ) : __( 'Edit Taxonomy', 'flowbie-wp' ), null );
		?>
		<p class="flowbie-fields-acf-back"><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-taxonomies' ) ); ?>">&larr; <?php esc_html_e( 'Back to Taxonomies', 'flowbie-wp' ); ?></a></p>
		<div class="flowbie-fields-frame flowbie-fields-frame--form">
			<div class="flowbie-fields-frame__body">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-fields-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_TAXONOMY ); ?>" />
					<?php wp_nonce_field( self::ACTION_SAVE_TAXONOMY, 'flowbie_taxonomy_nonce' ); ?>
					<p class="flowbie-fields-field">
						<label for="flowbie-taxonomy-slug"><?php esc_html_e( 'Slug', 'flowbie-wp' ); ?></label>
						<input id="flowbie-taxonomy-slug" name="taxonomy_slug" class="regular-text" value="<?php echo esc_attr( $taxonomy ); ?>" <?php echo $is_new ? 'required' : 'readonly'; ?> />
					</p>
					<p class="flowbie-fields-field">
						<label for="flowbie-taxonomy-label"><?php esc_html_e( 'Label', 'flowbie-wp' ); ?></label>
						<input id="flowbie-taxonomy-label" name="taxonomy_title" class="regular-text" value="<?php echo esc_attr( $label ); ?>" required />
					</p>
					<p class="flowbie-fields-field">
						<label for="flowbie-taxonomy-post-type"><?php esc_html_e( 'Post type', 'flowbie-wp' ); ?></label>
						<input id="flowbie-taxonomy-post-type" name="taxonomy_post_type" class="regular-text" value="<?php echo esc_attr( $post_type ); ?>" />
					</p>
					<?php if ( $sitemap_url !== '' ) : ?>
						<p class="flowbie-fields-field flowbie-fields-acf-row-sitemap">
							<strong><?php esc_html_e( 'Sitemap', 'flowbie-wp' ); ?></strong><br />
							<a href="<?php echo esc_url( $sitemap_url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $sitemap_url ); ?></a>
						</p>
					<?php endif; ?>
					<p class="flowbie-fields-actions">
						<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Taxonomy', 'flowbie-wp' ); ?></button>
						<?php if ( $delete_url !== '' ) : ?>
							<a class="button button-link-delete" href="<?php echo esc_url( $delete_url ); ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this taxonomy definition permanently?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete Taxonomy', 'flowbie-wp' ); ?></a>
						<?php endif; ?>
					</p>
				</form>
			</div>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	public static function render_options_pages_page(): void {
		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : '';
		$flash  = self::get_and_clear_flash();
		if ( $action === 'new' ) {
			self::render_options_page_form( $flash, null );
			return;
		}
		if ( $action === 'edit' ) {
			$slug = isset( $_GET['menu_slug'] ) ? sanitize_key( wp_unslash( (string) $_GET['menu_slug'] ) ) : '';
			self::render_options_page_form( $flash, $slug !== '' ? $slug : null );
			return;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/admin/class-flowbie-wp-fields-options-list-table.php';
		$table = new Flowbie_Wp_Fields_Options_List_Table();
		$table->prepare_items();
		self::render_fields_shell_open( 'options-pages', $flash );
		self::render_fields_shell_titlebar( __( 'Options Pages', 'flowbie-wp' ), admin_url( 'admin.php?page=flowbie-wp-options-pages&action=new' ) );
		?>
		<div class="flowbie-fields-acf-toolbar flowbie-fields-acf-toolbar--search-only">
			<form method="get" class="search-form flowbie-fields-acf-search">
				<input type="hidden" name="page" value="flowbie-wp-options-pages" />
				<?php $table->search_box( __( 'Search Options Pages', 'flowbie-wp' ), 'flowbie-fields-search' ); ?>
			</form>
		</div>
		<div class="flowbie-fields-acf-table-wrap">
			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-options-pages' ) ); ?>">
				<input type="hidden" name="page" value="flowbie-wp-options-pages" />
				<?php wp_nonce_field( self::ACTION_BULK_OPTIONS_PAGES, 'flowbie_fields_bulk_nonce' ); ?>
				<?php $table->display(); ?>
			</form>
		</div>
		<?php
		self::render_fields_shell_close();
	}

	/**
	 * @param array<string, mixed>|null $flash Flash message.
	 */
	private static function render_options_page_form( ?array $flash, ?string $menu_slug ): void {
		$config = null;
		if ( $menu_slug !== null && $menu_slug !== '' ) {
			foreach ( Flowbie_Wp_Fields_Storage::get_entities( Flowbie_Wp_Fields_Storage::CPT_OPTIONS ) as $item ) {
				if ( (string) ( $item['menu_slug'] ?? '' ) === $menu_slug ) {
					$config = $item;
					break;
				}
			}
			if ( ! $config ) {
				wp_die( esc_html__( 'Options page not found.', 'flowbie-wp' ) );
			}
		}
		$is_new     = $config === null;
		$slug       = $is_new ? '' : (string) ( $config['menu_slug'] ?? '' );
		$page_title = $is_new ? '' : (string) ( $config['page_title'] ?? '' );
		$menu_title = $is_new ? '' : (string) ( $config['menu_title'] ?? '' );
		$parent     = $is_new ? '' : (string) ( $config['parent_slug'] ?? '' );
		$delete_url = '';
		if ( ! $is_new && $slug !== '' ) {
			$delete_url = wp_nonce_url(
				admin_url( 'admin-post.php?action=' . self::ACTION_DELETE_OPTIONS_PAGE . '&menu_slug=' . rawurlencode( $slug ) ),
				self::ACTION_DELETE_OPTIONS_PAGE
			);
		}
		self::render_fields_shell_open( 'options-pages', $flash );
		self::render_fields_shell_titlebar( $is_new ? __( 'Add Options Page', 'flowbie-wp' ) : __( 'Edit Options Page', 'flowbie-wp' ), null );
		?>
		<p class="flowbie-fields-acf-back"><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-options-pages' ) ); ?>">&larr; <?php esc_html_e( 'Back to Options Pages', 'flowbie-wp' ); ?></a></p>
		<div class="flowbie-fields-frame flowbie-fields-frame--form">
			<div class="flowbie-fields-frame__body">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-fields-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_OPTIONS_PAGE ); ?>" />
					<?php wp_nonce_field( self::ACTION_SAVE_OPTIONS_PAGE, 'flowbie_options_page_nonce' ); ?>
					<p class="flowbie-fields-field">
						<label for="flowbie-options-menu-slug"><?php esc_html_e( 'Menu slug', 'flowbie-wp' ); ?></label>
						<input id="flowbie-options-menu-slug" name="menu_slug" class="regular-text" value="<?php echo esc_attr( $slug ); ?>" <?php echo $is_new ? 'required' : 'readonly'; ?> />
					</p>
					<p class="flowbie-fields-field">
						<label for="flowbie-options-page-title"><?php esc_html_e( 'Page title', 'flowbie-wp' ); ?></label>
						<input id="flowbie-options-page-title" name="page_title" class="regular-text" value="<?php echo esc_attr( $page_title ); ?>" required />
					</p>
					<p class="flowbie-fields-field">
						<label for="flowbie-options-menu-title"><?php esc_html_e( 'Menu title', 'flowbie-wp' ); ?></label>
						<input id="flowbie-options-menu-title" name="menu_title" class="regular-text" value="<?php echo esc_attr( $menu_title ); ?>" />
					</p>
					<p class="flowbie-fields-field">
						<label for="flowbie-options-parent-slug"><?php esc_html_e( 'Parent slug (optional)', 'flowbie-wp' ); ?></label>
						<input id="flowbie-options-parent-slug" name="parent_slug" class="regular-text" value="<?php echo esc_attr( $parent ); ?>" />
					</p>
					<p class="flowbie-fields-actions">
						<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Options Page', 'flowbie-wp' ); ?></button>
						<?php if ( $delete_url !== '' ) : ?>
							<a class="button button-link-delete" href="<?php echo esc_url( $delete_url ); ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this options page permanently?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete Options Page', 'flowbie-wp' ); ?></a>
						<?php endif; ?>
					</p>
				</form>
			</div>
		</div>
		<?php
		self::render_fields_shell_close();
	}
}

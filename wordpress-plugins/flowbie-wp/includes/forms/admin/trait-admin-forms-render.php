<?php
/**
 * Forms admin screens.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Forms_Render {

	public static function render_forms_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage forms.', 'flowbie-wp' ) );
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/admin/class-flowbie-wp-forms-list-table.php';
		Flowbie_Wp_Forms_Storage::register_post_types();
		Flowbie_Wp_Forms_Entries::maybe_install();
		$list_table = new Flowbie_Wp_Forms_List_Table();
		$list_table->prepare_items();
		$counts   = $list_table->get_status_counts();
		$status   = isset( $_GET['form_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['form_status'] ) ) : 'all';
		$base_url = admin_url( 'admin.php?page=flowbie-wp-forms' );
		self::flowbie_group_shell_open( 'flowbie-wp-forms', 'flowbie-wp-forms' );
		?>
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Forms', 'flowbie-wp' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms-edit' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add New', 'flowbie-wp' ); ?></a>
			<hr class="wp-header-end" />

			<p class="description">
				<?php esc_html_e( 'Build contact and lead forms stored on this WordPress site only. Entries are saved in your local database—not Supabase or Flowbie cloud. Use the Elementor widget (Widgets → Flowbie → Flowbie Form) or the shortcode on any page.', 'flowbie-wp' ); ?>
			</p>

			<ul class="subsubsub">
				<?php
				$views = array(
					'all'      => __( 'All', 'flowbie-wp' ),
					'active'   => __( 'Active', 'flowbie-wp' ),
					'inactive' => __( 'Inactive', 'flowbie-wp' ),
					'trash'    => __( 'Trash', 'flowbie-wp' ),
				);
				$parts = array();
				foreach ( $views as $key => $label ) {
					$url   = add_query_arg( 'form_status', $key, $base_url );
					$count = $counts[ $key ] ?? 0;
					$text  = $label . ' (' . $count . ')';
					$cur   = ( $status === $key ) || ( $key === 'all' && ( $status === '' || $status === 'all' ) );
					$parts[] = $cur
						? '<li><a class="current" href="' . esc_url( $url ) . '">' . esc_html( $text ) . '</a></li>'
						: '<li><a href="' . esc_url( $url ) . '">' . esc_html( $text ) . '</a></li>';
				}
				echo implode( ' | ', $parts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
			</ul>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( Flowbie_Wp_Admin::ACTION_BULK_FORMS ); ?>" />
				<?php wp_nonce_field( Flowbie_Wp_Admin::ACTION_BULK_FORMS, 'flowbie_forms_bulk_nonce' ); ?>
				<?php $list_table->display(); ?>
			</form>
		<?php
		self::flowbie_group_shell_close();
	}

	public static function render_forms_edit_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage forms.', 'flowbie-wp' ) );
		}

		Flowbie_Wp_Forms_Storage::register_post_types();
		Flowbie_Wp_Forms_Entries::maybe_install();

		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		$form    = $form_id > 0 ? Flowbie_Wp_Forms_Storage::get_form_by_id( $form_id ) : null;
		if ( ! $form ) {
			$form = array(
				'ID'       => 0,
				'key'      => 'form_' . uniqid(),
				'title'    => '',
				'active'   => true,
				'status'   => 'draft',
				'settings' => Flowbie_Wp_Forms_Field_Registry::default_settings(),
				'fields'   => array(
					Flowbie_Wp_Forms_Field_Registry::default_field( 'text' ),
					Flowbie_Wp_Forms_Field_Registry::default_field( 'email' ),
				),
			);
		}

		$form_json   = wp_json_encode( $form, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		$field_groups = Flowbie_Wp_Forms_Field_Registry::choices_grouped();
		self::flowbie_group_shell_open( 'flowbie-wp-forms-edit', 'flowbie-wp-forms flowbie-wp-forms-edit' );
		?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="flowbie-form-builder">
				<input type="hidden" name="action" value="<?php echo esc_attr( Flowbie_Wp_Admin::ACTION_SAVE_FORM ); ?>" />
				<input type="hidden" name="form_id" value="<?php echo esc_attr( (string) $form_id ); ?>" />
				<input type="hidden" name="form_json" id="flowbie-form-json" value="" />
				<?php wp_nonce_field( Flowbie_Wp_Admin::ACTION_SAVE_FORM, 'flowbie_forms_save_nonce' ); ?>

				<div class="flowbie-wp-forms-builder__topbar">
					<div class="flowbie-wp-forms-builder__topbar-left">
						<a class="flowbie-wp-forms-builder__back" href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms' ) ); ?>">&larr;</a>
						<input type="text" id="flowbie-form-title" class="flowbie-wp-forms-builder__title-input" value="<?php echo esc_attr( (string) ( $form['title'] ?? '' ) ); ?>" placeholder="<?php esc_attr_e( 'Form title', 'flowbie-wp' ); ?>" required />
						<label class="flowbie-wp-forms-builder__active">
							<input type="checkbox" id="flowbie-form-active" <?php checked( ! empty( $form['active'] ) ); ?> />
							<?php esc_html_e( 'Active', 'flowbie-wp' ); ?>
						</label>
					</div>
					<div class="flowbie-wp-forms-builder__topbar-right">
						<?php if ( $form_id > 0 ) : ?>
							<code class="flowbie-wp-forms-builder__shortcode">[flowbie_form id="<?php echo esc_attr( (string) $form_id ); ?>"]</code>
							<span class="description" style="margin-left:8px;"><?php esc_html_e( 'Or drag Flowbie Form from Elementor → Widgets → Flowbie.', 'flowbie-wp' ); ?></span>
							<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms-entries&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Entries', 'flowbie-wp' ); ?></a>
						<?php endif; ?>
						<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Form', 'flowbie-wp' ); ?></button>
					</div>
				</div>

				<div class="flowbie-wp-forms-builder__layout">
					<div class="flowbie-wp-panel flowbie-wp-forms-builder__canvas">
						<h2 class="screen-reader-text"><?php esc_html_e( 'Form fields', 'flowbie-wp' ); ?></h2>
						<div id="flowbie-form-fields-list" class="flowbie-wp-forms-fields-list"></div>
						<p class="flowbie-wp-forms-fields-list__empty" id="flowbie-form-fields-empty"><?php esc_html_e( 'Drag fields here or click a field type from the sidebar.', 'flowbie-wp' ); ?></p>
					</div>

					<aside class="flowbie-wp-panel flowbie-wp-forms-builder__sidebar">
						<div class="flowbie-wp-forms-builder__tabs" role="tablist">
							<button type="button" class="flowbie-wp-forms-builder__tab is-active" data-tab="add-fields" role="tab"><?php esc_html_e( 'Add Fields', 'flowbie-wp' ); ?></button>
							<button type="button" class="flowbie-wp-forms-builder__tab" data-tab="field-settings" role="tab"><?php esc_html_e( 'Field Settings', 'flowbie-wp' ); ?></button>
							<button type="button" class="flowbie-wp-forms-builder__tab" data-tab="form-settings" role="tab"><?php esc_html_e( 'Form Settings', 'flowbie-wp' ); ?></button>
						</div>

						<div class="flowbie-wp-forms-builder__tab-panel is-active" data-panel="add-fields" role="tabpanel">
							<input type="search" id="flowbie-field-palette-search" class="flowbie-wp-forms-builder__search" placeholder="<?php esc_attr_e( 'Search fields…', 'flowbie-wp' ); ?>" />
							<?php foreach ( $field_groups as $group_key => $types ) : ?>
								<h3 class="flowbie-wp-forms-builder__palette-heading">
									<?php echo esc_html( $group_key === 'advanced' ? __( 'Advanced Fields', 'flowbie-wp' ) : __( 'Standard Fields', 'flowbie-wp' ) ); ?>
								</h3>
								<ul class="flowbie-wp-forms-builder__palette">
									<?php foreach ( $types as $slug => $label ) : ?>
										<li>
											<button type="button" class="flowbie-field-palette-item" data-type="<?php echo esc_attr( $slug ); ?>">
												<span class="flowbie-field-palette-item__label"><?php echo esc_html( $label ); ?></span>
											</button>
										</li>
									<?php endforeach; ?>
								</ul>
							<?php endforeach; ?>
						</div>

						<div class="flowbie-wp-forms-builder__tab-panel" data-panel="field-settings" role="tabpanel">
							<div id="flowbie-field-settings-panel" class="flowbie-wp-forms-builder__field-settings">
								<p class="description"><?php esc_html_e( 'Select a field on the canvas to edit its settings.', 'flowbie-wp' ); ?></p>
							</div>
						</div>

						<div class="flowbie-wp-forms-builder__tab-panel" data-panel="form-settings" role="tabpanel">
							<table class="form-table flowbie-wp-forms-builder__settings-table">
								<tr>
									<th><label for="flowbie-form-description"><?php esc_html_e( 'Description', 'flowbie-wp' ); ?></label></th>
									<td><textarea id="flowbie-form-description" class="large-text" rows="2"><?php echo esc_textarea( (string) ( $form['settings']['description'] ?? '' ) ); ?></textarea></td>
								</tr>
								<tr>
									<th><label for="flowbie-form-submit-label"><?php esc_html_e( 'Submit button', 'flowbie-wp' ); ?></label></th>
									<td><input type="text" id="flowbie-form-submit-label" class="regular-text" value="<?php echo esc_attr( (string) ( $form['settings']['submit_button_label'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="flowbie-form-success"><?php esc_html_e( 'Success message', 'flowbie-wp' ); ?></label></th>
									<td><input type="text" id="flowbie-form-success" class="large-text" value="<?php echo esc_attr( (string) ( $form['settings']['success_message'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="flowbie-form-redirect"><?php esc_html_e( 'Redirect URL', 'flowbie-wp' ); ?></label></th>
									<td><input type="url" id="flowbie-form-redirect" class="large-text" value="<?php echo esc_attr( (string) ( $form['settings']['redirect_url'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="flowbie-form-emails"><?php esc_html_e( 'Notification emails', 'flowbie-wp' ); ?></label></th>
									<td>
										<input type="text" id="flowbie-form-emails" class="large-text" value="<?php echo esc_attr( implode( ', ', (array) ( $form['settings']['notification_emails'] ?? array() ) ) ); ?>" />
										<p class="description"><?php esc_html_e( 'Comma-separated.', 'flowbie-wp' ); ?></p>
									</td>
								</tr>
								<tr>
									<th><?php esc_html_e( 'Spam protection', 'flowbie-wp' ); ?></th>
									<td>
										<label><input type="checkbox" id="flowbie-form-honeypot" <?php checked( ! empty( $form['settings']['honeypot_enabled'] ) ); ?> /> <?php esc_html_e( 'Honeypot field', 'flowbie-wp' ); ?></label><br />
										<label><input type="checkbox" id="flowbie-form-store-ip" <?php checked( ! isset( $form['settings']['store_ip'] ) || ! empty( $form['settings']['store_ip'] ) ); ?> /> <?php esc_html_e( 'Store IP address', 'flowbie-wp' ); ?></label><br />
										<label><input type="checkbox" id="flowbie-form-require-login" <?php checked( ! empty( $form['settings']['require_login'] ) ); ?> /> <?php esc_html_e( 'Require login', 'flowbie-wp' ); ?></label>
									</td>
								</tr>
							</table>
						</div>
					</aside>
				</div>
			</form>

			<script type="application/json" id="flowbie-form-initial-data"><?php echo $form_json; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></script>
		<?php
		self::flowbie_group_shell_close();
	}

	public static function render_forms_entries_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to view entries.', 'flowbie-wp' ) );
		}

		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		if ( $form_id < 1 ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-forms' ) );
			exit;
		}

		$form = Flowbie_Wp_Forms_Storage::get_form_by_id( $form_id );
		if ( ! $form ) {
			wp_die( esc_html__( 'Form not found.', 'flowbie-wp' ) );
		}

		$entry_id = isset( $_GET['entry_id'] ) ? (int) $_GET['entry_id'] : 0;
		if ( $entry_id > 0 ) {
			self::render_single_entry( $form, $entry_id );
			return;
		}

		$fields     = isset( $form['fields'] ) && is_array( $form['fields'] ) ? $form['fields'] : array();
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/forms/admin/class-flowbie-wp-forms-entries-list-table.php';
		Flowbie_Wp_Forms_Entries::maybe_install();
		$list_table = new Flowbie_Wp_Forms_Entries_List_Table( $form_id, $fields );
		$list_table->prepare_items();
		$export_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=' . Flowbie_Wp_Admin::ACTION_EXPORT_ENTRIES . '&form_id=' . $form_id ),
			Flowbie_Wp_Admin::ACTION_EXPORT_ENTRIES,
			'flowbie_forms_export_nonce'
		);
		self::flowbie_group_shell_open( 'flowbie-wp-forms-entries', 'flowbie-wp-forms' );
		?>
			<h1>
				<?php
				printf(
					/* translators: %s: form title */
					esc_html__( 'Entries: %s', 'flowbie-wp' ),
					esc_html( (string) ( $form['title'] ?? '' ) )
				);
				?>
			</h1>
			<p>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms-edit&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Edit form', 'flowbie-wp' ); ?></a>
				&nbsp;|&nbsp;
				<a href="<?php echo esc_url( $export_url ); ?>"><?php esc_html_e( 'Export CSV', 'flowbie-wp' ); ?></a>
			</p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( Flowbie_Wp_Admin::ACTION_BULK_ENTRIES ); ?>" />
				<input type="hidden" name="form_id" value="<?php echo esc_attr( (string) $form_id ); ?>" />
				<?php wp_nonce_field( Flowbie_Wp_Admin::ACTION_BULK_ENTRIES, 'flowbie_forms_entries_bulk_nonce' ); ?>
				<?php $list_table->display(); ?>
			</form>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $form Form.
	 */
	private static function render_single_entry( array $form, int $entry_id ): void {
		$entry = Flowbie_Wp_Forms_Entries::get_entry( $entry_id );
		if ( ! $entry || (int) ( $entry['form_id'] ?? 0 ) !== (int) ( $form['ID'] ?? 0 ) ) {
			wp_die( esc_html__( 'Entry not found.', 'flowbie-wp' ) );
		}
		$form_id = (int) $form['ID'];
		self::flowbie_group_shell_open( 'flowbie-wp-forms-entries', 'flowbie-wp-forms' );
		?>
			<h1><?php printf( esc_html__( 'Entry #%d', 'flowbie-wp' ), (int) $entry['id'] ); ?></h1>
			<p>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms-entries&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Back to entries', 'flowbie-wp' ); ?></a>
			</p>
			<table class="widefat striped">
				<tbody>
					<tr><th><?php esc_html_e( 'Date', 'flowbie-wp' ); ?></th><td><?php echo esc_html( (string) ( $entry['created_at'] ?? '' ) ); ?></td></tr>
					<tr><th><?php esc_html_e( 'Status', 'flowbie-wp' ); ?></th><td><?php echo esc_html( (string) ( $entry['status'] ?? '' ) ); ?></td></tr>
					<?php if ( ! empty( $entry['ip_address'] ) ) : ?>
						<tr><th><?php esc_html_e( 'IP', 'flowbie-wp' ); ?></th><td><?php echo esc_html( (string) $entry['ip_address'] ); ?></td></tr>
					<?php endif; ?>
					<?php if ( ! empty( $entry['source_url'] ) ) : ?>
						<tr><th><?php esc_html_e( 'Source URL', 'flowbie-wp' ); ?></th><td><a href="<?php echo esc_url( (string) $entry['source_url'] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( (string) $entry['source_url'] ); ?></a></td></tr>
					<?php endif; ?>
					<?php
					$meta = isset( $entry['meta'] ) && is_array( $entry['meta'] ) ? $entry['meta'] : array();
					$fields = isset( $form['fields'] ) && is_array( $form['fields'] ) ? $form['fields'] : array();
					foreach ( $fields as $field ) {
						if ( ! is_array( $field ) || empty( $field['name'] ) ) {
							continue;
						}
						$name  = (string) $field['name'];
						$label = (string) ( $field['label'] ?? $name );
						$value = $meta[ $name ] ?? '';
						if ( is_array( $value ) ) {
							$parts = array();
							foreach ( $value as $sub_key => $sub_val ) {
								if ( (string) $sub_val !== '' ) {
									$parts[] = $sub_key . ': ' . $sub_val;
								}
							}
							$value = implode( '; ', $parts );
						}
						if ( is_numeric( $value ) && (string) (int) $value === (string) $value ) {
							$url = wp_get_attachment_url( (int) $value );
							if ( $url ) {
								$value = '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html__( 'Download file', 'flowbie-wp' ) . '</a>';
							} else {
								$value = esc_html( (string) $value );
							}
						} else {
							$value = esc_html( (string) $value );
						}
						echo '<tr><th>' . esc_html( $label ) . '</th><td>' . $value . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					}
					?>
				</tbody>
			</table>
		<?php
		self::flowbie_group_shell_close();
	}
}

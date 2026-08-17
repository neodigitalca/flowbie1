<?php
/**
 * Forms admin screens.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Forms_Render {

	public static function render_forms_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage forms.', 'neo-pulse-wp' ) );
		}
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/admin/class-neo-pulse-wp-forms-list-table.php';
		Neo_Pulse_Wp_Forms_Storage::register_post_types();
		Neo_Pulse_Wp_Forms_Entries::maybe_install();
		$list_table = new Neo_Pulse_Wp_Forms_List_Table();
		$list_table->prepare_items();
		$counts   = $list_table->get_status_counts();
		$status   = isset( $_GET['form_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['form_status'] ) ) : 'all';
		$base_url = admin_url( 'admin.php?page=neo-pulse-wp-forms' );
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-forms', 'neo-pulse-wp-forms' );
		?>
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Forms', 'neo-pulse-wp' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-forms-edit' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add New', 'neo-pulse-wp' ); ?></a>
			<hr class="wp-header-end" />

			<p class="description">
				<?php esc_html_e( 'Build contact and lead forms stored on this WordPress site only. Entries are saved in your local database, not NEO Pulse cloud. Use the Elementor widget (Widgets → NEO Pulse → NEO Pulse Form) or the shortcode on any page.', 'neo-pulse-wp' ); ?>
			</p>

			<ul class="subsubsub">
				<?php
				$views = array(
					'all'      => __( 'All', 'neo-pulse-wp' ),
					'active'   => __( 'Active', 'neo-pulse-wp' ),
					'inactive' => __( 'Inactive', 'neo-pulse-wp' ),
					'trash'    => __( 'Trash', 'neo-pulse-wp' ),
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
				<input type="hidden" name="action" value="<?php echo esc_attr( Neo_Pulse_Wp_Admin::ACTION_BULK_FORMS ); ?>" />
				<?php wp_nonce_field( Neo_Pulse_Wp_Admin::ACTION_BULK_FORMS, 'neo-pulse_forms_bulk_nonce' ); ?>
				<?php $list_table->display(); ?>
			</form>
		<?php
		self::neo_pulse_group_shell_close();
	}

	public static function render_forms_edit_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage forms.', 'neo-pulse-wp' ) );
		}

		Neo_Pulse_Wp_Forms_Storage::register_post_types();
		Neo_Pulse_Wp_Forms_Entries::maybe_install();

		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		$form    = $form_id > 0 ? Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id ) : null;
		if ( ! $form ) {
			$form = array(
				'ID'       => 0,
				'key'      => 'form_' . uniqid(),
				'title'    => '',
				'active'   => true,
				'status'   => 'draft',
				'settings' => Neo_Pulse_Wp_Forms_Field_Registry::default_settings(),
				'fields'   => array(
					Neo_Pulse_Wp_Forms_Field_Registry::default_field( 'text' ),
					Neo_Pulse_Wp_Forms_Field_Registry::default_field( 'email' ),
				),
			);
		}

		$form_json   = wp_json_encode( $form, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		$field_groups = Neo_Pulse_Wp_Forms_Field_Registry::choices_grouped();
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-forms-edit', 'neo-pulse-wp-forms neo-pulse-wp-forms-edit' );
		?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="neo-pulse-form-builder">
				<input type="hidden" name="action" value="<?php echo esc_attr( Neo_Pulse_Wp_Admin::ACTION_SAVE_FORM ); ?>" />
				<input type="hidden" name="form_id" value="<?php echo esc_attr( (string) $form_id ); ?>" />
				<input type="hidden" name="form_json" id="neo-pulse-form-json" value="" />
				<?php wp_nonce_field( Neo_Pulse_Wp_Admin::ACTION_SAVE_FORM, 'neo-pulse_forms_save_nonce' ); ?>

				<div class="neo-pulse-wp-forms-builder__topbar">
					<div class="neo-pulse-wp-forms-builder__topbar-left">
						<a class="neo-pulse-wp-forms-builder__back" href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-forms' ) ); ?>">&larr;</a>
						<input type="text" id="neo-pulse-form-title" class="neo-pulse-wp-forms-builder__title-input" value="<?php echo esc_attr( (string) ( $form['title'] ?? '' ) ); ?>" placeholder="<?php esc_attr_e( 'Form title', 'neo-pulse-wp' ); ?>" required />
						<label class="neo-pulse-wp-forms-builder__active">
							<input type="checkbox" id="neo-pulse-form-active" <?php checked( ! empty( $form['active'] ) ); ?> />
							<?php esc_html_e( 'Active', 'neo-pulse-wp' ); ?>
						</label>
					</div>
					<div class="neo-pulse-wp-forms-builder__topbar-right">
						<?php if ( $form_id > 0 ) : ?>
							<code class="neo-pulse-wp-forms-builder__shortcode">[neo-pulse_form id="<?php echo esc_attr( (string) $form_id ); ?>"]</code>
							<span class="description" style="margin-left:8px;"><?php esc_html_e( 'Or drag NEO Pulse Form from Elementor → Widgets → NEO Pulse.', 'neo-pulse-wp' ); ?></span>
							<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Entries', 'neo-pulse-wp' ); ?></a>
						<?php endif; ?>
						<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Form', 'neo-pulse-wp' ); ?></button>
					</div>
				</div>

				<div class="neo-pulse-wp-forms-builder__layout">
					<div class="neo-pulse-wp-panel neo-pulse-wp-forms-builder__canvas">
						<h2 class="screen-reader-text"><?php esc_html_e( 'Form fields', 'neo-pulse-wp' ); ?></h2>
						<div id="neo-pulse-form-fields-list" class="neo-pulse-wp-forms-fields-list"></div>
						<p class="neo-pulse-wp-forms-fields-list__empty" id="neo-pulse-form-fields-empty"><?php esc_html_e( 'Drag fields here or click a field type from the sidebar.', 'neo-pulse-wp' ); ?></p>
					</div>

					<aside class="neo-pulse-wp-panel neo-pulse-wp-forms-builder__sidebar">
						<div class="neo-pulse-wp-forms-builder__tabs" role="tablist">
							<button type="button" class="neo-pulse-wp-forms-builder__tab is-active" data-tab="add-fields" role="tab"><?php esc_html_e( 'Add Fields', 'neo-pulse-wp' ); ?></button>
							<button type="button" class="neo-pulse-wp-forms-builder__tab" data-tab="field-settings" role="tab"><?php esc_html_e( 'Field Settings', 'neo-pulse-wp' ); ?></button>
							<button type="button" class="neo-pulse-wp-forms-builder__tab" data-tab="form-settings" role="tab"><?php esc_html_e( 'Form Settings', 'neo-pulse-wp' ); ?></button>
						</div>

						<div class="neo-pulse-wp-forms-builder__tab-panel is-active" data-panel="add-fields" role="tabpanel">
							<input type="search" id="neo-pulse-field-palette-search" class="neo-pulse-wp-forms-builder__search" placeholder="<?php esc_attr_e( 'Search fields…', 'neo-pulse-wp' ); ?>" />
							<?php foreach ( $field_groups as $group_key => $types ) : ?>
								<h3 class="neo-pulse-wp-forms-builder__palette-heading">
									<?php echo esc_html( $group_key === 'advanced' ? __( 'Advanced Fields', 'neo-pulse-wp' ) : __( 'Standard Fields', 'neo-pulse-wp' ) ); ?>
								</h3>
								<ul class="neo-pulse-wp-forms-builder__palette">
									<?php foreach ( $types as $slug => $label ) : ?>
										<li>
											<button type="button" class="neo-pulse-field-palette-item" data-type="<?php echo esc_attr( $slug ); ?>">
												<span class="neo-pulse-field-palette-item__label"><?php echo esc_html( $label ); ?></span>
											</button>
										</li>
									<?php endforeach; ?>
								</ul>
							<?php endforeach; ?>
						</div>

						<div class="neo-pulse-wp-forms-builder__tab-panel" data-panel="field-settings" role="tabpanel">
							<div id="neo-pulse-field-settings-panel" class="neo-pulse-wp-forms-builder__field-settings">
								<p class="description"><?php esc_html_e( 'Select a field on the canvas to edit its settings.', 'neo-pulse-wp' ); ?></p>
							</div>
						</div>

						<div class="neo-pulse-wp-forms-builder__tab-panel" data-panel="form-settings" role="tabpanel">
							<table class="form-table neo-pulse-wp-forms-builder__settings-table">
								<tr>
									<th><label for="neo-pulse-form-description"><?php esc_html_e( 'Description', 'neo-pulse-wp' ); ?></label></th>
									<td><textarea id="neo-pulse-form-description" class="large-text" rows="2"><?php echo esc_textarea( (string) ( $form['settings']['description'] ?? '' ) ); ?></textarea></td>
								</tr>
								<tr>
									<th><label for="neo-pulse-form-submit-label"><?php esc_html_e( 'Submit button', 'neo-pulse-wp' ); ?></label></th>
									<td><input type="text" id="neo-pulse-form-submit-label" class="regular-text" value="<?php echo esc_attr( (string) ( $form['settings']['submit_button_label'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="neo-pulse-form-success"><?php esc_html_e( 'Success message', 'neo-pulse-wp' ); ?></label></th>
									<td><input type="text" id="neo-pulse-form-success" class="large-text" value="<?php echo esc_attr( (string) ( $form['settings']['success_message'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="neo-pulse-form-redirect"><?php esc_html_e( 'Redirect URL', 'neo-pulse-wp' ); ?></label></th>
									<td><input type="url" id="neo-pulse-form-redirect" class="large-text" value="<?php echo esc_attr( (string) ( $form['settings']['redirect_url'] ?? '' ) ); ?>" /></td>
								</tr>
								<tr>
									<th><label for="neo-pulse-form-emails"><?php esc_html_e( 'Notification emails', 'neo-pulse-wp' ); ?></label></th>
									<td>
										<input type="text" id="neo-pulse-form-emails" class="large-text" value="<?php echo esc_attr( implode( ', ', (array) ( $form['settings']['notification_emails'] ?? array() ) ) ); ?>" />
										<p class="description"><?php esc_html_e( 'Comma-separated.', 'neo-pulse-wp' ); ?></p>
									</td>
								</tr>
								<tr>
									<th><?php esc_html_e( 'Spam protection', 'neo-pulse-wp' ); ?></th>
									<td>
										<label><input type="checkbox" id="neo-pulse-form-honeypot" <?php checked( ! empty( $form['settings']['honeypot_enabled'] ) ); ?> /> <?php esc_html_e( 'Honeypot field', 'neo-pulse-wp' ); ?></label><br />
										<label><input type="checkbox" id="neo-pulse-form-store-ip" <?php checked( ! isset( $form['settings']['store_ip'] ) || ! empty( $form['settings']['store_ip'] ) ); ?> /> <?php esc_html_e( 'Store IP address', 'neo-pulse-wp' ); ?></label><br />
										<label><input type="checkbox" id="neo-pulse-form-require-login" <?php checked( ! empty( $form['settings']['require_login'] ) ); ?> /> <?php esc_html_e( 'Require login', 'neo-pulse-wp' ); ?></label>
									</td>
								</tr>
							</table>
						</div>
					</aside>
				</div>
			</form>

			<script type="application/json" id="neo-pulse-form-initial-data"><?php echo $form_json; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></script>
		<?php
		self::neo_pulse_group_shell_close();
	}

	public static function render_forms_entries_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to view entries.', 'neo-pulse-wp' ) );
		}

		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		if ( $form_id < 1 ) {
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms' ) );
			exit;
		}

		$form = Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id );
		if ( ! $form ) {
			wp_die( esc_html__( 'Form not found.', 'neo-pulse-wp' ) );
		}

		$entry_id = isset( $_GET['entry_id'] ) ? (int) $_GET['entry_id'] : 0;
		if ( $entry_id > 0 ) {
			self::render_single_entry( $form, $entry_id );
			return;
		}

		$fields     = isset( $form['fields'] ) && is_array( $form['fields'] ) ? $form['fields'] : array();
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/forms/admin/class-neo-pulse-wp-forms-entries-list-table.php';
		Neo_Pulse_Wp_Forms_Entries::maybe_install();
		$list_table = new Neo_Pulse_Wp_Forms_Entries_List_Table( $form_id, $fields );
		$list_table->prepare_items();
		$export_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=' . Neo_Pulse_Wp_Admin::ACTION_EXPORT_ENTRIES . '&form_id=' . $form_id ),
			Neo_Pulse_Wp_Admin::ACTION_EXPORT_ENTRIES,
			'neo-pulse_forms_export_nonce'
		);
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-forms-entries', 'neo-pulse-wp-forms' );
		?>
			<h1>
				<?php
				printf(
					/* translators: %s: form title */
					esc_html__( 'Entries: %s', 'neo-pulse-wp' ),
					esc_html( (string) ( $form['title'] ?? '' ) )
				);
				?>
			</h1>
			<p>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-forms-edit&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Edit form', 'neo-pulse-wp' ); ?></a>
				&nbsp;|&nbsp;
				<a href="<?php echo esc_url( $export_url ); ?>"><?php esc_html_e( 'Export CSV', 'neo-pulse-wp' ); ?></a>
			</p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( Neo_Pulse_Wp_Admin::ACTION_BULK_ENTRIES ); ?>" />
				<input type="hidden" name="form_id" value="<?php echo esc_attr( (string) $form_id ); ?>" />
				<?php wp_nonce_field( Neo_Pulse_Wp_Admin::ACTION_BULK_ENTRIES, 'neo-pulse_forms_entries_bulk_nonce' ); ?>
				<?php $list_table->display(); ?>
			</form>
		<?php
		self::neo_pulse_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $form Form.
	 */
	private static function render_single_entry( array $form, int $entry_id ): void {
		$entry = Neo_Pulse_Wp_Forms_Entries::get_entry( $entry_id );
		if ( ! $entry || (int) ( $entry['form_id'] ?? 0 ) !== (int) ( $form['ID'] ?? 0 ) ) {
			wp_die( esc_html__( 'Entry not found.', 'neo-pulse-wp' ) );
		}
		$form_id = (int) $form['ID'];
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-forms-entries', 'neo-pulse-wp-forms' );
		?>
			<h1><?php printf( esc_html__( 'Entry #%d', 'neo-pulse-wp' ), (int) $entry['id'] ); ?></h1>
			<p>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $form_id ) ); ?>"><?php esc_html_e( 'Back to entries', 'neo-pulse-wp' ); ?></a>
			</p>
			<table class="widefat striped">
				<tbody>
					<tr><th><?php esc_html_e( 'Date', 'neo-pulse-wp' ); ?></th><td><?php echo esc_html( (string) ( $entry['created_at'] ?? '' ) ); ?></td></tr>
					<tr><th><?php esc_html_e( 'Status', 'neo-pulse-wp' ); ?></th><td><?php echo esc_html( (string) ( $entry['status'] ?? '' ) ); ?></td></tr>
					<?php if ( ! empty( $entry['ip_address'] ) ) : ?>
						<tr><th><?php esc_html_e( 'IP', 'neo-pulse-wp' ); ?></th><td><?php echo esc_html( (string) $entry['ip_address'] ); ?></td></tr>
					<?php endif; ?>
					<?php if ( ! empty( $entry['source_url'] ) ) : ?>
						<tr><th><?php esc_html_e( 'Source URL', 'neo-pulse-wp' ); ?></th><td><a href="<?php echo esc_url( (string) $entry['source_url'] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( (string) $entry['source_url'] ); ?></a></td></tr>
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
								$value = '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html__( 'Download file', 'neo-pulse-wp' ) . '</a>';
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
		self::neo_pulse_group_shell_close();
	}
}

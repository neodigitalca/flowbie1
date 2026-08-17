<?php
/**
 * Tags admin screens (Elementor dynamic tags settings).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Tags_Render {

	public static function render_tags_elementor_page(): void {
		$flash  = self::get_and_clear_flash();
		$config = Neo_Pulse_Wp_Fields_Elementor_Settings::get_config();
		$status = Neo_Pulse_Wp_Fields_Elementor::get_integration_status();

		self::render_tags_shell_open( 'elementor', $flash );
		?>
		<div class="neo-pulse-wp-redirects__panels neo-pulse-fields-acf-tools neo-pulse-fields-acf-editor neo-pulse-fields-elementor-settings">
			<div class="neo-pulse-wp-redirects__panel">
				<h2><?php esc_html_e( 'Integration status', 'neo-pulse-wp' ); ?></h2>
				<table class="widefat striped" style="max-width:640px;margin-bottom:1.5em;">
					<tbody>
						<tr>
							<th scope="row"><?php esc_html_e( 'Dynamic tags enabled', 'neo-pulse-wp' ); ?></th>
							<td><?php echo ! empty( $status['settings_enabled'] ) ? esc_html__( 'Yes', 'neo-pulse-wp' ) : esc_html__( 'No — enable below and save', 'neo-pulse-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Elementor detected', 'neo-pulse-wp' ); ?></th>
							<td><?php echo ! empty( $status['elementor_loaded'] ) ? esc_html__( 'Yes', 'neo-pulse-wp' ) : esc_html__( 'No', 'neo-pulse-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Dynamic Tags module', 'neo-pulse-wp' ); ?></th>
							<td><?php echo ! empty( $status['dynamic_tags_available'] ) ? esc_html__( 'Available', 'neo-pulse-wp' ) : esc_html__( 'Not available (Elementor Pro required)', 'neo-pulse-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Expected tag count', 'neo-pulse-wp' ); ?></th>
							<td><?php echo esc_html( (string) (int) ( $status['expected_tag_count'] ?? 0 ) ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Can register tags', 'neo-pulse-wp' ); ?></th>
							<td>
								<?php
								if ( ! empty( $status['can_register_tags'] ) ) {
									esc_html_e( 'Yes', 'neo-pulse-wp' );
								} elseif ( ! empty( $status['acf_active'] ) ) {
									esc_html_e( 'No — deactivate Advanced Custom Fields', 'neo-pulse-wp' );
								} else {
									esc_html_e( 'No — check settings above', 'neo-pulse-wp' );
								}
								?>
							</td>
						</tr>
					</tbody>
				</table>
				<p class="description">
					<?php esc_html_e( 'In Elementor, use Dynamic Tags → NEO Pulse. After ACF import, deactivate ACF, enable tags below, save, and reload the Elementor editor.', 'neo-pulse-wp' ); ?>
				</p>
				<p class="description">
					<?php esc_html_e( 'With “All fields” picker scope, every options page and post type field group appears in each NEO Pulse tag dropdown (new groups show up automatically).', 'neo-pulse-wp' ); ?>
				</p>
			</div>
			<div class="neo-pulse-wp-redirects__panel">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_FIELDS_ELEMENTOR ); ?>" />
					<?php wp_nonce_field( self::ACTION_SAVE_FIELDS_ELEMENTOR, 'neo_pulse_fields_elementor_nonce' ); ?>
					<p><label><input type="checkbox" name="enabled" value="1" <?php checked( ! empty( $config['enabled'] ) ); ?> /> <?php esc_html_e( 'Enable NEO Pulse dynamic tags', 'neo-pulse-wp' ); ?></label></p>
					<p><label><input type="checkbox" name="enable_post_tags" value="1" <?php checked( ! empty( $config['enable_post_tags'] ) ); ?> /> <?php esc_html_e( 'Enable post field tags (text, image, URL, gallery)', 'neo-pulse-wp' ); ?></label></p>
					<p><label><input type="checkbox" name="enable_options_tags" value="1" <?php checked( ! empty( $config['enable_options_tags'] ) ); ?> /> <?php esc_html_e( 'Enable options page tags', 'neo-pulse-wp' ); ?></label></p>
					<p>
						<label for="neo-pulse-field-picker-scope"><?php esc_html_e( 'Field picker scope', 'neo-pulse-wp' ); ?></label><br />
						<select name="field_picker_scope" id="neo-pulse-field-picker-scope">
							<option value="all" <?php selected( ( $config['field_picker_scope'] ?? 'all' ), 'all' ); ?>><?php esc_html_e( 'All fields (options, pages, service areas, every group)', 'neo-pulse-wp' ); ?></option>
							<option value="location" <?php selected( ( $config['field_picker_scope'] ?? '' ), 'location' ); ?>><?php esc_html_e( 'Current context only (location rules)', 'neo-pulse-wp' ); ?></option>
						</select>
					</p>
					<p><label><input type="checkbox" name="show_layout_fields" value="1" <?php checked( ! empty( $config['show_layout_fields'] ) ); ?> /> <?php esc_html_e( 'Show layout fields in tag pickers (repeater, group, flexible content, etc.)', 'neo-pulse-wp' ); ?></label></p>
					<p><button type="submit" class="button button-primary"><?php esc_html_e( 'Save Settings', 'neo-pulse-wp' ); ?></button></p>
				</form>
			</div>
		</div>
		<?php
		self::render_tags_shell_close();
	}

	/** @deprecated Use render_tags_elementor_page(); legacy Fields menu slug. */
	public static function render_fields_elementor_page(): void {
		self::render_tags_elementor_page();
	}

	public static function redirect_legacy_fields_elementor_page(): void {
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-tags' ) );
		exit;
	}
}

<?php
/**
 * Tags admin screens (Elementor dynamic tags settings).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Tags_Render {

	public static function render_tags_elementor_page(): void {
		$flash  = self::get_and_clear_flash();
		$config = Flowbie_Wp_Fields_Elementor_Settings::get_config();
		$status = Flowbie_Wp_Fields_Elementor::get_integration_status();

		self::render_tags_shell_open( 'elementor', $flash );
		?>
		<div class="flowbie-wp-redirects__panels flowbie-fields-acf-tools flowbie-fields-acf-editor flowbie-fields-elementor-settings">
			<div class="flowbie-wp-redirects__panel">
				<h2><?php esc_html_e( 'Integration status', 'flowbie-wp' ); ?></h2>
				<table class="widefat striped" style="max-width:640px;margin-bottom:1.5em;">
					<tbody>
						<tr>
							<th scope="row"><?php esc_html_e( 'Dynamic tags enabled', 'flowbie-wp' ); ?></th>
							<td><?php echo ! empty( $status['settings_enabled'] ) ? esc_html__( 'Yes', 'flowbie-wp' ) : esc_html__( 'No — enable below and save', 'flowbie-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Elementor detected', 'flowbie-wp' ); ?></th>
							<td><?php echo ! empty( $status['elementor_loaded'] ) ? esc_html__( 'Yes', 'flowbie-wp' ) : esc_html__( 'No', 'flowbie-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Dynamic Tags module', 'flowbie-wp' ); ?></th>
							<td><?php echo ! empty( $status['dynamic_tags_available'] ) ? esc_html__( 'Available', 'flowbie-wp' ) : esc_html__( 'Not available (Elementor Pro required)', 'flowbie-wp' ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Expected tag count', 'flowbie-wp' ); ?></th>
							<td><?php echo esc_html( (string) (int) ( $status['expected_tag_count'] ?? 0 ) ); ?></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Can register tags', 'flowbie-wp' ); ?></th>
							<td>
								<?php
								if ( ! empty( $status['can_register_tags'] ) ) {
									esc_html_e( 'Yes', 'flowbie-wp' );
								} elseif ( ! empty( $status['acf_active'] ) ) {
									esc_html_e( 'No — deactivate Advanced Custom Fields', 'flowbie-wp' );
								} else {
									esc_html_e( 'No — check settings above', 'flowbie-wp' );
								}
								?>
							</td>
						</tr>
					</tbody>
				</table>
				<p class="description">
					<?php esc_html_e( 'In Elementor, use Dynamic Tags → Flowbie. After ACF import, deactivate ACF, enable tags below, save, and reload the Elementor editor.', 'flowbie-wp' ); ?>
				</p>
				<p class="description">
					<?php esc_html_e( 'With “All fields” picker scope, every options page and post type field group appears in each Flowbie tag dropdown (new groups show up automatically).', 'flowbie-wp' ); ?>
				</p>
			</div>
			<div class="flowbie-wp-redirects__panel">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_FIELDS_ELEMENTOR ); ?>" />
					<?php wp_nonce_field( self::ACTION_SAVE_FIELDS_ELEMENTOR, 'flowbie_fields_elementor_nonce' ); ?>
					<p><label><input type="checkbox" name="enabled" value="1" <?php checked( ! empty( $config['enabled'] ) ); ?> /> <?php esc_html_e( 'Enable Flowbie dynamic tags', 'flowbie-wp' ); ?></label></p>
					<p><label><input type="checkbox" name="enable_post_tags" value="1" <?php checked( ! empty( $config['enable_post_tags'] ) ); ?> /> <?php esc_html_e( 'Enable post field tags (text, image, URL, gallery)', 'flowbie-wp' ); ?></label></p>
					<p><label><input type="checkbox" name="enable_options_tags" value="1" <?php checked( ! empty( $config['enable_options_tags'] ) ); ?> /> <?php esc_html_e( 'Enable options page tags', 'flowbie-wp' ); ?></label></p>
					<p>
						<label for="flowbie-field-picker-scope"><?php esc_html_e( 'Field picker scope', 'flowbie-wp' ); ?></label><br />
						<select name="field_picker_scope" id="flowbie-field-picker-scope">
							<option value="all" <?php selected( ( $config['field_picker_scope'] ?? 'all' ), 'all' ); ?>><?php esc_html_e( 'All fields (options, pages, service areas, every group)', 'flowbie-wp' ); ?></option>
							<option value="location" <?php selected( ( $config['field_picker_scope'] ?? '' ), 'location' ); ?>><?php esc_html_e( 'Current context only (location rules)', 'flowbie-wp' ); ?></option>
						</select>
					</p>
					<p><label><input type="checkbox" name="show_layout_fields" value="1" <?php checked( ! empty( $config['show_layout_fields'] ) ); ?> /> <?php esc_html_e( 'Show layout fields in tag pickers (repeater, group, flexible content, etc.)', 'flowbie-wp' ); ?></label></p>
					<p><button type="submit" class="button button-primary"><?php esc_html_e( 'Save Settings', 'flowbie-wp' ); ?></button></p>
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
		wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-tags' ) );
		exit;
	}
}

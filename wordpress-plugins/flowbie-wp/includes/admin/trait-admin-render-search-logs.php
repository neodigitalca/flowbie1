<?php
/**
 * Search logs admin pages.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Search_Logs {

	public static function render_search_logs_page(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/admin/class-flowbie-wp-search-logs-list-table.php';
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage search logs.', 'flowbie-wp' ) );
		}

		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : 'list';
		switch ( $action ) {
			case 'import-export':
				self::render_search_logs_import_export_page();
				break;
			case 'settings':
				self::render_search_logs_settings_page();
				break;
			default:
				self::render_search_logs_list_page();
		}
	}

	private static function render_search_logs_list_page(): void {
		$list_table = new Flowbie_Wp_Search_Logs_List_Table();
		$list_table->prepare_items();

		$base_url = admin_url( 'admin.php?page=flowbie-wp-search-logs' );
		$total    = Flowbie_Wp_Search_Logs::count_events();
		$logging  = Flowbie_Wp_Search_Logs::is_logging_active();

		self::flowbie_group_shell_open( 'flowbie-wp-search-logs', 'flowbie-wp-search-logs' );
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Search Logs', 'flowbie-wp' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-search-logs&action=import-export' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Import & Export', 'flowbie-wp' ); ?></a>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-search-logs&action=settings' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></a>
			<hr class="wp-header-end" />

			<?php if ( ! $logging ) : ?>
				<p class="description flowbie-wp-search-logs__note">
					<?php esc_html_e( 'Search logging is disabled. Enable it in Settings to capture queries and accepted answers.', 'flowbie-wp' ); ?>
				</p>
			<?php endif; ?>

			<p class="description">
				<?php
				printf(
					/* translators: %d: log count */
					esc_html__( '%d search events stored.', 'flowbie-wp' ),
					(int) $total
				);
				?>
			</p>

			<form method="get" class="flowbie-wp-search-logs__filter-form">
				<input type="hidden" name="page" value="flowbie-wp-search-logs" />
				<div class="flowbie-wp-search-logs__filter-row">
					<label>
						<?php esc_html_e( 'From', 'flowbie-wp' ); ?>
						<input type="date" name="date_from" value="<?php echo esc_attr( isset( $_GET['date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_from'] ) ) : '' ); ?>" />
					</label>
					<label>
						<?php esc_html_e( 'To', 'flowbie-wp' ); ?>
						<input type="date" name="date_to" value="<?php echo esc_attr( isset( $_GET['date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_to'] ) ) : '' ); ?>" />
					</label>
					<label>
						<input type="checkbox" name="accepted_only" value="1" <?php checked( ! empty( $_GET['accepted_only'] ) ); ?> />
						<?php esc_html_e( 'Accepted answers only', 'flowbie-wp' ); ?>
					</label>
					<?php submit_button( __( 'Filter', 'flowbie-wp' ), 'secondary', '', false ); ?>
				</div>
				<p class="search-box">
					<label class="screen-reader-text" for="search-log-search-input"><?php esc_html_e( 'Search logs', 'flowbie-wp' ); ?></label>
					<input type="search" id="search-log-search-input" name="s" value="<?php echo esc_attr( isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '' ); ?>" />
					<?php submit_button( __( 'Search', 'flowbie-wp' ), '', '', false ); ?>
				</p>
			</form>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_BULK_SEARCH_LOGS ); ?>" />
				<?php wp_nonce_field( 'bulk-search-logs' ); ?>
				<?php $list_table->display(); ?>
			</form>
		</div>
		<?php
		self::flowbie_group_shell_close();
	}

	private static function render_search_logs_import_export_page(): void {
		self::flowbie_group_shell_open( 'flowbie-wp-search-logs', 'flowbie-wp-search-logs' );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Search Logs Import & Export', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-search-logs' ) ); ?>">&larr; <?php esc_html_e( 'Back to list', 'flowbie-wp' ); ?></a></p>

			<div class="flowbie-wp-search-logs__panels">
				<div class="flowbie-wp-search-logs__panel">
					<h2><?php esc_html_e( 'Export', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Download search query history as CSV for training review.', 'flowbie-wp' ); ?></p>
					<p><code><?php echo esc_html( Flowbie_Wp_Search_Logs_Csv::HEADER ); ?></code></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_SEARCH_LOGS ); ?>" />
						<?php wp_nonce_field( self::ACTION_EXPORT_SEARCH_LOGS, 'flowbie_wp_export_search_logs_nonce' ); ?>
						<label>
							<input type="checkbox" name="accepted_only" value="1" />
							<?php esc_html_e( 'Accepted answers only (training export)', 'flowbie-wp' ); ?>
						</label>
						<p><?php submit_button( __( 'Export CSV', 'flowbie-wp' ), 'primary', 'submit', false ); ?></p>
					</form>
				</div>
			</div>
		</div>
		<?php
		self::flowbie_group_shell_close();
	}

	private static function render_search_logs_settings_page(): void {
		$settings = Flowbie_Wp_Search_Logs::get_settings();
		self::flowbie_group_shell_open( 'flowbie-wp-search-logs', 'flowbie-wp-search-logs' );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Search Log Settings', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-search-logs' ) ); ?>">&larr; <?php esc_html_e( 'Back to list', 'flowbie-wp' ); ?></a></p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SEARCH_LOG_SETTINGS ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_SEARCH_LOG_SETTINGS, 'flowbie_wp_search_log_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th scope="row"><?php esc_html_e( 'Logging', 'flowbie-wp' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="logging_enabled" value="1" <?php checked( ! empty( $settings['logging_enabled'] ) ); ?> />
								<?php esc_html_e( 'Record search queries and accepted answers', 'flowbie-wp' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="search_log_retention_days"><?php esc_html_e( 'Retention (days)', 'flowbie-wp' ); ?></label></th>
						<td>
							<input type="number" id="search_log_retention_days" name="retention_days" min="1" max="3650" value="<?php echo (int) $settings['retention_days']; ?>" />
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Save settings', 'flowbie-wp' ) ); ?>
			</form>
		</div>
		<?php
		self::flowbie_group_shell_close();
	}
}

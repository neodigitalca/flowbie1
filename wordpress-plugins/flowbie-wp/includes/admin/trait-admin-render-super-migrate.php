<?php
/**
 * Super Migrate admin page renderer.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Super_Migrate {

	public static function render_super_migrate_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$plan    = Flowbie_Wp_Super_Migrate::get_plan_preview();
		$sources = $plan['sources'] ?? array();
		$restore = Flowbie_Wp_Super_Import_Plugins::get_restorable_plugins();
		self::flowbie_group_shell_open( 'flowbie-wp-super-migrate', 'flowbie-wp-panel-page flowbie-wp-super-migrate' );
		?>
			<div class="flowbie-wp-super-migrate__card">
				<h1 class="flowbie-wp-super-migrate__title"><?php esc_html_e( 'Super Import', 'flowbie-wp' ); ?></h1>
				<p class="flowbie-wp-super-migrate__lead">
					<?php esc_html_e( 'Import third-party plugin settings into Flowbie — fields, global styles, redirects, schema, scripts, and speed.', 'flowbie-wp' ); ?>
				</p>

				<div class="flowbie-wp-super-migrate__restore<?php echo empty( $restore ) ? ' is-hidden' : ''; ?>" id="flowbie-sm-restore" aria-live="polite">
					<h2 class="flowbie-wp-super-migrate__restore-title"><?php esc_html_e( 'Restore previous plugins', 'flowbie-wp' ); ?></h2>
					<p class="flowbie-wp-super-migrate__restore-lead">
						<?php esc_html_e( 'Reactivate the plugins that were turned off during Super Import, then deactivate Flowbie WP.', 'flowbie-wp' ); ?>
					</p>
					<ul class="flowbie-wp-super-migrate__restore-list" id="flowbie-sm-restore-list">
						<?php foreach ( $restore as $plugin ) : ?>
							<li class="flowbie-wp-super-migrate__restore-item"><?php echo esc_html( (string) ( $plugin['label'] ?? $plugin['file'] ) ); ?></li>
						<?php endforeach; ?>
					</ul>
					<div class="flowbie-wp-super-migrate__restore-actions">
						<button type="button" class="button button-primary flowbie-wp-super-migrate__restore-btn" id="flowbie-sm-restore-btn">
							<?php esc_html_e( 'Restore plugins', 'flowbie-wp' ); ?>
						</button>
					</div>
					<p class="flowbie-wp-super-migrate__restore-result is-hidden" id="flowbie-sm-restore-result"></p>
				</div>

				<ul class="flowbie-wp-super-migrate__sources" id="flowbie-sm-sources" aria-label="<?php esc_attr_e( 'Plugins to import', 'flowbie-wp' ); ?>">
					<?php self::render_super_migrate_sources_list( $sources ); ?>
				</ul>

				<div class="flowbie-wp-super-migrate__cta">
					<button type="button" class="button button-primary flowbie-wp-super-migrate__import" id="flowbie-sm-import">
						<?php esc_html_e( 'Initiate Sync', 'flowbie-wp' ); ?>
					</button>
				</div>

				<div class="flowbie-wp-super-migrate__progress-wrap is-hidden" id="flowbie-sm-progress-wrap" aria-live="polite">
					<div class="flowbie-sm-hud" id="flowbie-sm-hud">
						<div class="flowbie-sm-hud__scan" aria-hidden="true"></div>
						<p class="flowbie-sm-hud__headline" id="flowbie-sm-hud-headline"><?php esc_html_e( 'NEURAL SYNC STANDBY', 'flowbie-wp' ); ?></p>
						<p class="flowbie-sm-hud__subline" id="flowbie-sm-status"></p>
						<div class="flowbie-sm-hud__macro" id="flowbie-sm-macro-row" aria-hidden="true"></div>
						<div class="flowbie-sm-hud__overall">
							<div class="flowbie-wp-super-migrate__progress-bar flowbie-sm-hud__overall-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="flowbie-sm-progress-bar">
								<span id="flowbie-sm-progress-fill"></span>
							</div>
							<span class="flowbie-sm-hud__overall-pct" id="flowbie-sm-overall-pct">0%</span>
						</div>
						<div class="flowbie-sm-stream" id="flowbie-sm-micro-grid" role="list" aria-label="<?php esc_attr_e( 'Import operations', 'flowbie-wp' ); ?>"></div>
					</div>
				</div>

				<div class="flowbie-wp-super-migrate__conflicts is-hidden" id="flowbie-sm-conflicts" aria-live="polite">
					<h2 class="flowbie-wp-super-migrate__conflicts-title"><?php esc_html_e( 'Avoid conflicts', 'flowbie-wp' ); ?></h2>
					<p class="flowbie-wp-super-migrate__conflicts-lead">
						<?php esc_html_e( 'These plugins were imported into Flowbie. Deactivate them to prevent duplicate fields, redirects, schema markup, scripts, or optimization.', 'flowbie-wp' ); ?>
					</p>
					<ul class="flowbie-wp-super-migrate__conflict-list" id="flowbie-sm-conflict-list"></ul>
					<div class="flowbie-wp-super-migrate__conflicts-actions">
						<button type="button" class="button button-primary flowbie-wp-super-migrate__deactivate" id="flowbie-sm-deactivate">
							<?php esc_html_e( 'Deactivate selected plugins', 'flowbie-wp' ); ?>
						</button>
						<button type="button" class="button flowbie-wp-super-migrate__skip-conflicts" id="flowbie-sm-skip-conflicts">
							<?php esc_html_e( 'Keep plugins active', 'flowbie-wp' ); ?>
						</button>
					</div>
					<p class="flowbie-wp-super-migrate__conflicts-result is-hidden" id="flowbie-sm-conflicts-result"></p>
				</div>
			</div>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $sources Detected sources.
	 */
	private static function render_super_migrate_sources_list( array $sources ): void {
		$shown = 0;
		foreach ( Flowbie_Wp_Super_Migrate_Registry::all() as $adapter ) {
			if ( 'flowbie_native' === $adapter->get_id() ) {
				continue;
			}
			$id     = $adapter->get_id();
			$info   = $sources[ $id ] ?? $adapter->detect();
			$active = ! empty( $info['active'] );
			if ( ! $active ) {
				continue;
			}
			++$shown;
			echo '<li class="flowbie-wp-super-migrate__source">';
			echo esc_html( $adapter->get_label() );
			echo '</li>';
		}
		if ( $shown === 0 ) {
			echo '<li class="flowbie-wp-super-migrate__source flowbie-wp-super-migrate__source--none">';
			esc_html_e( 'No third-party plugins detected. Install ACF, Rank Math, HFCM, or Autoptimize to import their settings.', 'flowbie-wp' );
			echo '</li>';
		}
	}
}

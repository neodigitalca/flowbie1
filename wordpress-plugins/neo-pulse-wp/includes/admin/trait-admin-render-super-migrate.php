<?php
/**
 * Super Migrate admin page renderer.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Super_Migrate {

	public static function render_super_migrate_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$plan    = Neo_Pulse_Wp_Super_Migrate::get_plan_preview();
		$sources = $plan['sources'] ?? array();
		$restore = Neo_Pulse_Wp_Super_Import_Plugins::get_restorable_plugins();
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-super-migrate', 'neo-pulse-wp-panel-page neo-pulse-wp-super-migrate' );
		?>
			<div class="neo-pulse-wp-super-migrate__card">
				<h1 class="neo-pulse-wp-super-migrate__title"><?php esc_html_e( 'Super Import', 'neo-pulse-wp' ); ?></h1>
				<p class="neo-pulse-wp-super-migrate__lead">
					<?php esc_html_e( 'Import third-party plugin settings into NEO Pulse — fields, global styles, redirects, schema, scripts, and speed.', 'neo-pulse-wp' ); ?>
				</p>

				<div class="neo-pulse-wp-super-migrate__restore<?php echo empty( $restore ) ? ' is-hidden' : ''; ?>" id="neo-pulse-sm-restore" aria-live="polite">
					<h2 class="neo-pulse-wp-super-migrate__restore-title"><?php esc_html_e( 'Restore previous plugins', 'neo-pulse-wp' ); ?></h2>
					<p class="neo-pulse-wp-super-migrate__restore-lead">
						<?php esc_html_e( 'Reactivate the plugins that were turned off during Super Import, then deactivate NEO Pulse WP.', 'neo-pulse-wp' ); ?>
					</p>
					<ul class="neo-pulse-wp-super-migrate__restore-list" id="neo-pulse-sm-restore-list">
						<?php foreach ( $restore as $plugin ) : ?>
							<li class="neo-pulse-wp-super-migrate__restore-item"><?php echo esc_html( (string) ( $plugin['label'] ?? $plugin['file'] ) ); ?></li>
						<?php endforeach; ?>
					</ul>
					<div class="neo-pulse-wp-super-migrate__restore-actions">
						<button type="button" class="button button-primary neo-pulse-wp-super-migrate__restore-btn" id="neo-pulse-sm-restore-btn">
							<?php esc_html_e( 'Restore plugins', 'neo-pulse-wp' ); ?>
						</button>
					</div>
					<p class="neo-pulse-wp-super-migrate__restore-result is-hidden" id="neo-pulse-sm-restore-result"></p>
				</div>

				<ul class="neo-pulse-wp-super-migrate__sources" id="neo-pulse-sm-sources" aria-label="<?php esc_attr_e( 'Plugins to import', 'neo-pulse-wp' ); ?>">
					<?php self::render_super_migrate_sources_list( $sources ); ?>
				</ul>

				<div class="neo-pulse-wp-super-migrate__cta">
					<button type="button" class="button button-primary neo-pulse-wp-super-migrate__import" id="neo-pulse-sm-import">
						<?php esc_html_e( 'Initiate Sync', 'neo-pulse-wp' ); ?>
					</button>
				</div>

				<div class="neo-pulse-wp-super-migrate__progress-wrap is-hidden" id="neo-pulse-sm-progress-wrap" aria-live="polite">
					<div class="neo-pulse-sm-hud" id="neo-pulse-sm-hud">
						<div class="neo-pulse-sm-hud__scan" aria-hidden="true"></div>
						<p class="neo-pulse-sm-hud__headline" id="neo-pulse-sm-hud-headline"><?php esc_html_e( 'NEURAL SYNC STANDBY', 'neo-pulse-wp' ); ?></p>
						<p class="neo-pulse-sm-hud__subline" id="neo-pulse-sm-status"></p>
						<div class="neo-pulse-sm-hud__macro" id="neo-pulse-sm-macro-row" aria-hidden="true"></div>
						<div class="neo-pulse-sm-hud__overall">
							<div class="neo-pulse-wp-super-migrate__progress-bar neo-pulse-sm-hud__overall-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="neo-pulse-sm-progress-bar">
								<span id="neo-pulse-sm-progress-fill"></span>
							</div>
							<span class="neo-pulse-sm-hud__overall-pct" id="neo-pulse-sm-overall-pct">0%</span>
						</div>
						<div class="neo-pulse-sm-stream" id="neo-pulse-sm-micro-grid" role="list" aria-label="<?php esc_attr_e( 'Import operations', 'neo-pulse-wp' ); ?>"></div>
					</div>
				</div>

				<div class="neo-pulse-wp-super-migrate__conflicts is-hidden" id="neo-pulse-sm-conflicts" aria-live="polite">
					<h2 class="neo-pulse-wp-super-migrate__conflicts-title"><?php esc_html_e( 'Avoid conflicts', 'neo-pulse-wp' ); ?></h2>
					<p class="neo-pulse-wp-super-migrate__conflicts-lead">
						<?php esc_html_e( 'These plugins were imported into NEO Pulse. Deactivate them to prevent duplicate fields, redirects, schema markup, scripts, or optimization.', 'neo-pulse-wp' ); ?>
					</p>
					<ul class="neo-pulse-wp-super-migrate__conflict-list" id="neo-pulse-sm-conflict-list"></ul>
					<div class="neo-pulse-wp-super-migrate__conflicts-actions">
						<button type="button" class="button button-primary neo-pulse-wp-super-migrate__deactivate" id="neo-pulse-sm-deactivate">
							<?php esc_html_e( 'Deactivate selected plugins', 'neo-pulse-wp' ); ?>
						</button>
						<button type="button" class="button neo-pulse-wp-super-migrate__skip-conflicts" id="neo-pulse-sm-skip-conflicts">
							<?php esc_html_e( 'Keep plugins active', 'neo-pulse-wp' ); ?>
						</button>
					</div>
					<p class="neo-pulse-wp-super-migrate__conflicts-result is-hidden" id="neo-pulse-sm-conflicts-result"></p>
				</div>
			</div>
		<?php
		self::neo_pulse_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $sources Detected sources.
	 */
	private static function render_super_migrate_sources_list( array $sources ): void {
		$shown = 0;
		foreach ( Neo_Pulse_Wp_Super_Migrate_Registry::all() as $adapter ) {
			if ( 'neo-pulse_native' === $adapter->get_id() ) {
				continue;
			}
			$id     = $adapter->get_id();
			$info   = $sources[ $id ] ?? $adapter->detect();
			$active = ! empty( $info['active'] );
			if ( ! $active ) {
				continue;
			}
			++$shown;
			echo '<li class="neo-pulse-wp-super-migrate__source">';
			echo esc_html( $adapter->get_label() );
			echo '</li>';
		}
		if ( $shown === 0 ) {
			echo '<li class="neo-pulse-wp-super-migrate__source neo-pulse-wp-super-migrate__source--none">';
			esc_html_e( 'No third-party plugins detected. Install ACF, Rank Math, HFCM, or Autoptimize to import their settings.', 'neo-pulse-wp' );
			echo '</li>';
		}
	}
}

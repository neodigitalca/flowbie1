<?php
/**
 * Speed module wp-admin settings page (shared panel shell).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Speed {

	/**
	 * @return array<int, string>
	 */
	private static function speed_tab_keys(): array {
		return array( 'general', 'images' );
	}

	public static function render_speed_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'neo-pulse-wp' ) );
		}

		if ( class_exists( 'Neo_Pulse_Wp_Speed_Warm', false ) ) {
			Neo_Pulse_Wp_Speed_Warm::maybe_auto_warm();
		}

		$config    = Neo_Pulse_Wp_Speed_Settings::get_config();
		$stats     = Neo_Pulse_Wp_Speed_Cache::stats();
		$conflicts = Neo_Pulse_Wp_Speed_Settings::conflicting_plugins();
		$enabled   = ! empty( $config['enabled'] );

		$tab = self::panel_active_tab( 'general' );
		if ( ! in_array( $tab, self::speed_tab_keys(), true ) ) {
			$tab = 'general';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Speed', 'neo-pulse-wp' ),
				'tabs'    => array(
					'general' => __( 'Speed', 'neo-pulse-wp' ),
					'images'  => __( 'Images', 'neo-pulse-wp' ),
				),
			),
		);

		self::neo_pulse_group_shell_open( 'neo-pulse-wp-speed', 'neo-pulse-wp-speed neo-pulse-wp-panel-page' );

		if ( ! empty( $conflicts ) && $enabled && 'images' !== $tab ) : ?>
			<div class="notice notice-warning neo-pulse-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These plugins may conflict with NEO Pulse Speed: %s. Deactivate their CSS/JS optimization to avoid double-processing.', 'neo-pulse-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif;

		self::panel_layout_start( 'neo-pulse-wp-speed', $nav_groups, $tab, __( 'Speed settings sections', 'neo-pulse-wp' ) );
		if ( 'images' === $tab ) {
			self::render_speed_section_images( $tab );
		} else {
			self::render_speed_section_general( $config, $stats, $tab );
		}
		self::panel_layout_end();

		self::neo_pulse_group_shell_close();
	}

	/**
	 * @param array<string, mixed>                            $config Config.
	 * @param array{file_count: int, bytes: int, last_flush: int} $stats  Cache stats.
	 * @param string                                            $tab    Active tab.
	 */
	private static function render_speed_section_general( array $config, array $stats, string $tab ): void {
		$form_id = 'neo-pulse-speed-settings-form-general';
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_speed_enabled',
				__( 'Enable Speed for visitors', 'neo-pulse-wp' ),
				! empty( $config['enabled'] )
			);
			self::panel_form_toggle(
				'neo-pulse_speed_skip_logged_in',
				__( 'Disable Speed for admins (logged in)', 'neo-pulse-wp' ),
				! empty( $config['skip_logged_in'] )
			);
			self::panel_form_group_close();
			?>
		</form>

		<div class="neo-pulse-wp-panel-info-box">
			<strong><?php esc_html_e( 'Disk cache', 'neo-pulse-wp' ); ?></strong>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: file count, 2: formatted size */
						__( 'NEO Pulse speed files on disk: %1$d (%2$s).', 'neo-pulse-wp' ),
						(int) $stats['file_count'],
						size_format( (int) $stats['bytes'] )
					)
				);
				?>
			</p>
			<?php if ( ! empty( $config['enabled'] ) ) : ?>
				<p class="neo-pulse-field__note">
					<?php esc_html_e( 'Minified CSS/JS are written automatically when Speed is on (on save and when this page loads if the folder is empty). Real visitors also refresh files as they browse.', 'neo-pulse-wp' ); ?>
				</p>
			<?php endif; ?>
		</div>

		<?php self::render_speed_diagnostics_panel( $config ); ?>

		<div class="neo-pulse-wp-panel-footer">
			<div class="neo-pulse-wp-panel-footer__left">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_ALL_WORDPRESS ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_ALL_WORDPRESS, 'neo_pulse_wp_flush_all_wordpress_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Flush all WordPress + NEO Pulse caches', 'neo-pulse-wp' ); ?></button>
				</form>
				<p class="neo-pulse-field__note">
					<?php esc_html_e( 'Flush clears minified files on disk; they are rebuilt automatically on the next save or page load.', 'neo-pulse-wp' ); ?>
				</p>
			</div>
			<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'neo-pulse-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Config.
	 * @param string               $tab    Active tab.
	 */
	private static function render_speed_section_css( array $config, string $tab ): void {
		$form_id = 'neo-pulse-speed-settings-form-css';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'CSS', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc"><?php esc_html_e( 'Minify and optionally combine local stylesheets.', 'neo-pulse-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' ); ?>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_optimize_css" value="1" <?php checked( ! empty( $config['optimize_css'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Minify CSS files', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_aggregate_css" value="1" <?php checked( ! empty( $config['aggregate_css'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Combine CSS into one file', 'neo-pulse-wp' ); ?></span>
				</label>
				<?php if ( ! empty( $config['aggregate_css'] ) ) : ?>
					<p class="description">
						<?php esc_html_e( 'Combining CSS can break complex themes (Elementor, custom dark layouts). If guests see a broken layout while admins do not, disable this option and flush the cache.', 'neo-pulse-wp' ); ?>
					</p>
				<?php endif; ?>
			</section>
		</form>
		<?php self::render_speed_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Config.
	 * @param string               $tab    Active tab.
	 */
	private static function render_speed_section_javascript( array $config, string $tab ): void {
		$form_id = 'neo-pulse-speed-settings-form-javascript';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'JavaScript', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc"><?php esc_html_e( 'Minify, combine, and defer local scripts. NEO Pulse chat and voice scripts stay excluded by default.', 'neo-pulse-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' ); ?>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_optimize_js" value="1" <?php checked( ! empty( $config['optimize_js'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Minify JS files', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_aggregate_js" value="1" <?php checked( ! empty( $config['aggregate_js'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Combine JS into one file', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_defer_js" value="1" <?php checked( ! empty( $config['defer_js'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Defer non-excluded scripts', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>
		</form>
		<?php self::render_speed_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Config.
	 * @param string               $tab    Active tab.
	 */
	private static function render_speed_section_html( array $config, string $tab ): void {
		$form_id = 'neo-pulse-speed-settings-form-html';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'HTML & assets', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc"><?php esc_html_e( 'HTML minification and static asset URL cleanup.', 'neo-pulse-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' ); ?>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_minify_html" value="1" <?php checked( ! empty( $config['minify_html'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Minify HTML output', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>

			<section class="neo-pulse-wp-settings__card">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_remove_query_strings" value="1" <?php checked( ! empty( $config['remove_query_strings'] ) ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Remove ?ver= query strings from local CSS/JS URLs', 'neo-pulse-wp' ); ?></span>
				</label>
			</section>
		</form>
		<?php self::render_speed_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Config.
	 * @param string               $tab    Active tab.
	 */
	private static function render_speed_section_excludes( array $config, string $tab ): void {
		$form_id = 'neo-pulse-speed-settings-form-excludes';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Excludes', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'One pattern per line, matched against asset URLs. NEO Pulse chat, search, and voice scripts are excluded by default.', 'neo-pulse-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'neo_pulse_wp_speed_nonce' ); ?>

			<section class="neo-pulse-wp-settings__card">
				<div class="neo-pulse-wp-settings__field">
					<label class="neo-pulse-wp-settings__label" for="neo-pulse_speed_js_exclude"><?php esc_html_e( 'Exclude JS', 'neo-pulse-wp' ); ?></label>
					<textarea
						class="neo-pulse-wp-settings__input widefat"
						name="neo-pulse_speed_js_exclude"
						id="neo-pulse_speed_js_exclude"
						rows="4"
						spellcheck="false"
					><?php echo esc_textarea( (string) ( $config['js_exclude'] ?? '' ) ); ?></textarea>
				</div>
			</section>

			<section class="neo-pulse-wp-settings__card">
				<div class="neo-pulse-wp-settings__field">
					<label class="neo-pulse-wp-settings__label" for="neo-pulse_speed_css_exclude"><?php esc_html_e( 'Exclude CSS', 'neo-pulse-wp' ); ?></label>
					<textarea
						class="neo-pulse-wp-settings__input widefat"
						name="neo-pulse_speed_css_exclude"
						id="neo-pulse_speed_css_exclude"
						rows="3"
						spellcheck="false"
					><?php echo esc_textarea( (string) ( $config['css_exclude'] ?? '' ) ); ?></textarea>
				</div>
			</section>
		</form>
		<?php self::render_speed_form_footer( $tab, $form_id ); ?>
		<?php
	}

	/**
	 * @param array<string, mixed> $config Speed config.
	 */
	private static function render_speed_diagnostics_panel( array $config ): void {
		$diag     = Neo_Pulse_Wp_Speed_Diagnostics::status( $config );
		$diag_url = add_query_arg(
			array(
				'neo-pulse_speed_debug' => '1',
				'nocache'             => '1',
			),
			home_url( '/' )
		);
		?>
		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'What actually runs right now', 'neo-pulse-wp' ); ?></strong></p>
			<ul class="neo-pulse-wp-panel-info-box__list">
				<?php foreach ( Neo_Pulse_Wp_Speed_Diagnostics::admin_summary_lines( $diag ) as $line ) : ?>
					<li><?php echo esc_html( $line ); ?></li>
				<?php endforeach; ?>
			</ul>
			<p class="neo-pulse-field__note">
				<?php esc_html_e( 'While logged into wp-admin, Speed does not change pages you browse—but disk cache is built automatically in the background when Speed is enabled.', 'neo-pulse-wp' ); ?>
			</p>
			<p class="neo-pulse-field__note">
				<a href="<?php echo esc_url( $diag_url ); ?>" target="_blank" rel="noopener noreferrer">
					<?php esc_html_e( 'Open homepage with debug marker (view source near bottom)', 'neo-pulse-wp' ); ?>
				</a>
			</p>
		</div>
		<?php
		self::render_elementor_site_recovery_panel( $config );
	}

	/**
	 * @param array<string, mixed> $config Speed config.
	 */
	private static function render_elementor_site_recovery_panel( array $config ): void {
		if ( ! defined( 'ELEMENTOR_VERSION' ) || ! class_exists( 'Neo_Pulse_Wp_Elementor_Site_Recovery', false ) ) {
			return;
		}

		$diag       = Neo_Pulse_Wp_Elementor_Site_Recovery::get_diagnostics();
		$nocache_url = add_query_arg( 'nocache', '1', home_url( '/' ) );
		$tab        = self::panel_active_tab( 'general' );
		?>
		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'Elementor install side effects', 'neo-pulse-wp' ); ?></strong></p>
			<ul class="neo-pulse-wp-panel-info-box__list">
				<li>
					<?php
					echo esc_html(
						! empty( $diag['elementor_cache_fix_ran'] )
							? __( 'Silent Elementor migration has run on this site.', 'neo-pulse-wp' )
							: __( 'Silent Elementor migration has not run.', 'neo-pulse-wp' )
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						! empty( $diag['speed_enabled'] )
							? __( 'Speed is enabled.', 'neo-pulse-wp' )
							: __( 'Speed is disabled.', 'neo-pulse-wp' )
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %d: document count */
							__( 'Elementor documents with NEO Pulse dynamic tags: %d', 'neo-pulse-wp' ),
							(int) ( $diag['neo-pulse_tag_documents'] ?? 0 )
						)
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						! empty( $diag['fields_ready'] )
							? __( 'Fields are configured for tag migration.', 'neo-pulse-wp' )
							: __( 'Fields are not configured for tag migration.', 'neo-pulse-wp' )
					);
					?>
				</li>
			</ul>
			<?php if ( ! empty( $diag['neo-pulse_tag_samples'] ) && is_array( $diag['neo-pulse_tag_samples'] ) ) : ?>
				<p><strong><?php esc_html_e( 'Sample templates with NEO Pulse tags', 'neo-pulse-wp' ); ?></strong></p>
				<ul class="neo-pulse-wp-panel-info-box__list">
					<?php foreach ( $diag['neo-pulse_tag_samples'] as $sample ) : ?>
						<li>
							<?php
							echo esc_html(
								sprintf(
									'%s (%s, #%d)',
									(string) ( $sample['title'] ?? '' ),
									(string) ( $sample['post_type'] ?? '' ),
									(int) ( $sample['id'] ?? 0 )
								)
							);
							?>
						</li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>
			<p class="neo-pulse-field__note">
				<?php esc_html_e( 'If carousels repeat or logos broke after installing neo-pulse-wp, disable Speed, run recovery, then test in a private window.', 'neo-pulse-wp' ); ?>
				<a href="<?php echo esc_url( $nocache_url ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open homepage without Speed (?nocache=1)', 'neo-pulse-wp' ); ?></a>
			</p>
			<div class="neo-pulse-wp-panel-footer__left" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_RECOVER_ELEMENTOR_SITE ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_RECOVER_ELEMENTOR_SITE, 'neo_pulse_wp_recover_elementor_nonce' ); ?>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Recover Elementor (disable Speed + revert tags)', 'neo-pulse-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_RUN_ELEMENTOR_MIGRATION ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_RUN_ELEMENTOR_MIGRATION, 'neo_pulse_wp_run_elementor_migration_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Run Elementor tag migration (opt-in)', 'neo-pulse-wp' ); ?></button>
				</form>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array{file_count: int, bytes: int, last_flush: int} $stats Cache stats.
	 * @param string                                              $tab   Active tab.
	 */
	private static function render_speed_section_cache( array $stats, string $tab ): void {
		$config = Neo_Pulse_Wp_Speed_Settings::get_config();
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Cache', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Optimized files are stored under wp-content/cache/neo-pulse-speed/.', 'neo-pulse-wp' ); ?>
		</p>

		<?php self::render_speed_diagnostics_panel( $config ); ?>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<strong><?php esc_html_e( 'Cached assets', 'neo-pulse-wp' ); ?></strong>
			</p>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: file count, 2: formatted size */
						__( '%1$d files (%2$s)', 'neo-pulse-wp' ),
						(int) $stats['file_count'],
						size_format( (int) $stats['bytes'] )
					)
				);
				?>
			</p>
			<?php if ( ! empty( $stats['last_flush'] ) ) : ?>
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: localized datetime */
							__( 'Last cleared: %s', 'neo-pulse-wp' ),
							wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $stats['last_flush'] )
						)
					);
					?>
				</p>
			<?php endif; ?>
		</div>

		<div class="neo-pulse-wp-panel-info-box" style="margin-top:16px;">
			<p><strong><?php esc_html_e( 'Import & presets', 'neo-pulse-wp' ); ?></strong></p>
			<p class="description">
				<?php esc_html_e( 'Elementor-safe turns off all Speed transforms (combine, defer, minify). With that preset, Speed does not change HTML at all. Test broken pages in a private/incognito window — while logged in, "Skip optimization for logged-in users" means Speed is already off for you.', 'neo-pulse-wp' ); ?>
			</p>
			<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_APPLY_SPEED_PRESET ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<input type="hidden" name="neo-pulse_speed_preset" value="<?php echo esc_attr( Neo_Pulse_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE ); ?>" />
					<?php wp_nonce_field( self::ACTION_APPLY_SPEED_PRESET, 'neo_pulse_wp_apply_speed_preset_nonce' ); ?>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Apply Elementor-safe preset', 'neo-pulse-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_APPLY_SPEED_PRESET ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<input type="hidden" name="neo-pulse_speed_preset" value="<?php echo esc_attr( Neo_Pulse_Wp_Speed_Import::PRESET_DISABLE ); ?>" />
					<?php wp_nonce_field( self::ACTION_APPLY_SPEED_PRESET, 'neo_pulse_wp_apply_speed_preset_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Disable Speed (diagnostic)', 'neo-pulse-wp' ); ?></button>
				</form>
			</div>
			<p class="description">
				<?php esc_html_e( 'Or download the preset JSON and import it on another site.', 'neo-pulse-wp' ); ?>
				<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_DOWNLOAD_SPEED_PRESET . '&neo-pulse_speed_preset=' . Neo_Pulse_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE ), self::ACTION_DOWNLOAD_SPEED_PRESET, 'neo_pulse_wp_download_speed_preset_nonce' ) ); ?>">
					<?php esc_html_e( 'Download preset JSON', 'neo-pulse-wp' ); ?>
				</a>
			</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data" class="neo-pulse-wp-settings__form" style="margin-top:12px;">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SPEED_SETTINGS ); ?>" />
				<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
				<?php wp_nonce_field( self::ACTION_IMPORT_SPEED_SETTINGS, 'neo_pulse_wp_import_speed_settings_nonce' ); ?>
				<p>
					<label for="neo-pulse_speed_settings_json"><strong><?php esc_html_e( 'Import from JSON file', 'neo-pulse-wp' ); ?></strong></label><br />
					<input type="file" name="neo-pulse_speed_settings_json" id="neo-pulse_speed_settings_json" accept=".json,application/json" required />
				</p>
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_import_speed" value="1" checked="checked" />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Import Speed settings', 'neo-pulse-wp' ); ?></span>
				</label>
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_import_images" value="1" checked="checked" />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Import Speed Images settings', 'neo-pulse-wp' ); ?></span>
				</label>
				<p style="margin-top:8px;">
					<button type="submit" class="button button-secondary"><?php esc_html_e( 'Import settings (JSON)', 'neo-pulse-wp' ); ?></button>
				</p>
			</form>
		</div>

		<p class="description" style="margin-top:12px;">
			<?php esc_html_e( 'Export downloads your current Speed and Speed Images settings as JSON (no API secrets).', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-footer">
			<div class="neo-pulse-wp-panel-footer__left" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_SPEED ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_SPEED, 'neo_pulse_wp_speed_flush_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Clear optimized assets', 'neo-pulse-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_SPEED_SETTINGS ); ?>" />
					<input type="hidden" name="neo-pulse_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_EXPORT_SPEED_SETTINGS, 'neo_pulse_wp_export_speed_settings_nonce' ); ?>
					<button type="submit" class="button button-secondary"><?php esc_html_e( 'Export settings (JSON)', 'neo-pulse-wp' ); ?></button>
				</form>
			</div>
		</div>
		<?php
	}

	/**
	 * @param string $tab     Active tab.
	 * @param string $form_id Save form id.
	 */
	private static function render_speed_form_footer( string $tab, string $form_id ): void {
		?>
		<div class="neo-pulse-wp-panel-footer">
			<div class="neo-pulse-wp-panel-footer__left"></div>
			<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'neo-pulse-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	/**
	 * @param string $tab Active tab.
	 */
	private static function render_speed_section_images( string $tab ): void {
		$config        = Neo_Pulse_Wp_Speed_Image_Settings::get_config();
		$stats         = Neo_Pulse_Wp_Speed_Image_Stats::get();
		$conflicts     = Neo_Pulse_Wp_Speed_Image_Settings::conflicting_plugins();
		$enabled       = ! empty( $config['enabled'] );
		$supports_webp = Neo_Pulse_Wp_Speed_Image_Settings::supports_webp_editor();
		$pending       = Neo_Pulse_Wp_Speed_Image_Optimizer::count_pending( false );
		$form_id       = 'neo-pulse-speed-settings-form-images';
		?>
		<?php if ( ! empty( $conflicts ) && $enabled ) : ?>
			<div class="notice notice-warning neo-pulse-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These image optimizer plugins may conflict with NEO Pulse Speed → Images: %s. Disable them to avoid double-processing.', 'neo-pulse-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif; ?>

		<?php if ( ! $supports_webp ) : ?>
			<div class="notice notice-info neo-pulse-wp-acf-shell-notice">
				<p><?php esc_html_e( 'This server cannot generate WebP with the WordPress image editor (Imagick/GD). WebP options are disabled until support is available.', 'neo-pulse-wp' ); ?></p>
			</div>
		<?php endif; ?>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED_IMAGES ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED_IMAGES, 'neo_pulse_wp_speed_images_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_speed_image_enabled',
				__( 'Enable image optimization', 'neo-pulse-wp' ),
				$enabled
			);
			self::panel_form_toggle(
				'neo-pulse_speed_image_auto_on_upload',
				__( 'Optimize new uploads automatically', 'neo-pulse-wp' ),
				! empty( $config['auto_on_upload'] )
			);
			self::panel_form_group_close();

			self::panel_form_group_open();
			self::panel_form_field_input(
				'neo-pulse_speed_image_jpeg_quality',
				'neo-pulse_speed_image_jpeg_quality',
				__( 'JPEG quality (1–100)', 'neo-pulse-wp' ),
				(string) (int) $config['jpeg_quality'],
				'half',
				'number',
				false,
				'',
				' min="1" max="100"'
			);
			self::panel_form_field_input(
				'neo-pulse_speed_image_png_compression',
				'neo-pulse_speed_image_png_compression',
				__( 'PNG compression (0–9)', 'neo-pulse-wp' ),
				(string) (int) $config['png_compression'],
				'half',
				'number',
				false,
				'',
				' min="0" max="9"'
			);
			self::panel_form_field_input(
				'neo-pulse_speed_image_max_width',
				'neo-pulse_speed_image_max_width',
				__( 'Max width (0 = no resize)', 'neo-pulse-wp' ),
				(string) (int) $config['max_width'],
				'half',
				'number',
				false,
				'',
				' min="0" max="10000"'
			);
			self::panel_form_field_input(
				'neo-pulse_speed_image_max_height',
				'neo-pulse_speed_image_max_height',
				__( 'Max height (0 = no resize)', 'neo-pulse-wp' ),
				(string) (int) $config['max_height'],
				'half',
				'number',
				false,
				'',
				' min="0" max="10000"'
			);
			self::panel_form_group_close();

			self::panel_form_group_open();
			?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--half">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_image_generate_webp" value="1" <?php checked( ! empty( $config['generate_webp'] ) ); ?> <?php disabled( ! $supports_webp ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Generate WebP sidecars', 'neo-pulse-wp' ); ?></span>
				</label>
			</div>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--half">
				<label class="neo-pulse-wp-panel-toggle">
					<input type="checkbox" name="neo-pulse_speed_image_serve_webp" value="1" <?php checked( ! empty( $config['serve_webp'] ) ); ?> <?php disabled( ! $supports_webp ); ?> />
					<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Serve WebP to supporting browsers', 'neo-pulse-wp' ); ?></span>
				</label>
			</div>
			<?php
			self::panel_form_group_close();

			self::panel_form_group_open();
			self::panel_form_field_input(
				'neo-pulse_speed_image_max_file_mb',
				'neo-pulse_speed_image_max_file_mb',
				__( 'Skip files larger than (MB)', 'neo-pulse-wp' ),
				(string) (int) $config['max_file_mb'],
				'half',
				'number',
				false,
				'',
				' min="1" max="100"'
			);
			self::panel_form_field_textarea(
				'neo-pulse_speed_image_skip_mimes',
				'neo-pulse_speed_image_skip_mimes',
				__( 'Skip MIME types (one per line)', 'neo-pulse-wp' ),
				(string) ( $config['skip_mimes'] ?? '' ),
				'full',
				3
			);
			?>
			<input type="hidden" name="neo-pulse_speed_image_optimize_sizes" value="full" />
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<p class="neo-pulse-field__note"><?php esc_html_e( 'v1 optimizes the full-size upload only. Thumbnail sizes will be added in a future release.', 'neo-pulse-wp' ); ?></p>
			</div>
			<?php
			self::panel_form_group_close();
			?>
		</form>

		<div class="neo-pulse-wp-panel-info-box">
			<p><strong><?php esc_html_e( 'Bulk optimize library', 'neo-pulse-wp' ); ?></strong></p>
			<div id="neo-pulse-speed-images-bulk" role="status" data-pending="<?php echo esc_attr( (string) $pending ); ?>">
				<p class="neo-pulse-speed-images-bulk__status"><?php esc_html_e( 'Ready.', 'neo-pulse-wp' ); ?></p>
				<progress class="neo-pulse-speed-images-bulk__bar" value="0" max="100"></progress>
			</div>
			<p>
				<button type="button" class="button" id="neo-pulse-speed-images-bulk-start" <?php disabled( ! $enabled ); ?>>
					<?php esc_html_e( 'Optimize library', 'neo-pulse-wp' ); ?>
				</button>
			</p>
			<label class="neo-pulse-wp-panel-toggle">
				<input type="checkbox" id="neo-pulse-speed-images-bulk-force" />
				<span class="neo-pulse-wp-panel-toggle__label"><?php esc_html_e( 'Re-optimize already processed images', 'neo-pulse-wp' ); ?></span>
			</label>
		</div>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'Stats', 'neo-pulse-wp' ); ?></strong></p>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: count optimized, 2: bytes saved, 3: webp count */
						__( '%1$d attachments optimized · %2$s saved · %3$d WebP files', 'neo-pulse-wp' ),
						(int) ( $stats['attachments_optimized'] ?? 0 ),
						size_format( (int) ( $stats['bytes_saved'] ?? 0 ) ),
						(int) ( $stats['webp_count'] ?? 0 )
					)
				);
				?>
			</p>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: %d: pending attachment count */
						__( '%d JPEG/PNG attachments not yet optimized.', 'neo-pulse-wp' ),
						$pending
					)
				);
				?>
			</p>
			<?php if ( ! empty( $stats['last_run'] ) ) : ?>
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: localized datetime */
							__( 'Last optimization: %s', 'neo-pulse-wp' ),
							wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $stats['last_run'] )
						)
					);
					?>
				</p>
			<?php endif; ?>
		</div>

		<div class="neo-pulse-wp-panel-footer">
			<div class="neo-pulse-wp-panel-footer__left">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_SPEED_IMAGE_META ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_SPEED_IMAGE_META, 'neo_pulse_wp_speed_images_flush_nonce' ); ?>
					<button type="submit" class="button" onclick="return confirm('<?php echo esc_js( __( 'Clear optimization metadata for all attachments? Sidecar files on disk are not deleted.', 'neo-pulse-wp' ) ); ?>');">
						<?php esc_html_e( 'Clear image optimization meta', 'neo-pulse-wp' ); ?>
					</button>
				</form>
			</div>
			<p class="neo-pulse-wp-settings__actions neo-pulse-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary neo-pulse-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'neo-pulse-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
		unset( $tab );
	}

	/**
	 * Enqueue bulk optimizer script on Speed → Images tab only.
	 *
	 * @param string $hook_suffix Admin hook.
	 */
	public static function enqueue_speed_images_assets( string $hook_suffix ): void {
		if ( 'neo-pulse-wp_page_neo_pulse-wp-speed' !== $hook_suffix ) {
			return;
		}
		$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( (string) $_GET['tab'] ) ) : 'general';
		if ( 'images' !== $tab ) {
			return;
		}

		$base = 'assets/admin/';
		$js   = NEO_PULSE_WP_PLUGIN_DIR . $base . 'admin-speed-images.js';
		$ver  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.9.0';
		if ( ! is_readable( $js ) ) {
			return;
		}

		wp_enqueue_script(
			'neo-pulse-wp-admin-speed-images',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $base . 'admin-speed-images.js',
			array(),
			$ver . '.' . (string) filemtime( $js ),
			true
		);
		wp_localize_script(
			'neo-pulse-wp-admin-speed-images',
			'neoPulseWpSpeedImages',
			array(
				'root'    => esc_url_raw( rest_url( 'neo-pulse/v1/speed/images' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'perPage' => 5,
				'strings' => array(
					'running'  => __( 'Optimizing batch…', 'neo-pulse-wp' ),
					'done'     => __( 'Bulk optimization complete.', 'neo-pulse-wp' ),
					'error'    => __( 'Batch request failed.', 'neo-pulse-wp' ),
					'disabled' => __( 'Enable image optimization and save settings first.', 'neo-pulse-wp' ),
				),
			)
		);
	}
}

<?php
/**
 * Speed module wp-admin settings page (shared panel shell).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Speed {

	/**
	 * @return array<int, string>
	 */
	private static function speed_tab_keys(): array {
		return array( 'general', 'images' );
	}

	public static function render_speed_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Speed settings.', 'flowbie-wp' ) );
		}

		if ( class_exists( 'Flowbie_Wp_Speed_Warm', false ) ) {
			Flowbie_Wp_Speed_Warm::maybe_auto_warm();
		}

		$config    = Flowbie_Wp_Speed_Settings::get_config();
		$stats     = Flowbie_Wp_Speed_Cache::stats();
		$conflicts = Flowbie_Wp_Speed_Settings::conflicting_plugins();
		$enabled   = ! empty( $config['enabled'] );

		$tab = self::panel_active_tab( 'general' );
		if ( ! in_array( $tab, self::speed_tab_keys(), true ) ) {
			$tab = 'general';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Speed', 'flowbie-wp' ),
				'tabs'    => array(
					'general' => __( 'Speed', 'flowbie-wp' ),
					'images'  => __( 'Images', 'flowbie-wp' ),
				),
			),
		);

		self::flowbie_group_shell_open( 'flowbie-wp-speed', 'flowbie-wp-speed flowbie-wp-panel-page' );

		if ( ! empty( $conflicts ) && $enabled && 'images' !== $tab ) : ?>
			<div class="notice notice-warning flowbie-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These plugins may conflict with Flowbie Speed: %s. Deactivate their CSS/JS optimization to avoid double-processing.', 'flowbie-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif;

		self::panel_layout_start( 'flowbie-wp-speed', $nav_groups, $tab, __( 'Speed settings sections', 'flowbie-wp' ) );
		if ( 'images' === $tab ) {
			self::render_speed_section_images( $tab );
		} else {
			self::render_speed_section_general( $config, $stats, $tab );
		}
		self::panel_layout_end();

		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string, mixed>                            $config Config.
	 * @param array{file_count: int, bytes: int, last_flush: int} $stats  Cache stats.
	 * @param string                                            $tab    Active tab.
	 */
	private static function render_speed_section_general( array $config, array $stats, string $tab ): void {
		$form_id = 'flowbie-speed-settings-form-general';
		?>
		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_speed_enabled',
				__( 'Enable Speed for visitors', 'flowbie-wp' ),
				! empty( $config['enabled'] )
			);
			self::panel_form_toggle(
				'flowbie_speed_skip_logged_in',
				__( 'Disable Speed for admins (logged in)', 'flowbie-wp' ),
				! empty( $config['skip_logged_in'] )
			);
			self::panel_form_group_close();
			?>
		</form>

		<div class="flowbie-wp-panel-info-box">
			<strong><?php esc_html_e( 'Disk cache', 'flowbie-wp' ); ?></strong>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: file count, 2: formatted size */
						__( 'Flowbie speed files on disk: %1$d (%2$s).', 'flowbie-wp' ),
						(int) $stats['file_count'],
						size_format( (int) $stats['bytes'] )
					)
				);
				?>
			</p>
			<?php if ( ! empty( $config['enabled'] ) ) : ?>
				<p class="flowbie-field__note">
					<?php esc_html_e( 'Minified CSS/JS are written automatically when Speed is on (on save and when this page loads if the folder is empty). Real visitors also refresh files as they browse.', 'flowbie-wp' ); ?>
				</p>
			<?php endif; ?>
		</div>

		<?php self::render_speed_diagnostics_panel( $config ); ?>

		<div class="flowbie-wp-panel-footer">
			<div class="flowbie-wp-panel-footer__left">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_ALL_WORDPRESS ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_ALL_WORDPRESS, 'flowbie_wp_flush_all_wordpress_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Flush all WordPress + Flowbie caches', 'flowbie-wp' ); ?></button>
				</form>
				<p class="flowbie-field__note">
					<?php esc_html_e( 'Flush clears minified files on disk; they are rebuilt automatically on the next save or page load.', 'flowbie-wp' ); ?>
				</p>
			</div>
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
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
		$form_id = 'flowbie-speed-settings-form-css';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'CSS', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'Minify and optionally combine local stylesheets.', 'flowbie-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' ); ?>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_optimize_css" value="1" <?php checked( ! empty( $config['optimize_css'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Minify CSS files', 'flowbie-wp' ); ?></span>
				</label>
			</section>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_aggregate_css" value="1" <?php checked( ! empty( $config['aggregate_css'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Combine CSS into one file', 'flowbie-wp' ); ?></span>
				</label>
				<?php if ( ! empty( $config['aggregate_css'] ) ) : ?>
					<p class="description">
						<?php esc_html_e( 'Combining CSS can break complex themes (Elementor, custom dark layouts). If guests see a broken layout while admins do not, disable this option and flush the cache.', 'flowbie-wp' ); ?>
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
		$form_id = 'flowbie-speed-settings-form-javascript';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'JavaScript', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'Minify, combine, and defer local scripts. Flowbie chat and voice scripts stay excluded by default.', 'flowbie-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' ); ?>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_optimize_js" value="1" <?php checked( ! empty( $config['optimize_js'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Minify JS files', 'flowbie-wp' ); ?></span>
				</label>
			</section>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_aggregate_js" value="1" <?php checked( ! empty( $config['aggregate_js'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Combine JS into one file', 'flowbie-wp' ); ?></span>
				</label>
			</section>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_defer_js" value="1" <?php checked( ! empty( $config['defer_js'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Defer non-excluded scripts', 'flowbie-wp' ); ?></span>
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
		$form_id = 'flowbie-speed-settings-form-html';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'HTML & assets', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'HTML minification and static asset URL cleanup.', 'flowbie-wp' ); ?></p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' ); ?>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_minify_html" value="1" <?php checked( ! empty( $config['minify_html'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Minify HTML output', 'flowbie-wp' ); ?></span>
				</label>
			</section>

			<section class="flowbie-wp-settings__card">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_remove_query_strings" value="1" <?php checked( ! empty( $config['remove_query_strings'] ) ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Remove ?ver= query strings from local CSS/JS URLs', 'flowbie-wp' ); ?></span>
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
		$form_id = 'flowbie-speed-settings-form-excludes';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Excludes', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'One pattern per line, matched against asset URLs. Flowbie chat, search, and voice scripts are excluded by default.', 'flowbie-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED ); ?>" />
			<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED, 'flowbie_wp_speed_nonce' ); ?>

			<section class="flowbie-wp-settings__card">
				<div class="flowbie-wp-settings__field">
					<label class="flowbie-wp-settings__label" for="flowbie_speed_js_exclude"><?php esc_html_e( 'Exclude JS', 'flowbie-wp' ); ?></label>
					<textarea
						class="flowbie-wp-settings__input widefat"
						name="flowbie_speed_js_exclude"
						id="flowbie_speed_js_exclude"
						rows="4"
						spellcheck="false"
					><?php echo esc_textarea( (string) ( $config['js_exclude'] ?? '' ) ); ?></textarea>
				</div>
			</section>

			<section class="flowbie-wp-settings__card">
				<div class="flowbie-wp-settings__field">
					<label class="flowbie-wp-settings__label" for="flowbie_speed_css_exclude"><?php esc_html_e( 'Exclude CSS', 'flowbie-wp' ); ?></label>
					<textarea
						class="flowbie-wp-settings__input widefat"
						name="flowbie_speed_css_exclude"
						id="flowbie_speed_css_exclude"
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
		$diag     = Flowbie_Wp_Speed_Diagnostics::status( $config );
		$diag_url = add_query_arg(
			array(
				'flowbie_speed_debug' => '1',
				'nocache'             => '1',
			),
			home_url( '/' )
		);
		?>
		<div class="flowbie-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'What actually runs right now', 'flowbie-wp' ); ?></strong></p>
			<ul class="flowbie-wp-panel-info-box__list">
				<?php foreach ( Flowbie_Wp_Speed_Diagnostics::admin_summary_lines( $diag ) as $line ) : ?>
					<li><?php echo esc_html( $line ); ?></li>
				<?php endforeach; ?>
			</ul>
			<p class="flowbie-field__note">
				<?php esc_html_e( 'While logged into wp-admin, Speed does not change pages you browse—but disk cache is built automatically in the background when Speed is enabled.', 'flowbie-wp' ); ?>
			</p>
			<p class="flowbie-field__note">
				<a href="<?php echo esc_url( $diag_url ); ?>" target="_blank" rel="noopener noreferrer">
					<?php esc_html_e( 'Open homepage with debug marker (view source near bottom)', 'flowbie-wp' ); ?>
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
		if ( ! defined( 'ELEMENTOR_VERSION' ) || ! class_exists( 'Flowbie_Wp_Elementor_Site_Recovery', false ) ) {
			return;
		}

		$diag       = Flowbie_Wp_Elementor_Site_Recovery::get_diagnostics();
		$nocache_url = add_query_arg( 'nocache', '1', home_url( '/' ) );
		$tab        = self::panel_active_tab( 'general' );
		?>
		<div class="flowbie-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'Elementor install side effects', 'flowbie-wp' ); ?></strong></p>
			<ul class="flowbie-wp-panel-info-box__list">
				<li>
					<?php
					echo esc_html(
						! empty( $diag['elementor_cache_fix_ran'] )
							? __( 'Silent Elementor migration has run on this site.', 'flowbie-wp' )
							: __( 'Silent Elementor migration has not run.', 'flowbie-wp' )
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						! empty( $diag['speed_enabled'] )
							? __( 'Speed is enabled.', 'flowbie-wp' )
							: __( 'Speed is disabled.', 'flowbie-wp' )
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %d: document count */
							__( 'Elementor documents with Flowbie dynamic tags: %d', 'flowbie-wp' ),
							(int) ( $diag['flowbie_tag_documents'] ?? 0 )
						)
					);
					?>
				</li>
				<li>
					<?php
					echo esc_html(
						! empty( $diag['fields_ready'] )
							? __( 'Fields are configured for tag migration.', 'flowbie-wp' )
							: __( 'Fields are not configured for tag migration.', 'flowbie-wp' )
					);
					?>
				</li>
			</ul>
			<?php if ( ! empty( $diag['flowbie_tag_samples'] ) && is_array( $diag['flowbie_tag_samples'] ) ) : ?>
				<p><strong><?php esc_html_e( 'Sample templates with Flowbie tags', 'flowbie-wp' ); ?></strong></p>
				<ul class="flowbie-wp-panel-info-box__list">
					<?php foreach ( $diag['flowbie_tag_samples'] as $sample ) : ?>
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
			<p class="flowbie-field__note">
				<?php esc_html_e( 'If carousels repeat or logos broke after installing flowbie-wp, disable Speed, run recovery, then test in a private window.', 'flowbie-wp' ); ?>
				<a href="<?php echo esc_url( $nocache_url ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open homepage without Speed (?nocache=1)', 'flowbie-wp' ); ?></a>
			</p>
			<div class="flowbie-wp-panel-footer__left" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_RECOVER_ELEMENTOR_SITE ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_RECOVER_ELEMENTOR_SITE, 'flowbie_wp_recover_elementor_nonce' ); ?>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Recover Elementor (disable Speed + revert tags)', 'flowbie-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_RUN_ELEMENTOR_MIGRATION ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_RUN_ELEMENTOR_MIGRATION, 'flowbie_wp_run_elementor_migration_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Run Elementor tag migration (opt-in)', 'flowbie-wp' ); ?></button>
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
		$config = Flowbie_Wp_Speed_Settings::get_config();
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Cache', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Optimized files are stored under wp-content/cache/flowbie-speed/.', 'flowbie-wp' ); ?>
		</p>

		<?php self::render_speed_diagnostics_panel( $config ); ?>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<strong><?php esc_html_e( 'Cached assets', 'flowbie-wp' ); ?></strong>
			</p>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: file count, 2: formatted size */
						__( '%1$d files (%2$s)', 'flowbie-wp' ),
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
							__( 'Last cleared: %s', 'flowbie-wp' ),
							wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $stats['last_flush'] )
						)
					);
					?>
				</p>
			<?php endif; ?>
		</div>

		<div class="flowbie-wp-panel-info-box" style="margin-top:16px;">
			<p><strong><?php esc_html_e( 'Import & presets', 'flowbie-wp' ); ?></strong></p>
			<p class="description">
				<?php esc_html_e( 'Elementor-safe turns off all Speed transforms (combine, defer, minify). With that preset, Speed does not change HTML at all. Test broken pages in a private/incognito window — while logged in, "Skip optimization for logged-in users" means Speed is already off for you.', 'flowbie-wp' ); ?>
			</p>
			<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_APPLY_SPEED_PRESET ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<input type="hidden" name="flowbie_speed_preset" value="<?php echo esc_attr( Flowbie_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE ); ?>" />
					<?php wp_nonce_field( self::ACTION_APPLY_SPEED_PRESET, 'flowbie_wp_apply_speed_preset_nonce' ); ?>
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Apply Elementor-safe preset', 'flowbie-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_APPLY_SPEED_PRESET ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<input type="hidden" name="flowbie_speed_preset" value="<?php echo esc_attr( Flowbie_Wp_Speed_Import::PRESET_DISABLE ); ?>" />
					<?php wp_nonce_field( self::ACTION_APPLY_SPEED_PRESET, 'flowbie_wp_apply_speed_preset_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Disable Speed (diagnostic)', 'flowbie-wp' ); ?></button>
				</form>
			</div>
			<p class="description">
				<?php esc_html_e( 'Or download the preset JSON and import it on another site.', 'flowbie-wp' ); ?>
				<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_DOWNLOAD_SPEED_PRESET . '&flowbie_speed_preset=' . Flowbie_Wp_Speed_Import::PRESET_ELEMENTOR_SAFE ), self::ACTION_DOWNLOAD_SPEED_PRESET, 'flowbie_wp_download_speed_preset_nonce' ) ); ?>">
					<?php esc_html_e( 'Download preset JSON', 'flowbie-wp' ); ?>
				</a>
			</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data" class="flowbie-wp-settings__form" style="margin-top:12px;">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SPEED_SETTINGS ); ?>" />
				<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
				<?php wp_nonce_field( self::ACTION_IMPORT_SPEED_SETTINGS, 'flowbie_wp_import_speed_settings_nonce' ); ?>
				<p>
					<label for="flowbie_speed_settings_json"><strong><?php esc_html_e( 'Import from JSON file', 'flowbie-wp' ); ?></strong></label><br />
					<input type="file" name="flowbie_speed_settings_json" id="flowbie_speed_settings_json" accept=".json,application/json" required />
				</p>
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_import_speed" value="1" checked="checked" />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Import Speed settings', 'flowbie-wp' ); ?></span>
				</label>
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_import_images" value="1" checked="checked" />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Import Speed Images settings', 'flowbie-wp' ); ?></span>
				</label>
				<p style="margin-top:8px;">
					<button type="submit" class="button button-secondary"><?php esc_html_e( 'Import settings (JSON)', 'flowbie-wp' ); ?></button>
				</p>
			</form>
		</div>

		<p class="description" style="margin-top:12px;">
			<?php esc_html_e( 'Export downloads your current Speed and Speed Images settings as JSON (no API secrets).', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-footer">
			<div class="flowbie-wp-panel-footer__left" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_SPEED ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_SPEED, 'flowbie_wp_speed_flush_nonce' ); ?>
					<button type="submit" class="button"><?php esc_html_e( 'Clear optimized assets', 'flowbie-wp' ); ?></button>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_SPEED_SETTINGS ); ?>" />
					<input type="hidden" name="flowbie_speed_tab" value="<?php echo esc_attr( $tab ); ?>" />
					<?php wp_nonce_field( self::ACTION_EXPORT_SPEED_SETTINGS, 'flowbie_wp_export_speed_settings_nonce' ); ?>
					<button type="submit" class="button button-secondary"><?php esc_html_e( 'Export settings (JSON)', 'flowbie-wp' ); ?></button>
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
		<div class="flowbie-wp-panel-footer">
			<div class="flowbie-wp-panel-footer__left"></div>
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	/**
	 * @param string $tab Active tab.
	 */
	private static function render_speed_section_images( string $tab ): void {
		$config        = Flowbie_Wp_Speed_Image_Settings::get_config();
		$stats         = Flowbie_Wp_Speed_Image_Stats::get();
		$conflicts     = Flowbie_Wp_Speed_Image_Settings::conflicting_plugins();
		$enabled       = ! empty( $config['enabled'] );
		$supports_webp = Flowbie_Wp_Speed_Image_Settings::supports_webp_editor();
		$pending       = Flowbie_Wp_Speed_Image_Optimizer::count_pending( false );
		$form_id       = 'flowbie-speed-settings-form-images';
		?>
		<?php if ( ! empty( $conflicts ) && $enabled ) : ?>
			<div class="notice notice-warning flowbie-wp-acf-shell-notice">
				<p>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: comma-separated plugin names */
							__( 'These image optimizer plugins may conflict with Flowbie Speed → Images: %s. Disable them to avoid double-processing.', 'flowbie-wp' ),
							implode( ', ', $conflicts )
						)
					);
					?>
				</p>
			</div>
		<?php endif; ?>

		<?php if ( ! $supports_webp ) : ?>
			<div class="notice notice-info flowbie-wp-acf-shell-notice">
				<p><?php esc_html_e( 'This server cannot generate WebP with the WordPress image editor (Imagick/GD). WebP options are disabled until support is available.', 'flowbie-wp' ); ?></p>
			</div>
		<?php endif; ?>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SPEED_IMAGES ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_SPEED_IMAGES, 'flowbie_wp_speed_images_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_speed_image_enabled',
				__( 'Enable image optimization', 'flowbie-wp' ),
				$enabled
			);
			self::panel_form_toggle(
				'flowbie_speed_image_auto_on_upload',
				__( 'Optimize new uploads automatically', 'flowbie-wp' ),
				! empty( $config['auto_on_upload'] )
			);
			self::panel_form_group_close();

			self::panel_form_group_open();
			self::panel_form_field_input(
				'flowbie_speed_image_jpeg_quality',
				'flowbie_speed_image_jpeg_quality',
				__( 'JPEG quality (1–100)', 'flowbie-wp' ),
				(string) (int) $config['jpeg_quality'],
				'half',
				'number',
				false,
				'',
				' min="1" max="100"'
			);
			self::panel_form_field_input(
				'flowbie_speed_image_png_compression',
				'flowbie_speed_image_png_compression',
				__( 'PNG compression (0–9)', 'flowbie-wp' ),
				(string) (int) $config['png_compression'],
				'half',
				'number',
				false,
				'',
				' min="0" max="9"'
			);
			self::panel_form_field_input(
				'flowbie_speed_image_max_width',
				'flowbie_speed_image_max_width',
				__( 'Max width (0 = no resize)', 'flowbie-wp' ),
				(string) (int) $config['max_width'],
				'half',
				'number',
				false,
				'',
				' min="0" max="10000"'
			);
			self::panel_form_field_input(
				'flowbie_speed_image_max_height',
				'flowbie_speed_image_max_height',
				__( 'Max height (0 = no resize)', 'flowbie-wp' ),
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
			<div class="flowbie-schema-cell flowbie-schema-cell--half">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_image_generate_webp" value="1" <?php checked( ! empty( $config['generate_webp'] ) ); ?> <?php disabled( ! $supports_webp ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Generate WebP sidecars', 'flowbie-wp' ); ?></span>
				</label>
			</div>
			<div class="flowbie-schema-cell flowbie-schema-cell--half">
				<label class="flowbie-wp-panel-toggle">
					<input type="checkbox" name="flowbie_speed_image_serve_webp" value="1" <?php checked( ! empty( $config['serve_webp'] ) ); ?> <?php disabled( ! $supports_webp ); ?> />
					<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Serve WebP to supporting browsers', 'flowbie-wp' ); ?></span>
				</label>
			</div>
			<?php
			self::panel_form_group_close();

			self::panel_form_group_open();
			self::panel_form_field_input(
				'flowbie_speed_image_max_file_mb',
				'flowbie_speed_image_max_file_mb',
				__( 'Skip files larger than (MB)', 'flowbie-wp' ),
				(string) (int) $config['max_file_mb'],
				'half',
				'number',
				false,
				'',
				' min="1" max="100"'
			);
			self::panel_form_field_textarea(
				'flowbie_speed_image_skip_mimes',
				'flowbie_speed_image_skip_mimes',
				__( 'Skip MIME types (one per line)', 'flowbie-wp' ),
				(string) ( $config['skip_mimes'] ?? '' ),
				'full',
				3
			);
			?>
			<input type="hidden" name="flowbie_speed_image_optimize_sizes" value="full" />
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<p class="flowbie-field__note"><?php esc_html_e( 'v1 optimizes the full-size upload only. Thumbnail sizes will be added in a future release.', 'flowbie-wp' ); ?></p>
			</div>
			<?php
			self::panel_form_group_close();
			?>
		</form>

		<div class="flowbie-wp-panel-info-box">
			<p><strong><?php esc_html_e( 'Bulk optimize library', 'flowbie-wp' ); ?></strong></p>
			<div id="flowbie-speed-images-bulk" role="status" data-pending="<?php echo esc_attr( (string) $pending ); ?>">
				<p class="flowbie-speed-images-bulk__status"><?php esc_html_e( 'Ready.', 'flowbie-wp' ); ?></p>
				<progress class="flowbie-speed-images-bulk__bar" value="0" max="100"></progress>
			</div>
			<p>
				<button type="button" class="button" id="flowbie-speed-images-bulk-start" <?php disabled( ! $enabled ); ?>>
					<?php esc_html_e( 'Optimize library', 'flowbie-wp' ); ?>
				</button>
			</p>
			<label class="flowbie-wp-panel-toggle">
				<input type="checkbox" id="flowbie-speed-images-bulk-force" />
				<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Re-optimize already processed images', 'flowbie-wp' ); ?></span>
			</label>
		</div>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p><strong><?php esc_html_e( 'Stats', 'flowbie-wp' ); ?></strong></p>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: count optimized, 2: bytes saved, 3: webp count */
						__( '%1$d attachments optimized · %2$s saved · %3$d WebP files', 'flowbie-wp' ),
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
						__( '%d JPEG/PNG attachments not yet optimized.', 'flowbie-wp' ),
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
							__( 'Last optimization: %s', 'flowbie-wp' ),
							wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $stats['last_run'] )
						)
					);
					?>
				</p>
			<?php endif; ?>
		</div>

		<div class="flowbie-wp-panel-footer">
			<div class="flowbie-wp-panel-footer__left">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-panel-inline-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_FLUSH_SPEED_IMAGE_META ); ?>" />
					<?php wp_nonce_field( self::ACTION_FLUSH_SPEED_IMAGE_META, 'flowbie_wp_speed_images_flush_nonce' ); ?>
					<button type="submit" class="button" onclick="return confirm('<?php echo esc_js( __( 'Clear optimization metadata for all attachments? Sidecar files on disk are not deleted.', 'flowbie-wp' ) ); ?>');">
						<?php esc_html_e( 'Clear image optimization meta', 'flowbie-wp' ); ?>
					</button>
				</form>
			</div>
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
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
		if ( 'flowbie-wp_page_flowbie-wp-speed' !== $hook_suffix ) {
			return;
		}
		$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( (string) $_GET['tab'] ) ) : 'general';
		if ( 'images' !== $tab ) {
			return;
		}

		$base = 'assets/admin/';
		$js   = FLOWBIE_WP_PLUGIN_DIR . $base . 'admin-speed-images.js';
		$ver  = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.9.0';
		if ( ! is_readable( $js ) ) {
			return;
		}

		wp_enqueue_script(
			'flowbie-wp-admin-speed-images',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $base . 'admin-speed-images.js',
			array(),
			$ver . '.' . (string) filemtime( $js ),
			true
		);
		wp_localize_script(
			'flowbie-wp-admin-speed-images',
			'flowbieWpSpeedImages',
			array(
				'root'    => esc_url_raw( rest_url( 'flowbie/v1/speed/images' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'perPage' => 5,
				'strings' => array(
					'running'  => __( 'Optimizing batch…', 'flowbie-wp' ),
					'done'     => __( 'Bulk optimization complete.', 'flowbie-wp' ),
					'error'    => __( 'Batch request failed.', 'flowbie-wp' ),
					'disabled' => __( 'Enable image optimization and save settings first.', 'flowbie-wp' ),
				),
			)
		);
	}
}

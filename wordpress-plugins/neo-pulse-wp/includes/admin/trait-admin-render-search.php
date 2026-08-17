<?php
/**
 * Search panel: tabbed admin UI for AI search settings.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Search {

	public static function render_search_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings = Neo_Pulse_Wp_Search::get_search_settings();

		$tab = self::panel_active_tab( 'general' );
		if ( ! in_array( $tab, array( 'general', 'appearance', 'shortcode' ), true ) ) {
			$tab = 'general';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Search', 'neo-pulse-wp' ),
				'tabs'    => array(
					'general'    => __( 'General', 'neo-pulse-wp' ),
					'appearance' => __( 'Appearance', 'neo-pulse-wp' ),
					'shortcode'  => __( 'Shortcode', 'neo-pulse-wp' ),
				),
			),
		);
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-search', 'neo-pulse-wp-search neo-pulse-wp-panel-page' );

		self::render_search_live_demo( $settings );

		self::panel_layout_start( 'neo-pulse-wp-search', $nav_groups, $tab, __( 'Search sections', 'neo-pulse-wp' ) );
		switch ( $tab ) {
			case 'appearance':
				self::render_search_section_appearance( $settings );
				break;
			case 'shortcode':
				self::render_search_section_shortcode();
				break;
			default:
				self::render_search_section_general( $settings );
				break;
		}
		self::panel_layout_end();

		self::neo_pulse_group_shell_close();
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_section_general( array $settings ): void {
		$form_id        = 'neo-pulse-wp-search-general-form';
		$openrouter_ok  = Neo_Pulse_Wp_OpenRouter::get_api_key() !== '';
		$all_post_types = get_post_types( array( 'public' => true ), 'objects' );
		$selected_types = (array) $settings['post_types'];
		$type_labels    = isset( $settings['content_type_labels'] ) && is_array( $settings['content_type_labels'] )
			? $settings['content_type_labels']
			: array();
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'General', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Configure how the search bar behaves and which content it searches.', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $openrouter_ok ) {
					esc_html_e( 'OpenRouter AI: connected. Searches will include AI-powered relevance ranking.', 'neo-pulse-wp' );
				} else {
					esc_html_e( 'OpenRouter AI: not configured. Search will work but without AI relevance ranking. Configure it under Settings → Editor AI.', 'neo-pulse-wp' );
				}
				?>
			</p>
			<p class="neo-pulse-field__note">
				<?php esc_html_e( 'Ranking favors Pages and Service Area URLs over blog posts. Include the Service Area post type below if you use location pages.', 'neo-pulse-wp' ); ?>
			</p>
			<p class="neo-pulse-field__note">
				<?php esc_html_e( 'Automatic front-page search is off by default. When enabled, it appears below your Elementor header on the homepage only. Logged-in users bypass NEO Pulse Speed and WP Engine page cache — test in a private window after changes. Purge WP Engine cache for the homepage if guests still see an old search bar.', 'neo-pulse-wp' ); ?>
			</p>
		</div>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SEARCH ); ?>" />
			<input type="hidden" name="neo-pulse_search_tab" value="general" />
			<?php wp_nonce_field( self::ACTION_SAVE_SEARCH, 'neo_pulse_wp_search_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'neo-pulse_search[auto_front_page]',
				__( 'Show hero search on the front page automatically', 'neo-pulse-wp' ),
				! empty( $settings['auto_front_page'] ),
				__( 'Leave off if you use the shortcode in Elementor or do not want a search bar on the homepage. Only one source: this setting or the shortcode, not both.', 'neo-pulse-wp' )
			);
			self::panel_form_field_input(
				'neo-pulse-search-placeholder',
				'neo-pulse_search[placeholder]',
				__( 'Placeholder text', 'neo-pulse-wp' ),
				(string) $settings['placeholder'],
				'half'
			);
			self::panel_form_field_input(
				'neo-pulse-search-button-label',
				'neo-pulse_search[button_label]',
				__( 'Button label', 'neo-pulse-wp' ),
				(string) $settings['button_label'],
				'half'
			);
			self::panel_form_field_input(
				'neo-pulse-search-max-results',
				'neo-pulse_search[max_results]',
				__( 'Max results', 'neo-pulse-wp' ),
				(string) $settings['max_results'],
				'half',
				'number',
				false,
				__( 'Number of results to show (1–20).', 'neo-pulse-wp' ),
				' min="1" max="20"'
			);
			?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<fieldset class="neo-pulse-field neo-pulse-field--stacked neo-pulse-search-fieldset">
					<legend class="neo-pulse-field__label neo-pulse-field__label--above"><?php esc_html_e( 'Post types to search', 'neo-pulse-wp' ); ?></legend>
					<?php foreach ( $all_post_types as $pt ) : ?>
						<?php if ( $pt->name === 'attachment' ) continue; ?>
						<label class="neo-pulse-wp-panel-toggle neo-pulse-search-post-type-toggle">
							<input
								type="checkbox"
								name="neo-pulse_search[post_types][]"
								value="<?php echo esc_attr( $pt->name ); ?>"
								<?php checked( in_array( $pt->name, $selected_types, true ) ); ?>
							/>
							<span class="neo-pulse-wp-panel-toggle__label">
								<?php echo esc_html( $pt->labels->singular_name ); ?>
								<code><?php echo esc_html( $pt->name ); ?></code>
							</span>
						</label>
					<?php endforeach; ?>
				</fieldset>
			</div>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Content type labels', 'neo-pulse-wp' ); ?></h3>
				<div class="neo-pulse-schema-inline-grid">
					<?php foreach ( $all_post_types as $pt ) : ?>
						<?php if ( $pt->name === 'attachment' ) continue; ?>
						<?php
						$label_value = isset( $type_labels[ $pt->name ] )
							? (string) $type_labels[ $pt->name ]
							: Neo_Pulse_Wp_Search::default_content_type_label( $pt->name );
						?>
						<div class="neo-pulse-schema-inline-grid__cell">
							<?php
							self::panel_form_field_input(
								'neo-pulse-search-type-label-' . $pt->name,
								'neo-pulse_search[content_type_labels][' . $pt->name . ']',
								sprintf(
									/* translators: %s: WordPress post type singular name */
									__( '%s label', 'neo-pulse-wp' ),
									$pt->labels->singular_name
								),
								$label_value,
								'half'
							);
							?>
						</div>
					<?php endforeach; ?>
				</div>
			</div>
			<?php
			self::panel_form_group_close();
			?>
		</form>

		<?php
		self::panel_footer_save(
			'general',
			$form_id,
			self::ACTION_RESET_SEARCH,
			self::ACTION_RESET_SEARCH,
			'neo_pulse_wp_search_reset_nonce',
			'neo-pulse_search_tab'
		);
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_section_appearance( array $settings ): void {
		$form_id = 'neo-pulse-wp-search-appearance-form';
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Appearance', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Colors, visibility, and layout for Search. Shared with Chat unless you style this widget only.', 'neo-pulse-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="neo-pulse-wp-settings__form neo-pulse-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SEARCH ); ?>" />
			<input type="hidden" name="neo-pulse_search_tab" value="appearance" />
			<?php wp_nonce_field( self::ACTION_SAVE_SEARCH, 'neo_pulse_wp_search_nonce' ); ?>
			<?php self::render_ai_widget_design_fields( 'search' ); ?>
		</form>

		<?php
		self::panel_footer_save(
			'appearance',
			$form_id,
			self::ACTION_RESET_SEARCH,
			self::ACTION_RESET_SEARCH,
			'neo_pulse_wp_search_reset_nonce',
			'neo-pulse_search_tab'
		);
	}

	private static function render_search_section_shortcode(): void {
		?>
		<h2 class="neo-pulse-wp-panel-content__title"><?php esc_html_e( 'Shortcode & Elementor', 'neo-pulse-wp' ); ?></h2>
		<p class="neo-pulse-wp-panel-content__desc">
			<?php esc_html_e( 'Place the AI search bar on any page using the Elementor widget or the shortcode below.', 'neo-pulse-wp' ); ?>
		</p>

		<div class="neo-pulse-schema-form">
			<section class="neo-pulse-schema-group neo-pulse-search-info-section" aria-labelledby="neo-pulse-search-elementor-heading">
				<h3 id="neo-pulse-search-elementor-heading" class="neo-pulse-chat-settings-section__title"><?php esc_html_e( 'Elementor widget', 'neo-pulse-wp' ); ?></h3>
				<p>
					<?php esc_html_e( 'In the Elementor editor, open the widget panel and search for “NEO Pulse Search”, or browse Widgets → NEO Pulse. Drag it onto your layout, then customize layout, colors, and behavior per widget. Global defaults (post types, AI settings) stay under this Search screen.', 'neo-pulse-wp' ); ?>
				</p>
			</section>

			<section class="neo-pulse-schema-group">
				<div class="neo-pulse-schema-grid">
					<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
						<div class="neo-pulse-field neo-pulse-field--text neo-pulse-field--stacked">
							<label class="neo-pulse-field__label neo-pulse-field__label--above" for="neo-pulse-search-shortcode"><?php esc_html_e( 'Shortcode', 'neo-pulse-wp' ); ?></label>
							<div class="neo-pulse-wp-search-shortcode-box">
								<div class="neo-pulse-field neo-pulse-field--text neo-pulse-field--stacked">
									<input
										id="neo-pulse-search-shortcode"
										class="neo-pulse-field__control"
										type="text"
										value="[neo-pulse_search]"
										readonly
										onclick="this.select();"
									/>
								</div>
								<button type="button" class="button" onclick="navigator.clipboard.writeText('[neo-pulse_search]');this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500);">
									<?php esc_html_e( 'Copy', 'neo-pulse-wp' ); ?>
								</button>
							</div>
							<p class="neo-pulse-field__note">
								<?php esc_html_e( 'You can also use the shortcode in template files: do_shortcode( \'[neo-pulse_search]\' )', 'neo-pulse-wp' ); ?>
							</p>
						</div>
					</div>
				</div>
			</section>

			<section class="neo-pulse-schema-group neo-pulse-search-info-section" aria-labelledby="neo-pulse-search-preview-heading">
				<h3 id="neo-pulse-search-preview-heading" class="neo-pulse-chat-settings-section__title"><?php esc_html_e( 'How it works', 'neo-pulse-wp' ); ?></h3>
				<ol>
					<li><?php esc_html_e( 'A visitor types a query in the search bar.', 'neo-pulse-wp' ); ?></li>
					<li><?php esc_html_e( 'The query is sent to OpenRouter for AI sentiment and intent analysis.', 'neo-pulse-wp' ); ?></li>
					<li><?php esc_html_e( 'Simultaneously, WordPress searches posts and pages by relevance.', 'neo-pulse-wp' ); ?></li>
					<li><?php esc_html_e( 'Results are re-ranked using AI-derived keywords and intent, then displayed.', 'neo-pulse-wp' ); ?></li>
				</ol>
			</section>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_live_demo( array $settings ): void {
		$rest_url = esc_url( rest_url( Neo_Pulse_Wp_Search::REST_NAMESPACE . '/search' ) );
		$nonce    = wp_create_nonce( 'wp_rest' );
		$tokens   = Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'search' );
		$css_vars = Neo_Pulse_Wp_Ai_Widget_Design::build_search_css_vars( $tokens );

		$asset_ver = Neo_Pulse_Wp_Search::search_asset_version();

		wp_enqueue_style(
			'neo-pulse-search',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/search/neo-pulse-search.css',
			array(),
			$asset_ver
		);
		wp_enqueue_script(
			'neo-pulse-search',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/search/neo-pulse-search.js',
			array(),
			$asset_ver,
			true
		);
		?>
		<div class="neo-pulse-wp-search-demo">
			<p class="neo-pulse-wp-search-demo__label">
				<?php esc_html_e( 'Live preview — try it now', 'neo-pulse-wp' ); ?>
			</p>
			<?php
			echo Neo_Pulse_Wp_Search::render_search_markup(
				'neo-pulse-search-wrap',
				$css_vars,
				$rest_url,
				$nonce,
				$settings
			); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			?>
		</div>
		<?php
	}
}

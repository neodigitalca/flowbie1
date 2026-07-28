<?php
/**
 * Search panel: tabbed admin UI for AI search settings.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Search {

	public static function render_search_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings = Flowbie_Wp_Search::get_search_settings();

		$tab = self::panel_active_tab( 'general' );
		if ( ! in_array( $tab, array( 'general', 'appearance', 'shortcode' ), true ) ) {
			$tab = 'general';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Search', 'flowbie-wp' ),
				'tabs'    => array(
					'general'    => __( 'General', 'flowbie-wp' ),
					'appearance' => __( 'Appearance', 'flowbie-wp' ),
					'shortcode'  => __( 'Shortcode', 'flowbie-wp' ),
				),
			),
		);
		self::flowbie_group_shell_open( 'flowbie-wp-search', 'flowbie-wp-search flowbie-wp-panel-page' );

		self::render_search_live_demo( $settings );

		self::panel_layout_start( 'flowbie-wp-search', $nav_groups, $tab, __( 'Search sections', 'flowbie-wp' ) );
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

		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_section_general( array $settings ): void {
		$form_id        = 'flowbie-wp-search-general-form';
		$openrouter_ok  = Flowbie_Wp_OpenRouter::get_api_key() !== '';
		$all_post_types = get_post_types( array( 'public' => true ), 'objects' );
		$selected_types = (array) $settings['post_types'];
		$type_labels    = isset( $settings['content_type_labels'] ) && is_array( $settings['content_type_labels'] )
			? $settings['content_type_labels']
			: array();
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'General', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Configure how the search bar behaves and which content it searches.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( $openrouter_ok ) {
					esc_html_e( 'OpenRouter AI: connected. Searches will include AI-powered relevance ranking.', 'flowbie-wp' );
				} else {
					esc_html_e( 'OpenRouter AI: not configured. Search will work but without AI relevance ranking. Configure it under Settings → Editor AI.', 'flowbie-wp' );
				}
				?>
			</p>
			<p class="flowbie-field__note">
				<?php esc_html_e( 'Ranking favors Pages and Service Area URLs over blog posts. Include the Service Area post type below if you use location pages.', 'flowbie-wp' ); ?>
			</p>
			<p class="flowbie-field__note">
				<?php esc_html_e( 'Automatic front-page search is off by default. When enabled, it appears below your Elementor header on the homepage only. Logged-in users bypass Flowbie Speed and WP Engine page cache — test in a private window after changes. Purge WP Engine cache for the homepage if guests still see an old search bar.', 'flowbie-wp' ); ?>
			</p>
		</div>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SEARCH ); ?>" />
			<input type="hidden" name="flowbie_search_tab" value="general" />
			<?php wp_nonce_field( self::ACTION_SAVE_SEARCH, 'flowbie_wp_search_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_search[auto_front_page]',
				__( 'Show hero search on the front page automatically', 'flowbie-wp' ),
				! empty( $settings['auto_front_page'] ),
				__( 'Leave off if you use the shortcode in Elementor or do not want a search bar on the homepage. Only one source: this setting or the shortcode, not both.', 'flowbie-wp' )
			);
			self::panel_form_field_input(
				'flowbie-search-placeholder',
				'flowbie_search[placeholder]',
				__( 'Placeholder text', 'flowbie-wp' ),
				(string) $settings['placeholder'],
				'half'
			);
			self::panel_form_field_input(
				'flowbie-search-button-label',
				'flowbie_search[button_label]',
				__( 'Button label', 'flowbie-wp' ),
				(string) $settings['button_label'],
				'half'
			);
			self::panel_form_field_input(
				'flowbie-search-max-results',
				'flowbie_search[max_results]',
				__( 'Max results', 'flowbie-wp' ),
				(string) $settings['max_results'],
				'half',
				'number',
				false,
				__( 'Number of results to show (1–20).', 'flowbie-wp' ),
				' min="1" max="20"'
			);
			?>
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<fieldset class="flowbie-field flowbie-field--stacked flowbie-search-fieldset">
					<legend class="flowbie-field__label flowbie-field__label--above"><?php esc_html_e( 'Post types to search', 'flowbie-wp' ); ?></legend>
					<?php foreach ( $all_post_types as $pt ) : ?>
						<?php if ( $pt->name === 'attachment' ) continue; ?>
						<label class="flowbie-wp-panel-toggle flowbie-search-post-type-toggle">
							<input
								type="checkbox"
								name="flowbie_search[post_types][]"
								value="<?php echo esc_attr( $pt->name ); ?>"
								<?php checked( in_array( $pt->name, $selected_types, true ) ); ?>
							/>
							<span class="flowbie-wp-panel-toggle__label">
								<?php echo esc_html( $pt->labels->singular_name ); ?>
								<code><?php echo esc_html( $pt->name ); ?></code>
							</span>
						</label>
					<?php endforeach; ?>
				</fieldset>
			</div>
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Content type labels', 'flowbie-wp' ); ?></h3>
				<div class="flowbie-schema-inline-grid">
					<?php foreach ( $all_post_types as $pt ) : ?>
						<?php if ( $pt->name === 'attachment' ) continue; ?>
						<?php
						$label_value = isset( $type_labels[ $pt->name ] )
							? (string) $type_labels[ $pt->name ]
							: Flowbie_Wp_Search::default_content_type_label( $pt->name );
						?>
						<div class="flowbie-schema-inline-grid__cell">
							<?php
							self::panel_form_field_input(
								'flowbie-search-type-label-' . $pt->name,
								'flowbie_search[content_type_labels][' . $pt->name . ']',
								sprintf(
									/* translators: %s: WordPress post type singular name */
									__( '%s label', 'flowbie-wp' ),
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
			'flowbie_wp_search_reset_nonce',
			'flowbie_search_tab'
		);
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_section_appearance( array $settings ): void {
		$form_id = 'flowbie-wp-search-appearance-form';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Appearance', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Colors, visibility, and layout for Search. Shared with Chat unless you style this widget only.', 'flowbie-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SEARCH ); ?>" />
			<input type="hidden" name="flowbie_search_tab" value="appearance" />
			<?php wp_nonce_field( self::ACTION_SAVE_SEARCH, 'flowbie_wp_search_nonce' ); ?>
			<?php self::render_ai_widget_design_fields( 'search' ); ?>
		</form>

		<?php
		self::panel_footer_save(
			'appearance',
			$form_id,
			self::ACTION_RESET_SEARCH,
			self::ACTION_RESET_SEARCH,
			'flowbie_wp_search_reset_nonce',
			'flowbie_search_tab'
		);
	}

	private static function render_search_section_shortcode(): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Shortcode & Elementor', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Place the AI search bar on any page using the Elementor widget or the shortcode below.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-schema-form">
			<section class="flowbie-schema-group flowbie-search-info-section" aria-labelledby="flowbie-search-elementor-heading">
				<h3 id="flowbie-search-elementor-heading" class="flowbie-chat-settings-section__title"><?php esc_html_e( 'Elementor widget', 'flowbie-wp' ); ?></h3>
				<p>
					<?php esc_html_e( 'In the Elementor editor, open the widget panel and search for “Flowbie Search”, or browse Widgets → Flowbie. Drag it onto your layout, then customize layout, colors, and behavior per widget. Global defaults (post types, AI settings) stay under this Search screen.', 'flowbie-wp' ); ?>
				</p>
			</section>

			<section class="flowbie-schema-group">
				<div class="flowbie-schema-grid">
					<div class="flowbie-schema-cell flowbie-schema-cell--full">
						<div class="flowbie-field flowbie-field--text flowbie-field--stacked">
							<label class="flowbie-field__label flowbie-field__label--above" for="flowbie-search-shortcode"><?php esc_html_e( 'Shortcode', 'flowbie-wp' ); ?></label>
							<div class="flowbie-wp-search-shortcode-box">
								<div class="flowbie-field flowbie-field--text flowbie-field--stacked">
									<input
										id="flowbie-search-shortcode"
										class="flowbie-field__control"
										type="text"
										value="[flowbie_search]"
										readonly
										onclick="this.select();"
									/>
								</div>
								<button type="button" class="button" onclick="navigator.clipboard.writeText('[flowbie_search]');this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500);">
									<?php esc_html_e( 'Copy', 'flowbie-wp' ); ?>
								</button>
							</div>
							<p class="flowbie-field__note">
								<?php esc_html_e( 'You can also use the shortcode in template files: do_shortcode( \'[flowbie_search]\' )', 'flowbie-wp' ); ?>
							</p>
						</div>
					</div>
				</div>
			</section>

			<section class="flowbie-schema-group flowbie-search-info-section" aria-labelledby="flowbie-search-preview-heading">
				<h3 id="flowbie-search-preview-heading" class="flowbie-chat-settings-section__title"><?php esc_html_e( 'How it works', 'flowbie-wp' ); ?></h3>
				<ol>
					<li><?php esc_html_e( 'A visitor types a query in the search bar.', 'flowbie-wp' ); ?></li>
					<li><?php esc_html_e( 'The query is sent to OpenRouter for AI sentiment and intent analysis.', 'flowbie-wp' ); ?></li>
					<li><?php esc_html_e( 'Simultaneously, WordPress searches posts and pages by relevance.', 'flowbie-wp' ); ?></li>
					<li><?php esc_html_e( 'Results are re-ranked using AI-derived keywords and intent, then displayed.', 'flowbie-wp' ); ?></li>
				</ol>
			</section>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $settings Settings.
	 */
	private static function render_search_live_demo( array $settings ): void {
		$rest_url = esc_url( rest_url( Flowbie_Wp_Search::REST_NAMESPACE . '/search' ) );
		$nonce    = wp_create_nonce( 'wp_rest' );
		$tokens   = Flowbie_Wp_Ai_Widget_Design::resolve( 'search' );
		$css_vars = Flowbie_Wp_Ai_Widget_Design::build_search_css_vars( $tokens );

		$asset_ver = Flowbie_Wp_Search::search_asset_version();

		wp_enqueue_style(
			'flowbie-search',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/search/flowbie-search.css',
			array(),
			$asset_ver
		);
		wp_enqueue_script(
			'flowbie-search',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/search/flowbie-search.js',
			array(),
			$asset_ver,
			true
		);
		?>
		<div class="flowbie-wp-search-demo">
			<p class="flowbie-wp-search-demo__label">
				<?php esc_html_e( 'Live preview — try it now', 'flowbie-wp' ); ?>
			</p>
			<?php
			echo Flowbie_Wp_Search::render_search_markup(
				'flowbie-search-wrap',
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

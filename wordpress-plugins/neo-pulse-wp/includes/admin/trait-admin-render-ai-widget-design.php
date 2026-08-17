<?php
/**
 * Shared Design UI for Chat + Search widgets.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Ai_Widget_Design {

	/**
	 * Enqueue design field assets + live preview on Chat/Search screens.
	 */
	public static function enqueue_ai_widget_design_assets( string $hook_suffix ): void {
		$hooks = array(
			'neo-pulse-wp_page_neo_pulse-wp-chat',
			'neo-pulse-wp_page_neo_pulse-wp-search',
		);
		if ( ! in_array( $hook_suffix, $hooks, true ) ) {
			return;
		}

		$base = plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/admin/';
		$ver  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '1';

		$css = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/neo-pulse-color-field.css';
		if ( is_readable( $css ) ) {
			$ver_css = $ver . '.' . (string) filemtime( $css );
			wp_enqueue_style( 'neo-pulse-color-field', $base . 'neo-pulse-color-field.css', array(), $ver_css );
		}

		$js = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/neo-pulse-color-field.js';
		if ( is_readable( $js ) ) {
			$ver_js = $ver . '.' . (string) filemtime( $js );
			wp_enqueue_script( 'neo-pulse-color-field', $base . 'neo-pulse-color-field.js', array( 'jquery' ), $ver_js, true );
		}

		$preview = NEO_PULSE_WP_PLUGIN_DIR . 'assets/admin/neo-pulse-ai-widget-design-preview.js';
		if ( is_readable( $preview ) ) {
			$ver_p = $ver . '.' . (string) filemtime( $preview );
			wp_enqueue_script(
				'neo-pulse-ai-widget-design-preview',
				$base . 'neo-pulse-ai-widget-design-preview.js',
				array( 'jquery', 'neo-pulse-color-field' ),
				$ver_p,
				true
			);
			wp_localize_script(
				'neo-pulse-ai-widget-design-preview',
				'neo-pulseDesignPreview',
				array(
					'searchTokens' => Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'search' ),
					'chatTokens'   => Neo_Pulse_Wp_Ai_Widget_Design::resolve( 'chat' ),
				)
			);
		}
	}

	/**
	 * Render shared design form fields (inside an existing form).
	 *
	 * @param string              $widget 'chat' | 'search'
	 * @param array<string,mixed> $chat_settings Optional chat settings for voice/layout.
	 */
	protected static function render_ai_widget_design_fields( string $widget, array $chat_settings = array() ): void {
		$design   = Neo_Pulse_Wp_Ai_Widget_Design::get_settings();
		$scope    = $design['style_scope'];
		$source   = $design['color_source'];
		$tokens   = $source === 'custom'
			? Neo_Pulse_Wp_Ai_Widget_Design::editable_tokens( $widget )
			: Neo_Pulse_Wp_Ai_Widget_Design::resolve( $widget );
		$swatches = Neo_Pulse_Wp_Ai_Widget_Design::elementor_color_swatches();
		$ui_key   = $widget === 'search' ? 'search_ui' : 'chat_ui';
		$ui       = $design[ $ui_key ];
		$prefix   = 'neo-pulse_design';

		$source_class = $source === 'custom' ? 'neo-pulse-design--custom' : 'neo-pulse-design--site-branding';
		?>
		<div class="neo-pulse-ai-widget-design <?php echo esc_attr( $source_class ); ?>" data-neo-pulse-design-widget="<?php echo esc_attr( $widget ); ?>">
			<div class="neo-pulse-design-shell">

			<div class="neo-pulse-design-setup">
				<div class="neo-pulse-design-setup__col">
					<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Style scope', 'neo-pulse-wp' ); ?></h3>
					<label class="neo-pulse-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[style_scope]" value="both" data-neo-pulse-style-scope <?php checked( $scope, 'both' ); ?> />
						<span><?php esc_html_e( 'Style both Chat and Search together', 'neo-pulse-wp' ); ?></span>
					</label>
					<label class="neo-pulse-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[style_scope]" value="individual" data-neo-pulse-style-scope <?php checked( $scope, 'individual' ); ?> />
						<span><?php esc_html_e( 'Style this widget only', 'neo-pulse-wp' ); ?></span>
					</label>
					<label class="neo-pulse-design-check neo-pulse-design-apply-both" <?php echo $scope === 'individual' ? '' : 'hidden'; ?>>
						<input type="checkbox" name="<?php echo esc_attr( $prefix ); ?>[apply_to_both]" value="1" />
						<span><?php esc_html_e( 'Apply to both on save', 'neo-pulse-wp' ); ?></span>
					</label>
				</div>
				<div class="neo-pulse-design-setup__col">
					<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Color source', 'neo-pulse-wp' ); ?></h3>
					<label class="neo-pulse-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[color_source]" value="site_branding" data-neo-pulse-color-source <?php checked( $source, 'site_branding' ); ?> />
						<span><?php esc_html_e( 'Site Branding (Elementor)', 'neo-pulse-wp' ); ?></span>
					</label>
					<label class="neo-pulse-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[color_source]" value="custom" data-neo-pulse-color-source <?php checked( $source, 'custom' ); ?> />
						<span><?php esc_html_e( 'Custom colors', 'neo-pulse-wp' ); ?></span>
					</label>
				</div>
				<div class="neo-pulse-design-setup__kit">
					<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Elementor colors', 'neo-pulse-wp' ); ?></h3>
					<?php if ( ! empty( $swatches ) ) : ?>
						<div class="neo-pulse-design-kit-row">
							<div class="neo-pulse-elementor-swatches" role="list">
								<?php foreach ( $swatches as $sw ) : ?>
									<button
										type="button"
										class="neo-pulse-elementor-swatch"
										style="background:<?php echo esc_attr( $sw['color'] ); ?>"
										data-color="<?php echo esc_attr( $sw['color'] ); ?>"
										data-kit-id="<?php echo esc_attr( $sw['id'] ); ?>"
										title="<?php echo esc_attr( $sw['title'] . ' (' . $sw['color'] . ')' ); ?>"
									>
										<span class="neo-pulse-elementor-swatch__label"><?php echo esc_html( $sw['title'] ); ?></span>
									</button>
								<?php endforeach; ?>
							</div>
							<button type="button" class="button neo-pulse-design-apply-kit" data-neo-pulse-apply-kit="1">
								<?php esc_html_e( 'Apply kit to brand tokens', 'neo-pulse-wp' ); ?>
							</button>
						</div>
					<?php else : ?>
						<p class="neo-pulse-design-muted"><?php esc_html_e( 'No Elementor kit colors found. Site Branding uses the NEO Pulse light default palette.', 'neo-pulse-wp' ); ?></p>
					<?php endif; ?>
				</div>
			</div>

			<div class="neo-pulse-design-custom-colors">
				<?php
				$group_index = 0;
				foreach ( self::design_color_groups( $widget ) as $group_label => $keys ) :
					$open = $group_index === 0 ? ' open' : '';
					++$group_index;
					?>
					<details class="neo-pulse-design-group"<?php echo $open; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
						<summary class="neo-pulse-design-group__summary"><?php echo esc_html( $group_label ); ?></summary>
						<div class="neo-pulse-design-color-list">
							<?php foreach ( $keys as $key => $label ) : ?>
								<?php self::render_design_color_field( $prefix . '[tokens][' . $key . ']', $key, $label, (string) ( $tokens[ $key ] ?? '' ) ); ?>
							<?php endforeach; ?>
						</div>
					</details>
				<?php endforeach; ?>
			</div>

			<?php self::panel_form_group_open(); ?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Shape & type', 'neo-pulse-wp' ); ?></h3>
			</div>
			<?php
			self::panel_form_field_input(
				'neo-pulse-design-radius',
				$prefix . '[tokens][radius]',
				__( 'Border radius (px)', 'neo-pulse-wp' ),
				(string) (int) ( $tokens['radius'] ?? 8 ),
				'half',
				'number',
				false,
				'',
				' min="0" max="50"'
			);
			self::panel_form_field_input(
				'neo-pulse-design-font-size',
				$prefix . '[tokens][font_size]',
				__( 'Font size (min 1rem)', 'neo-pulse-wp' ),
				(string) (int) ( $tokens['font_size'] ?? 16 ),
				'half',
				'number',
				false,
				'',
				' min="16" max="24"'
			);
			if ( $widget === 'chat' ) {
				self::panel_form_field_input(
					'neo-pulse-design-launcher-size',
					$prefix . '[tokens][launcher_size]',
					__( 'Launcher size (px)', 'neo-pulse-wp' ),
					(string) (int) ( $tokens['launcher_size'] ?? 56 ),
					'half',
					'number',
					false,
					'',
					' min="40" max="80"'
				);
				self::panel_form_field_input(
					'neo-pulse-design-panel-width',
					$prefix . '[tokens][panel_width]',
					__( 'Panel width (px)', 'neo-pulse-wp' ),
					(string) (int) ( $tokens['panel_width'] ?? 380 ),
					'half',
					'number',
					false,
					'',
					' min="280" max="560"'
				);
				self::panel_form_field_input(
					'neo-pulse-design-offset-x',
					$prefix . '[tokens][offset_x]',
					__( 'Offset X (px)', 'neo-pulse-wp' ),
					(string) (int) ( $tokens['offset_x'] ?? 20 ),
					'half',
					'number',
					false,
					'',
					' min="0" max="120"'
				);
				self::panel_form_field_input(
					'neo-pulse-design-offset-y',
					$prefix . '[tokens][offset_y]',
					__( 'Offset Y (px)', 'neo-pulse-wp' ),
					(string) (int) ( $tokens['offset_y'] ?? 20 ),
					'half',
					'number',
					false,
					'',
					' min="0" max="120"'
				);
			}
			self::panel_form_group_close();

			$labels = $widget === 'search'
				? self::search_visibility_labels()
				: self::chat_visibility_labels();
			self::panel_form_group_open();
			?>
			<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
				<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Show / hide', 'neo-pulse-wp' ); ?></h3>
				<div class="neo-pulse-design-visibility-grid">
					<?php foreach ( $labels as $key => $label ) : ?>
						<label class="neo-pulse-design-check">
							<input
								type="checkbox"
								name="<?php echo esc_attr( $prefix . '[ui][' . $key . ']' ); ?>"
								value="1"
								data-neo-pulse-ui="<?php echo esc_attr( $key ); ?>"
								<?php checked( ! empty( $ui[ $key ] ) ); ?>
							/>
							<span><?php echo esc_html( $label ); ?></span>
						</label>
					<?php endforeach; ?>
				</div>
			</div>
			<?php
			self::panel_form_group_close();

			if ( $widget === 'chat' ) {
				self::render_chat_voice_design_fields( $chat_settings );
				self::render_chat_position_design_fields( $chat_settings );
			}
			if ( $widget === 'search' ) {
				self::render_search_sidebar_design_fields();
				self::render_search_insights_design_fields();
			}
			?>
			</div>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $chat_settings
	 */
	protected static function render_chat_voice_design_fields( array $chat_settings ): void {
		$checks = array(
			'neo_pulse_chat_voice_enabled'     => array( __( 'Enable voice chat', 'neo-pulse-wp' ), ! isset( $chat_settings['voice_enabled'] ) || ! empty( $chat_settings['voice_enabled'] ) ),
			'neo_pulse_chat_voice_ptt'         => array( __( 'Hold to speak (push-to-talk)', 'neo-pulse-wp' ), ! isset( $chat_settings['voice_ptt'] ) || ! empty( $chat_settings['voice_ptt'] ) ),
			'neo_pulse_chat_mic_replaces_send' => array( __( 'Mic replaces send when input empty', 'neo-pulse-wp' ), ! isset( $chat_settings['mic_replaces_send'] ) || ! empty( $chat_settings['mic_replaces_send'] ) ),
		);
		self::panel_form_group_open();
		?>
		<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
			<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Voice & mic', 'neo-pulse-wp' ); ?></h3>
			<div class="neo-pulse-design-visibility-grid neo-pulse-design-visibility-grid--2">
				<?php foreach ( $checks as $name => $row ) : ?>
					<label class="neo-pulse-design-check">
						<input type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( $row[1] ); ?> />
						<span><?php echo esc_html( $row[0] ); ?></span>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
		self::panel_form_group_close();
	}

	/**
	 * @param array<string,mixed> $chat_settings
	 */
	protected static function render_chat_position_design_fields( array $chat_settings ): void {
		self::panel_form_group_open();
		?>
		<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
			<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Sidebar panel', 'neo-pulse-wp' ); ?></h3>
		</div>
		<?php
		self::render_sidebar_design_fields( 'chat', 'neo-pulse_design[sidebar]', Neo_Pulse_Wp_Ai_Widget_Design::resolve_sidebar_config( 'chat', $chat_settings ) );
		self::panel_form_group_close();
	}

	/**
	 * Search global sidebar defaults (Appearance tab).
	 */
	protected static function render_search_sidebar_design_fields(): void {
		$sidebar = Neo_Pulse_Wp_Ai_Widget_Design::get_settings()['search_sidebar'];
		self::panel_form_group_open();
		?>
		<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
			<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Sidebar', 'neo-pulse-wp' ); ?></h3>
		</div>
		<?php
		self::render_sidebar_design_fields( 'search', 'neo-pulse_design[sidebar]', $sidebar );
		self::panel_form_group_close();
	}

	/**
	 * Search insights and usage tracking defaults.
	 */
	protected static function render_search_insights_design_fields(): void {
		$insights = Neo_Pulse_Wp_Ai_Widget_Design::get_settings()['search_insights'];
		self::panel_form_group_open();
		?>
		<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
			<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Insights', 'neo-pulse-wp' ); ?></h3>
			<div class="neo-pulse-design-visibility-grid neo-pulse-design-visibility-grid--2">
				<?php
				$checks = array(
					'show_popular_terms'          => __( 'Popular searches', 'neo-pulse-wp' ),
					'show_popular_pages_overseer' => __( 'General pages (Overseer)', 'neo-pulse-wp' ),
					'show_popular_pages_search'   => __( 'From search clicks', 'neo-pulse-wp' ),
				);
				foreach ( $checks as $key => $label ) :
					?>
					<label class="neo-pulse-design-check">
						<input type="checkbox" name="neo-pulse_design[insights][<?php echo esc_attr( $key ); ?>]" value="1" <?php checked( ! empty( $insights[ $key ] ) ); ?> />
						<span><?php echo esc_html( $label ); ?></span>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
		self::panel_form_field_input(
			'neo-pulse-search-insights-days',
			'neo-pulse_design[insights][insights_days]',
			__( 'Insights lookback (days)', 'neo-pulse-wp' ),
			(string) (int) ( $insights['insights_days'] ?? 30 ),
			'half',
			'number',
			false,
			'',
			'min="1" max="365"'
		);
		self::panel_form_field_input(
			'neo-pulse-search-popular-terms-limit',
			'neo-pulse_design[insights][popular_terms_limit]',
			__( 'Popular terms limit', 'neo-pulse-wp' ),
			(string) (int) ( $insights['popular_terms_limit'] ?? 5 ),
			'half',
			'number',
			false,
			'',
			'min="1" max="20"'
		);
		self::panel_form_group_close();
	}

	/**
	 * @param string              $widget 'search' | 'chat'
	 * @param string              $name_prefix Form name prefix.
	 * @param array<string,mixed> $sidebar Resolved sidebar config.
	 */
	protected static function render_sidebar_design_fields( string $widget, string $name_prefix, array $sidebar ): void {
		if ( $widget === 'search' ) {
			self::panel_form_field_select(
				'neo-pulse-sidebar-display-' . $widget,
				$name_prefix . '[display_mode]',
				__( 'Display mode', 'neo-pulse-wp' ),
				array(
					'inline'    => __( 'Inline dropdown', 'neo-pulse-wp' ),
					'sidebar'   => __( 'Full-height sidebar', 'neo-pulse-wp' ),
					'icon_only' => __( 'Icon only', 'neo-pulse-wp' ),
				),
				(string) ( $sidebar['display_mode'] ?? 'inline' ),
				'half'
			);
		}

		if ( $widget === 'search' ) {
			self::panel_form_field_select(
				'neo-pulse-sidebar-launcher-icon-' . $widget,
				$name_prefix . '[launcher_icon]',
				__( 'Launcher icon', 'neo-pulse-wp' ),
				Neo_Pulse_Wp_Search_Icons::catalog(),
				(string) ( $sidebar['launcher_icon'] ?? 'search' ),
				'half'
			);

			self::panel_form_field_select(
				'neo-pulse-sidebar-icon-open-as-' . $widget,
				$name_prefix . '[icon_open_as]',
				__( 'Opens as', 'neo-pulse-wp' ),
				array(
					'sidebar_left'  => __( 'Sidebar (left)', 'neo-pulse-wp' ),
					'sidebar_right' => __( 'Sidebar (right)', 'neo-pulse-wp' ),
					'modal_center'  => __( 'Center modal', 'neo-pulse-wp' ),
					'expand_inline' => __( 'Expand inline', 'neo-pulse-wp' ),
				),
				(string) ( $sidebar['icon_open_as'] ?? 'sidebar_right' ),
				'half'
			);

			self::panel_form_field_input(
				'neo-pulse-sidebar-modal-width-' . $widget,
				$name_prefix . '[modal_max_width]',
				__( 'Modal max width (px)', 'neo-pulse-wp' ),
				(string) (int) ( $sidebar['modal_max_width'] ?? 560 ),
				'half',
				'number',
				false,
				'',
				'min="320" max="720"'
			);

			self::panel_form_field_input(
				'neo-pulse-sidebar-launcher-label-' . $widget,
				$name_prefix . '[launcher_label]',
				__( 'Launcher label (accessibility)', 'neo-pulse-wp' ),
				(string) ( $sidebar['launcher_label'] ?? '' ),
				'half'
			);
		}

		self::panel_form_field_select(
			'neo-pulse-sidebar-side-' . $widget,
			$name_prefix . '[sidebar_side]',
			__( 'Sidebar side', 'neo-pulse-wp' ),
			array(
				'left'  => __( 'Left', 'neo-pulse-wp' ),
				'right' => __( 'Right', 'neo-pulse-wp' ),
			),
			(string) ( $sidebar['sidebar_side'] ?? 'right' ),
			'half'
		);

		self::panel_form_field_select(
			'neo-pulse-sidebar-transition-' . $widget,
			$name_prefix . '[sidebar_transition]',
			__( 'Transition', 'neo-pulse-wp' ),
			array(
				'slide' => __( 'Slide', 'neo-pulse-wp' ),
				'fade'  => __( 'Fade', 'neo-pulse-wp' ),
				'none'  => __( 'None', 'neo-pulse-wp' ),
			),
			(string) ( $sidebar['sidebar_transition'] ?? 'slide' ),
			'half'
		);

		self::panel_form_field_input(
			'neo-pulse-sidebar-width-' . $widget,
			$name_prefix . '[sidebar_width]',
			__( 'Sidebar width (px)', 'neo-pulse-wp' ),
			(string) (int) ( $sidebar['sidebar_width'] ?? 400 ),
			'half',
			'number',
			false,
			'',
			'min="280" max="560"'
		);

		self::panel_form_field_input(
			'neo-pulse-sidebar-heading-' . $widget,
			$name_prefix . '[sidebar_heading]',
			__( 'Heading (H2)', 'neo-pulse-wp' ),
			(string) ( $sidebar['sidebar_heading'] ?? '' ),
			'half'
		);

		if ( $widget === 'search' ) {
			self::panel_form_field_select(
				'neo-pulse-sidebar-panel-layout-' . $widget,
				$name_prefix . '[panel_layout]',
				__( 'Panel layout', 'neo-pulse-wp' ),
				array(
					'compact'   => __( 'Compact', 'neo-pulse-wp' ),
					'discovery' => __( 'Discovery', 'neo-pulse-wp' ),
				),
				(string) ( $sidebar['panel_layout'] ?? 'compact' ),
				'half'
			);

			self::panel_form_field_input(
				'neo-pulse-sidebar-subtitle-' . $widget,
				$name_prefix . '[sidebar_subtitle]',
				__( 'Subtitle', 'neo-pulse-wp' ),
				(string) ( $sidebar['sidebar_subtitle'] ?? '' ),
				'half'
			);

			self::panel_form_field_input(
				'neo-pulse-sidebar-offset-top-' . $widget,
				$name_prefix . '[panel_offset_top]',
				__( 'Content offset from top', 'neo-pulse-wp' ),
				(string) (int) ( $sidebar['panel_offset_top'] ?? 64 ),
				'half',
				'number',
				false,
				'',
				'min="0" max="400"'
			);

			self::panel_form_field_select(
				'neo-pulse-sidebar-offset-unit-' . $widget,
				$name_prefix . '[panel_offset_top_unit]',
				__( 'Offset unit', 'neo-pulse-wp' ),
				array(
					'vh' => 'vh',
					'px' => 'px',
					'%'  => '%',
				),
				(string) ( $sidebar['panel_offset_top_unit'] ?? 'px' ),
				'half'
			);

			self::panel_form_field_select(
				'neo-pulse-sidebar-content-align-' . $widget,
				$name_prefix . '[panel_content_align]',
				__( 'Panel content alignment', 'neo-pulse-wp' ),
				array(
					'left'   => __( 'Left', 'neo-pulse-wp' ),
					'center' => __( 'Center', 'neo-pulse-wp' ),
				),
				(string) ( $sidebar['panel_content_align'] ?? 'left' ),
				'half'
			);

			self::panel_form_field_input(
				'neo-pulse-sidebar-backdrop-opacity-' . $widget,
				$name_prefix . '[backdrop_opacity]',
				__( 'Backdrop opacity (%)', 'neo-pulse-wp' ),
				(string) (int) ( $sidebar['backdrop_opacity'] ?? 35 ),
				'half',
				'number',
				false,
				'',
				'min="0" max="100"'
			);
		}

		$layout       = isset( $sidebar['sidebar_layout'] ) && is_array( $sidebar['sidebar_layout'] )
			? $sidebar['sidebar_layout']
			: ( $widget === 'search' ? array( 'heading', 'search', 'results' ) : array( 'chat' ) );
		$layout_opts  = $widget === 'search'
			? array(
				'heading'                => __( 'Heading', 'neo-pulse-wp' ),
				'search'                 => __( 'Search bar', 'neo-pulse-wp' ),
				'popular_terms'          => __( 'Popular searches', 'neo-pulse-wp' ),
				'popular_pages_overseer' => __( 'General pages', 'neo-pulse-wp' ),
				'popular_pages_search'   => __( 'From search', 'neo-pulse-wp' ),
				'popular_topics'         => __( 'Popular topics grid', 'neo-pulse-wp' ),
				'results'                => __( 'Results area', 'neo-pulse-wp' ),
			)
			: array(
				'heading'       => __( 'Heading', 'neo-pulse-wp' ),
				'contact_human' => __( 'Talk to a human', 'neo-pulse-wp' ),
				'chat'          => __( 'Chat body', 'neo-pulse-wp' ),
			);
		?>
		<div class="neo-pulse-schema-cell neo-pulse-schema-cell--full">
			<h3 class="neo-pulse-design-section-title"><?php esc_html_e( 'Sidebar layout sections', 'neo-pulse-wp' ); ?></h3>
			<div class="neo-pulse-design-visibility-grid neo-pulse-design-visibility-grid--2">
				<?php foreach ( $layout_opts as $key => $label ) : ?>
					<label class="neo-pulse-design-check">
						<input
							type="checkbox"
							name="<?php echo esc_attr( $name_prefix . '[sidebar_layout][]' ); ?>"
							value="<?php echo esc_attr( $key ); ?>"
							data-neo-pulse-sidebar-layout="<?php echo esc_attr( $key ); ?>"
							<?php checked( in_array( $key, $layout, true ) ); ?>
						/>
						<span><?php echo esc_html( $label ); ?></span>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * @return array<string,array<string,string>>
	 */
	protected static function design_color_groups( string $widget ): array {
		$shared = array(
			__( 'Surfaces', 'neo-pulse-wp' ) => array(
				'bg'          => __( 'Background', 'neo-pulse-wp' ),
				'bg_elevated' => __( 'Elevated surface', 'neo-pulse-wp' ),
				'card_bg'     => __( 'Card background', 'neo-pulse-wp' ),
				'input_bg'    => __( 'Input background', 'neo-pulse-wp' ),
				'header_bg'   => __( 'Header background', 'neo-pulse-wp' ),
			),
			__( 'Text', 'neo-pulse-wp' ) => array(
				'text'           => __( 'Text', 'neo-pulse-wp' ),
				'text_secondary' => __( 'Secondary text', 'neo-pulse-wp' ),
				'text_muted'     => __( 'Muted text', 'neo-pulse-wp' ),
				'input_text'     => __( 'Input text', 'neo-pulse-wp' ),
				'link'           => __( 'Links', 'neo-pulse-wp' ),
				'placeholder'    => __( 'Placeholder', 'neo-pulse-wp' ),
			),
			__( 'Borders & brand', 'neo-pulse-wp' ) => array(
				'border'       => __( 'Border', 'neo-pulse-wp' ),
				'border_hover' => __( 'Border hover', 'neo-pulse-wp' ),
				'form_border'  => __( 'Form / bar border', 'neo-pulse-wp' ),
				'button_border'=> __( 'Icon button border', 'neo-pulse-wp' ),
				'focus_ring'   => __( 'Focus ring', 'neo-pulse-wp' ),
				'accent'       => __( 'Accent', 'neo-pulse-wp' ),
				'accent_text'  => __( 'Accent text', 'neo-pulse-wp' ),
				'highlight'    => __( 'Highlight', 'neo-pulse-wp' ),
				'button_bg'    => __( 'Button background', 'neo-pulse-wp' ),
				'button_text'  => __( 'Button text', 'neo-pulse-wp' ),
				'button_hover' => __( 'Button hover', 'neo-pulse-wp' ),
				'icon_color'   => __( 'Icon color', 'neo-pulse-wp' ),
			),
		);

		if ( $widget === 'chat' ) {
			$shared[ __( 'Chat parts', 'neo-pulse-wp' ) ] = array(
				'launcher_bg'           => __( 'Launcher', 'neo-pulse-wp' ),
				'user_bubble_bg'        => __( 'User bubble', 'neo-pulse-wp' ),
				'user_bubble_text'      => __( 'User bubble text', 'neo-pulse-wp' ),
				'assistant_bubble_bg'   => __( 'Assistant bubble', 'neo-pulse-wp' ),
				'assistant_bubble_text' => __( 'Assistant bubble text', 'neo-pulse-wp' ),
				'thinking_border'       => __( 'Thinking border', 'neo-pulse-wp' ),
				'mic_idle'              => __( 'Mic idle', 'neo-pulse-wp' ),
				'mic_recording'         => __( 'Mic recording', 'neo-pulse-wp' ),
				'send_bg'               => __( 'Send button', 'neo-pulse-wp' ),
				'powered_text'          => __( 'Powered by text', 'neo-pulse-wp' ),
				'powered_icon'          => __( 'Powered by logo', 'neo-pulse-wp' ),
			);
		} else {
			$shared[ __( 'Search parts', 'neo-pulse-wp' ) ] = array(
				'dropdown_bg'  => __( 'Dropdown background', 'neo-pulse-wp' ),
				'result_hover' => __( 'Result hover', 'neo-pulse-wp' ),
				'score_color'  => __( 'Relevance score', 'neo-pulse-wp' ),
				'banner_bg'    => __( 'AI banner background', 'neo-pulse-wp' ),
				'banner_text'  => __( 'AI banner text', 'neo-pulse-wp' ),
				'powered_text' => __( 'Powered by text', 'neo-pulse-wp' ),
				'powered_icon' => __( 'Powered by logo', 'neo-pulse-wp' ),
			);
		}

		return $shared;
	}

	/**
	 * @return array<string,string>
	 */
	protected static function chat_visibility_labels(): array {
		return array(
			'header'           => __( 'Panel header', 'neo-pulse-wp' ),
			'avatar'           => __( 'Avatar', 'neo-pulse-wp' ),
			'assistant_name'   => __( 'Assistant name', 'neo-pulse-wp' ),
			'close_button'     => __( 'Close button', 'neo-pulse-wp' ),
			'welcome_message'  => __( 'Welcome message', 'neo-pulse-wp' ),
			'thinking_card'    => __( 'Thinking card', 'neo-pulse-wp' ),
			'type_badge'       => __( 'Card type badge', 'neo-pulse-wp' ),
			'source_pills'     => __( 'Source pills', 'neo-pulse-wp' ),
			'cta_buttons'      => __( 'CTA buttons', 'neo-pulse-wp' ),
			'suggestion_chips' => __( 'Suggestion chips', 'neo-pulse-wp' ),
			'confidence'       => __( 'Confidence label', 'neo-pulse-wp' ),
			'powered_by'       => __( 'Powered by', 'neo-pulse-wp' ),
			'send_button'      => __( 'Send button', 'neo-pulse-wp' ),
			'mic_button'       => __( 'Mic button', 'neo-pulse-wp' ),
			'voice_toast'      => __( 'Voice toast', 'neo-pulse-wp' ),
		);
	}

	/**
	 * @return array<string,string>
	 */
	protected static function search_visibility_labels(): array {
		return array(
			'search_icon'      => __( 'Search icon', 'neo-pulse-wp' ),
			'submit_button'    => __( 'Submit button', 'neo-pulse-wp' ),
			'clear_button'     => __( 'Clear button', 'neo-pulse-wp' ),
			'ai_banner'        => __( 'AI banner', 'neo-pulse-wp' ),
			'relevance_scores' => __( 'Relevance scores', 'neo-pulse-wp' ),
			'powered_by'       => __( 'Powered by', 'neo-pulse-wp' ),
			'dropdown_shadow'  => __( 'Dropdown shadow', 'neo-pulse-wp' ),
			'empty_state'      => __( 'Empty state', 'neo-pulse-wp' ),
		);
	}

	protected static function render_design_color_field( string $name, string $key, string $label, string $value ): void {
		$id   = 'neo-pulse-design-color-' . sanitize_key( $key );
		$hex  = sanitize_hex_color( $value );
		if ( ! $hex ) {
			$hex = '#3b82f6';
		}
		?>
		<div class="neo-pulse-design-color-row" data-token="<?php echo esc_attr( $key ); ?>">
			<label class="neo-pulse-design-color-row__label" for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<input
				type="color"
				class="neo-pulse-design-color-row__pick"
				value="<?php echo esc_attr( $hex ); ?>"
				aria-label="<?php echo esc_attr( $label ); ?>"
				tabindex="-1"
			/>
			<input
				id="<?php echo esc_attr( $id ); ?>"
				name="<?php echo esc_attr( $name ); ?>"
				class="neo-pulse-design-color-row__hex"
				type="text"
				value="<?php echo esc_attr( $value !== '' ? $value : $hex ); ?>"
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
		<?php
	}
}

<?php
/**
 * Shared Design UI for Chat + Search widgets.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Ai_Widget_Design {

	/**
	 * Enqueue design field assets + live preview on Chat/Search screens.
	 */
	public static function enqueue_ai_widget_design_assets( string $hook_suffix ): void {
		$hooks = array(
			'flowbie-wp_page_flowbie-wp-chat',
			'flowbie-wp_page_flowbie-wp-search',
		);
		if ( ! in_array( $hook_suffix, $hooks, true ) ) {
			return;
		}

		$base = plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/admin/';
		$ver  = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '1';

		$css = FLOWBIE_WP_PLUGIN_DIR . 'assets/admin/flowbie-color-field.css';
		if ( is_readable( $css ) ) {
			$ver_css = $ver . '.' . (string) filemtime( $css );
			wp_enqueue_style( 'flowbie-color-field', $base . 'flowbie-color-field.css', array(), $ver_css );
		}

		$js = FLOWBIE_WP_PLUGIN_DIR . 'assets/admin/flowbie-color-field.js';
		if ( is_readable( $js ) ) {
			$ver_js = $ver . '.' . (string) filemtime( $js );
			wp_enqueue_script( 'flowbie-color-field', $base . 'flowbie-color-field.js', array( 'jquery' ), $ver_js, true );
		}

		$preview = FLOWBIE_WP_PLUGIN_DIR . 'assets/admin/flowbie-ai-widget-design-preview.js';
		if ( is_readable( $preview ) ) {
			$ver_p = $ver . '.' . (string) filemtime( $preview );
			wp_enqueue_script(
				'flowbie-ai-widget-design-preview',
				$base . 'flowbie-ai-widget-design-preview.js',
				array( 'jquery', 'flowbie-color-field' ),
				$ver_p,
				true
			);
			wp_localize_script(
				'flowbie-ai-widget-design-preview',
				'flowbieDesignPreview',
				array(
					'searchTokens' => Flowbie_Wp_Ai_Widget_Design::resolve( 'search' ),
					'chatTokens'   => Flowbie_Wp_Ai_Widget_Design::resolve( 'chat' ),
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
		$design   = Flowbie_Wp_Ai_Widget_Design::get_settings();
		$scope    = $design['style_scope'];
		$source   = $design['color_source'];
		$tokens   = $source === 'custom'
			? Flowbie_Wp_Ai_Widget_Design::editable_tokens( $widget )
			: Flowbie_Wp_Ai_Widget_Design::resolve( $widget );
		$swatches = Flowbie_Wp_Ai_Widget_Design::elementor_color_swatches();
		$ui_key   = $widget === 'search' ? 'search_ui' : 'chat_ui';
		$ui       = $design[ $ui_key ];
		$prefix   = 'flowbie_design';

		$source_class = $source === 'custom' ? 'flowbie-design--custom' : 'flowbie-design--site-branding';
		?>
		<div class="flowbie-ai-widget-design <?php echo esc_attr( $source_class ); ?>" data-flowbie-design-widget="<?php echo esc_attr( $widget ); ?>">
			<div class="flowbie-design-shell">

			<div class="flowbie-design-setup">
				<div class="flowbie-design-setup__col">
					<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Style scope', 'flowbie-wp' ); ?></h3>
					<label class="flowbie-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[style_scope]" value="both" data-flowbie-style-scope <?php checked( $scope, 'both' ); ?> />
						<span><?php esc_html_e( 'Style both Chat and Search together', 'flowbie-wp' ); ?></span>
					</label>
					<label class="flowbie-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[style_scope]" value="individual" data-flowbie-style-scope <?php checked( $scope, 'individual' ); ?> />
						<span><?php esc_html_e( 'Style this widget only', 'flowbie-wp' ); ?></span>
					</label>
					<label class="flowbie-design-check flowbie-design-apply-both" <?php echo $scope === 'individual' ? '' : 'hidden'; ?>>
						<input type="checkbox" name="<?php echo esc_attr( $prefix ); ?>[apply_to_both]" value="1" />
						<span><?php esc_html_e( 'Apply to both on save', 'flowbie-wp' ); ?></span>
					</label>
				</div>
				<div class="flowbie-design-setup__col">
					<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Color source', 'flowbie-wp' ); ?></h3>
					<label class="flowbie-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[color_source]" value="site_branding" data-flowbie-color-source <?php checked( $source, 'site_branding' ); ?> />
						<span><?php esc_html_e( 'Site Branding (Elementor)', 'flowbie-wp' ); ?></span>
					</label>
					<label class="flowbie-design-check">
						<input type="radio" name="<?php echo esc_attr( $prefix ); ?>[color_source]" value="custom" data-flowbie-color-source <?php checked( $source, 'custom' ); ?> />
						<span><?php esc_html_e( 'Custom colors', 'flowbie-wp' ); ?></span>
					</label>
				</div>
				<div class="flowbie-design-setup__kit">
					<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Elementor colors', 'flowbie-wp' ); ?></h3>
					<?php if ( ! empty( $swatches ) ) : ?>
						<div class="flowbie-design-kit-row">
							<div class="flowbie-elementor-swatches" role="list">
								<?php foreach ( $swatches as $sw ) : ?>
									<button
										type="button"
										class="flowbie-elementor-swatch"
										style="background:<?php echo esc_attr( $sw['color'] ); ?>"
										data-color="<?php echo esc_attr( $sw['color'] ); ?>"
										data-kit-id="<?php echo esc_attr( $sw['id'] ); ?>"
										title="<?php echo esc_attr( $sw['title'] . ' (' . $sw['color'] . ')' ); ?>"
									>
										<span class="flowbie-elementor-swatch__label"><?php echo esc_html( $sw['title'] ); ?></span>
									</button>
								<?php endforeach; ?>
							</div>
							<button type="button" class="button flowbie-design-apply-kit" data-flowbie-apply-kit="1">
								<?php esc_html_e( 'Apply kit to brand tokens', 'flowbie-wp' ); ?>
							</button>
						</div>
					<?php else : ?>
						<p class="flowbie-design-muted"><?php esc_html_e( 'No Elementor kit colors found. Site Branding uses the Flowbie light default palette.', 'flowbie-wp' ); ?></p>
					<?php endif; ?>
				</div>
			</div>

			<div class="flowbie-design-custom-colors">
				<?php
				$group_index = 0;
				foreach ( self::design_color_groups( $widget ) as $group_label => $keys ) :
					$open = $group_index === 0 ? ' open' : '';
					++$group_index;
					?>
					<details class="flowbie-design-group"<?php echo $open; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
						<summary class="flowbie-design-group__summary"><?php echo esc_html( $group_label ); ?></summary>
						<div class="flowbie-design-color-list">
							<?php foreach ( $keys as $key => $label ) : ?>
								<?php self::render_design_color_field( $prefix . '[tokens][' . $key . ']', $key, $label, (string) ( $tokens[ $key ] ?? '' ) ); ?>
							<?php endforeach; ?>
						</div>
					</details>
				<?php endforeach; ?>
			</div>

			<?php self::panel_form_group_open(); ?>
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Shape & type', 'flowbie-wp' ); ?></h3>
			</div>
			<?php
			self::panel_form_field_input(
				'flowbie-design-radius',
				$prefix . '[tokens][radius]',
				__( 'Border radius (px)', 'flowbie-wp' ),
				(string) (int) ( $tokens['radius'] ?? 8 ),
				'half',
				'number',
				false,
				'',
				' min="0" max="50"'
			);
			self::panel_form_field_input(
				'flowbie-design-font-size',
				$prefix . '[tokens][font_size]',
				__( 'Font size (min 1rem)', 'flowbie-wp' ),
				(string) (int) ( $tokens['font_size'] ?? 16 ),
				'half',
				'number',
				false,
				'',
				' min="16" max="24"'
			);
			if ( $widget === 'chat' ) {
				self::panel_form_field_input(
					'flowbie-design-launcher-size',
					$prefix . '[tokens][launcher_size]',
					__( 'Launcher size (px)', 'flowbie-wp' ),
					(string) (int) ( $tokens['launcher_size'] ?? 56 ),
					'half',
					'number',
					false,
					'',
					' min="40" max="80"'
				);
				self::panel_form_field_input(
					'flowbie-design-panel-width',
					$prefix . '[tokens][panel_width]',
					__( 'Panel width (px)', 'flowbie-wp' ),
					(string) (int) ( $tokens['panel_width'] ?? 380 ),
					'half',
					'number',
					false,
					'',
					' min="280" max="560"'
				);
				self::panel_form_field_input(
					'flowbie-design-offset-x',
					$prefix . '[tokens][offset_x]',
					__( 'Offset X (px)', 'flowbie-wp' ),
					(string) (int) ( $tokens['offset_x'] ?? 20 ),
					'half',
					'number',
					false,
					'',
					' min="0" max="120"'
				);
				self::panel_form_field_input(
					'flowbie-design-offset-y',
					$prefix . '[tokens][offset_y]',
					__( 'Offset Y (px)', 'flowbie-wp' ),
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
			<div class="flowbie-schema-cell flowbie-schema-cell--full">
				<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Show / hide', 'flowbie-wp' ); ?></h3>
				<div class="flowbie-design-visibility-grid">
					<?php foreach ( $labels as $key => $label ) : ?>
						<label class="flowbie-design-check">
							<input
								type="checkbox"
								name="<?php echo esc_attr( $prefix . '[ui][' . $key . ']' ); ?>"
								value="1"
								data-flowbie-ui="<?php echo esc_attr( $key ); ?>"
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
			'flowbie_chat_voice_enabled'     => array( __( 'Enable voice chat', 'flowbie-wp' ), ! isset( $chat_settings['voice_enabled'] ) || ! empty( $chat_settings['voice_enabled'] ) ),
			'flowbie_chat_voice_ptt'         => array( __( 'Hold to speak (push-to-talk)', 'flowbie-wp' ), ! isset( $chat_settings['voice_ptt'] ) || ! empty( $chat_settings['voice_ptt'] ) ),
			'flowbie_chat_voice_ack'         => array( __( 'Spoken acknowledgement', 'flowbie-wp' ), ! isset( $chat_settings['voice_ack'] ) || ! empty( $chat_settings['voice_ack'] ) ),
			'flowbie_chat_voice_narrate'     => array( __( 'Speak assistant replies', 'flowbie-wp' ), ! isset( $chat_settings['voice_narrate'] ) || ! empty( $chat_settings['voice_narrate'] ) ),
			'flowbie_chat_mic_replaces_send' => array( __( 'Mic replaces send when input empty', 'flowbie-wp' ), ! isset( $chat_settings['mic_replaces_send'] ) || ! empty( $chat_settings['mic_replaces_send'] ) ),
		);
		self::panel_form_group_open();
		?>
		<div class="flowbie-schema-cell flowbie-schema-cell--full">
			<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Voice & mic', 'flowbie-wp' ); ?></h3>
			<div class="flowbie-design-visibility-grid flowbie-design-visibility-grid--2">
				<?php foreach ( $checks as $name => $row ) : ?>
					<label class="flowbie-design-check">
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
		<div class="flowbie-schema-cell flowbie-schema-cell--full">
			<h3 class="flowbie-design-section-title"><?php esc_html_e( 'Position', 'flowbie-wp' ); ?></h3>
		</div>
		<?php
		self::panel_form_field_select(
			'flowbie-wp-chat-position',
			'flowbie_chat_position',
			__( 'Widget position', 'flowbie-wp' ),
			array(
				'bottom-right' => __( 'Bottom right', 'flowbie-wp' ),
				'bottom-left'  => __( 'Bottom left', 'flowbie-wp' ),
			),
			(string) ( $chat_settings['position'] ?? 'bottom-right' ),
			'half'
		);
		self::panel_form_group_close();
	}

	/**
	 * @return array<string,array<string,string>>
	 */
	protected static function design_color_groups( string $widget ): array {
		$shared = array(
			__( 'Surfaces', 'flowbie-wp' ) => array(
				'bg'          => __( 'Background', 'flowbie-wp' ),
				'bg_elevated' => __( 'Elevated surface', 'flowbie-wp' ),
				'card_bg'     => __( 'Card background', 'flowbie-wp' ),
				'input_bg'    => __( 'Input background', 'flowbie-wp' ),
				'header_bg'   => __( 'Header background', 'flowbie-wp' ),
			),
			__( 'Text', 'flowbie-wp' ) => array(
				'text'           => __( 'Text', 'flowbie-wp' ),
				'text_secondary' => __( 'Secondary text', 'flowbie-wp' ),
				'text_muted'     => __( 'Muted text', 'flowbie-wp' ),
				'input_text'     => __( 'Input text', 'flowbie-wp' ),
				'link'           => __( 'Links', 'flowbie-wp' ),
				'placeholder'    => __( 'Placeholder', 'flowbie-wp' ),
			),
			__( 'Borders & brand', 'flowbie-wp' ) => array(
				'border'       => __( 'Border', 'flowbie-wp' ),
				'border_hover' => __( 'Border hover', 'flowbie-wp' ),
				'form_border'  => __( 'Form / bar border', 'flowbie-wp' ),
				'button_border'=> __( 'Icon button border', 'flowbie-wp' ),
				'focus_ring'   => __( 'Focus ring', 'flowbie-wp' ),
				'accent'       => __( 'Accent', 'flowbie-wp' ),
				'accent_text'  => __( 'Accent text', 'flowbie-wp' ),
				'highlight'    => __( 'Highlight', 'flowbie-wp' ),
				'button_bg'    => __( 'Button background', 'flowbie-wp' ),
				'button_text'  => __( 'Button text', 'flowbie-wp' ),
				'button_hover' => __( 'Button hover', 'flowbie-wp' ),
				'icon_color'   => __( 'Icon color', 'flowbie-wp' ),
			),
		);

		if ( $widget === 'chat' ) {
			$shared[ __( 'Chat parts', 'flowbie-wp' ) ] = array(
				'launcher_bg'           => __( 'Launcher', 'flowbie-wp' ),
				'user_bubble_bg'        => __( 'User bubble', 'flowbie-wp' ),
				'user_bubble_text'      => __( 'User bubble text', 'flowbie-wp' ),
				'assistant_bubble_bg'   => __( 'Assistant bubble', 'flowbie-wp' ),
				'assistant_bubble_text' => __( 'Assistant bubble text', 'flowbie-wp' ),
				'thinking_border'       => __( 'Thinking border', 'flowbie-wp' ),
				'mic_idle'              => __( 'Mic idle', 'flowbie-wp' ),
				'mic_recording'         => __( 'Mic recording', 'flowbie-wp' ),
				'send_bg'               => __( 'Send button', 'flowbie-wp' ),
				'powered_text'          => __( 'Powered by text', 'flowbie-wp' ),
				'powered_icon'          => __( 'Powered by logo', 'flowbie-wp' ),
			);
		} else {
			$shared[ __( 'Search parts', 'flowbie-wp' ) ] = array(
				'dropdown_bg'  => __( 'Dropdown background', 'flowbie-wp' ),
				'result_hover' => __( 'Result hover', 'flowbie-wp' ),
				'score_color'  => __( 'Relevance score', 'flowbie-wp' ),
				'banner_bg'    => __( 'AI banner background', 'flowbie-wp' ),
				'banner_text'  => __( 'AI banner text', 'flowbie-wp' ),
				'powered_text' => __( 'Powered by text', 'flowbie-wp' ),
				'powered_icon' => __( 'Powered by logo', 'flowbie-wp' ),
			);
		}

		return $shared;
	}

	/**
	 * @return array<string,string>
	 */
	protected static function chat_visibility_labels(): array {
		return array(
			'launcher'         => __( 'Launcher bubble', 'flowbie-wp' ),
			'header'           => __( 'Panel header', 'flowbie-wp' ),
			'avatar'           => __( 'Avatar', 'flowbie-wp' ),
			'assistant_name'   => __( 'Assistant name', 'flowbie-wp' ),
			'close_button'     => __( 'Close button', 'flowbie-wp' ),
			'welcome_message'  => __( 'Welcome message', 'flowbie-wp' ),
			'thinking_card'    => __( 'Thinking card', 'flowbie-wp' ),
			'source_pills'     => __( 'Source pills', 'flowbie-wp' ),
			'cta_buttons'      => __( 'CTA buttons', 'flowbie-wp' ),
			'suggestion_chips' => __( 'Suggestion chips', 'flowbie-wp' ),
			'confidence'       => __( 'Confidence label', 'flowbie-wp' ),
			'powered_by'       => __( 'Powered by', 'flowbie-wp' ),
			'send_button'      => __( 'Send button', 'flowbie-wp' ),
			'mic_button'       => __( 'Mic button', 'flowbie-wp' ),
			'voice_toast'      => __( 'Voice toast', 'flowbie-wp' ),
		);
	}

	/**
	 * @return array<string,string>
	 */
	protected static function search_visibility_labels(): array {
		return array(
			'search_icon'      => __( 'Search icon', 'flowbie-wp' ),
			'submit_button'    => __( 'Submit button', 'flowbie-wp' ),
			'clear_button'     => __( 'Clear button', 'flowbie-wp' ),
			'ai_banner'        => __( 'AI banner', 'flowbie-wp' ),
			'relevance_scores' => __( 'Relevance scores', 'flowbie-wp' ),
			'powered_by'       => __( 'Powered by', 'flowbie-wp' ),
			'dropdown_shadow'  => __( 'Dropdown shadow', 'flowbie-wp' ),
			'empty_state'      => __( 'Empty state', 'flowbie-wp' ),
		);
	}

	protected static function render_design_color_field( string $name, string $key, string $label, string $value ): void {
		$id   = 'flowbie-design-color-' . sanitize_key( $key );
		$hex  = sanitize_hex_color( $value );
		if ( ! $hex ) {
			$hex = '#3b82f6';
		}
		?>
		<div class="flowbie-design-color-row" data-token="<?php echo esc_attr( $key ); ?>">
			<label class="flowbie-design-color-row__label" for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<input
				type="color"
				class="flowbie-design-color-row__pick"
				value="<?php echo esc_attr( $hex ); ?>"
				aria-label="<?php echo esc_attr( $label ); ?>"
				tabindex="-1"
			/>
			<input
				id="<?php echo esc_attr( $id ); ?>"
				name="<?php echo esc_attr( $name ); ?>"
				class="flowbie-design-color-row__hex"
				type="text"
				value="<?php echo esc_attr( $value !== '' ? $value : $hex ); ?>"
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
		<?php
	}
}

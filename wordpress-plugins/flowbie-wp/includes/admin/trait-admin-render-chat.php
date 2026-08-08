<?php
/**
 * Chat panel: tabbed admin UI for Flow Assist chat widget settings, training, and demo.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Chat {

	public static function render_chat_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$chat_settings = Flowbie_Wp_Chat::get_settings();
		$openrouter_ok = Flowbie_Wp_OpenRouter::get_api_key() !== '';

		$tab = self::panel_active_tab( 'general' );
		if ( ! in_array( $tab, array( 'general', 'design', 'training', 'knowledge-base', 'demo' ), true ) ) {
			$tab = 'general';
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Chat', 'flowbie-wp' ),
				'tabs'    => array(
					'general'        => __( 'General', 'flowbie-wp' ),
					'design'         => __( 'Design', 'flowbie-wp' ),
					'training'       => __( 'Training', 'flowbie-wp' ),
					'knowledge-base' => __( 'Knowledge Base', 'flowbie-wp' ),
					'demo'           => __( 'Demo', 'flowbie-wp' ),
				),
			),
		);
		self::flowbie_group_shell_open( 'flowbie-wp-chat', 'flowbie-wp-chat flowbie-wp-panel-page' );

		self::panel_layout_start( 'flowbie-wp-chat', $nav_groups, $tab, __( 'Chat sections', 'flowbie-wp' ) );
		switch ( $tab ) {
			case 'design':
				self::render_chat_section_design( $chat_settings );
				break;
			case 'training':
				self::render_chat_section_training( $chat_settings );
				break;
			case 'knowledge-base':
				self::render_chat_section_knowledge_base( $chat_settings );
				break;
			case 'demo':
				self::render_chat_section_demo( $openrouter_ok );
				break;
			default:
				self::render_chat_section_general( $chat_settings, $openrouter_ok );
				break;
		}
		self::panel_layout_end();

		self::flowbie_group_shell_close();
	}

	// ── General tab ─────────────────────────────────────────────

	private static function render_chat_section_general( array $chat_settings, bool $openrouter_ok ): void {
		$form_id = 'flowbie-wp-chat-general-form';
		$chekkit_configured = class_exists( 'Flowbie_Wp_Chekkit' ) && Flowbie_Wp_Chekkit::is_configured();
		$chekkit_enabled        = ! isset( $chat_settings['chekkit_enabled'] ) || ! empty( $chat_settings['chekkit_enabled'] );
		$chekkit_teaser_enabled = ! isset( $chat_settings['chekkit_teaser_enabled'] ) || ! empty( $chat_settings['chekkit_teaser_enabled'] );
		$chekkit_cta_label  = isset( $chat_settings['chekkit_cta_label'] ) ? (string) $chat_settings['chekkit_cta_label'] : __( 'Send Us A Text', 'flowbie-wp' );
		$chekkit_event_type = isset( $chat_settings['chekkit_event_type'] ) ? (string) $chat_settings['chekkit_event_type'] : 'contact_request';
		$chekkit_webhook_url = isset( $chat_settings['chekkit_webhook_url'] ) && trim( (string) $chat_settings['chekkit_webhook_url'] ) !== ''
			? (string) $chat_settings['chekkit_webhook_url']
			: Flowbie_Wp_Chekkit::DEFAULT_WEBHOOK_URL;
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'General', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Configure the floating chat widget that appears on your site for visitors.', 'flowbie-wp' ); ?>
		</p>

		<div class="flowbie-wp-panel-info-box" role="status">
			<p>
				<?php
				if ( ! empty( $chat_settings['enabled'] ) ) {
					if ( $openrouter_ok ) {
						esc_html_e( 'Status: enabled and active on the frontend.', 'flowbie-wp' );
					} else {
						esc_html_e( 'Status: enabled but OpenRouter key is missing. Chat will not respond until a key is configured.', 'flowbie-wp' );
					}
				} else {
					esc_html_e( 'Status: disabled. Enable below to show the chat widget on your site.', 'flowbie-wp' );
				}
				?>
			</p>
		</div>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="flowbie_wp_save_chat" />
			<?php wp_nonce_field( 'flowbie_wp_save_chat', 'flowbie_wp_chat_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_toggle(
				'flowbie_chat_enabled',
				__( 'Enable chat widget on the frontend', 'flowbie-wp' ),
				! empty( $chat_settings['enabled'] )
			);
			self::panel_form_toggle(
				'flowbie_chat_logged_in_only',
				__( 'Show chat on the frontend for logged-in WordPress users only', 'flowbie-wp' ),
				! empty( $chat_settings['logged_in_only'] )
			);
			self::panel_form_field_input(
				'flowbie-wp-chat-welcome',
				'flowbie_chat_welcome_message',
				__( 'Welcome message', 'flowbie-wp' ),
				(string) $chat_settings['welcome_message'],
				'full',
				'text',
				false,
				__( 'Greeting shown when a visitor opens the chat panel.', 'flowbie-wp' ),
				' placeholder="' . esc_attr__( 'Hi! Ask me anything about this website.', 'flowbie-wp' ) . '"'
			);
			self::panel_form_group_close();

			self::panel_form_group_open();
			?>
			<h3 class="flowbie-chat-settings-section__title"><?php esc_html_e( 'Talk To A Human (Chekkit)', 'flowbie-wp' ); ?></h3>
			<?php
			self::panel_form_toggle(
				'flowbie_chat_chekkit_enabled',
				__( 'Enable Talk To A Human contact form in chat sidebar', 'flowbie-wp' ),
				$chekkit_enabled
			);
			self::panel_form_toggle(
				'flowbie_chat_chekkit_teaser_enabled',
				__( 'Show text-message teaser above launcher', 'flowbie-wp' ),
				$chekkit_teaser_enabled
			);
			self::panel_form_field_input(
				'flowbie-chat-chekkit-cta-label',
				'flowbie_chat_chekkit_cta_label',
				__( 'CTA label', 'flowbie-wp' ),
				$chekkit_cta_label,
				'half',
				'text',
				false,
				'',
				' placeholder="' . esc_attr__( 'Send Us A Text', 'flowbie-wp' ) . '"'
			);
			self::panel_form_field_input(
				'flowbie-chat-chekkit-event-type',
				'flowbie_chat_chekkit_event_type',
				__( 'Chekkit event type', 'flowbie-wp' ),
				$chekkit_event_type,
				'half',
				'text',
				false,
				'',
				' placeholder="contact_request"'
			);
			self::panel_form_field_input(
				'flowbie-chat-chekkit-webhook-url',
				'flowbie_chat_chekkit_webhook_url',
				__( 'Chekkit webhook URL', 'flowbie-wp' ),
				$chekkit_webhook_url,
				'full',
				'url',
				false,
				__( 'Contact form submissions POST here (Flowbie hub for all client sites).', 'flowbie-wp' ),
				' placeholder="' . esc_attr( Flowbie_Wp_Chekkit::DEFAULT_WEBHOOK_URL ) . '"'
			);
			?>
			<p class="flowbie-field__note">
				<?php
				if ( $chekkit_configured ) {
					printf(
						/* translators: %s: webhook URL */
						esc_html__( 'Active webhook: %s', 'flowbie-wp' ),
						esc_html( Flowbie_Wp_Chekkit::get_webhook_url() )
					);
				} else {
					esc_html_e( 'Chekkit webhook URL is missing.', 'flowbie-wp' );
				}
				?>
			</p>
			<?php
			self::panel_form_group_close();
			?>
		</form>

		<div class="flowbie-wp-panel-footer">
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	/**
	 * Design tab: shared appearance, visibility, voice.
	 *
	 * @param array<string,mixed> $chat_settings
	 */
	private static function render_chat_section_design( array $chat_settings ): void {
		$form_id = 'flowbie-wp-chat-design-form';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Design', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Colors, visibility, and layout for Chat. Shared with Search unless you style this widget only.', 'flowbie-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="flowbie_wp_save_chat_design" />
			<?php wp_nonce_field( 'flowbie_wp_save_chat_design', 'flowbie_wp_chat_design_nonce' ); ?>
			<?php self::render_ai_widget_design_fields( 'chat', $chat_settings ); ?>
		</form>

		<div class="flowbie-wp-panel-footer">
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	// ── Training tab ────────────────────────────────────────────

	private static function render_chat_section_training( array $chat_settings ): void {
		$form_id = 'flowbie-wp-chat-training-form';

		$assistant_name    = isset( $chat_settings['assistant_name'] ) ? $chat_settings['assistant_name'] : 'Flow Assist';
		$system_prompt     = isset( $chat_settings['system_prompt'] ) ? $chat_settings['system_prompt'] : '';
		$greeting_style    = isset( $chat_settings['greeting_style'] ) ? $chat_settings['greeting_style'] : 'friendly';
		$indexed_types     = isset( $chat_settings['indexed_post_types'] ) && is_array( $chat_settings['indexed_post_types'] ) ? $chat_settings['indexed_post_types'] : array( 'post', 'page' );
		$excluded_cats     = isset( $chat_settings['excluded_categories'] ) && is_array( $chat_settings['excluded_categories'] ) ? $chat_settings['excluded_categories'] : array();
		$full_content      = ! empty( $chat_settings['full_content'] );
		$lead_conversion   = ! isset( $chat_settings['lead_conversion_enabled'] ) || ! empty( $chat_settings['lead_conversion_enabled'] );
		$lead_forms        = isset( $chat_settings['lead_forms'] ) && is_array( $chat_settings['lead_forms'] ) ? $chat_settings['lead_forms'] : array();
		$lead_form_booking = isset( $lead_forms['booking'] ) ? (int) $lead_forms['booking'] : 0;
		$lead_form_contact = isset( $lead_forms['contact'] ) ? (int) $lead_forms['contact'] : 0;
		$lead_form_pricing = isset( $lead_forms['pricing'] ) ? (int) $lead_forms['pricing'] : 0;
		$flowbie_forms     = class_exists( 'Flowbie_Wp_Forms_Storage' ) ? Flowbie_Wp_Forms_Storage::get_all_forms( true ) : array();
		$form_options      = array( '0' => __( 'None', 'flowbie-wp' ) );
		foreach ( $flowbie_forms as $form ) {
			if ( empty( $form['ID'] ) ) {
				continue;
			}
			$form_options[ (string) (int) $form['ID'] ] = (string) ( $form['title'] ?? ( 'Form #' . (int) $form['ID'] ) );
		}

		$all_post_types = get_post_types( array( 'public' => true ), 'objects' );
		$all_categories = get_categories( array( 'hide_empty' => false ) );
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Training', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Customize how Flow Assist thinks, what it knows, and which content it draws from.', 'flowbie-wp' ); ?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form" autocomplete="off">
			<input type="hidden" name="action" value="flowbie_wp_save_chat_training" />
			<?php wp_nonce_field( 'flowbie_wp_save_chat_training', 'flowbie_wp_chat_training_nonce' ); ?>

			<?php // ── Custom Instructions ── ?>
			<section class="flowbie-schema-group flowbie-chat-settings-section" aria-labelledby="flowbie-chat-instructions-heading">
				<h3 id="flowbie-chat-instructions-heading" class="flowbie-chat-settings-section__title">
					<?php esc_html_e( 'Custom Instructions', 'flowbie-wp' ); ?>
				</h3>
				<div class="flowbie-schema-grid">
					<?php
					self::panel_form_field_input(
						'flowbie-chat-assistant-name',
						'flowbie_chat_assistant_name',
						__( 'Assistant name', 'flowbie-wp' ),
						$assistant_name,
						'full',
						'text',
						false,
						__( 'Shown in the chat header and used in responses.', 'flowbie-wp' ),
						' placeholder="Flow Assist"'
					);
					self::panel_form_field_textarea(
						'flowbie-chat-system-prompt',
						'flowbie_chat_system_prompt',
						__( 'System instructions', 'flowbie-wp' ),
						$system_prompt,
						'full',
						6,
						__( 'These instructions shape the assistant\'s personality, tone, and boundaries. Leave blank for the default helpful assistant.', 'flowbie-wp' )
					);
					self::panel_form_field_select(
						'flowbie-chat-greeting-style',
						'flowbie_chat_greeting_style',
						__( 'Greeting style', 'flowbie-wp' ),
						array(
							'professional' => __( 'Professional', 'flowbie-wp' ),
							'friendly'     => __( 'Friendly', 'flowbie-wp' ),
							'casual'       => __( 'Casual', 'flowbie-wp' ),
						),
						$greeting_style,
						'half',
						__( 'Sets the overall tone of responses.', 'flowbie-wp' )
					);
					?>
				</div>
				<p class="flowbie-field__note">
					<?php
					printf(
						wp_kses(
							/* translators: %s: link to Knowledge Base tab */
							__( 'Manage custom Q&amp;A pairs on the %s tab.', 'flowbie-wp' ),
							array( 'a' => array( 'href' => array() ) )
						),
						'<a href="' . esc_url( admin_url( 'admin.php?page=flowbie-wp-chat&tab=knowledge-base' ) ) . '">' . esc_html__( 'Knowledge Base', 'flowbie-wp' ) . '</a>'
					);
					?>
				</p>
			</section>

			<?php // ── Lead conversion ── ?>
			<section class="flowbie-schema-group flowbie-chat-settings-section" aria-labelledby="flowbie-chat-lead-heading">
				<h3 id="flowbie-chat-lead-heading" class="flowbie-chat-settings-section__title">
					<?php esc_html_e( 'Lead conversion', 'flowbie-wp' ); ?>
				</h3>
				<div class="flowbie-schema-grid">
					<div class="flowbie-schema-cell flowbie-schema-cell--full">
						<label class="flowbie-wp-panel-toggle">
							<input type="checkbox" name="flowbie_chat_lead_conversion_enabled" value="1" <?php checked( $lead_conversion ); ?> />
							<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Enable lead conversion specialist', 'flowbie-wp' ); ?></span>
						</label>
					</div>
					<?php
					self::panel_form_field_select(
						'flowbie-chat-lead-form-booking',
						'flowbie_chat_lead_form_booking',
						__( 'Booking form', 'flowbie-wp' ),
						$form_options,
						(string) $lead_form_booking,
						'full'
					);
					self::panel_form_field_select(
						'flowbie-chat-lead-form-contact',
						'flowbie_chat_lead_form_contact',
						__( 'Contact form', 'flowbie-wp' ),
						$form_options,
						(string) $lead_form_contact,
						'full'
					);
					self::panel_form_field_select(
						'flowbie-chat-lead-form-pricing',
						'flowbie_chat_lead_form_pricing',
						__( 'Pricing / quote form', 'flowbie-wp' ),
						$form_options,
						(string) $lead_form_pricing,
						'full'
					);
					?>
				</div>
			</section>

			<?php // ── Content Sources ── ?>
			<section class="flowbie-schema-group flowbie-chat-settings-section" aria-labelledby="flowbie-chat-sources-heading">
				<h3 id="flowbie-chat-sources-heading" class="flowbie-chat-settings-section__title">
					<?php esc_html_e( 'Content Sources', 'flowbie-wp' ); ?>
				</h3>
				<p class="flowbie-field__note flowbie-chat-settings-section__intro">
					<?php esc_html_e( 'Chat indexes the intersection of checked post types here and post types enabled in the Flowbie sitemap (Include in XML). Unchecking a type removes it from chat even if it stays in the sitemap for SEO. Save to refresh the index cache.', 'flowbie-wp' ); ?>
				</p>

				<div class="flowbie-schema-grid">
					<div class="flowbie-schema-cell flowbie-schema-cell--full">
						<fieldset class="flowbie-field flowbie-field--stacked flowbie-chat-fieldset">
							<legend class="flowbie-field__label flowbie-field__label--above"><?php esc_html_e( 'Post types to index', 'flowbie-wp' ); ?></legend>
							<?php foreach ( $all_post_types as $pt ) : ?>
								<?php if ( $pt->name === 'attachment' ) continue; ?>
								<label class="flowbie-wp-panel-toggle flowbie-chat-index-toggle">
									<input
										type="checkbox"
										name="flowbie_chat_indexed_types[]"
										value="<?php echo esc_attr( $pt->name ); ?>"
										<?php checked( in_array( $pt->name, $indexed_types, true ) ); ?>
									/>
									<span class="flowbie-wp-panel-toggle__label">
										<?php echo esc_html( $pt->labels->singular_name ); ?>
										<code class="flowbie-chat-training-cpt-code">(<?php echo esc_html( $pt->name ); ?>)</code>
									</span>
								</label>
							<?php endforeach; ?>
						</fieldset>
					</div>

					<?php if ( ! empty( $all_categories ) ) : ?>
					<div class="flowbie-schema-cell flowbie-schema-cell--full">
						<div class="flowbie-field flowbie-field--select flowbie-field--stacked">
							<label class="flowbie-field__label flowbie-field__label--above"><?php esc_html_e( 'Exclude categories', 'flowbie-wp' ); ?></label>
							<select name="flowbie_chat_excluded_cats[]" multiple class="flowbie-field__control flowbie-field__control--multiselect">
								<?php foreach ( $all_categories as $cat ) : ?>
									<option value="<?php echo (int) $cat->term_id; ?>" <?php echo in_array( $cat->term_id, $excluded_cats, false ) ? 'selected' : ''; ?>>
										<?php echo esc_html( $cat->name ); ?>
									</option>
								<?php endforeach; ?>
							</select>
							<p class="flowbie-field__note"><?php esc_html_e( 'Hold Ctrl/Cmd to select multiple. Posts in these categories will be excluded from the index.', 'flowbie-wp' ); ?></p>
						</div>
					</div>
					<?php endif; ?>

					<div class="flowbie-schema-cell flowbie-schema-cell--full">
						<label class="flowbie-wp-panel-toggle">
							<input type="checkbox" name="flowbie_chat_full_content" value="1" <?php checked( $full_content ); ?> />
							<span class="flowbie-wp-panel-toggle__label"><?php esc_html_e( 'Include extended content (120 words instead of 40)', 'flowbie-wp' ); ?></span>
						</label>
						<p class="flowbie-field__note"><?php esc_html_e( 'Gives the assistant more context per page but uses more tokens per request.', 'flowbie-wp' ); ?></p>
					</div>
				</div>
			</section>
		</form>

		<div class="flowbie-wp-panel-footer">
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
				</button>
			</p>
		</div>
		<?php
	}

	// ── Knowledge Base tab ──────────────────────────────────────

	private static function render_chat_section_knowledge_base( array $chat_settings ): void {
		$form_id        = 'flowbie-wp-chat-kb-form';
		$knowledge_base = isset( $chat_settings['knowledge_base'] ) && is_array( $chat_settings['knowledge_base'] ) ? $chat_settings['knowledge_base'] : array();
		$entry_count    = 0;

		foreach ( $knowledge_base as $entry ) {
			$q = isset( $entry['question'] ) ? trim( (string) $entry['question'] ) : '';
			$a = isset( $entry['answer'] ) ? trim( (string) $entry['answer'] ) : '';
			if ( $q !== '' || $a !== '' ) {
				++$entry_count;
			}
		}

		if ( empty( $knowledge_base ) ) {
			$knowledge_base = array( array( 'question' => '', 'answer' => '', 'priority' => 'normal' ) );
		}
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Knowledge Base', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php
			echo esc_html(
				sprintf(
					/* translators: %d: number of saved Q&A pairs */
					_n(
						'%d Q&A pair saved. Add custom pairs prioritized over site content when answering matching questions.',
						'%d Q&A pairs saved. Add custom pairs prioritized over site content when answering matching questions.',
						$entry_count,
						'flowbie-wp'
					),
					$entry_count
				)
			);
			?>
		</p>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-chat-kb-form" autocomplete="off">
			<input type="hidden" name="action" value="flowbie_wp_save_chat_knowledge_base" />
			<?php wp_nonce_field( 'flowbie_wp_save_chat_knowledge_base', 'flowbie_wp_chat_kb_nonce' ); ?>

			<div class="flowbie-chat-kb-table-wrap">
				<table class="widefat striped flowbie-chat-kb-table">
					<thead>
						<tr>
							<th scope="col" class="flowbie-chat-kb-table__col-question"><?php esc_html_e( 'Question / Topic', 'flowbie-wp' ); ?></th>
							<th scope="col" class="flowbie-chat-kb-table__col-answer"><?php esc_html_e( 'Answer', 'flowbie-wp' ); ?></th>
							<th scope="col" class="flowbie-chat-kb-table__col-priority"><?php esc_html_e( 'Priority', 'flowbie-wp' ); ?></th>
							<th scope="col" class="flowbie-chat-kb-table__col-actions"><span class="screen-reader-text"><?php esc_html_e( 'Actions', 'flowbie-wp' ); ?></span></th>
						</tr>
					</thead>
					<tbody id="flowbie-chat-kb-entries">
						<?php foreach ( $knowledge_base as $i => $entry ) : ?>
							<?php self::render_chat_kb_table_row( (int) $i, $entry ); ?>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>

			<p class="flowbie-chat-kb-add-wrap">
				<button type="button" id="flowbie-chat-kb-add" class="button button-secondary flowbie-chat-kb-add">
					+ <?php esc_html_e( 'Add Row', 'flowbie-wp' ); ?>
				</button>
			</p>
		</form>

		<div class="flowbie-wp-panel-footer">
			<p class="flowbie-wp-settings__actions flowbie-wp-panel-footer__right">
				<button type="submit" form="<?php echo esc_attr( $form_id ); ?>" class="button button-primary flowbie-wp-settings__btn">
					<?php esc_html_e( 'Save Changes', 'flowbie-wp' ); ?>
				</button>
			</p>
		</div>

		<script>
		(function(){
			var container = document.getElementById('flowbie-chat-kb-entries');
			var addBtn    = document.getElementById('flowbie-chat-kb-add');
			if (!container || !addBtn) return;

			function rowHtml(idx) {
				return '<tr class="flowbie-chat-kb-row" data-index="'+idx+'">'
					+ '<td class="flowbie-chat-kb-table__col-question"><input type="text" name="flowbie_chat_kb['+idx+'][question]" class="flowbie-field__control" placeholder="What are your business hours?"></td>'
					+ '<td class="flowbie-chat-kb-table__col-answer"><textarea name="flowbie_chat_kb['+idx+'][answer]" class="flowbie-field__control" rows="2" placeholder="We are open Monday-Friday, 9am-5pm MST."></textarea></td>'
					+ '<td class="flowbie-chat-kb-table__col-priority"><select name="flowbie_chat_kb['+idx+'][priority]" class="flowbie-field__control"><option value="high">High</option><option value="normal" selected>Normal</option></select></td>'
					+ '<td class="flowbie-chat-kb-table__col-actions"><button type="button" class="button flowbie-chat-kb-remove" title="Remove">&times; Remove</button></td>'
					+ '</tr>';
			}

			addBtn.addEventListener('click', function(){
				var rows = container.querySelectorAll('.flowbie-chat-kb-row');
				var idx  = rows.length;
				container.insertAdjacentHTML('beforeend', rowHtml(idx));
			});

			container.addEventListener('click', function(e){
				if (e.target.classList.contains('flowbie-chat-kb-remove') || e.target.closest('.flowbie-chat-kb-remove')) {
					var row = e.target.closest('.flowbie-chat-kb-row');
					if (row && container.querySelectorAll('.flowbie-chat-kb-row').length > 1) {
						row.remove();
					}
				}
			});
		})();
		</script>
		<?php
	}

	/**
	 * @param array<string, mixed> $entry
	 */
	private static function render_chat_kb_table_row( int $index, array $entry ): void {
		$q = isset( $entry['question'] ) ? $entry['question'] : '';
		$a = isset( $entry['answer'] ) ? $entry['answer'] : '';
		$p = isset( $entry['priority'] ) ? $entry['priority'] : 'normal';
		?>
		<tr class="flowbie-chat-kb-row" data-index="<?php echo (int) $index; ?>">
			<td class="flowbie-chat-kb-table__col-question">
				<input
					type="text"
					name="flowbie_chat_kb[<?php echo (int) $index; ?>][question]"
					class="flowbie-field__control"
					value="<?php echo esc_attr( $q ); ?>"
					placeholder="<?php esc_attr_e( 'What are your business hours?', 'flowbie-wp' ); ?>"
				/>
			</td>
			<td class="flowbie-chat-kb-table__col-answer">
				<textarea
					name="flowbie_chat_kb[<?php echo (int) $index; ?>][answer]"
					class="flowbie-field__control"
					rows="2"
					placeholder="<?php esc_attr_e( 'We are open Monday-Friday, 9am-5pm MST.', 'flowbie-wp' ); ?>"
				><?php echo esc_textarea( $a ); ?></textarea>
			</td>
			<td class="flowbie-chat-kb-table__col-priority">
				<select name="flowbie_chat_kb[<?php echo (int) $index; ?>][priority]" class="flowbie-field__control">
					<option value="high" <?php selected( $p, 'high' ); ?>><?php esc_html_e( 'High', 'flowbie-wp' ); ?></option>
					<option value="normal" <?php selected( $p, 'normal' ); ?>><?php esc_html_e( 'Normal', 'flowbie-wp' ); ?></option>
				</select>
			</td>
			<td class="flowbie-chat-kb-table__col-actions">
				<button type="button" class="button flowbie-chat-kb-remove" title="<?php esc_attr_e( 'Remove', 'flowbie-wp' ); ?>">&times; <?php esc_html_e( 'Remove', 'flowbie-wp' ); ?></button>
			</td>
		</tr>
		<?php
	}

	// ── Demo tab ────────────────────────────────────────────────

	private static function render_chat_section_demo( bool $openrouter_ok ): void {
		$chat_settings = Flowbie_Wp_Chat::get_settings();
		$design        = Flowbie_Wp_Ai_Widget_Design::get_settings();
		$chat_ui       = isset( $design['chat_ui'] ) && is_array( $design['chat_ui'] ) ? $design['chat_ui'] : array();
		$user          = wp_get_current_user();
		$display_name  = $user->exists() ? $user->display_name : __( 'there', 'flowbie-wp' );
		$site_name     = get_bloginfo( 'name' );
		$starters      = Flowbie_Wp_Chat::conversation_starters( $chat_settings );
		$demo_classes  = array( 'flowbie-chat-widget', 'fcw-demo-inline' );
		$hide_map      = array(
			'type_badge'       => 'fcw-hide-type-badge',
			'source_pills'     => 'fcw-hide-source-pills',
			'confidence'       => 'fcw-hide-confidence',
			'cta_buttons'      => 'fcw-hide-cta-buttons',
			'suggestion_chips' => 'fcw-hide-suggestion-chips',
		);
		foreach ( $hide_map as $ui_key => $hide_class ) {
			if ( empty( $chat_ui[ $ui_key ] ) ) {
				$demo_classes[] = $hide_class;
			}
		}
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Flow Assist Demo', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Preview the same chat chrome visitors see on the frontend (greeting, starters, composer). Messages use the live RAG + sub-agent pipeline.', 'flowbie-wp' ); ?>
		</p>

		<?php if ( ! $openrouter_ok ) : ?>
			<div class="flowbie-wp-panel-info-box flowbie-wp-panel-info-box--error" role="alert">
				<p><?php esc_html_e( 'Demo unavailable: OpenRouter API key is not configured. Add it under Settings > Editor AI.', 'flowbie-wp' ); ?></p>
			</div>
		<?php endif; ?>

		<div class="fcw-demo-wrap">
			<div id="flowbie-chat-demo" class="<?php echo esc_attr( implode( ' ', $demo_classes ) ); ?>" aria-label="<?php esc_attr_e( 'Flow Assist sidebar preview', 'flowbie-wp' ); ?>">
				<div class="fai-sidebar-panel fcw-panel fcw-panel--sidebar fcw-demo-panel">
					<div class="fai-sidebar-panel__toolbar">
						<div class="fcw-demo-toolbar-actions">
							<button type="button" id="flowbie-chat-demo-clear" class="fcw-demo-toolbar-btn fcw-demo-clear-chat" aria-label="<?php esc_attr_e( 'Clear chat', 'flowbie-wp' ); ?>" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
							</button>
							<button type="button" id="flowbie-chat-demo-copy-log" class="fcw-demo-copy-log" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
								<?php esc_html_e( 'Copy log', 'flowbie-wp' ); ?>
							</button>
							<span class="fcw-demo-toolbar-btn" title="<?php esc_attr_e( 'Preview', 'flowbie-wp' ); ?>" aria-hidden="true">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
							</span>
						</div>
					</div>
					<div class="fai-sidebar-panel__body">
						<div class="fcw-sidebar-main">
							<div id="flowbie-chat-demo-empty" class="fcw-demo-empty">
								<div>
									<p class="fcw-demo-greeting"><?php echo esc_html( sprintf( __( 'Hello, %s', 'flowbie-wp' ), $display_name ) ); ?></p>
									<p class="fcw-demo-sub"><?php esc_html_e( 'How can I help you today?', 'flowbie-wp' ); ?></p>
								</div>
								<div class="fcw-demo-starters">
									<?php foreach ( $starters as $starter ) : ?>
										<button type="button" class="fcw-demo-starter" data-prompt="<?php echo esc_attr( $starter ); ?>" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
											<?php echo esc_html( $starter ); ?>
										</button>
									<?php endforeach; ?>
								</div>
							</div>
							<div id="flowbie-chat-demo-messages" class="fcw-messages" hidden></div>
							<form class="fcw-input-row fcw-demo-composer">
								<div class="fcw-demo-composer-shell">
									<textarea
										id="flowbie-chat-demo-input"
										class="fcw-textarea"
										rows="1"
										placeholder="<?php echo esc_attr( sprintf( __( 'Ask about %s…', 'flowbie-wp' ), $site_name ) ); ?>"
										<?php echo $openrouter_ok ? '' : 'disabled'; ?>
									></textarea>
									<div class="fcw-demo-composer-actions">
										<button type="button" id="flowbie-chat-demo-send" class="fcw-send" aria-label="<?php esc_attr_e( 'Hold to speak', 'flowbie-wp' ); ?>" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
											<span class="fcw-send__icon fcw-send__icon--send" aria-hidden="true">
												<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>
											</span>
										</button>
									</div>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}
}

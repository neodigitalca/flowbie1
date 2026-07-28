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

			<?php // ── Content Sources ── ?>
			<section class="flowbie-schema-group flowbie-chat-settings-section" aria-labelledby="flowbie-chat-sources-heading">
				<h3 id="flowbie-chat-sources-heading" class="flowbie-chat-settings-section__title">
					<?php esc_html_e( 'Content Sources', 'flowbie-wp' ); ?>
				</h3>
				<p class="flowbie-field__note flowbie-chat-settings-section__intro">
					<?php esc_html_e( 'Control which content feeds the assistant\'s knowledge. Changes take effect after the cache refreshes (~1 hour) or when a post is saved.', 'flowbie-wp' ); ?>
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
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Flow Assist Demo', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php esc_html_e( 'Test the chat widget here. Messages are processed through the same RAG + sub-agent pipeline your visitors will use.', 'flowbie-wp' ); ?>
		</p>

		<?php if ( ! $openrouter_ok ) : ?>
			<div class="flowbie-wp-panel-info-box flowbie-wp-panel-info-box--error" role="alert">
				<p><?php esc_html_e( 'Demo unavailable: OpenRouter API key is not configured. Add it under Settings > Editor AI.', 'flowbie-wp' ); ?></p>
			</div>
		<?php endif; ?>

		<div id="flowbie-chat-demo" class="fcwd">
			<div class="fcwd-header">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
				<span class="fcwd-header__title"><?php echo esc_html( get_bloginfo( 'name' ) ); ?> &mdash; <?php esc_html_e( 'Flow Assist', 'flowbie-wp' ); ?></span>
			</div>
			<div id="flowbie-chat-demo-messages" class="fcwd-messages"></div>
			<div class="fcwd-input-row">
				<input
					type="text"
					id="flowbie-chat-demo-input"
					class="fcwd-input"
					placeholder="<?php esc_attr_e( 'Ask Flow Assist something...', 'flowbie-wp' ); ?>"
					<?php echo $openrouter_ok ? '' : 'disabled'; ?>
				/>
				<button type="button" id="flowbie-chat-demo-send" class="fcwd-send" aria-label="<?php esc_attr_e( 'Hold to speak', 'flowbie-wp' ); ?>" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
					<span class="fcwd-send__icon fcwd-send__icon--send" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
					</span>
				</button>
			</div>
		</div>

		<style>
			.fcwd{border-radius:16px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.06);box-shadow:0 8px 40px rgba(0,0,0,.4)}
			.fcwd-header{display:flex;align-items:center;gap:8px;padding:14px 18px;background:#181818;border-bottom:1px solid rgba(255,255,255,.06);color:#e5e5e5;font-weight:600;font-size:13px}
			.fcwd-header svg{flex-shrink:0;opacity:.5}
			.fcwd-header__title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
			.fcwd-messages{min-height:280px;max-height:480px;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
			.fcwd-messages::-webkit-scrollbar{width:5px}
			.fcwd-messages::-webkit-scrollbar-track{background:transparent}
			.fcwd-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
			.fcwd-input-row{display:flex;gap:8px;padding:12px 18px;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
			.fcwd-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 14px;color:#e5e5e5;font-size:13px;outline:none;transition:border-color .2s}
			.fcwd-input:focus{border-color:rgba(255,255,255,.3)}
			.fcwd-input::placeholder{color:rgba(255,255,255,.65)}
			.fcwd-input:disabled{opacity:.4;cursor:not-allowed}
			.fcwd-send{position:relative;width:40px;height:40px;border-radius:10px;border:none;background:#333;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:none;user-select:none;transition:background .15s,transform .1s}
			.fcwd-send:hover{background:#444;transform:translateY(-1px)}
			.fcwd-send:disabled{opacity:.3;cursor:not-allowed;transform:none}

			.fcwd-user{align-self:flex-end;max-width:80%;padding:10px 14px;border-radius:14px 14px 4px 14px;background:#2a2a2a;color:#fff;font-size:13px;line-height:1.5;animation:fcwdFadeIn .25s ease}

			.fcwd-card{border-radius:12px;padding:14px 16px;background:rgba(255,255,255,.03);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.07);max-width:100%;font-size:13px;line-height:1.6;color:#e5e5e5;animation:fcwdSlideIn .3s ease}

			.fcwd-title-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
			.fcwd-type-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.78)}
			.fcwd-title{font-weight:600;font-size:14px;color:#f5f5f5}
			.fcwd-title strong{font-weight:700;color:#fff}
			.fcwd-body{color:rgba(229,229,229,.8);margin-top:4px}
			.fcwd-body a{color:#e5e7eb;text-decoration:underline;text-underline-offset:2px}
			.fcwd-body a:hover{color:#fff}
			.fcwd-body strong{font-weight:600;color:#f5f5f5}
			.fcwd-confidence{font-size:11px;color:rgba(255,255,255,.65);margin-top:6px;font-style:italic}

			.fcwd-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
			.fcwd-pill{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:12px;text-decoration:none;color:#e5e7eb;transition:all .15s}
			.fcwd-pill:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff;text-decoration:none}

			.fcwd-cta-wrap{margin-top:12px}
			.fcwd-cta{display:inline-block;padding:8px 18px;border-radius:8px;background:#333;color:#fff;font-size:12px;font-weight:600;text-decoration:none;transition:background .15s,transform .1s}
			.fcwd-cta:hover{background:#444;transform:translateY(-1px);color:#fff;text-decoration:none}

			.fcwd-topics{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
			.fcwd-chip{padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#e5e7eb;font-size:11px;cursor:pointer;transition:all .15s}
			.fcwd-chip:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);color:#fff}

			.fcwd-thinking-steps{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
			.fcwd-thinking-step{display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.5;color:rgba(240,240,240,.8)}
			.fcwd-thinking-step-icon{flex-shrink:0;width:1.25rem;text-align:center;line-height:1.5}
			.fcwd-thinking-step--running .fcwd-thinking-step-icon{color:#60a5fa}
			.fcwd-thinking-step--done .fcwd-thinking-step-icon{color:#4ade80}
			.fcwd-thinking-step--pending .fcwd-thinking-step-icon{color:rgba(255,255,255,.65)}
			.fcwd-thinking-step-icon--brain{width:2rem;display:inline-flex;align-items:center;justify-content:center}
			.fcwd-thinking-step-icon--brain svg{animation:fcwdBrainPulse 1.4s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(34,211,238,.85))}
			.fcwd-card--thinking-active{border-color:rgba(34,211,238,.35);animation:fcwdThinkingBreathe 2.8s ease-in-out infinite}
			@keyframes fcwdBrainPulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
			@keyframes fcwdThinkingBreathe{0%,100%{border-color:rgba(34,211,238,.25);box-shadow:0 0 0 rgba(34,211,238,0)}50%{border-color:rgba(34,211,238,.45);box-shadow:0 0 12px rgba(34,211,238,.12)}}
			.fcwd-status{font-size:12px;color:rgba(255,255,255,.4);font-style:italic;padding:10px 0;animation:fcwdPulse 1.8s ease-in-out infinite}
			@keyframes fcwdPulse{0%,100%{opacity:.4}50%{opacity:1}}
			@keyframes fcwdFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
			@keyframes fcwdSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
		</style>

		<script>
		(function(){
			window.flowbieVoiceSafeUnlock=window.flowbieVoiceSafeUnlock||function(){return Promise.resolve();};
			window.flowbieVoiceSafeAckPlayback=window.flowbieVoiceSafeAckPlayback||function(){};
			window.flowbieVoicePresentCard=window.flowbieVoicePresentCard||function(_c,_m,cb){if(cb&&cb.append)cb.append();if(cb&&cb.finish)cb.finish();return Promise.resolve();};
			var ajaxUrl=<?php echo wp_json_encode( admin_url( 'admin-ajax.php' ) ); ?>;
			var streamNonce=<?php echo wp_json_encode( wp_create_nonce( 'flowbie_chat_stream' ) ); ?>;
			var msgs=document.getElementById('flowbie-chat-demo-messages');
			var input=document.getElementById('flowbie-chat-demo-input');
			var btn=document.getElementById('flowbie-chat-demo-send');
			var history=[],loading=false;
			function getChatSessionId(){
				var key='flowbie_chat_session_id';
				var id=sessionStorage.getItem(key);
				if(!id){
					id='csess_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
					sessionStorage.setItem(key,id);
				}
				return id;
			}
			if(!msgs||!input||!btn)return;
			btn.addEventListener('click',function(){
				if(input.value.trim()){send();}
			});
			function voiceUnlock(){
				if(typeof window.flowbieVoiceSafeUnlock==='function'){return window.flowbieVoiceSafeUnlock();}
				return Promise.resolve();
			}
			function voiceAckPlaybackParallel(text){
				if(typeof window.flowbieVoiceSafeAckPlayback==='function'){window.flowbieVoiceSafeAckPlayback(text);return;}
				if(window.FlowbieVoice&&typeof window.FlowbieVoice.playbackAckParallel==='function'){FlowbieVoice.playbackAckParallel(text);}
			}
			var FCWD_BRAIN_SVG=<?php echo wp_json_encode( self::brand_icon_svg( '#22d3ee', 24 ) ); ?>;
			function fcwdStepIcon(st){if(st==='done')return '\u2713';if(st==='error')return '\u2717';return '\u25cb';}
			function fcwdApplyStepIcon(iconEl,st){
				iconEl.className='fcwd-thinking-step-icon';
				if(st==='running'&&FCWD_BRAIN_SVG){iconEl.className+=' fcwd-thinking-step-icon--brain';iconEl.innerHTML=FCWD_BRAIN_SVG;}
				else{iconEl.textContent=fcwdStepIcon(st);}
			}
			function fcwdBuildStepsList(steps){
				var ul=document.createElement('ul');ul.className='fcwd-thinking-steps';
				(steps||[]).forEach(function(step,idx){
					var st=step.status||'pending';
					var li=document.createElement('li');li.className='fcwd-thinking-step fcwd-thinking-step--'+st;
					li.setAttribute('data-step-index',String(idx));
					var icon=document.createElement('span');fcwdApplyStepIcon(icon,st);
					var lbl=document.createElement('span');lbl.className='fcwd-thinking-step-label';lbl.textContent=step.label||'Step '+(idx+1);
					li.appendChild(icon);li.appendChild(lbl);ul.appendChild(li);
				});
				return ul;
			}
			function fcwdAppendWorkflowCard(card){
				var c=document.createElement('div');c.className='fcwd-card fcwd-card--thinking-active';
				var tr=document.createElement('div');tr.className='fcwd-title-row';
				var badge=document.createElement('span');badge.className='fcwd-type-badge';badge.textContent='working';
				var title=document.createElement('span');title.className='fcwd-title';title.innerHTML=renderMd(card.title||'Working on it\u2026');
				tr.appendChild(badge);tr.appendChild(title);c.appendChild(tr);
				var body=document.createElement('div');body.className='fcwd-body';
				if(card.body){body.innerHTML=renderMd(card.body);}else{body.style.display='none';}
				c.appendChild(body);
				var stepsList=fcwdBuildStepsList(card.steps||[]);c.appendChild(stepsList);
				msgs.appendChild(c);scrollDown();
				return {root:c,cardEl:c,badgeEl:badge,titleEl:title,bodyEl:body,stepsList:stepsList};
			}
			function fcwdSetWorkflowStepStatus(shell,idx,status){
				if(!shell||!shell.stepsList)return;
				var li=shell.stepsList.querySelector('[data-step-index="'+idx+'"]');
				if(!li)return;
				li.className='fcwd-thinking-step fcwd-thinking-step--'+status;
				var icon=li.children[0];if(icon)fcwdApplyStepIcon(icon,status);
			}
			function fcwdSetWorkflowCardActive(shell,active){
				if(shell&&shell.cardEl){shell.cardEl.classList.toggle('fcwd-card--thinking-active',!!active);}
			}
			function fcwdApplyCardBadge(badgeEl,t){badgeEl.textContent=t||'answer';}
			function fcwdPopulateCardExtras(shell,card){
				if(!shell||!shell.cardEl)return;
				var c=shell.cardEl;
				var old=c.querySelectorAll('.fcwd-confidence,.fcwd-links,.fcwd-cta-wrap,.fcwd-topics');
				old.forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n);});
				var confMap={high:'High confidence',medium:'Based on site content',low:'Limited information'};
				var conf=document.createElement('div');conf.className='fcwd-confidence';
				conf.textContent=confMap[card.confidence]||confMap.medium;c.appendChild(conf);
			}
			function fcwdThinkingHost(){
				return {
					appendWorkflowCard:fcwdAppendWorkflowCard,
					setWorkflowStepStatus:fcwdSetWorkflowStepStatus,
					setWorkflowCardActive:fcwdSetWorkflowCardActive,
					applyCardBadge:fcwdApplyCardBadge,
					renderMd:renderMd,
					populateCardExtras:fcwdPopulateCardExtras,
					scrollDown:scrollDown
				};
			}
			function presentCardWithVoice(card,userMessage,opts){
				opts=opts||{};
				var shell=opts.shell;
				var host=fcwdThinkingHost();
				var finish=function(){
					history.push({role:'assistant',content:card.body||card.title});
					if(typeof opts.onDone==='function'){opts.onDone();}
				};
				if(shell&&window.FlowbieThinkingCard){
					FlowbieThinkingCard.finalizeToCard(shell,card,host);
					finish();
					return FlowbieThinkingCard.narrateAndVoiceStep(card,userMessage,shell,host);
				}
				if(typeof window.flowbieVoicePresentCard==='function'){
					return window.flowbieVoicePresentCard(card,userMessage,{
						append:function(){appendCard(card);},
						finish:finish
					});
				}
				appendCard(card);
				finish();
				return Promise.resolve();
			}

			input.addEventListener('keydown',function(e){
				if(e.key==='Enter'){
					voiceUnlock();
					e.preventDefault();
					send();
				}
			});

			function bindVoiceWhenReady(){
				if(!window.FlowbieVoice||typeof window.FlowbieVoice.bindPtt!=='function'||typeof window.flowbieVoiceUnlock!=='function'){
					setTimeout(bindVoiceWhenReady,50);
					return;
				}
				FlowbieVoice.bindPtt(btn,input,{
					isLoading:function(){return loading;},
					onTranscript:function(text){deliverMessage(text);},
					onError:function(msg){showVoiceToast(msg);}
				});
			}
			bindVoiceWhenReady();

			function showVoiceToast(msg){
				var t=document.createElement('div');
				t.className='flowbie-voice-toast';
				t.textContent=msg;
				msgs.appendChild(t);
				setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},4500);
			}

			function deliverMessage(text){
				if(!text||loading)return;
				voiceUnlock();
				input.value='';
				if(window.FlowbieVoice&&typeof window.FlowbieVoice.updateSendMicVisibility==='function'){
					FlowbieVoice.updateSendMicVisibility(input,btn);
				}
				voiceAckPlaybackParallel(text);
				appendUser(text);
				history.push({role:'user',content:text});
				runStream(text);
			}

			function send(){
				var text=input.value.trim();
				if(!text||loading)return;
				deliverMessage(text);
			}

			function runStream(text){
				loading=true;btn.disabled=true;
				var host=fcwdThinkingHost();
				var thinkingShell=window.FlowbieThinkingCard?FlowbieThinkingCard.createThinkingCard(host,{stream:true}):null;
				var url=ajaxUrl+'?action=flowbie_chat_stream&_nonce='+encodeURIComponent(streamNonce);
				fetch(url,{
					method:'POST',
					headers:{'Content-Type':'application/json'},
					body:JSON.stringify({
						message:text,
						history:history.slice(-10),
						session_id:getChatSessionId(),
						source:'demo',
						page_url:''
					})
				}).then(function(res){
					if(!res.ok)throw new Error('HTTP '+res.status);
					var reader=res.body.getReader();
					var decoder=new TextDecoder();
					var buf='';
					function pump(){
						return reader.read().then(function(result){
							if(result.done)return;
							buf+=decoder.decode(result.value,{stream:true});
							var lines=buf.split('\n');
							buf=lines.pop();
							lines.forEach(function(line){
								line=line.trim();if(!line)return;
								var evt;try{evt=JSON.parse(line);}catch(_){return;}
								if(evt.status==='done'&&evt.card){
									presentCardWithVoice(evt.card,text,{
										shell:thinkingShell,
										onDone:function(){loading=false;btn.disabled=false;input.focus();}
									});
								}else if(evt.label&&thinkingShell&&window.FlowbieThinkingCard){
									FlowbieThinkingCard.advanceStreamLabel(thinkingShell,host,evt.label);
								}
							});
							return pump();
						});
					}
					return pump();
				}).catch(function(){
					loading=false;btn.disabled=false;
					if(window.FlowbieVoice){FlowbieVoice.updateSendMicVisibility(input,btn);}
					presentCardWithVoice({type:'not-found',title:'Connection error',body:'Could not reach the server.',confidence:'low'},text,{
						shell:thinkingShell,
						onDone:function(){input.focus();}
					});
				});
			}

			function appendUser(text){
				var d=document.createElement('div');d.className='fcwd-user';
				d.textContent=text;msgs.appendChild(d);scrollDown();
			}

			function appendStatus(label){
				var d=document.createElement('div');d.className='fcwd-status';
				d.textContent=label;msgs.appendChild(d);scrollDown();return d;
			}
			function updateStatus(el,label){if(el)el.textContent=label;scrollDown();}

			function appendCard(card){
				var c=document.createElement('div');c.className='fcwd-card';
				var tr=document.createElement('div');tr.className='fcwd-title-row';
				var badge=document.createElement('span');
				badge.className='fcwd-type-badge';
				badge.textContent=card.type||'answer';
				var title=document.createElement('span');title.className='fcwd-title';title.innerHTML=renderMd(card.title||'');
				tr.appendChild(badge);tr.appendChild(title);c.appendChild(tr);

				if(card.body){var body=document.createElement('div');body.className='fcwd-body';body.innerHTML=renderMd(card.body);c.appendChild(body);}

				var confMap={high:'High confidence',medium:'Based on site content',low:'Limited information'};
				var conf=document.createElement('div');conf.className='fcwd-confidence';
				conf.textContent=confMap[card.confidence]||confMap.medium;c.appendChild(conf);

				if(card.links&&card.links.length){
					var lw=document.createElement('div');lw.className='fcwd-links';
					card.links.forEach(function(link){
						var a=document.createElement('a');a.className='fcwd-pill';a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=link.label;lw.appendChild(a);
					});c.appendChild(lw);
				}
				if(card.cta&&card.cta.url){
					var cw=document.createElement('div');cw.className='fcwd-cta-wrap';
					var ca=document.createElement('a');ca.className='fcwd-cta';ca.href=card.cta.url;ca.target='_blank';ca.rel='noopener noreferrer';ca.textContent=card.cta.label||'Learn more';
					cw.appendChild(ca);c.appendChild(cw);
				}
				if(card.relatedTopics&&card.relatedTopics.length){
					var tw=document.createElement('div');tw.className='fcwd-topics';
					card.relatedTopics.forEach(function(topic){
						var chip=document.createElement('button');chip.type='button';chip.className='fcwd-chip';chip.textContent=topic;
						chip.addEventListener('click',function(){input.value=topic;send();});
						tw.appendChild(chip);
					});c.appendChild(tw);
				}
				msgs.appendChild(c);scrollDown();
			}

			function removeEl(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
			function scrollDown(){msgs.scrollTop=msgs.scrollHeight;}
			function renderMd(text){
				var d=document.createElement('div');d.textContent=text;var s=d.innerHTML;
				s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
				s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
				s=s.replace(/\n/g,'<br>');return s;
			}
		})();
		</script>
		<?php
	}
}

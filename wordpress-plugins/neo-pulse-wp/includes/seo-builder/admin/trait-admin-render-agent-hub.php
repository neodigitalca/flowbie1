<?php
/**
 * Agent Hub admin render.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Agent_Hub {

	public static function render_agent_hub_page(): void {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/seo-builder/admin/class-neo-pulse-wp-seo-blocks-list-table.php';

		$list_table = new Neo_Pulse_Wp_Seo_Blocks_List_Table();
		$list_table->prepare_items();

		$counts = $list_table->get_status_counts();
		$status = isset( $_GET['block_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['block_status'] ) ) : 'all';
		if ( ! in_array( $status, array( 'all', 'draft', 'published', 'needs_optimize' ), true ) ) {
			$status = 'all';
		}

		$base_url = admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' );
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-agent-hub', 'neo-pulse-wp-agent-hub' );
		?>
			<div id="neo-pulse-agent-hub">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Block Builder', 'neo-pulse-wp' ); ?></h1>
			<a href="#" class="page-title-action" id="neo-pulse-agent-hub-add-row"><?php esc_html_e( 'Add row', 'neo-pulse-wp' ); ?></a>
			<hr class="wp-header-end" />

			<p class="description neo-pulse-wp-agent-hub__note">
				<?php esc_html_e( 'Manage SEO content blocks. Saving a block creates or updates an Elementor library section titled from the block theme.', 'neo-pulse-wp' ); ?>
			</p>

			<ul class="subsubsub">
				<?php
				$view_keys = array_merge( array( 'all' ), Neo_Pulse_Wp_Seo_Blocks_Storage::STATUSES );
				$labels    = array(
					'all'            => __( 'All', 'neo-pulse-wp' ),
					'draft'          => __( 'Draft', 'neo-pulse-wp' ),
					'published'      => __( 'Published', 'neo-pulse-wp' ),
					'needs_optimize' => __( 'Needs optimize', 'neo-pulse-wp' ),
				);
				$parts = array();
				foreach ( $view_keys as $key ) {
					$url   = add_query_arg( 'block_status', $key, $base_url );
					$count = isset( $counts[ $key ] ) ? (int) $counts[ $key ] : 0;
					$text  = ( $labels[ $key ] ?? $key ) . ' (' . $count . ')';
					if ( $status === $key || ( 'all' === $key && ( $status === '' || $status === 'all' ) ) ) {
						$parts[] = '<li class="' . esc_attr( $key ) . '"><a href="' . esc_url( $url ) . '" class="current" aria-current="page">' . esc_html( $text ) . '</a></li>';
					} else {
						$parts[] = '<li class="' . esc_attr( $key ) . '"><a href="' . esc_url( $url ) . '">' . esc_html( $text ) . '</a></li>';
					}
				}
				echo wp_kses_post( implode( ' | ', $parts ) );
				?>
			</ul>

			<?php $list_table->search_box( __( 'Search SEO blocks', 'neo-pulse-wp' ), 'seo-block' ); ?>

			<form method="get" id="neo-pulse-agent-hub-list-form">
				<input type="hidden" name="page" value="neo-pulse-wp-agent-hub" />
				<input type="hidden" name="block_status" value="<?php echo esc_attr( $status ); ?>" />
				<?php $list_table->display(); ?>
			</form>
			</div>
		<?php
		self::neo_pulse_group_shell_close();
	}

	public static function render_agent_hub_edit_page(): void {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}

		$block_id = isset( $_GET['block_id'] ) ? absint( $_GET['block_id'] ) : 0;
		if ( $block_id < 1 ) {
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' ) );
			exit;
		}

		$statuses  = Neo_Pulse_Wp_Seo_Blocks_Storage::STATUSES;
		$list_url  = admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' );
		self::neo_pulse_group_shell_open( 'neo-pulse-wp-agent-hub-edit', 'neo-pulse-wp-agent-hub neo-pulse-agent-hub-edit-screen' );
		?>
			<div id="neo-pulse-agent-hub-edit-wrap">
				<?php self::render_agent_hub_builder_shell( $statuses, $list_url ); ?>
			</div>
		<?php
		self::neo_pulse_group_shell_close();
	}

	/**
	 * Full-page SEO block builder (no modal).
	 *
	 * @param array<int,string> $statuses Block status options.
	 * @param string            $list_url Back link to list screen.
	 */
	private static function render_agent_hub_builder_shell( array $statuses, string $list_url ): void {
		?>
		<div id="neo-pulse-agent-hub-builder" class="neo-pulse-agent-hub-builder-page">
			<header class="neo-pulse-agent-hub-builder-page__header">
				<div class="neo-pulse-agent-hub-builder-page__header-main">
					<a class="neo-pulse-agent-hub-builder-page__back" href="<?php echo esc_url( $list_url ); ?>" aria-label="<?php esc_attr_e( 'Back to list', 'neo-pulse-wp' ); ?>">&larr;</a>
					<h2 id="neo-pulse-agent-hub-modal-title"><?php esc_html_e( 'Edit SEO block', 'neo-pulse-wp' ); ?></h2>
					<span id="neo-pulse-agent-hub-context-badge" class="neo-pulse-agent-hub-context-badge is-independent" hidden></span>
				</div>
			</header>

			<nav class="neo-pulse-builder-tabs" role="tablist">
				<button type="button" class="neo-pulse-builder-tabs__tab is-active" data-tab="layout" role="tab" aria-selected="true"><?php esc_html_e( 'Layout', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-builder-tabs__tab" data-tab="settings" role="tab" aria-selected="false"><?php esc_html_e( 'Settings', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-builder-tabs__tab" data-tab="responsive" role="tab" aria-selected="false"><?php esc_html_e( 'Responsive', 'neo-pulse-wp' ); ?></button>
				<button type="button" class="neo-pulse-builder-tabs__tab" data-tab="agent" role="tab" aria-selected="false"><?php esc_html_e( 'Agent', 'neo-pulse-wp' ); ?></button>
			</nav>

			<div class="neo-pulse-builder-body">
				<div class="neo-pulse-builder-main">
					<div class="neo-pulse-builder-tab-panel is-active" data-panel="layout" role="tabpanel">
						<div class="neo-pulse-builder-main-view-stack">
							<div id="neo-pulse-builder-layout-view" class="neo-pulse-builder-main-view is-active">
								<div class="neo-pulse-builder-layout-toolbar">
									<button type="button" class="button button-primary" id="neo-pulse-builder-add-slot"><?php esc_html_e( 'Add block', 'neo-pulse-wp' ); ?></button>
									<div class="neo-pulse-builder-field neo-pulse-builder-grid-size">
										<label for="neo-pulse-builder-grid-rows"><?php esc_html_e( 'Rows', 'neo-pulse-wp' ); ?></label>
										<input type="number" id="neo-pulse-builder-grid-rows" class="neo-pulse-builder-field__control" min="1" max="24" value="3" />
									</div>
									<div class="neo-pulse-builder-field neo-pulse-builder-grid-size">
										<label for="neo-pulse-builder-grid-cols"><?php esc_html_e( 'Columns', 'neo-pulse-wp' ); ?></label>
										<input type="number" id="neo-pulse-builder-grid-cols" class="neo-pulse-builder-field__control" min="1" max="24" value="3" />
									</div>
								</div>
								<div id="neo-pulse-builder-layout-palette" class="neo-pulse-builder-layout-palette"></div>
								<div id="neo-pulse-builder-layout-grid" class="neo-pulse-builder-layout-canvas"></div>
								<div id="neo-pulse-builder-layout-cell-settings" class="neo-pulse-builder-layout-cell-settings" hidden></div>
								<p id="neo-pulse-builder-layout-hint" class="neo-pulse-builder-layout-hint"><?php esc_html_e( 'Click a block to edit. Drop items onto a cell. Drag chips within a cell to reorder.', 'neo-pulse-wp' ); ?></p>
							</div>
							<?php self::render_agent_hub_block_editor_view(); ?>
						</div>
					</div>

					<div class="neo-pulse-builder-tab-panel" data-panel="settings" role="tabpanel" hidden>
						<div id="neo-pulse-builder-settings">
							<div class="neo-pulse-builder-group" data-group="identity">
								<h3 class="neo-pulse-builder-group__title"><?php esc_html_e( 'Block identity', 'neo-pulse-wp' ); ?></h3>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-id-display"><?php esc_html_e( 'Block ID', 'neo-pulse-wp' ); ?></label>
									<span class="neo-pulse-builder-field__value" id="neo-pulse-agent-hub-field-id-display">—</span>
								</div>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-title"><?php esc_html_e( 'Theme / title', 'neo-pulse-wp' ); ?></label>
									<input type="text" class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-title" name="title" required />
								</div>
							</div>
							<div class="neo-pulse-builder-group" data-group="seo-intent">
								<h3 class="neo-pulse-builder-group__title"><?php esc_html_e( 'SEO intent', 'neo-pulse-wp' ); ?></h3>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-focus-keyword"><?php esc_html_e( 'Focus keyword', 'neo-pulse-wp' ); ?></label>
									<input type="text" class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-focus-keyword" name="focus_keyword" />
								</div>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-h2"><?php esc_html_e( 'H2', 'neo-pulse-wp' ); ?></label>
									<input type="text" class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-h2" name="h2" />
								</div>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-topic-focus"><?php esc_html_e( 'Topic focus', 'neo-pulse-wp' ); ?></label>
									<textarea class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-topic-focus" name="topic_focus" rows="3"></textarea>
								</div>
							</div>
							<div class="neo-pulse-builder-group" data-group="page-context">
								<h3 class="neo-pulse-builder-group__title"><?php esc_html_e( 'Page context', 'neo-pulse-wp' ); ?></h3>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-primary-post"><?php esc_html_e( 'Primary page', 'neo-pulse-wp' ); ?></label>
									<input type="search" class="neo-pulse-builder-field__control neo-pulse-agent-hub-primary-post-search" id="neo-pulse-agent-hub-primary-post-search" placeholder="<?php esc_attr_e( 'Search pages and posts…', 'neo-pulse-wp' ); ?>" autocomplete="off" />
									<select class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-primary-post" name="primary_post_id">
										<option value="0"><?php esc_html_e( 'None (independent block)', 'neo-pulse-wp' ); ?></option>
									</select>
								</div>
								<div id="neo-pulse-agent-hub-primary-post-summary" class="neo-pulse-agent-hub-primary-post-summary" hidden></div>
							</div>
							<div class="neo-pulse-builder-group" data-group="publish">
								<h3 class="neo-pulse-builder-group__title"><?php esc_html_e( 'Publish', 'neo-pulse-wp' ); ?></h3>
								<div class="neo-pulse-builder-field">
									<label for="neo-pulse-agent-hub-field-status"><?php esc_html_e( 'Status', 'neo-pulse-wp' ); ?></label>
									<select class="neo-pulse-builder-field__control" id="neo-pulse-agent-hub-field-status" name="status">
										<?php foreach ( $statuses as $status_option ) : ?>
											<option value="<?php echo esc_attr( $status_option ); ?>"><?php echo esc_html( ucfirst( str_replace( '_', ' ', $status_option ) ) ); ?></option>
										<?php endforeach; ?>
									</select>
								</div>
							</div>
							<div class="neo-pulse-builder-group neo-pulse-agent-hub-builder-page__library-wrap" data-group="library" hidden>
								<h3 class="neo-pulse-builder-group__title"><?php esc_html_e( 'Library', 'neo-pulse-wp' ); ?></h3>
								<div class="neo-pulse-builder-field">
									<label><?php esc_html_e( 'Template', 'neo-pulse-wp' ); ?></label>
									<a href="#" id="neo-pulse-agent-hub-field-library" class="neo-pulse-builder-field__value neo-pulse-builder-field__link" target="_blank" rel="noopener"><?php esc_html_e( 'Edit template', 'neo-pulse-wp' ); ?></a>
								</div>
							</div>
						</div>
					</div>

					<div class="neo-pulse-builder-tab-panel" data-panel="responsive" role="tabpanel" hidden>
						<div id="neo-pulse-builder-responsive"></div>
					</div>

					<div class="neo-pulse-builder-tab-panel" data-panel="agent" role="tabpanel" hidden>
						<div class="neo-pulse-builder-agent-assist">
							<?php if ( Neo_Pulse_Wp_OpenRouter::get_api_key() === '' ) : ?>
								<div class="neo-pulse-builder-agent-assist__alert" role="alert">
									<p><?php esc_html_e( 'Agent requires an OpenRouter API key. Configure it under Settings > Editor AI.', 'neo-pulse-wp' ); ?></p>
								</div>
							<?php endif; ?>
							<div class="neo-pulse-builder-agent-assist__chat">
								<div class="neo-pulse-builder-agent-assist__messages" id="neo-pulse-builder-agent-messages"></div>
								<div class="neo-pulse-builder-agent-assist__center" id="neo-pulse-builder-agent-center">
									<h3 class="neo-pulse-builder-agent-assist__brand"><?php esc_html_e( 'Block Agent', 'neo-pulse-wp' ); ?></h3>
									<p class="neo-pulse-builder-agent-assist__subtitle"><?php esc_html_e( 'Generate and optimize this SEO block with AI', 'neo-pulse-wp' ); ?></p>
									<div class="neo-pulse-builder-agent-assist__suggestions" id="neo-pulse-builder-agent-suggestions">
										<button type="button" class="neo-pulse-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Generate a full block from my topic focus and focus keyword', 'neo-pulse-wp' ); ?>"><?php esc_html_e( 'Generate full block', 'neo-pulse-wp' ); ?></button>
										<button type="button" class="neo-pulse-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Optimize copy for the focus keyword', 'neo-pulse-wp' ); ?>"><?php esc_html_e( 'Optimize copy', 'neo-pulse-wp' ); ?></button>
										<button type="button" class="neo-pulse-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Suggest layout and grid placement for these slots', 'neo-pulse-wp' ); ?>"><?php esc_html_e( 'Suggest layout', 'neo-pulse-wp' ); ?></button>
										<button type="button" class="neo-pulse-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Analyze this block for SEO gaps', 'neo-pulse-wp' ); ?>"><?php esc_html_e( 'Analyze SEO', 'neo-pulse-wp' ); ?></button>
									</div>
								</div>
								<div class="neo-pulse-builder-agent-assist__input-wrap">
									<div class="neo-pulse-builder-agent-assist__input-row">
										<textarea id="neo-pulse-builder-agent-input" class="neo-pulse-builder-agent-assist__input" rows="3" placeholder="<?php esc_attr_e( 'Describe what you need for this block…', 'neo-pulse-wp' ); ?>" autocomplete="off" <?php echo Neo_Pulse_Wp_OpenRouter::get_api_key() === '' ? 'disabled' : ''; ?>></textarea>
										<button type="button" id="neo-pulse-builder-agent-send" class="neo-pulse-builder-agent-assist__send" aria-label="<?php esc_attr_e( 'Send', 'neo-pulse-wp' ); ?>" <?php echo Neo_Pulse_Wp_OpenRouter::get_api_key() === '' ? 'disabled' : ''; ?>>&#8594;</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<aside class="neo-pulse-builder-preview">
					<h3 class="neo-pulse-builder-preview__title"><?php esc_html_e( 'Preview', 'neo-pulse-wp' ); ?></h3>
					<div id="neo-pulse-builder-preview" class="neo-pulse-builder-preview__body"></div>
				</aside>
			</div>

			<form id="neo-pulse-agent-hub-modal-form" class="neo-pulse-agent-hub-builder-page__form">
				<input type="hidden" name="id" id="neo-pulse-agent-hub-field-id" value="0" />
				<footer class="neo-pulse-agent-hub-builder-page__actions">
					<button type="button" class="button" id="neo-pulse-agent-hub-modal-optimize"><?php esc_html_e( 'Optimize', 'neo-pulse-wp' ); ?></button>
					<button type="button" class="button button-primary" id="neo-pulse-agent-hub-modal-save"><?php esc_html_e( 'Save', 'neo-pulse-wp' ); ?></button>
					<button type="button" class="button" id="neo-pulse-agent-hub-modal-download-json"><?php esc_html_e( 'Download JSON', 'neo-pulse-wp' ); ?></button>
					<button type="button" class="button" id="neo-pulse-agent-hub-modal-save-exit"><?php esc_html_e( 'Save and exit', 'neo-pulse-wp' ); ?></button>
					<a href="<?php echo esc_url( $list_url ); ?>" class="button neo-pulse-agent-hub-builder-page__cancel"><?php esc_html_e( 'Cancel', 'neo-pulse-wp' ); ?></a>
				</footer>
			</form>
		</div>
		<?php
	}

	/**
	 * Block editor view (swapped in place of layout grid inside Layout tab).
	 */
	private static function render_agent_hub_block_editor_view(): void {
		?>
		<div id="neo-pulse-builder-block-editor-view" class="neo-pulse-builder-main-view neo-pulse-block-editor-view">
			<header class="neo-pulse-block-editor-view__header">
				<div class="neo-pulse-block-editor-view__header-main">
					<button type="button" class="neo-pulse-block-editor-view__back" id="neo-pulse-block-editor-back">&larr; <?php esc_html_e( 'Back to layout', 'neo-pulse-wp' ); ?></button>
					<h2 id="neo-pulse-slot-editor-title"><?php esc_html_e( 'Block editor', 'neo-pulse-wp' ); ?></h2>
					<span id="neo-pulse-slot-editor-placement" class="neo-pulse-block-editor-view__placement" hidden></span>
				</div>
			</header>
			<div class="neo-pulse-block-editor-view__body">
				<aside class="neo-pulse-block-editor-view__types" id="neo-pulse-slot-editor-types" aria-label="<?php esc_attr_e( 'Block type', 'neo-pulse-wp' ); ?>"></aside>
				<main class="neo-pulse-block-editor-view__form-wrap">
					<div id="neo-pulse-slot-editor-form" class="neo-pulse-block-editor-view__form"></div>
				</main>
			</div>
			<footer class="neo-pulse-block-editor-view__footer">
				<button type="button" class="neo-pulse-slot-editor-btn neo-pulse-slot-editor-remove" id="neo-pulse-slot-editor-remove"><?php esc_html_e( 'Remove block', 'neo-pulse-wp' ); ?></button>
				<div class="neo-pulse-block-editor-view__footer-actions">
					<button type="button" class="neo-pulse-slot-editor-btn neo-pulse-slot-editor-cancel"><?php esc_html_e( 'Cancel', 'neo-pulse-wp' ); ?></button>
					<button type="button" class="neo-pulse-slot-editor-btn neo-pulse-slot-editor-done" id="neo-pulse-slot-editor-done"><?php esc_html_e( 'Done', 'neo-pulse-wp' ); ?></button>
				</div>
			</footer>
		</div>
		<?php
	}
}

<?php
/**
 * Agent Hub admin render.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Agent_Hub {

	public static function render_agent_hub_page(): void {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/admin/class-flowbie-wp-seo-blocks-list-table.php';

		$list_table = new Flowbie_Wp_Seo_Blocks_List_Table();
		$list_table->prepare_items();

		$counts = $list_table->get_status_counts();
		$status = isset( $_GET['block_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['block_status'] ) ) : 'all';
		if ( ! in_array( $status, array( 'all', 'draft', 'published', 'needs_optimize' ), true ) ) {
			$status = 'all';
		}

		$base_url = admin_url( 'admin.php?page=flowbie-wp-agent-hub' );
		self::flowbie_group_shell_open( 'flowbie-wp-agent-hub', 'flowbie-wp-agent-hub' );
		?>
			<div id="flowbie-agent-hub">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Block Builder', 'flowbie-wp' ); ?></h1>
			<a href="#" class="page-title-action" id="flowbie-agent-hub-add-row"><?php esc_html_e( 'Add row', 'flowbie-wp' ); ?></a>
			<hr class="wp-header-end" />

			<p class="description flowbie-wp-agent-hub__note">
				<?php esc_html_e( 'Manage SEO content blocks. Saving a block creates or updates an Elementor library section titled from the block theme.', 'flowbie-wp' ); ?>
			</p>

			<ul class="subsubsub">
				<?php
				$view_keys = array_merge( array( 'all' ), Flowbie_Wp_Seo_Blocks_Storage::STATUSES );
				$labels    = array(
					'all'            => __( 'All', 'flowbie-wp' ),
					'draft'          => __( 'Draft', 'flowbie-wp' ),
					'published'      => __( 'Published', 'flowbie-wp' ),
					'needs_optimize' => __( 'Needs optimize', 'flowbie-wp' ),
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

			<?php $list_table->search_box( __( 'Search SEO blocks', 'flowbie-wp' ), 'seo-block' ); ?>

			<form method="get" id="flowbie-agent-hub-list-form">
				<input type="hidden" name="page" value="flowbie-wp-agent-hub" />
				<input type="hidden" name="block_status" value="<?php echo esc_attr( $status ); ?>" />
				<?php $list_table->display(); ?>
			</form>
			</div>
		<?php
		self::flowbie_group_shell_close();
	}

	public static function render_agent_hub_edit_page(): void {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( self::required_capability() ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'flowbie-wp' ) );
		}

		$block_id = isset( $_GET['block_id'] ) ? absint( $_GET['block_id'] ) : 0;
		if ( $block_id < 1 ) {
			wp_safe_redirect( admin_url( 'admin.php?page=flowbie-wp-agent-hub' ) );
			exit;
		}

		$statuses  = Flowbie_Wp_Seo_Blocks_Storage::STATUSES;
		$list_url  = admin_url( 'admin.php?page=flowbie-wp-agent-hub' );
		self::flowbie_group_shell_open( 'flowbie-wp-agent-hub-edit', 'flowbie-wp-agent-hub flowbie-agent-hub-edit-screen' );
		?>
			<div id="flowbie-agent-hub-edit-wrap">
				<?php self::render_agent_hub_builder_shell( $statuses, $list_url ); ?>
			</div>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * Full-page SEO block builder (no modal).
	 *
	 * @param array<int,string> $statuses Block status options.
	 * @param string            $list_url Back link to list screen.
	 */
	private static function render_agent_hub_builder_shell( array $statuses, string $list_url ): void {
		?>
		<div id="flowbie-agent-hub-builder" class="flowbie-agent-hub-builder-page">
			<header class="flowbie-agent-hub-builder-page__header">
				<div class="flowbie-agent-hub-builder-page__header-main">
					<a class="flowbie-agent-hub-builder-page__back" href="<?php echo esc_url( $list_url ); ?>" aria-label="<?php esc_attr_e( 'Back to list', 'flowbie-wp' ); ?>">&larr;</a>
					<h2 id="flowbie-agent-hub-modal-title"><?php esc_html_e( 'Edit SEO block', 'flowbie-wp' ); ?></h2>
					<span id="flowbie-agent-hub-context-badge" class="flowbie-agent-hub-context-badge is-independent" hidden></span>
				</div>
			</header>

			<nav class="flowbie-builder-tabs" role="tablist">
				<button type="button" class="flowbie-builder-tabs__tab is-active" data-tab="layout" role="tab" aria-selected="true"><?php esc_html_e( 'Layout', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-builder-tabs__tab" data-tab="settings" role="tab" aria-selected="false"><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-builder-tabs__tab" data-tab="responsive" role="tab" aria-selected="false"><?php esc_html_e( 'Responsive', 'flowbie-wp' ); ?></button>
				<button type="button" class="flowbie-builder-tabs__tab" data-tab="agent" role="tab" aria-selected="false"><?php esc_html_e( 'Agent', 'flowbie-wp' ); ?></button>
			</nav>

			<div class="flowbie-builder-body">
				<div class="flowbie-builder-main">
					<div class="flowbie-builder-tab-panel is-active" data-panel="layout" role="tabpanel">
						<div class="flowbie-builder-main-view-stack">
							<div id="flowbie-builder-layout-view" class="flowbie-builder-main-view is-active">
								<div class="flowbie-builder-layout-toolbar">
									<button type="button" class="button button-primary" id="flowbie-builder-add-slot"><?php esc_html_e( 'Add block', 'flowbie-wp' ); ?></button>
									<div class="flowbie-builder-field flowbie-builder-grid-size">
										<label for="flowbie-builder-grid-rows"><?php esc_html_e( 'Rows', 'flowbie-wp' ); ?></label>
										<input type="number" id="flowbie-builder-grid-rows" class="flowbie-builder-field__control" min="1" max="24" value="3" />
									</div>
									<div class="flowbie-builder-field flowbie-builder-grid-size">
										<label for="flowbie-builder-grid-cols"><?php esc_html_e( 'Columns', 'flowbie-wp' ); ?></label>
										<input type="number" id="flowbie-builder-grid-cols" class="flowbie-builder-field__control" min="1" max="24" value="3" />
									</div>
								</div>
								<div id="flowbie-builder-layout-palette" class="flowbie-builder-layout-palette"></div>
								<div id="flowbie-builder-layout-grid" class="flowbie-builder-layout-canvas"></div>
								<div id="flowbie-builder-layout-cell-settings" class="flowbie-builder-layout-cell-settings" hidden></div>
								<p id="flowbie-builder-layout-hint" class="flowbie-builder-layout-hint"><?php esc_html_e( 'Click a block to edit. Drop items onto a cell. Drag chips within a cell to reorder.', 'flowbie-wp' ); ?></p>
							</div>
							<?php self::render_agent_hub_block_editor_view(); ?>
						</div>
					</div>

					<div class="flowbie-builder-tab-panel" data-panel="settings" role="tabpanel" hidden>
						<div id="flowbie-builder-settings">
							<div class="flowbie-builder-group" data-group="identity">
								<h3 class="flowbie-builder-group__title"><?php esc_html_e( 'Block identity', 'flowbie-wp' ); ?></h3>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-id-display"><?php esc_html_e( 'Block ID', 'flowbie-wp' ); ?></label>
									<span class="flowbie-builder-field__value" id="flowbie-agent-hub-field-id-display">—</span>
								</div>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-title"><?php esc_html_e( 'Theme / title', 'flowbie-wp' ); ?></label>
									<input type="text" class="flowbie-builder-field__control" id="flowbie-agent-hub-field-title" name="title" required />
								</div>
							</div>
							<div class="flowbie-builder-group" data-group="seo-intent">
								<h3 class="flowbie-builder-group__title"><?php esc_html_e( 'SEO intent', 'flowbie-wp' ); ?></h3>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-focus-keyword"><?php esc_html_e( 'Focus keyword', 'flowbie-wp' ); ?></label>
									<input type="text" class="flowbie-builder-field__control" id="flowbie-agent-hub-field-focus-keyword" name="focus_keyword" />
								</div>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-h2"><?php esc_html_e( 'H2', 'flowbie-wp' ); ?></label>
									<input type="text" class="flowbie-builder-field__control" id="flowbie-agent-hub-field-h2" name="h2" />
								</div>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-topic-focus"><?php esc_html_e( 'Topic focus', 'flowbie-wp' ); ?></label>
									<textarea class="flowbie-builder-field__control" id="flowbie-agent-hub-field-topic-focus" name="topic_focus" rows="3"></textarea>
								</div>
							</div>
							<div class="flowbie-builder-group" data-group="page-context">
								<h3 class="flowbie-builder-group__title"><?php esc_html_e( 'Page context', 'flowbie-wp' ); ?></h3>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-primary-post"><?php esc_html_e( 'Primary page', 'flowbie-wp' ); ?></label>
									<input type="search" class="flowbie-builder-field__control flowbie-agent-hub-primary-post-search" id="flowbie-agent-hub-primary-post-search" placeholder="<?php esc_attr_e( 'Search pages and posts…', 'flowbie-wp' ); ?>" autocomplete="off" />
									<select class="flowbie-builder-field__control" id="flowbie-agent-hub-field-primary-post" name="primary_post_id">
										<option value="0"><?php esc_html_e( 'None (independent block)', 'flowbie-wp' ); ?></option>
									</select>
								</div>
								<div id="flowbie-agent-hub-primary-post-summary" class="flowbie-agent-hub-primary-post-summary" hidden></div>
							</div>
							<div class="flowbie-builder-group" data-group="publish">
								<h3 class="flowbie-builder-group__title"><?php esc_html_e( 'Publish', 'flowbie-wp' ); ?></h3>
								<div class="flowbie-builder-field">
									<label for="flowbie-agent-hub-field-status"><?php esc_html_e( 'Status', 'flowbie-wp' ); ?></label>
									<select class="flowbie-builder-field__control" id="flowbie-agent-hub-field-status" name="status">
										<?php foreach ( $statuses as $status_option ) : ?>
											<option value="<?php echo esc_attr( $status_option ); ?>"><?php echo esc_html( ucfirst( str_replace( '_', ' ', $status_option ) ) ); ?></option>
										<?php endforeach; ?>
									</select>
								</div>
							</div>
							<div class="flowbie-builder-group flowbie-agent-hub-builder-page__library-wrap" data-group="library" hidden>
								<h3 class="flowbie-builder-group__title"><?php esc_html_e( 'Library', 'flowbie-wp' ); ?></h3>
								<div class="flowbie-builder-field">
									<label><?php esc_html_e( 'Template', 'flowbie-wp' ); ?></label>
									<a href="#" id="flowbie-agent-hub-field-library" class="flowbie-builder-field__value flowbie-builder-field__link" target="_blank" rel="noopener"><?php esc_html_e( 'Edit template', 'flowbie-wp' ); ?></a>
								</div>
							</div>
						</div>
					</div>

					<div class="flowbie-builder-tab-panel" data-panel="responsive" role="tabpanel" hidden>
						<div id="flowbie-builder-responsive"></div>
					</div>

					<div class="flowbie-builder-tab-panel" data-panel="agent" role="tabpanel" hidden>
						<div class="flowbie-builder-agent-assist">
							<?php if ( Flowbie_Wp_OpenRouter::get_api_key() === '' ) : ?>
								<div class="flowbie-builder-agent-assist__alert" role="alert">
									<p><?php esc_html_e( 'Agent requires an OpenRouter API key. Configure it under Settings > Editor AI.', 'flowbie-wp' ); ?></p>
								</div>
							<?php endif; ?>
							<div class="flowbie-builder-agent-assist__chat">
								<div class="flowbie-builder-agent-assist__messages" id="flowbie-builder-agent-messages"></div>
								<div class="flowbie-builder-agent-assist__center" id="flowbie-builder-agent-center">
									<h3 class="flowbie-builder-agent-assist__brand"><?php esc_html_e( 'Block Agent', 'flowbie-wp' ); ?></h3>
									<p class="flowbie-builder-agent-assist__subtitle"><?php esc_html_e( 'Generate and optimize this SEO block with AI', 'flowbie-wp' ); ?></p>
									<div class="flowbie-builder-agent-assist__suggestions" id="flowbie-builder-agent-suggestions">
										<button type="button" class="flowbie-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Generate a full block from my topic focus and focus keyword', 'flowbie-wp' ); ?>"><?php esc_html_e( 'Generate full block', 'flowbie-wp' ); ?></button>
										<button type="button" class="flowbie-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Optimize copy for the focus keyword', 'flowbie-wp' ); ?>"><?php esc_html_e( 'Optimize copy', 'flowbie-wp' ); ?></button>
										<button type="button" class="flowbie-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Suggest layout and grid placement for these slots', 'flowbie-wp' ); ?>"><?php esc_html_e( 'Suggest layout', 'flowbie-wp' ); ?></button>
										<button type="button" class="flowbie-builder-agent-assist__chip" data-prompt="<?php esc_attr_e( 'Analyze this block for SEO gaps', 'flowbie-wp' ); ?>"><?php esc_html_e( 'Analyze SEO', 'flowbie-wp' ); ?></button>
									</div>
								</div>
								<div class="flowbie-builder-agent-assist__input-wrap">
									<div class="flowbie-builder-agent-assist__input-row">
										<textarea id="flowbie-builder-agent-input" class="flowbie-builder-agent-assist__input" rows="3" placeholder="<?php esc_attr_e( 'Describe what you need for this block…', 'flowbie-wp' ); ?>" autocomplete="off" <?php echo Flowbie_Wp_OpenRouter::get_api_key() === '' ? 'disabled' : ''; ?>></textarea>
										<button type="button" id="flowbie-builder-agent-send" class="flowbie-builder-agent-assist__send" aria-label="<?php esc_attr_e( 'Send', 'flowbie-wp' ); ?>" <?php echo Flowbie_Wp_OpenRouter::get_api_key() === '' ? 'disabled' : ''; ?>>&#8594;</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<aside class="flowbie-builder-preview">
					<h3 class="flowbie-builder-preview__title"><?php esc_html_e( 'Preview', 'flowbie-wp' ); ?></h3>
					<div id="flowbie-builder-preview" class="flowbie-builder-preview__body"></div>
				</aside>
			</div>

			<form id="flowbie-agent-hub-modal-form" class="flowbie-agent-hub-builder-page__form">
				<input type="hidden" name="id" id="flowbie-agent-hub-field-id" value="0" />
				<footer class="flowbie-agent-hub-builder-page__actions">
					<button type="button" class="button" id="flowbie-agent-hub-modal-optimize"><?php esc_html_e( 'Optimize', 'flowbie-wp' ); ?></button>
					<button type="button" class="button button-primary" id="flowbie-agent-hub-modal-save"><?php esc_html_e( 'Save', 'flowbie-wp' ); ?></button>
					<button type="button" class="button" id="flowbie-agent-hub-modal-download-json"><?php esc_html_e( 'Download JSON', 'flowbie-wp' ); ?></button>
					<button type="button" class="button" id="flowbie-agent-hub-modal-save-exit"><?php esc_html_e( 'Save and exit', 'flowbie-wp' ); ?></button>
					<a href="<?php echo esc_url( $list_url ); ?>" class="button flowbie-agent-hub-builder-page__cancel"><?php esc_html_e( 'Cancel', 'flowbie-wp' ); ?></a>
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
		<div id="flowbie-builder-block-editor-view" class="flowbie-builder-main-view flowbie-block-editor-view">
			<header class="flowbie-block-editor-view__header">
				<div class="flowbie-block-editor-view__header-main">
					<button type="button" class="flowbie-block-editor-view__back" id="flowbie-block-editor-back">&larr; <?php esc_html_e( 'Back to layout', 'flowbie-wp' ); ?></button>
					<h2 id="flowbie-slot-editor-title"><?php esc_html_e( 'Block editor', 'flowbie-wp' ); ?></h2>
					<span id="flowbie-slot-editor-placement" class="flowbie-block-editor-view__placement" hidden></span>
				</div>
			</header>
			<div class="flowbie-block-editor-view__body">
				<aside class="flowbie-block-editor-view__types" id="flowbie-slot-editor-types" aria-label="<?php esc_attr_e( 'Block type', 'flowbie-wp' ); ?>"></aside>
				<main class="flowbie-block-editor-view__form-wrap">
					<div id="flowbie-slot-editor-form" class="flowbie-block-editor-view__form"></div>
				</main>
			</div>
			<footer class="flowbie-block-editor-view__footer">
				<button type="button" class="flowbie-slot-editor-btn flowbie-slot-editor-remove" id="flowbie-slot-editor-remove"><?php esc_html_e( 'Remove block', 'flowbie-wp' ); ?></button>
				<div class="flowbie-block-editor-view__footer-actions">
					<button type="button" class="flowbie-slot-editor-btn flowbie-slot-editor-cancel"><?php esc_html_e( 'Cancel', 'flowbie-wp' ); ?></button>
					<button type="button" class="flowbie-slot-editor-btn flowbie-slot-editor-done" id="flowbie-slot-editor-done"><?php esc_html_e( 'Done', 'flowbie-wp' ); ?></button>
				</div>
			</footer>
		</div>
		<?php
	}
}

<?php
/**
 * Agent Hub admin handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Handlers_Agent_Hub {

	/**
	 * Agent Hub CSS partials (dependency order).
	 *
	 * @return array<string, string> Handle => path relative to assets/admin/
	 */
	private static function agent_hub_style_manifest(): array {
		return array(
			'neo-pulse-wp-admin-agent-hub-list'                => 'agent-hub/admin-agent-hub-list.css',
			'neo-pulse-wp-admin-agent-hub-modal-shell'         => 'agent-hub/admin-agent-hub-modal-shell.css',
			'neo-pulse-wp-admin-agent-hub-modal-canvas'        => 'agent-hub/admin-agent-hub-modal-canvas.css',
			'neo-pulse-wp-admin-agent-hub-modal-slots'         => 'agent-hub/admin-agent-hub-modal-slots.css',
			'neo-pulse-wp-admin-agent-hub-modal-chrome'        => 'agent-hub/admin-agent-hub-modal-chrome.css',
			'neo-pulse-wp-admin-agent-hub-modal-agent'         => 'agent-hub/admin-agent-hub-modal-agent.css',
			'neo-pulse-wp-admin-agent-hub-slot-editor'         => 'agent-hub/admin-agent-hub-slot-editor.css',
			'neo-pulse-wp-admin-agent-hub-slot-editor-wysiwyg' => 'agent-hub/admin-agent-hub-slot-editor-wysiwyg.css',
			'neo-pulse-wp-admin-agent-hub-edit-shell'          => 'agent-hub/admin-agent-hub-edit-shell.css',
			'neo-pulse-wp-admin-agent-hub-edit-layout'         => 'agent-hub/admin-agent-hub-edit-layout.css',
			'neo-pulse-wp-admin-agent-hub-edit-controls'       => 'agent-hub/admin-agent-hub-edit-controls.css',
		);
	}

	/**
	 * @param array<int, string> $deps Styles that must load before Agent Hub partials.
	 */
	public static function enqueue_agent_hub_styles( array $deps = array() ): void {
		$chain = ! empty( $deps ) ? $deps : array( 'neo-pulse-wp-lato' );
		$base  = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';

		foreach ( self::agent_hub_style_manifest() as $handle => $file ) {
			if ( wp_style_is( $handle, 'enqueued' ) || wp_style_is( $handle, 'done' ) ) {
				$chain = array( $handle );
				continue;
			}

			$rel = 'assets/admin/' . $file;
			$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
			$ver = $base;
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}

			wp_enqueue_style(
				$handle,
				plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $rel,
				$chain,
				$ver
			);
			$chain = array( $handle );
		}
	}

	/**
	 * Agent Hub JS modules (dependency order).
	 *
	 * @param string $screen list|edit
	 * @return array<string, string> Handle => path relative to assets/admin/
	 */
	private static function agent_hub_script_manifest( string $screen ): array {
		$common = array(
			'neo-pulse-wp-admin-agent-hub-core'         => 'agent-hub/admin-agent-hub-core.js',
			'neo-pulse-wp-admin-agent-hub-layout-model' => 'agent-hub/admin-agent-hub-layout-model.js',
			'neo-pulse-wp-admin-agent-hub-settings'     => 'agent-hub/admin-agent-hub-settings.js',
			'neo-pulse-wp-admin-agent-hub-slot-editor'  => 'agent-hub/admin-agent-hub-slot-editor.js',
			'neo-pulse-wp-admin-agent-hub-layout-ui'    => 'agent-hub/admin-agent-hub-layout-ui.js',
			'neo-pulse-wp-admin-agent-hub-blocks-api'   => 'agent-hub/admin-agent-hub-blocks-api.js',
			'neo-pulse-wp-admin-agent-hub-agent-tab'    => 'agent-hub/admin-agent-hub-agent-tab.js',
			'neo-pulse-wp-admin-agent-hub-events'       => 'agent-hub/admin-agent-hub-events.js',
		);

		$boot = array(
			'neo-pulse-wp-admin-agent-hub-boot' => 'agent-hub/admin-agent-hub-boot.js',
		);

		return array_merge( $common, $boot );
	}

	/**
	 * @param string               $screen   list|edit
	 * @param array<int, string>   $deps     Script dependencies for the first module.
	 * @param int                  $block_id Initial block id on edit screen.
	 */
	public static function enqueue_agent_hub_scripts( string $screen, array $deps, int $block_id = 0 ): void {
		$chain    = $deps;
		$base     = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
		$manifest = self::agent_hub_script_manifest( $screen );
		$first    = true;

		foreach ( $manifest as $handle => $file ) {
			if ( wp_script_is( $handle, 'enqueued' ) || wp_script_is( $handle, 'done' ) ) {
				$chain = array( $handle );
				$first = false;
				continue;
			}

			$rel = 'assets/admin/' . $file;
			$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
			$ver = $base;
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}

			wp_enqueue_script(
				$handle,
				plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $rel,
				$chain,
				$ver,
				true
			);

			if ( $first ) {
				wp_localize_script(
					$handle,
					'NeoPulseAgentHub',
					self::agent_hub_localize_config( $screen, $block_id )
				);
				$first = false;
			}

			$chain = array( $handle );
		}

		// Back-compat handle for anything depending on neo-pulse-wp-admin-agent-hub.
		if ( wp_script_is( 'neo-pulse-wp-admin-agent-hub-boot', 'registered' ) && ! wp_script_is( 'neo-pulse-wp-admin-agent-hub', 'registered' ) ) {
			wp_register_script( 'neo-pulse-wp-admin-agent-hub', false, array( 'neo-pulse-wp-admin-agent-hub-boot' ), $base, true );
		}
		wp_enqueue_script( 'neo-pulse-wp-admin-agent-hub' );
	}

	public static function register_agent_hub_handlers(): void {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_agent_hub_assets' ) );
	}

	public static function enqueue_agent_hub_assets( string $hook_suffix ): void {
		$list_hooks = array(
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub',
		);
		$edit_hooks = array(
			'admin_page_neo_pulse-wp-agent-hub-edit',
			'neo-pulse-wp_page_neo_pulse-wp-agent-hub-edit',
		);
		$is_list = in_array( $hook_suffix, $list_hooks, true );
		$is_edit = in_array( $hook_suffix, $edit_hooks, true );
		if ( ! $is_list && ! $is_edit ) {
			return;
		}

		if ( $is_edit ) {
			wp_enqueue_media();
			wp_enqueue_editor();
			wp_enqueue_script( 'jquery-ui-sortable' );
			wp_enqueue_script( 'jquery-ui-draggable' );
			wp_enqueue_script( 'jquery-ui-droppable' );

			if ( class_exists( 'Neo_Pulse_Wp_Voice' ) ) {
				Neo_Pulse_Wp_Voice::enqueue_thinking_card_assets( true );
			}
		}

		$style_deps = array( 'neo-pulse-wp-admin-contrast' );
		if ( ! wp_style_is( 'neo-pulse-wp-admin-contrast', 'registered' ) ) {
			$style_deps = array( 'neo-pulse-wp-lato' );
		}
		self::enqueue_agent_hub_styles( $style_deps );

		if ( ! $is_edit ) {
			self::enqueue_agent_hub_scripts( 'list', array( 'jquery' ), 0 );
			return;
		}

		$frontend_css = NEO_PULSE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_enqueue_style(
			'neo-pulse-wp-seo-block-frontend',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $frontend_css ) ? (string) filemtime( $frontend_css ) : NEO_PULSE_WP_VERSION
		);

		$deps = array( 'jquery', 'jquery-ui-sortable', 'jquery-ui-draggable', 'jquery-ui-droppable', 'wp-editor' );
		if ( wp_script_is( 'neo-pulse-thinking-card', 'registered' ) ) {
			$deps[] = 'neo-pulse-thinking-card';
		}

		$block_id = isset( $_GET['block_id'] ) ? absint( $_GET['block_id'] ) : 0;
		self::enqueue_agent_hub_scripts( 'edit', $deps, $block_id );
	}

	/**
	 * @param string $screen  list|edit
	 * @param int    $block_id Initial block id on edit screen.
	 * @return array<string, mixed>
	 */
	private static function agent_hub_localize_config( string $screen, int $block_id ): array {
		return array(
				'screen'            => $screen,
				'listUrl'           => esc_url_raw( admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' ) ),
				'editUrl'           => esc_url_raw( admin_url( 'admin.php?page=neo-pulse-wp-agent-hub-edit' ) ),
				'initialBlockId'    => $block_id,
				'restRoot'          => esc_url_raw( rest_url( 'neo-pulse/v1/' ) ),
				'backendAssistUrl'  => esc_url_raw( rest_url( 'neo-pulse/v1/backend-assist' ) ),
				'backendAssistStepUrl' => esc_url_raw( rest_url( 'neo-pulse/v1/backend-assist/step' ) ),
				'backendAssistWorkflowStatusUrl' => esc_url_raw( rest_url( 'neo-pulse/v1/backend-assist/workflow' ) ),
				'nonce'             => wp_create_nonce( 'wp_rest' ),
				'gridMax'           => Neo_Pulse_Wp_Seo_Blocks_Layout::GRID_MAX,
				'slotTypes'         => array(
					'h2'        => __( 'Heading', 'neo-pulse-wp' ),
					'paragraph' => __( 'Paragraph', 'neo-pulse-wp' ),
					'cta'       => __( 'CTA button', 'neo-pulse-wp' ),
					'image'     => __( 'Image', 'neo-pulse-wp' ),
					'list'      => __( 'List', 'neo-pulse-wp' ),
				),
				'wysiwygToolbar'    => array(
					'paragraph' => 'formatselect,bold,italic,link,bullist,numlist,blockquote,undo,redo',
					'list'      => 'bullist,numlist,link,undo,redo',
				),
				'widths'            => array(
					'full'       => __( 'Full width', 'neo-pulse-wp' ),
					'half'       => __( 'Half', 'neo-pulse-wp' ),
					'third'      => __( 'One third', 'neo-pulse-wp' ),
					'two-thirds' => __( 'Two thirds', 'neo-pulse-wp' ),
				),
				'i18n'              => array(
					'saved'               => __( 'Saved. Library template updated.', 'neo-pulse-wp' ),
					'saveAndExit'         => __( 'Save and exit', 'neo-pulse-wp' ),
					'deleted'             => __( 'Block deleted.', 'neo-pulse-wp' ),
					'optimized'           => __( 'Block copy optimized. Layout unchanged.', 'neo-pulse-wp' ),
					'optimizeEmpty'       => __( 'Optimize returned no slot updates.', 'neo-pulse-wp' ),
					'duplicated'          => __( 'Block duplicated.', 'neo-pulse-wp' ),
					'primaryPage'         => __( 'Primary page', 'neo-pulse-wp' ),
					'primaryPageEdit'     => __( 'Edit page', 'neo-pulse-wp' ),
					'primaryPageSaved'    => __( 'Primary page saved.', 'neo-pulse-wp' ),
					'primaryPageSaveFirst'=> __( 'Save the block first to link a primary page.', 'neo-pulse-wp' ),
					'independentBlock'    => __( 'Independent block', 'neo-pulse-wp' ),
					'pageLinked'          => __( 'Page-linked', 'neo-pulse-wp' ),
					'pageContextLoaded'   => __( 'Page context loaded', 'neo-pulse-wp' ),
					'optimizingWithPage'    => __( 'Optimizing with linked page context…', 'neo-pulse-wp' ),
					'optimizingIndependent' => __( 'Optimizing as independent block…', 'neo-pulse-wp' ),
					'error'               => __( 'Request failed.', 'neo-pulse-wp' ),
					'topicRequired'       => __( 'Topic focus or focus keyword is required before optimizing.', 'neo-pulse-wp' ),
					'optimizing'          => __( 'Optimizing block…', 'neo-pulse-wp' ),
					'titleRequired'       => __( 'Title is required.', 'neo-pulse-wp' ),
					'confirmDelete'       => __( 'Delete this SEO block?', 'neo-pulse-wp' ),
					'confirmDeleteSlot'   => __( 'Remove this slot?', 'neo-pulse-wp' ),
					'confirmDeleteSection'=> __( 'Remove this section?', 'neo-pulse-wp' ),
					'confirmBulkDelete'   => __( 'Delete selected SEO blocks?', 'neo-pulse-wp' ),
					'confirmBulkOptimize' => __( 'Optimize selected SEO blocks?', 'neo-pulse-wp' ),
					'bulkDone'            => __( 'Bulk optimize finished.', 'neo-pulse-wp' ),
					'addSlot'             => __( 'Add slot', 'neo-pulse-wp' ),
					'addBlock'            => __( 'Add block', 'neo-pulse-wp' ),
					'editBlock'           => __( 'Edit block', 'neo-pulse-wp' ),
					'blockEditor'         => __( 'Block editor', 'neo-pulse-wp' ),
					'backToLayout'        => __( 'Back to layout', 'neo-pulse-wp' ),
					'done'                => __( 'Done', 'neo-pulse-wp' ),
					'removeBlock'         => __( 'Remove block', 'neo-pulse-wp' ),
					'blockType'           => __( 'Block type', 'neo-pulse-wp' ),
					'verticalAlign'       => __( 'Vertical align', 'neo-pulse-wp' ),
					'horizontalAlign'     => __( 'Horizontal align', 'neo-pulse-wp' ),
					'listStyle'           => __( 'List style', 'neo-pulse-wp' ),
					'placedInCell'        => __( 'Row %1$s, column %2$s', 'neo-pulse-wp' ),
					'contentSection'      => __( 'Content', 'neo-pulse-wp' ),
					'appearanceSection'   => __( 'Appearance', 'neo-pulse-wp' ),
					'slotEditorUnavailable' => __( 'Block editor could not load. Refresh the page and try again.', 'neo-pulse-wp' ),
					'cancel'              => __( 'Cancel', 'neo-pulse-wp' ),
					'alignV_top'          => __( 'Top', 'neo-pulse-wp' ),
					'alignV_middle'       => __( 'Middle', 'neo-pulse-wp' ),
					'alignV_bottom'       => __( 'Bottom', 'neo-pulse-wp' ),
					'pickImage'           => __( 'Select image', 'neo-pulse-wp' ),
					'removeImage'         => __( 'Remove', 'neo-pulse-wp' ),
					'sectionId'           => __( 'Section ID', 'neo-pulse-wp' ),
					'sectionWidth'        => __( 'Width', 'neo-pulse-wp' ),
					'assignSlots'         => __( 'Assigned slots', 'neo-pulse-wp' ),
					'desktop'             => __( 'Desktop', 'neo-pulse-wp' ),
					'tablet'              => __( 'Tablet', 'neo-pulse-wp' ),
					'mobile'              => __( 'Mobile', 'neo-pulse-wp' ),
					'direction'           => __( 'Direction', 'neo-pulse-wp' ),
					'align'               => __( 'Align', 'neo-pulse-wp' ),
					'gap'                 => __( 'Gap (px)', 'neo-pulse-wp' ),
					'forceFull'           => __( 'Full width', 'neo-pulse-wp' ),
					'previewLoading'      => __( 'Updating preview…', 'neo-pulse-wp' ),
					'gridLayout'          => __( 'Grid layout', 'neo-pulse-wp' ),
					'dragHint'            => __( 'Drop items onto a cell. Drag chips within a cell to reorder.', 'neo-pulse-wp' ),
					'unplacedSlots'       => __( 'Unplaced content', 'neo-pulse-wp' ),
					'emptyCell'           => __( 'Drop here', 'neo-pulse-wp' ),
					'cellOccupied'        => __( 'Cell already has content.', 'neo-pulse-wp' ),
					'gridOverflow'        => __( 'Some items no longer fit this grid and were moved to unplaced.', 'neo-pulse-wp' ),
					'removeFromCell'      => __( 'Remove from cell', 'neo-pulse-wp' ),
					'headingLevel'        => __( 'Heading level', 'neo-pulse-wp' ),
					'headingPlaceholder'  => __( 'Heading text', 'neo-pulse-wp' ),
					'ctaLabelPlaceholder' => __( 'Button label', 'neo-pulse-wp' ),
					'ctaUrlPlaceholder'   => __( 'Link URL', 'neo-pulse-wp' ),
					'ctaStyle'            => __( 'Button style', 'neo-pulse-wp' ),
					'altPlaceholder'      => __( 'Alt text (optional)', 'neo-pulse-wp' ),
					'alignLabel'            => __( 'Align', 'neo-pulse-wp' ),
					'removeSlot'          => __( 'Remove slot', 'neo-pulse-wp' ),
					'dragSlot'            => __( 'Drag to reorder', 'neo-pulse-wp' ),
					'slotType'            => __( 'Block type', 'neo-pulse-wp' ),
					'paragraphLabel'      => __( 'Paragraph', 'neo-pulse-wp' ),
					'listLabel'           => __( 'List', 'neo-pulse-wp' ),
					'listBulleted'        => __( 'Bulleted list', 'neo-pulse-wp' ),
					'listNumbered'        => __( 'Numbered list', 'neo-pulse-wp' ),
					'listHint'            => __( 'Use the toolbar for bulleted or numbered lists.', 'neo-pulse-wp' ),
					'alignH_left'         => __( 'Left', 'neo-pulse-wp' ),
					'alignH_center'       => __( 'Middle', 'neo-pulse-wp' ),
					'alignH_right'        => __( 'Right', 'neo-pulse-wp' ),
					'colSpan'             => __( 'Span', 'neo-pulse-wp' ),
					'sectionAlign'        => __( 'Align', 'neo-pulse-wp' ),
					'centerOnRow'         => __( 'Center on row', 'neo-pulse-wp' ),
					'cellSettings'        => __( 'Cell settings', 'neo-pulse-wp' ),
					'cellSettingsEmpty'   => __( 'Drop content into this cell to configure span and alignment.', 'neo-pulse-wp' ),
					'cellSettingsPick'    => __( 'Click a grid cell to edit its settings.', 'neo-pulse-wp' ),
					'manifestInvalid'     => __( 'Invalid JSON manifest.', 'neo-pulse-wp' ),
					'manifestApplied'     => __( 'Manifest applied to builder.', 'neo-pulse-wp' ),
					'downloadManifest'    => __( 'Download JSON', 'neo-pulse-wp' ),
					'applyManifest'       => __( 'Apply to builder', 'neo-pulse-wp' ),
					'optimizePrompt'      => __( 'Optimize copy for the focus keyword', 'neo-pulse-wp' ),
				),
		);
	}
}

<?php
/**
 * Agent Hub admin handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Agent_Hub {

	/**
	 * Agent Hub CSS partials (dependency order).
	 *
	 * @return array<string, string> Handle => path relative to assets/admin/
	 */
	private static function agent_hub_style_manifest(): array {
		return array(
			'flowbie-wp-admin-agent-hub-list'                => 'agent-hub/admin-agent-hub-list.css',
			'flowbie-wp-admin-agent-hub-modal-shell'         => 'agent-hub/admin-agent-hub-modal-shell.css',
			'flowbie-wp-admin-agent-hub-modal-canvas'        => 'agent-hub/admin-agent-hub-modal-canvas.css',
			'flowbie-wp-admin-agent-hub-modal-slots'         => 'agent-hub/admin-agent-hub-modal-slots.css',
			'flowbie-wp-admin-agent-hub-modal-chrome'        => 'agent-hub/admin-agent-hub-modal-chrome.css',
			'flowbie-wp-admin-agent-hub-modal-agent'         => 'agent-hub/admin-agent-hub-modal-agent.css',
			'flowbie-wp-admin-agent-hub-slot-editor'         => 'agent-hub/admin-agent-hub-slot-editor.css',
			'flowbie-wp-admin-agent-hub-slot-editor-wysiwyg' => 'agent-hub/admin-agent-hub-slot-editor-wysiwyg.css',
			'flowbie-wp-admin-agent-hub-edit-shell'          => 'agent-hub/admin-agent-hub-edit-shell.css',
			'flowbie-wp-admin-agent-hub-edit-layout'         => 'agent-hub/admin-agent-hub-edit-layout.css',
			'flowbie-wp-admin-agent-hub-edit-controls'       => 'agent-hub/admin-agent-hub-edit-controls.css',
		);
	}

	/**
	 * @param array<int, string> $deps Styles that must load before Agent Hub partials.
	 */
	public static function enqueue_agent_hub_styles( array $deps = array() ): void {
		$chain = ! empty( $deps ) ? $deps : array( 'flowbie-wp-lato' );
		$base  = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.5.0';

		foreach ( self::agent_hub_style_manifest() as $handle => $file ) {
			if ( wp_style_is( $handle, 'enqueued' ) || wp_style_is( $handle, 'done' ) ) {
				$chain = array( $handle );
				continue;
			}

			$rel = 'assets/admin/' . $file;
			$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
			$ver = $base;
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}

			wp_enqueue_style(
				$handle,
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
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
			'flowbie-wp-admin-agent-hub-core'         => 'agent-hub/admin-agent-hub-core.js',
			'flowbie-wp-admin-agent-hub-layout-model' => 'agent-hub/admin-agent-hub-layout-model.js',
			'flowbie-wp-admin-agent-hub-settings'     => 'agent-hub/admin-agent-hub-settings.js',
			'flowbie-wp-admin-agent-hub-slot-editor'  => 'agent-hub/admin-agent-hub-slot-editor.js',
			'flowbie-wp-admin-agent-hub-layout-ui'    => 'agent-hub/admin-agent-hub-layout-ui.js',
			'flowbie-wp-admin-agent-hub-blocks-api'   => 'agent-hub/admin-agent-hub-blocks-api.js',
			'flowbie-wp-admin-agent-hub-agent-tab'    => 'agent-hub/admin-agent-hub-agent-tab.js',
			'flowbie-wp-admin-agent-hub-events'       => 'agent-hub/admin-agent-hub-events.js',
		);

		$boot = array(
			'flowbie-wp-admin-agent-hub-boot' => 'agent-hub/admin-agent-hub-boot.js',
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
		$base     = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.5.0';
		$manifest = self::agent_hub_script_manifest( $screen );
		$first    = true;

		foreach ( $manifest as $handle => $file ) {
			if ( wp_script_is( $handle, 'enqueued' ) || wp_script_is( $handle, 'done' ) ) {
				$chain = array( $handle );
				$first = false;
				continue;
			}

			$rel = 'assets/admin/' . $file;
			$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
			$ver = $base;
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}

			wp_enqueue_script(
				$handle,
				plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
				$chain,
				$ver,
				true
			);

			if ( $first ) {
				wp_localize_script(
					$handle,
					'FlowbieAgentHub',
					self::agent_hub_localize_config( $screen, $block_id )
				);
				$first = false;
			}

			$chain = array( $handle );
		}

		// Back-compat handle for anything depending on flowbie-wp-admin-agent-hub.
		if ( wp_script_is( 'flowbie-wp-admin-agent-hub-boot', 'registered' ) && ! wp_script_is( 'flowbie-wp-admin-agent-hub', 'registered' ) ) {
			wp_register_script( 'flowbie-wp-admin-agent-hub', false, array( 'flowbie-wp-admin-agent-hub-boot' ), $base, true );
		}
		wp_enqueue_script( 'flowbie-wp-admin-agent-hub' );
	}

	public static function register_agent_hub_handlers(): void {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_agent_hub_assets' ) );
	}

	public static function enqueue_agent_hub_assets( string $hook_suffix ): void {
		$list_hooks = array(
			'flowbie-wp_page_flowbie-wp-agent-hub',
		);
		$edit_hooks = array(
			'admin_page_flowbie-wp-agent-hub-edit',
			'flowbie-wp_page_flowbie-wp-agent-hub-edit',
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

			if ( class_exists( 'Flowbie_Wp_Voice' ) ) {
				Flowbie_Wp_Voice::enqueue_thinking_card_assets( true );
			}
		}

		$style_deps = array( 'flowbie-wp-admin-contrast' );
		if ( ! wp_style_is( 'flowbie-wp-admin-contrast', 'registered' ) ) {
			$style_deps = array( 'flowbie-wp-lato' );
		}
		self::enqueue_agent_hub_styles( $style_deps );

		if ( ! $is_edit ) {
			self::enqueue_agent_hub_scripts( 'list', array( 'jquery' ), 0 );
			return;
		}

		$frontend_css = FLOWBIE_WP_PLUGIN_DIR . 'assets/elementor/seo-block-frontend.css';
		wp_enqueue_style(
			'flowbie-wp-seo-block-frontend',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . 'assets/elementor/seo-block-frontend.css',
			array(),
			file_exists( $frontend_css ) ? (string) filemtime( $frontend_css ) : FLOWBIE_WP_VERSION
		);

		$deps = array( 'jquery', 'jquery-ui-sortable', 'jquery-ui-draggable', 'jquery-ui-droppable', 'wp-editor' );
		if ( wp_script_is( 'flowbie-thinking-card', 'registered' ) ) {
			$deps[] = 'flowbie-thinking-card';
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
				'listUrl'           => esc_url_raw( admin_url( 'admin.php?page=flowbie-wp-agent-hub' ) ),
				'editUrl'           => esc_url_raw( admin_url( 'admin.php?page=flowbie-wp-agent-hub-edit' ) ),
				'initialBlockId'    => $block_id,
				'restRoot'          => esc_url_raw( rest_url( 'flowbie/v1/' ) ),
				'backendAssistUrl'  => esc_url_raw( rest_url( 'flowbie/v1/backend-assist' ) ),
				'backendAssistStepUrl' => esc_url_raw( rest_url( 'flowbie/v1/backend-assist/step' ) ),
				'backendAssistWorkflowStatusUrl' => esc_url_raw( rest_url( 'flowbie/v1/backend-assist/workflow' ) ),
				'nonce'             => wp_create_nonce( 'wp_rest' ),
				'gridMax'           => Flowbie_Wp_Seo_Blocks_Layout::GRID_MAX,
				'slotTypes'         => array(
					'h2'        => __( 'Heading', 'flowbie-wp' ),
					'paragraph' => __( 'Paragraph', 'flowbie-wp' ),
					'cta'       => __( 'CTA button', 'flowbie-wp' ),
					'image'     => __( 'Image', 'flowbie-wp' ),
					'list'      => __( 'List', 'flowbie-wp' ),
				),
				'wysiwygToolbar'    => array(
					'paragraph' => 'formatselect,bold,italic,link,bullist,numlist,blockquote,undo,redo',
					'list'      => 'bullist,numlist,link,undo,redo',
				),
				'widths'            => array(
					'full'       => __( 'Full width', 'flowbie-wp' ),
					'half'       => __( 'Half', 'flowbie-wp' ),
					'third'      => __( 'One third', 'flowbie-wp' ),
					'two-thirds' => __( 'Two thirds', 'flowbie-wp' ),
				),
				'i18n'              => array(
					'saved'               => __( 'Saved. Library template updated.', 'flowbie-wp' ),
					'saveAndExit'         => __( 'Save and exit', 'flowbie-wp' ),
					'deleted'             => __( 'Block deleted.', 'flowbie-wp' ),
					'optimized'           => __( 'Block copy optimized. Layout unchanged.', 'flowbie-wp' ),
					'optimizeEmpty'       => __( 'Optimize returned no slot updates.', 'flowbie-wp' ),
					'duplicated'          => __( 'Block duplicated.', 'flowbie-wp' ),
					'primaryPage'         => __( 'Primary page', 'flowbie-wp' ),
					'primaryPageEdit'     => __( 'Edit page', 'flowbie-wp' ),
					'primaryPageSaved'    => __( 'Primary page saved.', 'flowbie-wp' ),
					'primaryPageSaveFirst'=> __( 'Save the block first to link a primary page.', 'flowbie-wp' ),
					'independentBlock'    => __( 'Independent block', 'flowbie-wp' ),
					'pageLinked'          => __( 'Page-linked', 'flowbie-wp' ),
					'pageContextLoaded'   => __( 'Page context loaded', 'flowbie-wp' ),
					'optimizingWithPage'    => __( 'Optimizing with linked page context…', 'flowbie-wp' ),
					'optimizingIndependent' => __( 'Optimizing as independent block…', 'flowbie-wp' ),
					'error'               => __( 'Request failed.', 'flowbie-wp' ),
					'topicRequired'       => __( 'Topic focus or focus keyword is required before optimizing.', 'flowbie-wp' ),
					'optimizing'          => __( 'Optimizing block…', 'flowbie-wp' ),
					'titleRequired'       => __( 'Title is required.', 'flowbie-wp' ),
					'confirmDelete'       => __( 'Delete this SEO block?', 'flowbie-wp' ),
					'confirmDeleteSlot'   => __( 'Remove this slot?', 'flowbie-wp' ),
					'confirmDeleteSection'=> __( 'Remove this section?', 'flowbie-wp' ),
					'confirmBulkDelete'   => __( 'Delete selected SEO blocks?', 'flowbie-wp' ),
					'confirmBulkOptimize' => __( 'Optimize selected SEO blocks?', 'flowbie-wp' ),
					'bulkDone'            => __( 'Bulk optimize finished.', 'flowbie-wp' ),
					'addSlot'             => __( 'Add slot', 'flowbie-wp' ),
					'addBlock'            => __( 'Add block', 'flowbie-wp' ),
					'editBlock'           => __( 'Edit block', 'flowbie-wp' ),
					'blockEditor'         => __( 'Block editor', 'flowbie-wp' ),
					'backToLayout'        => __( 'Back to layout', 'flowbie-wp' ),
					'done'                => __( 'Done', 'flowbie-wp' ),
					'removeBlock'         => __( 'Remove block', 'flowbie-wp' ),
					'blockType'           => __( 'Block type', 'flowbie-wp' ),
					'verticalAlign'       => __( 'Vertical align', 'flowbie-wp' ),
					'horizontalAlign'     => __( 'Horizontal align', 'flowbie-wp' ),
					'listStyle'           => __( 'List style', 'flowbie-wp' ),
					'placedInCell'        => __( 'Row %1$s, column %2$s', 'flowbie-wp' ),
					'contentSection'      => __( 'Content', 'flowbie-wp' ),
					'appearanceSection'   => __( 'Appearance', 'flowbie-wp' ),
					'slotEditorUnavailable' => __( 'Block editor could not load. Refresh the page and try again.', 'flowbie-wp' ),
					'cancel'              => __( 'Cancel', 'flowbie-wp' ),
					'alignV_top'          => __( 'Top', 'flowbie-wp' ),
					'alignV_middle'       => __( 'Middle', 'flowbie-wp' ),
					'alignV_bottom'       => __( 'Bottom', 'flowbie-wp' ),
					'pickImage'           => __( 'Select image', 'flowbie-wp' ),
					'removeImage'         => __( 'Remove', 'flowbie-wp' ),
					'sectionId'           => __( 'Section ID', 'flowbie-wp' ),
					'sectionWidth'        => __( 'Width', 'flowbie-wp' ),
					'assignSlots'         => __( 'Assigned slots', 'flowbie-wp' ),
					'desktop'             => __( 'Desktop', 'flowbie-wp' ),
					'tablet'              => __( 'Tablet', 'flowbie-wp' ),
					'mobile'              => __( 'Mobile', 'flowbie-wp' ),
					'direction'           => __( 'Direction', 'flowbie-wp' ),
					'align'               => __( 'Align', 'flowbie-wp' ),
					'gap'                 => __( 'Gap (px)', 'flowbie-wp' ),
					'forceFull'           => __( 'Full width', 'flowbie-wp' ),
					'previewLoading'      => __( 'Updating preview…', 'flowbie-wp' ),
					'gridLayout'          => __( 'Grid layout', 'flowbie-wp' ),
					'dragHint'            => __( 'Drop items onto a cell. Drag chips within a cell to reorder.', 'flowbie-wp' ),
					'unplacedSlots'       => __( 'Unplaced content', 'flowbie-wp' ),
					'emptyCell'           => __( 'Drop here', 'flowbie-wp' ),
					'cellOccupied'        => __( 'Cell already has content.', 'flowbie-wp' ),
					'gridOverflow'        => __( 'Some items no longer fit this grid and were moved to unplaced.', 'flowbie-wp' ),
					'removeFromCell'      => __( 'Remove from cell', 'flowbie-wp' ),
					'headingLevel'        => __( 'Heading level', 'flowbie-wp' ),
					'headingPlaceholder'  => __( 'Heading text', 'flowbie-wp' ),
					'ctaLabelPlaceholder' => __( 'Button label', 'flowbie-wp' ),
					'ctaUrlPlaceholder'   => __( 'Link URL', 'flowbie-wp' ),
					'ctaStyle'            => __( 'Button style', 'flowbie-wp' ),
					'altPlaceholder'      => __( 'Alt text (optional)', 'flowbie-wp' ),
					'alignLabel'            => __( 'Align', 'flowbie-wp' ),
					'removeSlot'          => __( 'Remove slot', 'flowbie-wp' ),
					'dragSlot'            => __( 'Drag to reorder', 'flowbie-wp' ),
					'slotType'            => __( 'Block type', 'flowbie-wp' ),
					'paragraphLabel'      => __( 'Paragraph', 'flowbie-wp' ),
					'listLabel'           => __( 'List', 'flowbie-wp' ),
					'listBulleted'        => __( 'Bulleted list', 'flowbie-wp' ),
					'listNumbered'        => __( 'Numbered list', 'flowbie-wp' ),
					'listHint'            => __( 'Use the toolbar for bulleted or numbered lists.', 'flowbie-wp' ),
					'alignH_left'         => __( 'Left', 'flowbie-wp' ),
					'alignH_center'       => __( 'Middle', 'flowbie-wp' ),
					'alignH_right'        => __( 'Right', 'flowbie-wp' ),
					'colSpan'             => __( 'Span', 'flowbie-wp' ),
					'sectionAlign'        => __( 'Align', 'flowbie-wp' ),
					'centerOnRow'         => __( 'Center on row', 'flowbie-wp' ),
					'cellSettings'        => __( 'Cell settings', 'flowbie-wp' ),
					'cellSettingsEmpty'   => __( 'Drop content into this cell to configure span and alignment.', 'flowbie-wp' ),
					'cellSettingsPick'    => __( 'Click a grid cell to edit its settings.', 'flowbie-wp' ),
					'manifestInvalid'     => __( 'Invalid JSON manifest.', 'flowbie-wp' ),
					'manifestApplied'     => __( 'Manifest applied to builder.', 'flowbie-wp' ),
					'downloadManifest'    => __( 'Download JSON', 'flowbie-wp' ),
					'applyManifest'       => __( 'Apply to builder', 'flowbie-wp' ),
					'optimizePrompt'      => __( 'Optimize copy for the focus keyword', 'flowbie-wp' ),
				),
		);
	}
}

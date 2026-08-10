<?php
/**
 * Flowbie AI editor surfaces (block sidebar, classic meta box, Content Optimizer).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Editor {

	const META_BOX_ID = 'flowbie_wp_ai';

	public static function init(): void {
		add_action( 'add_meta_boxes', array( __CLASS__, 'register_meta_box' ), 20 );
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_block_editor_assets' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_classic_assets' ) );
	}

	public static function register_meta_box(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->base, array( 'post', 'post-new' ), true ) ) {
			return;
		}

		$post_type = isset( $screen->post_type ) ? (string) $screen->post_type : '';
		if ( $post_type === '' || ! Flowbie_Wp_Ai_Gate::post_type_allowed( $post_type ) ) {
			return;
		}

		add_meta_box(
			self::META_BOX_ID,
			__( 'Flowbie AI', 'flowbie-wp' ),
			array( __CLASS__, 'render_meta_box' ),
			$post_type,
			'side',
			'high'
		);
	}

	public static function render_meta_box( WP_Post $post ): void {
		echo '<div id="flowbie-wp-ai-classic-root" class="flowbie-wp-ai-root" data-post-id="' . esc_attr( (string) $post->ID ) . '"></div>';
	}

	public static function enqueue_block_editor_assets(): void {
		global $post;

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || $screen->base !== 'post' ) {
			return;
		}

		$post_id = 0;
		if ( isset( $_GET['post'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$post_id = absint( $_GET['post'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		} elseif ( $post instanceof WP_Post ) {
			$post_id = (int) $post->ID;
		}

		if ( $post_id < 1 ) {
			return;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || ! Flowbie_Wp_Ai_Gate::post_type_allowed( $post->post_type ) ) {
			return;
		}

		self::enqueue_shared_assets( $post_id );
		self::enqueue_fields_shim();
		self::enqueue_script(
			'flowbie-wp-ai-body-harness',
			'flowbie-ai-body-harness.js',
			array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom' )
		);
		self::enqueue_script(
			'flowbie-wp-ai-body-apply',
			'flowbie-ai-body-apply.js',
			array( 'flowbie-wp-ai-body-harness', 'wp-blocks', 'wp-data', 'wp-block-editor' )
		);
		self::enqueue_script(
			'flowbie-wp-ai-url-tool',
			'flowbie-ai-url-tool.js',
			array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom', 'flowbie-wp-ai-snippet', 'wp-data' )
		);
		self::enqueue_script(
			'flowbie-wp-ai-body-modal',
			'flowbie-ai-body-modal.js',
			array(
				'flowbie-wp-ai-shared',
				'flowbie-wp-ai-dom',
				'flowbie-wp-ai-snippet',
				'flowbie-wp-ai-url-tool',
				'flowbie-wp-ai-body-harness',
				'flowbie-wp-ai-body-apply',
			)
		);
		self::enqueue_script(
			'flowbie-wp-ai-body-canvas',
			'flowbie-ai-body-canvas.js',
			array(
				'flowbie-wp-ai-body-harness',
				'wp-plugins',
				'wp-editor',
				'wp-element',
				'wp-compose',
				'wp-block-editor',
				'wp-data',
				'wp-hooks',
			)
		);
		self::enqueue_script(
			'flowbie-wp-ai-block',
			'flowbie-ai-block.js',
			array(
				'flowbie-wp-ai-controller',
				'flowbie-wp-ai-toolbar',
				'flowbie-wp-ai-body-harness',
				'flowbie-wp-ai-body-apply',
				'flowbie-wp-ai-body-canvas',
				'wp-plugins',
				'wp-editor',
				'wp-edit-post',
				'wp-element',
				'wp-components',
				'wp-data',
				'wp-i18n',
			)
		);
	}

	public static function enqueue_classic_assets( string $hook ): void {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$post_id = 0;
		if ( 'post.php' === $hook && isset( $_GET['post'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$post_id = absint( $_GET['post'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		} elseif ( 'post-new.php' === $hook ) {
			global $post;
			if ( $post instanceof WP_Post ) {
				$post_id = (int) $post->ID;
			}
		}

		if ( $post_id < 1 ) {
			return;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || ! Flowbie_Wp_Ai_Gate::post_type_allowed( $post->post_type ) ) {
			return;
		}

		self::enqueue_shared_assets( $post_id );
		self::enqueue_script( 'flowbie-wp-ai-classic', 'flowbie-ai-classic.js', array( 'flowbie-wp-ai-controller' ) );
		self::enqueue_fields_shim();
	}

	private static function enqueue_shared_assets( int $post_id ): void {
		self::enqueue_styles();
		self::enqueue_script( 'flowbie-wp-ai-shared', 'flowbie-ai-shared.js', array() );
		self::enqueue_script( 'flowbie-wp-ai-dom', 'flowbie-ai-dom.js', array() );
		self::enqueue_script( 'flowbie-wp-ai-snippet', 'flowbie-ai-snippet.js', array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom' ) );
		self::enqueue_script( 'flowbie-wp-ai-sidebar', 'flowbie-ai-sidebar.js', array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom', 'flowbie-wp-ai-snippet' ) );
		self::enqueue_script( 'flowbie-wp-social-modal', 'flowbie-social-modal.js', array( 'wp-api-fetch' ) );
		self::enqueue_script( 'flowbie-wp-ai-faq', 'flowbie-ai-faq.js', array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom' ) );
		self::enqueue_script( 'flowbie-wp-ai-modal', 'flowbie-ai-modal.js', array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom', 'flowbie-wp-ai-snippet', 'flowbie-wp-ai-faq' ) );
		self::enqueue_script(
			'flowbie-wp-ai-controller',
			'flowbie-ai-controller.js',
			array( 'flowbie-wp-ai-shared', 'flowbie-wp-ai-dom', 'flowbie-wp-ai-snippet', 'flowbie-wp-ai-sidebar', 'flowbie-wp-ai-faq', 'flowbie-wp-ai-modal', 'wp-api-fetch', 'wp-data' )
		);
		self::enqueue_script(
			'flowbie-wp-ai-toolbar',
			'flowbie-ai-toolbar.js',
			array( 'flowbie-wp-ai-shared', 'wp-data' )
		);
		$seo_research_hint = __( 'Brief includes DataForSEO SERP and Semrush (called directly from this site, no Flow API URL).', 'flowbie-wp' );
		if ( class_exists( 'Flowbie_Wp_Gsc_Prompt', false ) && Flowbie_Wp_Gsc_Prompt::is_available() ) {
			$seo_research_hint = __( 'Brief includes DataForSEO SERP, Semrush, and GSC page queries (called directly from this site, no Flow API URL).', 'flowbie-wp' );
		}
		wp_localize_script(
			'flowbie-wp-ai-shared',
			'flowbieWpAi',
			array(
				'postId'  => $post_id,
				'siteUrl' => esc_url_raw( home_url( '/' ) ),
				'root'    => esc_url_raw( rest_url() ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'strings' => array(
					'title'                   => __( 'Flowbie AI', 'flowbie-wp' ),
					'preview'                 => __( 'Preview', 'flowbie-wp' ),
					'apply'                   => __( 'Apply', 'flowbie-wp' ),
					'discard'                 => __( 'Discard', 'flowbie-wp' ),
					'loading'                 => __( 'Generating…', 'flowbie-wp' ),
					'applied'                 => __( 'Applied to this post.', 'flowbie-wp' ),
					'capLabel'                => __( 'Optimizations this period', 'flowbie-wp' ),
					'wandTitle'               => __( 'Enhance with Flowbie AI', 'flowbie-wp' ),
					'metaSeo'                 => __( 'Meta & SEO', 'flowbie-wp' ),
					'contentFields'           => __( 'Content fields', 'flowbie-wp' ),
					'enhance'                 => __( 'Enhance', 'flowbie-wp' ),
					'wandHint'                => __( 'Generate with Flowbie AI', 'flowbie-wp' ),
					'previewLabel'            => __( 'Preview', 'flowbie-wp' ),
					'previewTitlePlaceholder' => __( 'Post title', 'flowbie-wp' ),
					'previewDescPlaceholder'  => __( 'Meta description will appear here.', 'flowbie-wp' ),
					'backToFields'            => __( '← All fields', 'flowbie-wp' ),
					'capReached'              => __( 'Apply disabled — optimization cap reached for this period.', 'flowbie-wp' ),
					'capPaused'               => __( 'Optimization cap is temporarily disabled.', 'flowbie-wp' ),
					'seoTitle'                => __( 'SEO title', 'flowbie-wp' ),
					'metaDescription'         => __( 'Meta description', 'flowbie-wp' ),
					'focusKeyword'            => __( 'Focus keyword', 'flowbie-wp' ),
					'saveMeta'                => __( 'Save meta', 'flowbie-wp' ),
					'savingMeta'              => __( 'Saving…', 'flowbie-wp' ),
					'metaSaved'               => __( 'Meta saved.', 'flowbie-wp' ),
					'applyField'              => __( 'Apply', 'flowbie-wp' ),
					'unsavedChanges'          => __( 'Unsaved changes', 'flowbie-wp' ),
					'titleCharHint'           => __( 'Recommended: up to 60 characters.', 'flowbie-wp' ),
					'metaCharHint'            => __( 'Recommended: 150–160 characters.', 'flowbie-wp' ),
					'editMeta'                => __( 'Edit meta', 'flowbie-wp' ),
					'metaEditorTitle'         => __( 'Meta editor', 'flowbie-wp' ),
					'generateAll'             => __( 'Generate all with AI', 'flowbie-wp' ),
					'discardChanges'          => __( 'You have unsaved changes. Discard them?', 'flowbie-wp' ),
					'titleHelp'               => __( 'This is what will appear as the title in search results.', 'flowbie-wp' ),
					'descriptionHelp'         => __( 'This is what will appear as the description when this page shows up in search results.', 'flowbie-wp' ),
					'focusKeywordHelp'        => __( 'The main keyword you want this page to rank for.', 'flowbie-wp' ),
					'close'                   => __( 'Close', 'flowbie-wp' ),
					'editSnippet'             => __( 'Edit Snippet', 'flowbie-wp' ),
					'usageLabel'              => __( 'Optimizations this period', 'flowbie-wp' ),
					'focusKeywordEmpty'       => __( 'Not set', 'flowbie-wp' ),
					'toolbarLabel'            => __( 'Flowbie', 'flowbie-wp' ),
					'copyFaqSchema'           => __( 'Copy all schema', 'flowbie-wp' ),
					'copied'                  => __( 'Copied!', 'flowbie-wp' ),
					'faqQuestion'             => __( 'Question', 'flowbie-wp' ),
					'faqAnswer'               => __( 'Answer', 'flowbie-wp' ),
					'gscSuggestions'          => __( 'GSC suggestions', 'flowbie-wp' ),
					'gscSuggestionsLoading'     => __( 'Loading GSC suggestions…', 'flowbie-wp' ),
					'gscSuggestionsEmpty'       => __( 'No GSC suggestions for this URL.', 'flowbie-wp' ),
					'gscImpressions'            => __( 'Impressions', 'flowbie-wp' ),
					'runSeoResearch'            => __( 'Run research', 'flowbie-wp' ),
					'runSeoResearchLoading'     => __( 'Researching…', 'flowbie-wp' ),
					'runSeoResearchNeedKeyword' => __( 'Set focus keyword first.', 'flowbie-wp' ),
					'runSeoResearchDone'        => __( 'SEO research brief ready.', 'flowbie-wp' ),
					'runSeoResearchFailed'      => __( 'SEO research failed.', 'flowbie-wp' ),
					'runSeoResearchUnavailable' => __( 'SEO research credentials are missing from this plugin build.', 'flowbie-wp' ),
					'seoResearchBriefHint'      => $seo_research_hint,
					'faqWandNeedResearch'       => __( 'Run SEO research first or paste a research brief.', 'flowbie-wp' ),
					'faqWandRunning'            => __( 'Generating FAQs from research…', 'flowbie-wp' ),
					'faqWandSeeding'            => __( 'Creating FAQ pairs…', 'flowbie-wp' ),
					'faqWandStep'               => __( 'Optimizing FAQ', 'flowbie-wp' ),
					'faqWandFailed'             => __( 'FAQ generation failed.', 'flowbie-wp' ),
					'faqWandParseFailed'        => __( 'Could not parse generated FAQ pairs.', 'flowbie-wp' ),
					'bodyHarnessTitle'          => __( 'Body optimizer', 'flowbie-wp' ),
					'bodyHarnessOpen'           => __( 'Open Body Optimizer', 'flowbie-wp' ),
					'bodyHarnessHint'           => __( 'Click "Plan sections" to generate a blueprint from seo_research.', 'flowbie-wp' ),
					'bodyNoSections'            => __( 'No H2 sections found in this post. Add headings to optimize content.', 'flowbie-wp' ),
					'bodyClear'                 => __( 'Clear session', 'flowbie-wp' ),
					'bodyHarnessKeyRequired'    => __( 'Body optimizer requires OpenRouter in wp-config, environment, or Flowbie WP Settings (not cloud-only).', 'flowbie-wp' ),
					'bodyPlan'                  => __( 'Plan sections', 'flowbie-wp' ),
					'bodyRunAll'                => __( 'Run all', 'flowbie-wp' ),
					'bodyStop'                  => __( 'Stop', 'flowbie-wp' ),
					'bodyOptimize'              => __( 'Optimize', 'flowbie-wp' ),
					'bodyFleetStatus'           => __( 'Fleet status', 'flowbie-wp' ),
					'bodyColStatus'             => __( 'Status', 'flowbie-wp' ),
					'bodyColSection'            => __( 'Section', 'flowbie-wp' ),
					'bodyColKeyword'            => __( 'Keyword', 'flowbie-wp' ),
					'bodyColProgress'           => __( 'Progress', 'flowbie-wp' ),
					'bodySectionsComplete'      => __( 'sections complete', 'flowbie-wp' ),
					'bodyPhasePlanning'         => __( 'Planning blueprint…', 'flowbie-wp' ),
					'bodyPhaseReady'            => __( 'Ready to preview sections', 'flowbie-wp' ),
					'bodyHarnessActive'         => __( 'Harness', 'flowbie-wp' ),
					'bodyDiffCurrent'           => __( 'Current', 'flowbie-wp' ),
					'bodyDiffProposed'          => __( 'Proposed', 'flowbie-wp' ),
					'bodyDiffEmpty'             => __( '(no matching section)', 'flowbie-wp' ),
					'bodyStatusWaiting'         => __( 'Waiting', 'flowbie-wp' ),
					'bodyStatusGenerating'      => __( 'Generating…', 'flowbie-wp' ),
					'bodyStatusReady'           => __( 'Ready', 'flowbie-wp' ),
					'bodyStatusApplied'         => __( 'Applied', 'flowbie-wp' ),
					'bodyStatusError'           => __( 'Error', 'flowbie-wp' ),
					'contentOptimizer'          => __( 'Content Optimizer', 'flowbie-wp' ),
					'changeUrlTitle'            => __( 'Change URL', 'flowbie-wp' ),
					'currentUrl'                => __( 'Current URL', 'flowbie-wp' ),
					'newSlug'                   => __( 'New slug', 'flowbie-wp' ),
					'urlPreview'                => __( 'Preview', 'flowbie-wp' ),
					'updateUrl'                 => __( 'Update URL', 'flowbie-wp' ),
					'updatingUrl'               => __( 'Updating…', 'flowbie-wp' ),
					'urlUpdated'                => __( 'URL updated.', 'flowbie-wp' ),
					'redirectConfirm'           => __( 'Add a 301 redirect in Flowbie from the old URL to the new URL?\n\nFrom: %1$s\nTo: %2$s\n\nClick OK to add the redirect, or Cancel to update the URL only.', 'flowbie-wp' ),
					'redirectAdded'             => __( 'URL updated and 301 redirect added in Flowbie.', 'flowbie-wp' ),
					'redirectSkipped'           => __( 'URL updated. No redirect was added.', 'flowbie-wp' ),
					'redirectNoPermission'      => __( 'Only administrators can add 301 redirects in Flowbie. Your slug will still update.', 'flowbie-wp' ),
					'changeUrlFailed'           => __( 'URL update failed.', 'flowbie-wp' ),
					'changeUrlUnchangedHint'    => __( 'Change the slug below — it must be different from the live URL to enable Update URL.', 'flowbie-wp' ),
				),
			)
		);
	}

	private static function enqueue_fields_shim(): void {
		if ( class_exists( 'Flowbie_Wp_Fields', false ) && Flowbie_Wp_Fields::acf_is_active() ) {
			return;
		}
		$rel = 'assets/fields/acf-shim.js';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}
		wp_enqueue_script(
			'flowbie-fields-acf-shim-js',
			plugins_url( $rel, FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			FLOWBIE_WP_VERSION . '.' . (string) filemtime( $abs ),
			true
		);
		wp_enqueue_style(
			'flowbie-fields-inputs-css',
			plugins_url( 'assets/fields/admin-fields.css', FLOWBIE_WP_PLUGIN_FILE ),
			array(),
			FLOWBIE_WP_VERSION
		);
		Flowbie_Wp_Fields::enqueue_field_assets();
	}

	private static function enqueue_styles(): void {
		wp_enqueue_style(
			'flowbie-wp-ai-lato',
			'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,600;0,700;1,400&display=swap',
			array(),
			null
		);
		$files = array(
			'flowbie-wp-ai-tokens'        => 'flowbie-ai-tokens.css',
			'flowbie-wp-ai-components'    => 'flowbie-ai-components.css',
			'flowbie-wp-ai-sidebar'       => 'flowbie-ai-sidebar.css',
			'flowbie-wp-ai-body'          => 'flowbie-ai-body.css',
			'flowbie-wp-ai-toolbar'       => 'flowbie-ai-toolbar.css',
			'flowbie-wp-ai-modal'         => 'flowbie-ai-modal.css',
			'flowbie-wp-social-modal'     => 'flowbie-social-modal.css',
		);
		$prev = array( 'flowbie-wp-ai-lato' );
		foreach ( $files as $handle => $file ) {
			$rel = 'assets/editor/' . $file;
			$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
			$ver = FLOWBIE_WP_VERSION;
			if ( is_readable( $abs ) ) {
				$ver .= '.' . (string) filemtime( $abs );
			}
			wp_enqueue_style(
				$handle,
				plugins_url( $rel, FLOWBIE_WP_PLUGIN_FILE ),
				$prev,
				$ver
			);
			$prev[] = $handle;
		}
	}

	private static function enqueue_style(): void {
		self::enqueue_styles();
	}

	/**
	 * @param array<int,string> $deps
	 */
	private static function enqueue_script( string $handle, string $file, array $deps = array() ): void {
		$rel = 'assets/editor/' . $file;
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		$ver = FLOWBIE_WP_VERSION;
		if ( is_readable( $abs ) ) {
			$ver .= '.' . (string) filemtime( $abs );
		}
		wp_enqueue_script(
			$handle,
			plugins_url( $rel, FLOWBIE_WP_PLUGIN_FILE ),
			$deps,
			$ver,
			true
		);
	}
}

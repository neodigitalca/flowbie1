<?php
/**
 * Human-readable tool dictionary for admin Tool Library UI.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Tools_Library {

	/**
	 * @return array<string, string>
	 */
	public static function get_categories(): array {
		return array(
			'connection'  => __( 'Connection & site', 'flowbie-wp' ),
			'posts'       => __( 'Posts & pages', 'flowbie-wp' ),
			'fields'      => __( 'Flowbie Fields', 'flowbie-wp' ),
			'editor_ai'   => __( 'Editor AI wands', 'flowbie-wp' ),
			'body'        => __( 'Body harness', 'flowbie-wp' ),
			'agent_hub'   => __( 'Agent Hub SEO blocks', 'flowbie-wp' ),
			'image_seo'   => __( 'Image SEO', 'flowbie-wp' ),
			'site'        => __( 'Schema & sitemap', 'flowbie-wp' ),
			'redirects'   => __( 'Redirects', 'flowbie-wp' ),
			'scripts'     => __( 'Script Manager', 'flowbie-wp' ),
			'gmb'         => __( 'Google Business Profile', 'flowbie-wp' ),
			'assist'      => __( 'Backend Assist', 'flowbie-wp' ),
			'migrate'     => __( 'Super Import', 'flowbie-wp' ),
			'safety'      => __( 'Audit & safety', 'flowbie-wp' ),
		);
	}

	/**
	 * @param string $tool_name Tool name.
	 * @return string Category slug.
	 */
	public static function category_for_tool( string $tool_name ): string {
		if ( strpos( $tool_name, 'wp_fields_' ) === 0 ) {
			return 'fields';
		}
		if ( strpos( $tool_name, 'wp_ai_' ) === 0 ) {
			return 'editor_ai';
		}
		if ( strpos( $tool_name, 'wp_body_' ) === 0 ) {
			return 'body';
		}
		if ( strpos( $tool_name, 'wp_seo_' ) === 0 ) {
			return 'agent_hub';
		}
		if ( strpos( $tool_name, 'wp_image_seo_' ) === 0 ) {
			return 'image_seo';
		}
		if ( strpos( $tool_name, 'wp_sitemap_' ) === 0 ) {
			return 'site';
		}
		if ( strpos( $tool_name, 'wp_redirects_' ) === 0 ) {
			return 'redirects';
		}
		if ( strpos( $tool_name, 'wp_scripts_' ) === 0 ) {
			return 'scripts';
		}
		if ( strpos( $tool_name, 'wp_gmb_' ) === 0 ) {
			return 'gmb';
		}
		if ( strpos( $tool_name, 'wp_assist_' ) === 0 ) {
			return 'assist';
		}
		if ( strpos( $tool_name, 'wp_super_migrate_' ) === 0 ) {
			return 'migrate';
		}
		if ( in_array( $tool_name, array( 'wp_audit_list', 'wp_revision_restore' ), true ) ) {
			return 'safety';
		}
		if ( in_array( $tool_name, array( 'wp_ping', 'wp_whoami', 'wp_site_dashboard', 'wp_site_index', 'wp_site_index_search', 'wp_openrouter_status', 'wp_chat_settings_get', 'wp_chat_settings_update', 'wp_theme_functions_get', 'wp_theme_functions_put' ), true ) ) {
			return 'connection';
		}
		return 'posts';
	}

	/**
	 * Extended dictionary entries keyed by tool name.
	 *
	 * @return array<string, array{summary: string, params: array<string, string>, example?: string}>
	 */
	private static function dictionary(): array {
		return array(
			'wp_ping'                    => array(
				'summary' => __( 'Verifies Flowbie WP is installed and returns the plugin version. Use before any other tool.', 'flowbie-wp' ),
				'params'  => array(),
				'example' => '{}',
			),
			'wp_whoami'                  => array(
				'summary' => __( 'Returns the authenticated WordPress user, roles, and key capabilities for the Application Password in use.', 'flowbie-wp' ),
				'params'  => array(),
			),
			'wp_site_dashboard'          => array(
				'summary' => __( 'Loads paired Flowbie property metrics: post bank, SAP bank, optimization usage, and editorial period counts.', 'flowbie-wp' ),
				'params'  => array(),
			),
			'wp_site_index'              => array(
				'summary' => __( 'Builds a site graph of posts/pages with URL, focus keyword, and seo_research presence. Optional drafts.', 'flowbie-wp' ),
				'params'  => array(
					'include_drafts' => __( 'Include draft and pending posts.', 'flowbie-wp' ),
					'limit'          => __( 'Max items returned (default 500).', 'flowbie-wp' ),
				),
			),
			'wp_site_index_search'       => array(
				'summary' => __( 'Keyword search over the site index; ranks by title, excerpt, categories, and focus keyword.', 'flowbie-wp' ),
				'params'  => array(
					'query' => __( 'Search query string.', 'flowbie-wp' ),
					'limit' => __( 'Max results (default 8).', 'flowbie-wp' ),
				),
			),
			'wp_openrouter_status'       => array(
				'summary' => __( 'Reports whether OpenRouter is configured on this site. Does not return the API key.', 'flowbie-wp' ),
				'params'  => array(),
			),
			'wp_chat_settings_get'       => array(
				'summary' => __( 'Returns Flow Assist chat widget enabled and logged-in-only flags.', 'flowbie-wp' ),
				'params'  => array(),
			),
			'wp_chat_settings_update'    => array(
				'summary' => __( 'Updates Flow Assist chat widget enabled and/or logged-in-only visibility.', 'flowbie-wp' ),
				'params'  => array(
					'enabled'        => __( 'Master on/off for the frontend chat widget.', 'flowbie-wp' ),
					'logged_in_only' => __( 'When true, only logged-in WordPress users see the widget.', 'flowbie-wp' ),
				),
			),
			'wp_theme_functions_get'     => array(
				'summary' => __( 'Reads the active theme functions.php (child theme when active). Requires edit_themes.', 'flowbie-wp' ),
				'params'  => array(),
			),
			'wp_theme_functions_put'     => array(
				'summary' => __( 'Writes functions.php after backing up the current file. Requires confirm: true and edit_themes.', 'flowbie-wp' ),
				'params'  => array(
					'content' => __( 'Complete PHP file contents.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true to write.', 'flowbie-wp' ),
				),
			),
			'wp_list_posts'              => array(
				'summary' => __( 'Lists recent posts or pages with ID, title, status, type, and edit/view URLs.', 'flowbie-wp' ),
				'params'  => array(
					'post_type' => __( 'Post type slug (default post).', 'flowbie-wp' ),
					'count'     => __( 'Number of items (default 10).', 'flowbie-wp' ),
					'status'    => __( 'Post status filter.', 'flowbie-wp' ),
				),
			),
			'wp_get_post'                => array(
				'summary' => __( 'Fetches one post by post_id or title search.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Numeric post ID.', 'flowbie-wp' ),
					'title'   => __( 'Title search if post_id omitted.', 'flowbie-wp' ),
				),
			),
			'wp_get_post_content'        => array(
				'summary' => __( 'Returns rendered HTML content, raw blocks, excerpt, and permalink for a post.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Required post ID.', 'flowbie-wp' ),
				),
			),
			'wp_create_post'             => array(
				'summary' => __( 'Creates a new post (or custom post type). Can set focus keyword meta on create.', 'flowbie-wp' ),
				'params'  => array(
					'title'          => __( 'Post title (required).', 'flowbie-wp' ),
					'status'         => __( 'draft, publish, or private.', 'flowbie-wp' ),
					'post_type'      => __( 'Custom post type slug.', 'flowbie-wp' ),
					'focus_keyword'  => __( 'Rank Math focus keyword.', 'flowbie-wp' ),
					'categories'     => __( 'Array of category names.', 'flowbie-wp' ),
				),
			),
			'wp_create_page'             => array(
				'summary' => __( 'Creates a new WordPress page.', 'flowbie-wp' ),
				'params'  => array(
					'title'         => __( 'Page title (required).', 'flowbie-wp' ),
					'status'        => __( 'draft, publish, or private.', 'flowbie-wp' ),
					'focus_keyword' => __( 'Optional focus keyword.', 'flowbie-wp' ),
				),
			),
			'wp_update_post'             => array(
				'summary' => __( 'Updates core post fields without replacing full body content.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Required.', 'flowbie-wp' ),
					'title'   => __( 'New title.', 'flowbie-wp' ),
					'status'  => __( 'New status.', 'flowbie-wp' ),
					'excerpt' => __( 'Post excerpt.', 'flowbie-wp' ),
					'slug'    => __( 'Post slug (post_name).', 'flowbie-wp' ),
				),
			),
			'wp_add_content'             => array(
				'summary' => __( 'Appends or replaces HTML in post_content via Backend Assist content tool.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Target post.', 'flowbie-wp' ),
					'title'   => __( 'Find post by title if no ID.', 'flowbie-wp' ),
					'content' => __( 'HTML to add.', 'flowbie-wp' ),
					'mode'    => __( 'append or replace.', 'flowbie-wp' ),
				),
			),
			'wp_replace_content'         => array(
				'summary' => __( 'Replaces entire post_content. Snapshots content for wp_revision_restore.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Required.', 'flowbie-wp' ),
					'content' => __( 'Full new HTML/content.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true.', 'flowbie-wp' ),
				),
			),
			'wp_delete_post'             => array(
				'summary' => __( 'Moves post to trash or permanently deletes when force is true.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Required.', 'flowbie-wp' ),
					'force'   => __( 'Permanent delete if true.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true.', 'flowbie-wp' ),
				),
			),
			'wp_resolve_url'             => array(
				'summary' => __( 'Resolves a front-end URL or path to a post_id.', 'flowbie-wp' ),
				'params'  => array(
					'url' => __( 'Full permalink or path.', 'flowbie-wp' ),
				),
			),
			'wp_ai_apply_field'          => array(
				'summary' => __( 'Applies a previewed wand value to Rank Math meta, title, excerpt, or Flowbie Fields. Counts toward optimization usage.', 'flowbie-wp' ),
				'params'  => array(
					'post_id' => __( 'Required.', 'flowbie-wp' ),
					'field'   => __( 'title, focus_keyword, excerpt, seo_research, faq, page_url.', 'flowbie-wp' ),
					'value'   => __( 'Value to save.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true.', 'flowbie-wp' ),
				),
				'example' => '{"post_id":123,"field":"focus_keyword","value":"hvac edmonton","confirm":true}',
			),
			'wp_fields_import_json'      => array(
				'summary' => __( 'Import an ACF-compatible JSON export (field groups, post types, taxonomies). Strips UTF-8 BOM from ACF/Windows exports.', 'flowbie-wp' ),
				'params'  => array(
					'json'           => __( 'Full JSON string (use instead of file_path).', 'flowbie-wp' ),
					'file_path'      => __( 'Absolute path to a .json file on the server.', 'flowbie-wp' ),
					'delete_missing' => __( 'Remove field groups not present in the import.', 'flowbie-wp' ),
					'confirm'        => __( 'Must be true.', 'flowbie-wp' ),
				),
				'example' => '{"json":"[{\\"key\\":\\"group_abc\\",...}]","confirm":true}',
			),
			'wp_fields_export_json'      => array(
				'summary' => __( 'Export Flowbie field groups, post types, and taxonomies as ACF-compatible JSON.', 'flowbie-wp' ),
				'params'  => array(
					'keys' => __( 'Optional list of field group keys; empty exports all.', 'flowbie-wp' ),
				),
			),
			'wp_body_section_apply'      => array(
				'summary' => __( 'Writes AI-generated HTML into the matching H2 section and saves the post.', 'flowbie-wp' ),
				'params'  => array(
					'post_id'       => __( 'Required.', 'flowbie-wp' ),
					'sectionIndex'  => __( 'Zero-based section index.', 'flowbie-wp' ),
					'sessionId'     => __( 'Harness session ID.', 'flowbie-wp' ),
					'html'          => __( 'Section HTML to apply.', 'flowbie-wp' ),
					'confirm'       => __( 'Must be true.', 'flowbie-wp' ),
				),
			),
			'wp_super_migrate_plan'      => array(
				'summary' => __( 'Scan active third-party plugins and preview Super Import macro/micro steps.', 'flowbie-wp' ),
			),
			'wp_super_migrate_start'     => array(
				'summary' => __( 'Start a Super Import job (crawl third-party settings into Flo Sheet and/or apply).', 'flowbie-wp' ),
				'params'  => array(
					'phases'  => __( 'Array: crawl, apply.', 'flowbie-wp' ),
					'dry_run' => __( 'Apply phase only: log would-change counts without writes.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true when applying.', 'flowbie-wp' ),
				),
			),
			'wp_super_migrate_step'      => array(
				'summary' => __( 'Execute the next micro step of an active Super Import job.', 'flowbie-wp' ),
				'params'  => array(
					'job_id' => __( 'Required job id from wp_super_migrate_start.', 'flowbie-wp' ),
				),
			),
			'wp_super_migrate_status'    => array(
				'summary' => __( 'Poll macro/micro progress for a Super Import job.', 'flowbie-wp' ),
				'params'  => array(
					'job_id' => __( 'Required.', 'flowbie-wp' ),
				),
			),
			'wp_super_migrate_flo_sheet' => array(
				'summary' => __( 'Get the master Flo Sheet JSON workbook stored on this site.', 'flowbie-wp' ),
			),
			'wp_super_migrate_flo_sheet_import' => array(
				'summary' => __( 'Import Flo Sheet JSON and start apply-only import.', 'flowbie-wp' ),
				'params'  => array(
					'json'    => __( 'Flo Sheet JSON string.', 'flowbie-wp' ),
					'dry_run' => __( 'Optional dry run for apply phase.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true.', 'flowbie-wp' ),
				),
			),
			'wp_seo_blocks_list' => array(
				'summary' => __( 'List all Agent Hub SEO blocks from the registry table.', 'flowbie-wp' ),
			),
			'wp_seo_block_save' => array(
				'summary' => __( 'Create or update an Agent Hub SEO block and sync Elementor library template.', 'flowbie-wp' ),
				'params'  => array(
					'title'        => __( 'Theme / title for the block and library template.', 'flowbie-wp' ),
					'focus_keyword'=> __( 'Short keyword label.', 'flowbie-wp' ),
					'topic_focus'  => __( 'Intent prompt used by AI wands.', 'flowbie-wp' ),
					'h2'           => __( 'Optional first H2 slot when slots array is empty.', 'flowbie-wp' ),
					'slots'        => __( 'Structured slot JSON array.', 'flowbie-wp' ),
				),
			),
			'wp_seo_block_optimize' => array(
				'summary' => __( 'Preview or apply AI optimization for a SEO block (full or intent mode).', 'flowbie-wp' ),
				'params'  => array(
					'block_id'   => __( 'Registry block ID.', 'flowbie-wp' ),
					'post_id'    => __( 'Optional page ID for in-context optimization.', 'flowbie-wp' ),
					'element_id' => __( 'Optional Elementor element ID on the page.', 'flowbie-wp' ),
					'mode'       => __( 'full or intent.', 'flowbie-wp' ),
					'apply'      => __( 'When true, apply preview to registry/page.', 'flowbie-wp' ),
				),
			),
			'wp_seo_block_sync_library' => array(
				'summary' => __( 'Force rebuild of the linked Elementor library section for a block.', 'flowbie-wp' ),
				'params'  => array(
					'id'      => __( 'Registry block ID.', 'flowbie-wp' ),
					'confirm' => __( 'Must be true.', 'flowbie-wp' ),
				),
			),
			'wp_seo_blocks_usage' => array(
				'summary' => __( 'Scan Elementor pages for flowbie_seo_section widget instances.', 'flowbie-wp' ),
			),
		);
	}

	/**
	 * Full library rows for admin UI, grouped-ready.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_entries(): array {
		$dict       = self::dictionary();
		$registry   = Flowbie_Wp_Tools::get_registry();
		$entries    = array();

		foreach ( $registry as $name => $def ) {
			$extra    = isset( $dict[ $name ] ) ? $dict[ $name ] : array();
			$category = self::category_for_tool( $name );
			$params   = isset( $extra['params'] ) && is_array( $extra['params'] ) ? $extra['params'] : array();

			$entries[] = array(
				'name'             => $name,
				'category'         => $category,
				'category_label'   => self::get_categories()[ $category ] ?? $category,
				'risk'             => $def['risk'],
				'capability'       => $def['capability'],
				'description'      => $def['description'],
				'summary'          => isset( $extra['summary'] ) ? $extra['summary'] : $def['description'],
				'params'           => $params,
				'requires_confirm' => Flowbie_Wp_Tools::requires_confirm( $name ),
				'example'          => isset( $extra['example'] ) ? $extra['example'] : '',
				'endpoint'         => 'POST /wp-json/flowbie/v1/tools/execute',
			);
		}

		usort(
			$entries,
			function ( $a, $b ) {
				$c = strcmp( $a['category'], $b['category'] );
				if ( $c !== 0 ) {
					return $c;
				}
				return strcmp( $a['name'], $b['name'] );
			}
		);

		return $entries;
	}

	/**
	 * @return array<string, array<int, array<string, mixed>>>
	 */
	public static function get_entries_by_category(): array {
		$grouped = array();
		foreach ( self::get_categories() as $slug => $label ) {
			$grouped[ $slug ] = array();
		}
		foreach ( self::get_entries() as $entry ) {
			$cat = $entry['category'];
			if ( ! isset( $grouped[ $cat ] ) ) {
				$grouped[ $cat ] = array();
			}
			$grouped[ $cat ][] = $entry;
		}
		return array_filter( $grouped );
	}

	/**
	 * @return int
	 */
	public static function tool_count(): int {
		return count( Flowbie_Wp_Tools::get_registry() );
	}
}

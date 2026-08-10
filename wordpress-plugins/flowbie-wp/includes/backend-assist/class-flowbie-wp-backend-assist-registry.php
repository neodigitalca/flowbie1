<?php
/**
 * Backend Assist — tool registry and default tool registration
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Registry {

	public static function register_tool( string $tool_name, callable $handler, string $description = '' ): void {
		Flowbie_Wp_Backend_Assist_Context::$tool_registry[ $tool_name ] = array(
			'handler'     => $handler,
			'description' => $description,
		);
	}
	public static function get_tool_descriptions(): string {
		$lines = array();
		foreach ( Flowbie_Wp_Backend_Assist_Context::$tool_registry as $name => $entry ) {
			$lines[] = "- \"{$name}\": {$entry['description']}";
		}
		return implode( "\n", $lines );
	}
	public static function register_default_tools(): void {
		foreach ( Flowbie_Wp_Tools::backend_assist_tool_names() as $ba_name ) {
			$entry = Flowbie_Wp_Tools::get_backend_assist_entry( $ba_name );
			if ( $entry && is_callable( $entry['handler'] ) ) {
				self::register_tool( $ba_name, $entry['handler'], $entry['description'] );
			}
		}

		self::register_tool(
			'compose_seo_block',
			static function ( array $params ): array {
				if ( ! class_exists( 'Flowbie_Wp_Seo_Blocks_Agent', false ) ) {
					require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-agent.php';
				}
				return Flowbie_Wp_Seo_Blocks_Agent::tool_handler( $params );
			},
			'Generate, optimize, or analyze a full Agent Hub SEO block manifest (title, slots, layout grid, responsive settings) from natural language'
		);

		self::register_tool(
			'get_gsc_context',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_get_gsc_context' ),
			'Fetch Google Search Console keyword/query data for a post or the whole site (read-only)'
		);

		self::register_tool(
			'save_post_meta',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_save_post_meta' ),
			'Save SEO meta on an existing post or page: focusKeyword, metaDescription, seoTitle, faq, seoResearch, dateModifier (ACF date_modifier). Clear a field with clear/empty/remove phrasing. Requires post_id or title.'
		);

		self::register_tool(
			'run_seo_research_brief',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_run_seo_research_brief' ),
			'Build SeoContentBriefV1 JSON from DataForSEO SERP + GSC page queries + Semrush and auto-save to ACF seo_research. Requires post_id and focus keyword on the post.'
		);

		self::register_tool(
			'update_post',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_update_post' ),
			'Update WordPress post fields on an existing post or page: title (post_title), status, excerpt, slug. NOT body HTML. NOT SEO meta. Requires post_id.'
		);

		self::register_tool(
			'restore_post_revision',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_restore_post_revision' ),
			'Undo the last agent body edit on a post by restoring the pre-edit snapshot. Requires post_id.'
		);

		self::register_tool(
			'modify_seo_block_slots',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_modify_seo_block_slots' ),
			'Add, remove, or update individual slots (H2, paragraph, CTA, list, image) in an SEO block manifest'
		);

		self::register_tool(
			'list_seo_blocks',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_list_seo_blocks' ),
			'List Agent Hub SEO blocks with id, title, focus keyword, and status'
		);

		self::register_tool(
			'create_seo_block',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_create_seo_block' ),
			'Create a new draft SEO block in Agent Hub'
		);

		self::register_tool(
			'delete_seo_block',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_delete_seo_block' ),
			'Delete an SEO block from Agent Hub by block_id'
		);

		self::register_tool(
			'save_seo_block',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_save_seo_block' ),
			'Persist an SEO block manifest to the database'
		);

		self::register_tool(
			'apply_seo_block_to_page',
			array( 'Flowbie_Wp_Backend_Assist', 'tool_apply_seo_block_to_page' ),
			'Insert a registry-linked flowbie_seo_section widget on an Elementor page (dynamic block + optional Flowbie Fields heading tag)'
		);

		Flowbie_Wp_Backend_Assist_Tools_Analytics::register_tools();
	}
}

<?php
/**
 * Backend Assist — plan, execute, reason, and format AI phases
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Pipeline_Phases {

	public static function phase_plan( string $message, array $history, string $tool, array $params ): array {
		$site_name         = get_bloginfo( 'name' );
		$tool_descriptions = Flowbie_Wp_Backend_Assist_Registry::get_tool_descriptions();

		$history_text = '';
		foreach ( array_slice( $history, -6 ) as $entry ) {
			$role          = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
			$history_text .= "{$role}: {$entry['content']}\n";
		}

		$params_json = wp_json_encode( $params, JSON_UNESCAPED_SLASHES );

		$focus_keyword_context = '';
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		$fk      = '';
		if ( $post_id > 0 ) {
			$fk = get_post_meta( $post_id, '_flowbie_focus_keyword', true );
		}
		if ( $fk === '' && ! empty( $params['focus_keyword'] ) ) {
			$fk = sanitize_text_field( $params['focus_keyword'] );
		}
		if ( $fk !== '' ) {
			$focus_keyword_context = "FOCUS KEYWORD for this post: \"{$fk}\" — use this topic to guide content generation.\n";
		}
		if ( $post_id > 0 ) {
			$gsc_block = Flowbie_Wp_Gsc_Prompt::for_post( $post_id, $fk );
			if ( $gsc_block !== '' ) {
				$focus_keyword_context .= "Use these Search Console queries naturally in copy (do not keyword-stuff):\n{$gsc_block}\n";
			} elseif ( ! Flowbie_Wp_Gsc_Prompt::is_available() ) {
				$focus_keyword_context .= "GSC unavailable — optimize for the focus keyword only.\n";
			}
			$existing = get_post( $post_id );
			if ( $existing && trim( $existing->post_content ) !== '' ) {
				$focus_keyword_context .= "EXISTING CONTENT on page:\n" . wp_strip_all_tags( $existing->post_content ) . "\n";
			}
		}

		$system = <<<PROMPT
You are the content reasoning engine for "Flow Assist", a WordPress backend specialist on "{$site_name}".

The classifier determined the user wants to run tool "{$tool}" with params: {$params_json}

YOUR JOB: Finalize the parameters so the tool can execute successfully. You MUST generate any content the user asks for.

CONVERSATION HISTORY:
{$history_text}

USER MESSAGE: {$message}

{$focus_keyword_context}
AVAILABLE TOOLS:
{$tool_descriptions}

RULES:
1. RESOLVE REFERENCES: If params contain empty/missing values but the conversation history has the answer (e.g. a recent [post_id=X, title="Y"] tag), fill them in.
2. GENERATE CONTENT — THIS IS YOUR PRIMARY ROLE: When the tool is "add_content" and the "content" param is empty or the user asks you to write/generate/add content, YOU MUST produce the actual HTML content. Do NOT return empty content. Do NOT say you cannot generate content.
3. USE THE FOCUS KEYWORD: If a focus keyword is provided above, write content that is topically relevant, SEO-friendly, and centered on that keyword/topic.
4. USE GSC QUERIES: When Search Console query data is present, weave relevant queries naturally into headings and body copy.
4. CONTENT FORMAT: Generate well-structured semantic HTML. Use <h2>, <h3>, <p>, <ul>/<li> tags as appropriate. Write informative, useful paragraphs (2-4 sentences each).
5. If the user says "add paragraphs to each section" or "add content to each H2", generate a <p> paragraph under each existing <h2> on the page. Use the EXISTING CONTENT above to see what headings exist.
6. If a post_id or title is missing but identifiable from history, fill it in.
7. NEVER return empty "content" param. If the user wants content added, you MUST write it.
8. If "content_brief" is provided but "content" is empty, generate full HTML from the brief into "content".
9. Use mode "replace" when populating a newly created empty post or when replacing the full body. Use "append" only when adding to non-empty existing content without replacing it.
10. For tables use HTML <table>, <thead>, <tbody>, <tr>, <th>, <td>.

OUTPUT only valid JSON:
{
  "tool": "{$tool}",
  "params": { ...fully resolved and complete params with generated HTML content... }
}
PROMPT;

		$result = Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::REASON_MODEL, $system, $message, 4096, 0.5 );
		if ( is_wp_error( $result ) ) {
			return array( 'tool' => $tool, 'params' => $params );
		}

		$parsed = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( $result );
		if ( ! is_array( $parsed ) || ! isset( $parsed['params'] ) ) {
			return array( 'tool' => $tool, 'params' => $params );
		}

		$resolved_tool   = isset( $parsed['tool'] ) ? $parsed['tool'] : $tool;
		$resolved_params = is_array( $parsed['params'] ) ? $parsed['params'] : $params;

		if ( ! isset( Flowbie_Wp_Backend_Assist_Context::$tool_registry[ $resolved_tool ] ) ) {
			$resolved_tool = $tool;
		}

		return array( 'tool' => $resolved_tool, 'params' => $resolved_params );
	}
	public static function phase_execute( string $tool, array $params ): array {
		$entry   = Flowbie_Wp_Backend_Assist_Context::$tool_registry[ $tool ];
		$handler = $entry['handler'];

		try {
			return call_user_func( $handler, $params );
		} catch ( \Throwable $e ) {
			return array(
				'success' => false,
				'error'   => $e->getMessage(),
			);
		}
	}
	public static function phase_reason_action( string $message, array $history, string $tool, array $params, array $result, bool $workflow_complete = false, string $steps_summary = '' ) {
		$result_json  = wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		$site_name    = get_bloginfo( 'name' );
		$params_label = isset( $params['title'] ) ? $params['title'] : wp_json_encode( $params );

		$history_text = '';
		foreach ( array_slice( $history, -4 ) as $entry ) {
			$role          = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
			$history_text .= "{$role}: {$entry['content']}\n";
		}

		$workflow_rules = '';
		if ( $workflow_complete ) {
			$workflow_rules = <<<WF

MULTI-STEP WORKFLOW COMPLETED. All requested work from the user's original message is DONE.
Steps executed:
{$steps_summary}

RULES FOR WORKFLOW COMPLETION:
- Summarize everything that was completed in one cohesive answer.
- Do NOT list follow-up actions for work already requested (e.g. do not say "add H2s" if headings were part of the request).
- Do NOT suggest incomplete todos.
WF;
		}

		$system = <<<PROMPT
You are "Flow Assist", the backend technical specialist for "{$site_name}".
You just executed a WordPress operation. Summarize the result for the admin user.

TOOL EXECUTED: {$tool}
PARAMETERS: {$params_label}
RESULT:
{$result_json}

CONVERSATION:
{$history_text}
{$workflow_rules}

RULES:
- Be concise and direct.
- If successful, confirm what was created/done and provide the relevant URL(s).
- If failed, explain why clearly and suggest a fix.
- Include any edit or view links from the result.
PROMPT;

		if ( ! $workflow_complete ) {
			$system .= "\n- Suggest 2-3 logical next actions only when the user's original request may still be incomplete.";
		}

		$inventory_block = self::builder_inventory_prompt_block();
		if ( $inventory_block !== '' ) {
			$system .= "\n\n" . $inventory_block;
			if ( $tool === 'get_chat_insights' ) {
				$system .= "\n- Cross-check chat gaps against SITE INVENTORY. Do not recommend topics already covered by an existing URL or title.";
			}
		}

		if ( $tool === 'analyze_content_gaps' ) {
			$system .= <<<'GAP'

CONTENT GAP ANALYSIS RULES (mandatory):
- existing_blogs in RESULT is the authoritative list of blog posts already on this site.
- Do NOT suggest any blog idea whose topic is already covered by a title, URL slug, or focus_keyword in existing_blogs.
- Use chat_insights only to find visitor questions that existing_blogs do not answer.
- If a chat topic matches an existing post (e.g. Hunter Douglas vs Alta), skip it and cite the existing URL instead of suggesting a new post.
- Every idea must be net-new relative to existing_blogs. Prefer gaps where chat shows demand but no matching blog exists.
- Lead with what the site already covers, then list only genuine gaps.
GAP;
		}

		if ( $tool === 'grade_post_library_seo' ) {
			$system .= <<<'GRADE'

POST LIBRARY SEO GRADING RULES (mandatory):
- RESULT contains the full graded library (total posts). Grade the entire library. Never ask the user to pick a subset.
- Lead with aggregate summary counts from summary (A/B/C/D, missing_keyword, missing_meta).
- Highlight up to 10 posts needing work (grade D or C) with exact url from posts[].
- Highlight up to 5 strong posts (grade A) with exact url from posts[].
- Use site_top_queries only for optional recommendations, not to change per-post grades.
- Do not claim analysis is incomplete when total matches the library size.
GRADE;
		}

		return Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::REASON_MODEL, $system, $message, 1536, 0.4 );
	}
	public static function phase_reason_question( string $message, array $history ) {
		$site_name = get_bloginfo( 'name' );
		$site_info = Flowbie_Wp_Backend_Assist_Ai::build_site_context();

		$history_text = '';
		foreach ( array_slice( $history, -6 ) as $entry ) {
			$role          = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
			$history_text .= "{$role}: {$entry['content']}\n";
		}

		$analytics_note = current_user_can( 'manage_options' )
			? "- You can analyze visitor chat logs, site search, Overseer engagement, and GSC data using the analytics tools.\n- Summarize knowledge gaps and suggest content or KB updates when relevant.\n"
			: "- Analytics tools (chat logs, search logs, Overseer) require site admin access.\n";

		$system = <<<PROMPT
You are "Flow Assist", the backend technical specialist for "{$site_name}".
You help WordPress administrators with backend operations, content management, and technical questions.

SITE CONTEXT:
{$site_info}

CONVERSATION:
{$history_text}

RULES:
- Answer questions about WordPress administration, content structure, and site configuration.
- Be concise and technical when appropriate.
- If the user wants to perform an action, tell them they can ask you to do it directly.
- Mention available capabilities: create pages, create posts, list content.
- God Mode uses Ask / Plan / Build submodes in the composer. You cannot switch modes yourself; the user uses the mode pill or the Switch to Build chip on blocked cards.
{$analytics_note}- Suggest relevant follow-up actions.
PROMPT;

		$inventory_block = self::builder_inventory_prompt_block();
		if ( $inventory_block !== '' ) {
			$system .= "\n\n" . $inventory_block;
		}

		return Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::REASON_MODEL, $system, $message, 1536, 0.5 );
	}
	public static function phase_format( string $answer, string $card_type, bool $workflow_complete = false ) {
		$suggested_rules = $workflow_complete
			? '- "suggested_actions": optional extras only (e.g. "Open in editor", "Publish post", "Create another"). Use [] if nothing useful. NEVER repeat work already done.'
			: '- "suggested_actions" should be 2-4 short actionable follow-ups only for work NOT already covered in the answer.';

		$system = <<<PROMPT
Convert this assistant answer into ONLY valid JSON:
{
  "type": "{$card_type}",
  "title": "short bold summary",
  "body": "full answer with markdown",
  "links": [{"label": "text", "url": "https://...", "icon": "page|post|external|edit"}],
  "cta": {"label": "button text", "url": "https://..."},
  "suggested_actions": ["Create another page", "View all drafts", "Edit this post"],
  "confidence": "high|medium|low"
}

Rules:
- "links" should contain every URL from the answer.
- Use exact https URLs from the answer or tool RESULT. Never use "#" or placeholder links.
{$suggested_rules}
- Output ONLY the JSON object.
PROMPT;

		$result = Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::FAST_MODEL, $system, $answer, 1536, 0.1 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( $result );
		if ( null === $parsed || ! isset( $parsed['title'] ) ) {
			return new WP_Error( 'flowbie_backend_format', 'Format phase failed.' );
		}

		$parsed['type']       = isset( $parsed['type'] ) ? $parsed['type'] : $card_type;
		$parsed['confidence'] = isset( $parsed['confidence'] ) ? $parsed['confidence'] : 'medium';

		return $parsed;
	}

	/**
	 * @return string
	 */
	private static function builder_inventory_prompt_block(): string {
		if ( ! is_array( Flowbie_Wp_Backend_Assist_Context::$builder_context ) ) {
			return '';
		}

		$blocks = array();
		if ( ! empty( Flowbie_Wp_Backend_Assist_Context::$builder_context['site_blog_inventory_summary'] ) ) {
			$blog = (string) Flowbie_Wp_Backend_Assist_Context::$builder_context['site_blog_inventory_summary'];
			$blocks[] = "EXISTING BLOG POSTS (cached site inventory):\n{$blog}";
		}
		if ( ! empty( Flowbie_Wp_Backend_Assist_Context::$builder_context['site_inventory_summary'] ) ) {
			$inventory = (string) Flowbie_Wp_Backend_Assist_Context::$builder_context['site_inventory_summary'];
			$blocks[]  = "SITE INVENTORY (all post types):\n{$inventory}";
		}

		return implode( "\n\n", $blocks );
	}
}

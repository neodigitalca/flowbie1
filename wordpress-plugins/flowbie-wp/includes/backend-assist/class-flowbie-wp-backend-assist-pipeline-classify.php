<?php
/**
 * Backend Assist — intent classification and workflow decomposition
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Pipeline_Classify {

	public static function phase_classify( string $message, array $history = array() ) {
		$tool_descriptions = Flowbie_Wp_Backend_Assist_Registry::get_tool_descriptions();
		$site_name         = get_bloginfo( 'name' );

		$history_context = '';
		$recent = array_slice( $history, -6 );
		if ( ! empty( $recent ) ) {
			$lines = array();
			foreach ( $recent as $entry ) {
				$role    = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
				$lines[] = "{$role}: {$entry['content']}";
			}
			$history_context = "CONVERSATION HISTORY:\n" . implode( "\n", $lines ) . "\n\n";
		}

		$system = <<<PROMPT
You are a WordPress backend operations classifier for "{$site_name}".
Given a user message (and conversation history if present), determine the user's intent.

AVAILABLE TOOLS:
{$tool_descriptions}

{$history_context}Output ONLY valid JSON:
{
  "intent": "action" or "needs_info" or "question",
  "tool": "tool_name" or "" if question,
  "params": { extracted parameters object },
  "missing": ["list of missing required params"] or [],
  "confidence": "high" or "medium" or "low"
}

INTENT RULES:
- "action": User wants a tool AND enough context exists to proceed (params given OR resolvable from history). Set this even if content needs generating.
- "needs_info": User wants a tool but CRITICAL info is truly unresolvable. Only use when history has NO relevant context.
- "question": User is asking a question, not requesting a tool action.

REQUIRED PARAMS:
- create_page REQUIRES: "title". OPTIONAL: "status" (default draft), "focus_keyword"
- create_post REQUIRES: "title". OPTIONAL: "status" (default draft), "focus_keyword", "categories"
- list_posts: no required params. OPTIONAL: "post_type", "count", "status"
- get_post REQUIRES at least one of: "post_id" or "title"
- add_content: needs a target (post_id or title) + content description. OPTIONAL: "mode" ("append" or "replace", default "append")

CONTEXT RESOLUTION (VERY IMPORTANT):
- Assistant messages contain metadata like [post_id=123, title="My Page"]. This identifies the post that was just created or acted on.
- If the user says "it", "that post", "the page", "this one", "add to it", "add content", "add H2s", etc., resolve using the most recent [post_id=X, title="Y"] from history.
- When a recent [post_id=X] exists in history, the target IS known. Extract it into params.
- NEVER return "needs_info" for post_id/title if history contains [post_id=X, title="Y"].

CRITICAL:
- If the user says "create a page" or "create a post" WITHOUT specifying a title, set intent to "needs_info" and list "title" in "missing".
- If conversation history shows user previously requested a tool and the CURRENT message provides the missing info (like a title), set intent to "action" and extract the params from the current message.
- For create_page/create_post, also extract "focus_keyword" if the user mentions a keyword, SEO term, or focus keyword.
- For add_content: ALWAYS set intent to "action" if the user indicates what to add (e.g. "add H2s", "add content", "write 5 headings") — even if "content" param is empty. The planning phase generates it.
- For add_content: ALWAYS set intent to "action" if a target post is identifiable from history metadata [post_id=X] — even if user just says "add to it".
- For add_content: only set "needs_info" if BOTH conditions are true: (1) no target post exists in history AND user doesn't name one, AND (2) user gives zero indication of what to write.
- COMPOUND CREATE+CONTENT: If the user asks to create a post/page AND specifies body structure (headings, table, sections) in the same message, still set intent "action" with tool create_post or create_page — the plan endpoint will split into a workflow.
- COMPOUND CREATE+SEO BLOCK: If the user asks to create a page AND apply/compose an SEO block, Elementor section, registry link, or dynamic tag, set intent "action" with create_page — the plan endpoint will use the Elementor SEO block workflow (compose → save → apply).
- GSC KEYWORDS: For "what keywords", "search console", "GSC data", or keyword research requests, use tool get_gsc_context with post_id when known.
- SEO BLOCKS: list_seo_blocks, create_seo_block, delete_seo_block (requires block_id), save_seo_block (requires block manifest or block_id), modify_seo_block_slots for slot-level edits, compose_seo_block for full block generation.
- apply_seo_block_to_page REQUIRES: post_id and block_id (or resolvable from workflow/history). OPTIONAL: sync_library (default true), include_dynamic_heading (default true), mode (append|replace).
- For "apply block X to page Y" when both IDs are known, use apply_seo_block_to_page directly with intent "action".
PROMPT;

		if (
			is_array( self::$builder_context )
			&& ! empty( self::$builder_context['block'] )
			&& is_array( self::$builder_context['block'] )
		) {
			$block_json = wp_json_encode( self::$builder_context['block'], JSON_UNESCAPED_SLASHES );
			$page_note  = Flowbie_Wp_Backend_Assist_Pipeline_Content_Prep::builder_context_page_prompt( self::$builder_context['block'] );
			$system    .= <<<CTX

BUILDER CONTEXT (Agent Hub SEO block editor):
The user is editing an SEO block in the builder. Current block JSON:
{$block_json}
{$page_note}
For generate, optimize, layout, analyze, or rewrite requests about this block, prefer tool "compose_seo_block".
For surgical edits (add/remove/update a single slot such as H2, paragraph, CTA, list, image), prefer tool "modify_seo_block_slots" with action add, remove, or update.
Set intent to "action" and include params: prompt (user request), mode ("generate_full", "optimize", or "analyze") for compose_seo_block; or action + slot/target for modify_seo_block_slots.
CTX;
		}

		$system .= "\n- Output ONLY the JSON object.\n";

		$result = Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::FAST_MODEL, $system, $message, 512, 0.1 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( $result );
		if ( null === $parsed ) {
			return array(
				'intent' => 'question',
				'tool'   => '',
				'params' => array(),
			);
		}

		return $parsed;
	}
	public static function phase_decompose_workflow( string $message, array $history = array() ) {
		$tool_descriptions = Flowbie_Wp_Backend_Assist_Registry::get_tool_descriptions();
		$site_name         = get_bloginfo( 'name' );
		$service_area_note = post_type_exists( 'service-area' )
			? 'The site has post_type "service-area" for service area / location posts.'
			: '';

		$history_context = '';
		foreach ( array_slice( $history, -6 ) as $entry ) {
			$role             = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
			$history_context .= "{$role}: {$entry['content']}\n";
		}

		$system = <<<PROMPT
You are a workflow planner for WordPress Backend Assist on "{$site_name}".
Break the user request into an ordered checklist of tool steps, or return workflow:false for simple single-tool requests.

AVAILABLE TOOLS:
{$tool_descriptions}

{$service_area_note}

CONVERSATION:
{$history_context}

Output ONLY valid JSON:
{
  "workflow": true or false,
  "title": "short task title for the card",
  "steps": [
    { "tool": "create_post", "label": "human-readable step", "params": { } }
  ]
}

WORKFLOW TRUE when ANY of these apply:
- User asks to CREATE a page/post AND also specifies body content (H2/H3 headings, table, intro, FAQ, paragraphs, sections, "content for each", lists, etc.) in the same message.
- User asks to CREATE a page AND wants an SEO block, Agent Hub block, Elementor page, registry/dynamic block link, or section blocks/slots on that page.
- User asks for a multi-part deliverable in one message (e.g. create + write content + keyword, or create page + SEO block + sections).
- Phrases like "add 5 h2s", "with content", "and a table", "write sections", "SEO block", "apply block to page", "dynamic tag" combined with create → always workflow.

WORKFLOW FALSE when:
- User asks a question only.
- User wants list_posts, get_post, get_gsc_context, list_seo_blocks, or add_content to an existing post from history only.
- User only wants to create a page/post with title/keyword but NO body structure or content instructions.
- Single SEO block slot edit (modify_seo_block_slots) or save/create/delete block without page creation.
- Single apply_seo_block_to_page when post_id and block_id are known (no create/compose in same message).

STEP RULES:
1. First step: create_post or create_page with title, focus_keyword, status, post_type if applicable.
2. Plain post body (no SEO block / Elementor language): add_content with mode "replace", "expand_sections": true, and content_brief. Do NOT put post_id in step 2 — filled after step 1.
3. Elementor SEO block page path (when user mentions SEO block, Agent Hub block, Elementor, registry link, dynamic tag, or section blocks on a NEW page):
   a. create_page (step 1)
   b. compose_seo_block with mode "generate_full" and prompt/content_brief copying ALL section instructions (H2 topics, lists, FAQ, keyword). Do NOT include post_id or block_id — server fills from prior steps.
   c. save_seo_block (no block_manifest in params — filled from compose step)
   d. apply_seo_block_to_page with sync_library true, include_dynamic_heading true
   e. Optional modify_seo_block_slots only if user asked for one specific slot change after the block exists
4. "service area post" → post_type "service-area" on create step when that type exists.
5. Each step needs a clear "label" for a UI checklist.
6. Infer title and focus_keyword from the user message when implied.

EXAMPLE (plain content workflow):
User: "Create a blog post titled seo near whyte ave, use that as keyword focus, add 5 h2's and content for each with a list and table"
→ steps: [
  { "tool": "create_post", "label": "Create blog post SEO Near Whyte Ave", "params": { "title": "SEO Near Whyte Ave", "focus_keyword": "seo near whyte ave" } },
  { "tool": "add_content", "label": "Add 5 H2 sections with copy, lists, and table", "params": { "mode": "replace", "content_brief": "Write 5 H2 sections, each with paragraph content and a bullet list; include one HTML table; focus keyword seo near whyte ave; topic Whyte Ave Edmonton SEO." } }
]

EXAMPLE (SEO block + Elementor page workflow):
User: "Create a page about window treatments in Edmonton, apply an SEO block with dynamic registry link, add sections for types, benefits, and FAQ"
→ steps: [
  { "tool": "create_page", "label": "Create page Window Treatments Edmonton", "params": { "title": "Window Treatments Edmonton", "focus_keyword": "window treatments edmonton" } },
  { "tool": "compose_seo_block", "label": "Compose SEO block sections", "params": { "mode": "generate_full", "prompt": "Window treatments in Edmonton: H2 sections for types of window treatments, benefits, and FAQ. Focus keyword window treatments edmonton." } },
  { "tool": "save_seo_block", "label": "Save SEO block to Agent Hub", "params": {} },
  { "tool": "apply_seo_block_to_page", "label": "Apply registry-linked block to page", "params": { "sync_library": true, "include_dynamic_heading": true } }
]

Output ONLY the JSON object.
PROMPT;

		$result = Flowbie_Wp_Backend_Assist_Ai::call_openrouter( Flowbie_Wp_Backend_Assist_Context::FAST_MODEL, $system, $message, 1024, 0.15 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = Flowbie_Wp_Backend_Assist_Ai::parse_json_response( $result );
		if ( null === $parsed ) {
			return array( 'workflow' => false, 'steps' => array() );
		}

		return $parsed;
	}
}

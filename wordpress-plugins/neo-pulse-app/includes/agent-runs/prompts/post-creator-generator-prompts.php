<?php
/**
 * Generator checklist/blueprint prompts (parity with post-creator-generator-prompts.ts).
 * DO NOT EDIT BY HAND — run: node scripts/export-post-creator-generator-php.mjs
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Generator_Prompts {

	private static function link_feature_placeholder(): string {
		return '[LINK]: 3-5 internal link placeholders via [[LINK:query|anchor]]';
	}

	private static function keyword_section( string $primary, array $selected_keywords, array $keyword_data ): string {
		$vol = isset( $keyword_data['searchVolume'] ) ? (int) $keyword_data['searchVolume'] : 0;
		$diff = isset( $keyword_data['difficulty'] ) ? (int) $keyword_data['difficulty'] : 0;
		$intent = trim( (string) ( $keyword_data['intent'] ?? 'N/A' ) );
		$selected = ! empty( $selected_keywords ) ? implode( ', ', $selected_keywords ) : 'None';
		return "--- Keyword Context ---\n"
			. "Primary Keyword: {$primary}\n"
			. 'Search Volume: ' . ( $vol > 0 ? number_format( $vol ) : 'N/A' ) . "\n"
			. "Difficulty: {$diff}/100\n"
			. "Intent: {$intent}\n"
			. "Selected Keywords: {$selected}\n\n"
			. "FOCUS KEYWORD DENSITY: Target minimum ~1.0% focus keyword density (exact phrase + combinations), not ~0.5%.\n"
			. "EXACT PRIMARY PER H2: Include the exact primary keyword phrase at least once in every H2 section body.\n"
			. 'PARAGRAPH LENGTH: Moderately short paragraphs (~2-4 sentences); split long blocks.';
	}

	/**
	 * @param array<int,array<string,mixed>> $posts
	 */
	private static function wordpress_posts_block( array $posts, string $site_name ): string {
		if ( empty( $posts ) ) {
			return '';
		}
		$lines = array();
		foreach ( array_slice( $posts, 0, 30 ) as $i => $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$title   = trim( (string) ( $post['title'] ?? '' ) );
			$link    = trim( (string) ( $post['link'] ?? '' ) );
			$excerpt = wp_strip_all_tags( (string) ( $post['excerpt'] ?? '' ) );
			$excerpt = substr( $excerpt, 0, 80 );
			$lines[] = ( $i + 1 ) . '. "' . $title . '"' . ( $excerpt !== '' ? ' - ' . $excerpt : '' ) . "\n   URL: {$link}";
		}
		if ( empty( $lines ) ) {
			return '';
		}
		return "\n=== WORDPRESS POSTS SOURCE (INTERNAL LINKS) ===\n"
			. "Available WordPress Posts from {$site_name} (" . count( $posts ) . " total):\n\n"
			. implode( "\n\n", $lines ) . "\n\n"
			. "Use ONLY URLs from this list for [LINK] placeholders. Never invent internal URLs.\n"
			. "=== END WORDPRESS POSTS SOURCE ===\n";
	}

	private static function checklist_format_example( string $h2_sample ): string {
		$sample = $h2_sample !== '' ? $h2_sample : 'Core Benefits';
		return "CRITICAL FORMAT REQUIREMENT:\n"
			. "Format your response as a numbered list, one item per line. Do NOT use ## markdown headings in checklist items.\n\n"
			. "Example (NOTE: numbered lines only — no ##):\n"
			. "1. Why Smart Blinds Matter for Modern Homes [STRUCTURE]: 2 short paragraphs. [EXACT PRIMARY PER H2]: exact primary once in body. [FOCUS KEYWORD DENSITY]: ~1%+ across article. [LINK]: 3-5 [[LINK:query|anchor]] placeholders.\n"
			. "2. {$sample} [STRUCTURE]: 1-2 paragraphs. [TABLE]: compact comparison table. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
			. "3. Installation Steps [LIST]: number step-by-step process. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
			. "4. Maintenance Tips [LIST]: bullet key benefits. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
			. "5. Conclusion and Next Steps [EXACT PRIMARY PER H2]. [LINK]: CTA internal links.\n\n"
			. 'Output ONLY the numbered checklist items, no additional text.';
	}

	/**
	 * @param array<string,mixed> $ctx
	 * @return array{system:string,user:string}
	 */
	public static function build_checklist_messages( array $ctx ): array {
		$title             = trim( (string) ( $ctx['title'] ?? '' ) );
		$keyword           = trim( (string) ( $ctx['keyword'] ?? '' ) );
		$primary           = strtolower( $keyword );
		$selected_keywords = is_array( $ctx['selectedKeywords'] ?? null ) ? $ctx['selectedKeywords'] : array();
		$h2_sections       = is_array( $ctx['selectedH2Sections'] ?? null ) ? $ctx['selectedH2Sections'] : array();
		$user_prompt       = trim( (string) ( $ctx['userPrompt'] ?? '' ) );
		$site              = is_array( $ctx['connectedSite'] ?? null ) ? $ctx['connectedSite'] : array();
		$posts             = is_array( $ctx['wordPressPosts'] ?? null ) ? $ctx['wordPressPosts'] : array();
		$paa               = is_array( $ctx['paaQuestions'] ?? null ) ? $ctx['paaQuestions'] : array();
		$bucket_block      = trim( (string) ( $ctx['bucketReadFirstBlock'] ?? '' ) );
		$keyword_data      = is_array( $ctx['keywordData'] ?? null ) ? $ctx['keywordData'] : array( 'keyword' => $keyword );

		$h2_block = '';
		if ( ! empty( $h2_sections ) ) {
			$h2_block = "\n--- Selected H2 Sections ---\n";
			foreach ( $h2_sections as $i => $h2 ) {
				$h2_block .= ( $i + 1 ) . '. ' . trim( (string) $h2 ) . "\n";
			}
		}

		$site_block = '';
		if ( ! empty( $site['name'] ) && ! empty( $site['siteUrl'] ) ) {
			$url = rtrim( (string) $site['siteUrl'], '/' );
			$site_block = "\n=== TARGET SITE ===\n{$site['name']} ({$url})\n=== END TARGET SITE ===\n";
		}

		$posts_block = ! empty( $site['name'] ) ? self::wordpress_posts_block( $posts, (string) $site['name'] ) : '';

		$paa_block = '';
		if ( ! empty( $paa ) ) {
			$paa_block = "\n--- People Also Ask (flo-faq append only, NOT body H2s) ---\n";
			foreach ( $paa as $row ) {
				if ( is_array( $row ) && ! empty( $row['question'] ) ) {
					$paa_block .= '- ' . trim( (string) $row['question'] ) . "\n";
				}
			}
		}

		$modifier = $user_prompt !== '' ? "\n--- PROMPT MODIFIER (PRIMARY FOCUS) ---\n{$user_prompt}\n--- END ---\n" : '';
		$article  = Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_article_length_checklist_block( false );
		$per_h2   = (int) floor( Neo_Pulse_App_Agent_Run_Article_Length_Policy::ARTICLE_MAX_WORDS / 6 );
		$h2_sample = ! empty( $h2_sections ) ? (string) $h2_sections[0] : 'Section Topic';

		$system = 'You are an expert blog content strategist and blueprint architect. Create a detailed checklist for generating a blog template blueprint.' . "\n\n"
			. self::keyword_section( $primary, $selected_keywords, $keyword_data ) . "\n\n"
			. "**FORBIDDEN BODY H2 HEADERS**: Never FAQ, Q&A, Frequently Asked Questions as body sections. FAQ is appended later as flo-faq.\n\n"
			. "--- Blog Title ---\n{$title}\n"
			. $site_block . $posts_block . $h2_block . $paa_block . $modifier . "\n"
			. $article . "\n\n"
			. "Harness contract: Each checklist item = exactly one H2 harness pass (~{$per_h2} words). Max 2 [TABLE] in entire article.\n"
			. "Each item must include [STRUCTURE], [EXACT PRIMARY PER H2], [FOCUS KEYWORD DENSITY], [PARAGRAPH LENGTH], and [LINK]: 3-5 [[LINK:query|anchor]].\n"
			. "Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number across the article.\n"
			. "First H2: NEVER title it Introduction or Intro — use SEO-friendly active title.\n"
			. "Conclusion H2 with exact primary keyword once in body.\n\n"
			. self::checklist_format_example( $h2_sample );

		$user = '';
		if ( $bucket_block !== '' ) {
			$user .= $bucket_block . "\n\n";
		}
		$user .= "Generate a focused checklist for creating a blog template blueprint.\n\n"
			. $article . "\n\n"
			. "Blog Details:\n"
			. "- Title: \"{$title}\"\n"
			. '- H2 Sections to cover: ' . ( ! empty( $h2_sections ) ? implode( ', ', $h2_sections ) : '(derive from keyword research)' ) . "\n"
			. "- Primary Keyword: \"{$keyword}\"\n"
			. '- Related Keywords: ' . implode( ', ', array_slice( $selected_keywords, 0, 5 ) ) . "\n\n"
			. "Requirements:\n"
			. "1. Create 5-6 checklist items maximum: introduction-style first H2, 3-4 body topics, conclusion.\n"
			. "2. Each item must include mandatory markers: [STRUCTURE], [EXACT PRIMARY PER H2], [FOCUS KEYWORD DENSITY], [PARAGRAPH LENGTH], [LINK].\n"
			. "3. Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number (max 2 [TABLE] total).\n"
			. "4. First H2: active SEO title (never Introduction/Intro). Conclusion H2 with exact primary keyword.\n"
			. "5. Output ONLY numbered checklist lines. Do NOT use ## markdown headings in items.";
		if ( $user_prompt !== '' ) {
			$user .= "\n\n--- CRITICAL: USER-SPECIFIED REQUIREMENTS ---\n{$user_prompt}";
		}
		$user .= "\n\n--- MANDATORY: INTERNAL LINK REQUIREMENTS ---\n"
			. 'Every H2 section MUST include "[LINK]: 3-5 internal links via [[LINK:query|anchor]] placeholders." '
			. 'Use WordPress posts from the system prompt when suggesting link topics.';

		return array(
			'system' => $system,
			'user'   => $user,
		);
	}

	/**
	 * @param array<string,mixed> $ctx
	 * @return array{system:string,user:string}
	 */
	public static function build_blueprint_messages( array $ctx ): array {
		$title     = trim( (string) ( $ctx['title'] ?? '' ) );
		$keyword   = trim( (string) ( $ctx['keyword'] ?? '' ) );
		$purpose   = trim( (string) ( $ctx['purpose'] ?? Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_focused_article_purpose( $keyword ) ) );
		$checklist = is_array( $ctx['checklist'] ?? null ) ? $ctx['checklist'] : array();
		$user_prompt = trim( (string) ( $ctx['userPrompt'] ?? '' ) );
		$site      = is_array( $ctx['connectedSite'] ?? null ) ? $ctx['connectedSite'] : array();
		$posts     = is_array( $ctx['wordPressPosts'] ?? null ) ? $ctx['wordPressPosts'] : array();

		$site_block = '';
		if ( ! empty( $site['name'] ) && ! empty( $site['siteUrl'] ) ) {
			$url = rtrim( (string) $site['siteUrl'], '/' );
			$site_block = "\n=== TARGET SITE ===\n{$site['name']} ({$url})\n=== END ===\n";
		}
		$posts_block = ! empty( $site['name'] ) ? self::wordpress_posts_block( $posts, (string) $site['name'] ) : '';
		$modifier    = $user_prompt !== '' ? "\n--- PROMPT MODIFIER ---\n{$user_prompt}\n--- END ---\n" : '';

		$checklist_lines = array();
		foreach ( $checklist as $i => $item ) {
			$checklist_lines[] = ( $i + 1 ) . '. ' . trim( (string) $item );
		}

		$link_ph = self::link_feature_placeholder();
		$system  = "You are the Blueprint Architect AI. Return valid JSON only.\n\n"
			. "--- Flow Context ---\nTitle: {$title}\nPurpose: {$purpose}\nPrimary Keyword: {$keyword}\n"
			. $site_block . $posts_block . $modifier . "\n"
			. "--- Template Checklist ---\n" . implode( "\n", $checklist_lines ) . "\n\n"
			. Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_blueprint_article_length_block() . "\n\n"
			. "One agent per checklist item. Do NOT add Overview or FAQ agents.\n"
			. "Rename Introduction/Intro to SEO-friendly H2 titles (never drop intro sections).\n"
			. "Every agent MUST include \"{$link_ph}\" in features.\n"
			. "NEVER use FAQ-style agent titles.\n\n"
			. 'Agent JSON schema: {"title":"","purpose":"","agents":[{"id":"section-1","step":1,"title":"","description":"","features":["[LINK]: [[LINK:query|anchor]] placeholders"],"headingLevel":2}]}';

		$user = "Build a JSON blueprint for \"{$title}\" (keyword: {$keyword}).\n"
			. "Purpose must be: {$purpose}\n"
			. ( $user_prompt !== '' ? "Prompt modifier focus: {$user_prompt}\n" : '' )
			. "Checklist:\n" . implode( "\n", $checklist_lines ) . "\n\n"
			. 'Return JSON with one agent per checklist item. Rename Intro/Introduction titles. Each agent needs [LINK] in features.';

		return array(
			'system' => $system,
			'user'   => $user,
		);
	}

	public static function build_keyword_analysis_system_prompt(): string {
		return 'You are an SEO keyword analyst. Return valid JSON only. Suggest 5-7 H2 section topics (no FAQ titles). Include keyword variations and PAA questions from SERP context.';
	}

	public static function build_keyword_analysis_user_prompt( string $keyword, string $serp_excerpt ): string {
		$serp = substr( wp_strip_all_tags( $serp_excerpt ), 0, 8000 );
		return "Analyze the primary keyword \"{$keyword}\" for blog content planning.\n\n"
			. "SERP excerpt:\n{$serp}\n\n"
			. "Return JSON only:\n"
			. "{\n"
			. "  \"h2Suggestions\": [\"SEO H2 topic 1\", \"...\"],\n"
			. "  \"keywordSuggestions\": { \"primary\": \"...\", \"variations\": [\"...\"], \"longTail\": [\"...\"] },\n"
			. "  \"peopleAlsoAsk\": [{ \"question\": \"...\", \"answer\": \"...\" }],\n"
			. "  \"contentGaps\": [\"...\"]\n"
			. '}';
	}

	public static function gsc_keyword_select_system_prompt(): string {
		return 'You are a blog keyword research agent. Read SITE_KW_JSON first (Semrush then GSC lists). Return only JSON: {"keywords":["..."]}. Prefer informational/transactional intent. Never return the company trading name. Distill long-tail into short-tail intent keywords.';
	}
}

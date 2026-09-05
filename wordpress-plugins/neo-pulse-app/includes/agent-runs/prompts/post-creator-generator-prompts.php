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
		$pages = array();
		$blogs = array();
		foreach ( $posts as $post ) {
			if ( ! is_array( $post ) ) {
				continue;
			}
			$title = str_replace( '"', "'", trim( (string) ( $post['title'] ?? '' ) ) );
			$link  = trim( (string) ( $post['link'] ?? '' ) );
			if ( $title === '' || $link === '' ) {
				continue;
			}
			$bucket      = strtolower( (string) ( $post['collection'] ?? $post['postType'] ?? '' ) );
			$line        = '- "' . $title . '"';
			$path_is_blog = $bucket === '' && str_contains( strtolower( $link ), '/blog/' );
			if ( in_array( $bucket, array( 'posts', 'post' ), true ) || $path_is_blog ) {
				$blogs[] = $line;
			} else {
				$pages[] = $line;
			}
		}
		if ( empty( $pages ) && empty( $blogs ) ) {
			return '';
		}
		$parts = array();
		if ( ! empty( $pages ) ) {
			$parts[] = "PAGES\n" . implode( "\n", $pages );
		}
		if ( ! empty( $blogs ) ) {
			$parts[] = "BLOG POSTS\n" . implode( "\n", $blogs );
		}
		return "\n=== INTERNAL LINK TARGETS (page-sitemap.xml first, then blog posts, never service-area) ===\n"
			. implode( "\n\n", $parts ) . "\n"
			. "Brand, product, service, and commercial terms: [[LINK]] query uses PAGES title words. Informational keywords: [[LINK]] query uses BLOG POSTS title words. Emit [[LINK:query|anchor]] only. Titles from this list only. Do not paste hrefs.\n"
			. "=== END INTERNAL LINK TARGETS ===\n";
	}

	private static function checklist_format_example( string $h2_sample ): string {
		$sample = $h2_sample !== '' ? $h2_sample : 'Core Benefits';
		return "CRITICAL FORMAT REQUIREMENT:\n"
			. "Format your response as a numbered list, one item per line. Do NOT use ## markdown headings in checklist items.\n\n"
			. "Example (NOTE: numbered lines only — no ##):\n"
			. "1. Why Smart Blinds Matter for Modern Homes [STRUCTURE]: 2 short paragraphs. [EXACT PRIMARY PER H2]: exact primary once in body. [FOCUS KEYWORD DENSITY]: ~1%+ across article. [LINK]: 3-5 [[LINK:query|anchor]] placeholders.\n"
			. "2. {$sample} [STRUCTURE]: 2-3 paragraphs. [DECISION]: If you have / choose table. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
			. "3. Installation Steps [LIST]: number step-by-step process. [TRADEOFF]: when this option is not worth it. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
			. "4. Cost Factors [LIST]: bullet cost drivers. [EXACT PRIMARY PER H2]. [LINK]: 3-5 internal links.\n"
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
			. "Put [DECISION] on exactly one item and [TRADEOFF] on exactly one item.\n"
			. "Prefer H2 titles that help the reader choose (how to choose / vs / cost factors / process / when not worth it), not What is X or Benefits of X.\n"
			. "First H2: NEVER title it Introduction or Intro — use SEO-friendly active title.\n"
			. "Conclusion H2 with exact primary keyword once in body.\n"
			. "**AUTHENTICITY CHECKLIST**: Prefer H2 titles that help the reader choose (how to choose / vs / cost factors / process / when not worth it), not What is X or Benefits of X. Still 5-6 items. Put [DECISION] on exactly one item. Put [TRADEOFF] on exactly one item. Prefer a decision-criteria table over a second catalog table. Do not add H2s. Do not pad to the word cap.\n\n"
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
			. "3. Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number (max 2 [TABLE] total). Put [DECISION] on one item and [TRADEOFF] on one item.\n"
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
			. 'Agent JSON schema: {"title":"","purpose":"","agents":[{"id":"section-1","step":1,"title":"","description":"","features":["[LINK]: [[LINK:query|anchor]] placeholders"],"headingLevel":2}]}'
			. "\n\nCRITICAL — agent.title: ONLY the H2 heading phrase (checklist text before the first [STRUCTURE]/[LINK]/[TABLE]/[LIST]/[EXACT]/[DECISION]/[TRADEOFF] marker). Never copy harness tags or paragraph counts into title.\n"
			. "Copy [DECISION] and [TRADEOFF] from checklist items into that agent's features array when present.";

		$user = "Build a JSON blueprint for \"{$title}\" (keyword: {$keyword}).\n"
			. "Purpose must be: {$purpose}\n"
			. ( $user_prompt !== '' ? "Prompt modifier focus: {$user_prompt}\n" : '' )
			. "Checklist:\n" . implode( "\n", $checklist_lines ) . "\n\n"
			. 'Return JSON with one agent per checklist item. Rename Intro/Introduction titles. Each agent needs [LINK] in features. Each agent.title = H2 heading only (text before first [ marker in that checklist line).';

		return array(
			'system' => $system,
			'user'   => $user,
		);
	}

	public static function build_keyword_analysis_system_prompt(): string {
		return 'You are an SEO keyword analyst. Return valid JSON only. Suggest 5-7 H2 section topics (no FAQ titles). Prefer jobs-to-be-done headings (choose / vs / cost / process / when not) over definitional titles. Include keyword variations and PAA questions from SERP context. contentGaps must include buyer-decision gaps.';
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
			. "}\n\n"
			. "h2Suggestions: prefer how to choose / vs / cost factors / process / when not worth it. Avoid definitional What is X or Benefits of X as the whole outline.\n"
			. 'contentGaps: include buyer-decision gaps (which option, when not worth it, cost drivers), not only missing topics.';
	}

	public static function gsc_content_specialist_system_prompt(): string {
		return 'ROLE — SENIOR SEO CONTENT SPECIALIST (mandatory):
You are a senior SEO content specialist preparing a bulk editorial content sheet for a client site.
SITE_INVENTORY_CACHE is the authoritative map of published and scheduled coverage (titles, slugs, URLs). Treat it as ground truth for what the site already owns in search.
Your job: propose only net-new angles that fill real gaps — not rewrites, not near-duplicates, not the same comparison pair or topic cluster with a new subtitle.
Cannibalization is unacceptable. If a GSC line suggests a topic already covered in inventory, pivot to a distinct search intent.
Think in search intent, topic clusters, and editorial variety — not keyword stuffing or title tweaks on existing themes.
Inventory wins over GSC when they conflict.

SITE_INVENTORY — CANNIBALIZATION ONLY (mandatory before every row):
Read the entire SITE_INVENTORY_CACHE JSON (every url, slug, title). Your output must NOT compete with any inventory row in search intent.
Before you write rows[], scan all inventory entries. For each GSC or Semrush line you select:
- If the natural GSC topic already exists in inventory, you MUST pivot: choose a different keyword and title that do not overlap inventory.
- Do not duplicate or lightly rephrase any inventory title.
- Do not reuse or near-duplicate any inventory keyword.
- When inventory covers a topic, pick the next-best gap topic from SITE_KW_JSON for that row.

OUTPUT CONTRACT:
Return valid JSON only: {"rows":[{"keyword":"","title":"","entity":""}]}
Exactly the requested number of rows.
Read SITE_INVENTORY_CACHE completely before selecting any keyword from SITE_KW_JSON.
Each keyword must come from a GSC or Semrush line in SITE_KW_JSON.
Every title must be original. Never copy any inventory title.';
	}

	public static function build_gsc_content_specialist_user_prompt(
		string $site_name,
		int $post_count,
		string $prompt,
		string $bucket_json,
		string $site_kw_json
	): string {
		$user = 'Generate exactly ' . $post_count . ' NEW blog post ideas for ' . $site_name . '.';

		$user .= "\n\nSTEP 1 — READ SITE_INVENTORY_CACHE (mandatory before any ideas):";
		$user .= "\nThis is the cached JSON export of every published post URL, slug, and title on the site.";
		if ( $bucket_json !== '' ) {
			$user .= "\n\n=== SITE_INVENTORY_CACHE ===\n" . substr( trim( $bucket_json ), 0, 50000 ) . "\n=== END SITE_INVENTORY_CACHE ===";
		}

		$user .= "\n\nSTEP 2 — READ SITE_KW_JSON (mandatory):";
		$user .= "\nGSC and Semrush keyword lists sorted by opportunity.";
		if ( $site_kw_json !== '' ) {
			$user .= "\n\n=== SITE_KW_JSON ===\n" . substr( trim( $site_kw_json ), 0, 50000 ) . "\n=== END SITE_KW_JSON ===";
		}

		$user .= "\n\nSTEP 3 — OUTPUT " . $post_count . ' NET-NEW IDEAS:';
		$user .= "\nPick keywords from SITE_KW_JSON whose search intent is NOT already covered in SITE_INVENTORY_CACHE.";
		$user .= "\nWrite original titles. Do not cannibalize any existing post.";

		if ( trim( $prompt ) !== '' ) {
			$user .= "\n\nContent brief (every idea must fit): " . trim( $prompt );
		}

		return $user;
	}

	public static function gsc_keyword_select_system_prompt(): string {
		return 'You are a blog keyword research agent. Read SITE_KW_JSON first (Semrush then GSC lists). When SITE_INVENTORY_JSON is present, read every existing post slug and title before selecting any keyword. Exclude any keyword that would cannibalize those posts — skip lines whose search intent matches an existing title or slug (example: skip "national seo" when inventory has national-seo-canada). Return only JSON: {"keywords":["..."]}. Prefer informational/transactional intent. Never return the company trading name. Distill long-tail into short-tail intent keywords. Return fewer keywords rather than cannibalizing inventory.';
	}

	public static function gsc_ideation_system_prompt(): string {
		return 'You are an SEO blog strategist specializing in content gap analysis from GSC and site inventory. Return valid JSON only.

Rules (non-negotiable):
- Read SITE INVENTORY first: every slug, title, and URL is existing coverage.
- Read SITE_KW_JSON second: gsc and semrush arrays are real search queries sorted by opportunity.
- Each row keyword MUST be derived from a SITE_KW_JSON line whose search intent is NOT already covered in inventory.
- SKIP any GSC/Semrush line that matches an existing topic (example: skip "national seo" when inventory has national-seo-canada or a National SEO Strategy title).
- SKIP lines that overlap blinds, digital marketing, or any topic already published under a different slug or title.
- Distill chosen lines into clean 2-3 word short-tail keywords. Do not return raw GSC lines that cannibalize inventory.
- Every title must be original. Never copy or lightly rephrase an existing inventory title.
- Each row must target a distinct net-new topic. No duplicate intent within the output.';
	}

	public static function build_gsc_ideation_user_prompt(
		string $site_name,
		int $post_count,
		string $prompt,
		string $bucket_json,
		string $site_kw_json
	): string {
		$user = 'Generate exactly ' . $post_count . ' NEW blog post ideas for ' . $site_name . '.';

		if ( $prompt !== '' ) {
			$user .= "\n\nContent topic / brief (every idea must fit): " . $prompt;
		}

		$user .= "\n\nSTEP 1 — READ SITE INVENTORY (mandatory before any ideas):";
		$user .= "\nRead every post slug, title, and URL below. These are existing coverage. Do not target the same search intent as any row.";
		if ( $bucket_json !== '' ) {
			$user .= "\n\nSITE INVENTORY JSON:\n" . substr( $bucket_json, 0, 50000 );
		}

		$user .= "\n\nSTEP 2 — READ SITE_KW_JSON (mandatory):";
		$user .= "\nRead the gsc and semrush arrays. These are real search queries for the site, sorted by opportunity.";
		if ( $site_kw_json !== '' ) {
			$user .= "\n\nSITE_KW_JSON:\n" . substr( $site_kw_json, 0, 50000 );
		}

		$user .= "\n\nSTEP 3 — PICK " . $post_count . ' NET-NEW KEYWORDS FROM SITE_KW_JSON:';
		$user .= "\nFor each idea, select ONE GSC or Semrush line whose intent is NOT already covered in inventory.";
		$user .= "\n- SKIP lines that match existing topics (example: skip \"national seo\" when inventory already has national-seo-canada).";
		$user .= "\n- SKIP lines that overlap any published post title or slug intent.";
		$user .= "\n- Distill each chosen line to a clean 2-3 word short-tail keyword.";
		$user .= "\n- Do NOT reuse raw GSC lines that cannibalize inventory.";

		$user .= "\n\nSTEP 4 — WRITE NEW TITLES:";
		$user .= "\nEvery title must be original. Never copy or lightly rephrase an existing inventory title.";

		$user .= "\n\nReturn JSON: {\"rows\":[{\"keyword\":\"\",\"title\":\"\",\"entity\":\"\"}]}";

		return $user;
	}
}

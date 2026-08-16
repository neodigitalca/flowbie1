<?php
/**
 * Server post creator pipeline (CSV generator parity).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline {

	const MIN_CHECKLIST_ITEMS = 3;
	const MAX_CHECKLIST_ATTEMPTS = 3;
	const HARNESS_ROW_TOKEN_BUDGET = 16000;

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,string>
	 */
	public static function generate_checklist(
		string $title,
		string $keyword,
		array $research,
		array $keywords,
		array $site,
		string $user_prompt,
		string $bucket_read_first_block,
		array $wordpress_posts = array()
	): array {
		$h2_sections = Neo_Pulse_App_Agent_Run_H2_Select::auto_select_h2_sections( $research );
		$selected_keywords = ! empty( $keywords )
			? $keywords
			: Neo_Pulse_App_Agent_Run_H2_Select::auto_select_keywords( $research, $keyword );

		$keyword_data = self::primary_keyword_data( $research, $keyword );
		$paa          = self::paa_questions_from_research( $research );
		$site_ctx     = array(
			'name'    => trim( (string) ( $site['name'] ?? '' ) ),
			'siteUrl' => rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' ),
		);

		$messages = Neo_Pulse_App_Agent_Run_Generator_Prompts::build_checklist_messages(
			array(
				'title'                 => $title,
				'keyword'               => $keyword,
				'keywordData'           => $keyword_data,
				'selectedKeywords'      => $selected_keywords,
				'selectedH2Sections'    => $h2_sections,
				'userPrompt'            => $user_prompt,
				'connectedSite'         => $site_ctx,
				'wordPressPosts'        => $wordpress_posts,
				'paaQuestions'          => $paa,
				'bucketReadFirstBlock'  => $bucket_read_first_block,
			)
		);

		$best     = array();
		$last_raw = '';
		for ( $attempt = 1; $attempt <= self::MAX_CHECKLIST_ATTEMPTS; $attempt++ ) {
			$raw       = Neo_Pulse_App_Chat_Openrouter::text_completion(
				array(
					array( 'role' => 'system', 'content' => $messages['system'] ),
					array( 'role' => 'user', 'content' => $messages['user'] ),
				),
				array( 'temperature' => 1.0, 'maxTokens' => 4096 )
			);
			$last_raw  = $raw;
			$checklist = Neo_Pulse_App_Agent_Run_Checklist_Post_Process::parse_blog_template_checklist( $raw );
			$checklist = array_slice( $checklist, 0, Neo_Pulse_App_Agent_Run_Article_Length_Policy::MAX_CHECKLIST_ITEMS_BLOG );
			if ( count( $checklist ) > count( $best ) ) {
				$best = $checklist;
			}
			if ( count( $checklist ) >= self::MIN_CHECKLIST_ITEMS ) {
				return $checklist;
			}
		}

		if ( ! empty( $best ) ) {
			return $best;
		}
		if ( $last_raw !== '' ) {
			$fallback = Neo_Pulse_App_Agent_Run_Checklist_Post_Process::parse_blog_template_checklist( $last_raw );
			if ( ! empty( $fallback ) ) {
				return array_slice( $fallback, 0, Neo_Pulse_App_Agent_Run_Article_Length_Policy::MAX_CHECKLIST_ITEMS_BLOG );
			}
		}
		throw new Exception( 'Checklist generation failed: fewer than ' . self::MIN_CHECKLIST_ITEMS . ' items.' );
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<string,mixed>
	 */
	public static function generate_blueprint(
		string $title,
		string $keyword,
		array $checklist,
		array $site,
		string $user_prompt,
		array $wordpress_posts = array()
	): array {
		$purpose  = Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_focused_article_purpose( $keyword );
		$site_ctx = array(
			'name'    => trim( (string) ( $site['name'] ?? '' ) ),
			'siteUrl' => rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' ),
		);
		$messages = Neo_Pulse_App_Agent_Run_Generator_Prompts::build_blueprint_messages(
			array(
				'title'          => $title,
				'purpose'        => $purpose,
				'keyword'        => $keyword,
				'checklist'      => $checklist,
				'userPrompt'     => $user_prompt,
				'connectedSite'  => $site_ctx,
				'wordPressPosts' => $wordpress_posts,
			)
		);

		$min_agents = min( count( $checklist ), 3 );
		$last_error = '';
		for ( $attempt = 0; $attempt < 3; $attempt++ ) {
			try {
				$parsed = Neo_Pulse_App_Chat_Openrouter::json_completion(
					array(
						array( 'role' => 'system', 'content' => $messages['system'] ),
						array( 'role' => 'user', 'content' => $messages['user'] ),
					),
					array( 'temperature' => 0.4, 'maxTokens' => 8192 )
				);
				$parsed = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::normalize_blueprint_payload( $parsed );
				if ( empty( $parsed['agents'] ) || ! is_array( $parsed['agents'] ) ) {
					$parsed['agents'] = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::agents_from_checklist(
						$checklist,
						$keyword
					);
				}
				if ( empty( $parsed['agents'] ) || ! is_array( $parsed['agents'] ) ) {
					throw new Exception( 'Blueprint missing agents.' );
				}
				$agents = Neo_Pulse_App_Agent_Run_Blueprint_Post_Process::repair_agents(
					$parsed['agents'],
					$checklist,
					$keyword
				);
				if ( count( $agents ) < $min_agents ) {
					throw new Exception( 'Blueprint returned ' . count( $agents ) . ' agents, need at least ' . $min_agents );
				}
				return array(
					'title'          => $title,
					'purpose'        => $purpose,
					'primaryKeyword' => $keyword,
					'agents'         => $agents,
					'generatedAt'    => gmdate( 'c' ),
				);
			} catch ( Exception $e ) {
				$last_error = $e->getMessage();
			}
		}
		throw new Exception( 'Blueprint generation failed: ' . $last_error );
	}

	/**
	 * @param array<int,array<string,mixed>> $body_agents
	 * @return string
	 */
	public static function generate_body_section(
		array $agent,
		int $section_index,
		int $total_sections,
		string $title,
		string $keyword,
		array $site,
		array $all_titles,
		string $bucket_read_first_block = '',
		int $max_tokens = 2000
	): string {
		$messages = self::build_body_section_messages(
			$agent,
			$section_index,
			$total_sections,
			$title,
			$keyword,
			$all_titles,
			$bucket_read_first_block
		);

		return Neo_Pulse_App_Chat_Openrouter::text_completion(
			$messages,
			array( 'temperature' => 0.5, 'maxTokens' => max( 256, $max_tokens ) )
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $body_agents
	 * @param callable(int,string):void|null $on_section_complete
	 * @return array<int,string>
	 */
	public static function generate_body_sections_parallel(
		array $body_agents,
		string $title,
		string $keyword,
		array $site,
		array $all_titles,
		?callable $on_section_complete = null,
		string $bucket_read_first_block = '',
		array $token_map = array()
	): array {
		$total   = count( $body_agents ) + 1;
		$jobs    = array();
		foreach ( $body_agents as $i => $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$key        = 'body-' . $i;
			$max_tokens = isset( $token_map[ $key ] )
				? (int) $token_map[ $key ]
				: (int) floor( self::HARNESS_ROW_TOKEN_BUDGET / max( 1, $total ) );
			$jobs[ $i ] = array(
				'messages' => self::build_body_section_messages( $agent, $i, $total, $title, $keyword, $all_titles, $bucket_read_first_block ),
				'opts'     => array( 'temperature' => 0.5, 'maxTokens' => max( 256, $max_tokens ) ),
			);
		}

		$results = Neo_Pulse_App_Chat_Openrouter::text_completion_parallel(
			$jobs,
			array(
				'onComplete' => static function ( $i, $result ) use ( $on_section_complete ) {
					if ( $on_section_complete && is_callable( $on_section_complete ) ) {
						$on_section_complete( (int) $i, (string) ( $result['error'] ?? '' ) );
					}
				},
			)
		);

		$parts = array();
		foreach ( array_keys( $jobs ) as $i ) {
			$result = $results[ $i ] ?? array( 'content' => '', 'error' => 'Missing section result' );
			if ( ! empty( $result['error'] ) ) {
				throw new Exception( 'Section ' . ( $i + 1 ) . ' failed: ' . $result['error'] );
			}
			$content = trim( (string) ( $result['content'] ?? '' ) );
			if ( $content === '' ) {
				throw new Exception( 'Section ' . ( $i + 1 ) . ' returned empty content.' );
			}
			$parts[] = $content;
		}
		return $parts;
	}

	/**
	 * @param array<string,mixed> $agent
	 * @return array<int,array{role:string,content:string}>
	 */
	public static function build_body_section_messages(
		array $agent,
		int $section_index,
		int $total_sections,
		string $title,
		string $keyword,
		array $all_titles,
		string $bucket_read_first_block = ''
	): array {
		$agent_title = trim( (string) ( $agent['title'] ?? 'Section' ) );
		$description = trim( (string) ( $agent['description'] ?? '' ) );
		$features    = is_array( $agent['features'] ?? null ) ? $agent['features'] : array();
		$budget      = Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_harness_article_budget_block( $section_index, $total_sections );
		$cap_line    = Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_harness_article_cap_line( $total_sections );

		$user  = '';
		if ( $bucket_read_first_block !== '' ) {
			$user .= $bucket_read_first_block;
		}
		$user .= $budget . "\n" . $cap_line . "\n\n";
		$user .= Neo_Pulse_App_Agent_Run_Exported_Prompts::harness_section_length_rule_markdown() . "\n";
		$user .= Neo_Pulse_App_Agent_Run_Exported_Prompts::harness_section_scope_rule_markdown() . "\n\n";
		$user .= "Write ONLY this section in Markdown.\n";
		$user .= 'Article: "' . $title . '". Primary keyword: "' . $keyword . '".' . "\n";
		$user .= 'Section ' . ( $section_index + 1 ) . ' of ' . $total_sections . ': ## ' . $agent_title . "\n";
		if ( $description !== '' ) {
			$user .= 'Brief: ' . $description . "\n";
		}
		if ( ! empty( $features ) ) {
			$user .= 'Features: ' . implode( '; ', array_map( 'strval', $features ) ) . "\n";
		}
		$user .= "Other H2s in this article (do not duplicate): " . implode( ', ', $all_titles ) . "\n";
		$user .= "**EXACT PRIMARY PER H2**: Include the exact primary keyword \"" . $keyword . "\" at least once in this section body.\n";
		$user .= "Use [[LINK:search phrase|anchor text]] for internal links (3-5 where relevant).\n";
		$user .= "Do NOT write FAQ content. Use markdown ## heading, short paragraphs, tables/lists only where features require.\n";
		$user .= 'Start with ## ' . $agent_title;

		return array(
			array(
				'role'    => 'system',
				'content' => Neo_Pulse_App_Agent_Run_Exported_Prompts::harness_body_system_prompt(),
			),
			array( 'role' => 'user', 'content' => $user ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $body_agents
	 * @return array<int,array{sectionIndex:int,displayTitle:string,anchorId:string}>
	 */
	public static function build_body_anchor_map( array $body_agents ): array {
		$used = array();
		$out  = array();
		foreach ( $body_agents as $i => $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$title = trim( (string) ( $agent['title'] ?? '' ) );
			$base  = sanitize_title( $title );
			if ( $base === '' || $base === 'overview' ) {
				$base = 'section-' . ( (int) $i + 1 );
			}
			$anchor_id = $base;
			$n         = 2;
			while ( isset( $used[ $anchor_id ] ) ) {
				$anchor_id = $base . '-' . $n;
				++$n;
			}
			$used[ $anchor_id ] = true;
			$out[ (int) $i ]    = array(
				'sectionIndex' => (int) $i,
				'displayTitle' => $title,
				'anchorId'     => $anchor_id,
			);
		}
		return $out;
	}

	/**
	 * @param array<int,string> $body_sections_md
	 * @param array<int,string> $body_titles
	 */
	public static function generate_overview_section(
		string $title,
		string $keyword,
		array $body_sections_md,
		array $body_titles,
		array $body_agents = array(),
		int $max_tokens = 1500
	): string {
		$anchor_map = ! empty( $body_agents )
			? self::build_body_anchor_map( $body_agents )
			: array();
		$anchors = array();
		foreach ( $body_titles as $i => $t ) {
			$anchor_id = isset( $anchor_map[ $i ]['anchorId'] )
				? (string) $anchor_map[ $i ]['anchorId']
				: sanitize_title( $t );
			$anchors[] = '- **' . $t . '**: One sentence with exactly ONE [[SCROLL:#' . $anchor_id . '|2-4 word phrase]] in context.';
		}

		$user  = Neo_Pulse_App_Agent_Run_Article_Length_Policy::build_harness_article_budget_block( 0, count( $body_titles ) + 1 ) . "\n\n";
		$user .= "Write the Overview section ONLY (Markdown).\n";
		$user .= 'Article: "' . $title . '". Keyword: "' . $keyword . '".' . "\n";
		$user .= "Output ## Overview, then 1-2 lead paragraphs, then a mandatory bullet list with in-page scroll links.\n";
		$user .= "NON-NEGOTIABLE: exactly " . count( $anchors ) . " bullets, one per body section below, in order. Each bullet: **2-3 word label**: one sentence with exactly ONE [[SCROLL:#anchorId|2-4 word phrase]] woven in.\n";
		$user .= implode( "\n", $anchors ) . "\n";
		$user .= "Use [[SCROLL:#id|phrase]] tokens only (no http URLs). Never say see below or click here. Stop immediately after the bullet list. Do not write body sections.\n\n";
		$title_lines = array();
		foreach ( $body_titles as $i => $t ) {
			$title_lines[] = ( $i + 1 ) . '. ' . $t;
		}
		$user .= "Body section titles for context:\n" . implode( "\n", $title_lines );

		return Neo_Pulse_App_Chat_Openrouter::text_completion(
			array(
				array(
					'role'    => 'system',
					'content' => 'You write a Google AI Overview-style opener in Markdown. Follow harness length rules. No FAQ. Overview must end with a bullet list using [[SCROLL:#id|phrase]] placeholders only.',
				),
				array( 'role' => 'user', 'content' => $user ),
			),
			array( 'temperature' => 0.5, 'maxTokens' => max( 256, $max_tokens ) )
		);
	}

	/**
	 * @param array<int,string> $body_parts
	 */
	public static function stitch_markdown( string $overview_md, array $body_parts ): string {
		$parts = array( trim( $overview_md ) );
		foreach ( $body_parts as $part ) {
			$p = trim( (string) $part );
			if ( $p !== '' ) {
				$parts[] = $p;
			}
		}
		return trim( implode( "\n\n", $parts ) );
	}

	/**
	 * @return array{content:string,seo_json:string,faq_html:string,faq_entries:array<int,array{question:string,answer:string}>,seo:array<string,mixed>}
	 */
	public static function append_faq_and_build_seo(
		string $markdown_or_html,
		string $title,
		string $keyword,
		array $site
	): array {
		$html     = self::markdown_to_html( $markdown_or_html );
		$entries  = self::generate_faq_entries( $html, $title, $keyword, $site );
		$intro    = self::generate_faq_intro( $title, $keyword, $entries );
		$faq_html = self::build_flo_faq_html( $entries, $intro );
		$content  = trim( $html . "\n\n" . $faq_html );

		$seo = array(
			'primary_keyword' => $keyword,
			'title'           => $title,
			'generatedAt'     => gmdate( 'c' ),
			'post_link'       => '',
			'faq_entries'     => $entries,
		);

		return array(
			'content'      => $content,
			'seo_json'     => wp_json_encode( $seo, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ?: '{}',
			'faq_html'     => $faq_html,
			'faq_entries'  => $entries,
			'seo'          => $seo,
		);
	}

	/**
	 * @return array<int,array{question:string,answer:string}>
	 */
	private static function generate_faq_entries( string $html, string $title, string $keyword, array $site ): array {
		$body = wp_strip_all_tags( $html );
		$body = preg_replace( '/\s+/', ' ', (string) $body );
		$body = substr( (string) $body, 0, 12000 );

		$user  = "Create exactly 4 FAQ Q/A pairs for this page.\n\n";
		$user .= "Title: {$title}\nKeyword: {$keyword}\n\n";
		$user .= "Article body:\n{$body}\n\n";
		$user .= "Output format:\nQ: question\nA: answer (2-4 sentences)\n(repeat 4 times)";

		$raw = Neo_Pulse_App_Chat_Openrouter::text_completion(
			array(
				array( 'role' => 'system', 'content' => 'You create SEO FAQ pairs. Output Q: and A: lines only.' ),
				array( 'role' => 'user', 'content' => $user ),
			),
			array( 'temperature' => 0.4, 'maxTokens' => 2048 )
		);

		return self::parse_faq_entries( $raw );
	}

	/**
	 * @param array<int,array{question:string,answer:string}> $entries
	 */
	private static function generate_faq_intro( string $title, string $keyword, array $entries ): string {
		if ( empty( $entries ) ) {
			return 'Common questions about ' . $title . '.';
		}
		$questions = implode( '; ', array_column( $entries, 'question' ) );
		$user      = "Write one short intro paragraph (2-3 sentences) for an FAQ section on \"{$title}\" (keyword: {$keyword}). Questions covered: {$questions}. Plain text only.";

		try {
			$intro = Neo_Pulse_App_Chat_Openrouter::text_completion(
				array(
					array( 'role' => 'system', 'content' => 'You write concise FAQ intro copy.' ),
					array( 'role' => 'user', 'content' => $user ),
				),
				array( 'temperature' => 0.4, 'maxTokens' => 256 )
			);
			$intro = trim( $intro );
			if ( $intro !== '' ) {
				return $intro;
			}
		} catch ( Exception $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
		}
		return 'Answers to common questions about ' . $keyword . '.';
	}

	/**
	 * @param array<int,array{question:string,answer:string}> $entries
	 */
	private static function build_flo_faq_html( array $entries, string $intro ): string {
		if ( empty( $entries ) || trim( $intro ) === '' ) {
			return '';
		}
		$rows = array();
		foreach ( $entries as $entry ) {
			$q = esc_html( trim( (string) ( $entry['question'] ?? '' ) ) );
			$a = esc_html( trim( (string) ( $entry['answer'] ?? '' ) ) );
			if ( $q === '' ) {
				continue;
			}
			$rows[] = '<tr><td style="white-space:normal;">' . $q . '</td><td style="white-space:normal;">' . $a . '</td></tr>';
		}
		if ( empty( $rows ) ) {
			return '';
		}
		$inner  = '<h2 id="faq">FAQ</h2>';
		$inner .= '<p>' . esc_html( trim( $intro ) ) . '</p>';
		$inner .= '<table style="width:100%;"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>';
		$inner .= implode( '', $rows );
		$inner .= '</tbody></table>';
		return '<div class="flo-faq">' . "\n" . $inner . "\n" . '</div>';
	}

	/**
	 * @return array<int,array{question:string,answer:string}>
	 */
	private static function parse_faq_entries( string $raw ): array {
		$lines   = preg_split( '/\r\n|\r|\n/', $raw );
		$entries = array();
		$current_q = '';
		$current_a = '';
		if ( ! is_array( $lines ) ) {
			return $entries;
		}
		foreach ( $lines as $line ) {
			$trimmed = trim( (string) $line );
			if ( preg_match( '/^Q:\s*(.+)$/i', $trimmed, $m ) ) {
				if ( $current_q !== '' && $current_a !== '' ) {
					$entries[] = array( 'question' => $current_q, 'answer' => $current_a );
				}
				$current_q = trim( $m[1] );
				$current_a = '';
				continue;
			}
			if ( preg_match( '/^A:\s*(.+)$/i', $trimmed, $m ) ) {
				$current_a = trim( $m[1] );
				continue;
			}
			if ( $current_a !== '' && $trimmed !== '' ) {
				$current_a .= ' ' . $trimmed;
			}
		}
		if ( $current_q !== '' && $current_a !== '' ) {
			$entries[] = array( 'question' => $current_q, 'answer' => $current_a );
		}
		return array_slice( $entries, 0, 4 );
	}

	public static function markdown_to_html( string $markdown ): string {
		if ( strpos( $markdown, '<div class="flo-faq">' ) !== false || preg_match( '/<h2[\s>]/i', $markdown ) ) {
			return $markdown;
		}
		$html = (string) $markdown;
		$html = preg_replace_callback(
			'/^### (.+)$/m',
			static function ( $m ) {
				return '<h3>' . esc_html( trim( $m[1] ) ) . '</h3>';
			},
			$html
		);
		$html = preg_replace_callback(
			'/^## (.+)$/m',
			static function ( $m ) {
				$title = trim( $m[1] );
				$id    = sanitize_title( $title );
				return '<h2 id="' . esc_attr( $id ) . '">' . esc_html( $title ) . '</h2>';
			},
			$html
		);
		$html = preg_replace( '/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $html );
		$html = preg_replace( '/\[(.+?)\]\((.+?)\)/', '<a href="$2">$1</a>', $html );
		$blocks = preg_split( '/\n\n+/', (string) $html );
		$out    = array();
		foreach ( $blocks as $block ) {
			$b = trim( (string) $block );
			if ( $b === '' ) {
				continue;
			}
			if ( preg_match( '/^<h[23]>/', $b ) ) {
				$out[] = $b;
			} elseif ( preg_match( '/^[\-\*] /m', $b ) ) {
				$items = preg_split( '/\n/', $b );
				$lis   = array();
				foreach ( $items as $item ) {
					$item = preg_replace( '/^[\-\*]\s+/', '', trim( (string) $item ) );
					if ( $item !== '' ) {
						$lis[] = '<li>' . $item . '</li>';
					}
				}
				if ( ! empty( $lis ) ) {
					$out[] = '<ul>' . implode( '', $lis ) . '</ul>';
				}
			} elseif ( strpos( $b, '|' ) !== false && strpos( $b, "\n" ) !== false ) {
				$out[] = self::markdown_table_to_html( $b );
			} else {
				$out[] = '<p>' . $b . '</p>';
			}
		}
		return implode( "\n", $out );
	}

	private static function markdown_table_to_html( string $block ): string {
		$rows = preg_split( '/\n/', trim( $block ) );
		if ( ! is_array( $rows ) || count( $rows ) < 2 ) {
			return '<p>' . esc_html( $block ) . '</p>';
		}
		$html = '<table><thead><tr>';
		$header = array_map( 'trim', explode( '|', trim( (string) $rows[0], '| ' ) ) );
		foreach ( $header as $cell ) {
			if ( $cell !== '' && ! preg_match( '/^:?-+:?$/', $cell ) ) {
				$html .= '<th>' . esc_html( $cell ) . '</th>';
			}
		}
		$html .= '</tr></thead><tbody>';
		for ( $i = 2; $i < count( $rows ); $i++ ) {
			$cells = array_map( 'trim', explode( '|', trim( (string) $rows[ $i ], '| ' ) ) );
			if ( empty( array_filter( $cells ) ) ) {
				continue;
			}
			$html .= '<tr>';
			foreach ( $cells as $cell ) {
				$html .= '<td>' . esc_html( $cell ) . '</td>';
			}
			$html .= '</tr>';
		}
		$html .= '</tbody></table>';
		return $html;
	}

	/**
	 * @param array<int,mixed> $agents
	 * @param array<int,string> $checklist
	 * @return array<int,array<string,mixed>>
	 */
	public static function normalize_blueprint_agents( array $agents, array $checklist, string $keyword = '' ): array {
		$out = array();
		$step = 1;
		foreach ( $agents as $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$title = trim( (string) ( $agent['title'] ?? '' ) );
			if ( $title === '' || self::is_faq_title( $title ) || self::is_overview_title( $title ) ) {
				continue;
			}
			$title = Neo_Pulse_App_Agent_Run_Exported_Prompts::rename_intro_agent_title( $title, $keyword );
			$features = is_array( $agent['features'] ?? null ) ? $agent['features'] : array();
			$has_link = false;
			foreach ( $features as $f ) {
				if ( is_string( $f ) && stripos( $f, '[LINK]' ) !== false ) {
					$has_link = true;
					break;
				}
			}
			if ( ! $has_link ) {
				$features[] = '[LINK]: 3-5 internal link placeholders via [[LINK:phrase|anchor]]';
			}
			$out[] = array(
				'id'           => trim( (string) ( $agent['id'] ?? 'section-' . $step ) ),
				'step'         => $step,
				'title'        => $title,
				'description'  => trim( (string) ( $agent['description'] ?? '' ) ),
				'features'     => $features,
				'headingLevel' => 2,
			);
			$step++;
		}
		if ( empty( $out ) && ! empty( $checklist ) ) {
			foreach ( $checklist as $i => $item ) {
				if ( self::is_faq_title( $item ) || self::is_overview_title( $item ) ) {
					continue;
				}
				$item_title = self::checklist_item_title( $item );
				$out[] = array(
					'id'           => 'section-' . ( $i + 1 ),
					'step'         => $i + 1,
					'title'        => Neo_Pulse_App_Agent_Run_Exported_Prompts::rename_intro_agent_title( $item_title, $keyword ),
					'description'  => $item,
					'features'     => array( '[LINK]: internal links' ),
					'headingLevel' => 2,
				);
			}
		}
		return array_slice( $out, 0, Neo_Pulse_App_Agent_Run_Article_Length_Policy::MAX_CHECKLIST_ITEMS_BLOG );
	}

	/**
	 * @param array<int,array<string,mixed>> $agents
	 * @param array<int,string> $checklist
	 * @return array<int,array<string,mixed>>
	 */
	public static function expand_blueprint_agents_if_needed( array $agents, array $checklist ): array {
		$min_agents = min( count( $checklist ), 4 );
		if ( count( $agents ) >= $min_agents || empty( $agents ) ) {
			return $agents;
		}

		$expanded = array();
		foreach ( $agents as $agent ) {
			$feats = is_array( $agent['features'] ?? null ) ? $agent['features'] : array();
			$feats_per = 3;
			if ( count( $feats ) > $feats_per && count( $expanded ) + (int) ceil( count( $feats ) / $feats_per ) <= 10 ) {
				for ( $i = 0; $i < count( $feats ); $i += $feats_per ) {
					$chunk    = array_slice( $feats, $i, $feats_per );
					$has_link = false;
					foreach ( $chunk as $f ) {
						if ( is_string( $f ) && stripos( $f, '[LINK]' ) !== false ) {
							$has_link = true;
							break;
						}
					}
					if ( ! $has_link ) {
						$chunk[] = '[LINK]: 3-5 internal link placeholders via [[LINK:phrase|anchor]]';
					}
					$idx           = count( $expanded ) + 1;
					$checklist_idx = count( $expanded );
					$checklist_title = isset( $checklist[ $checklist_idx ] )
						? self::checklist_item_title( $checklist[ $checklist_idx ] )
						: 'Section ' . $idx;
					$expanded[] = array_merge(
						$agent,
						array(
							'id'          => 'agent-' . $idx,
							'step'        => $idx,
							'title'       => count( $expanded ) === 0 ? (string) ( $agent['title'] ?? $checklist_title ) : $checklist_title,
							'features'    => $chunk,
							'description' => implode( '; ', array_filter( $chunk, static function ( $f ) {
								return is_string( $f ) && stripos( $f, '[LINK]' ) === false;
							} ) ),
						)
					);
				}
			} else {
				$expanded[] = $agent;
			}
		}

		if ( count( $expanded ) > count( $agents ) ) {
			foreach ( $expanded as $i => &$a ) {
				$a['step'] = $i + 1;
				$a['id']   = 'agent-' . ( $i + 1 );
			}
			unset( $a );
			$agents = $expanded;
		}

		if ( count( $agents ) < $min_agents && ! empty( $checklist ) ) {
			$used_titles = array_map(
				static function ( $a ) {
					return strtolower( trim( (string) ( $a['title'] ?? '' ) ) );
				},
				$agents
			);
			foreach ( $checklist as $item ) {
				if ( count( $agents ) >= $min_agents ) {
					break;
				}
				if ( self::is_faq_title( $item ) || self::is_overview_title( $item ) ) {
					continue;
				}
				$item_title = strtolower( self::checklist_item_title( $item ) );
				if ( in_array( $item_title, $used_titles, true ) ) {
					continue;
				}
				$step      = count( $agents ) + 1;
				$agents[]  = array(
					'id'           => 'section-' . $step,
					'step'         => $step,
					'title'        => self::checklist_item_title( $item ),
					'description'  => $item,
					'features'     => array( '[LINK]: internal links' ),
					'headingLevel' => 2,
				);
				$used_titles[] = $item_title;
			}
		}

		return array_slice( $agents, 0, Neo_Pulse_App_Agent_Run_Article_Length_Policy::MAX_CHECKLIST_ITEMS_BLOG );
	}

	private static function checklist_item_title( string $item ): string {
		$title = preg_replace( '/\[[^\]]+\]/', '', $item );
		$title = preg_replace( '/^\d+\.\s*/', '', (string) $title );
		$title = trim( (string) $title );
		if ( $title === '' ) {
			return 'Section';
		}
		return strlen( $title ) > 60 ? substr( $title, 0, 57 ) . '...' : $title;
	}

	/**
	 * @param array<int,array<string,mixed>> $agents
	 * @return array<int,array<string,mixed>>
	 */
	public static function filter_body_agents( array $agents ): array {
		$out = array();
		foreach ( $agents as $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$title = trim( (string) ( $agent['title'] ?? '' ) );
			if ( self::is_faq_title( $title ) || self::is_overview_title( $title ) ) {
				continue;
			}
			$out[] = $agent;
		}
		usort(
			$out,
			static function ( $a, $b ) {
				return (int) ( $a['step'] ?? 0 ) <=> (int) ( $b['step'] ?? 0 );
			}
		);
		return $out;
	}

	public static function is_faq_title( string $title ): bool {
		$lower = strtolower( trim( $title ) );
		if ( $lower === '' ) {
			return false;
		}
		if ( strpos( $lower, 'faq' ) !== false ) {
			return true;
		}
		if ( strpos( $lower, 'frequently asked' ) !== false ) {
			return true;
		}
		if ( strpos( $lower, 'common questions' ) !== false ) {
			return true;
		}
		if ( preg_match( '/\bq\s*&\s*a\b/', $lower ) ) {
			return true;
		}
		return false;
	}

	public static function is_overview_title( string $title ): bool {
		$lower = strtolower( trim( $title ) );
		return in_array( $lower, array( 'overview', 'summary', 'ai overview' ), true );
	}

	/** @deprecated Use is_faq_title() or is_overview_title() */
	public static function is_overview_or_faq_title( string $title ): bool {
		return self::is_overview_title( $title ) || self::is_faq_title( $title );
	}

	/**
	 * @return array<int,string>
	 */
	public static function parse_checklist( string $raw ): array {
		$lines     = preg_split( '/\r\n|\r|\n/', $raw );
		$checklist = array();
		if ( ! is_array( $lines ) ) {
			return $checklist;
		}
		foreach ( $lines as $line ) {
			$trimmed = trim( (string) $line );
			if ( $trimmed === '' ) {
				continue;
			}
			if ( preg_match( '/^(?:\d+\.|\-|\*)\s+(.+)$/', $trimmed, $matches ) ) {
				$checklist[] = trim( $matches[1] );
			}
		}
		return $checklist;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,string>
	 */
	public static function strip_faq_checklist_items( array $checklist ): array {
		$out = array();
		foreach ( $checklist as $item ) {
			if ( self::is_faq_title( $item ) || self::is_overview_title( $item ) ) {
				continue;
			}
			$out[] = $item;
		}
		return $out;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,string>
	 */
	public static function enforce_mandatory_markers( array $checklist ): array {
		if ( empty( $checklist ) ) {
			return array(
				'Introduction with primary keyword context [EXACT PRIMARY PER H2]',
				'Core benefits [LIST]: bullet key points',
				'Comparison [TABLE]: compact feature table',
				'Step guide [LIST]: number ordered steps',
				'Conclusion and next steps [LINK]: internal CTA',
			);
		}
		$joined = strtolower( implode( "\n", $checklist ) );
		$out    = $checklist;
		if ( strpos( $joined, '[table]' ) === false ) {
			$idx = min( 2, count( $out ) - 1 );
			$out[ $idx ] .= ' [TABLE]: compact comparison table.';
		}
		if ( strpos( $joined, '[list]: bullet' ) === false && strpos( $joined, '[list]:bullet' ) === false ) {
			$idx = min( 1, count( $out ) - 1 );
			$out[ $idx ] .= ' [LIST]: bullet summary of benefits.';
		}
		if ( strpos( $joined, '[list]: number' ) === false && strpos( $joined, '[list]:number' ) === false ) {
			$idx = min( 3, count( $out ) - 1 );
			$out[ $idx ] .= ' [LIST]: number step-by-step process.';
		}
		return $out;
	}

	/**
	 * @param array<int,string> $lines
	 */
	public static function format_checklist_artifact( string $title, array $lines ): array {
		$numbered = Neo_Pulse_App_Agent_Run_Checklist_Post_Process::format_checklist_numbered_lines( $lines );
		return array(
			'title'                => $title,
			'lines'                => $numbered,
			'checklist'            => $numbered,
			'forbiddenWordsPolicy' => '',
			'generatedAt'          => gmdate( 'c' ),
		);
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<string,mixed>
	 */
	private static function primary_keyword_data( array $research, string $keyword ): array {
		$rows = is_array( $research['keywordData'] ?? null ) ? $research['keywordData'] : array();
		if ( ! empty( $rows ) && is_array( $rows[0] ?? null ) ) {
			$row = $rows[0];
			return array(
				'keyword'       => trim( (string) ( $row['keyword'] ?? $keyword ) ),
				'searchVolume'  => (int) ( $row['searchVolume'] ?? $row['volume'] ?? 0 ),
				'difficulty'    => (int) ( $row['difficulty'] ?? 0 ),
				'intent'        => (string) ( $row['intent'] ?? '' ),
			);
		}
		return array( 'keyword' => $keyword );
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,array{question:string}>
	 */
	private static function paa_questions_from_research( array $research ): array {
		$analysis = is_array( $research['aiAnalysis'] ?? null ) ? $research['aiAnalysis'] : array();
		$paa      = is_array( $analysis['peopleAlsoAsk'] ?? null ) ? $analysis['peopleAlsoAsk'] : array();
		$out      = array();
		foreach ( $paa as $row ) {
			if ( is_array( $row ) && ! empty( $row['question'] ) ) {
				$out[] = array( 'question' => trim( (string) $row['question'] ) );
			}
		}
		return $out;
	}
}

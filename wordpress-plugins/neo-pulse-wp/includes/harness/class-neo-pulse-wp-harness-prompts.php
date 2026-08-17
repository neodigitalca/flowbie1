<?php
/**
 * Harness + blueprint prompt strings (ported from NEO Pulse app prompt-builders).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Harness_Prompts {

	const HTML_FORMAT_HARNESS = 'Write in HTML ONLY for this section: <h2>, <h3>, <p>, <a>, <ul><li>, <ol><li>, <table>. NEVER <footer>. NEVER markdown.';

	const HARNESS_SCOPE_HTML = '**HARNESS – SINGLE SECTION ONLY**:
- Output exactly ONE section: the block under "Section to write". Start with this section\'s required opening heading.
- Do not write a full article, article intro for the whole piece, or closing for the whole piece—only this section.
- The full outline is for alignment; other H2s will be written in separate steps. Do not include their headings or duplicate their topics as full sections.
- **Never** use <footer> or </footer> in this section. No exceptions.';

	const HARNESS_LENGTH_HTML = '**HARNESS LENGTH (mandatory)**:
- Body prose in this section: at most **3** <p> tags (lists, tables, and FAQ markup are extra but keep answers short).
- Each <p>: at most **4** sentences. Moderately short paragraphs only.
- Forbidden: full-article intros ("this guide will explore…"), repeating other outline H2 topics, or restating content that belongs in other sections.';

	/**
	 * @param array<string,mixed> $agent
	 */
	public static function single_section_prompt( array $agent, string $format = 'html' ): string {
		$features = isset( $agent['features'] ) && is_array( $agent['features'] ) ? $agent['features'] : array();
		$has_faq  = self::agent_has_faq_feature( $features );

		if ( $has_faq ) {
			return '<h2>Frequently Asked Questions</h2>
*** FAQ TABLE = HTML ONLY. SAME AS EVERY OTHER TABLE. ***
1. <h2>Frequently Asked Questions</h2>
2. <p>2-3 sentences overview.</p>
3. HTML table ONLY: <table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody><tr><td>What is X?</td><td>Answer text.</td></tr></tbody></table>
FORBIDDEN: markdown pipe tables.';
		}

		$title       = isset( $agent['title'] ) ? (string) $agent['title'] : 'Section';
		$description = isset( $agent['description'] ) ? (string) $agent['description'] : '';
		$step        = isset( $agent['step'] ) ? (int) $agent['step'] : 1;
		$feature_txt = array();
		foreach ( $features as $f ) {
			if ( is_string( $f ) && trim( $f ) !== '' ) {
				$feature_txt[] = trim( $f );
			}
		}
		$feature_line = $feature_txt ? implode( ', ', $feature_txt ) : '';
		$h_tag        = 'h2';
		$level        = isset( $agent['headingLevel'] ) ? (int) $agent['headingLevel'] : 1;
		if ( $level >= 2 ) {
			$h_tag = 'h3';
		}

		$first_note = ( 1 === $step )
			? "\n**CRITICAL FIRST SECTION**: Write exactly 3 short paragraphs (2-3 sentences each). First paragraph MUST directly address the primary keyword in its FIRST sentence. H2 MUST be SEO-friendly - NEVER 'Introduction' or 'Intro'."
			: '';

		return sprintf(
			'<%1$s>%2$s</%1$s>[Write content in HTML. Based on: %3$s%4$s%5$s Use <%1$s>, <%6$s>, <p>, <ul><li>, <ol><li>, <a>, <table>. NEVER <footer>.]',
			$h_tag,
			$title,
			$description,
			$feature_line ? "\nKey points: {$feature_line}" : '',
			$first_note,
			'h3' === $h_tag ? 'h3' : 'h2'
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $features
	 */
	public static function agent_has_faq_feature( array $features ): bool {
		foreach ( $features as $f ) {
			if ( ! is_string( $f ) ) {
				continue;
			}
			$lower = strtolower( trim( $f ) );
			if ( strpos( $lower, '[faq]' ) !== false || strpos( $lower, 'faq' ) !== false ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<int,array<string,mixed>> $outline
	 */
	public static function format_outline_for_prompt( array $outline ): string {
		$lines = array();
		foreach ( $outline as $i => $o ) {
			$title  = isset( $o['displayTitle'] ) ? (string) $o['displayTitle'] : '';
			$intent = isset( $o['description'] ) ? trim( (string) $o['description'] ) : '';
			if ( strlen( $intent ) > 220 ) {
				$intent = substr( $intent, 0, 220 ) . '…';
			}
			$lines[] = ( $i + 1 ) . '. ' . $title . ( $intent ? " — {$intent}" : '' );
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<string,mixed> $env
	 */
	public static function harness_section_user_prompt( array $env ): string {
		$flow_title   = isset( $env['flowTitle'] ) ? (string) $env['flowTitle'] : '';
		$flow_purpose = isset( $env['flowPurpose'] ) ? (string) $env['flowPurpose'] : '';
		$single       = isset( $env['singleSectionPrompt'] ) ? (string) $env['singleSectionPrompt'] : '';
		$outline      = isset( $env['outlineBlock'] ) ? (string) $env['outlineBlock'] : '';
		$others       = isset( $env['otherSectionTitles'] ) && is_array( $env['otherSectionTitles'] ) ? $env['otherSectionTitles'] : array();
		$idx          = isset( $env['sectionIndex'] ) ? (int) $env['sectionIndex'] : 0;
		$total        = isset( $env['totalSections'] ) ? (int) $env['totalSections'] : 1;
		$acf_block    = isset( $env['acfBlock'] ) ? (string) $env['acfBlock'] : '';
		$gsc_block    = isset( $env['gscBlock'] ) ? (string) $env['gscBlock'] : '';
		if ( ! empty( $env['forbidAllLinks'] ) ) {
			$posts_note = 'CRITICAL: Do not include any <a> tags or internal/external URLs in this section. Use plain text only.';
		} elseif ( ! empty( $env['hasWordPressPosts'] ) ) {
			$posts_note = 'Use internal links ONLY from the WORDPRESS POSTS list above (exact URLs). Do not invent or guess URLs. Distribute reasonably within THIS section only.';
		} else {
			$posts_note = 'CRITICAL: Do NOT add internal links—no linkable URLs from API—for this section unless the system prompt lists URLs.';
		}

		$sibling = count( $others ) > 0
			? "Other H2s in this article outline (titles only; do not duplicate these as additional top-level H2s or repeat them as full sections):\n" . implode( "\n", array_map(
				static function ( $t ) {
					return '- ' . $t;
				},
				$others
			) )
			: 'No sibling headings besides yours—still write only this section.';

		return implode(
			"\n",
			array_filter(
				array(
					self::HARNESS_SCOPE_HTML,
					self::HARNESS_LENGTH_HTML,
					self::HTML_FORMAT_HARNESS,
					"Article title: {$flow_title}",
					"Purpose: {$flow_purpose}",
					'Section ' . ( $idx + 1 ) . ' of ' . $total . ' (harness pass).',
					$acf_block,
					$gsc_block,
					'=== FULL ARTICLE OUTLINE (for context; write ONLY the current section) ===',
					$outline,
					'=== END OUTLINE ===',
					$sibling,
					'=== SECTION TO WRITE (follow heading and structure exactly) ===',
					$single,
					'=== END SECTION ===',
					'--- Output ---',
					$posts_note,
					'If this section includes a table, FAQ, list, or steps, follow the section block. ALL tables = HTML <table> only. Never wrap any part of this section in <footer>.',
					'Do not include an H1 or \'Article Title:\' line. Start with this section\'s required opening heading.',
					'Never append copyright lines, ©, Copyright + year, All rights reserved, or invented brand/site names.',
				)
			)
		);
	}

	/**
	 * @param array<string,mixed> $ctx
	 */
	public static function harness_system_prompt( array $ctx ): string {
		$site_name = isset( $ctx['siteName'] ) ? (string) $ctx['siteName'] : '';
		$site_url  = isset( $ctx['siteUrl'] ) ? rtrim( (string) $ctx['siteUrl'], '/' ) : '';
		$keyword   = isset( $ctx['primaryKeyword'] ) ? trim( (string) $ctx['primaryKeyword'] ) : '';
		$posts     = isset( $ctx['postsBlock'] ) ? (string) $ctx['postsBlock'] : '';
		$pk_rule   = $keyword
			? "\n**EXACT PRIMARY PER H2 (MANDATORY)**: Under every <h2>, the section body must contain the exact primary keyword phrase at least once (\"{$keyword}\")."
			: '';

		$site_block = ( $site_name && $site_url )
			? "\n=== TARGET SITE ===\n{$site_name} ({$site_url})\nInternal links must use {$site_url} only.\n=== END TARGET SITE ===\n"
			: '';

		return "You are an expert SEO content AI for WordPress HTML harness sections.\n"
			. self::HTML_FORMAT_HARNESS . "\n"
			. "Content focus: Optimize for the page topic and primary keyword.{$pk_rule}\n"
			. "**FIRST PARAGRAPH RULE**: The first <p> under the section H2 must directly address the primary keyword in its opening sentence when this is the introduction section.\n"
			. $site_block
			. $posts
			. "\nNever invent testimonials, review quotes, or fake attributions.";
	}

	/**
	 * Checklist generation user prompt.
	 *
	 * @param array<string,mixed> $ctx
	 */
	public static function checklist_user_prompt( array $ctx ): string {
		$keyword = isset( $ctx['primaryKeyword'] ) ? (string) $ctx['primaryKeyword'] : '';
		$title   = isset( $ctx['title'] ) ? (string) $ctx['title'] : '';
		$brief   = isset( $ctx['seoResearch'] ) ? substr( (string) $ctx['seoResearch'], 0, 24000 ) : '';
		$posts   = isset( $ctx['postsBlock'] ) ? (string) $ctx['postsBlock'] : '';

		return "Create an SEO blog checklist (numbered lines only, one item per line) for optimizing this page.\n\n"
			. "Primary keyword: {$keyword}\n"
			. "Page title: {$title}\n\n"
			. "SEO research brief (parse for intent; do not paste verbatim):\n{$brief}\n\n"
			. $posts
			. "\nInclude: intro H2 (not labeled Introduction), 3-5 body H2s, FAQ section with [faq], conclusion H2.\n"
			. "Each line must include [EXACT PRIMARY PER H2] requirement and structure hints ([TABLE], [LIST], [LINK]).\n"
			. "Return ONLY numbered checklist lines, no JSON.";
	}

	public static function checklist_system_prompt(): string {
		return 'You are an SEO content strategist. Output a numbered checklist only.';
	}

	/**
	 * Blueprint JSON user prompt.
	 *
	 * @param array<int,string>           $checklist
	 * @param array<string,mixed> $ctx
	 */
	public static function blueprint_user_prompt( array $checklist, array $ctx ): string {
		$lines = array();
		foreach ( $checklist as $i => $line ) {
			$lines[] = ( $i + 1 ) . '. ' . $line;
		}
		$keyword = isset( $ctx['primaryKeyword'] ) ? (string) $ctx['primaryKeyword'] : '';
		$title   = isset( $ctx['flowTitle'] ) ? (string) $ctx['flowTitle'] : '';
		$brief   = isset( $ctx['seoResearch'] ) ? substr( (string) $ctx['seoResearch'], 0, 12000 ) : '';
		$posts   = isset( $ctx['postsBlock'] ) ? (string) $ctx['postsBlock'] : '';

		return "Convert this checklist into a JSON blueprint for harness section generation.\n\n"
			. "Checklist:\n" . implode( "\n", $lines ) . "\n\n"
			. "Primary keyword: {$keyword}\nArticle title hint: {$title}\n\n"
			. "Brief excerpt:\n{$brief}\n\n"
			. $posts
			. "\nReturn ONLY valid JSON:\n"
			. '{"title":"...","purpose":"...","agents":[{"step":1,"title":"H2 title","description":"intent","headingLevel":1,"features":["[LIST]"]}]}'
			. "\nOne agent per main H2. FAQ agent must include feature [faq]. No markdown fences.";
	}

	public static function blueprint_system_prompt(): string {
		return 'You convert SEO checklists into JSON blueprints. Return JSON only.';
	}

	/**
	 * @param array<int,array<string,mixed>> $posts
	 */
	public static function wordpress_posts_block( array $posts, string $site_name ): string {
		if ( empty( $posts ) ) {
			return '';
		}
		$lines = array();
		foreach ( array_slice( $posts, 0, 30 ) as $i => $post ) {
			$title = isset( $post['title'] ) ? (string) $post['title'] : '';
			$link  = isset( $post['link'] ) ? (string) $post['link'] : '';
			$lines[] = ( $i + 1 ) . '. "' . $title . "\"\n   URL: {$link}";
		}
		return "\n=== WORDPRESS POSTS (internal links - exact URLs only) ===\n"
			. "Site: {$site_name}\n"
			. implode( "\n\n", $lines )
			. "\n=== END WORDPRESS POSTS ===\n";
	}

	public static function length_compliance_system(): string {
		return 'You are a harness section editor for WordPress HTML. Return JSON only.
Contract: one top-level <h2>, at most 3 <p>, at most 4 sentences per <p>, no <footer>, no markdown.
Return {"compliant":boolean,"section_html":"..."}';
	}

	/**
	 * @param array<int,string> $siblings
	 */
	public static function length_compliance_user( string $html, string $section_title, array $siblings, string $article_title ): string {
		$sib = $siblings ? implode( "\n", array_map(
			static function ( $t ) {
				return '- ' . $t;
			},
			$siblings
		) ) : '(none)';
		return "Article title: {$article_title}\nCurrent section: {$section_title}\nSibling H2s:\n{$sib}\n\nDraft HTML:\n{$html}\n\nReturn JSON.";
	}
}

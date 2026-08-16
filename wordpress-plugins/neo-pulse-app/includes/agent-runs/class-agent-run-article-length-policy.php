<?php
/**
 * Prompt-only article length policy (parity with article-length-policy.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Article_Length_Policy {

	const ARTICLE_MAX_WORDS          = 2000;
	const MAX_CHECKLIST_ITEMS_BLOG   = 6;
	const MAX_CHECKLIST_ITEMS_SAP    = 7;
	const OVERVIEW_AGENT_ID          = 'ai-overview-summary';
	const OVERVIEW_AGENT_TITLE       = 'Overview';

	public static function per_section_word_budget( int $total_sections, int $article_max = self::ARTICLE_MAX_WORDS ): int {
		$n = max( 1, (int) floor( $total_sections ) );
		return (int) floor( $article_max / $n );
	}

	public static function build_article_length_checklist_block( bool $is_service_area = false ): string {
		$max_items  = $is_service_area ? self::MAX_CHECKLIST_ITEMS_SAP : self::MAX_CHECKLIST_ITEMS_BLOG;
		$mode_label = $is_service_area ? 'service area (SAP)' : 'blog';
		$cap        = self::ARTICLE_MAX_WORDS;
		$item_range = $is_service_area ? '6-7' : '5-6';

		return "--- ARTICLE LENGTH (NON-NEGOTIABLE) ---\n"
			. "**[ARTICLE LENGTH]**: Entire published article MUST NOT exceed {$cap} words.\n"
			. "- Create **{$item_range}** checklist items maximum for this {$mode_label} (hard cap **{$max_items}** items including intro and conclusion).\n"
			. "- **DEPTH IN FEWER H2s**: Cover topics in fewer, tighter sections. One H2 per major topic. **MAX 2 H3s** per H2. **1-2 paragraphs** per H2.\n"
			. "- **TABLE BUDGET**: Entire article gets **at most 2** [TABLE] sections.\n"
			. "- **NO DUPLICATE TOPICS**: Never create two H2s for the same topic.\n"
			. "- Meet exact-primary-per-H2 and link requirements with **concise copy**, not extra sections.\n"
			. '--- END ARTICLE LENGTH ---';
	}

	public static function build_focused_article_purpose( string $keyword ): string {
		$topic = trim( $keyword ) !== '' ? trim( $keyword ) : 'this topic';
		return 'Focused guide (max ' . self::ARTICLE_MAX_WORDS . ' words) about ' . $topic;
	}

	public static function build_blueprint_article_length_block(): string {
		$cap = self::ARTICLE_MAX_WORDS;
		return "--- ARTICLE LENGTH (BLUEPRINT) ---\n"
			. "- Total article cap: **{$cap} words**. Blueprint structure must fit this budget.\n"
			. "- Create **one agent per checklist item**; never exceed the checklist item count.\n"
			. "- Purpose field: frame as a **focused guide (max {$cap} words)** only. Never use comprehensive or exhaustive wording.\n"
			. "- Each agent.title becomes the exact H2 text. One agent = one H2 = one harness call.\n"
			. "- Per-agent prose: short sections (~800-1000 tokens max).\n"
			. "- Do NOT add Overview or FAQ agents; those are handled outside the blueprint.\n"
			. '--- END ARTICLE LENGTH ---';
	}

	public static function build_harness_article_budget_block( int $section_index, int $total_sections ): string {
		$total = max( 1, (int) floor( $total_sections ) );
		$base  = self::per_section_word_budget( $total );
		$is_first = $section_index === 0;
		$is_last  = $section_index === ( $total - 1 );
		$target   = ( $is_first || $is_last ) ? max( 180, (int) floor( $base * 0.85 ) ) : $base;
		$cap      = self::ARTICLE_MAX_WORDS;

		return "**ARTICLE WORD BUDGET**: Full article cap is **{$cap} words** ({$total} section(s)). Target **~{$target} words** for this section. Stay within budget.";
	}

	public static function build_harness_article_cap_line( int $total_sections ): string {
		$total       = max( 1, (int) floor( $total_sections ) );
		$per_section = self::per_section_word_budget( $total );
		return '**FULL ARTICLE CAP**: ' . self::ARTICLE_MAX_WORDS . " words across {$total} section(s) (~{$per_section} words per section on average). Write concisely.";
	}
}

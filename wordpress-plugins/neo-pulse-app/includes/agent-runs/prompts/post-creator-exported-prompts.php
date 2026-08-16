<?php
/**
 * Generator-aligned prompt fragments (exported from TypeScript).
 * DO NOT EDIT BY HAND — run: node scripts/export-post-creator-generator-php.mjs
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Exported_Prompts {

	public static function harness_section_length_rule_markdown(): string {
		return <<<'PROMPT'
**HARNESS LENGTH (mandatory)**:
- Body prose in this section: at most **2** paragraphs after the ## line (use **3** only when this block explicitly requires list/table-heavy content).
- Each paragraph: at most **3** sentences.
- Forbidden: wire-style repetition of other blocks, full-release previews, or restating the whole thesis.
PROMPT;
	}

	public static function harness_section_scope_rule_markdown(): string {
		return <<<'PROMPT'
**HARNESS – SINGLE SECTION ONLY**:
- Output exactly ONE section: the block under "Section to write". Start with that section\'s required ## heading as specified. Do NOT add any other top-level ## sections from the plan in this response.
- Do not write a full article, article intro for the whole piece, or closing for the whole piece—only this section.
- Other sections in the plan are written in separate steps. Do not include their headings or duplicate their topics as full sections.
PROMPT;
	}

	public static function harness_body_system_prompt(): string {
		return 'You write SEO blog sections in Markdown for a harnessed generator. Follow section word budget and harness length rules. No FAQ sections. Output exactly one ## section.';
	}

	public static function rename_intro_agent_title( string $title, string $keyword ): string {
		$lower = strtolower( trim( $title ) );
		if ( ! in_array( $lower, array( 'introduction', 'intro' ), true ) ) {
			return trim( $title );
		}
		$topic = trim( $keyword ) !== '' ? trim( $keyword ) : 'This Topic';
		return 'Why ' . $topic . ' Matters';
	}
}

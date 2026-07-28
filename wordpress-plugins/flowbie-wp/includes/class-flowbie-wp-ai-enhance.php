<?php
/**
 * AI wand preview generation.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Enhance {

	/**
	 * @param array<string,string> $overrides
	 * @return array{ok:bool,field:string,value:string}|WP_Error
	 */
	public static function preview( int $post_id, string $field, array $overrides = array() ) {
		if ( ! Flowbie_Wp_Ai_Fields::is_allowed( $field ) ) {
			return new WP_Error( 'flowbie_field', __( 'Invalid field.', 'flowbie-wp' ) );
		}
		if ( ! Flowbie_Wp_Ai_Gate::can_preview( $post_id ) ) {
			$status = Flowbie_Wp_Ai_Gate::get_status( $post_id );
			$msg    = ! empty( $status['reasons'][0] ) ? (string) $status['reasons'][0] : __( 'Flowbie AI is unavailable.', 'flowbie-wp' );
			return new WP_Error( 'flowbie_ai_gate', $msg );
		}

		if ( Flowbie_Wp_Ai_Fields::is_meta_ai_field( $field ) ) {
			$value = Flowbie_Wp_Ai_Meta::preview_meta_field( $post_id, $field );
		} else {
			$value = self::preview_dedicated_field( $post_id, $field, $overrides );
		}

		if ( is_wp_error( $value ) ) {
			return $value;
		}

		$value = self::normalize_preview_value( $post_id, $field, (string) $value );

		return array(
			'ok'    => true,
			'field' => $field,
			'value' => (string) $value,
		);
	}

	/**
	 * FAQ wand steps: seed (all pairs), question, answer.
	 *
	 * @param array<string,mixed>  $payload
	 * @param array<string,string> $overrides
	 * @return array{ok:bool,field:string,value:string}|WP_Error
	 */
	public static function preview_faq_step( int $post_id, string $step, array $overrides = array(), array $payload = array() ) {
		if ( ! Flowbie_Wp_Ai_Gate::can_preview( $post_id ) ) {
			$status = Flowbie_Wp_Ai_Gate::get_status( $post_id );
			$msg    = ! empty( $status['reasons'][0] ) ? (string) $status['reasons'][0] : __( 'Flowbie AI is unavailable.', 'flowbie-wp' );
			return new WP_Error( 'flowbie_ai_gate', $msg );
		}

		$context = self::merge_context( $post_id, $overrides );
		$brief   = isset( $context['seoResearch'] ) ? trim( (string) $context['seoResearch'] ) : '';
		if ( $brief === '' ) {
			return new WP_Error(
				'flowbie_faq_no_research',
				__( 'Run SEO research first or paste a research brief before generating FAQs.', 'flowbie-wp' )
			);
		}

		$url = $context['url'] !== '' ? $context['url'] : home_url( '/' );
		switch ( $step ) {
			case 'seed':
				$pair_count = isset( $payload['pairCount'] ) ? max( 1, min( 8, (int) $payload['pairCount'] ) ) : 4;
				$prompts    = self::build_faq_seed_prompts( $url, $context, $pair_count );
				break;
			case 'question':
				$prompts = self::build_faq_question_prompts(
					$url,
					$context,
					isset( $payload['faqQuestion'] ) ? (string) $payload['faqQuestion'] : '',
					isset( $payload['faqBlock'] ) ? (string) $payload['faqBlock'] : ''
				);
				break;
			case 'answer':
				$prompts = self::build_faq_answer_prompts(
					$url,
					$context,
					isset( $payload['faqQuestion'] ) ? (string) $payload['faqQuestion'] : '',
					isset( $payload['faqAnswer'] ) ? (string) $payload['faqAnswer'] : '',
					isset( $payload['faqBlock'] ) ? (string) $payload['faqBlock'] : ''
				);
				break;
			default:
				return new WP_Error( 'flowbie_faq_step', __( 'Invalid FAQ step.', 'flowbie-wp' ) );
		}

		$value = Flowbie_Wp_OpenRouter::complete( $prompts['system'], $prompts['user'], 4096, 0.7 );
		if ( is_wp_error( $value ) ) {
			return $value;
		}

		return array(
			'ok'    => true,
			'field' => 'faq',
			'value' => (string) $value,
		);
	}

	/**
	 * @param array<string,string> $overrides
	 * @return string|WP_Error
	 */
	private static function preview_dedicated_field( int $post_id, string $field, array $overrides = array() ) {
		$context       = self::merge_context( $post_id, $overrides );
		$current_value = Flowbie_Wp_Ai_Context::read_field_value( $post_id, $field );
		if ( $field === 'faq' && isset( $overrides['faq'] ) ) {
			$current_value = (string) $overrides['faq'];
		}
		$url = $context['url'] !== '' ? $context['url'] : home_url( '/' );

		$prompts = self::build_prompts( $field, $current_value, $url, $context );

		$max_tokens = ( $field === 'seo_research' ) ? 6000 : 4096;
		return Flowbie_Wp_OpenRouter::complete( $prompts['system'], $prompts['user'], $max_tokens, 0.7 );
	}

	/**
	 * @param array<string,string> $overrides
	 * @return array<string,string>
	 */
	private static function merge_context( int $post_id, array $overrides = array() ): array {
		$ctx = Flowbie_Wp_Ai_Context::read_context( $post_id );
		$map = array(
			'seoTitle'        => 'title',
			'metaDescription' => 'excerpt',
			'focusKeyword'    => 'focusKeyword',
			'faq'             => 'faq',
			'seoResearch'     => 'seoResearch',
			'pageUrl'         => 'pageUrl',
		);
		foreach ( $map as $override_key => $ctx_key ) {
			if ( isset( $overrides[ $override_key ] ) ) {
				$ctx[ $ctx_key ] = trim( (string) $overrides[ $override_key ] );
			}
		}
		if ( isset( $overrides['title'] ) ) {
			$ctx['title'] = trim( (string) $overrides['title'] );
		}
		if ( isset( $overrides['excerpt'] ) ) {
			$ctx['excerpt'] = trim( (string) $overrides['excerpt'] );
		}
		if ( ! empty( $ctx['pageUrl'] ) && empty( $ctx['url'] ) ) {
			$ctx['url'] = $ctx['pageUrl'];
		}
		return $ctx;
	}

	/**
	 * @param array<string,string> $context
	 * @return array{system:string,user:string}
	 */
	private static function build_faq_brief_block( array $context ): string {
		$brief = isset( $context['seoResearch'] ) ? trim( (string) $context['seoResearch'] ) : '';
		if ( $brief === '' ) {
			return '';
		}
		return "JSON SEO content brief (primary - organics, PAA, related, GSC, Semrush; parse intent; do not copy verbatim)\n"
			. substr( $brief, 0, 24000 ) . "\n\n";
	}

	/**
	 * @param array<string,string> $context
	 * @return array{system:string,user:string}
	 */
	private static function build_faq_seed_prompts( string $url, array $context, int $pair_count ): array {
		$focus   = isset( $context['focusKeyword'] ) ? trim( (string) $context['focusKeyword'] ) : '';
		$title   = isset( $context['title'] ) ? trim( (string) $context['title'] ) : '';
		$excerpt = isset( $context['excerpt'] ) ? trim( (string) $context['excerpt'] ) : '';
		$brief   = self::build_faq_brief_block( $context );

		$user = "You are acting as a senior SEO strategist creating FAQ schema for a specific page.\n\n"
			. "The page currently has no usable FAQ content (or you are replacing empty FAQs). Output exactly {$pair_count} question-and-answer pairs (no more, no fewer).\n\n"
			. "Output format (strict - the app parses lines starting with Q: and A:)\n"
			. "- Repeat this block exactly {$pair_count} times:\n"
			. "  Q: <single-line question>\n"
			. "  A: <answer: 2-4 concise sentences>\n"
			. "- Each question must be meaningfully different (no duplicate angles).\n"
			. "- Do NOT start more than one question with the same first 3 words.\n"
			. "- Vary question openings (what, how, why, can, do I need, etc.).\n"
			. "- Use the JSON SEO content brief below as the primary signal for intent. Do NOT paste JSON into your output.\n\n"
			. $brief
			. "URL\n{$url}\n\n"
			. 'Focus keyword (use exactly as shown when relevant)' . "\n"
			. ( $focus !== '' ? $focus : '(none)' ) . "\n\n"
			. 'Page intent' . "\n"
			. 'Title: ' . ( $title !== '' ? $title : '(none)' ) . "\n"
			. 'Meta: ' . ( $excerpt !== '' ? substr( $excerpt, 0, 400 ) : '(none)' ) . "\n\n"
			. "Return only Q:/A: blocks as specified - no numbering, no markdown headings, no JSON.";

		return array(
			'system' => 'You are an SEO specialist who writes FAQ question-and-answer pairs for schema. Follow the Q:/A: format exactly. Use the JSON SEO content brief as the main signal for searcher intent.',
			'user'   => $user,
		);
	}

	/**
	 * @param array<string,string> $context
	 * @return array{system:string,user:string}
	 */
	private static function build_faq_question_prompts( string $url, array $context, string $current_question, string $faq_block ): array {
		$focus   = isset( $context['focusKeyword'] ) ? trim( (string) $context['focusKeyword'] ) : '';
		$title   = isset( $context['title'] ) ? trim( (string) $context['title'] ) : '';
		$excerpt = isset( $context['excerpt'] ) ? trim( (string) $context['excerpt'] ) : '';
		$brief   = self::build_faq_brief_block( $context );

		$user = "You are acting as a senior SEO strategist refining FAQ schema.\n\n"
			. "Improve this FAQ question so it is clearer, more elegant, and more helpful for searchers, but keep the same intent and page/topic.\n\n"
			. "Rules\n"
			. "- Keep it as a single question sentence.\n"
			. "- Do NOT answer the question.\n"
			. "- The question must not be a duplicate or trivial rephrase of other questions in the existing FAQ block.\n"
			. "- Use the JSON SEO content brief below as the primary signal for search intent. Do NOT paste JSON into your output.\n\n"
			. $brief
			. "URL\n{$url}\n\n"
			. 'Focus keyword (use exactly as shown when relevant)' . "\n"
			. ( $focus !== '' ? $focus : '(none)' ) . "\n\n"
			. "Existing FAQ block (context only)\n"
			. ( $faq_block !== '' ? $faq_block : '(none)' ) . "\n\n"
			. 'Page intent' . "\n"
			. 'Title: ' . ( $title !== '' ? $title : '(none)' ) . "\n"
			. 'Meta: ' . ( $excerpt !== '' ? substr( $excerpt, 0, 400 ) : '(none)' ) . "\n\n"
			. "Current question\n{$current_question}\n\n"
			. 'Return only the improved question, no quotes or bullets.';

		return array(
			'system' => 'You are an SEO specialist who rewrites FAQ questions to be clearer and better aligned with search intent. A structured JSON SEO content brief is provided - use it as the main signal.',
			'user'   => $user,
		);
	}

	/**
	 * @param array<string,string> $context
	 * @return array{system:string,user:string}
	 */
	private static function build_faq_answer_prompts( string $url, array $context, string $question, string $current_answer, string $faq_block ): array {
		$focus   = isset( $context['focusKeyword'] ) ? trim( (string) $context['focusKeyword'] ) : '';
		$title   = isset( $context['title'] ) ? trim( (string) $context['title'] ) : '';
		$excerpt = isset( $context['excerpt'] ) ? trim( (string) $context['excerpt'] ) : '';
		$brief   = self::build_faq_brief_block( $context );
		$has_answer = trim( $current_answer ) !== '';

		$user = "You are acting as a senior SEO strategist writing FAQ answers for schema.\n\n"
			. ( $has_answer
				? 'Improve this FAQ answer in the context of the page and its search intent.'
				: 'There is no existing answer - write a new, helpful FAQ answer from scratch using the page context and the question below.' ) . "\n\n"
			. "Rules\n"
			. "- Stay strictly on-topic for the question.\n"
			. "- Write 2-4 concise sentences.\n"
			. "- Use the JSON SEO content brief below as the primary signal for intent. Do NOT paste JSON into your output.\n\n"
			. $brief
			. "URL\n{$url}\n\n"
			. 'Focus keyword (use exactly as shown when relevant)' . "\n"
			. ( $focus !== '' ? $focus : '(none)' ) . "\n\n"
			. "Existing FAQ block (context only)\n"
			. ( $faq_block !== '' ? $faq_block : '(none)' ) . "\n\n"
			. 'Page intent' . "\n"
			. 'Title: ' . ( $title !== '' ? $title : '(none)' ) . "\n"
			. 'Meta: ' . ( $excerpt !== '' ? substr( $excerpt, 0, 400 ) : '(none)' ) . "\n\n"
			. "Question\n{$question}\n\n"
			. ( $has_answer ? "Current answer\n{$current_answer}\n\n" : '' )
			. 'Return only the answer text, no quotes or bullets.';

		return array(
			'system' => 'You are an SEO specialist who writes helpful FAQ answers aligned with search intent. Use the JSON SEO content brief as the main signal.',
			'user'   => $user,
		);
	}

	/**
	 * @param array<string,string> $context
	 * @return array{system:string,user:string}
	 */
	private static function build_prompts( string $field, string $current_value, string $url, array $context ): array {
		$focus        = isset( $context['focusKeyword'] ) ? trim( $context['focusKeyword'] ) : '';
		$title        = isset( $context['title'] ) ? trim( $context['title'] ) : '';
		$excerpt      = isset( $context['excerpt'] ) ? trim( $context['excerpt'] ) : '';
		$seo_research = isset( $context['seoResearch'] ) ? trim( $context['seoResearch'] ) : '';
		$brief_block  = self::build_faq_brief_block( $context );

		switch ( $field ) {
			case 'seo_research':
				return array(
					'system' => 'You are an SEO strategist. Produce concise, actionable research notes (may be JSON-like bullet structure or plain text).',
					'user'   => "Improve or expand this SEO research brief for the page. Use URL and fields as context.\n\nURL: {$url}\nTitle: " . ( $title !== '' ? $title : '(none)' ) . "\nFocus keyword: " . ( $focus !== '' ? $focus : '(none)' ) . "\nExcerpt: " . ( $excerpt !== '' ? substr( $excerpt, 0, 500 ) : '(none)' ) . "\n\nExisting brief (edit, enrich, fix gaps - keep factual tone):\n" . ( $current_value !== '' ? $current_value : '(empty)' ) . "\n\nReturn only the brief text (plain text or compact JSON string suitable for an ACF textarea). No preamble.",
				);
			case 'faq':
				return array(
					'system' => 'You are an SEO specialist who writes FAQ question-and-answer pairs. Follow the Q:/A: format exactly. Use the JSON SEO content brief as the main signal when provided.',
					'user'   => "You are acting as a senior SEO strategist creating FAQ content for this page.\n\nOutput format (strict)\n- Exactly 4 question-and-answer pairs.\n- Repeat this block 4 times:\n  Q: <single-line question>\n  A: <answer: 2-4 concise sentences>\n- Questions must differ in angle; vary openings (what, how, why, can).\n- Do NOT mention brand unless the page context does.\n"
						. ( $brief_block !== '' ? "- Use the JSON SEO content brief below as the primary signal. Do NOT paste JSON into your output.\n\n{$brief_block}" : '' )
						. "URL: {$url}\nFocus keyword: " . ( $focus !== '' ? $focus : '(none)' ) . "\nTitle: " . ( $title !== '' ? $title : '(none)' ) . "\nMeta/excerpt: " . ( $excerpt !== '' ? substr( $excerpt, 0, 400 ) : '(none)' ) . "\n\nExisting FAQ (replace or refine):\n" . ( $current_value !== '' ? $current_value : '(none)' ) . "\n\nReturn only Q:/A: blocks - no markdown headings, no JSON wrapper.",
				);
			case 'page_url':
				return array(
					'system' => 'You are an SEO URL strategist. Output only one URL or path string.',
					'user'   => "Suggest a clean, SEO-friendly full URL or site-relative path for this page.\n\nRules\n- Prefer a short slug derived from topic; use hyphens; lowercase.\n- If you output a full URL, use the same origin as the reference URL below when possible.\n- Do not include tracking parameters.\n\nReference URL (current): {$url}\nTitle: " . ( $title !== '' ? $title : '(none)' ) . "\nFocus keyword: " . ( $focus !== '' ? $focus : '(none)' ) . "\n\nUser's current value: " . ( $current_value !== '' ? $current_value : '(none)' ) . "\n\nReturn only one line: the suggested URL or path (e.g. https://example.com/services/roofing/ or /services/roofing/). No quotes or explanation.",
				);
			default:
				return array(
					'system' => 'You are an SEO assistant.',
					'user'   => $current_value,
				);
		}
	}

	private static function normalize_preview_value( int $post_id, string $field, string $value ): string {
		if ( $field === 'title' ) {
			return Flowbie_Wp_Ai_Seo_Limits::normalize_title( $value );
		}
		if ( $field === 'excerpt' ) {
			$focus = Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id );
			return Flowbie_Wp_Ai_Seo_Limits::normalize_description( $value, $focus );
		}
		return $value;
	}
}

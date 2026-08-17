<?php
/**
 * Meta-field AI (ported from overview-meta-optimizer-ai.js).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Ai_Meta {

	const EXCLUDE_FROM_PROMPT = array(
		'_elementor_data',
		'_elementor_edit_mode',
		'_elementor_template_type',
		'_elementor_css',
		'_elementor_page_settings',
	);

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function run_optimize_meta( int $post_id, ?string $primary_keyword = null ) {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'neo-pulse_post', __( 'Post not found.', 'neo-pulse-wp' ) );
		}

		$post_title   = self::strip_html( get_the_title( $post ) );
		if ( $post_title === '' ) {
			$post_title = '(no title)';
		}
		$content_html = (string) $post->post_content;
		$text_content = $content_html;
		if ( strpos( $text_content, '<' ) !== false && strpos( $text_content, '>' ) !== false ) {
			$text_content = self::strip_html( $text_content );
		}
		$limited_content = substr( $text_content, 0, 5000 );

		$existing_meta = self::load_rank_math_meta( $post_id );
		$raw_desc      = '';
		if ( ! empty( $existing_meta['rank_math_description'] ) ) {
			$raw_desc = trim( (string) $existing_meta['rank_math_description'] );
		}
		if ( $raw_desc === '' ) {
			$raw_desc = self::strip_html( (string) $post->post_excerpt );
		}
		$limited_meta_description = $raw_desc !== '' ? substr( preg_replace( '/\s+/', ' ', trim( wp_strip_all_tags( $raw_desc ) ) ), 0, 300 ) : '';

		$post_link = get_permalink( $post );
		$post_link = is_string( $post_link ) ? $post_link : '';
		$is_page   = $post->post_type === 'page';
		$site_url  = home_url();

		if ( null === $primary_keyword || trim( $primary_keyword ) === '' ) {
			$primary_keyword = Neo_Pulse_Wp_Ai_Context::read_focus_keyword( $post_id );
		}
		$primary_keyword = self::infer_primary_keyword( $post_link, $post_title, $primary_keyword );

		$existing_for_prompt = array();
		foreach ( $existing_meta as $k => $v ) {
			if ( in_array( $k, self::EXCLUDE_FROM_PROMPT, true ) ) {
				continue;
			}
			$s = is_string( $v ) ? $v : wp_json_encode( $v );
			if ( strlen( $s ) > 2000 ) {
				continue;
			}
			$existing_for_prompt[ $k ] = $v;
		}

		$seo_brief = Neo_Pulse_Wp_Ai_Context::read_acf_or_meta( $post_id, array( 'seo_research' ) );
		$seo_brief = $seo_brief !== '' ? substr( $seo_brief, 0, 4000 ) : '';

		$system_prompt = self::build_system_prompt( $is_page, $seo_brief !== '' );
		$user_prompt   = self::build_user_prompt(
			$post_title,
			$limited_meta_description,
			$primary_keyword,
			$limited_content,
			$site_url,
			$post_link,
			$seo_brief,
			$existing_for_prompt,
			$is_page
		);

		$result = Neo_Pulse_Wp_OpenRouter::complete( $system_prompt, $user_prompt, 4000, 0.7 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$optimized = self::parse_meta_json( $result );
		if ( is_wp_error( $optimized ) ) {
			return $optimized;
		}

		if ( ! empty( $optimized['rank_math_title'] ) ) {
			$optimized['rank_math_title'] = Neo_Pulse_Wp_Ai_Seo_Limits::normalize_title( (string) $optimized['rank_math_title'] );
		}

		$desc = isset( $optimized['rank_math_description'] ) ? (string) $optimized['rank_math_description'] : '';
		if ( $desc !== '' ) {
			$optimized['rank_math_description'] = Neo_Pulse_Wp_Ai_Seo_Limits::normalize_description( $desc, $primary_keyword );
		}

		if ( empty( $optimized['rank_math_focus_keyword'] ) ) {
			$optimized['rank_math_focus_keyword'] = $primary_keyword;
		}
		if ( empty( $optimized['rank_math_canonical_url'] ) && $post_link !== '' ) {
			$optimized['rank_math_canonical_url'] = $post_link;
		}

		$final = array_merge( $existing_meta, $optimized );
		$final['rank_math_focus_keyword'] = $primary_keyword;
		if ( trim( $primary_keyword ) !== '' ) {
			$final['keyword_focus'] = trim( $primary_keyword );
		}

		return array(
			'optimizedMeta'   => $final,
			'primaryKeyword'  => $primary_keyword,
		);
	}

	/**
	 * @return string|WP_Error
	 */
	public static function preview_meta_field( int $post_id, string $field ) {
		$result = self::run_optimize_meta( $post_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$om = isset( $result['optimizedMeta'] ) && is_array( $result['optimizedMeta'] ) ? $result['optimizedMeta'] : array();
		if ( $field === 'title' ) {
			$value = isset( $om['rank_math_title'] ) ? trim( (string) $om['rank_math_title'] ) : '';
		} elseif ( $field === 'focus_keyword' ) {
			$value = isset( $om['rank_math_focus_keyword'] ) ? trim( (string) $om['rank_math_focus_keyword'] ) : '';
		} else {
			$value = isset( $om['rank_math_description'] ) ? trim( (string) $om['rank_math_description'] ) : '';
		}
		if ( $value === '' ) {
			return new WP_Error(
				'neo-pulse_meta_empty',
				__( 'Meta optimizer returned no value for this field. Check focus keyword and post content.', 'neo-pulse-wp' )
			);
		}

		if ( $field === 'title' ) {
			$value = Neo_Pulse_Wp_Ai_Seo_Limits::normalize_title( $value );
		} elseif ( $field === 'excerpt' ) {
			$focus = Neo_Pulse_Wp_Ai_Context::read_focus_keyword( $post_id );
			$value = Neo_Pulse_Wp_Ai_Seo_Limits::normalize_description( $value, $focus );
		}

		return $value;
	}

	private static function strip_html( string $html ): string {
		if ( $html === '' ) {
			return '';
		}
		$html = preg_replace( '/<script[^>]*>[\s\S]*?<\/script>/i', '', $html );
		$html = preg_replace( '/<style[^>]*>[\s\S]*?<\/style>/i', '', $html );
		return trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $html ) ) );
	}

	private static function infer_primary_keyword( string $url, string $title, string $explicit ): string {
		$e = trim( $explicit );
		if ( strlen( $e ) >= 2 ) {
			return $e;
		}
		if ( $url !== '' ) {
			$path = wp_parse_url( $url, PHP_URL_PATH );
			if ( is_string( $path ) ) {
				$path = trim( $path, '/' );
				$parts = explode( '/', $path );
				$last  = end( $parts );
				if ( is_string( $last ) ) {
					$from_slug = trim( preg_replace( '/\.(html?|php)$/i', '', str_replace( '-', ' ', $last ) ) );
					if ( strlen( $from_slug ) >= 3 ) {
						return $from_slug;
					}
				}
			}
		}
		$t = trim( $title );
		if ( strlen( $t ) >= 3 ) {
			$words = explode( ' ', $t );
			return substr( implode( ' ', array_slice( $words, 0, 5 ) ), 0, 80 );
		}
		return 'seo';
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function load_rank_math_meta( int $post_id ): array {
		$keys = array(
			'rank_math_title',
			'rank_math_description',
			'rank_math_focus_keyword',
			'rank_math_canonical_url',
			'rank_math_robots',
			'rank_math_facebook_title',
			'rank_math_facebook_description',
			'rank_math_twitter_title',
			'rank_math_twitter_description',
			'rank_math_twitter_card_type',
		);
		$meta = array();
		foreach ( $keys as $key ) {
			$val = get_post_meta( $post_id, $key, true );
			if ( $val !== '' && $val !== false ) {
				$meta[ $key ] = $val;
			}
		}
		return $meta;
	}

	private static function build_system_prompt( bool $is_page, bool $has_brief ): string {
		$brief_note = $has_brief
			? "\nSEO CONTENT BRIEF (from ACF seo_research when present): included in the user message. Use it as a signal for intent and angles when writing rank_math_title, rank_math_description, and social fields. Do NOT paste raw brief into outputs verbatim.\n"
			: '';

		return 'You are an expert SEO specialist specializing in WordPress meta field optimization, particularly RankMath SEO fields. Your task is to analyze post content and generate optimized meta fields that improve search engine visibility and click-through rates.

CRITICAL REQUIREMENTS:
1. SEO Title (rank_math_title): Must be 50-60 characters, include primary keyword naturally near the BEGINNING (first few words), be compelling and click-worthy. Do NOT prepend site name, business name, or brand.
2. Meta Description (rank_math_description): MUST include the Focus Keyword (primary keyword) clearly - Rank Math requires it.' . ( $is_page
			? ' You may reference the post title at the start, but shorten it if needed so the full description NEVER exceeds 160 characters.'
			: ' Do NOT include the post title in the description. Start with a direct question hook or compelling benefit statement, then include a clear value proposition.' ) . '
3. Focus Keyword (rank_math_focus_keyword): Use the exact primary keyword provided
4. Canonical URL (rank_math_canonical_url): Use the post link if provided, otherwise construct from site URL and title
5. Robots Meta (rank_math_robots): Preserve existing value or use ["index", "follow"] if not present
6. Social Meta Fields: Optimize Facebook and Twitter titles/descriptions (can be longer than SEO title/description)
7. Preserve ALL other existing meta fields - only optimize RankMath and common SEO fields
8. Never invent patient/customer testimonials, review quotes, star ratings, or fake attributions in meta fields.
' . $brief_note . '
Return ONLY a valid JSON object matching the structure of existing meta fields.

Character limits are HARD MAXIMUMS — never exceed them:
- SEO Title (rank_math_title): MAXIMUM 60 characters (target 50-55). Count characters before returning.
- Meta Description (rank_math_description): MAXIMUM 160 characters, MINIMUM 150 characters (target range: 150-160). Count characters before returning. If the post title is long, summarize or shorten it — do NOT copy the full title verbatim when that would exceed 160 characters.
- Social titles can be up to 70 characters
- Social descriptions can be up to 200 characters';
	}

	/**
	 * @param array<string,mixed> $existing_for_prompt
	 */
	private static function build_user_prompt(
		string $post_title,
		string $limited_meta_description,
		string $primary_keyword,
		string $limited_content,
		string $site_url,
		string $post_link,
		string $seo_brief,
		array $existing_for_prompt,
		bool $is_page
	): string {
		$brief_block = $seo_brief !== ''
			? "\nSEO CONTENT BRIEF (ACF seo_research - parse for themes; do not copy into Rank Math JSON values verbatim)\n{$seo_brief}\n"
			: '';

		return "Analyze this WordPress post and generate optimized meta fields:

POST TITLE: {$post_title}
META DESCRIPTION: " . ( $limited_meta_description !== '' ? $limited_meta_description : 'Not provided' ) . "
PRIMARY KEYWORD: {$primary_keyword}
POST CONTENT (first 5000 chars): {$limited_content}
SITE URL: {$site_url}
POST LINK: {$post_link}
{$brief_block}
EXISTING META FIELDS (heavy/Elementor fields excluded; those are preserved automatically):
" . wp_json_encode( $existing_for_prompt, JSON_PRETTY_PRINT ) . "

Generate optimized meta fields. Focus on:
1. rank_math_title - SEO title (MAX 60 chars — never exceed 60, keyword near the start, compelling)
2. rank_math_description - Meta description (150-160 chars — never below 150 or above 160). CRITICAL: Must clearly include the Focus Keyword \"{$primary_keyword}\" somewhere in the description - Rank Math requires it." . ( $is_page
			? ' You may reference the post title at the start, but shorten it if needed to stay within 160 characters total.'
			: ' Do NOT include the post title in the description. Start with a question hook or benefit statement.' ) . " Make it a strong value proposition with a subtle call to action. Count characters before returning JSON.
3. rank_math_focus_keyword - Primary focus keyword (exact match: \"{$primary_keyword}\")
4. rank_math_canonical_url - Canonical URL (use post link if provided)
5. rank_math_robots - Robots directives (preserve existing or use [\"index\", \"follow\"])
6. rank_math_facebook_title - Facebook OG title (can be up to 70 chars)
7. rank_math_facebook_description - Facebook OG description (can be up to 200 chars)
8. rank_math_twitter_title - Twitter title (can be up to 70 chars)
9. rank_math_twitter_description - Twitter description (can be up to 200 chars)
10. rank_math_twitter_card_type - Twitter card type (preserve existing or use \"summary_large_image\")

Return ONLY a JSON object with the optimized meta fields.";
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function parse_meta_json( string $ai_response ) {
		$optimized = array();
		if ( preg_match( '/\{[\s\S]*\}/', $ai_response, $m ) ) {
			$decoded = json_decode( $m[0], true );
		} else {
			$decoded = json_decode( $ai_response, true );
		}
		if ( ! is_array( $decoded ) ) {
			return new WP_Error( 'neo-pulse_meta_json', __( 'Failed to parse meta optimizer JSON.', 'neo-pulse-wp' ) );
		}
		return $decoded;
	}
}

<?php
/**
 * Shared LLM grounding rules for platform read-only data tools.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Data_Tool_Grounding {

	public static function rules(): string {
		return implode(
			' ',
			array(
				'Answer using Researched data when present; cite titles, URLs, scores, findings, and recommendations from Lead synthesis and slice agent sections only.',
				'When Researched data lists inventory items, render each as a markdown link on the title only: [Title](url). Never show the raw URL on its own line or in parentheses after the title.',
				'When per-URL scores appear in Lead synthesis, list each post with linked title and X/10 from that block; cite slice agent findings (meta, keyword, faq, seo, body, image) when explaining grades.',
				'When Researched data includes GSC compare summary lines with Interpretation:, treat that interpretation as authoritative over naive average-position reads.',
				'When Researched data includes GSC queries, keywords, or analytics rows, present them in a markdown table (Query | Clicks | Impressions | Position) or a bullet list with one query per bullet. Never inline multiple queries in prose.',
				'When Researched data includes GSC blog performer rows, present them as blog posts with linked title and URL: [Post Title](url). Label them as blog posts, not search queries.',
				'When Researched data includes a Blog performers (GSC) markdown table, reproduce that table verbatim as the primary answer section. Do not duplicate the same blogs in a second list.',
				'CTR for blog rows must come from row ctrPercent or clicks divided by impressions. Never report CTR as 0 when both clicks and impressions are non-zero.',
				'Keep Queries and Blog pages in separate sections when both appear. Never call a search query string a blog post.',
				'If GSC blog performer data has no matching blog rows with clicks, say that clearly. Do not invent a blog from query data.',
				'For why/explain-grade follow-ups, cite only findings and scores from Researched data slice agents and lead synthesis; never invent linking, readability, content depth, or other SEO metrics not in the block.',
				'Never say post grading is unavailable when Researched data includes lead synthesis scores or slice agent findings.',
				'Do not claim you cannot access data that appears in Researched data.',
				'If Researched data says inventory is unavailable, say that explicitly and do not invent titles or metrics.',
				'relatedTopics must stay on the current topic: after post reviews use grade or slice follow-ups; after GSC slices use analytics follow-ups; do not suggest generic Opt or sitemap tasks when data research ran.',
				'Still use playbooks for how to click in the UI; use researched data for what exists on the site or in analytics.',
			)
		);
	}
}

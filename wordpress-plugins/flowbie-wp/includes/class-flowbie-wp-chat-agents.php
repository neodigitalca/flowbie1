<?php
/**
 * Three-phase sub-agent orchestration for the Flowbie Chat widget.
 *
 * Phase A: Classify intent + select relevant content (fast model).
 * Phase B: Reason and draft an answer with citations (capable model).
 * Phase C: Format the answer as a semantic card JSON (fast model).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat_Agents {

	const FAST_MODEL    = 'google/gemini-2.5-flash-lite';
	const REASON_MODEL  = 'google/gemini-2.5-flash';

	/**
	 * Run the full three-phase pipeline.
	 *
	 * @param string $user_message  Current user message.
	 * @param array  $history       Conversation history [{role,content},...].
	 * @param string $site_name     Human-readable site name.
	 * @param array  $site_index    Full site inventory from RAG.
	 * @param array  $training      Training settings (assistant_name, system_prompt, greeting_style, knowledge_base).
	 * @return array Semantic card JSON or error shape.
	 */
	public static function run( string $user_message, array $history, string $site_name, array $site_index, array $training = array() ): array {
		$phase_a = self::phase_classify( $user_message, $site_name, $site_index );
		if ( is_wp_error( $phase_a ) ) {
			return self::error_card( $phase_a->get_error_message() );
		}

		$relevant_items = self::select_relevant_items( $phase_a, $site_index );

		$phase_b = self::phase_reason( $user_message, $history, $site_name, $relevant_items, $phase_a, $training );
		if ( is_wp_error( $phase_b ) ) {
			return self::error_card( $phase_b->get_error_message() );
		}

		$phase_c = self::phase_format( $phase_b, $phase_a );
		if ( is_wp_error( $phase_c ) ) {
			return self::fallback_card( $phase_b, $relevant_items );
		}

		return $phase_c;
	}

	/**
	 * Phase A: classify intent and select relevant post IDs.
	 *
	 * @return array|WP_Error Parsed JSON with intent + relevant_ids.
	 */
	public static function phase_classify( string $message, string $site_name, array $site_index ) {
		$inventory_summary = self::build_inventory_summary( $site_index );

		$system = <<<PROMPT
You are a classification agent for the website "{$site_name}".
Given a user message and a list of site pages, output ONLY valid JSON with these fields:
- "intent": one of "question", "navigation", "recommendation", "support"
- "relevant_ids": array of up to 8 post IDs most relevant to the query (integers)
- "search_terms": array of key terms extracted from the query

SITE CONTENT:
{$inventory_summary}
PROMPT;

		$result = self::call_openrouter( self::FAST_MODEL, $system, $message, 1024, 0.2 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_json_response( $result );
		if ( null === $parsed ) {
			return array(
				'intent'       => 'question',
				'relevant_ids' => array(),
				'search_terms' => array(),
			);
		}

		return $parsed;
	}

	/**
	 * Phase B: reason and draft an answer with full context.
	 *
	 * @return string|WP_Error The drafted answer text.
	 */
	public static function phase_reason( string $message, array $history, string $site_name, array $items, array $classification, array $training = array() ) {
		$knowledge_base = isset( $training['knowledge_base'] ) && is_array( $training['knowledge_base'] ) ? $training['knowledge_base'] : array();
		$context        = Flowbie_Wp_Chat_Rag::format_context( $items, $knowledge_base );
		$intent         = isset( $classification['intent'] ) ? $classification['intent'] : 'question';

		$assistant_name = isset( $training['assistant_name'] ) && $training['assistant_name'] !== '' ? $training['assistant_name'] : 'Flow Assist';
		$custom_prompt  = isset( $training['system_prompt'] ) && $training['system_prompt'] !== '' ? $training['system_prompt'] : '';
		$greeting_style = isset( $training['greeting_style'] ) ? $training['greeting_style'] : 'friendly';

		$tone_map = array(
			'professional' => 'Use a polished, professional tone. Be precise and authoritative.',
			'friendly'     => 'Use a warm, friendly tone. Be approachable and helpful.',
			'casual'       => 'Use a casual, relaxed tone. Be conversational and easygoing.',
		);
		$tone_instruction = isset( $tone_map[ $greeting_style ] ) ? $tone_map[ $greeting_style ] : $tone_map['friendly'];

		$history_text = '';
		$recent       = array_slice( $history, -6 );
		foreach ( $recent as $entry ) {
			$role = isset( $entry['role'] ) ? ucfirst( $entry['role'] ) : 'User';
			$history_text .= "{$role}: {$entry['content']}\n";
		}

		$identity = "You are \"{$assistant_name}\", the AI assistant for the website \"{$site_name}\".";
		if ( $custom_prompt !== '' ) {
			$identity .= "\n\nCUSTOM INSTRUCTIONS FROM SITE OWNER:\n{$custom_prompt}";
		}

		$system = <<<PROMPT
{$identity}
The user's intent is: {$intent}.

TONE: {$tone_instruction}

RULES:
- Answer based ONLY on the provided site content and knowledge base below.
- Knowledge base entries marked HIGH PRIORITY should be used verbatim when they match the question.
- If the user asks for a link or URL, include the real URL from the content.
- Be concise and helpful.
- If you cannot answer from the provided content, say so honestly and suggest they contact the site directly.
- When referencing pages, always include their URL.

SITE CONTENT:
{$context}

CONVERSATION HISTORY:
{$history_text}
PROMPT;

		return self::call_openrouter( self::REASON_MODEL, $system, $message, 2048, 0.5 );
	}

	/**
	 * Phase C: format the drafted answer as a semantic card JSON.
	 *
	 * @return array|WP_Error Parsed card JSON.
	 */
	public static function phase_format( string $answer, array $classification ) {
		$intent = isset( $classification['intent'] ) ? $classification['intent'] : 'question';
		$type_map = array(
			'question'       => 'answer',
			'navigation'     => 'navigation',
			'recommendation' => 'recommendation',
			'support'        => 'answer',
		);
		$card_type = isset( $type_map[ $intent ] ) ? $type_map[ $intent ] : 'answer';

		$system = <<<PROMPT
Convert the following assistant answer into ONLY valid JSON matching this exact schema:
{
  "type": "{$card_type}",
  "title": "short bold summary of the answer",
  "body": "the full answer text, supports markdown",
  "links": [{"label": "display text", "url": "https://...", "icon": "page|post|external"}],
  "cta": {"label": "button text", "url": "https://..."},
  "relatedTopics": ["topic 1", "topic 2"],
  "confidence": "high|medium|low"
}

Rules:
- "links" should contain every URL mentioned in the answer. Set icon to "page" for site pages, "post" for blog posts, "external" for outside links.
- "cta" should be the single most important action link, or omit it if none applies.
- "relatedTopics" should be 2-4 short suggested follow-up questions.
- "confidence" is "high" if the answer directly addresses the query from content, "medium" if partial, "low" if mostly uncertain.
- Output ONLY the JSON object, no markdown fences, no explanation.
PROMPT;

		$result = self::call_openrouter( self::FAST_MODEL, $system, $answer, 2048, 0.1 );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$parsed = self::parse_json_response( $result );
		if ( null === $parsed || ! isset( $parsed['title'] ) ) {
			return new WP_Error( 'flowbie_chat_format', 'Failed to format response as card.' );
		}

		$parsed['type'] = isset( $parsed['type'] ) ? $parsed['type'] : $card_type;
		$parsed['confidence'] = isset( $parsed['confidence'] ) ? $parsed['confidence'] : 'medium';

		return $parsed;
	}

	/**
	 * Select items from the site index matching Phase A's relevant_ids.
	 * Falls back to RAG keyword retrieval if IDs don't match.
	 */
	public static function select_relevant_items( array $classification, array $site_index ): array {
		$ids = isset( $classification['relevant_ids'] ) ? array_map( 'intval', (array) $classification['relevant_ids'] ) : array();

		if ( ! empty( $ids ) ) {
			$matched = array();
			$id_set  = array_flip( $ids );
			foreach ( $site_index as $item ) {
				if ( isset( $id_set[ $item['id'] ] ) ) {
					$matched[] = $item;
				}
			}
			if ( ! empty( $matched ) ) {
				return $matched;
			}
		}

		$terms_str = '';
		if ( ! empty( $classification['search_terms'] ) ) {
			$terms_str = implode( ' ', (array) $classification['search_terms'] );
		}
		if ( $terms_str !== '' ) {
			return Flowbie_Wp_Chat_Rag::retrieve( $terms_str );
		}

		return array_slice( $site_index, 0, 5 );
	}

	/**
	 * Build a compact inventory summary for Phase A (IDs + titles + URLs).
	 */
	private static function build_inventory_summary( array $index ): string {
		$lines = array();
		foreach ( $index as $item ) {
			$cats = ! empty( $item['categories'] ) ? ' [' . implode( ', ', $item['categories'] ) . ']' : '';
			$lines[] = "ID:{$item['id']} | {$item['title']} | {$item['url']} | {$item['type']}{$cats}";
		}
		return implode( "\n", $lines );
	}

	/**
	 * Call OpenRouter with a specific model.
	 *
	 * @return string|WP_Error
	 */
	private static function call_openrouter( string $model, string $system_prompt, string $user_prompt, int $max_tokens = 2048, float $temperature = 0.5 ) {
		$key = Flowbie_Wp_OpenRouter::get_api_key();
		if ( $key === '' ) {
			return new WP_Error(
				'flowbie_openrouter_key',
				__( 'OpenRouter API key is not configured. Add it in Flowbie WP Settings > Editor AI.', 'flowbie-wp' )
			);
		}

		Flowbie_Wp_OpenRouter::maybe_extend_time_limit();

		$response = wp_remote_post(
			Flowbie_Wp_OpenRouter::API_URL,
			array(
				'timeout' => Flowbie_Wp_OpenRouter::get_timeout(),
				'headers' => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $key,
					'HTTP-Referer'  => Flowbie_Wp_OpenRouter::get_http_referer(),
					'X-Title'       => 'Flowbie Chat Widget',
				),
				'body'    => wp_json_encode(
					array(
						'model'       => $model,
						'messages'    => array(
							array( 'role' => 'system', 'content' => $system_prompt ),
							array( 'role' => 'user', 'content' => $user_prompt ),
						),
						'temperature' => $temperature,
						'max_tokens'  => $max_tokens,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = '';
			if ( is_array( $data ) && isset( $data['error']['message'] ) ) {
				$msg = (string) $data['error']['message'];
			}
			if ( $msg === '' ) {
				$msg = sprintf( 'HTTP %d', $code );
			}
			return new WP_Error( 'flowbie_chat_ai', $msg );
		}

		$text = '';
		if ( is_array( $data ) && isset( $data['choices'][0]['message']['content'] ) ) {
			$text = trim( (string) $data['choices'][0]['message']['content'] );
		}

		if ( $text === '' ) {
			return new WP_Error( 'flowbie_chat_empty', __( 'AI returned empty content.', 'flowbie-wp' ) );
		}

		return $text;
	}

	/**
	 * Parse a JSON string from an LLM response, stripping markdown fences.
	 *
	 * @return array|null
	 */
	private static function parse_json_response( string $text ): ?array {
		$text = trim( $text );
		$text = preg_replace( '/^```(?:json)?\s*/i', '', $text );
		$text = preg_replace( '/\s*```$/', '', $text );
		$text = trim( $text );

		$decoded = json_decode( $text, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Produce an error card when the pipeline fails.
	 */
	private static function error_card( string $message ): array {
		return array(
			'type'       => 'not-found',
			'title'      => __( 'Something went wrong', 'flowbie-wp' ),
			'body'       => $message,
			'links'      => array(),
			'confidence' => 'low',
		);
	}

	/**
	 * Produce a fallback card when Phase C formatting fails but Phase B succeeded.
	 */
	private static function fallback_card( string $answer, array $items ): array {
		$links = array();
		foreach ( array_slice( $items, 0, 3 ) as $item ) {
			$links[] = array(
				'label' => $item['title'],
				'url'   => $item['url'],
				'icon'  => $item['type'] === 'post' ? 'post' : 'page',
			);
		}

		return array(
			'type'       => 'answer',
			'title'      => __( 'Here\'s what I found', 'flowbie-wp' ),
			'body'       => $answer,
			'links'      => $links,
			'confidence' => 'medium',
		);
	}
}

<?php
/**
 * NEO Pulse native Flow Assist (Ask / Plan / Build v1).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Ask {

	/**
	 * Live NDJSON stream: progress events while the pipeline runs.
	 *
	 * @param array<string,mixed> $body Request body.
	 * @param callable            $emit Emits each NDJSON event.
	 */
	public static function stream_live( array $body, callable $emit ): void {
		$key_err = self::prepare_openrouter_key( $body );
		if ( $key_err !== null ) {
			$emit(
				array(
					'status' => 'done',
					'card'   => self::error_card( $key_err ),
				)
			);
			return;
		}

		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( (string) $body['message'] ) ) : '';
		if ( trim( $message ) === '' ) {
			$emit(
				array(
					'status' => 'done',
					'card'   => self::error_card( 'Message cannot be empty.' ),
				)
			);
			Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
			return;
		}

		$submode = self::normalize_submode( isset( $body['admin_submode'] ) ? (string) $body['admin_submode'] : 'ask' );
		$history = self::normalize_history( isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array() );
		$user_id = self::current_user_id();

		if ( $submode === 'build' ) {
			$automation = Neo_Pulse_App_Pulse_Assist_Automation_Intent::match( $message, $body, 'build' );
			if ( is_array( $automation ) ) {
				$card = Neo_Pulse_App_Pulse_Assist_Automation_Intent::dispatch_card( $automation );
				Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
				$emit(
					array(
						'status'           => 'done',
						'card'             => $card,
						'sliceTeam'        => array(),
						'intentSummary'    => 'Automation dispatch',
						'actionPlanTools'  => array(),
						'actionExecuted'   => false,
						'leadAgentUsed'    => false,
					)
				);
				return;
			}

			$action = Neo_Pulse_App_Pulse_Assist_Action_Orchestrator::run( $message, $history, $body, 'build', $user_id, $emit );
			$card   = ( $action['handled'] && is_array( $action['card'] ) ) ? $action['card'] : self::build_no_action_card();
			Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
			$emit(
				array(
					'status'           => 'done',
					'card'             => $card,
					'sliceTeam'        => isset( $action['sliceTeam'] ) && is_array( $action['sliceTeam'] ) ? $action['sliceTeam'] : array(),
					'intentSummary'    => (string) ( $action['intentSummary'] ?? '' ),
					'actionPlanTools'  => isset( $action['actionPlanTools'] ) && is_array( $action['actionPlanTools'] ) ? $action['actionPlanTools'] : array(),
					'actionExecuted'   => ! empty( $action['executed'] ),
					'leadAgentUsed'    => ! empty( $action['handled'] ),
				)
			);
			return;
		}

		$research = null;
		$data_research = null;

		$emit(
			array(
				'status' => 'phase',
				'phase'  => 'modules',
				'label'  => $submode === 'plan' ? 'Researching modules for plan…' : 'Researching modules…',
			)
		);
		$research = self::research_modules_for_message( $message, $history, $body );

		$data_research = Neo_Pulse_App_Pulse_Assist_Data_Tools::research_for_message(
			$message,
			$history,
			$body,
			$research,
			$emit
		);

		$action_result = Neo_Pulse_App_Pulse_Assist_Action_Orchestrator::run( $message, $history, $body, $submode, $user_id, $emit );
		if ( ! empty( $action_result['handled'] ) && is_array( $action_result['card'] ) ) {
			$card = $action_result['card'];
		} else {
			$emit(
				array(
					'status' => 'phase',
					'phase'  => 'compose',
					'label'  => $submode === 'plan' ? 'Drafting plan preview…' : 'Composing answer…',
				)
			);
			$card = self::run_for_submode( $submode, $message, $history, $body, $research, $data_research );
		}

		$emit(
			array(
				'status' => 'phase',
				'phase'  => 'format',
				'label'  => 'Formatting response…',
			)
		);

		Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();

		$emit(
			array(
				'status'                => 'done',
				'card'                  => $card,
				'relatedTopics'         => isset( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ? $card['relatedTopics'] : array(),
				'researchedModules'     => ( $research !== null && ! empty( $research['moduleIds'] ) ) ? $research['moduleIds'] : array(),
				'researchedFeatureIds'  => ( $research !== null && ! empty( $research['featureIds'] ) ) ? $research['featureIds'] : array(),
				'researchedDataToolIds' => ( isset( $data_research ) && ! empty( $data_research['toolIds'] ) ) ? $data_research['toolIds'] : array(),
				'dataToolClassifierReason' => ( isset( $data_research['classifierReason'] ) && is_string( $data_research['classifierReason'] ) ) ? $data_research['classifierReason'] : '',
				'researchedDataBlock'   => ( isset( $data_research['block'] ) && is_string( $data_research['block'] ) ) ? self::truncate_debug_block( $data_research['block'] ) : '',
				'inventorySource'       => ( isset( $data_research['inventorySource'] ) && is_string( $data_research['inventorySource'] ) ) ? $data_research['inventorySource'] : '',
				'acfComplete'           => ! empty( $data_research['acfComplete'] ),
				'sliceTeam'             => ! empty( $action_result['sliceTeam'] ) && is_array( $action_result['sliceTeam'] ) ? $action_result['sliceTeam'] : ( ( isset( $data_research['sliceTeam'] ) && is_array( $data_research['sliceTeam'] ) ) ? $data_research['sliceTeam'] : array() ),
				'leadAgentUsed'         => ! empty( $action_result['handled'] ) || ! empty( $data_research['leadAgentUsed'] ),
				'intentSummary'         => ! empty( $action_result['intentSummary'] ) ? (string) $action_result['intentSummary'] : ( ( isset( $data_research['intentSummary'] ) && is_string( $data_research['intentSummary'] ) ) ? $data_research['intentSummary'] : '' ),
				'researchArtifacts'     => ( isset( $data_research['researchArtifacts'] ) && is_array( $data_research['researchArtifacts'] ) ) ? $data_research['researchArtifacts'] : null,
				'actionPlanTools'       => isset( $action_result['actionPlanTools'] ) && is_array( $action_result['actionPlanTools'] ) ? $action_result['actionPlanTools'] : array(),
				'actionExecuted'        => ! empty( $action_result['executed'] ),
			)
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function stream( array $body ) {
		$key_err = self::prepare_openrouter_key( $body );
		if ( $key_err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $key_err ) );
		}

		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( (string) $body['message'] ) ) : '';
		if ( trim( $message ) === '' ) {
			return array( 400, array( 'ok' => false, 'error' => 'Message cannot be empty.' ) );
		}

		$submode = self::normalize_submode( isset( $body['admin_submode'] ) ? (string) $body['admin_submode'] : 'ask' );
		$history = self::normalize_history( isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array() );
		$user_id = self::current_user_id();
		if ( $submode === 'build' ) {
			$action        = Neo_Pulse_App_Pulse_Assist_Action_Orchestrator::run( $message, $history, $body, 'build', $user_id, null );
			$card          = ( ! empty( $action['handled'] ) && is_array( $action['card'] ) ) ? $action['card'] : self::build_no_action_card();
			$research      = null;
			$data_research = null;
		} else {
			$research      = self::research_modules_for_message( $message, $history, $body );
			$data_research = Neo_Pulse_App_Pulse_Assist_Data_Tools::research_for_message( $message, $history, $body, $research );
			$card          = self::run_for_submode( $submode, $message, $history, $body, $research, $data_research );
		}

		Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();

		$search_label = $submode === 'plan' ? 'Planning…' : 'Analyzing Pulse context…';
		if ( isset( $data_research ) && ! empty( $data_research['toolIds'] ) ) {
			$search_label = 'Querying site data…';
		} elseif ( $research !== null && ! empty( $research['label'] ) ) {
			$search_label = 'Researching ' . $research['label'] . '…';
		}
		$ack_text = $submode === 'plan' ? 'Drafting a plan preview…' : 'Looking at your Pulse workspace…';

		return array(
			200,
			array(
				'ok'     => true,
				'ndjson' => array(
					array( 'status' => 'ack', 'text' => $ack_text ),
					array( 'status' => 'thinking', 'label' => $search_label ),
					array( 'status' => 'formatting', 'label' => 'Formatting response…' ),
					array(
						'status'                => 'done',
						'card'                  => $card,
						'relatedTopics'         => isset( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ? $card['relatedTopics'] : array(),
						'researchedModules'     => ( $research !== null && ! empty( $research['moduleIds'] ) ) ? $research['moduleIds'] : array(),
						'researchedFeatureIds'  => ( $research !== null && ! empty( $research['featureIds'] ) ) ? $research['featureIds'] : array(),
						'researchedDataToolIds' => ( isset( $data_research ) && ! empty( $data_research['toolIds'] ) ) ? $data_research['toolIds'] : array(),
						'dataToolClassifierReason' => ( isset( $data_research['classifierReason'] ) && is_string( $data_research['classifierReason'] ) ) ? $data_research['classifierReason'] : '',
						'researchedDataBlock'   => ( isset( $data_research['block'] ) && is_string( $data_research['block'] ) ) ? self::truncate_debug_block( $data_research['block'] ) : '',
						'inventorySource'       => ( isset( $data_research['inventorySource'] ) && is_string( $data_research['inventorySource'] ) ) ? $data_research['inventorySource'] : '',
						'acfComplete'           => ! empty( $data_research['acfComplete'] ),
						'sliceTeam'             => ( isset( $data_research['sliceTeam'] ) && is_array( $data_research['sliceTeam'] ) ) ? $data_research['sliceTeam'] : array(),
						'leadAgentUsed'         => ! empty( $data_research['leadAgentUsed'] ),
						'intentSummary'         => ( isset( $data_research['intentSummary'] ) && is_string( $data_research['intentSummary'] ) ) ? $data_research['intentSummary'] : '',
						'researchArtifacts'     => ( isset( $data_research['researchArtifacts'] ) && is_array( $data_research['researchArtifacts'] ) ) ? $data_research['researchArtifacts'] : null,
					),
				),
			),
		);
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return array{0:int,1:array<string,mixed>}
	 */
	public static function assist( array $body ) {
		$key_err = self::prepare_openrouter_key( $body );
		if ( $key_err !== null ) {
			return array( 400, array( 'ok' => false, 'error' => $key_err ) );
		}

		$submode = self::normalize_submode( isset( $body['admin_submode'] ) ? (string) $body['admin_submode'] : 'build' );
		if ( $submode !== 'build' ) {
			Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
			return array( 400, array( 'ok' => false, 'error' => 'Use pulse-assist/stream for Ask and Plan.' ) );
		}

		$message = isset( $body['message'] ) ? sanitize_textarea_field( wp_unslash( (string) $body['message'] ) ) : '';
		$history = self::normalize_history( isset( $body['history'] ) && is_array( $body['history'] ) ? $body['history'] : array() );
		$user_id = self::current_user_id();

		$automation = Neo_Pulse_App_Pulse_Assist_Automation_Intent::match( $message, $body, 'build' );
		if ( is_array( $automation ) ) {
			Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
			return array( 200, Neo_Pulse_App_Pulse_Assist_Automation_Intent::dispatch_card( $automation ) );
		}

		$action  = Neo_Pulse_App_Pulse_Assist_Action_Orchestrator::run( $message, $history, $body, 'build', $user_id, null );
		Neo_Pulse_App_Chat_Openrouter::clear_request_api_key();
		if ( ! empty( $action['handled'] ) && is_array( $action['card'] ) ) {
			return array( 200, $action['card'] );
		}
		return array( 200, self::build_no_action_card() );
	}

	/**
	 * @return int
	 */
	private static function current_user_id(): int {
		$user = Neo_Pulse_App_Auth_Session::require_user();
		if ( ! is_array( $user ) ) {
			return 0;
		}
		return (int) ( $user['id'] ?? 0 );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function build_no_action_card() {
		return array(
			'type'           => 'prompt',
			'title'          => 'No build actions matched',
			'body'           => 'This Build request did not match a task action. Try Plan mode first, or phrase the request as creating or assigning team tasks.',
			'submode_switch' => 'plan',
			'confidence'     => 'medium',
			'relatedTopics'  => array(
				'Create tasks for a team member',
				'Switch to Plan mode',
			),
		);
	}

	/**
	 * @deprecated Use build_no_action_card()
	 * @return array<string,mixed>
	 */
	public static function build_stub_card() {
		return self::build_no_action_card();
	}

	/**
	 * @param array<string,mixed> $body Request body.
	 * @return string|null Error message when key missing.
	 */
	private static function prepare_openrouter_key( array $body ) {
		$api_key = Neo_Pulse_App_Chat_Openrouter::api_key_from_request( $body );
		if ( $api_key === '' ) {
			return 'OpenRouter API key is required. Add it in Dashboard → API Keys.';
		}
		Neo_Pulse_App_Chat_Openrouter::use_request_api_key( $api_key );
		return null;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @return array<string,mixed>
	 */
	private static function run_for_submode( string $submode, string $message, array $history, array $body, ?array $research = null, ?array $data_research = null ) {
		if ( $submode === 'plan' ) {
			return self::run_plan( $message, $history, $body, $research, $data_research );
		}
		return self::run_ask( $message, $history, $body, $research, $data_research );
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $research
	 * @return array<string,mixed>
	 */
	private static function run_ask( string $message, array $history, array $body, ?array $research = null, ?array $data_research = null ) {
		$card = self::llm_card(
			$message,
			$history,
			$body,
			'answer',
			self::ask_system_prompt( $body, $research, $data_research ),
			$research
		);
		if ( ! isset( $card['type'] ) ) {
			$card['type'] = 'answer';
		}
		return $card;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $research
	 * @return array<string,mixed>
	 */
	private static function run_plan( string $message, array $history, array $body, ?array $research = null, ?array $data_research = null ) {
		$card = self::llm_card(
			$message,
			$history,
			$body,
			'plan',
			self::plan_system_prompt( $body, $research, $data_research ),
			$research
		);
		$card['type'] = 'plan';
		if ( empty( $card['title'] ) ) {
			$card['title'] = 'Plan preview';
		}
		$card['body'] = ( isset( $card['body'] ) ? (string) $card['body'] : '' ) . "\n\nThis is a read-only preview. Switch to Build when write actions are available.";
		return $card;
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @param array<string,mixed>|null       $research
	 * @return array<string,mixed>
	 */
	private static function llm_card( string $message, array $history, array $body, string $default_type, string $system_prompt, ?array $research = null ) {
		$messages = self::chat_messages( $system_prompt, $history, $message );
		$raw      = Neo_Pulse_App_Chat_Openrouter::chat_text(
			$messages,
			array(
				'temperature' => 0.35,
				'maxTokens'   => 1400,
			)
		);

		if ( $raw === '' ) {
			return self::error_card( 'OpenRouter did not return a response. Check your API key and try again.' );
		}

		$parsed = self::parse_json_card( $raw );
		if ( ! is_array( $parsed ) ) {
			$fallback_body = self::strip_brand_preamble( $raw );
			if ( trim( $fallback_body ) === '' ) {
				return self::error_card( 'Assist returned an unreadable response. Try asking again.' );
			}
			return array(
				'type'          => $default_type,
				'title'         => '',
				'body'          => $fallback_body,
				'confidence'    => 'medium',
				'relatedTopics' => array(),
			);
		}

		$title     = isset( $parsed['title'] ) ? sanitize_text_field( (string) $parsed['title'] ) : '';
		$body_text = isset( $parsed['body'] ) ? self::sanitize_assist_body( (string) $parsed['body'] ) : '';
		if ( $body_text === '' && isset( $parsed['answer'] ) ) {
			$body_text = self::sanitize_assist_body( (string) $parsed['answer'] );
		}
		$body_text = self::strip_brand_preamble( $body_text );
		$title     = self::sanitize_card_title( $title );

		$card = array(
			'type'          => isset( $parsed['type'] ) ? sanitize_key( (string) $parsed['type'] ) : $default_type,
			'title'         => $title,
			'body'          => $body_text,
			'confidence'    => 'medium',
			'relatedTopics' => self::sanitize_topics( isset( $parsed['relatedTopics'] ) ? $parsed['relatedTopics'] : array() ),
		);
		if ( isset( $parsed['links'] ) && is_array( $parsed['links'] ) ) {
			$card['links'] = self::sanitize_links( $parsed['links'] );
		}
		$card = self::normalize_card_structured_fields( $card );
		$card = self::finalize_card( $card, $message, $body, $research );
		if ( trim( (string) ( $card['body'] ?? '' ) ) === '' ) {
			return self::error_card( 'Assist did not return an answer body. Try asking again.' );
		}
		return $card;
	}

	private static function sanitize_assist_body( string $body ): string {
		$body = wp_check_invalid_utf8( $body );
		return trim( $body );
	}

	private static function truncate_debug_block( string $block ): string {
		$block = trim( $block );
		if ( $block === '' ) {
			return '';
		}
		if ( strlen( $block ) <= 1200 ) {
			return $block;
		}
		return substr( $block, 0, 1200 ) . '…';
	}

	private static function sanitize_card_title( string $title ): string {
		$t = trim( $title );
		if ( $t === '' ) {
			return '';
		}
		$plain = strtolower( preg_replace( '/[#*_`\[\]()]/', '', $t ) );
		if ( str_contains( $plain, 'neo pulse assist' ) ) {
			return '';
		}
		return $t;
	}

	private static function strip_brand_preamble( string $body ): string {
		$prev = '';
		while ( $prev !== $body ) {
			$prev = $body;
			$body = self::strip_brand_preamble_once( $body );
		}
		return $body;
	}

	private static function strip_brand_preamble_once( string $body ): string {
		$lines = preg_split( '/\r\n|\r|\n/', $body );
		if ( ! is_array( $lines ) ) {
			return $body;
		}
		while ( count( $lines ) > 0 ) {
			$line = trim( (string) $lines[0] );
			if ( $line === '' ) {
				array_shift( $lines );
				continue;
			}
			$plain = trim( preg_replace( '/[#*_`\[\]()]/', '', $line ) );
			if ( stripos( $plain, 'NEO Pulse Assist' ) !== false && strlen( $plain ) < 100 ) {
				array_shift( $lines );
				continue;
			}
			break;
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param mixed $links
	 * @return array<int,array<string,mixed>>
	 */
	private static function sanitize_links( $links ) {
		if ( ! is_array( $links ) ) {
			return array();
		}
		$out = array();
		foreach ( $links as $link ) {
			if ( ! is_array( $link ) ) {
				continue;
			}
			$row = array();
			if ( ! empty( $link['label'] ) && is_scalar( $link['label'] ) ) {
				$row['label'] = sanitize_text_field( (string) $link['label'] );
			}
			if ( ! empty( $link['url'] ) && is_scalar( $link['url'] ) ) {
				$url = (string) $link['url'];
				if ( preg_match( '/^pulse:nav\//', $url ) || preg_match( '/^#/', $url ) ) {
					$row['url'] = sanitize_text_field( $url );
				} elseif ( preg_match( '/^https?:\/\//i', $url ) ) {
					$row['url'] = esc_url_raw( $url );
				}
			}
			if ( ! empty( $link['action'] ) && is_scalar( $link['action'] ) ) {
				$row['action'] = sanitize_key( (string) $link['action'] );
			}
			if ( ! empty( $row['label'] ) || ! empty( $row['url'] ) ) {
				$out[] = $row;
			}
			if ( count( $out ) >= 4 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @param mixed $raw
	 * @return array<string,mixed>|null
	 */
	private static function parse_json_card( $raw ) {
		$text = trim( (string) $raw );
		if ( $text === '' ) {
			return null;
		}
		if ( preg_match( '/```(?:json)?\s*([\s\S]*?)```/i', $text, $m ) ) {
			$text = trim( $m[1] );
		}
		$decoded = json_decode( $text, true );
		if ( is_array( $decoded ) ) {
			return $decoded;
		}
		$start = strpos( $text, '{' );
		$end   = strrpos( $text, '}' );
		if ( $start !== false && $end !== false && $end > $start ) {
			$decoded = json_decode( substr( $text, $start, $end - $start + 1 ), true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		return null;
	}

	private static function certainty_rules(): string {
		return implode(
			"\n",
			array(
				'Tone and certainty:',
				'- You know the NEO Pulse manager UI exactly. Give direct instructions with exact tab names, toolbar labels, and flyout items.',
				'- Do not hedge: never use might, maybe, perhaps, could be, similar to, or "or similar".',
				'- State product behavior as fact. Do not guess alternate button names.',
				'- If a connected integration site is required, say so directly (Integrations → select an enabled property).',
			)
		);
	}

	private static function minimal_global_ui_rules(): string {
		return implode(
			"\n",
			array(
				'Global NEO Pulse rules:',
				'- **Overview** = Generator → Opt (`pulse:nav/generator/opt` or `#generator`), not a top-level tab.',
				'- **Dashboard / Settings** tab uses hash `#settings`, not `#dashboard`.',
				'- Assist sidebar: **Page** vs **Site** scope; **Ask** / **Plan** / **Build** submode pill in the composer.',
				'- Bulk meta on Overview: **AISEO** flyout → **Meta** → **All Meta** or **MD**; flyouts cannot be deep-linked (use **bold** labels).',
				'- OpenRouter key: [Dashboard → API Keys](pulse:nav/dashboard/api-keys).',
			)
		);
	}

	private static function markdown_format_rules(): string {
		return implode(
			"\n",
			array(
				'Format the body field as readable Markdown:',
				'- Use ## section headings with blank lines before and after each section.',
				'- Never pack multiple data items (keywords, queries, posts, grades) into long paragraphs. Use structure instead.',
				'- For 3+ items with metrics (GSC queries, rankings, comparisons), use a markdown table or a bullet list with one item per line.',
				'- Use numbered lists (1. 2. 3.) for step-by-step instructions; one action per step.',
				'- Use bullet lists for options, tips, feature lists, and keyword/query breakdowns.',
				'- Use Markdown tables when comparing items or listing fields (| Column | Column |).',
				'- Keep the intro to 1-2 short sentences, then ## sections with lists or tables. No wall-of-text answers.',
				'- Put a blank line between paragraphs, lists, and sections.',
				'- Bold **UI labels** for tabs, buttons, pills, and fields the user clicks in NEO Pulse.',
				'- Bold **GSC queries**, **keywords**, **post titles**, and **entity names** without wrapping them in quotation marks. Never write "term" or \'term\' for emphasis; use **term** instead.',
				'- For external site pages or posts, link the title only: [Page title](https://...). Never repeat the raw URL on its own line or in parentheses.',
				'- When Researched data includes a Blog performers (GSC) table, reproduce that table as the main answer body section.',
				'- Do not put "NEO Pulse Assist" in title or at the start of body. Title = short topic headline or empty. Body starts with the first sentence of the answer.',
				'- body is required on every response. Never return an empty body.',
			)
		);
	}

	private static function navigation_link_rules(): string {
		return implode(
			"\n",
			array(
				'In-app navigation links:',
				'- Prefer pulseNav and hash links from the researched module docs above.',
				'- Valid href forms: `pulse:nav/users`, `pulse:nav/generator/opt`, `#users`, `#chat`, `#settings`.',
				'- Use markdown `[Teams → Users](pulse:nav/users)` or `[Teams → Users](#users)` inside numbered steps.',
				'- Every app module you name as a destination MUST include a markdown link in body AND a matching links array entry with pulseNav from the researched module doc.',
				'- If you tell the user to open Chat, Users, Integrations, Overview, or any other module, link it. Never describe a destination without a clickable link.',
				'- Never say "open Overview" when the destination is Chat, Users, Integrations, or another specific module.',
				'- Flyouts (AISEO bulk menus) cannot be deep-linked; use **bold** for those labels.',
				'- When a primary destination helps the user, add a links array entry: {"label":"Teams → Users","url":"pulse:nav/users","action":"navigate"}.',
				'- links array: include only destinations you tell the user to open in this answer (usually one). Do not add Chat, Overview/Opt, or other modules unless the body directs the user there.',
			)
		);
	}

	private static function followup_topic_rules(): string {
		return implode(
			"\n",
			array(
				'Follow-up chips (relatedTopics):',
				'- Exactly 3 short questions copied from researched feature playbook question fields for sibling features in the same module(s).',
				'- Do not repeat the user\'s current question.',
				'- Write plain questions without quotation marks around keywords or queries.',
				'- Do not use generic chips like "What can I do on this tab?", "What property am I working on?", or "Explain Page vs Site scope".',
			)
		);
	}

	private static function feature_playbook_rules(): string {
		return implode(
			"\n",
			array(
				'Feature playbook rules:',
				'- Use playbook numbered steps only for the specific feature the user asked about.',
				'- For general questions (e.g. "Is there a chat feature?", "Can I chat with users?"), answer from module docs. Do not lead with unrelated playbook steps.',
				'- Never dump multiple feature playbooks into the answer unless the user asked about each one.',
				'- When a playbook applies, use its numbered steps with exact UI labels. Do not invent steps.',
				'- body is required. Never return an empty body.',
			)
		);
	}

	/**
	 * @param array<string,mixed>      $card
	 * @param array<string,mixed>      $body
	 * @param array<string,mixed>|null $research
	 * @return array<string,mixed>
	 */
	private static function finalize_card( array $card, string $message, array $body, ?array $research ): array {
		if ( trim( (string) ( $card['body'] ?? '' ) ) === '' ) {
			return $card;
		}
		$card = self::ensure_destination_links( $card, $research );
		$card = self::ensure_topic_followups( $card, $message, $research );
		if ( ! empty( $card['body'] ) ) {
			$card['body'] = self::normalize_assist_display_markdown( (string) $card['body'] );
		}
		if ( ! empty( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ) {
			$card['relatedTopics'] = self::normalize_assist_related_topics( $card['relatedTopics'] );
		}
		if ( ! empty( $card['suggested_actions'] ) && is_array( $card['suggested_actions'] ) ) {
			$card['suggested_actions'] = self::normalize_assist_related_topics( $card['suggested_actions'] );
		}
		return $card;
	}

	private static function normalize_assist_display_markdown( string $body ): string {
		if ( $body === '' ) {
			return '';
		}
		$normalized = preg_replace( '/\*\*"([^"]+)"\*\*/', '**$1**', $body );
		$normalized = is_string( $normalized ) ? $normalized : $body;
		$normalized = preg_replace( "/\\*\\*'([^']+)'\\*\\*/", '**$1**', $normalized );
		$normalized = is_string( $normalized ) ? $normalized : $body;
		$normalized = self::sanitize_assist_markdown_links( $normalized );
		return is_string( $normalized ) ? $normalized : $body;
	}

	private static function sanitize_assist_markdown_links( string $body ): string {
		return preg_replace_callback(
			'/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/',
			static function ( array $matches ): string {
				$label = trim( (string) ( $matches[1] ?? '' ) );
				$url   = trim( (string) ( $matches[2] ?? '' ) );
				if ( $label === '' || $url === '' ) {
					return $matches[0];
				}
				$suffix = ' (' . $url . ')';
				if ( str_ends_with( $label, $suffix ) ) {
					$label = substr( $label, 0, -strlen( $suffix ) );
				}
				return '[' . $label . '](' . $url . ')';
			},
			$body
		) ?? $body;
	}

	/**
	 * @param array<int,mixed> $topics
	 * @return array<int,string>
	 */
	private static function normalize_assist_related_topics( array $topics ): array {
		$out = array();
		foreach ( $topics as $topic ) {
			if ( ! is_string( $topic ) ) {
				continue;
			}
			$label = trim( $topic );
			if ( $label === '' ) {
				continue;
			}
			$label = preg_replace( '/\s+for\s+"([^"]+)"(\?)?/i', ' for $1$2', $label );
			$label = is_string( $label ) ? $label : trim( $topic );
			$label = preg_replace( "/\s+for\s+'([^']+)'(\?)?/i", ' for $1$2', $label );
			$label = is_string( $label ) ? $label : trim( $topic );
			$label = preg_replace( '/"([^"]+)"/', '$1', $label );
			$label = is_string( $label ) ? $label : trim( $topic );
			$label = preg_replace( "/'([^']+)'/", '$1', $label );
			$label = is_string( $label ) ? trim( $label ) : trim( $topic );
			if ( $label !== '' ) {
				$out[] = $label;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $card
	 * @return array<string,mixed>
	 */
	private static function normalize_card_structured_fields( array $card ): array {
		$body = (string) ( $card['body'] ?? '' );
		if ( $body === '' ) {
			return $card;
		}

		$lines = preg_split( '/\r\n|\r|\n/', $body );
		if ( ! is_array( $lines ) ) {
			return $card;
		}

		$leak_start = null;
		foreach ( $lines as $i => $line ) {
			$trim = trim( (string) $line );
			if ( preg_match( '/^relatedTopics:\s*$/i', $trim ) || preg_match( '/^links:\s*$/i', $trim ) ) {
				$leak_start = $i;
				break;
			}
		}

		if ( $leak_start === null ) {
			return $card;
		}

		$leak_lines       = array_slice( $lines, $leak_start );
		$recovered_topics = array();
		$recovered_links  = array();
		$section          = '';

		foreach ( $leak_lines as $line ) {
			$trim = trim( (string) $line );
			if ( preg_match( '/^relatedTopics:\s*$/i', $trim ) ) {
				$section = 'topics';
				continue;
			}
			if ( preg_match( '/^links:\s*$/i', $trim ) ) {
				$section = 'links';
				continue;
			}
			if ( $section === 'topics' && preg_match( '/^-\s*(.+)$/', $trim, $m ) ) {
				$topic = trim( (string) $m[1] );
				if ( preg_match( '/^(.+?)\s+links:\s*$/i', $topic, $tm ) ) {
					$topic   = trim( (string) $tm[1] );
					$section = 'links';
				}
				if ( $topic !== '' && $topic[0] !== '{' ) {
					$recovered_topics[] = $topic;
				}
				continue;
			}
			if ( $section === 'links' && preg_match( '/^-\s*(\{.+)$/', $trim, $m ) ) {
				$decoded = json_decode( (string) $m[1], true );
				if ( is_array( $decoded ) ) {
					$recovered_links[] = $decoded;
				}
			}
		}

		$card['body'] = trim( implode( "\n", array_slice( $lines, 0, $leak_start ) ) );

		$existing_topics = isset( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ? $card['relatedTopics'] : array();
		if ( count( $existing_topics ) === 0 && count( $recovered_topics ) > 0 ) {
			$card['relatedTopics'] = self::sanitize_topics( $recovered_topics );
		}

		if ( count( $recovered_links ) > 0 ) {
			$existing_links = isset( $card['links'] ) && is_array( $card['links'] ) ? $card['links'] : array();
			$card['links']  = self::sanitize_links( array_merge( $existing_links, $recovered_links ) );
		}

		return $card;
	}

	/**
	 * @param array<int,array<string,mixed>>   $links
	 * @param array<string,mixed>|null         $research
	 * @return array<int,array<string,mixed>>
	 */
	private static function filter_links_to_scope( array $links, string $body_text, ?array $research ): array {
		if ( count( $links ) === 0 ) {
			return array();
		}

		$primary_modules = array();
		if ( $research !== null && ! empty( $research['primaryModules'] ) && is_array( $research['primaryModules'] ) ) {
			$primary_modules = $research['primaryModules'];
		}

		$allowed_nav = array();
		foreach ( $primary_modules as $mod ) {
			if ( ! is_array( $mod ) || empty( $mod['pulseNav'] ) ) {
				continue;
			}
			$allowed_nav[ (string) $mod['pulseNav'] ] = $mod;
		}

		$body_lower = strtolower( $body_text );
		$filtered   = array();
		foreach ( $links as $link ) {
			if ( ! is_array( $link ) || empty( $link['url'] ) ) {
				continue;
			}
			$url         = (string) $link['url'];
			$in_body_md  = str_contains( $body_text, '](' . $url . ')' );
			$mod         = isset( $allowed_nav[ $url ] ) ? $allowed_nav[ $url ] : null;
			$path        = is_array( $mod ) && ! empty( $mod['menuPath'] ) ? (string) $mod['menuPath'] : '';
			$label       = is_array( $mod ) && ! empty( $mod['label'] ) ? (string) $mod['label'] : '';
			$mentioned   = $in_body_md
				|| ( $path !== '' && str_contains( $body_lower, strtolower( $path ) ) )
				|| ( $label !== '' && str_contains( $body_lower, strtolower( $label ) ) );

			if ( $mod !== null && $mentioned ) {
				$filtered[] = $link;
				continue;
			}
			if ( $mod === null && $in_body_md ) {
				$filtered[] = $link;
			}
		}

		return array_slice( self::sanitize_links( $filtered ), 0, 2 );
	}

	/**
	 * @param array<string,mixed>      $card
	 * @param array<string,mixed>|null $research
	 * @return array<string,mixed>
	 */
	private static function ensure_destination_links( array $card, ?array $research ): array {
		$links     = isset( $card['links'] ) && is_array( $card['links'] ) ? $card['links'] : array();
		$seen      = array();
		$body_text = (string) ( $card['body'] ?? '' );

		foreach ( $links as $link ) {
			if ( ! empty( $link['url'] ) ) {
				$seen[ (string) $link['url'] ] = true;
			}
		}

		if ( preg_match_all( '/\[([^\]]+)\]\((pulse:nav\/[^)]+)\)/', $body_text, $md_matches, PREG_SET_ORDER ) ) {
			foreach ( $md_matches as $m ) {
				$url = (string) $m[2];
				if ( isset( $seen[ $url ] ) ) {
					continue;
				}
				$links[] = array(
					'label'  => (string) $m[1],
					'url'    => $url,
					'action' => 'navigate',
				);
				$seen[ $url ] = true;
			}
		}

		if ( $research !== null && ! empty( $research['primaryModules'] ) && is_array( $research['primaryModules'] ) ) {
			$modules    = $research['primaryModules'];
			$body_lower = strtolower( $body_text );

			foreach ( $modules as $mod ) {
				if ( ! is_array( $mod ) ) {
					continue;
				}
				$path  = isset( $mod['menuPath'] ) ? (string) $mod['menuPath'] : '';
				$nav   = isset( $mod['pulseNav'] ) ? (string) $mod['pulseNav'] : '';
				$label = isset( $mod['label'] ) ? (string) $mod['label'] : '';
				if ( $nav === '' ) {
					continue;
				}

				$mentioned = ( $path !== '' && str_contains( $body_lower, strtolower( $path ) ) )
					|| ( $label !== '' && str_contains( $body_lower, strtolower( $label ) ) );

				if ( $mentioned && ! isset( $seen[ $nav ] ) ) {
					$links[] = array(
						'label'  => $path !== '' ? $path : $label,
						'url'    => $nav,
						'action' => 'navigate',
					);
					$seen[ $nav ] = true;
				}
			}

			$body_text = self::inject_module_links_in_body( $body_text, $modules );
		}

		$links = self::filter_links_to_scope( $links, $body_text, $research );

		if ( count( $links ) > 0 ) {
			$card['links'] = $links;
		} else {
			unset( $card['links'] );
		}

		$card['body'] = $body_text;
		return $card;
	}

	/**
	 * @param array<int,array<string,mixed>> $modules
	 */
	private static function inject_module_links_in_body( string $body, array $modules ): string {
		foreach ( $modules as $mod ) {
			if ( ! is_array( $mod ) ) {
				continue;
			}
			$path = isset( $mod['menuPath'] ) ? (string) $mod['menuPath'] : '';
			$nav  = isset( $mod['pulseNav'] ) ? (string) $mod['pulseNav'] : '';
			$hash = isset( $mod['hash'] ) ? (string) $mod['hash'] : '';
			if ( $path === '' || $nav === '' ) {
				continue;
			}
			if ( str_contains( $body, '](' . $nav . ')' ) || ( $hash !== '' && str_contains( $body, '](' . $hash . ')' ) ) ) {
				continue;
			}

			$linked = '[' . $path . '](' . $nav . ')';
			$bold   = '**' . $path . '**';
			if ( str_contains( $body, $bold ) ) {
				$replaced = preg_replace( '/\*\*' . preg_quote( $path, '/' ) . '\*\*/', $linked, $body, 1 );
				$body     = is_string( $replaced ) ? $replaced : $body;
				continue;
			}
			if ( str_contains( $body, $path ) ) {
				$replaced = preg_replace( '/' . preg_quote( $path, '/' ) . '/', $linked, $body, 1 );
				$body     = is_string( $replaced ) ? $replaced : $body;
			}
		}
		return $body;
	}

	/**
	 * @param array<string,mixed>      $card
	 * @param array<string,mixed>|null $research
	 * @return array<string,mixed>
	 */
	private static function ensure_topic_followups( array $card, string $message, ?array $research ): array {
		$topics = isset( $card['relatedTopics'] ) && is_array( $card['relatedTopics'] ) ? $card['relatedTopics'] : array();
		if ( self::followups_are_generic( $topics ) && $research !== null ) {
			$generated = self::followups_from_playbooks( $research, $message );
			if ( count( $generated ) > 0 ) {
				$card['relatedTopics'] = $generated;
			}
		}
		return $card;
	}

	/**
	 * @param array<int,string> $topics
	 */
	private static function followups_are_generic( array $topics ): bool {
		if ( count( $topics ) === 0 ) {
			return true;
		}
		$generic = self::generic_followup_topics();
		$hits    = 0;
		foreach ( $topics as $topic ) {
			foreach ( $generic as $g ) {
				if ( strcasecmp( trim( (string) $topic ), trim( $g ) ) === 0 ) {
					++$hits;
					break;
				}
			}
		}
		return $hits >= 2 || $hits === count( $topics );
	}

	/**
	 * @return array<int,string>
	 */
	private static function generic_followup_topics(): array {
		return array(
			'What can I do on this tab?',
			'What property am I working on?',
			'Explain Page vs Site scope',
		);
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,string>
	 */
	private static function followups_from_playbooks( array $research, string $user_message ): array {
		$msg_lower  = strtolower( trim( $user_message ) );
		$candidates = array();
		$seen       = array();

		if ( ! empty( $research['features'] ) && is_array( $research['features'] ) ) {
			foreach ( $research['features'] as $feat ) {
				if ( ! is_array( $feat ) || empty( $feat['moduleId'] ) ) {
					continue;
				}
				foreach ( Neo_Pulse_App_Pulse_Assist_Module_Catalog::playbooks_for_module( (string) $feat['moduleId'] ) as $pb ) {
					$id = isset( $pb['id'] ) ? (string) $pb['id'] : '';
					if ( $id !== '' && ! isset( $seen[ $id ] ) ) {
						$candidates[] = $pb;
						$seen[ $id ]  = true;
					}
				}
			}
		}

		if ( ! empty( $research['primaryModuleIds'] ) && is_array( $research['primaryModuleIds'] ) ) {
			foreach ( $research['primaryModuleIds'] as $module_id ) {
				foreach ( Neo_Pulse_App_Pulse_Assist_Module_Catalog::playbooks_for_module( (string) $module_id ) as $pb ) {
					$id = isset( $pb['id'] ) ? (string) $pb['id'] : '';
					if ( $id !== '' && ! isset( $seen[ $id ] ) ) {
						$candidates[] = $pb;
						$seen[ $id ]  = true;
					}
				}
			}
		}

		$topics = array();
		foreach ( $candidates as $pb ) {
			$q = isset( $pb['question'] ) ? trim( (string) $pb['question'] ) : '';
			if ( $q === '' ) {
				continue;
			}
			if ( strcasecmp( $q, trim( $user_message ) ) === 0 ) {
				continue;
			}
			if ( str_contains( $msg_lower, strtolower( $q ) ) ) {
				continue;
			}
			$topics[] = $q;
			if ( count( $topics ) >= 3 ) {
				break;
			}
		}

		return array_slice( array_values( array_unique( $topics ) ), 0, 3 );
	}

	/**
	 * @param array<int,array<string,mixed>> $history
	 * @param array<string,mixed>            $body
	 * @return array{block:string,label:string,moduleIds:array<int,string>,primaryModuleIds:array<int,string>,featureIds:array<int,string>,modules:array<int,array<string,mixed>>,primaryModules:array<int,array<string,mixed>>,features:array<int,array<string,mixed>>}
	 */
	private static function research_modules_for_message( string $message, array $history, array $body ): array {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();

		$module_queries = array();

		$current = Neo_Pulse_App_Pulse_Assist_Module_Catalog::current_module_id_from_context( $pulse );
		if ( $current !== null && $current !== '' ) {
			$module_queries[] = $current;
		}

		$classify = self::classify_research_targets( $message, $pulse );
		foreach ( $classify['moduleIds'] as $id ) {
			$module_queries[] = $id;
		}

		$features = Neo_Pulse_App_Pulse_Assist_Module_Catalog::lookup_features( array( $message ), 2 );
		$seen_feat = array();
		foreach ( $features as $feat ) {
			if ( ! empty( $feat['id'] ) ) {
				$seen_feat[ (string) $feat['id'] ] = true;
			}
		}
		foreach ( $classify['featureIds'] as $id ) {
			$feat = Neo_Pulse_App_Pulse_Assist_Module_Catalog::feature_by_id( (string) $id );
			if ( $feat === null || empty( $feat['id'] ) ) {
				continue;
			}
			$fid = (string) $feat['id'];
			if ( isset( $seen_feat[ $fid ] ) ) {
				continue;
			}
			$features[]       = $feat;
			$seen_feat[ $fid ] = true;
		}
		foreach ( $features as $feat ) {
			if ( ! empty( $feat['moduleId'] ) ) {
				$module_queries[] = (string) $feat['moduleId'];
			}
		}

		$modules  = Neo_Pulse_App_Pulse_Assist_Module_Catalog::lookup_modules( $module_queries );
		$expanded = self::expand_related_modules( $modules, 6 );

		if ( count( $features ) > 4 ) {
			$features = array_slice( $features, 0, 4 );
		}

		$labels = array();
		foreach ( array_slice( $features, 0, 2 ) as $feat ) {
			if ( ! empty( $feat['label'] ) ) {
				$labels[] = (string) $feat['label'];
			}
		}
		if ( count( $labels ) === 0 ) {
			foreach ( array_slice( $expanded, 0, 3 ) as $mod ) {
				if ( ! empty( $mod['label'] ) ) {
					$labels[] = (string) $mod['label'];
				}
			}
		}

		$primary_module_ids = array();
		foreach ( $modules as $mod ) {
			if ( ! empty( $mod['id'] ) ) {
				$primary_module_ids[] = (string) $mod['id'];
			}
		}

		$module_ids = array();
		foreach ( $expanded as $mod ) {
			if ( ! empty( $mod['id'] ) ) {
				$module_ids[] = (string) $mod['id'];
			}
		}

		$feature_ids = array();
		foreach ( $features as $feat ) {
			if ( ! empty( $feat['id'] ) ) {
				$feature_ids[] = (string) $feat['id'];
			}
		}

		$block = Neo_Pulse_App_Pulse_Assist_Module_Catalog::format_modules_block( $expanded );
		$feat_block = Neo_Pulse_App_Pulse_Assist_Module_Catalog::format_features_block( $features );
		if ( $feat_block !== '' ) {
			$block = trim( $block . "\n\n" . $feat_block );
		}

		return array(
			'block'             => $block,
			'label'             => count( $labels ) > 0 ? implode( ', ', $labels ) : 'app modules',
			'moduleIds'         => $module_ids,
			'primaryModuleIds'  => $primary_module_ids,
			'featureIds'        => $feature_ids,
			'modules'           => $expanded,
			'primaryModules'    => $modules,
			'features'          => $features,
		);
	}

	/**
	 * @param array<string,mixed> $pulse
	 * @return array{moduleIds:array<int,string>,featureIds:array<int,string>}
	 */
	private static function classify_research_targets( string $message, array $pulse ): array {
		$module_ids  = array();
		$feature_ids = array();

		foreach ( Neo_Pulse_App_Pulse_Assist_Module_Catalog::all_modules() as $mod ) {
			if ( ! empty( $mod['id'] ) ) {
				$module_ids[] = (string) $mod['id'];
			}
		}
		foreach ( Neo_Pulse_App_Pulse_Assist_Module_Catalog::all_feature_playbooks() as $feat ) {
			if ( ! empty( $feat['id'] ) ) {
				$feature_ids[] = (string) $feat['id'];
			}
		}

		if ( count( $module_ids ) === 0 && count( $feature_ids ) === 0 ) {
			return array(
				'moduleIds'  => array(),
				'featureIds' => array(),
			);
		}

		$location = ! empty( $pulse['locationSummary'] ) ? sanitize_text_field( (string) $pulse['locationSummary'] ) : '';
		$system   = 'Return JSON only: {"moduleIds":["id1"],"featureIds":["chat/create-channel"],"reason":"brief"}. Pick 1-4 module ids. Use featureIds only when the user asks how to do one specific feature (e.g. create a channel). For general module questions (e.g. "Is there chat?", "Can I chat with users?"), use moduleIds only and leave featureIds empty.';
		$user     = 'Module ids: ' . implode( ', ', $module_ids ) . "\nFeature ids: " . implode( ', ', $feature_ids ) . "\nCurrent location: " . $location . "\nUser message: " . $message;

		$raw = Neo_Pulse_App_Chat_Openrouter::chat_text(
			array(
				array(
					'role'    => 'system',
					'content' => $system,
				),
				array(
					'role'    => 'user',
					'content' => $user,
				),
			),
			array(
				'temperature' => 0.1,
				'maxTokens'   => 280,
			)
		);

		$parsed = self::parse_json_card( $raw );
		if ( ! is_array( $parsed ) ) {
			return array(
				'moduleIds'  => array(),
				'featureIds' => array(),
			);
		}

		$out_modules = array();
		if ( ! empty( $parsed['moduleIds'] ) && is_array( $parsed['moduleIds'] ) ) {
			foreach ( $parsed['moduleIds'] as $id ) {
				if ( ! is_scalar( $id ) ) {
					continue;
				}
				$out_modules[] = sanitize_text_field( (string) $id );
				if ( count( $out_modules ) >= 4 ) {
					break;
				}
			}
		}

		$out_features = array();
		if ( ! empty( $parsed['featureIds'] ) && is_array( $parsed['featureIds'] ) ) {
			foreach ( $parsed['featureIds'] as $id ) {
				if ( ! is_scalar( $id ) ) {
					continue;
				}
				$out_features[] = sanitize_text_field( (string) $id );
				if ( count( $out_features ) >= 4 ) {
					break;
				}
			}
		}

		return array(
			'moduleIds'  => $out_modules,
			'featureIds' => $out_features,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $modules
	 * @return array<int,array<string,mixed>>
	 */
	private static function expand_related_modules( array $modules, int $cap ): array {
		$expanded = $modules;
		$seen     = array();
		foreach ( $modules as $mod ) {
			if ( ! empty( $mod['id'] ) ) {
				$seen[ (string) $mod['id'] ] = true;
			}
		}
		foreach ( $modules as $mod ) {
			if ( empty( $mod['relatedModules'] ) || ! is_array( $mod['relatedModules'] ) ) {
				continue;
			}
			foreach ( $mod['relatedModules'] as $rel ) {
				if ( count( $expanded ) >= $cap ) {
					return $expanded;
				}
				$rel_id = is_scalar( $rel ) ? (string) $rel : '';
				if ( $rel_id === '' || isset( $seen[ $rel_id ] ) ) {
					continue;
				}
				$rel_mod = Neo_Pulse_App_Pulse_Assist_Module_Catalog::module_by_id( $rel_id );
				if ( $rel_mod ) {
					$expanded[]       = $rel_mod;
					$seen[ $rel_id ] = true;
				}
			}
		}
		return $expanded;
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function properties_context_block( array $body ): string {
		$ctx = isset( $body['properties_context'] ) && is_array( $body['properties_context'] ) ? $body['properties_context'] : null;
		if ( ! $ctx ) {
			return '';
		}

		$count = isset( $ctx['count'] ) ? (int) $ctx['count'] : 0;
		$lines = array(
			'Connected client roster (client = each WordPress property saved under Dashboard → Properties):',
			'- Total connected clients: ' . $count,
			'- This count is the full Properties list, not the header active property alone.',
		);

		if ( ! empty( $ctx['activePropertyId'] ) && is_scalar( $ctx['activePropertyId'] ) ) {
			$lines[] = '- Header active property id (one selected workspace): ' . sanitize_text_field( (string) $ctx['activePropertyId'] );
		}

		$props = isset( $ctx['properties'] ) && is_array( $ctx['properties'] ) ? $ctx['properties'] : array();
		$names = array();
		foreach ( $props as $p ) {
			if ( ! is_array( $p ) ) {
				continue;
			}
			$name = isset( $p['name'] ) ? sanitize_text_field( (string) $p['name'] ) : '';
			$id   = isset( $p['id'] ) ? sanitize_text_field( (string) $p['id'] ) : '';
			$url  = isset( $p['siteUrl'] ) ? esc_url_raw( (string) $p['siteUrl'] ) : '';
			$enabled = ! isset( $p['enabled'] ) || $p['enabled'];
			if ( $name === '' ) {
				continue;
			}
			$names[] = $name;
			$line = '- ' . $name;
			if ( $id !== '' ) {
				$line .= ' (id: ' . $id . ')';
			}
			if ( ! $enabled ) {
				$line .= ' [disabled]';
			}
			if ( $url !== '' ) {
				$line .= ' — ' . $url;
			}
			$lines[] = $line;
		}

		if ( count( $names ) > 0 ) {
			$lines[] = '- Client names: ' . implode( ', ', $names );
		}

		$lines[] = 'When the user asks how many clients or properties they have, answer using Total connected clients and list every name in Client names. Never answer 1 because only one property is active in the header.';
		$lines[] = 'Never say you cannot access client information when this roster is present.';
		if ( $count === 0 ) {
			$lines[] = 'Zero properties: tell them to add one via [Dashboard → Properties](pulse:nav/dashboard/properties).';
		}

		return implode( "\n", $lines );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function pulse_assigned_tasks_block( array $body ): string {
		$ctx   = isset( $body['team_context'] ) && is_array( $body['team_context'] ) ? $body['team_context'] : array();
		$tasks = isset( $ctx['pulseAssignedTasks'] ) && is_array( $ctx['pulseAssignedTasks'] ) ? $ctx['pulseAssignedTasks'] : array();
		if ( count( $tasks ) === 0 ) {
			return '';
		}

		$today = gmdate( 'Y-m-d' );
		$lines = array(
			'Tasks assigned to Pulse AI. Use executions_start in Build when the user asks to run a task. executions_get and executions_list_for_task poll job status:',
		);
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$title = sanitize_text_field( (string) ( $task['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			$due        = sanitize_text_field( (string) ( $task['dueDate'] ?? '' ) );
			$due_day    = $due !== '' ? substr( $due, 0, 10 ) : '';
			$recurrence = sanitize_key( (string) ( $task['recurrenceRule'] ?? 'none' ) );
			$status     = sanitize_key( (string) ( $task['status'] ?? 'todo' ) );
			$project    = sanitize_text_field( (string) ( $task['projectTitle'] ?? '' ) );
			$client     = sanitize_text_field( (string) ( $task['wordpressSiteId'] ?? '' ) );
			$exec_kind  = sanitize_key( (string) ( $task['executionKind'] ?? '' ) );
			$exec_status = sanitize_key( (string) ( $task['lastExecutionStatus'] ?? '' ) );
			$line       = '- ' . $title;
			if ( ! empty( $task['id'] ) ) {
				$line .= ' (taskId ' . (int) $task['id'] . ')';
			}
			if ( $project !== '' ) {
				$line .= ' (' . $project . ')';
			}
			if ( $status !== '' && $status !== 'todo' ) {
				$line .= ' [' . $status . ']';
			}
			if ( $due_day !== '' ) {
				$line .= ' due ' . $due_day;
				if ( $due_day < $today ) {
					$line .= ' (overdue)';
				} elseif ( $due_day === $today ) {
					$line .= ' (today)';
				}
			}
			if ( $recurrence !== '' && $recurrence !== 'none' ) {
				$line .= ', repeats ' . $recurrence;
			}
			if ( $client !== '' ) {
				$line .= ', client id ' . $client;
			}
			if ( $exec_kind !== '' ) {
				$line .= ', executionKind ' . $exec_kind;
			}
			if ( $exec_status !== '' ) {
				$line .= ', lastExecution ' . $exec_status;
			}
			$lines[] = $line;
		}
		if ( count( $lines ) <= 1 ) {
			return '';
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<string,mixed>      $body
	 * @param array<string,mixed>|null $research
	 * @param array<string,mixed>|null $data_research
	 */
	private static function ask_system_prompt( array $body, ?array $research = null, ?array $data_research = null ): string {
		$researched = ( $research !== null && ! empty( $research['block'] ) ) ? (string) $research['block'] : '';
		$data_block = ( $data_research !== null && ! empty( $data_research['block'] ) ) ? (string) $data_research['block'] : '';
		return implode(
			"\n",
			array_filter(
				array(
					'You are NEO Pulse Assist, a read-only helper inside the NEO Pulse manager app (neodigital.ca/app).',
					'Answer using the Pulse workspace context and researched module docs below. Suggest concrete in-app actions instead of WordPress plugin steps unless the user asks about their connected site.',
					'Never claim you changed content, published posts, or ran bulk jobs.',
					self::certainty_rules(),
					self::minimal_global_ui_rules(),
					$researched !== '' ? $researched : '',
					$data_block !== '' ? $data_block : '',
					$data_block !== '' ? self::data_tool_rules() : '',
					self::feature_playbook_rules(),
					self::markdown_format_rules(),
					self::navigation_link_rules(),
					self::followup_topic_rules(),
					self::context_block( $body ),
					self::properties_context_block( $body ),
					self::pulse_assigned_tasks_block( $body ),
					'Respond with JSON only: {"title":"short topic headline or empty","body":"markdown answer with linked destinations","relatedTopics":["topic-specific follow-up 1","topic-specific follow-up 2","topic-specific follow-up 3"],"links":[{"label":"Teams → Chat","url":"pulse:nav/chat","action":"navigate"}]}. relatedTopics and links are top-level JSON fields only. Never put relatedTopics:, links:, or JSON objects inside body.',
				)
			)
		);
	}

	private static function data_tool_rules(): string {
		return Neo_Pulse_App_Data_Tool_Grounding::rules();
	}

	/**
	 * @param array<string,mixed>      $body
	 * @param array<string,mixed>|null $research
	 * @param array<string,mixed>|null $data_research
	 */
	private static function plan_system_prompt( array $body, ?array $research = null, ?array $data_research = null ): string {
		$researched = ( $research !== null && ! empty( $research['block'] ) ) ? (string) $research['block'] : '';
		$data_block = ( $data_research !== null && ! empty( $data_research['block'] ) ) ? (string) $data_research['block'] : '';
		return implode(
			"\n",
			array_filter(
				array(
					'You are NEO Pulse Assist in Plan mode for the NEO Pulse manager app.',
					'Produce a read-only plan preview: numbered steps the user could take inside NEO Pulse. Do not execute writes.',
					self::certainty_rules(),
					self::minimal_global_ui_rules(),
					$researched !== '' ? $researched : '',
					$data_block !== '' ? $data_block : '',
					$data_block !== '' ? self::data_tool_rules() : '',
					self::feature_playbook_rules(),
					self::markdown_format_rules(),
					self::navigation_link_rules(),
					self::followup_topic_rules(),
					self::context_block( $body ),
					self::properties_context_block( $body ),
					self::pulse_assigned_tasks_block( $body ),
					'Respond with JSON only: {"title":"Plan preview","body":"markdown plan with numbered steps and linked destinations","relatedTopics":["topic-specific follow-up 1","topic-specific follow-up 2"],"links":[{"label":"Teams → Chat","url":"pulse:nav/chat","action":"navigate"}]}',
				)
			)
		);
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private static function context_block( array $body ): string {
		$pulse = isset( $body['pulse_context'] ) && is_array( $body['pulse_context'] ) ? $body['pulse_context'] : array();
		$lines = array( 'Pulse context:' );

		$map = array(
			'managerTab'              => 'Manager tab',
			'generatorSection'        => 'Generator section',
			'dashboardCluster'        => 'Dashboard cluster',
			'locationSummary'         => 'Current location',
			'researchSection'         => 'Research section',
			'sitemapMode'             => 'Sitemap optimizer mode',
			'contentOptimizerSection' => 'Content optimizer section',
			'sitemapSource'           => 'Sitemap source',
			'siteName'                => 'Header active property (workspace selection, not total client count)',
			'siteId'                  => 'Property id',
			'expandedPageTitle'       => 'Focused page title',
			'expandedPageUrl'         => 'Focused page URL',
			'pulseAppUrl'             => 'Current app URL',
		);
		foreach ( $map as $key => $label ) {
			if ( ! empty( $pulse[ $key ] ) && is_scalar( $pulse[ $key ] ) ) {
				$lines[] = '- ' . $label . ': ' . sanitize_text_field( (string) $pulse[ $key ] );
			}
		}

		$scope = isset( $body['target_scope'] ) ? sanitize_key( (string) $body['target_scope'] ) : 'page';
		$lines[] = '- Target scope: ' . $scope;
		if ( $scope === 'page' && ! empty( $body['page_title'] ) ) {
			$lines[] = '- Page title: ' . sanitize_text_field( (string) $body['page_title'] );
		}
		if ( $scope === 'page' && ! empty( $body['page_url'] ) ) {
			$lines[] = '- Page URL: ' . esc_url_raw( (string) $body['page_url'] );
		}
		if ( $scope === 'page' && ! empty( $body['post_id'] ) && (int) $body['post_id'] > 0 ) {
			$lines[] = '- Post id: ' . (int) $body['post_id'];
		}
		if ( ! empty( $body['siteUrl'] ) ) {
			$lines[] = '- Connected site URL: ' . esc_url_raw( (string) $body['siteUrl'] );
		}

		return implode( "\n", $lines );
	}

	/**
	 * @param array<int,mixed> $history
	 * @return array<int,array{role:string,content:string}>
	 */
	private static function normalize_history( array $history ) {
		$out = array();
		foreach ( $history as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$role = isset( $row['role'] ) ? sanitize_key( (string) $row['role'] ) : '';
			if ( $role !== 'user' && $role !== 'assistant' ) {
				continue;
			}
			$content = isset( $row['content'] ) ? trim( (string) $row['content'] ) : '';
			if ( $content === '' && $role === 'assistant' && ! empty( $row['card']['body'] ) ) {
				$content = trim( (string) $row['card']['body'] );
			}
			if ( $content === '' ) {
				continue;
			}
			$out[] = array(
				'role'    => $role,
				'content' => mb_substr( $content, 0, 4000 ),
			);
		}
		return array_slice( $out, -12 );
	}

	/**
	 * @param array<int,array{role:string,content:string}> $history
	 * @return array<int,array{role:string,content:string}>
	 */
	private static function chat_messages( string $system_prompt, array $history, string $message ) {
		$messages = array(
			array(
				'role'    => 'system',
				'content' => $system_prompt,
			),
		);
		foreach ( $history as $row ) {
			$messages[] = $row;
		}
		$messages[] = array(
			'role'    => 'user',
			'content' => $message,
		);
		return $messages;
	}

	/**
	 * @param mixed $topics
	 * @return array<int,string>
	 */
	private static function sanitize_topics( $topics ) {
		if ( ! is_array( $topics ) ) {
			return array();
		}
		$out = array();
		foreach ( $topics as $topic ) {
			if ( ! is_scalar( $topic ) ) {
				continue;
			}
			$t = trim( sanitize_text_field( (string) $topic ) );
			if ( $t !== '' ) {
				$out[] = $t;
			}
			if ( count( $out ) >= 4 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function error_card( string $message ) {
		return array(
			'type'       => 'error',
			'title'      => 'NEO Pulse Assist error',
			'body'       => $message,
			'confidence' => 'low',
		);
	}

	private static function normalize_submode( string $submode ): string {
		$submode = sanitize_key( $submode );
		if ( in_array( $submode, array( 'ask', 'plan', 'build' ), true ) ) {
			return $submode;
		}
		return 'ask';
	}
}

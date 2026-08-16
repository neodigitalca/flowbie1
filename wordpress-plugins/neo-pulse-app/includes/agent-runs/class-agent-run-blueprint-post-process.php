<?php
/**
 * Blueprint JSON repair (parity with blog-template-builder blueprint post-process).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Blueprint_Post_Process {

	/**
	 * @return array<string,mixed>
	 */
	public static function parse_blueprint_json( string $raw ): array {
		$text = trim( $raw );
		if ( $text === '' ) {
			return array();
		}
		if ( str_starts_with( $text, '```' ) ) {
			$text = preg_replace( '/^```(?:json)?\s*/i', '', $text );
			$text = preg_replace( '/\s*```$/', '', (string) $text );
			$text = trim( (string) $text );
		}
		$decoded = json_decode( $text, true );
		if ( is_array( $decoded ) ) {
			return $decoded;
		}
		$start = strpos( $text, '{' );
		$end   = strrpos( $text, '}' );
		if ( $start !== false && $end !== false && $end > $start ) {
			$slice   = substr( $text, $start, $end - $start + 1 );
			$decoded = json_decode( $slice, true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		return array();
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @return array<string,mixed>
	 */
	public static function normalize_blueprint_payload( array $parsed ): array {
		if ( ! empty( $parsed['agents'] ) && is_array( $parsed['agents'] ) ) {
			return $parsed;
		}

		$nested_keys = array( 'blueprint', 'flow', 'template', 'data' );
		foreach ( $nested_keys as $key ) {
			$nested = $parsed[ $key ] ?? null;
			if ( is_array( $nested ) && ! empty( $nested['agents'] ) && is_array( $nested['agents'] ) ) {
				$parsed['agents'] = $nested['agents'];
				if ( empty( $parsed['title'] ) && ! empty( $nested['title'] ) ) {
					$parsed['title'] = $nested['title'];
				}
				if ( empty( $parsed['purpose'] ) && ! empty( $nested['purpose'] ) ) {
					$parsed['purpose'] = $nested['purpose'];
				}
				return $parsed;
			}
		}

		if ( ! empty( $parsed['sections'] ) && is_array( $parsed['sections'] ) ) {
			$parsed['agents'] = $parsed['sections'];
			return $parsed;
		}

		return $parsed;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,array<string,mixed>>
	 */
	public static function agents_from_checklist( array $checklist, string $keyword = '' ): array {
		$agents = array();
		$step   = 1;
		foreach ( $checklist as $i => $item ) {
			$item = trim( (string) $item );
			if ( $item === '' ) {
				continue;
			}
			if ( Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::is_faq_title( $item )
				|| Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::is_overview_title( $item ) ) {
				continue;
			}
			$title = self::checklist_item_title( $item );
			$title = Neo_Pulse_App_Agent_Run_Exported_Prompts::rename_intro_agent_title( $title, $keyword );
			$agents[] = array(
				'id'           => 'section-' . $step,
				'step'         => $step,
				'title'        => $title,
				'description'  => $item,
				'features'     => array( '[LINK]: 3-5 internal link placeholders via [[LINK:query|anchor]]' ),
				'headingLevel' => 2,
			);
			++$step;
			if ( $step > Neo_Pulse_App_Agent_Run_Article_Length_Policy::MAX_CHECKLIST_ITEMS_BLOG ) {
				break;
			}
		}
		return $agents;
	}

	/**
	 * @param array<int,mixed> $agents
	 * @param array<int,string> $checklist
	 * @return array<int,array<string,mixed>>
	 */
	public static function repair_agents( array $agents, array $checklist, string $keyword = '' ): array {
		$normalized = Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::normalize_blueprint_agents(
			$agents,
			$checklist,
			$keyword
		);
		return Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::expand_blueprint_agents_if_needed(
			$normalized,
			$checklist
		);
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
}

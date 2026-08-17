<?php
/**
 * Harness outline from blueprint agents.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Harness_Outline {

	/**
	 * @param array<int,array<string,mixed>> $agents
	 * @return array<int,array<string,mixed>>
	 */
	public static function from_agents( array $agents ): array {
		$outline = array();
		foreach ( $agents as $index => $agent ) {
			if ( ! is_array( $agent ) ) {
				continue;
			}
			$features = isset( $agent['features'] ) && is_array( $agent['features'] ) ? $agent['features'] : array();
			$is_faq   = Neo_Pulse_Wp_Harness_Prompts::agent_has_faq_feature( $features );
			$title    = isset( $agent['title'] ) ? (string) $agent['title'] : 'Section ' . ( $index + 1 );
			$keyword  = '';
			if ( isset( $agent['keyword'] ) && (string) $agent['keyword'] !== '' ) {
				$keyword = (string) $agent['keyword'];
			} elseif ( isset( $agent['config']['keyword'] ) && (string) $agent['config']['keyword'] !== '' ) {
				$keyword = (string) $agent['config']['keyword'];
			}
			$outline[] = array(
				'index'        => $index,
				'title'        => $title,
				'displayTitle' => $is_faq ? 'Frequently Asked Questions' : $title,
				'description'  => isset( $agent['description'] ) ? (string) $agent['description'] : '',
				'headingLevel' => isset( $agent['headingLevel'] ) ? (int) $agent['headingLevel'] : 1,
				'keyword'      => $keyword,
				'isFaq'        => $is_faq,
				'agent'        => $agent,
			);
		}
		return $outline;
	}

	/**
	 * @param array<int,string> $pieces
	 */
	public static function stitch_sections( array $pieces ): string {
		$out = array();
		foreach ( $pieces as $p ) {
			$t = trim( (string) $p );
			if ( $t !== '' ) {
				$out[] = $t;
			}
		}
		return implode( "\n\n", $out );
	}

	public static function strip_footer_from_section_html( string $html ): string {
		$html = preg_replace( '#</?footer[^>]*>#i', '', $html );
		return is_string( $html ) ? trim( $html ) : '';
	}
}

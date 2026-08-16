<?php
/**
 * Checklist parse/enforce (parity with post-creator-checklist-post-process.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Checklist_Post_Process {

	public static function strip_checklist_item_markdown_heading( string $item ): string {
		$out = trim( $item );
		$out = preg_replace( '/^#{1,6}\s+/', '', $out );
		$out = preg_replace( '/^\*\*([^*]+)\*\*:\s*/', '$1: ', $out );
		return trim( (string) $out );
	}

	public static function is_bold_only_checklist_line( string $item ): bool {
		$t = trim( $item );
		if ( ! preg_match( '/^\*\*[^*]+\*\*:\s*.+$/', $t ) ) {
			return false;
		}
		return ! preg_match( '/\[(TABLE|LIST|LINK|STRUCTURE|EXACT)/i', $t );
	}

	/**
	 * @return array<int,string>
	 */
	public static function parse_blog_template_checklist_raw( string $raw ): array {
		$lines     = preg_split( '/\r\n|\r|\n/', $raw );
		$checklist = array();
		if ( ! is_array( $lines ) ) {
			return $checklist;
		}
		foreach ( $lines as $line ) {
			$trimmed = trim( (string) $line );
			if ( preg_match( '/^(?:\d+\.|\-|\*)\s+(.+)$/', $trimmed, $matches ) ) {
				$item = self::strip_checklist_item_markdown_heading( trim( $matches[1] ) );
				if ( $item !== '' && ! self::is_bold_only_checklist_line( $item ) ) {
					$checklist[] = $item;
				}
			}
		}
		if ( empty( $checklist ) ) {
			foreach ( $lines as $line ) {
				$item = self::strip_checklist_item_markdown_heading( trim( (string) $line ) );
				if ( strlen( $item ) > 10 && strpos( $item, '#' ) !== 0 && ! self::is_bold_only_checklist_line( $item ) ) {
					$checklist[] = $item;
				}
				if ( count( $checklist ) >= 10 ) {
					break;
				}
			}
		}
		return $checklist;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,string>
	 */
	public static function validate_and_enforce_mandatory_elements( array $checklist ): array {
		if ( empty( $checklist ) ) {
			return $checklist;
		}
		$joined = strtolower( implode( "\n", $checklist ) );
		$out    = $checklist;
		if ( strpos( $joined, '[table]' ) === false ) {
			$idx = min( 1, count( $out ) - 1 );
			$out[ $idx ] .= ' [TABLE]: compact comparison table.';
		}
		if ( strpos( $joined, '[list]: bullet' ) === false && strpos( $joined, '[list]:bullet' ) === false ) {
			$idx = min( 1, count( $out ) - 1 );
			$out[ $idx ] .= ' [LIST]: bullet summary of benefits.';
		}
		if ( strpos( $joined, '[list]: number' ) === false && strpos( $joined, '[list]:number' ) === false ) {
			$idx = min( 3, count( $out ) - 1 );
			$out[ $idx ] .= ' [LIST]: number step-by-step process.';
		}
		return $out;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,string>
	 */
	public static function prepare_checklist_for_pipeline( array $checklist ): array {
		$out = array();
		foreach ( $checklist as $item ) {
			$item = trim( (string) $item );
			if ( $item === '' ) {
				continue;
			}
			if ( Neo_Pulse_App_Agent_Run_Post_Creator_Pipeline::is_faq_title( $item ) ) {
				continue;
			}
			$out[] = $item;
		}
		return $out;
	}

	/**
	 * @param array<int,string> $checklist
	 * @return array<int,string>
	 */
	public static function format_checklist_numbered_lines( array $checklist ): array {
		$out = array();
		foreach ( $checklist as $i => $item ) {
			$out[] = ( $i + 1 ) . '. ' . trim( (string) $item );
		}
		return $out;
	}

	/**
	 * @return array<int,string>
	 */
	public static function parse_blog_template_checklist( string $raw ): array {
		$parsed   = self::parse_blog_template_checklist_raw( $raw );
		$enforced = self::validate_and_enforce_mandatory_elements( $parsed );
		return self::prepare_checklist_for_pipeline( $enforced );
	}
}

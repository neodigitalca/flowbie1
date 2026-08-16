<?php
/**
 * H2 auto-select from keyword research (parity with bulk-blueprint-generator.ts).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_H2_Select {

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,string>
	 */
	public static function auto_select_h2_sections( array $research ): array {
		$analysis = is_array( $research['aiAnalysis'] ?? null ) ? $research['aiAnalysis'] : array();
		$raw      = is_array( $analysis['h2Suggestions'] ?? null ) ? $analysis['h2Suggestions'] : array();
		if ( empty( $raw ) ) {
			return array();
		}

		$headings = array();
		foreach ( array_slice( $raw, 0, 7 ) as $item ) {
			if ( is_string( $item ) ) {
				$headings[] = trim( $item );
			} elseif ( is_array( $item ) ) {
				$headings[] = trim( (string) ( $item['heading'] ?? $item['description'] ?? '' ) );
			}
		}

		return self::filter_faq_style_headings(
			array_values(
				array_filter(
					$headings,
					static function ( $h ) {
						return trim( (string) $h ) !== '';
					}
				)
			)
		);
	}

	/**
	 * @param array<string,mixed> $research
	 * @return array<int,string>
	 */
	public static function auto_select_keywords( array $research, string $primary ): array {
		$analysis = is_array( $research['aiAnalysis'] ?? null ) ? $research['aiAnalysis'] : array();
		$kw       = is_array( $analysis['keywordSuggestions'] ?? null ) ? $analysis['keywordSuggestions'] : array();
		$out      = array();
		if ( ! empty( $kw['primary'] ) && is_string( $kw['primary'] ) ) {
			$out[] = trim( $kw['primary'] );
		}
		if ( is_array( $kw['variations'] ?? null ) ) {
			foreach ( array_slice( $kw['variations'], 0, 5 ) as $v ) {
				if ( is_string( $v ) && trim( $v ) !== '' ) {
					$out[] = trim( $v );
				}
			}
		}
		if ( is_array( $kw['longTail'] ?? null ) ) {
			foreach ( array_slice( $kw['longTail'], 0, 3 ) as $v ) {
				if ( is_string( $v ) && trim( $v ) !== '' ) {
					$out[] = trim( $v );
				}
			}
		}
		if ( $primary !== '' ) {
			array_unshift( $out, $primary );
		}
		$seen = array();
		$dedup = array();
		foreach ( $out as $item ) {
			$key = strtolower( $item );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$dedup[]      = $item;
		}
		return $dedup;
	}

	/**
	 * @param array<int,string> $headings
	 * @return array<int,string>
	 */
	private static function filter_faq_style_headings( array $headings ): array {
		$out = array();
		foreach ( $headings as $heading ) {
			$lower = strtolower( trim( $heading ) );
			if ( $lower === '' ) {
				continue;
			}
			if ( strpos( $lower, 'faq' ) !== false ) {
				continue;
			}
			if ( strpos( $lower, 'frequently asked' ) !== false ) {
				continue;
			}
			if ( strpos( $lower, 'common questions' ) !== false ) {
				continue;
			}
			$out[] = $heading;
		}
		return $out;
	}
}

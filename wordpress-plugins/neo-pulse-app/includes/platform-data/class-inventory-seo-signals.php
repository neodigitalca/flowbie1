<?php
/**
 * Shared SEO signal detection and 1-10 scoring for platform inventory rows.
 *
 * Issue-tag parity with Neo_Pulse_Wp_Backend_Assist_Tools_Analytics::tool_grade_post_library_seo.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Inventory_Seo_Signals {

	/** @var array<string,int> */
	private static $issue_penalties = array(
		'missing_title'            => 3,
		'missing_focus_keyword'    => 1,
		'missing_meta'             => 2,
		'missing_meta_description' => 2,
		'meta_short'               => 1,
		'meta_long'                => 1,
		'missing_excerpt'          => 1,
		'missing_faq'              => 1,
		'missing_seo_research'     => 1,
		'no_featured_image'        => 1,
	);

	/**
	 * @param array<string,mixed> $row
	 * @return array<int,string>
	 */
	public static function detect_issues( array $row ): array {
		$issues = array();
		$title  = trim( (string) ( $row['title'] ?? '' ) );
		if ( $title === '' || strtolower( $title ) === 'untitled' ) {
			$issues[] = 'missing_title';
		}

		$keyword = trim( (string) ( $row['focus_keyword'] ?? '' ) );
		if ( $keyword === '' ) {
			$issues[] = 'missing_focus_keyword';
		}

		$meta_desc = trim( (string) ( $row['meta'] ?? '' ) );
		$excerpt   = trim( (string) ( $row['excerpt'] ?? '' ) );
		$meta_line = $meta_desc !== '' ? $meta_desc : $excerpt;
		if ( $meta_line === '' ) {
			$issues[] = 'missing_meta';
			$issues[] = 'missing_meta_description';
		} elseif ( strlen( $meta_line ) < 70 ) {
			$issues[] = 'meta_short';
		} elseif ( strlen( $meta_line ) > 160 ) {
			$issues[] = 'meta_long';
		}

		if ( $excerpt === '' ) {
			$issues[] = 'missing_excerpt';
		}

		if ( ! empty( $row['acf_loaded'] ) ) {
			if ( empty( $row['has_seo_research'] ) ) {
				$issues[] = 'missing_seo_research';
			}
			if ( empty( $row['has_faq'] ) ) {
				$issues[] = 'missing_faq';
			}
		}

		if ( empty( $row['has_featured_image'] ) ) {
			$issues[] = 'no_featured_image';
		}

		return array_values( array_unique( $issues ) );
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array{score:int,issues:array<int,string>,signals:array<string,mixed>,letter:string}
	 */
	public static function score_row( array $row ): array {
		$issues  = self::detect_issues( $row );
		$signals = self::build_signals( $row );

		$score = 10;
		foreach ( $issues as $issue ) {
			$score -= isset( self::$issue_penalties[ $issue ] ) ? self::$issue_penalties[ $issue ] : 1;
		}
		$score = max( 1, min( 10, $score ) );

		if ( count( $issues ) > 0 && $score >= 10 ) {
			$score = 9;
		}

		return array(
			'score'   => $score,
			'issues'  => $issues,
			'signals' => $signals,
			'letter'  => self::score_to_letter( $score ),
		);
	}

	/**
	 * @param array<string,mixed> $row
	 * @param array<string,mixed> $scored
	 */
	public static function format_grade_line( array $row, array $scored ): string {
		$title = (string) ( $row['title'] ?? '' );
		$url   = (string) ( $row['url'] ?? '' );
		$score = (int) ( $scored['score'] ?? 1 );
		$issues = is_array( $scored['issues'] ?? null ) ? $scored['issues'] : array();
		$signals = is_array( $scored['signals'] ?? null ) ? $scored['signals'] : array();

		$signal_bits = array(
			'keyword:' . ( ! empty( $signals['has_keyword'] ) ? 'yes' : 'no' ),
			'meta:' . (string) ( $signals['meta_chars'] ?? '0' ) . 'ch',
			'faq:' . ( ! empty( $signals['has_faq'] ) ? 'yes' : 'no' ),
			'seo:' . ( ! empty( $signals['has_seo_research'] ) ? 'yes' : 'no' ),
			'image:' . ( ! empty( $signals['has_featured_image'] ) ? 'yes' : 'no' ),
		);

		$suffix = ' — ' . implode( ' ', $signal_bits );
		if ( count( $issues ) > 0 ) {
			$suffix .= ' (' . implode( ', ', $issues ) . ')';
		}

		$link_title = str_replace( array( '[', ']' ), '', $title );
		if ( $url !== '' && $link_title !== '' ) {
			return '- [' . $link_title . '](' . $url . ') — ' . $score . '/10' . $suffix;
		}
		if ( $link_title !== '' ) {
			return '- ' . $link_title . ' — ' . $score . '/10' . $suffix;
		}
		return '- ' . $url . ' — ' . $score . '/10' . $suffix;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	private static function build_signals( array $row ): array {
		$meta_desc = trim( (string) ( $row['meta'] ?? '' ) );
		$excerpt   = trim( (string) ( $row['excerpt'] ?? '' ) );
		$meta_line = $meta_desc !== '' ? $meta_desc : $excerpt;

		return array(
			'has_keyword'        => trim( (string) ( $row['focus_keyword'] ?? '' ) ) !== '',
			'meta_chars'         => strlen( $meta_line ),
			'has_faq'            => ! empty( $row['acf_loaded'] ) && ! empty( $row['has_faq'] ),
			'has_seo_research'   => ! empty( $row['acf_loaded'] ) && ! empty( $row['has_seo_research'] ),
			'has_featured_image' => ! empty( $row['has_featured_image'] ),
			'acf_loaded'         => ! empty( $row['acf_loaded'] ),
		);
	}

	private static function score_to_letter( int $score ): string {
		if ( $score >= 9 ) {
			return 'A';
		}
		if ( $score >= 7 ) {
			return 'B';
		}
		if ( $score >= 5 ) {
			return 'C';
		}
		return 'D';
	}
}

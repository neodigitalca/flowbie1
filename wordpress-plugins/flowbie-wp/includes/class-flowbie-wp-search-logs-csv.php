<?php
/**
 * Search log CSV import/export.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Search_Logs_Csv {

	const HEADER = 'event_uid,session_id,page_url,query,result_count,intent,sentiment,accepted_url,accepted_title,accepted_rank,accepted_at,created_at';

	/**
	 * @param array<int, object|array<string, mixed>> $rows DB rows.
	 */
	public static function build( array $rows ): string {
		$lines = array( self::HEADER );
		foreach ( $rows as $row ) {
			$r = is_object( $row ) ? (array) $row : $row;
			$lines[] = implode(
				',',
				array(
					self::csv_quote( isset( $r['event_uid'] ) ? (string) $r['event_uid'] : '' ),
					self::csv_quote( isset( $r['session_id'] ) ? (string) $r['session_id'] : '' ),
					self::csv_quote( isset( $r['page_url'] ) ? (string) $r['page_url'] : '' ),
					self::csv_quote( isset( $r['query'] ) ? (string) $r['query'] : '' ),
					self::csv_quote( isset( $r['result_count'] ) ? (string) $r['result_count'] : '0' ),
					self::csv_quote( isset( $r['intent'] ) ? (string) $r['intent'] : '' ),
					self::csv_quote( isset( $r['sentiment'] ) ? (string) $r['sentiment'] : '' ),
					self::csv_quote( isset( $r['accepted_url'] ) ? (string) $r['accepted_url'] : '' ),
					self::csv_quote( isset( $r['accepted_title'] ) ? (string) $r['accepted_title'] : '' ),
					self::csv_quote( isset( $r['accepted_rank'] ) ? (string) $r['accepted_rank'] : '' ),
					self::csv_quote( isset( $r['accepted_at'] ) ? (string) $r['accepted_at'] : '' ),
					self::csv_quote( isset( $r['created_at'] ) ? (string) $r['created_at'] : '' ),
				)
			);
		}
		return implode( "\n", $lines );
	}

	private static function csv_quote( string $value ): string {
		if ( strpos( $value, '"' ) !== false || strpos( $value, ',' ) !== false || strpos( $value, "\n" ) !== false ) {
			return '"' . str_replace( '"', '""', $value ) . '"';
		}
		return $value;
	}
}

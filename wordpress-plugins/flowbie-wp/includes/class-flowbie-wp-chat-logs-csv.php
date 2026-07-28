<?php
/**
 * Chat log CSV import/export.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Chat_Logs_Csv {

	const HEADER = 'message_uid,session_id,source,role,content,card_type,confidence,page_url,created_at';

	/**
	 * @return array{rows: array<int, array<string, mixed>>, error?: string}
	 */
	public static function parse( string $csv_text ): array {
		$trimmed = trim( $csv_text );
		if ( $trimmed === '' ) {
			return array(
				'rows'  => array(),
				'error' => __( 'CSV is empty.', 'flowbie-wp' ),
			);
		}

		$lines = preg_split( '/\r\n|\r|\n/', $trimmed );
		if ( ! is_array( $lines ) || count( $lines ) < 1 ) {
			return array(
				'rows'  => array(),
				'error' => __( 'Failed to parse CSV.', 'flowbie-wp' ),
			);
		}

		$header_line = array_shift( $lines );
		$headers     = str_getcsv( (string) $header_line );
		if ( ! is_array( $headers ) || empty( $headers ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'CSV header row is missing.', 'flowbie-wp' ),
			);
		}

		$out = array();
		foreach ( $lines as $line ) {
			if ( trim( (string) $line ) === '' ) {
				continue;
			}
			$cells = str_getcsv( (string) $line );
			if ( ! is_array( $cells ) ) {
				continue;
			}
			$row = self::row_assoc( $headers, $cells );

			$session_id = self::pick_column( $row, array( 'session_id' ) );
			$source     = self::pick_column( $row, array( 'source' ) );
			$role       = self::pick_column( $row, array( 'role' ) );
			$content    = self::pick_column( $row, array( 'content' ) );

			if ( $session_id === '' || $content === '' ) {
				continue;
			}
			if ( ! Flowbie_Wp_Chat_Logs::is_valid_session_id( $session_id ) ) {
				continue;
			}
			if ( ! Flowbie_Wp_Chat_Logs::is_valid_source( $source ) ) {
				$source = 'frontend';
			}
			if ( ! in_array( $role, array( 'user', 'assistant' ), true ) ) {
				$role = 'user';
			}

			$message_uid = self::pick_column( $row, array( 'message_uid' ) );
			$created_at  = self::pick_column( $row, array( 'created_at' ) );

			$parsed = array(
				'message_uid' => $message_uid,
				'session_id'  => $session_id,
				'source'      => $source,
				'role'        => $role,
				'content'     => $content,
				'card_type'   => self::pick_column( $row, array( 'card_type' ) ),
				'confidence'  => self::pick_column( $row, array( 'confidence' ) ),
				'page_url'    => self::pick_column( $row, array( 'page_url' ) ),
			);
			if ( $created_at !== '' && preg_match( '/^\d{4}-\d{2}-\d{2}/', $created_at ) ) {
				$parsed['created_at'] = $created_at;
			}

			$out[] = $parsed;
		}

		if ( empty( $out ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'No valid chat log rows found.', 'flowbie-wp' ),
			);
		}

		return array( 'rows' => $out );
	}

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
					self::csv_quote( isset( $r['message_uid'] ) ? (string) $r['message_uid'] : '' ),
					self::csv_quote( isset( $r['session_id'] ) ? (string) $r['session_id'] : '' ),
					self::csv_quote( isset( $r['source'] ) ? (string) $r['source'] : '' ),
					self::csv_quote( isset( $r['role'] ) ? (string) $r['role'] : '' ),
					self::csv_quote( isset( $r['content'] ) ? (string) $r['content'] : '' ),
					self::csv_quote( isset( $r['card_type'] ) ? (string) $r['card_type'] : '' ),
					self::csv_quote( isset( $r['confidence'] ) ? (string) $r['confidence'] : '' ),
					self::csv_quote( isset( $r['page_url'] ) ? (string) $r['page_url'] : '' ),
					self::csv_quote( isset( $r['created_at'] ) ? (string) $r['created_at'] : '' ),
				)
			);
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<int, string>   $headers Header cells.
	 * @param array<int, string>   $cells   Row cells.
	 * @return array<string, string>
	 */
	private static function row_assoc( array $headers, array $cells ): array {
		$row = array();
		foreach ( $headers as $i => $h ) {
			$row[ (string) $h ] = isset( $cells[ $i ] ) ? (string) $cells[ $i ] : '';
		}
		return $row;
	}

	/**
	 * @param array<string, string> $row   Row data.
	 * @param array<int, string>    $names Column names.
	 */
	private static function pick_column( array $row, array $names ): string {
		$keys = array_keys( $row );
		foreach ( $names as $name ) {
			$norm = self::normalize_header_key( $name );
			foreach ( $keys as $k ) {
				if ( self::normalize_header_key( $k ) === $norm ) {
					return trim( (string) $row[ $k ] );
				}
			}
		}
		return '';
	}

	private static function normalize_header_key( string $key ): string {
		$key = strtolower( trim( $key ) );
		return preg_replace( '/\s+/', '', $key );
	}

	private static function csv_quote( string $value ): string {
		if ( strpos( $value, '"' ) !== false || strpos( $value, ',' ) !== false || strpos( $value, "\n" ) !== false ) {
			return '"' . str_replace( '"', '""', $value ) . '"';
		}
		return $value;
	}
}

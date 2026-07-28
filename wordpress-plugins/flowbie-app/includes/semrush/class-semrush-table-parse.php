<?php
/**
 * Semrush CSV / table row parsing (Analytics API text responses).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Semrush_Table_Parse {

	/**
	 * @return array<int,array<string,string>>
	 */
	public static function rows_from_csv_text( string $text ): array {
		$text = trim( $text );
		if ( $text === '' ) {
			return array();
		}

		$lines = preg_split( '/\r\n|\r|\n/', $text );
		if ( ! is_array( $lines ) ) {
			return array();
		}

		$lines = array_values(
			array_filter(
				array_map( 'trim', $lines ),
				static function ( $line ) {
					return $line !== '';
				}
			)
		);

		if ( count( $lines ) < 2 ) {
			return array();
		}

		$delimiter = self::guess_delimiter( $lines[0] );
		$headers   = self::split_line( $lines[0], $delimiter );
		$headers   = array_map(
			static function ( $h ) {
				return strtolower( preg_replace( '/^\xEF\xBB\xBF/', '', trim( (string) $h ) ) );
			},
			$headers
		);

		$out = array();
		for ( $i = 1; $i < count( $lines ); $i++ ) {
			$parts = self::split_line( $lines[ $i ], $delimiter );
			$row   = array();
			foreach ( $headers as $j => $key ) {
				$row[ $key ] = isset( $parts[ $j ] ) ? trim( (string) $parts[ $j ] ) : '';
			}
			$out[] = $row;
		}

		return $out;
	}

	private static function guess_delimiter( string $line ): string {
		$semi  = substr_count( $line, ';' );
		$comma = substr_count( $line, ',' );
		if ( $semi > $comma && $semi >= 1 ) {
			return ';';
		}
		if ( $comma > 0 ) {
			return ',';
		}
		return $semi > 0 ? ';' : ',';
	}

	/**
	 * @return array<int,string>
	 */
	private static function split_line( string $line, string $delimiter ): array {
		if ( $delimiter === ';' ) {
			return array_map( 'trim', explode( ';', $line ) );
		}
		return array_map( 'trim', explode( ',', $line ) );
	}

	/**
	 * @param array<string,string> $row
	 * @return array<string,string>
	 */
	public static function record_keys_lower( array $row ): array {
		$out = array();
		foreach ( $row as $k => $v ) {
			$key       = strtolower( preg_replace( '/^\xEF\xBB\xBF/', '', trim( (string) $k ) ) );
			$out[ $key ] = $v !== null ? (string) $v : '';
		}
		return $out;
	}

	/**
	 * @param mixed $x
	 */
	public static function num( $x ): ?float {
		if ( $x === null ) {
			return null;
		}
		if ( is_int( $x ) || is_float( $x ) ) {
			return is_finite( (float) $x ) ? (float) $x : null;
		}
		$s = trim( str_replace( ',', '', (string) $x ) );
		if ( $s === '' || $s === '-' || preg_match( '/^n\/?a$/i', $s ) ) {
			return null;
		}
		if ( is_string( $x ) && substr( $s, -1 ) === '%' ) {
			$s = trim( substr( $s, 0, -1 ) );
		}
		if ( ! is_numeric( $s ) ) {
			return null;
		}
		$n = (float) $s;
		return is_finite( $n ) ? $n : null;
	}
}

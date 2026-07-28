<?php
/**
 * Script Manager CSV import/export.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Script_Manager_Csv {

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

			$name = self::pick_column( $row, array( 'name', 'script_name', 'title' ) );
			$code = self::pick_column( $row, array( 'code', 'script', 'snippet' ) );
			if ( $name === '' || $code === '' ) {
				continue;
			}

			$placement = sanitize_key( self::pick_column( $row, array( 'placement', 'location' ) ) );
			if ( $placement === '' || ! in_array( $placement, Flowbie_Wp_Script_Manager::PLACEMENTS, true ) ) {
				$placement = 'header';
			}

			$status = sanitize_key( self::pick_column( $row, array( 'status' ) ) );
			if ( ! in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
				$status = 'active';
			}

			$priority = (int) self::pick_column( $row, array( 'priority' ) );
			if ( $priority < 0 ) {
				$priority = 10;
			}

			$category = self::pick_column( $row, array( 'category' ) );
			if ( $category === '' ) {
				$category = Flowbie_Wp_Script_Manager::get_settings()['default_category'];
			}

			$rules_raw = self::pick_column( $row, array( 'display_rules', 'rules' ) );
			$rules     = $rules_raw !== '' ? $rules_raw : Flowbie_Wp_Script_Manager_Rules::defaults();
			$normalized = Flowbie_Wp_Script_Manager_Rules::normalize( $rules );
			if ( empty( $normalized['ok'] ) ) {
				continue;
			}

			$id_raw = self::pick_column( $row, array( 'id' ) );
			$parsed = array(
				'name'          => sanitize_text_field( $name ),
				'placement'     => $placement,
				'code'          => $code,
				'status'        => $status,
				'priority'      => $priority,
				'category'      => sanitize_text_field( $category ),
				'display_rules' => $normalized['rules'],
			);
			if ( $id_raw !== '' && (int) $id_raw > 0 ) {
				$parsed['id'] = (int) $id_raw;
			}

			$out[] = $parsed;
		}

		if ( empty( $out ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'No valid script rows found.', 'flowbie-wp' ),
			);
		}

		return array( 'rows' => $out );
	}

	/**
	 * @param array<int, object> $rows DB rows.
	 */
	public static function build( array $rows ): string {
		$header = 'id,name,placement,code,status,priority,category,display_rules,created_at,updated_at';
		$lines  = array( $header );
		foreach ( $rows as $row ) {
			$rules = isset( $row->display_rules ) ? (string) $row->display_rules : Flowbie_Wp_Script_Manager_Rules::encode( Flowbie_Wp_Script_Manager_Rules::defaults() );
			$lines[] = implode(
				',',
				array(
					self::csv_quote( isset( $row->id ) ? (string) $row->id : '' ),
					self::csv_quote( isset( $row->name ) ? (string) $row->name : '' ),
					self::csv_quote( isset( $row->placement ) ? (string) $row->placement : 'header' ),
					self::csv_quote( isset( $row->code ) ? (string) $row->code : '' ),
					self::csv_quote( isset( $row->status ) ? (string) $row->status : 'active' ),
					self::csv_quote( isset( $row->priority ) ? (string) $row->priority : '10' ),
					self::csv_quote( isset( $row->category ) ? (string) $row->category : '' ),
					self::csv_quote( $rules ),
					self::csv_quote( isset( $row->created_at ) ? (string) $row->created_at : '' ),
					self::csv_quote( isset( $row->updated_at ) ? (string) $row->updated_at : '' ),
				)
			);
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<int, string> $headers Header cells.
	 * @param array<int, string> $cells   Row cells.
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
		return '"' . str_replace( '"', '""', $value ) . '"';
	}
}

<?php
/**
 * Form entry CSV export helpers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms_Entries_Csv {

	/**
	 * @param array<int, array<string, mixed>> $fields Form fields.
	 * @return array<int, string>
	 */
	public static function build_headers( array $fields ): array {
		$headers = array( 'entry_id', 'entry_uid', 'created_at', 'ip_address', 'source_url' );
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			foreach ( Neo_Pulse_Wp_Forms_Field_Registry::csv_columns_for_field( $field ) as $col ) {
				$headers[] = $col;
			}
		}
		return $headers;
	}

	/**
	 * @param array<string, mixed>             $entry  Entry row with meta.
	 * @param array<int, array<string, mixed>> $fields Form fields.
	 * @return array<int, string>
	 */
	public static function build_row( array $entry, array $fields ): array {
		$row = array(
			(string) ( $entry['id'] ?? '' ),
			(string) ( $entry['entry_uid'] ?? '' ),
			(string) ( $entry['created_at'] ?? '' ),
			(string) ( $entry['ip_address'] ?? '' ),
			(string) ( $entry['source_url'] ?? '' ),
		);
		$meta = isset( $entry['meta'] ) && is_array( $entry['meta'] ) ? $entry['meta'] : array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$row = array_merge( $row, self::meta_values_for_field( $field, $meta ) );
		}
		return $row;
	}

	/**
	 * @param array<string, mixed> $field Field.
	 * @param array<string, mixed> $meta  Entry meta.
	 * @return array<int, string>
	 */
	public static function meta_values_for_field( array $field, array $meta ): array {
		$type = (string) ( $field['type'] ?? 'text' );
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' || in_array( $type, Neo_Pulse_Wp_Forms_Field_Registry::display_only_types(), true ) ) {
			return array();
		}
		$value = $meta[ $name ] ?? '';
		if ( $type === 'name' || $type === 'address' ) {
			$values = array();
			$cols   = Neo_Pulse_Wp_Forms_Field_Registry::csv_columns_for_field( $field );
			$arr    = is_array( $value ) ? $value : array();
			foreach ( $cols as $col ) {
				$prefix = $name . '_';
				$key    = str_starts_with( $col, $prefix ) ? substr( $col, strlen( $prefix ) ) : $col;
				$values[] = (string) ( $arr[ $key ] ?? '' );
			}
			return $values;
		}
		if ( is_array( $value ) ) {
			$value = implode( ', ', $value );
		}
		return array( (string) $value );
	}

	/**
	 * @param array<int, string> $fields Row values.
	 */
	public static function csv_line( array $fields ): string {
		$escaped = array();
		foreach ( $fields as $value ) {
			$value     = str_replace( '"', '""', (string) $value );
			$escaped[] = '"' . $value . '"';
		}
		return implode( ',', $escaped );
	}

	/**
	 * Build full CSV string (for export download).
	 *
	 * @param array<int, array<string, mixed>> $fields Form fields.
	 */
	public static function build_export_string( int $form_id, array $fields ): string {
		$result  = Neo_Pulse_Wp_Forms_Entries::list_entries(
			array(
				'form_id'  => $form_id,
				'status'   => 'all',
				'page'     => 1,
				'per_page' => 10000,
			)
		);
		$lines   = array( self::csv_line( self::build_headers( $fields ) ) );
		foreach ( $result['items'] as $entry ) {
			if ( is_array( $entry ) ) {
				$lines[] = self::csv_line( self::build_row( $entry, $fields ) );
			}
		}
		return implode( "\n", $lines );
	}
}

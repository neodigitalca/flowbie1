<?php
/**
 * Client benchmark tags (custom override or taxonomy).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Vertical_Benchmark_Client_Tag {

	const CUSTOM_TAG_MAX = 80;

	/**
	 * @param array<string,mixed> $site
	 * @return array{clientTag:string,clientTagLabel:string,source:string}|null
	 */
	public static function resolve_custom( array $site ): ?array {
		$label = self::read_custom_raw( $site );
		if ( $label === '' ) {
			return null;
		}
		return array(
			'clientTag'      => self::slug_from_label( $label ),
			'clientTagLabel' => $label,
			'source'         => 'custom',
		);
	}

	/**
	 * @return array{clientTag:string,clientTagLabel:string,source:string}
	 */
	public static function resolve_taxonomy( string $taxonomy_id ): array {
		$id = Neo_Pulse_App_Vertical_Benchmark_Taxonomy::normalize( $taxonomy_id );
		return array(
			'clientTag'      => $id,
			'clientTagLabel' => Neo_Pulse_App_Vertical_Benchmark_Taxonomy::label( $id ),
			'source'         => 'taxonomy',
		);
	}

	/** @param array<string,mixed> $site */
	private static function read_custom_raw( array $site ): string {
		$raw = $site['benchmarkCustomTag'] ?? $site['benchmark_custom_tag'] ?? '';
		if ( $raw === '' && isset( $site['payload_json'] ) && is_array( $site['payload_json'] ) ) {
			$payload = $site['payload_json'];
			$raw     = $payload['benchmarkCustomTag'] ?? $payload['benchmark_custom_tag'] ?? '';
		}
		if ( ! is_string( $raw ) ) {
			return '';
		}
		return substr( trim( $raw ), 0, self::CUSTOM_TAG_MAX );
	}

	private static function slug_from_label( string $label ): string {
		$s = strtolower( trim( $label ) );
		$s = preg_replace( '/\s+/', '_', $s );
		$s = preg_replace( '/[^a-z0-9_]/', '', (string) $s );
		return $s !== '' ? 'custom_' . $s : 'custom';
	}
}

<?php
/**
 * WordPress site roster for vertical benchmark jobs (JSON file storage).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Vertical_Benchmark_Sites {

	/**
	 * @param array<int,array<string,mixed>>|null $body_sites
	 * @return array<int,array<string,mixed>>
	 */
	public static function resolve_for_job( ?array $body_sites ): array {
		if ( is_array( $body_sites ) && ! empty( $body_sites ) ) {
			$out = array();
			foreach ( $body_sites as $site ) {
				if ( ! is_array( $site ) || empty( $site['siteUrl'] ) || empty( $site['username'] ) || empty( $site['appPassword'] ) ) {
					continue;
				}
				$site['id']               = trim( (string) ( $site['id'] ?? '' ) );
				$site['industryVertical'] = Flowbie_App_Vertical_Benchmark_Taxonomy::normalize( (string) ( $site['industryVertical'] ?? 'uncategorized' ) );
				$out[]                    = $site;
			}
			return $out;
		}

		$mirror = Flowbie_App_Sites_Sync::load_mirror();
		$sites  = is_array( $mirror ) && isset( $mirror['sites'] ) && is_array( $mirror['sites'] ) ? $mirror['sites'] : array();
		$out    = array();
		foreach ( $sites as $site ) {
			if ( ! is_array( $site ) || empty( $site['siteUrl'] ) || empty( $site['username'] ) || empty( $site['appPassword'] ) ) {
				continue;
			}
			$site['industryVertical'] = Flowbie_App_Vertical_Benchmark_Taxonomy::normalize( (string) ( $site['industryVertical'] ?? 'uncategorized' ) );
			$out[]                    = $site;
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $sites
	 * @param string[]|null                  $site_ids
	 * @return array<int,array<string,mixed>>
	 */
	public static function filter_by_ids( array $sites, ?array $site_ids ): array {
		if ( empty( $site_ids ) ) {
			return $sites;
		}
		$ids = array();
		foreach ( $site_ids as $id ) {
			$ids[ trim( (string) $id ) ] = true;
		}
		return array_values(
			array_filter(
				$sites,
				static function ( $site ) use ( $ids ) {
					return isset( $ids[ (string) ( $site['id'] ?? '' ) ] );
				}
			)
		);
	}

	/**
	 * Persist latest classification snapshot to vertical-benchmarks JSON storage.
	 *
	 * @param array<int,array<string,mixed>> $clients
	 */
	public static function save_classification_snapshot( array $clients ): void {
		Flowbie_App_Json_File_Store::write(
			Flowbie_App_Data_Paths::vertical_benchmark_classifications_path(),
			array(
				'clients'   => $clients,
				'updatedAt' => gmdate( 'c' ),
			)
		);
	}
}

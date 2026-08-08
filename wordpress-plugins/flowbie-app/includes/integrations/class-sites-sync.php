<?php
/**
 * Mirror Flowbie Integrations sites to uploads/flowbie-data/sites.json.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Sites_Sync {

	/**
	 * @param array<int,array<string,mixed>> $sites Site rows from browser.
	 * @param array<string,mixed>              $opts  activeSiteId optional.
	 * @return array{ok:bool,count:int}
	 */
	public static function save_mirror( array $sites, array $opts = array() ): array {
		$sites = self::merge_preserved_fields( $sites );
		$payload = array(
			'sites'        => $sites,
			'syncedAt'     => gmdate( 'c' ),
			'activeSiteId' => isset( $opts['activeSiteId'] ) ? (string) $opts['activeSiteId'] : null,
		);
		Flowbie_App_Json_File_Store::write( Flowbie_App_Data_Paths::sites_path(), $payload );
		return array( 'ok' => true, 'count' => count( $sites ) );
	}

	/**
	 * Keep server-side GBP/GA4 ids when a browser sync omits them (stale bundle or partial payload).
	 *
	 * @param array<int,array<string,mixed>> $sites
	 * @return array<int,array<string,mixed>>
	 */
	private static function merge_preserved_fields( array $sites ): array {
		$existing = self::load_mirror();
		if ( ! is_array( $existing ) || empty( $existing['sites'] ) || ! is_array( $existing['sites'] ) ) {
			return $sites;
		}
		$by_id = array();
		foreach ( $existing['sites'] as $row ) {
			if ( ! is_array( $row ) || empty( $row['id'] ) ) {
				continue;
			}
			$by_id[ (string) $row['id'] ] = $row;
		}
		foreach ( $sites as $i => $site ) {
			if ( ! is_array( $site ) || empty( $site['id'] ) ) {
				continue;
			}
			$prev = $by_id[ (string) $site['id'] ] ?? null;
			if ( ! is_array( $prev ) ) {
				continue;
			}
			if ( empty( $site['gbpLocationId'] ) && ! empty( $prev['gbpLocationId'] ) ) {
				$sites[ $i ]['gbpLocationId'] = (string) $prev['gbpLocationId'];
			}
			if ( empty( $site['ga4PropertyId'] ) && ! empty( $prev['ga4PropertyId'] ) ) {
				$sites[ $i ]['ga4PropertyId'] = (string) $prev['ga4PropertyId'];
			}
		}
		return $sites;
	}

	public static function save_active_site_id( ?string $active_site_id ): array {
		Flowbie_App_Json_File_Store::write(
			Flowbie_App_Data_Paths::active_site_path(),
			array(
				'activeSiteId' => $active_site_id,
				'updatedAt'    => gmdate( 'c' ),
			)
		);
		return array( 'ok' => true, 'activeSiteId' => $active_site_id );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function load_mirror() {
		return Flowbie_App_Json_File_Store::read( Flowbie_App_Data_Paths::sites_path() );
	}
}

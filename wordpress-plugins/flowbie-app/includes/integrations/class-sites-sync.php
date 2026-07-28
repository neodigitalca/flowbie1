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
		$payload = array(
			'sites'       => $sites,
			'syncedAt'    => gmdate( 'c' ),
			'activeSiteId' => isset( $opts['activeSiteId'] ) ? (string) $opts['activeSiteId'] : null,
		);
		Flowbie_App_Json_File_Store::write( Flowbie_App_Data_Paths::sites_path(), $payload );
		return array( 'ok' => true, 'count' => count( $sites ) );
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

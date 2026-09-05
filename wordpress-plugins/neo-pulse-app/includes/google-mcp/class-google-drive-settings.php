<?php
/**
 * Team Google Drive folder hierarchy settings.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Drive_Settings {

	const OPTION_KEY = 'neo_pulse_app_google_drive_team_settings';

	const DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID = '0AHAVAVW8TixdUk9PVA';

	/**
	 * @return array<int,array{key:string,folderName:string,aliases:array<int,string>}>
	 */
	public static function default_folder_aliases(): array {
		return array(
			array(
				'key'        => 'reporting',
				'folderName' => 'Reporting',
				'aliases'    => array( 'reporting', 'reports', 'gsc', 'report' ),
			),
			array(
				'key'        => 'audits',
				'folderName' => 'Audits',
				'aliases'    => array( 'audits', 'audit', 'chatgpt-audit', 'chatgpt audit' ),
			),
			array(
				'key'        => 'grids',
				'folderName' => 'Grids',
				'aliases'    => array( 'grids', 'grid', 'local-dominator', 'local dominator' ),
			),
		);
	}

	/**
	 * @return array{teamRootFolderId:string,folderAliases:array<int,array{key:string,folderName:string,aliases:array<int,string>}>}
	 */
	public static function get(): array {
		if ( ! function_exists( 'get_option' ) ) {
			return self::defaults();
		}
		$raw = get_option( self::OPTION_KEY, array() );
		return self::sanitize( is_array( $raw ) ? $raw : array() );
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function save( array $body ): array {
		$sanitized = self::sanitize( $body );
		if ( function_exists( 'update_option' ) ) {
			update_option( self::OPTION_KEY, $sanitized, false );
		}
		return array(
			'statusCode' => 200,
			'body'       => array(
				'success'  => true,
				'settings' => $sanitized,
			),
		);
	}

	/**
	 * @return array{teamRootFolderId:string,folderAliases:array<int,array{key:string,folderName:string,aliases:array<int,string>}>}
	 */
	public static function defaults(): array {
		return array(
			'teamRootFolderId' => self::DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID,
			'folderAliases'    => self::default_folder_aliases(),
		);
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array{teamRootFolderId:string,folderAliases:array<int,array{key:string,folderName:string,aliases:array<int,string>}>}
	 */
	public static function sanitize( array $raw ): array {
		$defaults = self::defaults();
		$team_root = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $raw['teamRootFolderId'] ?? '' ) );
		if ( strlen( $team_root ) < 10 ) {
			$team_root = self::DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID;
		}

		$aliases_by_key = array();
		foreach ( self::default_folder_aliases() as $alias ) {
			$aliases_by_key[ $alias['key'] ] = $alias;
		}

		$incoming = isset( $raw['folderAliases'] ) && is_array( $raw['folderAliases'] ) ? $raw['folderAliases'] : array();
		foreach ( $incoming as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$key = sanitize_key( (string) ( $item['key'] ?? '' ) );
			if ( $key === '' || ! isset( $aliases_by_key[ $key ] ) ) {
				continue;
			}
			$folder_name = sanitize_text_field( (string) ( $item['folderName'] ?? $aliases_by_key[ $key ]['folderName'] ) );
			$aliases     = array();
			if ( isset( $item['aliases'] ) && is_array( $item['aliases'] ) ) {
				foreach ( $item['aliases'] as $alias ) {
					$normalized = sanitize_text_field( strtolower( trim( (string) $alias ) ) );
					if ( $normalized !== '' ) {
						$aliases[] = $normalized;
					}
				}
			}
			if ( $folder_name === '' ) {
				$folder_name = $aliases_by_key[ $key ]['folderName'];
			}
			if ( empty( $aliases ) ) {
				$aliases = $aliases_by_key[ $key ]['aliases'];
			}
			$aliases_by_key[ $key ] = array(
				'key'        => $key,
				'folderName' => $folder_name,
				'aliases'    => array_values( array_unique( $aliases ) ),
			);
		}

		return array(
			'teamRootFolderId' => $team_root,
			'folderAliases'    => array_values( $aliases_by_key ),
		);
	}
}

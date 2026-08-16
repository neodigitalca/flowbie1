<?php
/**
 * WP Engine SFTP catalog (server-side credentials).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wpengine_Catalog {

	/** App hosts — not client WP plugin deploy targets. */
	private const EXCLUDED_SITES = array( 'flowbie.ca', 'neodigital.ca' );

	/**
	 * @return array{updatedAt:?string,rows:array<int,array<string,mixed>>}
	 */
	public static function load(): array {
		$data = Neo_Pulse_App_Json_File_Store::read( Neo_Pulse_App_Data_Paths::wpengine_sftp_catalog_path() );
		if ( ! is_array( $data ) ) {
			return array(
				'updatedAt' => null,
				'rows'      => array(),
			);
		}
		$rows = isset( $data['rows'] ) && is_array( $data['rows'] ) ? $data['rows'] : array();
		return array(
			'updatedAt' => isset( $data['updatedAt'] ) ? (string) $data['updatedAt'] : null,
			'rows'      => self::normalize_rows( $rows ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array{ok:bool,count:int,updatedAt:string}
	 */
	public static function save_rows( array $rows ): array {
		$normalized = self::normalize_rows( $rows );
		$updated    = gmdate( 'c' );
		Neo_Pulse_App_Json_File_Store::write(
			Neo_Pulse_App_Data_Paths::wpengine_sftp_catalog_path(),
			array(
				'updatedAt' => $updated,
				'rows'      => $normalized,
			)
		);
		return array(
			'ok'        => true,
			'count'     => count( $normalized ),
			'updatedAt' => $updated,
		);
	}

	/**
	 * @return array{rowCount:int,updatedAt:?string,pluginStaged:bool}
	 */
	public static function status(): array {
		$catalog = self::load();
		$plugin  = Neo_Pulse_App_Data_Paths::wpengine_plugin_staging_dir();
		return array(
			'rowCount'     => count( $catalog['rows'] ),
			'updatedAt'    => $catalog['updatedAt'],
			'pluginStaged' => is_dir( $plugin ) && is_readable( $plugin . '/neo-pulse-wp.php' ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	private static function normalize_rows( array $rows ): array {
		$out = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$site = self::normalize_host_key( isset( $row['site'] ) ? (string) $row['site'] : '' );
			$host = trim( isset( $row['host'] ) ? (string) $row['host'] : '' );
			$user = trim( isset( $row['username'] ) ? (string) $row['username'] : '' );
			$pass = isset( $row['password'] ) ? (string) $row['password'] : '';
			if ( $site === '' || $host === '' || $user === '' || $pass === '' ) {
				continue;
			}
			$port       = isset( $row['port'] ) && is_numeric( $row['port'] ) ? (int) $row['port'] : 2222;
			$is_staging = self::is_staging_row( $host, $user, $row );
			$out[]      = array(
				'site'       => $site,
				'host'       => $host,
				'port'       => $port > 0 ? $port : 2222,
				'username'   => $user,
				'password'   => $pass,
				'isStaging'  => $is_staging,
			);
		}
		usort(
			$out,
			static function ( array $a, array $b ): int {
				return strcmp( (string) $a['site'], (string) $b['site'] );
			}
		);
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 */
	private static function is_staging_row( string $host, string $username, array $row ): bool {
		if ( isset( $row['isStaging'] ) ) {
			return (bool) $row['isStaging'];
		}
		$host_l = strtolower( $host );
		$user_l = strtolower( $username );
		return str_contains( $host_l, '1stg' ) || str_contains( $user_l, '1stg' );
	}

	public static function normalize_host_key( string $url_or_host ): string {
		$raw = trim( $url_or_host );
		if ( $raw === '' ) {
			return '';
		}
		if ( str_contains( $raw, '://' ) ) {
			$parts = wp_parse_url( $raw );
			$raw   = isset( $parts['host'] ) ? (string) $parts['host'] : $raw;
		}
		$raw = preg_replace( '#^www\.#i', '', $raw ) ?? $raw;
		return strtolower( rtrim( $raw, '/' ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function rows_for_host_key( string $host_key ): array {
		$key  = self::normalize_host_key( $host_key );
		$rows = array();
		foreach ( self::load()['rows'] as $row ) {
			if ( self::normalize_host_key( (string) ( $row['site'] ?? '' ) ) === $key ) {
				$rows[] = $row;
			}
		}
		return $rows;
	}

	/**
	 * @return array<string,mixed>|null Full row including password.
	 */
	public static function resolve_row( string $host_key, string $environment = 'production' ): ?array {
		$matches = self::rows_for_host_key( $host_key );
		if ( count( $matches ) === 0 ) {
			return null;
		}
		$want_staging = strtolower( $environment ) === 'staging';
		$filtered     = array_values(
			array_filter(
				$matches,
				static function ( array $row ) use ( $want_staging ): bool {
					return (bool) ( $row['isStaging'] ?? false ) === $want_staging;
				}
			)
		);
		if ( count( $filtered ) === 1 ) {
			return $filtered[0];
		}
		if ( count( $filtered ) > 1 ) {
			return $filtered[0];
		}
		if ( ! $want_staging ) {
			$prod = array_values(
				array_filter(
					$matches,
					static function ( array $row ): bool {
						return empty( $row['isStaging'] );
					}
				)
			);
			if ( count( $prod ) === 1 ) {
				return $prod[0];
			}
		}
		return count( $matches ) === 1 ? $matches[0] : null;
	}

	/**
	 * @param array<int,string> $host_keys
	 * @return array<string,array<string,mixed>>
	 */
	public static function match_host_keys( array $host_keys, bool $prefer_staging = false ): array {
		$out = array();
		foreach ( $host_keys as $host_key ) {
			$key = self::normalize_host_key( (string) $host_key );
			if ( $key === '' ) {
				continue;
			}
			$rows = self::rows_for_host_key( $key );
			if ( count( $rows ) === 0 ) {
				$out[ $key ] = array(
					'hostKey'     => $key,
					'matchStatus' => 'unmatched',
				);
				continue;
			}
			$row = self::resolve_row( $key, $prefer_staging ? 'staging' : 'production' );
			if ( $row === null ) {
				$out[ $key ] = array(
					'hostKey'     => $key,
					'matchStatus' => 'ambiguous',
					'candidates'  => count( $rows ),
				);
				continue;
			}
			$out[ $key ] = self::public_row( $row, 'matched' );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>
	 */
	public static function public_row( array $row, string $match_status ): array {
		return array(
			'hostKey'       => self::normalize_host_key( (string) ( $row['site'] ?? '' ) ),
			'catalogKey'    => (string) ( $row['site'] ?? '' ),
			'host'          => (string) ( $row['host'] ?? '' ),
			'port'          => isset( $row['port'] ) ? (int) $row['port'] : 2222,
			'username'      => (string) ( $row['username'] ?? '' ),
			'isStaging'     => ! empty( $row['isStaging'] ),
			'matchStatus'   => $match_status,
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function production_rows(): array {
		return array_values(
			array_filter(
				self::load()['rows'],
				static function ( array $row ): bool {
					$site = self::normalize_host_key( (string) ( $row['site'] ?? '' ) );
					if ( in_array( $site, self::EXCLUDED_SITES, true ) ) {
						return false;
					}
					return empty( $row['isStaging'] );
				}
			)
		);
	}
}

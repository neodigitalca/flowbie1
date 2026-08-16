<?php
/**
 * Deploy neo-pulse-wp to WP Engine client sites via SFTP.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Wpengine_Sftp_Deploy {

	private const REMOTE_ROOT = 'wp-content/plugins/neo-pulse-wp';
	private const VERIFY_FILE = 'neo-pulse-wp.php';
	private const SKIP_DIRS   = array( 'tests', '.git', 'node_modules' );
	private const SECRET_BASE = array(
		'neo-pulse-app-secrets.php',
		'neo-pulse-wp-secrets.php',
		'neo-pulse-wp-gsc-config.php',
		'.env',
	);

	/**
	 * @param array<string,mixed> $row Catalog row with password.
	 * @return array{ok:bool,error?:string,filesUploaded?:int,site?:string}
	 */
	public static function deploy_neo_pulse_wp( array $row ): array {
		$local_root = Neo_Pulse_App_Data_Paths::wpengine_plugin_staging_dir();
		if ( ! is_dir( $local_root ) || ! is_readable( $local_root . '/' . self::VERIFY_FILE ) ) {
			return array(
				'ok'    => false,
				'error' => 'neo-pulse-wp plugin is not staged on the server. Run neodigital deploy first.',
			);
		}

		require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/vendor/autoload.php';

		$host = (string) ( $row['host'] ?? '' );
		$port = isset( $row['port'] ) ? (int) $row['port'] : 2222;
		$user = (string) ( $row['username'] ?? '' );
		$pass = (string) ( $row['password'] ?? '' );
		$site = (string) ( $row['site'] ?? '' );

		if ( $host === '' || $user === '' || $pass === '' ) {
			return array( 'ok' => false, 'error' => 'Incomplete SFTP credentials' );
		}

		try {
			$sftp = new \phpseclib3\Net\SFTP( $host, $port > 0 ? $port : 2222 );
			$sftp->setTimeout( 30 );
			if ( ! $sftp->login( $user, $pass ) ) {
				return array( 'ok' => false, 'error' => 'SFTP login failed', 'site' => $site );
			}

			$files = self::collect_local_files( $local_root );
			if ( count( $files ) === 0 ) {
				return array( 'ok' => false, 'error' => 'No plugin files to upload', 'site' => $site );
			}

			$dirs = self::collect_remote_dirs( $files );
			foreach ( $dirs as $dir ) {
				if ( ! $sftp->mkdir( $dir, -1, true ) ) {
					// mkdir may fail when dir exists; continue.
				}
			}

			$uploaded = 0;
			foreach ( $files as $file ) {
				$remote = self::REMOTE_ROOT . '/' . $file['rel'];
				$data   = file_get_contents( $file['local'] );
				if ( $data === false ) {
					continue;
				}
				if ( ! $sftp->put( $remote, $data ) ) {
					return array(
						'ok'    => false,
						'error' => 'Upload failed: ' . $file['rel'],
						'site'  => $site,
					);
				}
				++$uploaded;
			}

			if ( ! $sftp->file_exists( self::REMOTE_ROOT . '/' . self::VERIFY_FILE ) ) {
				return array(
					'ok'    => false,
					'error' => 'Verify failed: ' . self::VERIFY_FILE . ' missing on remote',
					'site'  => $site,
				);
			}

			return array(
				'ok'            => true,
				'site'          => $site,
				'filesUploaded' => $uploaded,
			);
		} catch ( Throwable $e ) {
			return array(
				'ok'    => false,
				'error' => $e->getMessage(),
				'site'  => $site,
			);
		}
	}

	/**
	 * @return array<int,array{local:string,rel:string}>
	 */
	private static function collect_local_files( string $root, string $rel = '' ): array {
		$abs = $rel === '' ? $root : $root . '/' . $rel;
		if ( ! is_dir( $abs ) ) {
			return array();
		}
		$files = array();
		$ents  = scandir( $abs );
		if ( ! is_array( $ents ) ) {
			return array();
		}
		foreach ( $ents as $ent ) {
			if ( $ent === '.' || $ent === '..' ) {
				continue;
			}
			$next_rel = $rel === '' ? $ent : $rel . '/' . $ent;
			$norm     = str_replace( '\\', '/', $next_rel );
			if ( self::should_skip( $norm ) ) {
				continue;
			}
			$path = $root . '/' . $next_rel;
			if ( is_dir( $path ) ) {
				$files = array_merge( $files, self::collect_local_files( $root, $next_rel ) );
			} elseif ( is_file( $path ) ) {
				$files[] = array(
					'local' => $path,
					'rel'   => $norm,
				);
			}
		}
		return $files;
	}

	private static function should_skip( string $rel ): bool {
		$parts = explode( '/', $rel );
		foreach ( $parts as $part ) {
			if ( in_array( $part, self::SKIP_DIRS, true ) ) {
				return true;
			}
		}
		if ( ! str_contains( $rel, '/' ) && str_ends_with( strtolower( $rel ), '.md' ) ) {
			return true;
		}
		$base = basename( $rel );
		if ( in_array( $base, self::SECRET_BASE, true ) ) {
			return true;
		}
		if ( str_starts_with( $base, '.env' ) ) {
			return true;
		}
		if ( str_contains( $base, '-credentials' ) && str_ends_with( $base, '.json' ) ) {
			return true;
		}
		return false;
	}

	/**
	 * @param array<int,array{local:string,rel:string}> $files
	 * @return array<int,string>
	 */
	private static function collect_remote_dirs( array $files ): array {
		$dirs = array( self::REMOTE_ROOT );
		foreach ( $files as $file ) {
			$dir = dirname( self::REMOTE_ROOT . '/' . $file['rel'] );
			$dir = str_replace( '\\', '/', $dir );
			if ( $dir !== '.' && $dir !== self::REMOTE_ROOT ) {
				$dirs[] = $dir;
			}
		}
		$dirs = array_unique( $dirs );
		usort(
			$dirs,
			static function ( string $a, string $b ): int {
				return strlen( $a ) <=> strlen( $b );
			}
		);
		return array_values( $dirs );
	}
}

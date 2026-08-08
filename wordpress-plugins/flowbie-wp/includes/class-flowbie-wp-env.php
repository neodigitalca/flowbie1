<?php
/**
 * Resolve API secrets from plugin .env (loaded at boot) and wp-config constants.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Env {

	public static function load(): void {
		$path = FLOWBIE_WP_PLUGIN_DIR . '.env';
		if ( ! is_readable( $path ) ) {
			return;
		}

		$lines = file( $path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
		if ( ! is_array( $lines ) ) {
			return;
		}

		foreach ( $lines as $line ) {
			$line = trim( (string) $line );
			if ( $line === '' || $line[0] === '#' ) {
				continue;
			}
			$eq = strpos( $line, '=' );
			if ( $eq === false || $eq < 1 ) {
				continue;
			}
			$key = trim( substr( $line, 0, $eq ) );
			if ( $key === '' ) {
				continue;
			}
			$value = trim( substr( $line, $eq + 1 ) );
			if ( strlen( $value ) >= 2 ) {
				$first = $value[0];
				$last  = $value[ strlen( $value ) - 1 ];
				if ( ( $first === '"' && $last === '"' ) || ( $first === "'" && $last === "'" ) ) {
					$value = substr( $value, 1, -1 );
				}
			}
			if ( getenv( $key ) === false ) {
				putenv( $key . '=' . $value );
			}
			$_ENV[ $key ]    = $value;
			$_SERVER[ $key ] = $value;
		}

		self::define_from_env( 'FLOWBIE_WP_OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY', 'OPENROUTER_API_KEY' );
		self::mirror_constant( 'FLOWBIE_WP_OPENROUTER_API_KEY', 'FLOWBIE_APP_OPENROUTER_API_KEY' );

		self::define_from_env( 'FLOWBIE_WP_DATAFORSEO_LOGIN', 'DATAFORSEO_API_LOGIN', 'DATAFORSEO_LOGIN' );
		self::define_from_env( 'FLOWBIE_WP_DATAFORSEO_PASSWORD', 'DATAFORSEO_API_PASSWORD', 'DATAFORSEO_PASSWORD' );
		self::mirror_constant( 'FLOWBIE_WP_DATAFORSEO_LOGIN', 'FLOWBIE_APP_DATAFORSEO_LOGIN' );
		self::mirror_constant( 'FLOWBIE_WP_DATAFORSEO_PASSWORD', 'FLOWBIE_APP_DATAFORSEO_PASSWORD' );

		self::define_from_env( 'FLOWBIE_WP_AGENTMAIL_API_KEY', 'AGENTMAIL_API_KEY' );
		self::mirror_constant( 'FLOWBIE_WP_AGENTMAIL_API_KEY', 'FLOWBIE_APP_AGENTMAIL_API_KEY' );

		self::define_from_env( 'FLOWBIE_WP_AGENTMAIL_INBOX', 'AGENTMAIL_INBOX', 'AGENTMAIL_GENERAL_EMAIL' );
		self::mirror_constant( 'FLOWBIE_WP_AGENTMAIL_INBOX', 'FLOWBIE_APP_AGENTMAIL_INBOX' );

		self::define_from_env( 'FLOWBIE_WP_SEMRUSH_API_KEY', 'SEMRUSH_API_KEY' );
		self::mirror_constant( 'FLOWBIE_WP_SEMRUSH_API_KEY', 'FLOWBIE_APP_SEMRUSH_API_KEY' );

		self::define_from_env( 'FLOWBIE_WP_CHEKKIT_WEBHOOK_URL', 'CHEKKIT_WEBHOOK_URL', 'CHEKKIT_EVENTS_WEBHOOK_URL' );
	}

	/**
	 * @param string ...$names Environment variable names to try in order.
	 */
	private static function define_from_env( string ...$names ): void {
		$primary = $names[0];
		if ( defined( $primary ) ) {
			return;
		}
		foreach ( $names as $name ) {
			$val = getenv( $name );
			if ( is_string( $val ) && trim( $val ) !== '' ) {
				define( $primary, trim( $val ) );
				return;
			}
		}
	}

	private static function mirror_constant( string $source, string $target ): void {
		if ( defined( $target ) || ! defined( $source ) ) {
			return;
		}
		define( $target, constant( $source ) );
	}
}

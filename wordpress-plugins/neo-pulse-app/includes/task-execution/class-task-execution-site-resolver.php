<?php
/**
 * Resolve WordPress site credentials from sites.json mirror.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Task_Execution_Site_Resolver {

	/**
	 * @return array<string,mixed>|null
	 */
	public static function resolve_by_id( string $site_id ): ?array {
		$site_id = sanitize_text_field( $site_id );
		if ( $site_id === '' ) {
			return null;
		}
		$mirror = Neo_Pulse_App_Sites_Sync::load_mirror();
		if ( ! is_array( $mirror ) || empty( $mirror['sites'] ) || ! is_array( $mirror['sites'] ) ) {
			return null;
		}
		foreach ( $mirror['sites'] as $site ) {
			if ( ! is_array( $site ) ) {
				continue;
			}
			if ( (string) ( $site['id'] ?? '' ) === $site_id ) {
				return self::normalize_site( $site );
			}
		}
		return null;
	}

	/**
	 * WordPress REST auth tuple for Overview Meta AI and preflight.
	 *
	 * @return array<string,mixed>|null
	 */
	public static function wordpress_auth( string $site_id ): ?array {
		$site = self::resolve_by_id( $site_id );
		if ( ! $site ) {
			return null;
		}
		$url = rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' );
		$user = (string) ( $site['username'] ?? '' );
		$pass = (string) ( $site['appPassword'] ?? '' );
		if ( $url === '' || $user === '' || $pass === '' ) {
			return null;
		}
		return array(
			'siteUrl'     => $url,
			'username'    => $user,
			'appPassword' => $pass,
			'siteId'      => (string) ( $site['id'] ?? $site_id ),
			'name'        => (string) ( $site['name'] ?? '' ),
		);
	}

	/**
	 * @param array<string,mixed> $site
	 * @return array<string,mixed>
	 */
	private static function normalize_site( array $site ): array {
		return array(
			'id'                => (string) ( $site['id'] ?? '' ),
			'name'              => (string) ( $site['name'] ?? '' ),
			'siteUrl'           => rtrim( (string) ( $site['siteUrl'] ?? '' ), '/' ),
			'productionSiteUrl' => isset( $site['productionSiteUrl'] ) ? (string) $site['productionSiteUrl'] : '',
			'username'          => (string) ( $site['username'] ?? '' ),
			'appPassword'       => (string) ( $site['appPassword'] ?? '' ),
		);
	}
}

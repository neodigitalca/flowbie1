<?php
/**
 * Registry of Super Migrate source adapters.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/interface-neo-pulse-wp-migrate-adapter.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-acf.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-rank-math.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-hfcm.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-autoptimize.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-elementor.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-global-css.php';
require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-neo-pulse-native.php';

class Neo_Pulse_Wp_Super_Migrate_Registry {

	/** @var array<string, Neo_Pulse_Wp_Migrate_Adapter>|null */
	private static $adapters = null;

	/**
	 * @return array<string, Neo_Pulse_Wp_Migrate_Adapter>
	 */
	public static function all(): array {
		if ( null !== self::$adapters ) {
			return self::$adapters;
		}
		$list = array(
			new Neo_Pulse_Wp_Migrate_Source_Acf(),
			new Neo_Pulse_Wp_Migrate_Source_Rank_Math(),
			new Neo_Pulse_Wp_Migrate_Source_Hfcm(),
			new Neo_Pulse_Wp_Migrate_Source_Autoptimize(),
			new Neo_Pulse_Wp_Migrate_Source_Elementor(),
			new Neo_Pulse_Wp_Migrate_Source_Neo_Pulse_Native(),
		);
		self::$adapters = array();
		foreach ( $list as $adapter ) {
			self::$adapters[ $adapter->get_id() ] = $adapter;
		}
		return self::$adapters;
	}

	/**
	 * @return array<string, Neo_Pulse_Wp_Migrate_Adapter>
	 */
	public static function available(): array {
		$out = array();
		foreach ( self::all() as $id => $adapter ) {
			if ( $adapter->is_available() ) {
				$out[ $id ] = $adapter;
			}
		}
		return $out;
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function scan_sources(): array {
		$detected = array();
		foreach ( self::all() as $id => $adapter ) {
			$info = $adapter->detect();
			if ( ! empty( $info['active'] ) ) {
				$detected[ $id ] = $info;
			}
		}
		return $detected;
	}

	/**
	 * Build macro + micro plan for given phases.
	 *
	 * @param array<int, string> $phases crawl|apply.
	 * @return array{macro: array<int, array<string, mixed>>, micro: array<int, array<string, mixed>>}
	 */
	public static function build_plan( array $phases ): array {
		$macro_map = array();
		$micro     = array();

		foreach ( self::available() as $adapter ) {
			foreach ( $phases as $phase ) {
				$phase = sanitize_key( $phase );
				if ( ! in_array( $phase, array( 'crawl', 'apply' ), true ) ) {
					continue;
				}
				$steps = $adapter->get_steps( $phase );
				if ( empty( $steps ) ) {
					continue;
				}
				$group_id = $adapter->get_macro_group();
				if ( ! isset( $macro_map[ $group_id ] ) ) {
					$macro_map[ $group_id ] = array(
						'id'        => $group_id,
						'label'     => self::macro_label( $group_id ),
						'completed' => 0,
						'total'     => 0,
					);
				}
				foreach ( $steps as $step ) {
					$macro_map[ $group_id ]['total']++;
					$micro[] = array(
						'id'          => $step['id'],
						'adapter'     => $adapter->get_id(),
						'macro'       => $group_id,
						'label'       => $step['label'],
						'phase'       => $phase,
						'total'       => (int) ( $step['total'] ?? 1 ),
						'completed'   => 0,
						'status'      => 'pending',
						'batch_offset'=> 0,
					);
				}
			}
		}

		$macro = array_values( $macro_map );
		usort(
			$macro,
			static function ( $a, $b ) {
				return self::macro_order( $a['id'] ) <=> self::macro_order( $b['id'] );
			}
		);

		return array(
			'macro' => $macro,
			'micro' => $micro,
		);
	}

	/**
	 * @param string $group_id Macro group id.
	 */
	public static function macro_label( string $group_id ): string {
		foreach ( Neo_Pulse_Wp_Admin_Menu::get_menu_definition() as $group ) {
			if ( ! empty( $group['id'] ) && sanitize_key( (string) $group['id'] ) === $group_id ) {
				return (string) $group['label'];
			}
		}
		$fallback = array(
			'fields'      => __( 'Fields', 'neo-pulse-wp' ),
			'seo'         => __( 'SEO', 'neo-pulse-wp' ),
			'performance' => __( 'Performance', 'neo-pulse-wp' ),
		);
		return $fallback[ $group_id ] ?? ucfirst( str_replace( '_', ' ', $group_id ) );
	}

	/**
	 * @param string $group_id Macro group id.
	 */
	private static function macro_order( string $group_id ): int {
		$order = array( 'fields' => 1, 'seo' => 2, 'performance' => 3, 'general' => 0 );
		return $order[ $group_id ] ?? 99;
	}

	/**
	 * @param string $adapter_id Adapter id.
	 */
	public static function get_adapter( string $adapter_id ): ?Neo_Pulse_Wp_Migrate_Adapter {
		$all = self::all();
		return isset( $all[ $adapter_id ] ) ? $all[ $adapter_id ] : null;
	}
}

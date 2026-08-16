<?php
/**
 * Pulse Assist app module catalog (loaded from app-module-catalog.json).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Pulse_Assist_Module_Catalog {

	/** @var array<int,array<string,mixed>>|null */
	private static $modules = null;

	/** @var array<int,array<string,mixed>>|null */
	private static $feature_playbooks = null;

	private static function load(): void {
		if ( self::$modules !== null ) {
			return;
		}
		$path = NEO_PULSE_APP_PLUGIN_DIR . 'includes/pulse-assist/app-module-catalog.json';
		if ( ! is_readable( $path ) ) {
			self::$modules           = array();
			self::$feature_playbooks = array();
			return;
		}
		$raw = file_get_contents( $path );
		if ( ! is_string( $raw ) || $raw === '' ) {
			self::$modules           = array();
			self::$feature_playbooks = array();
			return;
		}
		$decoded = json_decode( $raw, true );
		if ( ! is_array( $decoded ) || empty( $decoded['modules'] ) || ! is_array( $decoded['modules'] ) ) {
			self::$modules           = array();
			self::$feature_playbooks = array();
			return;
		}
		self::$modules = $decoded['modules'];
		self::$feature_playbooks = ( ! empty( $decoded['featurePlaybooks'] ) && is_array( $decoded['featurePlaybooks'] ) )
			? $decoded['featurePlaybooks']
			: array();
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function all_feature_playbooks(): array {
		self::load();
		return self::$feature_playbooks ?? array();
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function all_modules(): array {
		self::load();
		return self::$modules ?? array();
	}

	/**
	 * @param string|null $section
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_modules( ?string $section = null ): array {
		$all = self::all_modules();
		if ( $section === null || $section === '' ) {
			return $all;
		}
		$section = sanitize_key( $section );
		$out     = array();
		foreach ( $all as $mod ) {
			if ( isset( $mod['section'] ) && sanitize_key( (string) $mod['section'] ) === $section ) {
				$out[] = $mod;
			}
		}
		return $out;
	}

	/**
	 * @param array<int,string> $queries
	 * @return array<int,array<string,mixed>>
	 */
	public static function lookup_modules( array $queries ): array {
		$all  = self::all_modules();
		$out  = array();
		$seen = array();

		foreach ( $queries as $raw ) {
			$q = strtolower( trim( (string) $raw ) );
			if ( $q === '' ) {
				continue;
			}
			foreach ( $all as $mod ) {
				$id = isset( $mod['id'] ) ? (string) $mod['id'] : '';
				if ( $id === '' || isset( $seen[ $id ] ) ) {
					continue;
				}
				if ( self::module_matches_query( $mod, $q ) ) {
					$out[]       = $mod;
					$seen[ $id ] = true;
				}
			}
		}

		return $out;
	}

	/**
	 * @param array<string,mixed> $mod
	 */
	private static function module_matches_query( array $mod, string $q ): bool {
		$id = isset( $mod['id'] ) ? strtolower( (string) $mod['id'] ) : '';
		if ( $id === $q || str_replace( '/', ' ', $id ) === $q ) {
			return true;
		}
		$parts = array(
			$mod['label'] ?? '',
			$mod['menuPath'] ?? '',
		);
		if ( ! empty( $mod['aliases'] ) && is_array( $mod['aliases'] ) ) {
			foreach ( $mod['aliases'] as $alias ) {
				$parts[] = $alias;
			}
		}
		$hay = strtolower( implode( ' ', array_map( 'strval', $parts ) ) );
		if ( str_contains( $hay, $q ) ) {
			return true;
		}
		foreach ( explode( ' ', $q ) as $token ) {
			if ( strlen( $token ) < 3 ) {
				continue;
			}
			if ( str_contains( $hay, $token ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function module_by_id( string $id ): ?array {
		$id = trim( $id );
		if ( $id === '' ) {
			return null;
		}
		foreach ( self::all_modules() as $mod ) {
			if ( isset( $mod['id'] ) && (string) $mod['id'] === $id ) {
				return $mod;
			}
		}
		return null;
	}

	/**
	 * @param array<string,mixed> $pulse_context
	 * @return string|null Module id from runtime location.
	 */
	public static function current_module_id_from_context( array $pulse_context ): ?string {
		$tab = isset( $pulse_context['managerTab'] ) ? sanitize_key( (string) $pulse_context['managerTab'] ) : '';
		if ( $tab === 'dashboard' && ! empty( $pulse_context['dashboardCluster'] ) ) {
			$cluster = sanitize_key( (string) $pulse_context['dashboardCluster'] );
			return 'dashboard/' . $cluster;
		}
		if ( $tab === 'generator' && ! empty( $pulse_context['generatorSection'] ) ) {
			$section = sanitize_key( (string) $pulse_context['generatorSection'] );
			return 'generator/' . $section;
		}
		foreach ( self::all_modules() as $mod ) {
			if ( empty( $mod['managerTab'] ) || sanitize_key( (string) $mod['managerTab'] ) !== $tab ) {
				continue;
			}
			if ( ! empty( $mod['generatorSection'] ) || ! empty( $mod['dashboardCluster'] ) ) {
				continue;
			}
			return isset( $mod['id'] ) ? (string) $mod['id'] : null;
		}
		return null;
	}

	/**
	 * @param array<int,array<string,mixed>> $modules
	 */
	public static function format_modules_block( array $modules ): string {
		if ( count( $modules ) === 0 ) {
			return '';
		}
		$lines = array( 'Researched app modules (use exact menuPath labels and pulseNav/hash links):' );
		foreach ( $modules as $mod ) {
			$label = isset( $mod['label'] ) ? (string) $mod['label'] : '';
			$path  = isset( $mod['menuPath'] ) ? (string) $mod['menuPath'] : '';
			$desc  = isset( $mod['description'] ) ? (string) $mod['description'] : '';
			$nav   = isset( $mod['pulseNav'] ) ? (string) $mod['pulseNav'] : '';
			$hash  = isset( $mod['hash'] ) ? (string) $mod['hash'] : '';
			$lines[] = '- **' . $path . '**';
			if ( $desc !== '' ) {
				$lines[] = '  ' . $desc;
			}
			if ( $nav !== '' ) {
				$lines[] = '  Link: [' . $path . '](' . $nav . ') or [' . $path . '](' . $hash . ')';
			}
			if ( ! empty( $mod['uiNotes'] ) && is_scalar( $mod['uiNotes'] ) ) {
				$lines[] = '  Note: ' . (string) $mod['uiNotes'];
			}
			if ( ! empty( $mod['features'] ) && is_array( $mod['features'] ) ) {
				$lines[] = '  Features: ' . implode( ', ', array_map( 'strval', $mod['features'] ) );
			}
		}
		return implode( "\n", $lines );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function module_to_nav( string $id ): ?array {
		$mod = self::module_by_id( $id );
		if ( ! $mod ) {
			return null;
		}
		return array(
			'id'       => $mod['id'] ?? '',
			'label'    => $mod['label'] ?? '',
			'menuPath' => $mod['menuPath'] ?? '',
			'hash'     => $mod['hash'] ?? '',
			'pulseNav' => $mod['pulseNav'] ?? '',
		);
	}

	/**
	 * @param array<int,string> $queries
	 * @return array<int,array<string,mixed>>
	 */
	public static function lookup_features( array $queries, int $min_tier = 2 ): array {
		$all  = self::all_feature_playbooks();
		$out  = array();
		$seen = array();

		foreach ( $queries as $raw ) {
			$q = strtolower( trim( (string) $raw ) );
			if ( $q === '' ) {
				continue;
			}
			foreach ( $all as $feat ) {
				$id = isset( $feat['id'] ) ? (string) $feat['id'] : '';
				if ( $id === '' || isset( $seen[ $id ] ) ) {
					continue;
				}
				if ( self::feature_match_tier( $feat, $q ) >= $min_tier ) {
					$out[]       = $feat;
					$seen[ $id ] = true;
				}
			}
		}

		return $out;
	}

	/**
	 * Match strength: 3 = exact id/question, 2 = label/alias phrase, 1 = token in label/question/aliases, 0 = none.
	 *
	 * @param array<string,mixed> $feat
	 */
	private static function feature_match_tier( array $feat, string $q ): int {
		$id = isset( $feat['id'] ) ? strtolower( (string) $feat['id'] ) : '';
		if ( $id === $q || str_replace( '/', ' ', $id ) === $q ) {
			return 3;
		}
		if ( str_contains( $q, '/' ) ) {
			return 0;
		}

		$question = strtolower( trim( (string) ( $feat['question'] ?? '' ) ) );
		if ( $question !== '' && ( $q === $question || str_contains( $q, $question ) || str_contains( $question, $q ) ) ) {
			return 3;
		}

		$label = strtolower( trim( (string) ( $feat['label'] ?? '' ) ) );
		if ( $label !== '' && ( str_contains( $q, $label ) || str_contains( $label, $q ) ) ) {
			return 2;
		}

		if ( ! empty( $feat['aliases'] ) && is_array( $feat['aliases'] ) ) {
			foreach ( $feat['aliases'] as $alias ) {
				$a = strtolower( trim( (string) $alias ) );
				if ( $a !== '' && ( str_contains( $q, $a ) || str_contains( $a, $q ) ) ) {
					return 2;
				}
			}
		}

		$parts = array(
			$feat['label'] ?? '',
			$feat['question'] ?? '',
		);
		if ( ! empty( $feat['aliases'] ) && is_array( $feat['aliases'] ) ) {
			foreach ( $feat['aliases'] as $alias ) {
				$parts[] = $alias;
			}
		}
		$hay = strtolower( implode( ' ', array_map( 'strval', $parts ) ) );
		foreach ( explode( ' ', $q ) as $token ) {
			if ( strlen( $token ) < 4 ) {
				continue;
			}
			if ( str_contains( $hay, $token ) ) {
				return 1;
			}
		}

		return 0;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function feature_by_id( string $id ): ?array {
		$id = trim( $id );
		if ( $id === '' ) {
			return null;
		}
		foreach ( self::all_feature_playbooks() as $feat ) {
			if ( isset( $feat['id'] ) && (string) $feat['id'] === $id ) {
				return $feat;
			}
		}
		return null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function playbooks_for_module( string $module_id ): array {
		$module_id = trim( $module_id );
		if ( $module_id === '' ) {
			return array();
		}
		$out = array();
		foreach ( self::all_feature_playbooks() as $feat ) {
			if ( isset( $feat['moduleId'] ) && (string) $feat['moduleId'] === $module_id ) {
				$out[] = $feat;
			}
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $playbooks
	 */
	public static function format_features_block( array $playbooks ): string {
		if ( count( $playbooks ) === 0 ) {
			return '';
		}
		$lines = array( 'Researched feature playbooks (use steps only when the user asked about that specific feature):' );
		foreach ( $playbooks as $feat ) {
			$label = isset( $feat['label'] ) ? (string) $feat['label'] : '';
			$mod   = isset( $feat['moduleId'] ) ? self::module_by_id( (string) $feat['moduleId'] ) : null;
			$path  = is_array( $mod ) && ! empty( $mod['menuPath'] ) ? (string) $mod['menuPath'] : '';
			$nav   = isset( $feat['pulseNav'] ) ? (string) $feat['pulseNav'] : '';
			$lines[] = '- **' . $label . '**' . ( $path !== '' ? ' (' . $path . ')' : '' );
			if ( ! empty( $feat['steps'] ) && is_array( $feat['steps'] ) ) {
				$n = 1;
				foreach ( $feat['steps'] as $step ) {
					$lines[] = '  ' . $n . '. ' . (string) $step;
					++$n;
				}
			}
			if ( $nav !== '' ) {
				$lines[] = '  Link: ' . $nav;
			}
		}
		return implode( "\n", $lines );
	}
}

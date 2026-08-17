<?php
/**
 * Elementor ACF dynamic tags → NEO Pulse Fields dynamic tags migration.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Migrate_Elementor_Dynamic_Tags {

	const BATCH_POSTS = 50;
	const META_KEY    = '_elementor_data';

	const WALK_MODE_IDLE             = 'idle';
	const WALK_MODE_MIGRATE_TO_NEO_PULSE = 'migrate_to_neo_pulse';
	const WALK_MODE_SCAN             = 'scan';
	const WALK_MODE_REVERT_TO_ACF    = 'revert_to_acf';

	/** @var string */
	private static $walk_mode = self::WALK_MODE_IDLE;

	/** @var array<string, array<string, mixed>>|null */
	private static $field_index = null;

	public static function set_walk_mode( string $mode ): void {
		$allowed = array(
			self::WALK_MODE_IDLE,
			self::WALK_MODE_MIGRATE_TO_NEO_PULSE,
			self::WALK_MODE_SCAN,
			self::WALK_MODE_REVERT_TO_ACF,
		);
		self::$walk_mode = in_array( $mode, $allowed, true ) ? $mode : self::WALK_MODE_IDLE;
	}

	public static function get_walk_mode(): string {
		return self::$walk_mode;
	}

	public static function reset_walk_mode(): void {
		self::$walk_mode = self::WALK_MODE_IDLE;
	}

	private static function should_migrate_widgets(): bool {
		return in_array(
			self::$walk_mode,
			array( self::WALK_MODE_MIGRATE_TO_NEO_PULSE, self::WALK_MODE_SCAN ),
			true
		);
	}

	private static function begin_migration_tag_registration(): void {
		if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-settings.php';
		}
		Neo_Pulse_Wp_Fields_Elementor_Settings::force_options_tags_for_migration( true );
	}

	private static function end_migration_tag_registration(): void {
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false ) ) {
			Neo_Pulse_Wp_Fields_Elementor_Settings::force_options_tags_for_migration( false );
		}
	}

	/**
	 * ACF Elementor tag slug → NEO Pulse tag family (text|image|url|gallery).
	 *
	 * @var array<string, string>
	 */
	private static $acf_tag_families = array(
		'acf-text'           => 'text',
		'acf-number'         => 'text',
		'acf-color'          => 'text',
		'acf-date-time'      => 'text',
		'acf-field'          => 'text',
		'acf-image'          => 'image',
		'acf-url'            => 'url',
		'acf-file'           => 'url',
		'acf-gallery'        => 'gallery',
		'post-custom-field'  => 'text',
	);

	/**
	 * @return array<string, array<string, mixed>>
	 */
	public static function build_field_index(): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		self::$field_index = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::build_field_index();
		return self::$field_index;
	}

	public static function reset_field_index(): void {
		self::$field_index = null;
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::reset_field_index();
	}

	/**
	 * @return array<int, array{id: string, name: string, settings: array<string, mixed>, full: string}>|null
	 */
	public static function parse_elementor_tag_shortcodes( string $value ): ?array {
		if ( $value === '' || strpos( $value, 'elementor-tag' ) === false ) {
			return null;
		}

		if ( ! preg_match_all( '/\[elementor-tag\s+([^\]]+)\]/', $value, $matches, PREG_SET_ORDER ) ) {
			return null;
		}

		$tags = array();
		foreach ( $matches as $match ) {
			$attrs        = (string) $match[1];
			$name         = self::parse_tag_attr( $attrs, 'name' );
			$id           = self::parse_tag_attr( $attrs, 'id' );
			$settings_raw = self::parse_tag_attr( $attrs, 'settings' );
			if ( $name === '' || $settings_raw === '' ) {
				continue;
			}

			$settings_raw = rawurldecode( $settings_raw );
			if ( strpos( $settings_raw, '&quot;' ) !== false || strpos( $settings_raw, '&#039;' ) !== false ) {
				$settings_raw = html_entity_decode( $settings_raw, ENT_QUOTES, 'UTF-8' );
			}
			$settings = json_decode( $settings_raw, true );
			if ( ! is_array( $settings ) ) {
				$settings = array();
			}

			$tags[] = array(
				'id'       => $id !== '' ? $id : substr( md5( $name . $settings_raw ), 0, 7 ),
				'name'     => $name,
				'settings' => $settings,
				'full'     => (string) $match[0],
			);
		}

		return empty( $tags ) ? null : $tags;
	}

	private static function parse_tag_attr( string $attrs, string $attr ): string {
		if ( preg_match( '/\b' . preg_quote( $attr, '/' ) . '="([^"]*)"/', $attrs, $match ) ) {
			return (string) $match[1];
		}
		if ( preg_match( "/\\b" . preg_quote( $attr, '/' ) . "='([^']*)'/", $attrs, $match ) ) {
			return (string) $match[1];
		}
		return '';
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array{name: string, settings: array<string, mixed>}|null
	 */
	public static function map_acf_tag( string $tag_name, array $settings ) {
		$family = self::acf_tag_family( $tag_name );
		if ( $family === null ) {
			return null;
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		$resolved = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_from_settings( $settings );
		if ( $resolved === null ) {
			return null;
		}

		$is_options = ! empty( $resolved['options_slug'] );
		$neo_pulse    = self::neo_pulse_tag_name( $family, $is_options );

		$new_settings = array();
		if ( $is_options ) {
			$new_settings['field_name'] = self::neo_pulse_options_field_key(
				(string) $resolved['options_slug'],
				(string) $resolved['field_name']
			);
		} else {
			$new_settings['field_name'] = (string) $resolved['field_name'];
		}

		return array(
			'name'     => $neo_pulse,
			'settings' => $new_settings,
		);
	}

	private static function acf_tag_family( string $tag_name ): ?string {
		$tag_name = sanitize_key( $tag_name );
		if ( isset( self::$acf_tag_families[ $tag_name ] ) ) {
			return self::$acf_tag_families[ $tag_name ];
		}
		if ( 0 === strpos( $tag_name, 'acf-' ) ) {
			return 'text';
		}
		return null;
	}

	private static function neo_pulse_tag_name( string $family, bool $is_options ): string {
		$map = array(
			'text'    => $is_options ? 'neo-pulse-options-field' : 'neo-pulse-field',
			'image'   => $is_options ? 'neo-pulse-options-image' : 'neo-pulse-image',
			'url'     => $is_options ? 'neo-pulse-options-url' : 'neo-pulse-url',
			'gallery' => $is_options ? 'neo-pulse-options-gallery' : 'neo-pulse-gallery',
		);
		return $map[ $family ] ?? ( $is_options ? 'neo-pulse-options-field' : 'neo-pulse-field' );
	}

	public static function neo_pulse_options_field_key( string $options_slug, string $field_name ): string {
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Registry', false ) ) {
			return Neo_Pulse_Wp_Fields_Elementor_Registry::options_field_key( $options_slug, $field_name );
		}
		return $options_slug . '::' . $field_name;
	}

	/**
	 * Build a NEO Pulse Elementor tag shortcode from a resolved field binding.
	 *
	 * @param array{field_name: string, options_slug?: string|null} $resolved
	 */
	public static function build_neo_pulse_tag_from_resolved( string $family, array $resolved, string $id_seed = '' ): string {
		$is_options = ! empty( $resolved['options_slug'] );
		$name       = self::neo_pulse_tag_name( $family, $is_options );
		$settings   = array();
		if ( $is_options ) {
			$settings['field_name'] = self::neo_pulse_options_field_key(
				(string) $resolved['options_slug'],
				(string) $resolved['field_name']
			);
		} else {
			$settings['field_name'] = (string) $resolved['field_name'];
		}
		$id = $id_seed !== '' ? substr( md5( $id_seed ), 0, 7 ) : substr( md5( $name . wp_json_encode( $settings ) ), 0, 7 );
		return self::build_elementor_tag_shortcode( $id, $name, $settings );
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	public static function resolve_acf_key_setting( string $key ): ?array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_acf_key( $key );
	}

	/**
	 * @return array{value: string, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	public static function rewrite_string( string $value ): array {
		$mode = self::$walk_mode;

		if ( self::WALK_MODE_REVERT_TO_ACF === $mode ) {
			return self::revert_neo_pulse_string( $value );
		}

		if ( ! self::should_migrate_widgets()
			&& ! apply_filters( 'neo_pulse_wp_migrate_rewrite_elementor_tags', false ) ) {
			return array(
				'value'        => $value,
				'replacements' => 0,
				'skipped'      => 0,
				'tags_found'   => array(),
			);
		}

		return self::migrate_acf_string_to_neo_pulse( $value );
	}

	/**
	 * Forward-migrate ACF Elementor tag shortcodes to NEO Pulse tags.
	 *
	 * @return array{value: string, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	private static function migrate_acf_string_to_neo_pulse( string $value ): array {
		$stats = array(
			'replacements' => 0,
			'skipped'      => 0,
			'tags_found'   => array(),
		);

		$tags = self::parse_elementor_tag_shortcodes( $value );
		if ( empty( $tags ) ) {
			return array(
				'value'        => $value,
				'replacements' => 0,
				'skipped'      => 0,
				'tags_found'   => array(),
			);
		}

		foreach ( $tags as $tag ) {
			$name = (string) ( $tag['name'] ?? '' );
			if ( $name !== '' ) {
				$stats['tags_found'][ $name ] = (int) ( $stats['tags_found'][ $name ] ?? 0 ) + 1;
			}

			if ( 0 === strpos( $name, 'neo-pulse-' ) ) {
				continue;
			}

			$mapped = self::map_acf_tag( $name, is_array( $tag['settings'] ?? null ) ? $tag['settings'] : array() );
			if ( $mapped === null ) {
				++$stats['skipped'];
				continue;
			}

			$new_shortcode = self::build_elementor_tag_shortcode(
				(string) ( $tag['id'] ?? substr( md5( $name . uniqid( '', true ) ), 0, 7 ) ),
				(string) $mapped['name'],
				$mapped['settings']
			);
			$value = str_replace( (string) $tag['full'], $new_shortcode, $value );
			++$stats['replacements'];
		}

		return array(
			'value'        => $value,
			'replacements' => $stats['replacements'],
			'skipped'      => $stats['skipped'],
			'tags_found'   => $stats['tags_found'],
		);
	}

	/**
	 * @param array<string, mixed> $settings
	 */
	public static function build_elementor_tag_shortcode( string $id, string $name, array $settings ): string {
		$json     = wp_json_encode( $settings );
		$encoded  = rawurlencode( is_string( $json ) ? $json : '{}' );
		$safe_id  = preg_replace( '/[^a-z0-9]/', '', $id );
		if ( ! is_string( $safe_id ) || $safe_id === '' ) {
			$safe_id = substr( md5( $name . $encoded ), 0, 7 );
		}
		return '[elementor-tag id="' . $safe_id . '" name="' . $name . '" settings="' . $encoded . '"]';
	}

	/**
	 * @param array<int, array<string, mixed>> $elements
	 * @return array{elements: array<int, array<string, mixed>>, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	public static function walk_elements( array $elements ): array {
		$totals = array(
			'replacements' => 0,
			'skipped'      => 0,
			'tags_found'   => array(),
		);

		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			if ( ! empty( $element['settings'] ) && is_array( $element['settings'] ) ) {
				$result = self::walk_settings( $element['settings'] );
				$element['settings'] = $result['settings'];
				self::merge_stats( $totals, $result );
				if ( self::should_migrate_widgets() && (string) ( $element['widgetType'] ?? '' ) === 'icon-list' ) {
					$icon_repair = self::repair_icon_list_settings( $element['settings'] );
					if ( ! empty( $icon_repair['changed'] ) ) {
						$element['settings'] = $icon_repair['settings'];
						$totals['replacements'] += (int) ( $icon_repair['replacements'] ?? 0 );
					}
				}
				if ( class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Cache_Fix', false )
					&& Neo_Pulse_Wp_Fields_Elementor_Cache_Fix::settings_have_dynamic_tags( $element['settings'] ) ) {
					$element['settings']['_element_cache'] = 'yes';
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$nested = self::walk_elements( $element['elements'] );
				$element['elements'] = $nested['elements'];
				self::merge_stats( $totals, $nested );
			}
		}
		unset( $element );

		return array(
			'elements'     => $elements,
			'replacements' => $totals['replacements'],
			'skipped'      => $totals['skipped'],
			'tags_found'   => $totals['tags_found'],
		);
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array{settings: array<string, mixed>, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	public static function walk_settings( array $settings ): array {
		$totals = array(
			'replacements' => 0,
			'skipped'      => 0,
			'tags_found'   => array(),
		);

		foreach ( $settings as $key => $value ) {
			if ( is_string( $value ) ) {
				$result = self::rewrite_string( $value );
				$settings[ $key ] = $result['value'];
				self::merge_stats( $totals, $result );
				continue;
			}
			if ( is_array( $value ) ) {
				$result = self::walk_settings_array( $value );
				$settings[ $key ] = $result['settings'];
				self::merge_stats( $totals, $result );
			}
		}

		return array(
			'settings'     => $settings,
			'replacements' => $totals['replacements'],
			'skipped'      => $totals['skipped'],
			'tags_found'   => $totals['tags_found'],
		);
	}

	/**
	 * @param array<int|string, mixed> $items
	 * @return array{settings: array<int|string, mixed>, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	private static function walk_settings_array( array $items ): array {
		$totals = array(
			'replacements' => 0,
			'skipped'      => 0,
			'tags_found'   => array(),
		);

		foreach ( $items as $idx => $item ) {
			if ( is_string( $item ) ) {
				$result = self::rewrite_string( $item );
				$items[ $idx ] = $result['value'];
				self::merge_stats( $totals, $result );
				continue;
			}
			if ( is_array( $item ) ) {
				$result = self::walk_settings( $item );
				$items[ $idx ] = $result['settings'];
				self::merge_stats( $totals, $result );
			}
		}

		return array(
			'settings'     => $items,
			'replacements' => $totals['replacements'],
			'skipped'      => $totals['skipped'],
			'tags_found'   => $totals['tags_found'],
		);
	}

	/**
	 * @param array<string, int|array<string, int>> $into
	 * @param array<string, mixed>                  $from
	 */
	private static function merge_stats( array &$into, array $from ): void {
		$into['replacements'] += (int) ( $from['replacements'] ?? 0 );
		$into['skipped']      += (int) ( $from['skipped'] ?? 0 );
		foreach ( (array) ( $from['tags_found'] ?? array() ) as $tag => $count ) {
			$into['tags_found'][ (string) $tag ] = (int) ( $into['tags_found'][ (string) $tag ] ?? 0 ) + (int) $count;
		}
	}

	/**
	 * @return array<int, int>
	 */
	public static function elementor_document_ids(): array {
		global $wpdb;

		if ( ! isset( $wpdb ) ) {
			return array();
		}

		$post_types = apply_filters(
			'neo_pulse_wp_migrate_elementor_dynamic_tags_post_types',
			array_merge(
				array( 'page', 'post', 'elementor_library' ),
				array_values(
					array_diff(
						get_post_types( array( 'public' => true ), 'names' ),
						array( 'attachment', 'revision', 'nav_menu_item' )
					)
				)
			)
		);

		$post_types = array_values( array_unique( array_filter( array_map( 'sanitize_key', $post_types ) ) ) );
		if ( empty( $post_types ) ) {
			return array();
		}

		$placeholders = implode( ',', array_fill( 0, count( $post_types ), '%s' ) );
		$sql          = "
			SELECT DISTINCT p.ID
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key = %s
			WHERE p.post_type IN ($placeholders)
			AND p.post_status NOT IN ('trash', 'auto-draft')
			AND pm.meta_value != ''
			ORDER BY p.ID ASC
		";

		$params = array_merge( array( self::META_KEY ), $post_types );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$prepared = $wpdb->prepare( $sql, $params );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$ids = $wpdb->get_col( $prepared );

		if ( ! is_array( $ids ) ) {
			return array();
		}

		return array_values( array_map( 'intval', $ids ) );
	}

	/**
	 * @return array{ok: bool, changes: int, replacements: int, skipped: int, tags_found: array<string, int>, tags_found_list: array<string, int>}
	 */
	public static function scan_post( int $post_id ): array {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array(
				'ok'             => true,
				'changes'        => 0,
				'replacements'   => 0,
				'skipped'        => 0,
				'tags_found'     => array(),
				'tags_found_list'=> array(),
			);
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array(
				'ok'             => false,
				'changes'        => 0,
				'replacements'   => 0,
				'skipped'        => 0,
				'tags_found'     => array(),
				'tags_found_list'=> array(),
			);
		}

		$result = self::walk_elements( $data );
		return array(
			'ok'              => true,
			'changes'         => (int) $result['replacements'],
			'replacements'    => (int) $result['replacements'],
			'skipped'         => (int) $result['skipped'],
			'tags_found'      => $result['tags_found'],
			'tags_found_list' => $result['tags_found'],
		);
	}

	/**
	 * @return array{ok: bool, changes: int, replacements: int, skipped: int}
	 */
	public static function apply_post( int $post_id, bool $dry = false ): array {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array(
				'ok'           => true,
				'changes'      => 0,
				'replacements' => 0,
				'skipped'      => 0,
			);
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array(
				'ok'           => false,
				'changes'      => 0,
				'replacements' => 0,
				'skipped'      => 0,
			);
		}

		$result = self::walk_elements( $data );
		if ( (int) $result['replacements'] < 1 ) {
			return array(
				'ok'           => true,
				'changes'      => 0,
				'replacements' => 0,
				'skipped'      => (int) $result['skipped'],
			);
		}

		if ( $dry ) {
			return array(
				'ok'           => true,
				'changes'      => (int) $result['replacements'],
				'replacements' => (int) $result['replacements'],
				'skipped'      => (int) $result['skipped'],
			);
		}

		$json = wp_json_encode( $result['elements'] );
		if ( ! is_string( $json ) ) {
			return array(
				'ok'           => false,
				'changes'      => 0,
				'replacements' => 0,
				'skipped'      => 0,
			);
		}

		update_post_meta( $post_id, self::META_KEY, wp_slash( $json ) );
		delete_post_meta( $post_id, '_elementor_element_cache' );

		return array(
			'ok'           => true,
			'changes'      => (int) $result['replacements'],
			'replacements' => (int) $result['replacements'],
			'skipped'      => (int) $result['skipped'],
		);
	}

	/**
	 * @param array<int, int> $post_ids
	 * @return array{documents: int, replacements: int, skipped: int, tags_found: array<string, int>, posts: array<int, array<string, mixed>>}
	 */
	public static function crawl_documents( array $post_ids ): array {
		$previous = self::$walk_mode;
		self::set_walk_mode( self::WALK_MODE_SCAN );
		self::build_field_index();

		$summary = array(
			'documents'   => 0,
			'replacements'=> 0,
			'skipped'     => 0,
			'tags_found'  => array(),
			'posts'       => array(),
		);

		try {
			foreach ( $post_ids as $post_id ) {
				$post_id = (int) $post_id;
				if ( $post_id < 1 ) {
					continue;
				}
				$scan = self::scan_post( $post_id );
				if ( empty( $scan['ok'] ) ) {
					continue;
				}
				if ( (int) ( $scan['replacements'] ?? 0 ) < 1 && (int) ( $scan['skipped'] ?? 0 ) < 1 ) {
					continue;
				}

				++$summary['documents'];
				$summary['replacements'] += (int) $scan['replacements'];
				$summary['skipped']      += (int) $scan['skipped'];
				self::merge_stats( $summary, $scan );

				$post = get_post( $post_id );
				$summary['posts'][] = array(
					'id'           => $post_id,
					'title'        => $post instanceof WP_Post ? $post->post_title : (string) $post_id,
					'post_type'    => $post instanceof WP_Post ? $post->post_type : '',
					'changes'      => (int) $scan['replacements'],
					'tags_found'   => $scan['tags_found'],
				);
			}
		} finally {
			self::set_walk_mode( $previous );
		}

		return $summary;
	}

	/**
	 * @param array<int, int> $post_ids
	 * @return array{processed: int, replacements: int, skipped: int, documents_updated: int}
	 */
	public static function apply_documents( array $post_ids, bool $dry = false ): array {
		$previous = self::$walk_mode;
		self::set_walk_mode( self::WALK_MODE_MIGRATE_TO_NEO_PULSE );
		self::begin_migration_tag_registration();
		self::build_field_index();

		$stats = array(
			'processed'         => 0,
			'replacements'      => 0,
			'skipped'           => 0,
			'documents_updated' => 0,
		);

		try {
			foreach ( $post_ids as $post_id ) {
				$post_id = (int) $post_id;
				if ( $post_id < 1 ) {
					continue;
				}
				$result = self::apply_post( $post_id, $dry );
				++$stats['processed'];
				$stats['replacements'] += (int) ( $result['replacements'] ?? 0 );
				$stats['skipped']      += (int) ( $result['skipped'] ?? 0 );
				if ( (int) ( $result['changes'] ?? 0 ) > 0 ) {
					++$stats['documents_updated'];
				}
			}

			if ( ! $dry && $stats['documents_updated'] > 0 ) {
				self::clear_elementor_cache();
			}
		} finally {
			self::end_migration_tag_registration();
			self::set_walk_mode( $previous );
		}

		return $stats;
	}

	public static function clear_elementor_cache(): void {
		if ( ! class_exists( '\Elementor\Plugin', false ) ) {
			return;
		}
		$plugin = \Elementor\Plugin::$instance;
		if ( isset( $plugin->files_manager ) && method_exists( $plugin->files_manager, 'clear_cache' ) ) {
			$plugin->files_manager->clear_cache();
		}
	}

	/**
	 * @return array<string, string>
	 */
	private static function neo_pulse_to_acf_tag_map(): array {
		return array(
			'neo-pulse-options-field'   => 'acf-text',
			'neo-pulse-options-url'     => 'acf-url',
			'neo-pulse-options-image'   => 'acf-image',
			'neo-pulse-options-gallery' => 'acf-gallery',
			'neo-pulse-field'           => 'acf-text',
			'neo-pulse-url'             => 'acf-url',
			'neo-pulse-image'           => 'acf-image',
			'neo-pulse-gallery'         => 'acf-gallery',
		);
	}

	/**
	 * Restore legacy ACF dynamic tag shortcodes from migrated NEO Pulse tag names.
	 *
	 * @return array{value: string, replacements: int, skipped: int, tags_found: array<string, int>}
	 */
	public static function revert_neo_pulse_string( string $value ): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		self::build_field_index();

		$stats = array(
			'replacements' => 0,
			'skipped'      => 0,
			'tags_found'   => array(),
		);
		$map   = self::neo_pulse_to_acf_tag_map();
		$tags  = self::parse_elementor_tag_shortcodes( $value );
		if ( empty( $tags ) ) {
			return array(
				'value'        => $value,
				'replacements' => 0,
				'skipped'      => 0,
				'tags_found'   => array(),
			);
		}

		foreach ( $tags as $tag ) {
			$name = (string) ( $tag['name'] ?? '' );
			if ( $name !== '' ) {
				$stats['tags_found'][ $name ] = (int) ( $stats['tags_found'][ $name ] ?? 0 ) + 1;
			}
			if ( ! isset( $map[ $name ] ) ) {
				continue;
			}
			$settings = is_array( $tag['settings'] ?? null ) ? $tag['settings'] : array();
			$resolved = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_from_tag_settings( $settings );
			if ( $resolved === null ) {
				++$stats['skipped'];
				continue;
			}
			$key = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::to_acf_key_setting( $resolved );
			if ( $key === '' ) {
				++$stats['skipped'];
				continue;
			}
			$new_shortcode = self::build_elementor_tag_shortcode(
				(string) ( $tag['id'] ?? substr( md5( $name . $key ), 0, 7 ) ),
				(string) $map[ $name ],
				array( 'key' => $key )
			);
			$value = str_replace( (string) $tag['full'], $new_shortcode, $value );
			++$stats['replacements'];
		}

		return array(
			'value'        => $value,
			'replacements' => $stats['replacements'],
			'skipped'      => $stats['skipped'],
			'tags_found'   => $stats['tags_found'],
		);
	}

	/**
	 * @param array<string, mixed> $settings
	 * @return array{settings: array<string, mixed>, changed: bool, replacements: int}
	 */
	public static function repair_icon_list_settings( array $settings ): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		self::build_field_index();

		$items = isset( $settings['icon_list'] ) && is_array( $settings['icon_list'] ) ? $settings['icon_list'] : array();
		if ( empty( $items ) ) {
			return array(
				'settings'     => $settings,
				'changed'      => false,
				'replacements' => 0,
			);
		}

		$replacements = 0;
		$hour_fields  = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::options_fields_for_patterns( array( '/hours/i' ) );
		if ( count( $hour_fields ) === count( $items ) && self::icon_list_needs_repair( $items ) ) {
			foreach ( $items as $index => &$item ) {
				if ( ! is_array( $item ) || ! isset( $hour_fields[ $index ] ) ) {
					continue;
				}
				$resolved = array(
					'field_name'   => (string) $hour_fields[ $index ]['name'],
					'options_slug' => (string) $hour_fields[ $index ]['options_slug'],
				);
				if ( $resolved['field_name'] === '' || $resolved['options_slug'] === '' ) {
					continue;
				}
				$item['text']             = '';
				$item['__dynamic__text'] = self::build_neo_pulse_tag_from_resolved(
					'text',
					$resolved,
					'hours-' . $resolved['options_slug'] . '-' . $resolved['field_name'] . '-' . $index
				);
				unset( $item['__dynamic__'] );
				++$replacements;
			}
			unset( $item );
			if ( $replacements > 0 ) {
				$settings['icon_list'] = $items;
				$settings['_element_cache'] = 'yes';
				return array(
					'settings'     => $settings,
					'changed'      => true,
					'replacements' => $replacements,
				);
			}
		}

		$contact_map = array(
			array(
				'link'    => '/^tel:/i',
				'fields'  => array( '/phone/i', '/tel/i' ),
				'url'     => array( '/phone.*link/i', '/tel/i', '/phone/i' ),
			),
			array(
				'link'    => '/^mailto:/i',
				'fields'  => array( '/email/i' ),
				'url'     => array( '/email/i' ),
			),
			array(
				'link'    => '/maps|google/i',
				'fields'  => array( '/maps/i', '/direction/i', '/address/i' ),
				'url'     => array( '/maps/i', '/direction/i' ),
			),
		);

		if ( count( $items ) === count( $contact_map ) ) {
			foreach ( $items as $index => &$item ) {
				if ( ! is_array( $item ) || ! isset( $contact_map[ $index ] ) ) {
					continue;
				}
				if ( ! empty( $item['__dynamic__text'] ) || ! empty( $item['__dynamic__link.url'] ) ) {
					continue;
				}
				$link = (string) ( $item['link']['url'] ?? '' );
				if ( $link === '' ) {
					continue;
				}
				$rule = $contact_map[ $index ];
				if ( ! preg_match( (string) $rule['link'], $link ) ) {
					continue;
				}
				$text_fields = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::options_fields_for_patterns( (array) $rule['fields'] );
				$url_fields  = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::options_fields_for_patterns( (array) $rule['url'] );
				if ( empty( $text_fields ) ) {
					continue;
				}
				$text_resolved = array(
					'field_name'   => (string) $text_fields[0]['name'],
					'options_slug' => (string) $text_fields[0]['options_slug'],
				);
				if ( $text_resolved['field_name'] === '' || $text_resolved['options_slug'] === '' ) {
					continue;
				}
				$item['__dynamic__text'] = self::build_neo_pulse_tag_from_resolved(
					'text',
					$text_resolved,
					'contact-text-' . $text_resolved['options_slug'] . '-' . $text_resolved['field_name'] . '-' . $index
				);
				$item['text'] = '';
				++$replacements;
				if ( ! empty( $url_fields ) ) {
					$url_resolved = array(
						'field_name'   => (string) $url_fields[0]['name'],
						'options_slug' => (string) $url_fields[0]['options_slug'],
					);
					if ( $url_resolved['field_name'] !== '' && $url_resolved['options_slug'] !== '' ) {
						$item['__dynamic__link.url'] = self::build_neo_pulse_tag_from_resolved(
							'url',
							$url_resolved,
							'contact-url-' . $url_resolved['options_slug'] . '-' . $url_resolved['field_name'] . '-' . $index
						);
						if ( isset( $item['link'] ) && is_array( $item['link'] ) ) {
							$item['link']['url'] = '';
						}
						++$replacements;
					}
				}
			}
			unset( $item );
		}

		if ( $replacements > 0 ) {
			$settings['icon_list']      = $items;
			$settings['_element_cache'] = 'yes';
		}

		return array(
			'settings'     => $settings,
			'changed'      => $replacements > 0,
			'replacements' => $replacements,
		);
	}

	/**
	 * @param array<int, array<string, mixed>> $items
	 */
	private static function icon_list_needs_repair( array $items ): bool {
		if ( empty( $items ) ) {
			return false;
		}
		$texts = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( ! empty( $item['__dynamic__text'] ) || ! empty( $item['__dynamic__link.url'] ) ) {
				return false;
			}
			$texts[] = trim( (string) ( $item['text'] ?? '' ) );
		}
		if ( empty( $texts ) ) {
			return false;
		}
		return count( array_unique( $texts ) ) === 1;
	}

	/**
	 * @return array{documents_processed: int, documents_patched: int, replacements: int}
	 */
	public static function revert_all_documents(): array {
		$previous = self::$walk_mode;
		self::set_walk_mode( self::WALK_MODE_REVERT_TO_ACF );
		$processed    = 0;
		$patched      = 0;
		$replacements = 0;
		try {
			foreach ( self::elementor_document_ids() as $post_id ) {
				++$processed;
				$result = self::revert_post( (int) $post_id );
				$replacements += (int) ( $result['replacements'] ?? 0 );
				if ( ! empty( $result['changed'] ) ) {
					++$patched;
				}
			}
		} finally {
			self::set_walk_mode( $previous );
		}
		if ( $patched > 0 ) {
			self::clear_elementor_cache();
		}
		return array(
			'documents_processed' => $processed,
			'documents_patched'   => $patched,
			'replacements'        => $replacements,
		);
	}

	/**
	 * @return array{ok: bool, changed: bool, replacements: int}
	 */
	public static function revert_post( int $post_id ): array {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array(
				'ok'           => true,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array(
				'ok'           => false,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$result = self::walk_elements( $data );
		if ( (int) $result['replacements'] < 1 ) {
			return array(
				'ok'           => true,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$json = wp_json_encode( $result['elements'] );
		if ( ! is_string( $json ) ) {
			return array(
				'ok'           => false,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		update_post_meta( $post_id, self::META_KEY, wp_slash( $json ) );
		delete_post_meta( $post_id, '_elementor_element_cache' );
		return array(
			'ok'           => true,
			'changed'      => true,
			'replacements' => (int) $result['replacements'],
		);
	}

	/**
	 * @return array{documents_processed: int, documents_patched: int, replacements: int}
	 */
	public static function repair_all_documents(): array {
		$previous = self::$walk_mode;
		self::set_walk_mode( self::WALK_MODE_MIGRATE_TO_NEO_PULSE );
		self::build_field_index();
		$processed = 0;
		$patched   = 0;
		$total     = 0;
		try {
			foreach ( self::elementor_document_ids() as $post_id ) {
				++$processed;
				$result = self::repair_post( (int) $post_id );
				$total += (int) ( $result['replacements'] ?? 0 );
				if ( ! empty( $result['changed'] ) ) {
					++$patched;
				}
			}
		} finally {
			self::set_walk_mode( $previous );
		}
		return array(
			'documents_processed' => $processed,
			'documents_patched'   => $patched,
			'replacements'        => $total,
		);
	}

	/**
	 * @return array{ok: bool, changed: bool, replacements: int}
	 */
	public static function repair_post( int $post_id ): array {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return array(
				'ok'           => true,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return array(
				'ok'           => false,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$result = self::walk_elements( $data );
		if ( (int) $result['replacements'] < 1 ) {
			return array(
				'ok'           => true,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		$json = wp_json_encode( $result['elements'] );
		if ( ! is_string( $json ) ) {
			return array(
				'ok'           => false,
				'changed'      => false,
				'replacements' => 0,
			);
		}
		update_post_meta( $post_id, self::META_KEY, wp_slash( $json ) );
		delete_post_meta( $post_id, '_elementor_element_cache' );
		return array(
			'ok'           => true,
			'changed'      => true,
			'replacements' => (int) $result['replacements'],
		);
	}
}

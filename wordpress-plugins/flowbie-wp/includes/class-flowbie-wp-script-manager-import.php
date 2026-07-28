<?php
/**
 * Script Manager import/export (CSV + Flowbie JSON + legacy snippet exports).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Script_Manager_Import {

	const JSON_VERSION = 1;

	/**
	 * Parse upload by extension or content sniffing.
	 *
	 * @param string $content  File contents.
	 * @param string $filename Original filename (optional).
	 * @return array{rows: array<int, array<string, mixed>>, error?: string, warnings?: array<int, string>}
	 */
	public static function parse_file( string $content, string $filename = '' ): array {
		$trimmed = trim( $content );
		if ( $trimmed === '' ) {
			return array(
				'rows'  => array(),
				'error' => __( 'File is empty.', 'flowbie-wp' ),
			);
		}

		$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		if ( $ext === 'json' || self::looks_like_json( $trimmed ) ) {
			return self::parse_flowbie_json( $trimmed );
		}

		return Flowbie_Wp_Script_Manager_Csv::parse( $content );
	}

	/**
	 * Parse Header Footer Code Manager export JSON (snippets array).
	 *
	 * @return array{rows: array<int, array<string, mixed>>, error?: string, warnings?: array<int, string>}
	 */
	public static function parse_hfcm_export( string $json_text ): array {
		$decode = self::decode_json( $json_text );
		if ( ! empty( $decode['error'] ) ) {
			return array(
				'rows'  => array(),
				'error' => (string) $decode['error'],
			);
		}

		$data = $decode['data'];
		if ( ! self::is_legacy_snippets_export( $data ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'Not a valid HFCM export. The file must contain a top-level "snippets" array.', 'flowbie-wp' ),
			);
		}

		return self::parse_legacy_snippets_export( $data );
	}

	/**
	 * Convert HFCM snippet records (DB rows or export objects) into Script Manager rows.
	 *
	 * @param array<int, array<string, mixed>> $snippets HFCM snippets.
	 * @return array{rows: array<int, array<string, mixed>>, warnings?: array<int, string>, error?: string}
	 */
	public static function hfcm_snippets_to_rows( array $snippets ): array {
		$warnings = array();
		$rows     = array();

		foreach ( $snippets as $snippet ) {
			if ( ! is_array( $snippet ) ) {
				continue;
			}
			foreach ( self::legacy_snippet_to_rows( $snippet, $warnings ) as $row ) {
				$rows[] = $row;
			}
		}

		if ( empty( $rows ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'No importable HFCM snippets found.', 'flowbie-wp' ),
			);
		}

		return array(
			'rows'     => $rows,
			'warnings' => $warnings,
		);
	}

	/**
	 * Flowbie JSON export only.
	 *
	 * @return array{rows: array<int, array<string, mixed>>, error?: string, warnings?: array<int, string>}
	 */
	public static function parse_flowbie_json( string $json_text ): array {
		$decode = self::decode_json( $json_text );
		if ( ! empty( $decode['error'] ) ) {
			return array(
				'rows'  => array(),
				'error' => (string) $decode['error'],
			);
		}

		$data = $decode['data'];
		if ( ! self::is_flowbie_export( $data ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'Not a Flowbie script export. Use Export JSON from this page, or import HFCM files via the HFCM import panel.', 'flowbie-wp' ),
			);
		}

		return self::parse_flowbie_export( $data );
	}

	/**
	 * @return array{data?: array<string, mixed>, error?: string}
	 */
	private static function decode_json( string $json_text ): array {
		$json_text = self::strip_utf8_bom( trim( $json_text ) );
		if ( $json_text === '' ) {
			return array(
				'error' => __( 'File is empty.', 'flowbie-wp' ),
			);
		}

		$data = json_decode( $json_text, true );
		if ( ! is_array( $data ) ) {
			return array(
				'error' => __( 'Invalid JSON file. If this is an HFCM export, use the HFCM import panel below.', 'flowbie-wp' ),
			);
		}

		return array( 'data' => $data );
	}

	private static function strip_utf8_bom( string $text ): string {
		if ( strncmp( $text, "\xEF\xBB\xBF", 3 ) === 0 ) {
			return substr( $text, 3 );
		}
		return $text;
	}

	private static function looks_like_json( string $text ): bool {
		$text = self::strip_utf8_bom( $text );
		return isset( $text[0] ) && ( '{' === $text[0] || '[' === $text[0] );
	}

	/**
	 * @param array<string, mixed> $data Decoded JSON.
	 */
	private static function is_flowbie_export( array $data ): bool {
		return isset( $data['scripts'] ) && is_array( $data['scripts'] )
			&& isset( $data['version'] );
	}

	/**
	 * Legacy exports use a top-level snippets array (no Flowbie version key).
	 *
	 * @param array<string, mixed> $data Decoded JSON.
	 */
	private static function is_legacy_snippets_export( array $data ): bool {
		return isset( $data['snippets'] ) && is_array( $data['snippets'] );
	}

	/**
	 * @param array<string, mixed> $data Export payload.
	 * @return array{rows: array<int, array<string, mixed>>, error?: string, warnings?: array<int, string>}
	 */
	private static function parse_flowbie_export( array $data ): array {
		$warnings = array();
		$rows     = array();
		foreach ( $data['scripts'] as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$row = self::normalize_script_row( $item, $warnings );
			if ( $row ) {
				$rows[] = $row;
			}
		}

		if ( empty( $rows ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'No valid scripts found in JSON.', 'flowbie-wp' ),
			);
		}

		return array(
			'rows'     => $rows,
			'warnings' => $warnings,
		);
	}

	/**
	 * @param array<string, mixed> $data Legacy export.
	 * @return array{rows: array<int, array<string, mixed>>, error?: string, warnings?: array<int, string>}
	 */
	private static function parse_legacy_snippets_export( array $data ): array {
		$warnings = array();
		$rows     = array();

		foreach ( $data['snippets'] as $snippet ) {
			if ( ! is_array( $snippet ) ) {
				continue;
			}
			$converted = self::legacy_snippet_to_rows( $snippet, $warnings );
			foreach ( $converted as $row ) {
				$rows[] = $row;
			}
		}

		if ( empty( $rows ) ) {
			return array(
				'rows'  => array(),
				'error' => __( 'No importable snippets found in JSON.', 'flowbie-wp' ),
			);
		}

		return array(
			'rows'     => $rows,
			'warnings' => $warnings,
		);
	}

	/**
	 * @param array<string, mixed> $item Raw row.
	 * @param array<int, string>   $warnings Warnings collector.
	 * @return array<string, mixed>|null
	 */
	private static function normalize_script_row( array $item, array &$warnings ): ?array {
		$name = isset( $item['name'] ) ? Flowbie_Wp_Script_Manager::normalize_name( (string) $item['name'] ) : '';
		$code = isset( $item['code'] ) ? (string) $item['code'] : '';
		if ( $name === '' || trim( $code ) === '' ) {
			return null;
		}

		$placement = isset( $item['placement'] ) ? sanitize_key( (string) $item['placement'] ) : 'header';
		if ( ! in_array( $placement, Flowbie_Wp_Script_Manager::PLACEMENTS, true ) ) {
			$placement = 'header';
		}

		$status = isset( $item['status'] ) ? sanitize_key( (string) $item['status'] ) : 'active';
		if ( ! in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
			$status = 'active';
		}

		$priority = isset( $item['priority'] ) ? (int) $item['priority'] : 10;
		$priority = max( 0, min( 9999, $priority ) );

		$category = isset( $item['category'] ) ? sanitize_text_field( (string) $item['category'] ) : Flowbie_Wp_Script_Manager::get_settings()['default_category'];

		$rules_raw = isset( $item['display_rules'] ) ? $item['display_rules'] : Flowbie_Wp_Script_Manager_Rules::defaults();
		$normalized = Flowbie_Wp_Script_Manager_Rules::normalize( $rules_raw );
		if ( empty( $normalized['ok'] ) ) {
			$warnings[] = sprintf(
				/* translators: %s: script name */
				__( 'Skipped display rules for "%s"; using defaults.', 'flowbie-wp' ),
				$name
			);
			$normalized = array(
				'ok'    => true,
				'rules' => Flowbie_Wp_Script_Manager_Rules::defaults(),
			);
		}

		$row = array(
			'name'          => $name,
			'placement'     => $placement,
			'code'          => $code,
			'status'        => $status,
			'priority'      => $priority,
			'category'      => $category,
			'display_rules' => $normalized['rules'],
		);

		if ( isset( $item['id'] ) && (int) $item['id'] > 0 ) {
			$row['id'] = (int) $item['id'];
		}

		return $row;
	}

	/**
	 * Convert one legacy snippet to one or more Flowbie rows.
	 *
	 * @param array<string, mixed> $snippet Legacy snippet.
	 * @param array<int, string>   $warnings Warnings.
	 * @return array<int, array<string, mixed>>
	 */
	private static function legacy_snippet_to_rows( array $snippet, array &$warnings ): array {
		$name = isset( $snippet['name'] ) ? sanitize_text_field( (string) $snippet['name'] ) : '';
		if ( $name === '' && isset( $snippet['title'] ) ) {
			$name = sanitize_text_field( (string) $snippet['title'] );
		}
		if ( $name === '' && isset( $snippet['snippet_name'] ) ) {
			$name = sanitize_text_field( (string) $snippet['snippet_name'] );
		}
		if ( $name === '' ) {
			return array();
		}

		$snippet_type = isset( $snippet['snippet_type'] ) ? strtolower( (string) $snippet['snippet_type'] ) : 'html';
		if ( 'php' === $snippet_type ) {
			$warnings[] = sprintf(
				/* translators: %s: snippet name */
				__( 'Skipped PHP snippet "%s" (Flowbie outputs HTML/JS only).', 'flowbie-wp' ),
				$name
			);
			return array();
		}

		$code = isset( $snippet['snippet'] ) ? (string) $snippet['snippet'] : '';
		$code = html_entity_decode( $code, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		if ( trim( $code ) === '' ) {
			return array();
		}

		$status = isset( $snippet['status'] ) ? sanitize_key( (string) $snippet['status'] ) : 'active';
		if ( ! in_array( $status, array( 'active', 'inactive', 'trash' ), true ) ) {
			$status = 'active';
		}

		$priority = isset( $snippet['priority'] ) ? (int) $snippet['priority'] : 10;
		$priority = max( 0, min( 9999, $priority ) );

		$category = Flowbie_Wp_Script_Manager::get_settings()['default_category'];
		if ( isset( $snippet['snippet_type'] ) && (string) $snippet['snippet_type'] !== '' ) {
			$category = sanitize_text_field( ucfirst( (string) $snippet['snippet_type'] ) );
		}

		$rules = self::legacy_display_rules( $snippet );
		$locations = self::legacy_placements( isset( $snippet['location'] ) ? (string) $snippet['location'] : 'header' );

		$rows = array();
		foreach ( $locations as $placement ) {
			$row_name = $name;
			if ( count( $locations ) > 1 ) {
				$labels = array(
					'header' => __( 'Header', 'flowbie-wp' ),
					'body'   => __( 'Body', 'flowbie-wp' ),
					'footer' => __( 'Footer', 'flowbie-wp' ),
				);
				$label    = isset( $labels[ $placement ] ) ? $labels[ $placement ] : $placement;
				$row_name = $name . ' (' . $label . ')';
			}

			$rows[] = array(
				'name'          => $row_name,
				'placement'     => $placement,
				'code'          => $code,
				'status'        => $status,
				'priority'      => $priority,
				'category'      => $category,
				'display_rules' => $rules,
			);
		}

		return $rows;
	}

	/**
	 * @return array<int, string>
	 */
	private static function legacy_placements( string $location ): array {
		$location = sanitize_key( $location );
		switch ( $location ) {
			case 'body_open':
			case 'body':
				return array( 'body' );
			case 'before_content':
				return array( 'body' );
			case 'after_content':
				return array( 'footer' );
			case 'footer':
				return array( 'footer' );
			case 'everywhere':
				return array( 'header', 'body', 'footer' );
			case 'header':
			default:
				return array( 'header' );
		}
	}

	/**
	 * @param array<string, mixed> $snippet Legacy snippet.
	 * @return array<string, mixed>
	 */
	private static function legacy_display_rules( array $snippet ): array {
		$include = array(
			'posts'      => array(),
			'post_types' => array(),
			'taxonomies' => array(),
			'archives'   => array(),
			'special'    => array(),
		);
		$exclude = array(
			'posts'      => array(),
			'post_types' => array(),
			'taxonomies' => array(),
			'archives'   => array(),
			'special'    => array(),
		);

		$include['posts'] = array_merge(
			$include['posts'],
			self::parse_legacy_id_list( $snippet['s_pages'] ?? '[]' ),
			self::parse_legacy_id_list( $snippet['s_posts'] ?? '[]' )
		);
		$exclude['posts'] = array_merge(
			$exclude['posts'],
			self::parse_legacy_id_list( $snippet['ex_pages'] ?? '[]' ),
			self::parse_legacy_id_list( $snippet['ex_posts'] ?? '[]' )
		);

		$include['post_types'] = self::parse_legacy_string_list( $snippet['s_custom_posts'] ?? '[]' );

		$categories = self::parse_legacy_id_list( $snippet['s_categories'] ?? '[]' );
		if ( ! empty( $categories ) ) {
			$include['taxonomies'][] = array(
				'taxonomy' => 'category',
				'terms'    => $categories,
			);
		}

		$tags = self::parse_legacy_id_list( $snippet['s_tags'] ?? '[]' );
		if ( ! empty( $tags ) ) {
			$include['taxonomies'][] = array(
				'taxonomy' => 'post_tag',
				'terms'    => $tags,
			);
		}

		self::legacy_display_on_special( $snippet, $include );

		$include['posts'] = array_values( array_unique( array_map( 'intval', $include['posts'] ) ) );
		$exclude['posts'] = array_values( array_unique( array_map( 'intval', $exclude['posts'] ) ) );

		$mode = 'all';
		if ( self::legacy_targets_nonempty( $include ) ) {
			$mode = 'include';
		}

		$device = isset( $snippet['device_type'] ) ? strtolower( (string) $snippet['device_type'] ) : 'both';
		if ( 'mobile' === $device ) {
			$device = 'mobile';
		} elseif ( 'desktop' === $device ) {
			$device = 'desktop';
		} else {
			$device = 'all';
		}

		$logged_in = 'all';
		$display_to = isset( $snippet['display_to'] ) ? strtolower( (string) $snippet['display_to'] ) : 'all';
		if ( in_array( $display_to, array( 'logged_in', 'loggedin', 'members' ), true ) ) {
			$logged_in = 'only';
		} elseif ( in_array( $display_to, array( 'guest', 'guests', 'logged_out', 'loggedout' ), true ) ) {
			$logged_in = 'exclude';
		}

		$rules = array(
			'mode'      => $mode,
			'include'   => $include,
			'exclude'   => $exclude,
			'device'    => $device,
			'logged_in' => $logged_in,
		);

		$result = Flowbie_Wp_Script_Manager_Rules::normalize( $rules );
		return ! empty( $result['rules'] ) ? $result['rules'] : Flowbie_Wp_Script_Manager_Rules::defaults();
	}

	/**
	 * @param array<string, mixed> $snippet Snippet.
	 * @param array<string, mixed> $include Include targets (by ref).
	 */
	private static function legacy_display_on_special( array $snippet, array &$include ): void {
		$display_on = isset( $snippet['display_on'] ) ? strtolower( trim( (string) $snippet['display_on'] ) ) : 'all';
		if ( $display_on === '' || $display_on === 'all' ) {
			return;
		}

		$map = array(
			'home'              => array( 'front_page' ),
			'homepage'          => array( 'front_page' ),
			'front page'        => array( 'front_page' ),
			'blog'              => array( 'blog' ),
			'posts'             => array( 'singular' ),
			'pages'             => array( 'singular' ),
			'search'            => array( 'search' ),
			'404'               => array( '404' ),
			'archives'          => array( 'archive' ),
			'category archives' => array( 'archive' ),
			'tag archives'      => array( 'archive' ),
		);

		$key = str_replace( '_', ' ', $display_on );
		if ( isset( $map[ $key ] ) ) {
			$include['special'] = array_merge( $include['special'], $map[ $key ] );
			$include['special'] = array_values( array_unique( $include['special'] ) );
			return;
		}

		if ( isset( $map[ $display_on ] ) ) {
			$include['special'] = array_merge( $include['special'], $map[ $display_on ] );
			$include['special'] = array_values( array_unique( $include['special'] ) );
		}
	}

	/**
	 * @param mixed $raw JSON string or array from legacy export.
	 * @return array<int, int>
	 */
	private static function parse_legacy_id_list( $raw ): array {
		$items = self::decode_legacy_list( $raw );
		$ids   = array();
		foreach ( $items as $item ) {
			if ( is_array( $item ) && isset( $item['id'] ) ) {
				$id = (int) $item['id'];
			} else {
				$id = (int) $item;
			}
			if ( $id > 0 ) {
				$ids[] = $id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * @param mixed $raw JSON string or array.
	 * @return array<int, string>
	 */
	private static function parse_legacy_string_list( $raw ): array {
		$items = self::decode_legacy_list( $raw );
		$out   = array();
		foreach ( $items as $item ) {
			if ( is_array( $item ) && isset( $item['slug'] ) ) {
				$slug = sanitize_key( (string) $item['slug'] );
			} else {
				$slug = sanitize_key( (string) $item );
			}
			if ( $slug !== '' ) {
				$out[] = $slug;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param mixed $raw Raw field.
	 * @return array<int, mixed>
	 */
	private static function decode_legacy_list( $raw ): array {
		if ( is_array( $raw ) ) {
			return $raw;
		}
		if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
			return array();
		}
		$decoded = json_decode( $raw, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * @param array<string, mixed> $targets Target group.
	 */
	private static function legacy_targets_nonempty( array $targets ): bool {
		foreach ( array( 'posts', 'post_types', 'archives', 'special' ) as $key ) {
			if ( ! empty( $targets[ $key ] ) && is_array( $targets[ $key ] ) ) {
				return true;
			}
		}
		if ( ! empty( $targets['taxonomies'] ) && is_array( $targets['taxonomies'] ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Build Flowbie JSON export (no third-party branding).
	 *
	 * @param array<int, object> $rows DB rows.
	 */
	public static function build_json_export( array $rows ): string {
		$scripts = array();
		foreach ( $rows as $row ) {
			$rules = Flowbie_Wp_Script_Manager_Rules::decode( isset( $row->display_rules ) ? (string) $row->display_rules : '' );
			$scripts[] = array(
				'id'            => (int) $row->id,
				'name'          => (string) $row->name,
				'placement'     => (string) $row->placement,
				'code'          => (string) $row->code,
				'status'        => (string) $row->status,
				'priority'      => (int) $row->priority,
				'category'      => (string) $row->category,
				'display_rules' => $rules,
				'created_at'    => (string) $row->created_at,
				'updated_at'    => (string) $row->updated_at,
			);
		}

		$payload = array(
			'version'     => self::JSON_VERSION,
			'exported_at' => gmdate( 'c' ),
			'scripts'     => $scripts,
		);

		return wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	}
}

<?php
/**
 * CSS/JS aggregation into cached bundle files.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Combines local stylesheets/scripts into single cached files.
 */
class Flowbie_Wp_Speed_Aggregator {

	/**
	 * @param string $html HTML document.
	 * @param array<string, mixed> $config Settings.
	 */
	public static function aggregate_stylesheets( string $html, array $config ): string {
		$included_tags = array();
		$bundle        = '';

		if ( ! preg_match_all(
			'#<link\b([^>]*)\bhref=(["\'])([^"\']+)\2([^>]*)>#i',
			$html,
			$matches,
			PREG_SET_ORDER
		) ) {
			return self::minify_remaining_styles( $html, $config );
		}

		foreach ( $matches as $m ) {
			$full = $m[0];
			if ( stripos( $full, 'stylesheet' ) === false ) {
				continue;
			}
			$url = $m[3];
			if ( Flowbie_Wp_Speed_Excludes::is_excluded( $url, 'css', $config ) ) {
				continue;
			}
			$path = Flowbie_Wp_Speed_Assets::resolve_local_path( $url );
			if ( $path === null ) {
				continue;
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$raw = file_get_contents( $path );
			if ( ! is_string( $raw ) || $raw === '' ) {
				continue;
			}
			$bundle .= "\n/* source: " . basename( $path ) . " */\n";
			$bundle .= Flowbie_Wp_Speed_Minify::css( $raw );
			$included_tags[] = $full;
		}

		if ( $bundle === '' || empty( $included_tags ) ) {
			return Flowbie_Wp_Speed_Assets::process(
				$html,
				array_merge( $config, array( 'aggregate_css' => false ) )
			);
		}

		if ( stripos( $html, '</head>' ) === false ) {
			return $html;
		}

		$hash = Flowbie_Wp_Speed_Cache::build_hash( md5( $bundle ), 'css', $config );
		$url  = Flowbie_Wp_Speed_Cache::get_url( 'css', $hash );
		if ( $url === null ) {
			$url = Flowbie_Wp_Speed_Cache::write( 'css', $hash, $bundle );
		}
		if ( $url === null ) {
			return $html;
		}

		$link     = '<link rel="stylesheet" href="' . esc_url( $url ) . '" media="all" />';
		$injected = preg_replace( '#</head>#i', $link . "\n</head>", $html, 1 );
		if ( ! is_string( $injected ) || $injected === $html ) {
			return $html;
		}

		$html = str_replace( $included_tags, '', $injected );

		return $html;
	}

	/**
	 * @param string $html HTML document.
	 * @param array<string, mixed> $config Settings.
	 */
	public static function aggregate_scripts( string $html, array $config ): string {
		$included_tags = array();
		$bundle        = '';

		if ( ! preg_match_all(
			'#<script\b([^>]*)\bsrc=(["\'])([^"\']+)\2([^>]*)>\s*</script>#i',
			$html,
			$matches,
			PREG_SET_ORDER
		) ) {
			return $html;
		}

		foreach ( $matches as $m ) {
			$full = $m[0];
			$url  = $m[3];
			if ( Flowbie_Wp_Speed_Excludes::is_excluded( $url, 'js', $config ) ) {
				continue;
			}
			$path = Flowbie_Wp_Speed_Assets::resolve_local_path( $url );
			if ( $path === null ) {
				continue;
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$raw = file_get_contents( $path );
			if ( ! is_string( $raw ) || $raw === '' ) {
				continue;
			}
			$bundle .= "\n;/* source: " . basename( $path ) . " */\n";
			$bundle .= Flowbie_Wp_Speed_Minify::js( $raw ) . ";\n";
			$included_tags[] = $full;
		}

		if ( $bundle === '' || empty( $included_tags ) ) {
			return $html;
		}

		if ( stripos( $html, '</body>' ) === false ) {
			return $html;
		}

		$hash = Flowbie_Wp_Speed_Cache::build_hash( md5( $bundle ), 'js', $config );
		$url  = Flowbie_Wp_Speed_Cache::get_url( 'js', $hash );
		if ( $url === null ) {
			$url = Flowbie_Wp_Speed_Cache::write( 'js', $hash, $bundle );
		}
		if ( $url === null ) {
			return $html;
		}

		$defer  = ! empty( $config['defer_js'] ) ? ' defer' : '';
		$script = '<script src="' . esc_url( $url ) . '"' . $defer . '></script>';
		$injected = preg_replace( '#</body>#i', $script . "\n</body>", $html, 1 );
		if ( ! is_string( $injected ) || $injected === $html ) {
			return $html;
		}

		$html = str_replace( $included_tags, '', $injected );

		if ( ! empty( $config['defer_js'] ) ) {
			$html = Flowbie_Wp_Speed_Assets::process(
				$html,
				array_merge( $config, array( 'aggregate_js' => false, 'optimize_js' => false ) )
			);
		}

		return $html;
	}

	/**
	 * Fallback when aggregation finds nothing to combine.
	 *
	 * @param string $html HTML.
	 * @param array<string, mixed> $config Settings.
	 */
	private static function minify_remaining_styles( string $html, array $config ): string {
		return (string) preg_replace_callback(
			'#<link\b[^>]*href=(["\'])([^"\']+)\1[^>]*>#i',
			static function ( $m ) use ( $config ) {
				$url = $m[2];
				if ( Flowbie_Wp_Speed_Excludes::is_excluded( $url, 'css', $config ) ) {
					return $m[0];
				}
				$path = Flowbie_Wp_Speed_Assets::resolve_local_path( $url );
				if ( $path === null ) {
					return $m[0];
				}
				$cached = Flowbie_Wp_Speed_Assets::minify_file_to_cache( $path, 'css', $config );
				return $cached ? preg_replace( '#href=(["\'])[^"\']+\1#', 'href="' . esc_url( $cached ) . '"', $m[0] ) ?? $m[0] : $m[0];
			},
			$html
		);
	}
}

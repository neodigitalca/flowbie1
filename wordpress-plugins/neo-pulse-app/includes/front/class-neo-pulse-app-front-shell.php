<?php
/**
 * Serve the NEO Pulse SPA through WordPress so the admin toolbar renders when logged in.
 *
 * Static assets under /app/assets/ stay on disk; HTML routes are served via
 * subdirectory .htaccess and this shell injects wp_head() / wp_footer().
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Front_Shell {

	public static function init(): void {
		add_filter( 'query_vars', array( __CLASS__, 'register_query_vars' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_redirect_register' ), 0 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_render' ), 0 );
		add_action( 'wp_footer', array( __CLASS__, 'legacy_hash_register_redirect' ), 999 );
	}

	public static function app_base_path(): string {
		$default = '/neo-pulse';
		if ( defined( 'NEO_PULSE_APP_FRONTEND_URL' ) && NEO_PULSE_APP_FRONTEND_URL !== '' ) {
			$path = wp_parse_url( NEO_PULSE_APP_FRONTEND_URL, PHP_URL_PATH );
			if ( is_string( $path ) && $path !== '' && $path !== '/' ) {
				return untrailingslashit( $path );
			}
		}
		return $default;
	}

	public static function app_slug(): string {
		return ltrim( self::app_base_path(), '/' );
	}

	public static function maybe_redirect_register(): void {
		if ( self::is_app_request() ) {
			return;
		}
		$path = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path = strtok( $path, '?' ) ?: '';
		if ( ! preg_match( '#^/register/?$#', $path ) ) {
			return;
		}
		$query = isset( $_SERVER['QUERY_STRING'] ) && (string) $_SERVER['QUERY_STRING'] !== ''
			? '?' . (string) wp_unslash( $_SERVER['QUERY_STRING'] )
			: '';
		wp_safe_redirect( home_url( self::app_base_path() . '/register' . $query ), 302 );
		exit;
	}

	/**
	 * @param array<int, string> $vars Query vars.
	 * @return array<int, string>
	 */
	public static function register_query_vars( array $vars ): array {
		$vars[] = 'neo-pulse_one_app';
		$vars[] = 'neo-pulse_one_route';
		return $vars;
	}

	public static function index_html_path(): string {
		return trailingslashit( ABSPATH ) . self::app_slug() . '/index.html';
	}

	public static function is_app_request(): bool {
		if ( (string) get_query_var( 'neo-pulse_one_app' ) !== '' ) {
			return true;
		}
		$path = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path = strtok( $path, '?' ) ?: '';
		$base = preg_quote( self::app_base_path(), '#' );
		return (bool) preg_match( '#^' . $base . '(/|$)#', $path );
	}

	public static function maybe_render(): void {
		if ( ! self::is_app_request() ) {
			return;
		}

		$path = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path = strtok( $path, '?' ) ?: '';
		$base = self::app_base_path();
		if ( preg_match( '#^' . preg_quote( $base, '#' ) . '/assets/#', $path ) ) {
			return;
		}

		$index = self::index_html_path();
		if ( ! is_readable( $index ) ) {
			return;
		}

		global $wp_query;
		if ( isset( $wp_query ) ) {
			$wp_query->is_404 = false;
		}
		status_header( 200 );

		if ( is_user_logged_in() ) {
			show_admin_bar( true );
		}

		$html = file_get_contents( $index );
		if ( ! is_string( $html ) || $html === '' ) {
			status_header( 500 );
			echo esc_html__( 'NEO Pulse App shell could not be loaded.', 'neo-pulse-app' );
			exit;
		}

		ob_start();
		wp_head();
		$head = (string) ob_get_clean();

		ob_start();
		wp_footer();
		$footer = (string) ob_get_clean();

		$admin_css = '';
		if ( is_admin_bar_showing() ) {
			$admin_css = '<style id="neo-pulse-admin-bar-layout">'
				. 'html.admin-bar{margin-top:0!important;}'
				. 'html.admin-bar #root{height:calc(100dvh - 32px);height:calc(100vh - 32px);}'
				. '@media screen and (max-width:782px){html.admin-bar #root{height:calc(100dvh - 46px);height:calc(100vh - 46px);}}'
				. '</style>';
		}

		$body_class = 'neo-pulse-app';
		if ( is_admin_bar_showing() ) {
			$body_class .= ' admin-bar';
		}

		$html = str_replace( '</head>', $admin_css . $head . '</head>', $html );
		$html = str_replace( '<body>', '<body class="' . esc_attr( $body_class ) . '">', $html );
		if ( is_user_logged_in() ) {
			$html = str_replace(
				'<body class="' . esc_attr( $body_class ) . '">',
				'<body class="' . esc_attr( $body_class ) . '"><script>window.__NEO_PULSE_WP_LOGGED_IN__=true</script>',
				$html
			);
		}
		$html = str_replace( '</body>', $footer . '</body>', $html );

		nocache_headers();
		header( 'Content-Type: text/html; charset=UTF-8' );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted local index.html template.
		echo $html;
		exit;
	}

	/** Redirect legacy `/#register?invite=…` links on WP pages to the React app. */
	public static function legacy_hash_register_redirect(): void {
		if ( self::is_app_request() ) {
			return;
		}
		$register_path = esc_js( self::app_base_path() . '/register' );
		?>
		<script id="neo-pulse-invite-hash-redirect">
		(function () {
			var raw = (location.hash || "").replace(/^#/, "").trim();
			if (raw.indexOf("register") !== 0) return;
			var query = raw.indexOf("?") >= 0 ? raw.slice(raw.indexOf("?")) : "";
			location.replace("<?php echo $register_path; ?>" + query);
		})();
		</script>
		<?php
	}
}

<?php
/**
 * Global CSS options page + frontend output.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Global_Css {

	const OPTION_SLUG   = 'global-css';
	const FIXTURE_FILE  = 'includes/fields/fixtures/acf-export-global-css.json';
	const IMPORT_ACTION = 'neo_pulse_wp_import_global_css_elementor';

	/**
	 * Hook registrations.
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'maybe_install' ), 20 );
		add_action( 'admin_post_' . self::IMPORT_ACTION, array( __CLASS__, 'handle_import_from_elementor' ) );
		add_action( 'admin_notices', array( __CLASS__, 'render_import_notice' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_css' ), 20 );
	}

	public static function install(): void {
		if ( self::page_exists() ) {
			return;
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-storage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-local-json.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-import-export.php';

		$path = NEO_PULSE_WP_PLUGIN_DIR . self::FIXTURE_FILE;
		if ( ! is_readable( $path ) ) {
			return;
		}

		$json = (string) file_get_contents( $path );
		Neo_Pulse_Wp_Fields_Import_Export::import_json_string( $json );
	}

	public static function maybe_install(): void {
		self::install();
	}

	public static function page_exists(): bool {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-storage.php';
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) as $page ) {
			if ( (string) ( $page['menu_slug'] ?? '' ) === self::OPTION_SLUG ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array<string, array<string, mixed>>
	 */
	public static function get_field_map(): array {
		$map = array();
		foreach ( self::get_field_definitions() as $field ) {
			if ( ! empty( $field['name'] ) ) {
				$map[ (string) $field['name'] ] = $field;
			}
		}
		return $map;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_field_definitions(): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-storage.php';
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-location.php';

		$screen = array( 'options_page' => self::OPTION_SLUG );
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			$fields = isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array();
			if ( ! empty( $fields ) ) {
				return $fields;
			}
		}
		return array();
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function get_stored_values(): array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/class-neo-pulse-wp-fields-values.php';

		$values = array();
		foreach ( self::get_field_map() as $name => $field ) {
			$values[ $name ] = Neo_Pulse_Wp_Fields_Values::get_option( self::OPTION_SLUG, $field, false );
		}
		return $values;
	}

	public static function is_enabled(): bool {
		$values = self::get_stored_values();
		return ! empty( $values['gc_enabled'] );
	}

	public static function handle_import_from_elementor(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::IMPORT_ACTION, 'neo_pulse_wp_import_global_css_elementor_nonce' );

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-global-css.php';
		$result = Neo_Pulse_Wp_Migrate_Elementor_Global_Css::apply( false );

		$redirect = admin_url( 'admin.php?page=' . self::OPTION_SLUG );
		if ( ! empty( $result['ok'] ) ) {
			$redirect = add_query_arg(
				array(
					'neo-pulse_notice' => 'global_css_imported',
					'neo-pulse_msg'    => rawurlencode( (string) ( $result['message'] ?? '' ) ),
				),
				$redirect
			);
		} else {
			$redirect = add_query_arg(
				array(
					'neo-pulse_notice' => 'global_css_import_error',
					'neo-pulse_msg'    => rawurlencode( (string) ( $result['error'] ?? __( 'Import failed.', 'neo-pulse-wp' ) ) ),
				),
				$redirect
			);
		}
		wp_safe_redirect( $redirect );
		exit;
	}

	public static function render_import_notice(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$page = isset( $_GET['page'] ) ? sanitize_key( (string) wp_unslash( $_GET['page'] ) ) : '';
		if ( self::OPTION_SLUG !== $page ) {
			return;
		}

		$notice = isset( $_GET['neo-pulse_notice'] ) ? sanitize_key( (string) wp_unslash( $_GET['neo-pulse_notice'] ) ) : '';
		if ( $notice === 'global_css_imported' ) {
			$msg = isset( $_GET['neo-pulse_msg'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['neo-pulse_msg'] ) ) : __( 'Elementor global styles imported.', 'neo-pulse-wp' );
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
		} elseif ( $notice === 'global_css_import_error' ) {
			$msg = isset( $_GET['neo-pulse_msg'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['neo-pulse_msg'] ) ) : __( 'Import failed.', 'neo-pulse-wp' );
			echo '<div class="notice notice-error is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
		}

		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/class-neo-pulse-wp-migrate-elementor-global-css.php';
		if ( ! Neo_Pulse_Wp_Migrate_Elementor_Global_Css::kit_available() ) {
			return;
		}
		?>
		<div class="notice notice-info">
			<p><?php esc_html_e( 'Import Elementor Site Settings (global colors, typography, custom CSS) into this page.', 'neo-pulse-wp' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin:0 0 8px;">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::IMPORT_ACTION ); ?>" />
				<?php wp_nonce_field( self::IMPORT_ACTION, 'neo_pulse_wp_import_global_css_elementor_nonce' ); ?>
				<?php submit_button( __( 'Import from Elementor', 'neo-pulse-wp' ), 'secondary', 'submit', false ); ?>
			</form>
		</div>
		<?php
	}

	public static function enqueue_frontend_css(): void {
		if ( is_admin() || ! self::is_enabled() ) {
			return;
		}

		$css = self::build_frontend_css();
		if ( $css === '' ) {
			return;
		}

		wp_register_style( 'neo-pulse-global-css', false, array(), NEO_PULSE_WP_VERSION );
		wp_enqueue_style( 'neo-pulse-global-css' );
		wp_add_inline_style( 'neo-pulse-global-css', $css );
	}

	public static function build_frontend_css(): string {
		$values = self::get_stored_values();
		$rules  = array();

		$vars = array();
		$color_map = array(
			'primary'   => 'gc_color_primary',
			'secondary' => 'gc_color_secondary',
			'accent'    => 'gc_color_accent',
			'text'      => 'gc_color_text',
		);
		foreach ( $color_map as $token => $field ) {
			$color = sanitize_hex_color( (string) ( $values[ $field ] ?? '' ) );
			if ( $color ) {
				$vars[] = '--neo-pulse-color-' . $token . ':' . $color;
			}
		}
		if ( ! empty( $values['gc_custom_colors'] ) && is_array( $values['gc_custom_colors'] ) ) {
			$i = 0;
			foreach ( $values['gc_custom_colors'] as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$color = sanitize_hex_color( (string) ( $row['color'] ?? '' ) );
				if ( ! $color ) {
					continue;
				}
				$slug = sanitize_title( (string) ( $row['name'] ?? 'custom-' . $i ) );
				if ( $slug === '' ) {
					$slug = 'custom-' . $i;
				}
				$vars[] = '--neo-pulse-color-' . $slug . ':' . $color;
				++$i;
			}
		}
		if ( ! empty( $vars ) ) {
			$rules[] = ':root{' . implode( ';', $vars ) . ';}';
		}

		$body = self::typography_css_rule( 'body', $values, 'gc_body_' );
		if ( $body !== '' ) {
			$rules[] = $body;
		}
		for ( $n = 1; $n <= 6; $n++ ) {
			$rule = self::typography_css_rule( 'h' . $n, $values, 'gc_h' . $n . '_' );
			if ( $rule !== '' ) {
				$rules[] = $rule;
			}
		}

		$custom = isset( $values['gc_custom_css'] ) ? trim( (string) $values['gc_custom_css'] ) : '';
		if ( $custom !== '' ) {
			$rules[] = wp_strip_all_tags( $custom );
		}

		return implode( "\n", array_filter( $rules ) );
	}

	/**
	 * @param array<string, mixed> $values
	 */
	private static function typography_css_rule( string $selector, array $values, string $prefix ): string {
		$parts = array();
		$family = trim( (string) ( $values[ $prefix . 'font_family' ] ?? '' ) );
		if ( $family !== '' ) {
			$parts[] = 'font-family:' . self::css_string( $family );
		}
		$size = trim( (string) ( $values[ $prefix . 'font_size' ] ?? '' ) );
		if ( $size !== '' ) {
			$parts[] = 'font-size:' . sanitize_text_field( $size );
		}
		$weight = trim( (string) ( $values[ $prefix . 'font_weight' ] ?? '' ) );
		if ( $weight !== '' ) {
			$parts[] = 'font-weight:' . sanitize_text_field( $weight );
		}
		$line = trim( (string) ( $values[ $prefix . 'line_height' ] ?? '' ) );
		if ( $line !== '' ) {
			$parts[] = 'line-height:' . sanitize_text_field( $line );
		}
		$color = sanitize_hex_color( (string) ( $values[ $prefix . 'color' ] ?? '' ) );
		if ( $color ) {
			$parts[] = 'color:' . $color;
		}
		if ( empty( $parts ) ) {
			return '';
		}
		return $selector . '{' . implode( ';', $parts ) . ';}';
	}

	private static function css_string( string $value ): string {
		$value = trim( $value );
		if ( $value === '' ) {
			return '';
		}
		if ( false !== strpos( $value, ',' ) ) {
			$parts = array_map( 'trim', explode( ',', $value ) );
			$parts = array_map(
				static function ( $part ) {
					$part = trim( $part, " \t\n\r\0\x0B'\"" );
					return "'" . str_replace( "'", "\\'", $part ) . "'";
				},
				$parts
			);
			return implode( ', ', $parts );
		}
		return "'" . str_replace( "'", "\\'", $value ) . "'";
	}
}

<?php
/**
 * Options pages registration and rendering.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Options {

	/** @var array<int, array<string, mixed>> */
	private static $pages = array();

	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'register_admin_pages' ), 30 );
		add_action( 'admin_post_neo_pulse_wp_save_options_page', array( __CLASS__, 'handle_save' ) );
	}

	/**
	 * @param array<string, mixed> $page Page config.
	 */
	public static function register_page( array $page ): bool {
		if ( empty( $page['menu_slug'] ) ) {
			return false;
		}
		self::$pages[] = $page;
		Neo_Pulse_Wp_Fields_Storage::save_entity(
			Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS,
			$page,
			'menu_slug'
		);
		return true;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get_page_config( string $menu_slug ): ?array {
		foreach ( array_merge( self::$pages, Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) ) as $page ) {
			if ( (string) ( $page['menu_slug'] ?? '' ) === $menu_slug ) {
				return $page;
			}
		}
		return null;
	}

	public static function register_admin_pages(): void {
		$pages = array_merge( self::$pages, Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS ) );
		foreach ( $pages as $page ) {
			if ( empty( $page['menu_slug'] ) ) {
				continue;
			}
			$slug     = (string) $page['menu_slug'];
			$title    = (string) ( $page['page_title'] ?? $page['menu_title'] ?? $slug );
			$cap      = (string) ( $page['capability'] ?? 'manage_options' );
			$parent   = (string) ( $page['parent_slug'] ?? '' );
			$icon     = (string) ( $page['icon_url'] ?? '' );
			if ( $icon === '' && ! empty( $page['menu_icon'] ) ) {
				$icon = is_string( $page['menu_icon'] ) ? $page['menu_icon'] : Neo_Pulse_Wp_Fields_Import_Export::normalize_menu_icon( $page['menu_icon'] );
			}
			$callback = static function () use ( $slug, $title ) {
				self::render_page( $slug, $title );
			};
			if ( $parent !== '' && $parent !== 'none' ) {
				add_submenu_page( $parent, $title, (string) ( $page['menu_title'] ?? $title ), $cap, $slug, $callback );
			} else {
				add_menu_page( $title, (string) ( $page['menu_title'] ?? $title ), $cap, $slug, $callback, $icon, (int) ( $page['position'] ?? null ) );
			}
		}
	}

	public static function render_page( string $slug, string $title ): void {
		$groups = Neo_Pulse_Wp_Fields_Storage::get_all_groups( true );
		$screen = array( 'options_page' => $slug );
		echo '<div class="wrap"><h1>' . esc_html( $title ) . '</h1>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		echo '<input type="hidden" name="action" value="neo_pulse_wp_save_options_page" />';
		echo '<input type="hidden" name="options_page" value="' . esc_attr( $slug ) . '" />';
		wp_nonce_field( 'neo-pulse_save_options_' . $slug, 'neo-pulse_options_nonce' );
		foreach ( $groups as $group ) {
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			$fields = isset( $group['fields'] ) && is_array( $group['fields'] ) ? $group['fields'] : array();
			$values = array();
			foreach ( $fields as $field ) {
				if ( is_array( $field ) && ! empty( $field['name'] ) ) {
					$values[ (string) $field['name'] ] = Neo_Pulse_Wp_Fields_Values::get_option( $slug, $field, false );
				}
			}
			$rules_json = Neo_Pulse_Wp_Fields_Conditional::rules_json_for_fields( $fields );
			echo '<div class="acf-fields neo-pulse-fields-root" data-neo-pulse-conditional-rules="' . esc_attr( $rules_json ) . '">';
			foreach ( $fields as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$visible = Neo_Pulse_Wp_Fields_Conditional::is_visible( $field, $values, $fields );
				if ( ! $visible ) {
					echo '<div class="neo-pulse-conditional-hidden-wrap" style="display:none">';
				}
				$name  = (string) $field['name'];
				$value = $values[ $name ] ?? '';
				Neo_Pulse_Wp_Fields_Registry::render_input( $field, $value, 0 );
				if ( ! $visible ) {
					echo '</div>';
				}
			}
			echo '</div>';
		}
		submit_button( __( 'Save Options', 'neo-pulse-wp' ) );
		echo '</form></div>';
	}

	public static function handle_save(): void {
		$slug = isset( $_POST['options_page'] ) ? sanitize_key( wp_unslash( (string) $_POST['options_page'] ) ) : '';
		if ( $slug === '' || ! isset( $_POST['neo-pulse_options_nonce'] ) ) {
			wp_die( esc_html__( 'Invalid request.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( 'neo-pulse_save_options_' . $slug, 'neo-pulse_options_nonce' );
		$page_config = self::get_page_config( $slug );
		$capability  = (string) ( $page_config['capability'] ?? 'manage_options' );
		if ( ! current_user_can( $capability ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		$submitted = isset( $_POST['neo_pulse_fields'] ) && is_array( $_POST['neo_pulse_fields'] ) ? wp_unslash( $_POST['neo_pulse_fields'] ) : array();
		$screen    = array( 'options_page' => $slug );
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_all_groups( true ) as $group ) {
			if ( ! Neo_Pulse_Wp_Fields_Location::matches_group( $group, $screen ) ) {
				continue;
			}
			foreach ( isset( $group['fields'] ) ? $group['fields'] : array() as $field ) {
				if ( ! is_array( $field ) || empty( $field['name'] ) ) {
					continue;
				}
				$name = (string) $field['name'];
				if ( array_key_exists( $name, $submitted ) ) {
					Neo_Pulse_Wp_Fields_Values::update_option( $slug, $field, $submitted[ $name ] );
				}
			}
		}
		wp_safe_redirect( add_query_arg( 'updated', '1', admin_url( 'admin.php?page=' . $slug ) ) );
		exit;
	}

	public static function delete( string $menu_slug ): bool {
		return Neo_Pulse_Wp_Fields_Storage::delete_entity(
			Neo_Pulse_Wp_Fields_Storage::CPT_OPTIONS,
			$menu_slug,
			'menu_slug'
		);
	}
}

<?php
/**
 * WordPress admin bar shortcut (Rank Math–style top bar entry).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Wp_Admin_Bar {

	public static function register_admin_bar_menu( WP_Admin_Bar $wp_admin_bar ): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			$has_any = false;
			foreach ( Neo_Pulse_Wp_Admin_Menu::get_visible_groups() as $group ) {
				if ( ! empty( $group['items'] ) ) {
					$has_any = true;
					break;
				}
			}
			if ( ! $has_any ) {
				return;
			}
		}

		$active = self::is_neo_pulse_admin_screen();
		$root   = 'neo-pulse-wp-admin-bar';

		$wp_admin_bar->add_node(
			array(
				'id'    => $root,
				'title' => self::render_admin_bar_title(),
				'href'  => admin_url( 'admin.php?page=neo-pulse-wp' ),
				'meta'  => array(
					'class' => 'neo-pulse-wp-admin-bar-root' . ( $active ? ' neo-pulse-wp-admin-bar-root--active' : '' ),
					'title' => __( 'NEO Pulse WP', 'neo-pulse-wp' ),
				),
			)
		);

		foreach ( Neo_Pulse_Wp_Admin_Menu::get_visible_groups() as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}

			$group_id = isset( $group['id'] ) ? sanitize_key( (string) $group['id'] ) : '';
			$label    = isset( $group['label'] ) ? (string) $group['label'] : '';
			$items    = isset( $group['items'] ) && is_array( $group['items'] ) ? $group['items'] : array();

			if ( $group_id === '' || $label === '' || empty( $items ) ) {
				continue;
			}

			$group_node_id = $root . '-group-' . $group_id;

			$wp_admin_bar->add_node(
				array(
					'id'     => $group_node_id,
					'parent' => $root,
					'title'  => $label,
					'meta'   => array(
						'class' => 'neo-pulse-wp-admin-bar-group',
					),
				)
			);

			foreach ( $items as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}

				$slug = isset( $item['slug'] ) ? sanitize_key( (string) $item['slug'] ) : '';
				if ( $slug === '' || Neo_Pulse_Wp_Admin_Menu::is_group_slug( $slug ) ) {
					continue;
				}

				$menu_title = isset( $item['menu_title'] ) ? (string) $item['menu_title'] : $slug;

				$wp_admin_bar->add_node(
					array(
						'id'     => $root . '-' . str_replace( 'neo-pulse-wp-', '', $slug ),
						'parent' => $group_node_id,
						'title'  => $menu_title,
						'href'   => admin_url( 'admin.php?page=' . $slug ),
					)
				);
			}
		}
	}

	public static function enqueue_admin_bar_assets(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			$has_any = false;
			foreach ( Neo_Pulse_Wp_Admin_Menu::get_visible_groups() as $group ) {
				if ( ! empty( $group['items'] ) ) {
					$has_any = true;
					break;
				}
			}
			if ( ! $has_any ) {
				return;
			}
		}

		$load = is_admin_bar_showing() || is_admin();
		if ( ! $load ) {
			return;
		}

		$rel = 'assets/admin/admin-admin-bar.css';
		$abs = NEO_PULSE_WP_PLUGIN_DIR . $rel;
		$ver = defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : '0.5.0';
		if ( is_readable( $abs ) ) {
			$ver .= '.' . (string) filemtime( $abs );
		}

		wp_enqueue_style(
			'neo-pulse-wp-admin-bar',
			plugin_dir_url( NEO_PULSE_WP_PLUGIN_FILE ) . $rel,
			array(),
			$ver
		);
	}

	private static function render_admin_bar_title(): string {
		$icon  = '<span class="ab-icon neo-pulse-wp-admin-bar__icon">' . self::brand_icon_svg( '#22d3ee', 20 ) . '</span>';
		$label = '<span class="ab-label neo-pulse-wp-admin-bar__label">' . esc_html__( 'NEO Pulse WP', 'neo-pulse-wp' ) . '</span>';

		return $icon . $label;
	}

	private static function is_neo_pulse_admin_screen(): bool {
		if ( ! is_admin() ) {
			return false;
		}

		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : '';
		if ( $page === '' ) {
			return false;
		}

		return 0 === strpos( $page, 'neo-pulse-wp' ) && ! Neo_Pulse_Wp_Admin_Menu::is_group_slug( $page );
	}
}

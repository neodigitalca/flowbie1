<?php
/**
 * Sitemap admin_post save, reset, and flush handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Sitemap {

	const ACTION_SAVE_SITEMAP = 'flowbie_wp_save_sitemap';

	const ACTION_RESET_SITEMAP = 'flowbie_wp_reset_sitemap';

	const ACTION_FLUSH_SITEMAP = 'flowbie_wp_flush_sitemap';

	const ACTION_REBUILD_SITEMAP_POST_TYPE = 'flowbie_wp_rebuild_sitemap_post_type';

	const ACTION_REBUILD_SITEMAP_ALL_POST_TYPES = 'flowbie_wp_rebuild_sitemap_all_post_types';

	public static function handle_save_sitemap(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_SITEMAP, 'flowbie_wp_sitemap_nonce' );

		$tab      = isset( $_POST['flowbie_sitemap_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_tab'] ) ) : 'general';
		$previous = Flowbie_Wp_Sitemap_Settings::get_config();
		$config   = self::sitemap_config_from_post( $tab, $previous );

		Flowbie_Wp_Sitemap_Settings::save_config( $config );
		Flowbie_Wp_Sitemap_Cache::flush_all();

		if ( (int) ( $previous['general']['links_per_sitemap'] ?? 200 ) !== (int) ( $config['general']['links_per_sitemap'] ?? 200 ) ) {
			Flowbie_Wp_Sitemap::flush_rewrites();
		}

		self::set_flash(
			array(
				'kind'    => 'sitemap',
				'success' => true,
				'message' => __( 'Sitemap settings saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_sitemap( $tab );
	}

	public static function handle_reset_sitemap(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_RESET_SITEMAP, 'flowbie_wp_sitemap_reset_nonce' );

		$tab     = isset( $_POST['flowbie_sitemap_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_tab'] ) ) : 'general';
		$section = 'general';
		$slug    = '';

		if ( 'html' === $tab ) {
			$section = 'html';
		} elseif ( 'optimizer' === $tab ) {
			$section = 'optimizer';
		} elseif ( 0 === strpos( $tab, 'pt-' ) ) {
			$section = 'post_type';
			$slug    = substr( $tab, 3 );
		} elseif ( 0 === strpos( $tab, 'tax-' ) ) {
			$section = 'taxonomy';
			$slug    = substr( $tab, 4 );
		}

		Flowbie_Wp_Sitemap_Settings::reset_section( $section, $slug );
		Flowbie_Wp_Sitemap_Cache::flush_all();

		self::set_flash(
			array(
				'kind'    => 'sitemap',
				'success' => true,
				'message' => __( 'Sitemap options reset to defaults for this section.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_sitemap( $tab );
	}

	public static function handle_flush_sitemap(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_FLUSH_SITEMAP, 'flowbie_wp_sitemap_flush_nonce' );

		Flowbie_Wp_Sitemap_Cache::flush_all();
		if ( class_exists( 'Flowbie_Wp_Chat_Rag', false ) ) {
			Flowbie_Wp_Chat_Rag::invalidate_cache();
		}

		$tab = isset( $_POST['flowbie_sitemap_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_tab'] ) ) : 'general';

		self::set_flash(
			array(
				'kind'    => 'sitemap',
				'success' => true,
				'message' => __( 'Sitemap cache flushed.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_sitemap( $tab );
	}

	public static function handle_rebuild_sitemap_post_type(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_REBUILD_SITEMAP_POST_TYPE, 'flowbie_wp_sitemap_rebuild_post_type_nonce' );

		$tab  = isset( $_POST['flowbie_sitemap_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_tab'] ) ) : '';
		$slug = 0 === strpos( $tab, 'pt-' ) && 'pt-rebuild-all' !== $tab ? sanitize_key( substr( $tab, 3 ) ) : '';

		if ( $slug === '' || ! Flowbie_Wp_Sitemap_Settings::rebuild_post_type_sitemap( $slug ) ) {
			wp_die( esc_html__( 'Could not rebuild sitemap for this post type.', 'flowbie-wp' ) );
		}

		self::set_flash(
			array(
				'kind'    => 'sitemap',
				'success' => true,
				'message' => __( 'Post type sitemap rebuilt.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_sitemap( $tab );
	}

	public static function handle_rebuild_sitemap_all_post_types(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage sitemap settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_REBUILD_SITEMAP_ALL_POST_TYPES, 'flowbie_wp_sitemap_rebuild_all_post_types_nonce' );

		$tab   = isset( $_POST['flowbie_sitemap_tab'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_tab'] ) ) : 'pt-rebuild-all';
		$count = Flowbie_Wp_Sitemap_Settings::rebuild_all_post_type_sitemaps();

		self::set_flash(
			array(
				'kind'    => 'sitemap',
				'success' => true,
				'message' => sprintf(
					/* translators: %d: number of post types */
					_n( '%d post type sitemap rebuilt.', '%d post type sitemaps rebuilt.', $count, 'flowbie-wp' ),
					$count
				),
			)
		);
		self::redirect_to_sitemap( $tab );
	}

	/**
	 * @param string               $tab      Active tab.
	 * @param array<string, mixed> $existing Existing config.
	 * @return array<string, mixed>
	 */
	private static function sitemap_config_from_post( string $tab, array $existing ): array {
		$config = $existing;

		if ( 'general' === $tab ) {
			$config['general'] = array(
				'enabled'           => ! empty( $_POST['flowbie_sitemap_enabled'] ),
				'links_per_sitemap' => isset( $_POST['flowbie_sitemap_links_per'] ) ? absint( wp_unslash( $_POST['flowbie_sitemap_links_per'] ) ) : 200,
				'include_images'    => ! empty( $_POST['flowbie_sitemap_include_images'] ),
				'exclude_post_ids'  => isset( $_POST['flowbie_sitemap_exclude_ids'] ) ? wp_unslash( (string) $_POST['flowbie_sitemap_exclude_ids'] ) : '',
			);
			return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
		}

		if ( 'html' === $tab ) {
			$config['html'] = array(
				'enabled'    => ! empty( $_POST['flowbie_sitemap_html_enabled'] ),
				'page_id'    => isset( $_POST['flowbie_sitemap_html_page_id'] ) ? absint( wp_unslash( $_POST['flowbie_sitemap_html_page_id'] ) ) : 0,
				'shortcode'  => '[flowbie_sitemap]',
				'sort_order' => isset( $_POST['flowbie_sitemap_html_sort'] ) ? sanitize_key( wp_unslash( (string) $_POST['flowbie_sitemap_html_sort'] ) ) : 'title',
			);
			return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
		}

		if ( 'optimizer' === $tab ) {
			$posted = isset( $_POST['flowbie_sitemap_content_optimizer'] ) && is_array( $_POST['flowbie_sitemap_content_optimizer'] )
				? wp_unslash( $_POST['flowbie_sitemap_content_optimizer'] )
				: array();
			foreach ( $config['post_types'] as $slug => $settings ) {
				if ( ! is_array( $settings ) ) {
					continue;
				}
				$config['post_types'][ $slug ]['content_optimizer'] = ! empty( $posted[ $slug ] );
			}
			return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
		}

		if ( 0 === strpos( $tab, 'pt-' ) ) {
			$slug = sanitize_key( substr( $tab, 3 ) );
			if ( $slug !== '' && isset( $config['post_types'][ $slug ] ) ) {
				$config['post_types'][ $slug ] = array(
					'include_xml'       => ! empty( $_POST['flowbie_sitemap_include_xml'] ),
					'include_html'      => ! empty( $_POST['flowbie_sitemap_include_html'] ),
					'image_meta'        => isset( $_POST['flowbie_sitemap_image_meta'] ) ? wp_unslash( (string) $_POST['flowbie_sitemap_image_meta'] ) : '',
					'content_optimizer' => ! empty( $_POST['flowbie_sitemap_content_optimizer'] ),
				);
			}
			return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
		}

		if ( 0 === strpos( $tab, 'tax-' ) ) {
			$slug = sanitize_key( substr( $tab, 4 ) );
			if ( $slug !== '' && isset( $config['taxonomies'][ $slug ] ) ) {
				$config['taxonomies'][ $slug ] = array(
					'include_xml'  => ! empty( $_POST['flowbie_sitemap_include_xml'] ),
					'include_html' => ! empty( $_POST['flowbie_sitemap_include_html'] ),
				);
			}
			return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
		}

		return Flowbie_Wp_Sitemap_Settings::sanitize_config( $config );
	}

	private static function redirect_to_sitemap( string $tab = 'general' ): void {
		$url = admin_url( 'admin.php?page=flowbie-wp-sitemap' );
		if ( $tab !== '' && 'general' !== $tab ) {
			$url = add_query_arg( 'tab', $tab, $url );
		}
		wp_safe_redirect( $url );
		exit;
	}
}

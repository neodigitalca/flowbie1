<?php
/**
 * Post type capability health checks for native edit.php list tables.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Post_Type_Caps {

	/** @var array<string, true>|null */
	private static $field_group_post_types_cache = null;

	public static function init(): void {
		if ( ! is_admin() ) {
			return;
		}
		add_action( 'load-edit.php', array( __CLASS__, 'maybe_warn_on_list_screen' ) );
	}

	/**
	 * Post type slugs referenced by NEO Pulse field group location rules (post_type param).
	 *
	 * @return array<string, true>
	 */
	public static function get_field_group_post_types(): array {
		if ( self::$field_group_post_types_cache !== null ) {
			return self::$field_group_post_types_cache;
		}
		if ( ! post_type_exists( Neo_Pulse_Wp_Fields_Storage::CPT_GROUP ) ) {
			self::$field_group_post_types_cache = array();
			return self::$field_group_post_types_cache;
		}
		$types = array();
		foreach ( Neo_Pulse_Wp_Fields_Storage::get_entities( Neo_Pulse_Wp_Fields_Storage::CPT_GROUP ) as $group ) {
			$location = isset( $group['location'] ) && is_array( $group['location'] ) ? $group['location'] : array();
			foreach ( $location as $rule_group ) {
				if ( ! is_array( $rule_group ) ) {
					continue;
				}
				foreach ( $rule_group as $rule ) {
					if ( ! is_array( $rule ) ) {
						continue;
					}
					if ( (string) ( $rule['param'] ?? '' ) !== 'post_type' ) {
						continue;
					}
					if ( (string) ( $rule['operator'] ?? '==' ) !== '==' ) {
						continue;
					}
					$slug = sanitize_key( (string) ( $rule['value'] ?? '' ) );
					if ( $slug !== '' ) {
						$types[ $slug ] = true;
					}
				}
			}
		}
		self::$field_group_post_types_cache = $types;
		return $types;
	}

	public static function maybe_warn_on_list_screen(): void {
		global $typenow;
		if ( ! is_string( $typenow ) || $typenow === '' ) {
			return;
		}
		$targeted = self::get_field_group_post_types();
		$has_neo_pulse_config = Neo_Pulse_Wp_Fields_Post_Types::get_config_for_slug( $typenow ) !== null;
		if ( empty( $targeted[ $typenow ] ) && ! $has_neo_pulse_config ) {
			return;
		}
		$issues = self::get_capability_issues( $typenow );
		if ( empty( $issues ) ) {
			return;
		}
		add_action(
			'admin_notices',
			static function () use ( $typenow, $issues, $has_neo_pulse_config ): void {
				self::render_list_screen_notice( $typenow, $issues, $has_neo_pulse_config );
			}
		);
	}

	/**
	 * @return array<int, string>
	 */
	public static function get_capability_issues( string $post_type ): array {
		$issues = array();
		$pto    = get_post_type_object( $post_type );
		if ( ! $pto instanceof WP_Post_Type ) {
			return array(
				__( 'This post type is not registered.', 'neo-pulse-wp' ),
			);
		}
		$edit_others_cap = isset( $pto->cap->edit_others_posts ) ? $pto->cap->edit_others_posts : '';
		if ( $edit_others_cap === '' || ! current_user_can( $edit_others_cap ) ) {
			$issues[] = sprintf(
				/* translators: %s: capability name */
				__( 'You cannot %s for this post type (bulk checkboxes and some list actions are hidden).', 'neo-pulse-wp' ),
				$edit_others_cap !== '' ? $edit_others_cap : 'edit_others_posts'
			);
		}
		$sample_id = self::get_sample_post_id( $post_type );
		if ( $sample_id > 0 && ! current_user_can( 'edit_post', $sample_id ) ) {
			$issues[] = __( 'You cannot edit individual posts in this list (titles stay plain text with no row checkboxes).', 'neo-pulse-wp' );
		}
		return $issues;
	}

	private static function get_sample_post_id( string $post_type ): int {
		foreach ( array( 'publish', 'draft', 'pending', 'private', 'future' ) as $status ) {
			$posts = get_posts(
				array(
					'post_type'              => $post_type,
					'post_status'            => $status,
					'posts_per_page'         => 1,
					'orderby'                => 'ID',
					'order'                  => 'DESC',
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_meta_cache' => false,
					'update_post_term_cache' => false,
				)
			);
			if ( ! empty( $posts[0] ) ) {
				return (int) $posts[0];
			}
		}
		return 0;
	}

	/**
	 * @param array<int, string> $issues Issue messages.
	 */
	private static function render_list_screen_notice( string $post_type, array $issues, bool $has_neo_pulse_config ): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$pto = get_post_type_object( $post_type );
		$label = $pto instanceof WP_Post_Type ? $pto->labels->name : $post_type;
		echo '<div class="notice notice-error"><p><strong>';
		echo esc_html(
			sprintf(
				/* translators: %s: post type label */
				__( '%s: capability misconfiguration', 'neo-pulse-wp' ),
				$label
			)
		);
		echo '</strong></p><ul style="list-style:disc;margin-left:1.5em;">';
		foreach ( $issues as $issue ) {
			echo '<li>' . esc_html( $issue ) . '</li>';
		}
		echo '</ul><p>';
		esc_html_e( 'Enable Map Meta Cap and set Capability Type to "post" in ACF Post Types or NEO Pulse Fields, then save and reload this page.', 'neo-pulse-wp' );
		if ( $has_neo_pulse_config ) {
			$url = admin_url( 'admin.php?page=neo-pulse-wp-post-types-edit&post_type=' . rawurlencode( $post_type ) );
			echo ' <a href="' . esc_url( $url ) . '">' . esc_html__( 'Edit in NEO Pulse Fields', 'neo-pulse-wp' ) . '</a>';
		}
		echo '</p>';
		if ( $pto instanceof WP_Post_Type ) {
			echo '<p class="description">';
			echo esc_html(
				sprintf(
					/* translators: 1: capability type, 2: yes/no for map meta cap */
					__( 'Current registration: capability_type=%1$s, map_meta_cap=%2$s.', 'neo-pulse-wp' ),
					(string) $pto->capability_type,
					$pto->map_meta_cap ? __( 'yes', 'neo-pulse-wp' ) : __( 'no', 'neo-pulse-wp' )
				)
			);
			echo '</p>';
		}
		echo '</div>';
	}
}

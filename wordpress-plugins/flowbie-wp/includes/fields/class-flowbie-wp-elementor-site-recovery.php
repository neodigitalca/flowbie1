<?php
/**
 * Elementor site diagnostics and recovery after silent install migrations.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Elementor_Site_Recovery {

	/**
	 * @return array<string, mixed>
	 */
	public static function get_diagnostics(): array {
		$speed_config = Flowbie_Wp_Speed_Settings::get_config();
		$tag_audit    = self::audit_flowbie_tags();

		return array(
			'elementor_cache_fix_ran' => (bool) get_option( Flowbie_Wp_Fields_Elementor_Cache_Fix::OPTION_KEY, false ),
			'speed_enabled'           => Flowbie_Wp_Speed_Settings::is_enabled(),
			'speed_bypass_elementor'  => ! empty( $speed_config['bypass_elementor'] ),
			'speed_defer_js'          => ! empty( $speed_config['defer_js'] ),
			'fields_ready'            => Flowbie_Wp_Fields_Elementor_Cache_Fix::fields_ready_for_migration(),
			'elementor_present'       => defined( 'ELEMENTOR_VERSION' ),
			'flowbie_tag_documents'   => (int) ( $tag_audit['documents'] ?? 0 ),
			'flowbie_tag_samples'     => $tag_audit['samples'] ?? array(),
		);
	}

	/**
	 * @return array{documents: int, samples: array<int, array{id: int, title: string, post_type: string}>}
	 */
	public static function audit_flowbie_tags(): array {
		if ( ! class_exists( 'Flowbie_Wp_Migrate_Elementor_Dynamic_Tags', false ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-dynamic-tags.php';
		}

		$documents = 0;
		$samples   = array();
		foreach ( Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::elementor_document_ids() as $post_id ) {
			$post_id = (int) $post_id;
			if ( $post_id < 1 ) {
				continue;
			}
			$raw = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! is_string( $raw ) || $raw === '' || strpos( $raw, 'flowbie-' ) === false ) {
				continue;
			}
			++$documents;
			if ( count( $samples ) >= 8 ) {
				continue;
			}
			$post = get_post( $post_id );
			$samples[] = array(
				'id'        => $post_id,
				'title'     => $post instanceof WP_Post ? $post->post_title : (string) $post_id,
				'post_type' => $post instanceof WP_Post ? $post->post_type : '',
			);
		}

		return array(
			'documents' => $documents,
			'samples'   => $samples,
		);
	}

	/**
	 * Disable Speed, flush caches, revert Flowbie dynamic tags to ACF.
	 *
	 * @return array<string, mixed>
	 */
	public static function recover(): array {
		$config            = Flowbie_Wp_Speed_Settings::get_config();
		$config['enabled'] = false;
		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			$config['bypass_elementor'] = true;
		}
		Flowbie_Wp_Speed_Settings::save_config( $config );

		if ( class_exists( 'Flowbie_Wp_Speed', false ) ) {
			Flowbie_Wp_Speed::flush_all_wordpress();
		}

		if ( ! class_exists( 'Flowbie_Wp_Migrate_Elementor_Dynamic_Tags', false ) ) {
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/super-migrate/class-flowbie-wp-migrate-elementor-dynamic-tags.php';
		}

		$revert = Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::revert_all_documents();
		Flowbie_Wp_Fields_Elementor_Cache_Fix::clear_all_element_output_cache();
		Flowbie_Wp_Migrate_Elementor_Dynamic_Tags::clear_elementor_cache();
		delete_option( Flowbie_Wp_Fields_Elementor_Cache_Fix::OPTION_KEY );

		if ( class_exists( 'Flowbie_Wp_Search', false ) ) {
			Flowbie_Wp_Search::purge_public_caches();
		}

		return array(
			'speed_disabled'      => true,
			'documents_processed' => (int) ( $revert['documents_processed'] ?? 0 ),
			'documents_patched'   => (int) ( $revert['documents_patched'] ?? 0 ),
			'tag_replacements'    => (int) ( $revert['replacements'] ?? 0 ),
		);
	}

	/**
	 * Opt-in Elementor tag migration (Super Import or admin).
	 *
	 * @return array<string, mixed>
	 */
	public static function run_elementor_migration(): array {
		update_option( 'flowbie_wp_elementor_migration_opt_in', 1, false );
		return Flowbie_Wp_Fields_Elementor_Cache_Fix::fix_all_documents();
	}
}

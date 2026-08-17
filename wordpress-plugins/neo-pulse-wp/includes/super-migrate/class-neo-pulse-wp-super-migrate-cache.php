<?php
/**
 * Post-import cache flush for Super Import.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/super-migrate/adapters/class-neo-pulse-wp-migrate-source-elementor.php';

class Neo_Pulse_Wp_Super_Migrate_Cache {

	/**
	 * Clear Elementor element/CSS caches and flush WordPress + NEO Pulse caches.
	 *
	 * @return array<string, mixed>
	 */
	public static function flush_after_import(): array {
		$stats = array(
			'elementor_documents_processed' => 0,
			'elementor_documents_patched'   => 0,
			'elementor_css_cleared'         => false,
			'site_cache_flushed'            => false,
		);

		if ( Neo_Pulse_Wp_Migrate_Source_Elementor::is_elementor_present() ) {
			if ( ! class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Cache_Fix', false ) ) {
				require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-cache-fix.php';
			}

			$fix = Neo_Pulse_Wp_Fields_Elementor_Cache_Fix::fix_all_documents();
			$stats['elementor_documents_processed'] = (int) ( $fix['documents_processed'] ?? 0 );
			$stats['elementor_documents_patched']   = (int) ( $fix['documents_patched'] ?? 0 );
			$stats['elementor_css_cleared']         = true;

			update_option( Neo_Pulse_Wp_Fields_Elementor_Cache_Fix::OPTION_KEY, 1, false );
		}

		if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
			Neo_Pulse_Wp_Cache_Flush::flush_all();
			$stats['site_cache_flushed'] = true;
		}

		return $stats;
	}
}

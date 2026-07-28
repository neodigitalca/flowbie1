<?php
/**
 * Aggregate stats for Speed image optimization.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stores counters in flowbie_wp_speed_image_stats option.
 */
class Flowbie_Wp_Speed_Image_Stats {

	const OPTION_KEY = 'flowbie_wp_speed_image_stats';

	/**
	 * @return array<string, int>
	 */
	public static function get(): array {
		$raw = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}
		return array_merge(
			array(
				'attachments_optimized' => 0,
				'bytes_saved'           => 0,
				'webp_count'            => 0,
				'last_run'              => 0,
			),
			array_map( 'intval', $raw )
		);
	}

	/**
	 * @param int $attachments Delta attachments.
	 * @param int $bytes_saved Delta bytes saved.
	 * @param int $webp_added  Delta webp files.
	 */
	public static function record( int $attachments, int $bytes_saved, int $webp_added ): void {
		$stats = self::get();
		$stats['attachments_optimized'] += max( 0, $attachments );
		$stats['bytes_saved']           += max( 0, $bytes_saved );
		$stats['webp_count']            += max( 0, $webp_added );
		$stats['last_run']               = time();
		update_option( self::OPTION_KEY, $stats, false );
	}

	public static function reset(): void {
		update_option(
			self::OPTION_KEY,
			array(
				'attachments_optimized' => 0,
				'bytes_saved'           => 0,
				'webp_count'            => 0,
				'last_run'              => 0,
			),
			false
		);
	}

	/**
	 * Count attachments with optimization meta.
	 */
	public static function recount_from_meta(): void {
		global $wpdb;

		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(DISTINCT post_id) FROM {$wpdb->postmeta} WHERE meta_key = %s",
				Flowbie_Wp_Speed_Image_Settings::VERSION_META
			)
		);

		$stats = self::get();
		$stats['attachments_optimized'] = $count;
		update_option( self::OPTION_KEY, $stats, false );
	}
}

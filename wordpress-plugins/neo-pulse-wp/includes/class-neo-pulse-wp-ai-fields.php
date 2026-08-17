<?php
/**
 * AI wand field definitions.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Ai_Fields {

	const META_AI_FIELDS = array( 'title', 'focus_keyword', 'excerpt' );

	const ALL_FIELDS = array(
		'title',
		'focus_keyword',
		'excerpt',
		'seo_research',
		'faq',
		'page_url',
		'date_modifier',
	);

	/**
	 * @return array<string,string>
	 */
	public static function labels(): array {
		return array(
			'title'         => __( 'Title', 'neo-pulse-wp' ),
			'focus_keyword' => __( 'Focus keyword', 'neo-pulse-wp' ),
			'excerpt'       => __( 'Meta description', 'neo-pulse-wp' ),
			'seo_research'  => __( 'SEO research', 'neo-pulse-wp' ),
			'faq'           => __( 'FAQ', 'neo-pulse-wp' ),
			'page_url'      => __( 'Page URL', 'neo-pulse-wp' ),
			'date_modifier' => __( 'Date modifier', 'neo-pulse-wp' ),
		);
	}

	public static function is_allowed( string $field ): bool {
		return in_array( $field, self::ALL_FIELDS, true );
	}

	public static function is_meta_ai_field( string $field ): bool {
		return in_array( $field, self::META_AI_FIELDS, true );
	}
}

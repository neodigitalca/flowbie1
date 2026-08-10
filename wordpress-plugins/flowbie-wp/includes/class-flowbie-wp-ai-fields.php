<?php
/**
 * AI wand field definitions.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Fields {

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
			'title'         => __( 'Title', 'flowbie-wp' ),
			'focus_keyword' => __( 'Focus keyword', 'flowbie-wp' ),
			'excerpt'       => __( 'Meta description', 'flowbie-wp' ),
			'seo_research'  => __( 'SEO research', 'flowbie-wp' ),
			'faq'           => __( 'FAQ', 'flowbie-wp' ),
			'page_url'      => __( 'Page URL', 'flowbie-wp' ),
			'date_modifier' => __( 'Date modifier', 'flowbie-wp' ),
		);
	}

	public static function is_allowed( string $field ): bool {
		return in_array( $field, self::ALL_FIELDS, true );
	}

	public static function is_meta_ai_field( string $field ): bool {
		return in_array( $field, self::META_AI_FIELDS, true );
	}
}

<?php
/**
 * SEO block slot and library builder tests.
 *
 * @package Flowbie_Wp
 */

define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-slots.php';
require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/seo-builder/class-flowbie-wp-seo-blocks-library.php';

$slots = Flowbie_Wp_Seo_Blocks_Slots::normalize_list(
	array(
		array(
			'type' => 'h2',
			'text' => 'Window Treatments SEO',
		),
		array(
			'type' => 'paragraph',
			'html' => '<p>Sample paragraph.</p>',
		),
		array(
			'type' => 'cta',
			'label'=> 'Get a quote',
			'url'  => '/contact',
			'style'=> 'primary',
		),
	)
);

assert( count( $slots ) === 3, 'expected three normalized slots' );
assert( $slots[0]['text'] === 'Window Treatments SEO', 'h2 text preserved' );

$html = Flowbie_Wp_Seo_Blocks_Slots::render_html( $slots );
assert( strpos( $html, '<h2' ) !== false, 'renders h2' );
assert( strpos( $html, 'Get a quote' ) !== false, 'renders cta label' );

$row = array(
	'id'            => 1,
	'title'         => 'Window Treatments SEO',
	'focus_keyword' => 'window treatments',
	'topic_focus'   => 'Explain benefits of custom blinds for local homeowners.',
	'slots'         => $slots,
);

$settings = Flowbie_Wp_Seo_Blocks_Library::row_to_widget_settings( $row );
assert( $settings['focus_keyword'] === 'window treatments', 'widget settings keyword' );
assert( count( $settings['content_slots'] ) === 3, 'widget settings slots count' );

$elements = Flowbie_Wp_Seo_Blocks_Library::build_section_elements( $settings );
assert( $elements[0]['elType'] === 'section', 'root is section' );
assert( $elements[0]['elements'][0]['elType'] === 'column', 'section has column' );
$widget = $elements[0]['elements'][0]['elements'][0];
assert( $widget['widgetType'] === 'flowbie_seo_section', 'widget type correct' );
assert( count( $widget['settings']['content_slots'] ) === 3, 'elementor widget slot count' );

echo "OK seo-builder tests\n";

<?php
/**
 * Display text entity decoding tests.
 *
 * Run: php tests/test-display-text.php
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );

require_once dirname( __DIR__ ) . '/includes/class-flowbie-wp-display-text.php';

function display_text_assert( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
	echo "PASS: {$message}\n";
}

display_text_assert(
	Flowbie_Wp_Display_Text::decode( 'Pain &#038; Root Canals' ) === 'Pain & Root Canals',
	'numeric entity &#038; decodes to ampersand'
);

display_text_assert(
	Flowbie_Wp_Display_Text::decode( 'Pain &amp;#038; Root Canals' ) === 'Pain & Root Canals',
	'double-encoded ampersand decodes to single ampersand'
);

display_text_assert(
	Flowbie_Wp_Display_Text::decode( 'Plain title' ) === 'Plain title',
	'plain text unchanged'
);

$card = Flowbie_Wp_Display_Text::decode_card(
	array(
		'title'          => 'Tooth Decay &#038; Pain',
		'body'           => 'Learn about &#8217; relief',
		'cta'            => array(
			'label' => 'Book &#038; Go',
			'url'   => 'https://example.com/book/',
		),
		'links'          => array(
			array(
				'label' => 'Services &#038; Pricing',
				'url'   => 'https://example.com/services/',
			),
		),
		'relatedTopics'  => array(
			'What &#038; when?',
		),
	)
);

display_text_assert( $card['title'] === 'Tooth Decay & Pain', 'decode_card decodes title' );
display_text_assert( $card['body'] === 'Learn about ’ relief', 'decode_card decodes body' );
display_text_assert( $card['cta']['label'] === 'Book & Go', 'decode_card decodes cta label' );
display_text_assert( $card['links'][0]['label'] === 'Services & Pricing', 'decode_card decodes link label' );
display_text_assert( $card['relatedTopics'][0] === 'What & when?', 'decode_card decodes relatedTopics' );

echo "All display text tests passed.\n";

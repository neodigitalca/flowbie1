<?php
/**
 * FAQPage schema.org JSON-LD output.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Faq_Schema {

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 * @return array<string, mixed>
	 */
	public static function build_faq_page( array $entries ): array {
		$main_entity = array();

		foreach ( $entries as $entry ) {
			$question = trim( (string) ( $entry['question'] ?? '' ) );
			$answer   = trim( wp_strip_all_tags( (string) ( $entry['answer'] ?? '' ) ) );
			if ( $question === '' && $answer === '' ) {
				continue;
			}
			$main_entity[] = array(
				'@type'          => 'Question',
				'name'           => $question,
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $answer,
				),
			);
		}

		return array(
			'@context'   => 'https://schema.org',
			'@type'      => 'FAQPage',
			'mainEntity' => $main_entity,
		);
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 * @return string
	 */
	public static function render_script( array $entries ): string {
		if ( empty( $entries ) ) {
			return '';
		}

		$schema = self::build_faq_page( $entries );
		if ( empty( $schema['mainEntity'] ) ) {
			return '';
		}

		$json = wp_json_encode( $schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) || $json === '' ) {
			return '';
		}

		return '<script type="application/ld+json">' . $json . '</script>';
	}
}

<?php
/**
 * Backend Assist — WYSIWYG body sub-agent harness.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Subagent_Wysiwyg {

	/** @var array<string, mixed>|null */
	public static $test_outputs = null;

	public const HTML_FORMAT = 'Write semantic HTML only: <h2>, <h3>, <p>, <ul>/<ol>/<li>, <table>, <a>. No markdown. No JSON-LD in body.';

	/**
	 * @return array{artifact: mixed, field: string, body_ops?: array<int, array<string, mixed>>}|WP_Error
	 */
	public static function run_agent( string $agent_id, string $message, array $history, int $post_id, array $prior = array() ) {
		switch ( $agent_id ) {
			case 'body_heading':
				return self::run_body_heading( $message, $history, $post_id );
			case 'body_section':
				return self::run_body_section( $message, $history, $post_id, $prior );
			case 'body_intro':
				return self::run_body_intro( $message, $history, $post_id );
			case 'body_faq_table':
				return self::run_body_faq_table( $message, $history, $post_id, $prior );
			case 'body_full_post':
				return self::run_body_full_post( $message, $history, $post_id );
			default:
				return new WP_Error( 'neo-pulse_wysiwyg_agent', __( 'WYSIWYG agent not implemented in this release.', 'neo-pulse-wp' ) );
		}
	}

	/**
	 * @return array{artifact: string, field: string, body_ops: array<int, array<string, mixed>>}|WP_Error
	 */
	public static function run_body_heading( string $message, array $history, int $post_id ) {
		if ( is_array( self::$test_outputs ) && isset( self::$test_outputs['body_heading'] ) ) {
			$heading = trim( (string) self::$test_outputs['body_heading'] );
		} else {
			$ops = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::build_heading_change_ops_public( $message, $post_id, $history );
			if ( is_wp_error( $ops ) ) {
				return $ops;
			}
			if ( ! is_array( $ops ) || empty( $ops[0]['new_heading'] ) ) {
				return new WP_Error( 'neo-pulse_body_heading', __( 'Heading agent returned empty copy.', 'neo-pulse-wp' ) );
			}
			return array(
				'artifact' => (string) $ops[0]['new_heading'],
				'field'    => 'body_heading',
				'body_ops' => $ops,
			);
		}

		if ( $heading === '' ) {
			return new WP_Error( 'neo-pulse_body_heading', __( 'Heading agent returned empty copy.', 'neo-pulse-wp' ) );
		}

		$sec = self::resolve_target_section( $message, $post_id, $history );
		if ( is_wp_error( $sec ) ) {
			return $sec;
		}

		return array(
			'artifact'  => $heading,
			'field'     => 'body_heading',
			'body_ops'  => array(
				array(
					'op'            => 'replace_heading',
					'section_index' => (int) ( $sec['index'] ?? 0 ),
					'new_heading'   => $heading,
				),
			),
		);
	}

	/**
	 * @return array{artifact: string, field: string, body_ops: array<int, array<string, mixed>>}|WP_Error
	 */
	public static function run_body_section( string $message, array $history, int $post_id, array $prior = array() ) {
		if ( is_array( self::$test_outputs ) && isset( self::$test_outputs['body_section'] ) ) {
			$html = trim( (string) self::$test_outputs['body_section'] );
		} else {
			$sec = self::resolve_target_section( $message, $post_id, $history );
			if ( is_wp_error( $sec ) ) {
				return $sec;
			}
			$post = get_post( $post_id );
			if ( ! $post instanceof WP_Post ) {
				return new WP_Error( 'neo-pulse_body_section', __( 'Post not found.', 'neo-pulse-wp' ) );
			}
			$html_full = (string) $post->post_content;
			$start     = (int) ( $sec['start'] ?? 0 );
			$end       = (int) ( $sec['end'] ?? strlen( $html_full ) );
			$chunk     = substr( $html_full, $start, max( 0, $end - $start ) );
			$heading   = (string) ( $sec['heading_text'] ?? '' );
			if ( $heading !== '' && $heading !== '(intro)' ) {
				$chunk = preg_replace( '/<h[23][^>]*>.*?<\/h[23]>/is', '', $chunk, 1 );
			}
			$generated = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::generate_section_html_for_replace( $message, $heading, trim( $chunk ) );
			if ( is_wp_error( $generated ) ) {
				return $generated;
			}
			$html = $generated;
		}

		$html = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::strip_json_ld_from_html( $html );
		if ( trim( $html ) === '' ) {
			return new WP_Error( 'neo-pulse_body_section', __( 'Section agent returned empty HTML.', 'neo-pulse-wp' ) );
		}

		$sec = self::resolve_target_section( $message, $post_id, $history );
		if ( is_wp_error( $sec ) ) {
			return $sec;
		}

		return array(
			'artifact' => $html,
			'field'    => 'body_section',
			'body_ops' => array(
				array(
					'op'            => 'replace_section_html',
					'section_index' => (int) ( $sec['index'] ?? 0 ),
					'html'          => $html,
				),
			),
		);
	}

	/**
	 * @return array{artifact: string, field: string, body_ops: array<int, array<string, mixed>>}|WP_Error
	 */
	public static function run_body_intro( string $message, array $history, int $post_id ) {
		$intro_msg = $message;
		if ( ! preg_match( '/\bintro\b/i', $intro_msg ) ) {
			$intro_msg .= ' (target the intro section)';
		}
		return self::run_body_section( $intro_msg, $history, $post_id, array() );
	}

	/**
	 * @return array{artifact: string, field: string}|WP_Error
	 */
	public static function run_body_faq_table( string $message, array $history, int $post_id, array $prior = array() ) {
		$entries = null;
		if ( ! empty( $prior['faq_entries'] ) && is_array( $prior['faq_entries'] ) ) {
			$entries = $prior['faq_entries'];
		} else {
			$entries = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::generate_faq_qa_pairs( $post_id, $message, $history );
		}
		if ( is_wp_error( $entries ) ) {
			return $entries;
		}

		$html = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::faq_entries_to_table_html( $entries );
		if ( trim( $html ) === '' ) {
			return new WP_Error( 'neo-pulse_faq_table', __( 'FAQ table generation failed.', 'neo-pulse-wp' ) );
		}

		return array(
			'artifact'    => $html,
			'field'       => 'body_faq_table',
			'faq_entries' => $entries,
		);
	}

	/**
	 * @return array{artifact: string, field: string}|WP_Error
	 */
	public static function run_body_full_post( string $message, array $history, int $post_id ) {
		$params = array( 'post_id' => $post_id );
		$html   = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::generate_post_body_html( $message, $history, $params );
		if ( is_wp_error( $html ) ) {
			return $html;
		}
		return array(
			'artifact' => (string) $html,
			'field'    => 'content',
		);
	}

	/**
	 * @param array<int, array<string, mixed>> $history
	 * @return array<string, mixed>|WP_Error
	 */
	private static function resolve_target_section( string $message, int $post_id, array $history ) {
		$ops = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::build_heading_change_ops_public( $message, $post_id, $history );
		if ( is_array( $ops ) && ! empty( $ops[0]['section_index'] ) ) {
			$idx  = (int) $ops[0]['section_index'];
			$post = get_post( $post_id );
			if ( ! $post instanceof WP_Post ) {
				return new WP_Error( 'neo-pulse_body_target', __( 'Post not found.', 'neo-pulse-wp' ) );
			}
			$sections = Neo_Pulse_Wp_Backend_Assist_Body_Ops::index_html_sections( (string) $post->post_content );
			foreach ( $sections as $sec ) {
				if ( (int) ( $sec['index'] ?? -1 ) === $idx ) {
					return $sec;
				}
			}
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'neo-pulse_body_target', __( 'Could not resolve body section.', 'neo-pulse-wp' ) );
		}
		$sections = Neo_Pulse_Wp_Backend_Assist_Body_Ops::index_html_sections( (string) $post->post_content );
		if ( $sections === array() ) {
			return new WP_Error( 'neo-pulse_body_target', __( 'Could not resolve body section.', 'neo-pulse-wp' ) );
		}

		if ( preg_match( '/\bintro\b/i', $message ) ) {
			return $sections[0];
		}

		$intent = Neo_Pulse_Wp_Backend_Assist_Pipeline_Content_Prep::classify_body_edit_intent( $message, $post_id, $history );
		if ( ! is_wp_error( $intent ) && isset( $intent['section_index'] ) && $intent['section_index'] !== null ) {
			$idx = (int) $intent['section_index'];
			foreach ( $sections as $sec ) {
				if ( (int) ( $sec['index'] ?? -1 ) === $idx ) {
					return $sec;
				}
			}
		}

		return $sections[0];
	}
}

<?php
/**
 * FAQ front-end renderer.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Faq_Renderer {

	/** @var array<int, string> */
	private static $heading_tags = array( 'h2', 'h3', 'h4', 'h5', 'h6' );

	/**
	 * @param array<string,mixed> $args Widget / instance settings.
	 * @return string
	 */
	public static function render_instance( array $args ): string {
		Flowbie_Wp_Faq::enqueue_frontend_assets();

		$entries = self::resolve_entries( $args );

		return self::wrap_markup( $args, $entries, empty( $entries ) );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<int, array{question: string, answer: string}>
	 */
	private static function resolve_entries( array $args ): array {
		$from_widget = self::entries_from_widget( $args );
		if ( ! empty( $from_widget ) ) {
			return $from_widget;
		}

		$post_id = self::resolve_post_id( $args );
		if ( $post_id < 1 ) {
			return array();
		}

		$field_name = self::resolve_field_name( $post_id, $args );
		$field      = Flowbie_Wp_Fields_Values::find_field( $field_name, $post_id );
		$raw        = null;

		if ( is_array( $field ) ) {
			$raw = Flowbie_Wp_Fields_Values::get_value( $post_id, $field, false );
		} else {
			$raw = get_post_meta( $post_id, $field_name, true );
		}

		return Flowbie_Wp_Faq_Parser::parse( $raw, is_array( $field ) ? $field : null );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<int, array{question: string, answer: string}>
	 */
	private static function entries_from_widget( array $args ): array {
		if ( empty( $args['faq_items'] ) || ! is_array( $args['faq_items'] ) ) {
			return array();
		}

		$entries = array();
		foreach ( $args['faq_items'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$question = trim( (string) ( $row['question'] ?? '' ) );
			$answer   = trim( (string) ( $row['answer'] ?? '' ) );
			if ( $question === '' && $answer === '' ) {
				continue;
			}
			$entries[] = array(
				'question' => $question,
				'answer'   => $answer,
			);
		}

		return $entries;
	}

	/**
	 * @param array<string,mixed> $args
	 */
	private static function resolve_post_id( array $args ): int {
		if ( ! empty( $args['post_id'] ) ) {
			return (int) $args['post_id'];
		}
		if ( class_exists( '\Elementor\Plugin', false ) ) {
			if ( ! class_exists( 'Flowbie_Wp_Fields_Elementor_Registry', false ) ) {
				require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-registry.php';
			}
			$editor_id = Flowbie_Wp_Fields_Elementor_Registry::resolve_editor_post_id();
			if ( $editor_id > 0 ) {
				return $editor_id;
			}
		}
		$queried = get_queried_object_id();
		if ( $queried > 0 ) {
			return $queried;
		}
		$post_id = get_the_ID();
		return $post_id ? (int) $post_id : 0;
	}

	/**
	 * @param array<string,mixed> $args
	 */
	private static function resolve_field_name( int $post_id, array $args ): string {
		if ( ( $args['field_mode'] ?? 'auto' ) === 'manual' && ! empty( $args['field_name'] ) ) {
			return sanitize_key( (string) $args['field_name'] );
		}
		foreach ( array( 'faq', 'seo_faq' ) as $name ) {
			if ( metadata_exists( 'post', $post_id, $name ) ) {
				$raw = get_post_meta( $post_id, $name, true );
				if ( $raw !== '' && $raw !== false && $raw !== null ) {
					return $name;
				}
			}
		}
		return 'faq';
	}

	/**
	 * @param array<string,mixed>                              $args
	 * @param array<int, array{question: string, answer: string}> $entries
	 */
	private static function wrap_markup( array $args, array $entries, bool $is_empty ): string {
		$layout          = sanitize_key( (string) ( $args['layout'] ?? 'accordion' ) );
		$allowed_layouts = array( 'accordion', 'table', 'list', 'cards' );
		if ( ! in_array( $layout, $allowed_layouts, true ) ) {
			$layout = 'accordion';
		}

		$instance_id = ! empty( $args['instance_id'] ) ? sanitize_html_class( (string) $args['instance_id'] ) : 'faq-' . wp_unique_id();
		$heading     = trim( (string) ( $args['heading'] ?? '' ) );
		$empty_msg   = trim( (string) ( $args['empty_message'] ?? __( 'No FAQ items found for this page yet.', 'flowbie-wp' ) ) );
		$heading_tag = strtolower( (string) ( $args['heading_tag'] ?? 'h2' ) );
		if ( ! in_array( $heading_tag, self::$heading_tags, true ) ) {
			$heading_tag = 'h2';
		}

		$classes = array(
			'flowbie-faq',
			'flowbie-faq--' . $layout,
		);
		if ( ! empty( $args['css_class'] ) ) {
			foreach ( preg_split( '/\s+/', (string) $args['css_class'] ) as $class ) {
				$class = sanitize_html_class( $class );
				if ( $class !== '' ) {
					$classes[] = $class;
				}
			}
		}

		$attrs = array(
			'class'                    => implode( ' ', $classes ),
			'data-flowbie-faq'         => '1',
			'data-flowbie-faq-layout'  => $layout,
			'data-flowbie-faq-id'      => $instance_id,
		);

		if ( $layout === 'accordion' ) {
			$attrs['data-flowbie-faq-allow-multiple'] = ! empty( $args['accordion_allow_multiple'] ) ? '1' : '0';
		}
		if ( $layout === 'table' && empty( $args['table_show_header'] ) ) {
			$attrs['data-flowbie-faq-table-no-header'] = '1';
		}
		if ( $layout === 'cards' && ! empty( $args['card_columns'] ) ) {
			$attrs['style'] = self::build_css_vars( $args );
		} elseif ( ! empty( $args['css_vars'] ) && is_array( $args['css_vars'] ) ) {
			$attrs['style'] = self::build_css_vars( $args );
		} else {
			$style = self::build_css_vars( $args );
			if ( $style !== '' ) {
				$attrs['style'] = $style;
			}
		}

		$html  = '<div ' . self::attr_string( $attrs ) . '>';
		$html .= self::render_header( $heading, $heading_tag );

		if ( $is_empty ) {
			$html .= '<p class="flowbie-faq__empty">' . esc_html( $empty_msg ) . '</p>';
		} else {
			$html .= '<div class="flowbie-faq__items">';
			switch ( $layout ) {
				case 'table':
					$html .= self::render_table( $entries, $args, $instance_id );
					break;
				case 'list':
					$html .= self::render_list( $entries, $instance_id );
					break;
				case 'cards':
					$html .= self::render_cards( $entries, $instance_id );
					break;
				default:
					$html .= self::render_accordion( $entries, $args, $instance_id );
					break;
			}
			$html .= '</div>';
		}

		$html .= '</div>';

		if ( ! $is_empty && ! empty( $args['enable_schema'] ) ) {
			$html .= Flowbie_Wp_Faq_Schema::render_script( $entries );
		}

		return $html;
	}

	private static function render_header( string $heading, string $heading_tag ): string {
		if ( $heading === '' ) {
			return '';
		}
		return '<header class="flowbie-faq__header"><' . $heading_tag . ' class="flowbie-faq__heading">' . esc_html( $heading ) . '</' . $heading_tag . '></header>';
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 * @param array<string,mixed>                                 $args
	 */
	private static function render_accordion( array $entries, array $args, string $instance_id ): string {
		$first_open = ! empty( $args['accordion_first_open'] );
		$html       = '';

		foreach ( $entries as $index => $entry ) {
			$is_open    = $first_open && $index === 0;
			$trigger_id = $instance_id . '-trigger-' . $index;
			$panel_id   = $instance_id . '-panel-' . $index;
			$item_class = 'flowbie-faq__item flowbie-faq__item--accordion' . ( $is_open ? ' flowbie-faq__item--open' : '' );

			$html .= '<div class="' . esc_attr( $item_class ) . '" data-flowbie-faq-item>';
			$html .= '<button type="button" class="flowbie-faq__trigger" id="' . esc_attr( $trigger_id ) . '" aria-expanded="' . ( $is_open ? 'true' : 'false' ) . '" aria-controls="' . esc_attr( $panel_id ) . '">';
			$html .= '<span class="flowbie-faq__question">' . esc_html( $entry['question'] ) . '</span>';
			$html .= '<span class="flowbie-faq__icon" aria-hidden="true"></span>';
			$html .= '</button>';
			$html .= '<div class="flowbie-faq__panel" id="' . esc_attr( $panel_id ) . '" role="region" aria-labelledby="' . esc_attr( $trigger_id ) . '"' . ( $is_open ? '' : ' hidden' ) . '>';
			$html .= '<div class="flowbie-faq__answer">' . self::format_answer( $entry['answer'] ) . '</div>';
			$html .= '</div>';
			$html .= '</div>';
		}

		return $html;
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 * @param array<string,mixed>                                 $args
	 */
	private static function render_table( array $entries, array $args, string $instance_id ): string {
		$q_header = trim( (string) ( $args['table_question_header'] ?? __( 'Question', 'flowbie-wp' ) ) );
		$a_header = trim( (string) ( $args['table_answer_header'] ?? __( 'Answer', 'flowbie-wp' ) ) );
		$show_hdr = ! isset( $args['table_show_header'] ) || ! empty( $args['table_show_header'] );

		$html = '<table class="flowbie-faq__table">';
		if ( $show_hdr ) {
			$html .= '<thead><tr>';
			$html .= '<th scope="col" class="flowbie-faq__th flowbie-faq__th--question">' . esc_html( $q_header ) . '</th>';
			$html .= '<th scope="col" class="flowbie-faq__th flowbie-faq__th--answer">' . esc_html( $a_header ) . '</th>';
			$html .= '</tr></thead>';
		}
		$html .= '<tbody>';
		foreach ( $entries as $index => $entry ) {
			$row_class = ( $index % 2 === 1 && ! empty( $args['table_zebra'] ) ) ? ' flowbie-faq__row--alt' : '';
			$html     .= '<tr class="flowbie-faq__row' . esc_attr( $row_class ) . '">';
			$html     .= '<td class="flowbie-faq__cell flowbie-faq__cell--question"><span class="flowbie-faq__question">' . esc_html( $entry['question'] ) . '</span></td>';
			$html     .= '<td class="flowbie-faq__cell flowbie-faq__cell--answer"><div class="flowbie-faq__answer">' . self::format_answer( $entry['answer'] ) . '</div></td>';
			$html     .= '</tr>';
		}
		$html .= '</tbody></table>';
		return $html;
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 */
	private static function render_list( array $entries, string $instance_id ): string {
		$html = '<dl class="flowbie-faq__list">';
		foreach ( $entries as $index => $entry ) {
			$dt_id = $instance_id . '-q-' . $index;
			$dd_id = $instance_id . '-a-' . $index;
			$html .= '<div class="flowbie-faq__item flowbie-faq__item--list">';
			$html .= '<dt class="flowbie-faq__question" id="' . esc_attr( $dt_id ) . '">' . esc_html( $entry['question'] ) . '</dt>';
			$html .= '<dd class="flowbie-faq__answer" id="' . esc_attr( $dd_id ) . '" aria-labelledby="' . esc_attr( $dt_id ) . '">' . self::format_answer( $entry['answer'] ) . '</dd>';
			$html .= '</div>';
		}
		$html .= '</dl>';
		return $html;
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $entries
	 */
	private static function render_cards( array $entries, string $instance_id ): string {
		$html = '<div class="flowbie-faq__cards">';
		foreach ( $entries as $index => $entry ) {
			$html .= '<article class="flowbie-faq__card flowbie-faq__item" aria-labelledby="' . esc_attr( $instance_id . '-card-q-' . $index ) . '">';
			$html .= '<h3 class="flowbie-faq__question" id="' . esc_attr( $instance_id . '-card-q-' . $index ) . '">' . esc_html( $entry['question'] ) . '</h3>';
			$html .= '<div class="flowbie-faq__answer">' . self::format_answer( $entry['answer'] ) . '</div>';
			$html .= '</article>';
		}
		$html .= '</div>';
		return $html;
	}

	private static function format_answer( string $answer ): string {
		$answer = trim( $answer );
		if ( $answer === '' ) {
			return '';
		}
		if ( $answer !== wp_strip_all_tags( $answer ) ) {
			return wp_kses_post( $answer );
		}
		return wpautop( esc_html( $answer ) );
	}

	/**
	 * @param array<string,mixed> $args
	 */
	private static function build_css_vars( array $args ): string {
		$vars = array();
		if ( ! empty( $args['css_vars'] ) && is_array( $args['css_vars'] ) ) {
			foreach ( $args['css_vars'] as $key => $value ) {
				if ( $value === '' || $value === null ) {
					continue;
				}
				$vars[ (string) $key ] = (string) $value;
			}
		}
		if ( ! empty( $args['card_columns'] ) ) {
			$vars['--ff-faq-card-columns'] = max( 1, min( 4, (int) $args['card_columns'] ) );
		}
		if ( empty( $vars ) ) {
			return '';
		}
		$parts = array();
		foreach ( $vars as $key => $value ) {
			$key = preg_replace( '/[^a-zA-Z0-9\-_]/', '', (string) $key );
			if ( $key === '' ) {
				continue;
			}
			$parts[] = $key . ':' . $value;
		}
		return implode( ';', $parts ) . ';';
	}

	/**
	 * @param array<string, string|int> $attrs
	 */
	private static function attr_string( array $attrs ): string {
		$parts = array();
		foreach ( $attrs as $key => $value ) {
			if ( $value === '' || $value === null ) {
				continue;
			}
			$parts[] = esc_attr( (string) $key ) . '="' . esc_attr( (string) $value ) . '"';
		}
		return implode( ' ', $parts );
	}
}

<?php
/**
 * Shared Elementor repeater controls and schema conversion for NEO Pulse Forms.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms_Field_Controls {

	/**
	 * Flat field type options for Elementor SELECT.
	 *
	 * @return array<string, string>
	 */
	public static function get_type_options(): array {
		$options = array();
		foreach ( Neo_Pulse_Wp_Forms_Field_Registry::choices_grouped() as $group => $types ) {
			$prefix = $group === 'advanced' ? __( 'Advanced', 'neo-pulse-wp' ) . ': ' : '';
			foreach ( $types as $slug => $label ) {
				$options[ $slug ] = $prefix . $label;
			}
		}
		return $options;
	}

	/**
	 * @param \Elementor\Repeater $repeater
	 */
	public static function register_repeater_content_controls( $repeater ): void {
		$repeater->add_control(
			'field_id',
			array(
				'label'   => esc_html__( 'Field ID', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$repeater->add_control(
			'type',
			array(
				'label'   => esc_html__( 'Field type', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'text',
				'options' => self::get_type_options(),
			)
		);

		$repeater->add_control(
			'label',
			array(
				'label'   => esc_html__( 'Label', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'default' => '',
			)
		);

		$repeater->add_control(
			'name',
			array(
				'label'     => esc_html__( 'Field name', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array(
					'type!' => array( 'html', 'section' ),
				),
			)
		);

		$repeater->add_control(
			'required',
			array(
				'label'        => esc_html__( 'Required', 'neo-pulse-wp' ),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'condition'    => array(
					'type!' => array( 'html', 'section', 'hidden' ),
				),
			)
		);

		$text_types = array( 'text', 'textarea', 'email', 'phone', 'number', 'website', 'date', 'time' );
		$repeater->add_control(
			'placeholder',
			array(
				'label'     => esc_html__( 'Placeholder', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'condition' => array(
					'type' => $text_types,
				),
			)
		);

		$repeater->add_control(
			'default_value',
			array(
				'label'     => esc_html__( 'Default value', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'condition' => array(
					'type' => $text_types,
				),
			)
		);

		$repeater->add_control(
			'choices_text',
			array(
				'label'       => esc_html__( 'Choices', 'neo-pulse-wp' ),
				'type'        => \Elementor\Controls_Manager::TEXTAREA,
				'description' => esc_html__( 'One per line: Label|value', 'neo-pulse-wp' ),
				'condition'   => array(
					'type' => array( 'select', 'checkbox', 'radio' ),
				),
			)
		);

		$repeater->add_control(
			'consent_label',
			array(
				'label'     => esc_html__( 'Consent text', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::WYSIWYG,
				'condition' => array(
					'type' => 'consent',
				),
			)
		);

		$repeater->add_control(
			'allowed_mime_types',
			array(
				'label'     => esc_html__( 'Allowed file types', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'default'   => 'pdf,doc,docx,jpg,jpeg,png,gif',
				'condition' => array(
					'type' => 'file',
				),
			)
		);

		$repeater->add_control(
			'max_file_size_mb',
			array(
				'label'     => esc_html__( 'Max file size (MB)', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::NUMBER,
				'min'       => 1,
				'max'       => 50,
				'default'   => 5,
				'condition' => array(
					'type' => 'file',
				),
			)
		);

		$repeater->add_control(
			'html_content',
			array(
				'label'     => esc_html__( 'HTML content', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::WYSIWYG,
				'condition' => array(
					'type' => 'html',
				),
			)
		);

		$repeater->add_control(
			'section_description',
			array(
				'label'     => esc_html__( 'Section description', 'neo-pulse-wp' ),
				'type'      => \Elementor\Controls_Manager::TEXTAREA,
				'condition' => array(
					'type' => 'section',
				),
			)
		);

		self::register_subfield_toggles( $repeater, 'name', 'name_subfields', Neo_Pulse_Wp_Forms_Field_Registry::default_name_subfields() );
		self::register_subfield_toggles( $repeater, 'address', 'address_subfields', Neo_Pulse_Wp_Forms_Field_Registry::default_address_subfields() );

		$repeater->add_control(
			'css_class',
			array(
				'label'       => esc_html__( 'CSS classes', 'neo-pulse-wp' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'description' => esc_html__( 'Space-separated custom classes.', 'neo-pulse-wp' ),
			)
		);
	}

	/**
	 * @param \Elementor\Repeater          $repeater
	 * @param string                       $type
	 * @param string                       $key
	 * @param array<string, bool>          $defaults
	 */
	private static function register_subfield_toggles( $repeater, string $type, string $key, array $defaults ): void {
		foreach ( $defaults as $sub_key => $default_on ) {
			$repeater->add_control(
				$key . '_' . $sub_key,
				array(
					'label'        => ucwords( str_replace( '_', ' ', $sub_key ) ),
					'type'         => \Elementor\Controls_Manager::SWITCHER,
					'return_value' => 'yes',
					'default'      => $default_on ? 'yes' : '',
					'condition'    => array(
						'type' => $type,
					),
				)
			);
		}
	}

	/**
	 * @param \Elementor\Repeater $repeater
	 */
	public static function register_repeater_style_controls( $repeater ): void {
		$repeater->add_control(
			'field_width',
			array(
				'label'   => esc_html__( 'Field width', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => '100',
				'options' => array(
					'100' => '100%',
					'50'  => '50%',
					'33'  => '33%',
				),
			)
		);

		$repeater->add_control(
			'hide_label',
			array(
				'label'        => esc_html__( 'Hide label', 'neo-pulse-wp' ),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'return_value' => 'yes',
			)
		);

		$repeater->add_control(
			'field_label_color',
			array(
				'label' => esc_html__( 'Label color', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::COLOR,
			)
		);

		$repeater->add_control(
			'field_input_bg',
			array(
				'label' => esc_html__( 'Input background', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::COLOR,
			)
		);

		$repeater->add_control(
			'field_input_color',
			array(
				'label' => esc_html__( 'Input text color', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::COLOR,
			)
		);

		$repeater->add_control(
			'field_border_color',
			array(
				'label' => esc_html__( 'Input border color', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::COLOR,
			)
		);
	}

	/**
	 * @param array<string,mixed> $row Repeater row.
	 * @return array<string,mixed>
	 */
	public static function repeater_row_to_field( array $row ): array {
		$type = isset( $row['type'] ) ? (string) $row['type'] : 'text';
		$field_id = isset( $row['field_id'] ) && (string) $row['field_id'] !== ''
			? (string) $row['field_id']
			: 'fld_' . uniqid();

		$field = Neo_Pulse_Wp_Forms_Field_Registry::default_field( $type );
		$field['id']    = $field_id;
		$field['type']  = $type;
		$field['label'] = isset( $row['label'] ) ? (string) $row['label'] : $field['label'];
		if ( ! empty( $row['name'] ) ) {
			$field['name'] = sanitize_key( (string) $row['name'] );
		}
		$field['required']       = ! empty( $row['required'] ) && $row['required'] === 'yes';
		$field['placeholder']    = (string) ( $row['placeholder'] ?? '' );
		$field['default_value']  = (string) ( $row['default_value'] ?? '' );
		$field['css_class']      = (string) ( $row['css_class'] ?? '' );
		$field['html_content']   = (string) ( $row['html_content'] ?? '' );
		$field['section_description'] = (string) ( $row['section_description'] ?? '' );
		$field['consent_label']  = (string) ( $row['consent_label'] ?? '' );
		$field['allowed_mime_types'] = (string) ( $row['allowed_mime_types'] ?? $field['allowed_mime_types'] );
		$field['max_file_size_mb']   = isset( $row['max_file_size_mb'] ) ? (int) $row['max_file_size_mb'] : $field['max_file_size_mb'];

		if ( ! empty( $row['choices_text'] ) ) {
			$field['choices'] = self::parse_choices_text( (string) $row['choices_text'] );
		}

		$field['name_subfields']    = self::row_subfields( $row, 'name_subfields', Neo_Pulse_Wp_Forms_Field_Registry::default_name_subfields() );
		$field['address_subfields'] = self::row_subfields( $row, 'address_subfields', Neo_Pulse_Wp_Forms_Field_Registry::default_address_subfields() );

		return Neo_Pulse_Wp_Forms_Field_Registry::normalize_field( $field );
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	public static function repeater_to_schema( array $rows ): array {
		$fields = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$fields[] = self::repeater_row_to_field( $row );
		}
		return $fields;
	}

	/**
	 * @param array<int,array<string,mixed>> $fields
	 * @return array<int,array<string,mixed>>
	 */
	public static function schema_to_repeater_rows( array $fields ): array {
		$rows = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$field = Neo_Pulse_Wp_Forms_Field_Registry::normalize_field( $field );
			$row   = array(
				'field_id'            => (string) $field['id'],
				'type'                => (string) $field['type'],
				'label'               => (string) $field['label'],
				'name'                => (string) $field['name'],
				'required'            => ! empty( $field['required'] ) ? 'yes' : '',
				'placeholder'         => (string) $field['placeholder'],
				'default_value'       => (string) $field['default_value'],
				'choices_text'        => self::choices_to_text( $field['choices'] ?? array() ),
				'consent_label'       => (string) $field['consent_label'],
				'allowed_mime_types'  => (string) $field['allowed_mime_types'],
				'max_file_size_mb'    => (int) $field['max_file_size_mb'],
				'css_class'           => (string) $field['css_class'],
				'html_content'        => (string) $field['html_content'],
				'section_description' => (string) $field['section_description'],
				'field_width'         => '100',
			);
			foreach ( Neo_Pulse_Wp_Forms_Field_Registry::default_name_subfields() as $key => $default ) {
				$row[ 'name_subfields_' . $key ] = ! empty( $field['name_subfields'][ $key ] ) ? 'yes' : '';
			}
			foreach ( Neo_Pulse_Wp_Forms_Field_Registry::default_address_subfields() as $key => $default ) {
				$row[ 'address_subfields_' . $key ] = ! empty( $field['address_subfields'][ $key ] ) ? 'yes' : '';
			}
			$rows[] = $row;
		}
		return $rows;
	}

	/**
	 * @param array<string,mixed> $settings Widget settings.
	 * @return array<string,mixed>
	 */
	public static function widget_settings_to_form_payload( array $settings ): array {
		$form_id = isset( $settings['linked_form_id'] ) ? (int) $settings['linked_form_id'] : 0;
		$key     = 'form_' . uniqid();
		if ( $form_id > 0 ) {
			$existing = Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id );
			if ( $existing && ! empty( $existing['key'] ) ) {
				$key = (string) $existing['key'];
			}
		}

		$emails_raw = isset( $settings['notification_emails'] ) ? (string) $settings['notification_emails'] : '';
		$emails     = array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $emails_raw ) ?: array() ) );

		$redirect = '';
		if ( isset( $settings['redirect_url'] ) && is_array( $settings['redirect_url'] ) && ! empty( $settings['redirect_url']['url'] ) ) {
			$redirect = (string) $settings['redirect_url']['url'];
		} elseif ( ! empty( $settings['redirect_url'] ) && is_string( $settings['redirect_url'] ) ) {
			$redirect = (string) $settings['redirect_url'];
		}

		return array(
			'ID'     => $form_id,
			'key'    => $key,
			'title'  => isset( $settings['form_title'] ) ? (string) $settings['form_title'] : __( 'Elementor Form', 'neo-pulse-wp' ),
			'active' => ! isset( $settings['form_active'] ) || $settings['form_active'] === 'yes',
			'settings' => array(
				'description'         => (string) ( $settings['form_description'] ?? '' ),
				'submit_button_label' => (string) ( $settings['submit_button_label'] ?? __( 'Submit', 'neo-pulse-wp' ) ),
				'success_message'     => (string) ( $settings['success_message'] ?? '' ),
				'redirect_url'        => $redirect,
				'notification_emails' => $emails,
				'honeypot_enabled'    => ! isset( $settings['honeypot_enabled'] ) || $settings['honeypot_enabled'] === 'yes',
				'store_ip'            => ! isset( $settings['store_ip'] ) || $settings['store_ip'] === 'yes',
				'require_login'       => ! empty( $settings['require_login'] ) && $settings['require_login'] === 'yes',
			),
			'fields' => self::repeater_to_schema( isset( $settings['form_fields'] ) && is_array( $settings['form_fields'] ) ? $settings['form_fields'] : array() ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $fields Repeater rows.
	 * @return array<string,array<string,mixed>>
	 */
	public static function extract_field_styles( array $fields ): array {
		$styles = array();
		foreach ( $fields as $row ) {
			if ( ! is_array( $row ) || empty( $row['field_id'] ) ) {
				continue;
			}
			$styles[ (string) $row['field_id'] ] = array(
				'field_width'        => (string) ( $row['field_width'] ?? '100' ),
				'hide_label'         => (string) ( $row['hide_label'] ?? '' ),
				'field_label_color'  => (string) ( $row['field_label_color'] ?? '' ),
				'field_input_bg'     => (string) ( $row['field_input_bg'] ?? '' ),
				'field_input_color'  => (string) ( $row['field_input_color'] ?? '' ),
				'field_border_color' => (string) ( $row['field_border_color'] ?? '' ),
			);
		}
		return $styles;
	}

	/**
	 * @param string $text
	 * @return array<int,array{label:string,value:string}>
	 */
	public static function parse_choices_text( string $text ): array {
		$lines = preg_split( '/\r\n|\r|\n/', $text ) ?: array();
		$choices = array();
		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( $line === '' ) {
				continue;
			}
			$parts = explode( '|', $line, 2 );
			$label = trim( $parts[0] );
			$value = isset( $parts[1] ) ? trim( $parts[1] ) : sanitize_title( $label );
			if ( $label === '' ) {
				continue;
			}
			$choices[] = array(
				'label' => $label,
				'value' => $value,
			);
		}
		return $choices;
	}

	/**
	 * @param array<int,array{label:string,value:string}> $choices
	 */
	public static function choices_to_text( array $choices ): string {
		$lines = array();
		foreach ( Neo_Pulse_Wp_Forms_Field_Registry::normalize_choices( $choices ) as $choice ) {
			$lines[] = $choice['label'] . '|' . $choice['value'];
		}
		return implode( "\n", $lines );
	}

	/**
	 * @param array<string,mixed> $row
	 * @param string              $prefix
	 * @param array<string,bool>  $defaults
	 * @return array<string,bool>
	 */
	private static function row_subfields( array $row, string $prefix, array $defaults ): array {
		$flags = $defaults;
		foreach ( $defaults as $key => $default ) {
			$row_key = $prefix . '_' . $key;
			if ( array_key_exists( $row_key, $row ) ) {
				$flags[ $key ] = ! empty( $row[ $row_key ] ) && $row[ $row_key ] === 'yes';
			}
		}
		return Neo_Pulse_Wp_Forms_Field_Registry::normalize_subfield_flags( $flags, $defaults );
	}
}

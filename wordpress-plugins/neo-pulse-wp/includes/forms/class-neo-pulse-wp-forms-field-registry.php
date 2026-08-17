<?php
/**
 * Form field type registry (frontend form builder).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Forms_Field_Registry {

	/**
	 * @return array<string, string> slug => label
	 */
	public static function choices(): array {
		$grouped = self::choices_grouped();
		$flat    = array();
		foreach ( $grouped as $types ) {
			foreach ( $types as $slug => $label ) {
				$flat[ $slug ] = $label;
			}
		}
		return apply_filters( 'neo_pulse_wp_forms_field_types', $flat );
	}

	/**
	 * @return array<string, array<string, string>>
	 */
	public static function choices_grouped(): array {
		$groups = array(
			'standard' => array(
				'text'     => __( 'Single Line Text', 'neo-pulse-wp' ),
				'textarea' => __( 'Paragraph Text', 'neo-pulse-wp' ),
				'select'   => __( 'Drop Down', 'neo-pulse-wp' ),
				'number'   => __( 'Number', 'neo-pulse-wp' ),
				'checkbox' => __( 'Checkboxes', 'neo-pulse-wp' ),
				'radio'    => __( 'Radio Buttons', 'neo-pulse-wp' ),
				'hidden'   => __( 'Hidden', 'neo-pulse-wp' ),
				'html'     => __( 'HTML', 'neo-pulse-wp' ),
				'section'  => __( 'Section', 'neo-pulse-wp' ),
			),
			'advanced' => array(
				'name'    => __( 'Name', 'neo-pulse-wp' ),
				'date'    => __( 'Date', 'neo-pulse-wp' ),
				'time'    => __( 'Time', 'neo-pulse-wp' ),
				'phone'   => __( 'Phone', 'neo-pulse-wp' ),
				'address' => __( 'Address', 'neo-pulse-wp' ),
				'website' => __( 'Website', 'neo-pulse-wp' ),
				'email'   => __( 'Email', 'neo-pulse-wp' ),
				'file'    => __( 'File Upload', 'neo-pulse-wp' ),
				'consent' => __( 'Consent', 'neo-pulse-wp' ),
			),
		);
		return apply_filters( 'neo_pulse_wp_forms_field_type_groups', $groups );
	}

	/**
	 * @return array<int, string>
	 */
	public static function slugs(): array {
		return array_keys( self::choices() );
	}

	public static function is_valid_type( string $type ): bool {
		return in_array( $type, self::slugs(), true );
	}

	/**
	 * Non-input field types (layout / display only).
	 *
	 * @return array<int, string>
	 */
	public static function display_only_types(): array {
		return array( 'html', 'section' );
	}

	/**
	 * Compound field types stored as associative arrays in meta.
	 *
	 * @return array<int, string>
	 */
	public static function compound_types(): array {
		return array( 'name', 'address' );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function default_name_subfields(): array {
		return array(
			'prefix' => false,
			'first'  => true,
			'last'   => true,
			'suffix' => false,
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function default_address_subfields(): array {
		return array(
			'street'  => true,
			'street2' => true,
			'city'    => true,
			'state'   => true,
			'zip'     => true,
			'country' => false,
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function default_field( string $type = 'text' ): array {
		if ( ! self::is_valid_type( $type ) ) {
			$type = 'text';
		}
		$label = self::choices()[ $type ] ?? __( 'Field', 'neo-pulse-wp' );
		$name  = 'field_' . substr( uniqid(), -6 );
		$field = array(
			'id'                 => 'fld_' . uniqid(),
			'type'               => $type,
			'label'              => $label,
			'name'               => sanitize_key( $name ),
			'required'           => false,
			'placeholder'        => '',
			'default_value'      => '',
			'choices'            => array(),
			'consent_label'      => '',
			'allowed_mime_types' => 'pdf,doc,docx,jpg,jpeg,png,gif',
			'max_file_size_mb'   => 5,
			'css_class'          => '',
			'html_content'       => '',
			'section_description' => '',
			'name_subfields'     => self::default_name_subfields(),
			'address_subfields' => self::default_address_subfields(),
		);
		if ( in_array( $type, array( 'select', 'radio', 'checkbox' ), true ) ) {
			$field['choices'] = array(
				array( 'label' => __( 'Option 1', 'neo-pulse-wp' ), 'value' => 'option_1' ),
				array( 'label' => __( 'Option 2', 'neo-pulse-wp' ), 'value' => 'option_2' ),
			);
		}
		if ( $type === 'consent' ) {
			$field['required']      = true;
			$field['consent_label'] = __( 'I agree to the privacy policy.', 'neo-pulse-wp' );
		}
		if ( $type === 'section' ) {
			$field['label'] = __( 'Section', 'neo-pulse-wp' );
		}
		if ( $type === 'name' ) {
			$field['label'] = __( 'Name', 'neo-pulse-wp' );
			$field['name']  = 'name';
		}
		if ( $type === 'address' ) {
			$field['label'] = __( 'Address', 'neo-pulse-wp' );
			$field['name']  = 'address';
		}
		return $field;
	}

	/**
	 * @param array<string, mixed> $field Raw field.
	 * @return array<string, mixed>
	 */
	public static function normalize_field( array $field ): array {
		$type = isset( $field['type'] ) ? sanitize_key( (string) $field['type'] ) : 'text';
		if ( ! self::is_valid_type( $type ) ) {
			$type = 'text';
		}
		$name = isset( $field['name'] ) ? sanitize_key( (string) $field['name'] ) : '';
		if ( $name === '' ) {
			$name = 'field_' . substr( uniqid(), -6 );
		}
		$out = array(
			'id'                  => isset( $field['id'] ) ? sanitize_text_field( (string) $field['id'] ) : 'fld_' . uniqid(),
			'type'                => $type,
			'label'               => sanitize_text_field( (string) ( $field['label'] ?? '' ) ),
			'name'                => $name,
			'required'            => ! empty( $field['required'] ),
			'placeholder'         => sanitize_text_field( (string) ( $field['placeholder'] ?? '' ) ),
			'default_value'       => sanitize_text_field( (string) ( $field['default_value'] ?? '' ) ),
			'choices'             => self::normalize_choices( $field['choices'] ?? array() ),
			'consent_label'       => wp_kses_post( (string) ( $field['consent_label'] ?? '' ) ),
			'allowed_mime_types'  => sanitize_text_field( (string) ( $field['allowed_mime_types'] ?? 'pdf,doc,docx,jpg,jpeg,png,gif' ) ),
			'max_file_size_mb'    => max( 1, min( 50, (int) ( $field['max_file_size_mb'] ?? 5 ) ) ),
			'css_class'           => self::sanitize_css_classes( (string) ( $field['css_class'] ?? '' ) ),
			'html_content'        => wp_kses_post( (string) ( $field['html_content'] ?? '' ) ),
			'section_description' => sanitize_textarea_field( (string) ( $field['section_description'] ?? '' ) ),
			'name_subfields'      => self::normalize_subfield_flags( $field['name_subfields'] ?? array(), self::default_name_subfields() ),
			'address_subfields'   => self::normalize_subfield_flags( $field['address_subfields'] ?? array(), self::default_address_subfields() ),
		);
		return $out;
	}

	/**
	 * @param mixed                $raw      Subfield flags.
	 * @param array<string, bool> $defaults Defaults.
	 * @return array<string, bool>
	 */
	public static function normalize_subfield_flags( $raw, array $defaults ): array {
		$out = $defaults;
		if ( ! is_array( $raw ) ) {
			return $out;
		}
		foreach ( $defaults as $key => $default ) {
			if ( array_key_exists( $key, $raw ) ) {
				$out[ $key ] = ! empty( $raw[ $key ] );
			}
		}
		return $out;
	}

	/**
	 * @param string $raw Space-separated CSS class names.
	 */
	public static function sanitize_css_classes( string $raw ): string {
		$parts = preg_split( '/\s+/', trim( $raw ) ) ?: array();
		$out   = array();
		foreach ( $parts as $part ) {
			$class = sanitize_html_class( (string) $part );
			if ( $class !== '' ) {
				$out[] = $class;
			}
		}
		return implode( ' ', array_unique( $out ) );
	}

	/**
	 * @param mixed $choices Choices.
	 * @return array<int, array{label: string, value: string}>
	 */
	public static function normalize_choices( $choices ): array {
		if ( ! is_array( $choices ) ) {
			return array();
		}
		$out = array();
		foreach ( $choices as $choice ) {
			if ( is_string( $choice ) && $choice !== '' ) {
				$out[] = array(
					'label' => $choice,
					'value' => sanitize_title( $choice ),
				);
				continue;
			}
			if ( ! is_array( $choice ) ) {
				continue;
			}
			$label = sanitize_text_field( (string) ( $choice['label'] ?? '' ) );
			$value = sanitize_key( (string) ( $choice['value'] ?? '' ) );
			if ( $value === '' && $label !== '' ) {
				$value = sanitize_title( $label );
			}
			if ( $label === '' && $value === '' ) {
				continue;
			}
			if ( $label === '' ) {
				$label = $value;
			}
			$out[] = array(
				'label' => $label,
				'value' => $value,
			);
		}
		return $out;
	}

	/**
	 * Flattened CSV column keys for a field.
	 *
	 * @param array<string, mixed> $field Field config.
	 * @return array<int, string>
	 */
	public static function csv_columns_for_field( array $field ): array {
		$type = (string) ( $field['type'] ?? 'text' );
		$name = (string) ( $field['name'] ?? '' );
		if ( $name === '' || in_array( $type, self::display_only_types(), true ) ) {
			return array();
		}
		if ( $type === 'name' ) {
			$cols = array();
			$subs = self::normalize_subfield_flags( $field['name_subfields'] ?? array(), self::default_name_subfields() );
			foreach ( $subs as $key => $enabled ) {
				if ( $enabled ) {
					$cols[] = $name . '_' . $key;
				}
			}
			return $cols;
		}
		if ( $type === 'address' ) {
			$cols = array();
			$subs = self::normalize_subfield_flags( $field['address_subfields'] ?? array(), self::default_address_subfields() );
			foreach ( $subs as $key => $enabled ) {
				if ( $enabled ) {
					$cols[] = $name . '_' . $key;
				}
			}
			return $cols;
		}
		return array( $name );
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function default_settings(): array {
		return array(
			'description'          => '',
			'submit_button_label'  => __( 'Submit', 'neo-pulse-wp' ),
			'success_message'      => __( 'Thank you for your submission.', 'neo-pulse-wp' ),
			'redirect_url'         => '',
			'notification_emails'  => array( get_option( 'admin_email' ) ),
			'honeypot_enabled'     => true,
			'store_ip'             => true,
			'require_login'        => false,
		);
	}

	/**
	 * @param array<string, mixed> $settings Raw settings.
	 * @return array<string, mixed>
	 */
	public static function normalize_settings( array $settings ): array {
		$defaults = self::default_settings();
		$merged   = wp_parse_args( $settings, $defaults );

		$emails = $merged['notification_emails'];
		if ( is_string( $emails ) ) {
			$emails = array_filter( array_map( 'trim', explode( ',', $emails ) ) );
		}
		if ( ! is_array( $emails ) ) {
			$emails = array();
		}
		$clean_emails = array();
		foreach ( $emails as $email ) {
			$email = sanitize_email( (string) $email );
			if ( is_email( $email ) ) {
				$clean_emails[] = $email;
			}
		}
		if ( empty( $clean_emails ) ) {
			$clean_emails = array( get_option( 'admin_email' ) );
		}

		$redirect = esc_url_raw( (string) $merged['redirect_url'] );

		return array(
			'description'          => sanitize_textarea_field( (string) $merged['description'] ),
			'submit_button_label'  => sanitize_text_field( (string) $merged['submit_button_label'] ),
			'success_message'      => sanitize_text_field( (string) $merged['success_message'] ),
			'redirect_url'         => $redirect,
			'notification_emails'  => $clean_emails,
			'honeypot_enabled'     => ! empty( $merged['honeypot_enabled'] ),
			'store_ip'             => ! array_key_exists( 'store_ip', $settings ) || ! empty( $merged['store_ip'] ),
			'require_login'        => ! empty( $merged['require_login'] ),
		);
	}
}

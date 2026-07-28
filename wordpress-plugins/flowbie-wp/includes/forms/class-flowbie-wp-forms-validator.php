<?php
/**
 * Form submission validation.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Validator {

	/**
	 * @param array<string, mixed>       $form   Form definition.
	 * @param array<string, mixed>       $input  Submitted values (field name => value).
	 * @param array<string, array<string, mixed>> $files $_FILES slice keyed by field name.
	 * @return array{valid: bool, errors: array<string, string>, values: array<string, mixed>}
	 */
	public static function validate( array $form, array $input, array $files = array() ): array {
		$errors = array();
		$values = array();
		$fields = isset( $form['fields'] ) && is_array( $form['fields'] ) ? $form['fields'] : array();

		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$name = (string) ( $field['name'] ?? '' );
			$type = (string) ( $field['type'] ?? 'text' );

			if ( in_array( $type, Flowbie_Wp_Forms_Field_Registry::display_only_types(), true ) ) {
				continue;
			}

			if ( $name === '' || $type === 'hidden' ) {
				if ( $name !== '' ) {
					$values[ $name ] = isset( $input[ $name ] ) ? sanitize_text_field( (string) $input[ $name ] ) : (string) ( $field['default_value'] ?? '' );
				}
				continue;
			}

			if ( $type === 'file' ) {
				$file_result = self::validate_file( $field, $files[ $name ] ?? null );
				if ( $file_result['error'] !== '' ) {
					$errors[ $name ] = $file_result['error'];
				} else {
					$values[ $name ] = $file_result['value'];
				}
				continue;
			}

			if ( $type === 'name' ) {
				$result = self::validate_compound( $field, $input, Flowbie_Wp_Forms_Field_Registry::default_name_subfields(), 'name_subfields' );
				if ( $result['error'] !== '' ) {
					$errors[ $name ] = $result['error'];
				} else {
					$values[ $name ] = $result['value'];
				}
				continue;
			}

			if ( $type === 'address' ) {
				$result = self::validate_compound( $field, $input, Flowbie_Wp_Forms_Field_Registry::default_address_subfields(), 'address_subfields' );
				if ( $result['error'] !== '' ) {
					$errors[ $name ] = $result['error'];
				} else {
					$values[ $name ] = $result['value'];
				}
				continue;
			}

			$raw = $input[ $name ] ?? null;

			if ( $type === 'checkbox' ) {
				$selected = array();
				if ( is_array( $raw ) ) {
					foreach ( $raw as $v ) {
						$selected[] = sanitize_text_field( (string) $v );
					}
				} elseif ( $raw !== null && $raw !== '' ) {
					$selected[] = sanitize_text_field( (string) $raw );
				}
				if ( ! empty( $field['required'] ) && empty( $selected ) ) {
					$errors[ $name ] = self::required_message( $field );
					continue;
				}
				$values[ $name ] = $selected;
				continue;
			}

			if ( $type === 'consent' ) {
				$checked = ! empty( $raw ) && $raw !== '0';
				if ( ! empty( $field['required'] ) && ! $checked ) {
					$errors[ $name ] = __( 'You must accept to continue.', 'flowbie-wp' );
					continue;
				}
				$values[ $name ] = $checked ? '1' : '0';
				continue;
			}

			$value = is_array( $raw ) ? '' : sanitize_text_field( (string) $raw );

			if ( ! empty( $field['required'] ) && $value === '' ) {
				$errors[ $name ] = self::required_message( $field );
				continue;
			}

			if ( $value === '' ) {
				$values[ $name ] = '';
				continue;
			}

			switch ( $type ) {
				case 'email':
					if ( ! is_email( $value ) ) {
						$errors[ $name ] = __( 'Please enter a valid email address.', 'flowbie-wp' );
					}
					break;
				case 'phone':
					if ( ! preg_match( '/^[\d\s\-\+\(\)\.]{6,30}$/', $value ) ) {
						$errors[ $name ] = __( 'Please enter a valid phone number.', 'flowbie-wp' );
					}
					break;
				case 'number':
					if ( ! is_numeric( $value ) ) {
						$errors[ $name ] = __( 'Please enter a valid number.', 'flowbie-wp' );
					}
					break;
				case 'website':
					if ( ! filter_var( $value, FILTER_VALIDATE_URL ) ) {
						$errors[ $name ] = __( 'Please enter a valid URL.', 'flowbie-wp' );
					}
					break;
				case 'date':
					if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
						$errors[ $name ] = __( 'Please enter a valid date.', 'flowbie-wp' );
					}
					break;
				case 'time':
					if ( ! preg_match( '/^\d{2}:\d{2}(:\d{2})?$/', $value ) ) {
						$errors[ $name ] = __( 'Please enter a valid time.', 'flowbie-wp' );
					}
					break;
				case 'select':
				case 'radio':
					if ( ! self::is_allowed_choice( $field, $value ) ) {
						$errors[ $name ] = __( 'Please select a valid option.', 'flowbie-wp' );
					}
					break;
			}

			if ( ! isset( $errors[ $name ] ) ) {
				$values[ $name ] = $value;
			}
		}

		return array(
			'valid'  => empty( $errors ),
			'errors' => $errors,
			'values' => $values,
		);
	}

	/**
	 * @param array<string, mixed> $field    Field.
	 * @param array<string, mixed> $input    POST input.
	 * @param array<string, bool>  $defaults Subfield defaults.
	 * @param string               $flag_key name_subfields | address_subfields.
	 * @return array{error: string, value: array<string, string>}
	 */
	private static function validate_compound( array $field, array $input, array $defaults, string $flag_key ): array {
		$name     = (string) ( $field['name'] ?? '' );
		$flags    = Flowbie_Wp_Forms_Field_Registry::normalize_subfield_flags( $field[ $flag_key ] ?? array(), $defaults );
		$raw      = $input[ $name ] ?? array();
		$raw      = is_array( $raw ) ? $raw : array();
		$out      = array();
		$required = ! empty( $field['required'] );
		$has_any  = false;

		foreach ( $flags as $key => $enabled ) {
			if ( ! $enabled ) {
				continue;
			}
			$val = isset( $raw[ $key ] ) ? sanitize_text_field( (string) $raw[ $key ] ) : '';
			$out[ $key ] = $val;
			if ( $val !== '' ) {
				$has_any = true;
			}
		}

		if ( $required && ! $has_any ) {
			return array(
				'error' => self::required_message( $field ),
				'value' => array(),
			);
		}

		if ( $required ) {
			foreach ( $flags as $key => $enabled ) {
				if ( ! $enabled ) {
					continue;
				}
				if ( in_array( $key, array( 'first', 'last', 'street', 'city' ), true ) && ( $out[ $key ] ?? '' ) === '' ) {
					return array(
						'error' => self::required_message( $field ),
						'value' => array(),
					);
				}
			}
		}

		return array(
			'error' => '',
			'value' => $out,
		);
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	private static function required_message( array $field ): string {
		$label = (string) ( $field['label'] ?? __( 'This field', 'flowbie-wp' ) );
		return sprintf(
			/* translators: %s: field label */
			__( '%s is required.', 'flowbie-wp' ),
			$label
		);
	}

	/**
	 * @param array<string, mixed> $field Field.
	 */
	private static function is_allowed_choice( array $field, string $value ): bool {
		$choices = Flowbie_Wp_Forms_Field_Registry::normalize_choices( $field['choices'] ?? array() );
		foreach ( $choices as $choice ) {
			if ( (string) $choice['value'] === $value ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array<string, mixed>      $field Field.
	 * @param array<string, mixed>|null $file  File upload array.
	 * @return array{error: string, value: mixed}
	 */
	private static function validate_file( array $field, ?array $file ): array {
		$name     = (string) ( $field['name'] ?? '' );
		$required = ! empty( $field['required'] );
		if ( ! $file || empty( $file['name'] ) || (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE ) === UPLOAD_ERR_NO_FILE ) {
			if ( $required ) {
				return array(
					'error' => self::required_message( $field ),
					'value' => null,
				);
			}
			return array( 'error' => '', 'value' => '' );
		}

		if ( (int) $file['error'] !== UPLOAD_ERR_OK ) {
			return array(
				'error' => __( 'File upload failed. Please try again.', 'flowbie-wp' ),
				'value' => null,
			);
		}

		$max_mb = max( 1, (int) ( $field['max_file_size_mb'] ?? 5 ) );
		$max_b  = $max_mb * 1024 * 1024;
		if ( (int) ( $file['size'] ?? 0 ) > $max_b ) {
			return array(
				'error' => sprintf(
					/* translators: %d: max megabytes */
					__( 'File must be smaller than %d MB.', 'flowbie-wp' ),
					$max_mb
				),
				'value' => null,
			);
		}

		$allowed = self::parse_mime_extensions( (string) ( $field['allowed_mime_types'] ?? '' ) );
		$ext     = strtolower( pathinfo( (string) $file['name'], PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, $allowed, true ) ) {
			return array(
				'error' => __( 'File type is not allowed.', 'flowbie-wp' ),
				'value' => null,
			);
		}

		return array(
			'error' => '',
			'value' => array(
				'tmp_name' => (string) $file['tmp_name'],
				'name'     => sanitize_file_name( (string) $file['name'] ),
				'type'     => (string) ( $file['type'] ?? '' ),
				'size'     => (int) ( $file['size'] ?? 0 ),
				'field'    => $name,
			),
		);
	}

	/**
	 * @return array<int, string>
	 */
	private static function parse_mime_extensions( string $raw ): array {
		$parts = array_filter( array_map( 'trim', explode( ',', strtolower( $raw ) ) ) );
		if ( empty( $parts ) ) {
			return array( 'pdf', 'jpg', 'jpeg', 'png', 'gif' );
		}
		return array_values( $parts );
	}
}

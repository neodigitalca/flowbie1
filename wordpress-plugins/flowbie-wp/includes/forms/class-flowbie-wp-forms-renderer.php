<?php
/**
 * Frontend form HTML renderer.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Forms_Renderer {

	/** @var bool */
	private static $assets_registered = false;

	/**
	 * @param array<string, mixed> $form         Form definition.
	 * @param array<string, mixed> $render_args  Wrapper/style overrides.
	 */
	public static function render( array $form, array $render_args = array() ): string {
		if ( empty( $form['ID'] ) ) {
			return '';
		}

		$form_id = (int) $form['ID'];
		if ( empty( $form['active'] ) || ( $form['status'] ?? '' ) === 'trash' ) {
			return '<p class="flowbie-form__inactive">' . esc_html__( 'This form is not currently accepting submissions.', 'flowbie-wp' ) . '</p>';
		}

		self::enqueue_assets( $form_id );

		$settings    = $form['settings'] ?? array();
		$fields      = isset( $form['fields'] ) && is_array( $form['fields'] ) ? $form['fields'] : array();
		$nonce       = wp_create_nonce( 'flowbie_form_submit_' . $form_id );
		$wrapper_cls = 'flowbie-form';
		if ( ! empty( $render_args['elementor'] ) || ! empty( $render_args['is_elementor'] ) ) {
			$wrapper_cls .= ' flowbie-form--elementor';
		}
		if ( ! empty( $render_args['full_width'] ) && $render_args['full_width'] === 'yes' ) {
			$wrapper_cls .= ' flowbie-form--full-width';
		}
		if ( ! empty( $render_args['wrapper_class'] ) ) {
			$wrapper_cls .= ' ' . Flowbie_Wp_Forms_Field_Registry::sanitize_css_classes( (string) $render_args['wrapper_class'] );
		}

		$css_vars = self::build_css_vars( $render_args );

		ob_start();
		?>
		<div
			class="<?php echo esc_attr( $wrapper_cls ); ?>"
			id="flowbie-form-<?php echo esc_attr( (string) $form_id ); ?>"
			data-form-id="<?php echo esc_attr( (string) $form_id ); ?>"
			<?php if ( $css_vars !== '' ) : ?>
				style="<?php echo esc_attr( $css_vars ); ?>"
			<?php endif; ?>
		>
			<?php if ( ! empty( $settings['description'] ) ) : ?>
				<p class="flowbie-form__description"><?php echo esc_html( (string) $settings['description'] ); ?></p>
			<?php endif; ?>
			<div class="flowbie-form__messages" role="alert" aria-live="polite" hidden></div>
			<form class="flowbie-form__form" method="post" enctype="multipart/form-data" novalidate>
				<input type="hidden" name="form_id" value="<?php echo esc_attr( (string) $form_id ); ?>" />
				<?php if ( ! empty( $settings['honeypot_enabled'] ) ) : ?>
					<div class="flowbie-form__hp" aria-hidden="true">
						<label for="flowbie_hp_<?php echo esc_attr( (string) $form_id ); ?>"><?php esc_html_e( 'Leave empty', 'flowbie-wp' ); ?></label>
						<input type="text" name="flowbie_hp" id="flowbie_hp_<?php echo esc_attr( (string) $form_id ); ?>" tabindex="-1" autocomplete="off" />
					</div>
				<?php endif; ?>
				<div class="flowbie-form__fields">
				<?php foreach ( $fields as $field ) : ?>
					<?php if ( is_array( $field ) ) : ?>
						<?php echo self::render_field( $field, $render_args ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<?php endif; ?>
				<?php endforeach; ?>
				</div>
				<p class="flowbie-form__submit">
					<button type="submit" class="flowbie-form__button">
						<?php echo esc_html( (string) ( $settings['submit_button_label'] ?? __( 'Submit', 'flowbie-wp' ) ) ); ?>
					</button>
				</p>
			</form>
		</div>
		<?php
		$html = (string) ob_get_clean();

		wp_localize_script(
			'flowbie-forms',
			'flowbieFormsConfig_' . $form_id,
			array(
				'formId'  => $form_id,
				'restUrl' => rest_url( 'flowbie/v1/forms/' . $form_id . '/submit' ),
				'nonce'   => $nonce,
				'ajax'    => true,
			)
		);

		return $html;
	}

	/**
	 * @param array<string,mixed> $render_args
	 */
	private static function build_css_vars( array $render_args ): string {
		$map = array(
			'primary_color'   => '--ff-primary',
			'bg_color'        => '--ff-bg',
			'text_color'      => '--ff-text',
			'border_color'    => '--ff-border',
			'radius'          => '--ff-radius',
			'label_color'     => '--ff-label-color',
			'input_bg'        => '--ff-input-bg',
			'button_bg'       => '--ff-button-bg',
			'button_text'     => '--ff-button-text',
			'field_gap'       => '--ff-field-gap',
		);

		$parts = array();
		foreach ( $map as $key => $var ) {
			if ( empty( $render_args[ $key ] ) ) {
				continue;
			}
			$value = (string) $render_args[ $key ];
			if ( in_array( $key, array( 'radius', 'field_gap' ), true ) && is_numeric( $value ) ) {
				$value .= 'px';
			}
			if ( in_array( $key, array( 'primary_color', 'bg_color', 'text_color', 'border_color', 'label_color', 'input_bg', 'button_bg', 'button_text' ), true ) ) {
				$color = sanitize_hex_color( $value );
				if ( ! $color ) {
					continue;
				}
				$value = $color;
			}
			$parts[] = $var . ':' . $value;
		}

		if ( ! empty( $render_args['max_width'] ) && is_array( $render_args['max_width'] ) && isset( $render_args['max_width']['size'] ) ) {
			$unit = isset( $render_args['max_width']['unit'] ) ? (string) $render_args['max_width']['unit'] : 'px';
			$parts[] = '--ff-max-width:' . (float) $render_args['max_width']['size'] . $unit;
		} elseif ( ! empty( $render_args['max_width_size'] ) ) {
			$parts[] = '--ff-max-width:' . esc_attr( (string) $render_args['max_width_size'] );
		}

		return implode( ';', $parts );
	}

	private static function enqueue_assets( int $form_id ): void {
		Flowbie_Wp_Forms::enqueue_frontend_assets();
		self::$assets_registered = true;
	}

	/**
	 * @param array<string, mixed> $field       Field config.
	 * @param array<string, mixed> $render_args Render context.
	 */
	public static function render_field( array $field, array $render_args = array() ): string {
		$type     = (string) ( $field['type'] ?? 'text' );
		$name     = (string) ( $field['name'] ?? '' );
		$label    = (string) ( $field['label'] ?? '' );
		$field_id = (string) ( $field['id'] ?? '' );
		$id       = 'flowbie_field_' . $name;
		$req      = ! empty( $field['required'] );
		$class    = 'flowbie-form__field flowbie-form__field--' . sanitize_html_class( $type );
		if ( $type === 'name' ) {
			$class .= ' flowbie-form--name';
		}
		if ( ! empty( $field['css_class'] ) ) {
			$class .= ' ' . Flowbie_Wp_Forms_Field_Registry::sanitize_css_classes( (string) $field['css_class'] );
		}

		$field_styles = isset( $render_args['field_styles'] ) && is_array( $render_args['field_styles'] ) ? $render_args['field_styles'] : array();
		$style_row    = isset( $field_styles[ $field_id ] ) && is_array( $field_styles[ $field_id ] ) ? $field_styles[ $field_id ] : array();
		if ( ! empty( $style_row['field_width'] ) ) {
			$class .= ' flowbie-form__field--width-' . sanitize_html_class( (string) $style_row['field_width'] );
		}
		if ( ! empty( $style_row['hide_label'] ) && $style_row['hide_label'] === 'yes' ) {
			$class .= ' flowbie-form__field--hide-label';
		}

		$attr_id = $field_id !== '' ? ' data-field-id="' . esc_attr( $field_id ) . '"' : '';

		if ( $type === 'hidden' ) {
			$html = sprintf(
				'<input type="hidden" name="%s" value="%s" />',
				esc_attr( $name ),
				esc_attr( (string) ( $field['default_value'] ?? '' ) )
			);
			return apply_filters( 'flowbie_wp_forms_render_field', $html, $field, $render_args );
		}

		if ( $type === 'html' ) {
			$content = (string) ( $field['html_content'] ?? '' );
			if ( $content === '' ) {
				return '';
			}
			$html = '<div class="' . esc_attr( $class ) . ' flowbie-form__html"' . $attr_id . '>' . wp_kses_post( $content ) . '</div>';
			return apply_filters( 'flowbie_wp_forms_render_field', $html, $field, $render_args );
		}

		if ( $type === 'section' ) {
			ob_start();
			?>
			<div class="<?php echo esc_attr( $class ); ?> flowbie-form__section"<?php echo $attr_id; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
				<?php if ( $label !== '' ) : ?>
					<h3 class="flowbie-form__section-title"><?php echo esc_html( $label ); ?></h3>
				<?php endif; ?>
				<?php if ( ! empty( $field['section_description'] ) ) : ?>
					<p class="flowbie-form__section-desc"><?php echo esc_html( (string) $field['section_description'] ); ?></p>
				<?php endif; ?>
			</div>
			<?php
			$html = (string) ob_get_clean();
			return apply_filters( 'flowbie_wp_forms_render_field', $html, $field, $render_args );
		}

		ob_start();
		?>
		<div class="<?php echo esc_attr( $class ); ?>" data-field="<?php echo esc_attr( $name ); ?>"<?php echo $attr_id; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<?php if ( $type !== 'consent' && $label !== '' ) : ?>
				<label class="flowbie-form__label" for="<?php echo esc_attr( $id ); ?>">
					<?php echo esc_html( $label ); ?>
					<?php if ( $req ) : ?><span class="flowbie-form__required" aria-hidden="true">*</span><?php endif; ?>
				</label>
			<?php endif; ?>
			<div class="flowbie-form__control">
				<?php
				switch ( $type ) {
					case 'name':
						self::render_compound_inputs( $field, $name, 'name_subfields', Flowbie_Wp_Forms_Field_Registry::default_name_subfields(), array(
							'prefix' => __( 'Prefix', 'flowbie-wp' ),
							'first'  => __( 'First Name', 'flowbie-wp' ),
							'last'   => __( 'Last Name', 'flowbie-wp' ),
							'suffix' => __( 'Suffix', 'flowbie-wp' ),
						) );
						break;
					case 'address':
						self::render_compound_inputs( $field, $name, 'address_subfields', Flowbie_Wp_Forms_Field_Registry::default_address_subfields(), array(
							'street'  => __( 'Street Address', 'flowbie-wp' ),
							'street2' => __( 'Address Line 2', 'flowbie-wp' ),
							'city'    => __( 'City', 'flowbie-wp' ),
							'state'   => __( 'State / Province', 'flowbie-wp' ),
							'zip'     => __( 'ZIP / Postal Code', 'flowbie-wp' ),
							'country' => __( 'Country', 'flowbie-wp' ),
						) );
						break;
					case 'date':
						printf(
							'<input type="date" id="%s" name="%s" value="%s"%s />',
							esc_attr( $id ),
							esc_attr( $name ),
							esc_attr( (string) ( $field['default_value'] ?? '' ) ),
							$req ? ' required' : ''
						);
						break;
					case 'time':
						printf(
							'<input type="time" id="%s" name="%s" value="%s"%s />',
							esc_attr( $id ),
							esc_attr( $name ),
							esc_attr( (string) ( $field['default_value'] ?? '' ) ),
							$req ? ' required' : ''
						);
						break;
					case 'website':
						printf(
							'<input type="url" id="%s" name="%s" value="%s" placeholder="%s"%s />',
							esc_attr( $id ),
							esc_attr( $name ),
							esc_attr( (string) ( $field['default_value'] ?? '' ) ),
							esc_attr( (string) ( $field['placeholder'] ?? 'https://' ) ),
							$req ? ' required' : ''
						);
						break;
					case 'textarea':
						printf(
							'<textarea id="%s" name="%s" placeholder="%s" rows="4"%s></textarea>',
							esc_attr( $id ),
							esc_attr( $name ),
							esc_attr( (string) ( $field['placeholder'] ?? '' ) ),
							$req ? ' required' : ''
						);
						break;
					case 'select':
						echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '"' . ( $req ? ' required' : '' ) . '>';
						echo '<option value="">' . esc_html__( '— Select —', 'flowbie-wp' ) . '</option>';
						foreach ( Flowbie_Wp_Forms_Field_Registry::normalize_choices( $field['choices'] ?? array() ) as $choice ) {
							printf(
								'<option value="%s">%s</option>',
								esc_attr( (string) $choice['value'] ),
								esc_html( (string) $choice['label'] )
							);
						}
						echo '</select>';
						break;
					case 'radio':
						foreach ( Flowbie_Wp_Forms_Field_Registry::normalize_choices( $field['choices'] ?? array() ) as $i => $choice ) {
							$rid = $id . '_' . $i;
							printf(
								'<label class="flowbie-form__choice"><input type="radio" id="%s" name="%s" value="%s"%s /> %s</label>',
								esc_attr( $rid ),
								esc_attr( $name ),
								esc_attr( (string) $choice['value'] ),
								$req ? ' required' : '',
								esc_html( (string) $choice['label'] )
							);
						}
						break;
					case 'checkbox':
						foreach ( Flowbie_Wp_Forms_Field_Registry::normalize_choices( $field['choices'] ?? array() ) as $i => $choice ) {
							$cid = $id . '_' . $i;
							printf(
								'<label class="flowbie-form__choice"><input type="checkbox" id="%s" name="%s[]" value="%s" /> %s</label>',
								esc_attr( $cid ),
								esc_attr( $name ),
								esc_attr( (string) $choice['value'] ),
								esc_html( (string) $choice['label'] )
							);
						}
						break;
					case 'consent':
						printf(
							'<label class="flowbie-form__consent"><input type="checkbox" id="%s" name="%s" value="1"%s /> <span class="flowbie-form__consent-text">%s</span></label>',
							esc_attr( $id ),
							esc_attr( $name ),
							$req ? ' required' : '',
							wp_kses_post( (string) ( $field['consent_label'] ?? '' ) )
						);
						break;
					case 'file':
						printf(
							'<input type="file" id="%s" name="%s"%s />',
							esc_attr( $id ),
							esc_attr( $name ),
							$req ? ' required' : ''
						);
						break;
					default:
						$input_type = in_array( $type, array( 'email', 'phone', 'number', 'text', 'textarea' ), true ) ? $type : 'text';
						if ( $input_type === 'phone' ) {
							$input_type = 'tel';
						}
						if ( $input_type === 'textarea' ) {
							$input_type = 'text';
						}
						printf(
							'<input type="%s" id="%s" name="%s" value="%s" placeholder="%s"%s />',
							esc_attr( $input_type ),
							esc_attr( $id ),
							esc_attr( $name ),
							esc_attr( (string) ( $field['default_value'] ?? '' ) ),
							esc_attr( (string) ( $field['placeholder'] ?? '' ) ),
							$req ? ' required' : ''
						);
				}
				?>
			</div>
			<p class="flowbie-form__error" data-error-for="<?php echo esc_attr( $name ); ?>" hidden></p>
		</div>
		<?php
		$html = (string) ob_get_clean();
		return apply_filters( 'flowbie_wp_forms_render_field', $html, $field, $render_args );
	}

	/**
	 * @param array<string, mixed> $field    Field config.
	 * @param string               $name     Field name.
	 * @param string               $flag_key Subfield flags key.
	 * @param array<string, bool>  $defaults Default subfields.
	 * @param array<string, string> $labels  Subfield labels.
	 */
	private static function render_compound_inputs( array $field, string $name, string $flag_key, array $defaults, array $labels ): void {
		$flags = Flowbie_Wp_Forms_Field_Registry::normalize_subfield_flags( $field[ $flag_key ] ?? array(), $defaults );
		echo '<div class="flowbie-form__compound">';
		foreach ( $flags as $key => $enabled ) {
			if ( ! $enabled || ! isset( $labels[ $key ] ) ) {
				continue;
			}
			$sub_id = 'flowbie_field_' . $name . '_' . $key;
			printf(
				'<div class="flowbie-form__compound-item"><label for="%s">%s</label><input type="text" id="%s" name="%s[%s]" placeholder="%s" /></div>',
				esc_attr( $sub_id ),
				esc_html( $labels[ $key ] ),
				esc_attr( $sub_id ),
				esc_attr( $name ),
				esc_attr( $key ),
				esc_attr( (string) ( $field['placeholder'] ?? '' ) )
			);
		}
		echo '</div>';
	}
}

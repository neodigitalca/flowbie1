<?php
/**
 * Elementor NEO Pulse Form widget.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Group_Control_Typography;
use Elementor\Repeater;
use Elementor\Widget_Base;

class Neo_Pulse_Wp_Forms_Elementor_Widget extends Widget_Base {

	public function get_name(): string {
		return 'neo-pulse_form';
	}

	public function get_title(): string {
		return esc_html__( 'NEO Pulse Form', 'neo-pulse-wp' );
	}

	public function get_icon(): string {
		return 'eicon-form-horizontal';
	}

	/**
	 * @return array<int,string>
	 */
	public function get_categories(): array {
		return array( 'neo-pulse' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_keywords(): array {
		return array( 'form', 'contact', 'neo-pulse', 'lead', 'survey' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_style_depends(): array {
		return array( 'neo-pulse-forms' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_script_depends(): array {
		return array( 'neo-pulse-forms' );
	}

	protected function register_controls(): void {
		$this->register_source_controls();
		$this->register_form_settings_controls();
		$this->register_fields_controls();
		$this->register_layout_controls();
		$this->register_style_form_controls();
		$this->register_style_button_controls();
		$this->register_style_messages_controls();
	}

	private function register_source_controls(): void {
		$this->start_controls_section(
			'section_source',
			array(
				'label' => esc_html__( 'Form source', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'form_source',
			array(
				'label'   => esc_html__( 'Source', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'existing',
				'options' => array(
					'existing' => esc_html__( 'Existing form', 'neo-pulse-wp' ),
					'custom'   => esc_html__( 'Build in Elementor', 'neo-pulse-wp' ),
				),
			)
		);

		$form_options = array( '' => esc_html__( '— Select a form —', 'neo-pulse-wp' ) );
		foreach ( Neo_Pulse_Wp_Forms_Storage::get_all_forms( true ) as $form ) {
			$form_options[ (string) (int) $form['ID'] ] = (string) $form['title'];
		}

		$this->add_control(
			'form_id_select',
			array(
				'label'     => esc_html__( 'Select form', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'options'   => $form_options,
				'condition' => array(
					'form_source' => 'existing',
				),
			)
		);

		$this->add_control(
			'form_title',
			array(
				'label'       => esc_html__( 'Form title', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => esc_html__( 'Contact Form', 'neo-pulse-wp' ),
				'condition'   => array(
					'form_source' => 'custom',
				),
			)
		);

		$this->add_control(
			'form_active',
			array(
				'label'        => esc_html__( 'Active', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'default'      => 'yes',
				'condition'    => array(
					'form_source' => 'custom',
				),
			)
		);

		$this->add_control(
			'linked_form_id',
			array(
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->end_controls_section();
	}

	private function register_form_settings_controls(): void {
		$this->start_controls_section(
			'section_form_settings',
			array(
				'label'     => esc_html__( 'Form settings', 'neo-pulse-wp' ),
				'condition' => array(
					'form_source' => 'custom',
				),
			)
		);

		$this->add_control(
			'form_description',
			array(
				'label'   => esc_html__( 'Description', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::TEXTAREA,
				'default' => '',
			)
		);

		$this->add_control(
			'submit_button_label',
			array(
				'label'   => esc_html__( 'Submit button label', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::TEXT,
				'default' => esc_html__( 'Submit', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'success_message',
			array(
				'label'   => esc_html__( 'Success message', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::TEXT,
				'default' => esc_html__( 'Thank you for your submission.', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'redirect_url',
			array(
				'label'       => esc_html__( 'Redirect URL', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::URL,
				'placeholder' => 'https://',
			)
		);

		$this->add_control(
			'notification_emails',
			array(
				'label'       => esc_html__( 'Notification emails', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXTAREA,
				'description' => esc_html__( 'One email per line.', 'neo-pulse-wp' ),
				'default'     => get_option( 'admin_email' ),
			)
		);

		$this->add_control(
			'honeypot_enabled',
			array(
				'label'        => esc_html__( 'Honeypot spam protection', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'store_ip',
			array(
				'label'        => esc_html__( 'Store IP address', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'require_login',
			array(
				'label'        => esc_html__( 'Require login', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
			)
		);

		$this->end_controls_section();
	}

	private function register_fields_controls(): void {
		$this->start_controls_section(
			'section_fields',
			array(
				'label'     => esc_html__( 'Fields', 'neo-pulse-wp' ),
				'condition' => array(
					'form_source' => 'custom',
				),
			)
		);

		$repeater = new Repeater();
		Neo_Pulse_Wp_Forms_Field_Controls::register_repeater_content_controls( $repeater );
		Neo_Pulse_Wp_Forms_Field_Controls::register_repeater_style_controls( $repeater );

		$this->add_control(
			'form_fields',
			array(
				'label'       => esc_html__( 'Form fields', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(
					array(
						'field_id' => 'fld_email',
						'type'     => 'email',
						'label'    => esc_html__( 'Email', 'neo-pulse-wp' ),
						'name'     => 'email',
						'required' => 'yes',
					),
					array(
						'field_id' => 'fld_message',
						'type'     => 'textarea',
						'label'    => esc_html__( 'Message', 'neo-pulse-wp' ),
						'name'     => 'message',
						'required' => 'yes',
					),
				),
				'title_field' => '{{{ label }}} — {{{ type }}}',
			)
		);

		$this->end_controls_section();
	}

	private function register_layout_controls(): void {
		$this->start_controls_section(
			'section_layout',
			array(
				'label' => esc_html__( 'Layout', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_responsive_control(
			'align',
			array(
				'label'        => esc_html__( 'Alignment', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::CHOOSE,
				'options'      => array(
					'left'   => array(
						'title' => esc_html__( 'Left', 'neo-pulse-wp' ),
						'icon'  => 'eicon-text-align-left',
					),
					'center' => array(
						'title' => esc_html__( 'Center', 'neo-pulse-wp' ),
						'icon'  => 'eicon-text-align-center',
					),
					'right'  => array(
						'title' => esc_html__( 'Right', 'neo-pulse-wp' ),
						'icon'  => 'eicon-text-align-right',
					),
				),
				'prefix_class' => 'elementor%s-align-',
				'default'      => 'left',
			)
		);

		$this->add_responsive_control(
			'max_width',
			array(
				'label'      => esc_html__( 'Max width', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'rem' ),
				'range'      => array(
					'px'  => array( 'min' => 200, 'max' => 1200 ),
					'%'   => array( 'min' => 10, 'max' => 100 ),
					'rem' => array( 'min' => 10, 'max' => 80 ),
				),
				'default'    => array(
					'unit' => 'rem',
					'size' => 36,
				),
			)
		);

		$this->add_control(
			'field_gap',
			array(
				'label' => esc_html__( 'Field gap (px)', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::SLIDER,
				'range' => array(
					'px' => array( 'min' => 0, 'max' => 60 ),
				),
				'default' => array(
					'size' => 20,
				),
			)
		);

		$this->add_control(
			'full_width',
			array(
				'label'        => esc_html__( 'Full width', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
			)
		);

		$this->end_controls_section();
	}

	private function register_style_form_controls(): void {
		$this->start_controls_section(
			'section_style_form',
			array(
				'label' => esc_html__( 'Form fields', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'primary_color',
			array(
				'label' => esc_html__( 'Accent color', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'text_color',
			array(
				'label' => esc_html__( 'Text color', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'label_color',
			array(
				'label' => esc_html__( 'Label color', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'input_bg',
			array(
				'label' => esc_html__( 'Input background', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'border_color',
			array(
				'label' => esc_html__( 'Border color', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'radius',
			array(
				'label' => esc_html__( 'Border radius (px)', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::SLIDER,
				'range' => array(
					'px' => array( 'min' => 0, 'max' => 30 ),
				),
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'label_typography',
				'label'    => esc_html__( 'Label typography', 'neo-pulse-wp' ),
				'selector' => '{{WRAPPER}} .neo-pulse-form__label',
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'input_typography',
				'label'    => esc_html__( 'Input typography', 'neo-pulse-wp' ),
				'selector' => '{{WRAPPER}} .neo-pulse-form__control input, {{WRAPPER}} .neo-pulse-form__control select, {{WRAPPER}} .neo-pulse-form__control textarea',
			)
		);

		$this->add_responsive_control(
			'input_padding',
			array(
				'label'      => esc_html__( 'Input padding', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__control input, {{WRAPPER}} .neo-pulse-form__control select, {{WRAPPER}} .neo-pulse-form__control textarea' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'input_border',
				'selector' => '{{WRAPPER}} .neo-pulse-form__control input, {{WRAPPER}} .neo-pulse-form__control select, {{WRAPPER}} .neo-pulse-form__control textarea',
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'input_shadow',
				'selector' => '{{WRAPPER}} .neo-pulse-form__control input, {{WRAPPER}} .neo-pulse-form__control select, {{WRAPPER}} .neo-pulse-form__control textarea',
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'description_typography',
				'label'    => esc_html__( 'Description typography', 'neo-pulse-wp' ),
				'selector' => '{{WRAPPER}} .neo-pulse-form__description',
			)
		);

		$this->add_control(
			'description_color',
			array(
				'label'     => esc_html__( 'Description color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					'{{WRAPPER}} .neo-pulse-form__description' => 'color: {{VALUE}};',
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_button_controls(): void {
		$this->start_controls_section(
			'section_style_button',
			array(
				'label' => esc_html__( 'Submit button', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'button_bg',
			array(
				'label' => esc_html__( 'Background', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'button_text',
			array(
				'label' => esc_html__( 'Text color', 'neo-pulse-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'button_typography',
				'selector' => '{{WRAPPER}} .neo-pulse-form__button',
			)
		);

		$this->add_responsive_control(
			'button_padding',
			array(
				'label'      => esc_html__( 'Padding', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__button' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'button_border',
				'selector' => '{{WRAPPER}} .neo-pulse-form__button',
			)
		);

		$this->add_control(
			'button_radius',
			array(
				'label'      => esc_html__( 'Border radius', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__button' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'button_width',
			array(
				'label'   => esc_html__( 'Width', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'auto',
				'options' => array(
					'auto' => esc_html__( 'Auto', 'neo-pulse-wp' ),
					'full' => esc_html__( 'Full width', 'neo-pulse-wp' ),
				),
				'selectors' => array(
					'{{WRAPPER}} .neo-pulse-form__button' => 'width: {{VALUE}};',
				),
				'selectors_dictionary' => array(
					'auto' => 'auto',
					'full' => '100%',
				),
			)
		);

		$this->add_responsive_control(
			'button_spacing',
			array(
				'label'      => esc_html__( 'Spacing', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem' ),
				'range'      => array(
					'px'  => array(
						'min' => 0,
						'max' => 120,
					),
					'em'  => array(
						'min' => 0,
						'max' => 6,
						'step' => 0.1,
					),
					'rem' => array(
						'min' => 0,
						'max' => 6,
						'step' => 0.1,
					),
				),
				'default'    => array(
					'unit' => 'px',
					'size' => 16,
				),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__submit' => 'margin-top: {{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'button_hover_heading',
			array(
				'label'     => esc_html__( 'Hover', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		$this->add_control(
			'button_bg_hover',
			array(
				'label'     => esc_html__( 'Background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					'{{WRAPPER}} .neo-pulse-form__button:hover' => 'background-color: {{VALUE}};',
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_messages_controls(): void {
		$this->start_controls_section(
			'section_style_messages',
			array(
				'label' => esc_html__( 'Messages', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'message_typography',
				'selector' => '{{WRAPPER}} .neo-pulse-form__messages',
			)
		);

		$this->add_responsive_control(
			'message_padding',
			array(
				'label'      => esc_html__( 'Padding', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__messages' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'message_radius',
			array(
				'label'      => esc_html__( 'Border radius', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .neo-pulse-form__messages' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();
		$args     = self::map_settings( $settings );

		if ( ( $settings['form_source'] ?? 'existing' ) === 'custom' ) {
			$form_id = (int) ( $settings['linked_form_id'] ?? 0 );
			if ( $form_id < 1 && \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				$doc_id = get_the_ID();
				if ( $doc_id ) {
					$form_id = Neo_Pulse_Wp_Forms_Elementor_Sync::sync_widget_form( $settings, (int) $doc_id, (string) $this->get_id() );
					if ( $form_id > 0 ) {
						$args['linked_form_id'] = $form_id;
					}
				}
			}
			if ( empty( $args['linked_form_id'] ) && empty( $args['form_id'] ) ) {
				echo '<p class="neo-pulse-form__inactive">' . esc_html__( 'Save the page to activate this form, or add fields above.', 'neo-pulse-wp' ) . '</p>';
				return;
			}
			if ( empty( $settings['form_fields'] ) ) {
				echo '<p class="neo-pulse-form__inactive">' . esc_html__( 'Add fields in the widget panel to build your form.', 'neo-pulse-wp' ) . '</p>';
				return;
			}
		}

		$this->render_field_style_block( $settings );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from render_instance().
		echo Neo_Pulse_Wp_Forms::render_instance( $args );
	}

	/**
	 * @param array<string,mixed> $settings
	 */
	private function render_field_style_block( array $settings ): void {
		$fields = isset( $settings['form_fields'] ) && is_array( $settings['form_fields'] ) ? $settings['form_fields'] : array();
		if ( empty( $fields ) ) {
			return;
		}

		$scope = '.elementor-element-' . $this->get_id();
		$rules = array();
		foreach ( $fields as $row ) {
			if ( ! is_array( $row ) || empty( $row['field_id'] ) ) {
				continue;
			}
			$fid    = preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $row['field_id'] );
			$sel    = $scope . ' [data-field-id="' . $fid . '"]';
			$decls  = array();
			if ( ! empty( $row['field_label_color'] ) ) {
				$decls[] = 'color:' . sanitize_hex_color( (string) $row['field_label_color'] );
			}
			if ( ! empty( $decls ) ) {
				$rules[] = $sel . ' .neo-pulse-form__label{' . implode( ';', $decls ) . '}';
			}
			$input_decls = array();
			if ( ! empty( $row['field_input_bg'] ) ) {
				$input_decls[] = 'background:' . sanitize_hex_color( (string) $row['field_input_bg'] );
			}
			if ( ! empty( $row['field_input_color'] ) ) {
				$input_decls[] = 'color:' . sanitize_hex_color( (string) $row['field_input_color'] );
			}
			if ( ! empty( $row['field_border_color'] ) ) {
				$input_decls[] = 'border-color:' . sanitize_hex_color( (string) $row['field_border_color'] );
			}
			if ( ! empty( $input_decls ) ) {
				$rules[] = $sel . ' .neo-pulse-form__control input,' . $sel . ' .neo-pulse-form__control select,' . $sel . ' .neo-pulse-form__control textarea{' . implode( ';', $input_decls ) . '}';
			}
		}

		if ( ! empty( $rules ) ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Inline CSS with sanitized hex colors.
			echo '<style>' . wp_strip_all_tags( implode( '', $rules ) ) . '</style>';
		}
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<string,mixed>
	 */
	public static function map_settings( array $settings ): array {
		$form_source = isset( $settings['form_source'] ) ? (string) $settings['form_source'] : 'existing';
		$form_id     = 0;

		if ( $form_source === 'existing' ) {
			$form_id = (int) ( $settings['form_id_select'] ?? 0 );
		} else {
			$form_id = (int) ( $settings['linked_form_id'] ?? 0 );
		}

		$args = array(
			'form_id'      => $form_id,
			'linked_form_id' => $form_id,
			'form_source'  => $form_source,
			'is_elementor' => true,
			'elementor'    => true,
			'full_width'   => isset( $settings['full_width'] ) ? (string) $settings['full_width'] : '',
		);

		if ( isset( $settings['max_width'] ) ) {
			$args['max_width'] = $settings['max_width'];
		}
		if ( isset( $settings['field_gap']['size'] ) ) {
			$args['field_gap'] = (int) $settings['field_gap']['size'];
		}
		if ( ! empty( $settings['primary_color'] ) ) {
			$args['primary_color'] = (string) $settings['primary_color'];
		}
		if ( ! empty( $settings['text_color'] ) ) {
			$args['text_color'] = (string) $settings['text_color'];
		}
		if ( ! empty( $settings['label_color'] ) ) {
			$args['label_color'] = (string) $settings['label_color'];
		}
		if ( ! empty( $settings['input_bg'] ) ) {
			$args['input_bg'] = (string) $settings['input_bg'];
		}
		if ( ! empty( $settings['border_color'] ) ) {
			$args['border_color'] = (string) $settings['border_color'];
		}
		if ( ! empty( $settings['button_bg'] ) ) {
			$args['button_bg'] = (string) $settings['button_bg'];
		}
		if ( ! empty( $settings['button_text'] ) ) {
			$args['button_text'] = (string) $settings['button_text'];
		}
		if ( isset( $settings['radius']['size'] ) ) {
			$args['radius'] = (int) $settings['radius']['size'];
		}

		if ( $form_source === 'custom' && ! empty( $settings['form_fields'] ) && is_array( $settings['form_fields'] ) ) {
			$args['field_styles'] = Neo_Pulse_Wp_Forms_Field_Controls::extract_field_styles( $settings['form_fields'] );
		}

		return $args;
	}
}

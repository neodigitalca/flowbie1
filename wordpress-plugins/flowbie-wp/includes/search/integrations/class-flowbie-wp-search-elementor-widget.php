<?php
/**
 * Elementor Flowbie Search widget.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Group_Control_Typography;
use Elementor\Widget_Base;

class Flowbie_Wp_Search_Elementor_Widget extends Widget_Base {

	public function get_name(): string {
		return 'flowbie_search';
	}

	public function get_title(): string {
		return esc_html__( 'Flowbie Search', 'flowbie-wp' );
	}

	public function get_icon(): string {
		return 'eicon-search';
	}

	/**
	 * @return array<int,string>
	 */
	public function get_categories(): array {
		return array( 'flowbie' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_keywords(): array {
		return array( 'search', 'ai', 'flowbie', 'site search' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_style_depends(): array {
		return array( 'flowbie-search' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_script_depends(): array {
		return array( 'flowbie-search' );
	}

	protected function register_controls(): void {
		$this->register_content_controls();
		$this->register_layout_controls();
		$this->register_style_bar_controls();
		$this->register_style_dropdown_controls();
		$this->register_behavior_controls();
	}

	private function register_content_controls(): void {
		$this->start_controls_section(
			'section_content',
			array(
				'label' => esc_html__( 'Content', 'flowbie-wp' ),
			)
		);

		$this->add_control(
			'use_global_settings',
			array(
				'label'        => esc_html__( 'Use Flowbie Design / Site Branding', 'flowbie-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Yes', 'flowbie-wp' ),
				'label_off'    => esc_html__( 'No', 'flowbie-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => sprintf(
					/* translators: %s: admin settings URL */
					esc_html__( 'Uses shared Chat + Search design tokens (Site Branding from Elementor by default). Configure under %s.', 'flowbie-wp' ),
					'<a href="' . esc_url( admin_url( 'admin.php?page=flowbie-wp-search&tab=appearance' ) ) . '">' . esc_html__( 'Flowbie WP → AI Tools → Search → Appearance', 'flowbie-wp' ) . '</a>'
				),
			)
		);

		$this->add_control(
			'placeholder',
			array(
				'label'     => esc_html__( 'Placeholder', 'flowbie-wp' ),
				'type'      => Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array(
					'use_global_settings!' => 'yes',
				),
			)
		);

		$this->add_control(
			'button_label',
			array(
				'label'     => esc_html__( 'Button label', 'flowbie-wp' ),
				'type'      => Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array(
					'use_global_settings!' => 'yes',
				),
			)
		);

		$this->add_control(
			'max_results',
			array(
				'label'     => esc_html__( 'Max results', 'flowbie-wp' ),
				'type'      => Controls_Manager::NUMBER,
				'min'       => 1,
				'max'       => 20,
				'step'      => 1,
				'default'   => 8,
				'condition' => array(
					'use_global_settings!' => 'yes',
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_layout_controls(): void {
		$this->start_controls_section(
			'section_layout',
			array(
				'label' => esc_html__( 'Layout', 'flowbie-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'layout_preset',
			array(
				'label'   => esc_html__( 'Layout preset', 'flowbie-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'default',
				'options' => array(
					'default'     => esc_html__( 'Default', 'flowbie-wp' ),
					'hero'        => esc_html__( 'Hero', 'flowbie-wp' ),
					'compact'     => esc_html__( 'Compact', 'flowbie-wp' ),
					'header_slot' => esc_html__( 'Header slot', 'flowbie-wp' ),
				),
			)
		);

		$this->add_responsive_control(
			'align',
			array(
				'label'        => esc_html__( 'Alignment', 'flowbie-wp' ),
				'type'         => Controls_Manager::CHOOSE,
				'options'      => array(
					'left'   => array(
						'title' => esc_html__( 'Left', 'flowbie-wp' ),
						'icon'  => 'eicon-text-align-left',
					),
					'center' => array(
						'title' => esc_html__( 'Center', 'flowbie-wp' ),
						'icon'  => 'eicon-text-align-center',
					),
					'right'  => array(
						'title' => esc_html__( 'Right', 'flowbie-wp' ),
						'icon'  => 'eicon-text-align-right',
					),
				),
				'prefix_class' => 'elementor%s-align-',
				'default'      => 'center',
			)
		);

		$this->add_responsive_control(
			'max_width',
			array(
				'label'      => esc_html__( 'Max width', 'flowbie-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'vw' ),
				'range'      => array(
					'px' => array(
						'min' => 200,
						'max' => 1200,
					),
					'%'  => array(
						'min' => 10,
						'max' => 100,
					),
					'vw' => array(
						'min' => 10,
						'max' => 100,
					),
				),
				'default'    => array(
					'unit' => 'px',
					'size' => 520,
				),
			)
		);

		$this->add_control(
			'full_width',
			array(
				'label'        => esc_html__( 'Full width', 'flowbie-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Yes', 'flowbie-wp' ),
				'label_off'    => esc_html__( 'No', 'flowbie-wp' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();
	}

	private function register_style_bar_controls(): void {
		$this->start_controls_section(
			'section_style_bar',
			array(
				'label'     => esc_html__( 'Search bar', 'flowbie-wp' ),
				'tab'       => Controls_Manager::TAB_STYLE,
				'condition' => array(
					'use_global_settings!' => 'yes',
				),
			)
		);

		$this->add_control(
			'primary_color',
			array(
				'label' => esc_html__( 'Primary / accent', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'bg_color',
			array(
				'label' => esc_html__( 'Background color', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'text_color',
			array(
				'label' => esc_html__( 'Text color', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'text_muted_color',
			array(
				'label' => esc_html__( 'Muted text', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'border_color',
			array(
				'label' => esc_html__( 'Border color', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'hover_color',
			array(
				'label' => esc_html__( 'Result hover', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'dropdown_bg',
			array(
				'label' => esc_html__( 'Dropdown background', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'border_radius',
			array(
				'label' => esc_html__( 'Border radius (px)', 'flowbie-wp' ),
				'type'  => Controls_Manager::SLIDER,
				'range' => array(
					'px' => array(
						'min' => 0,
						'max' => 50,
					),
				),
			)
		);

		$this->add_control(
			'font_size',
			array(
				'label' => esc_html__( 'Font size (px)', 'flowbie-wp' ),
				'type'  => Controls_Manager::SLIDER,
				'range' => array(
					'px' => array(
						'min' => 16,
						'max' => 24,
					),
				),
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'input_typography',
				'label'    => esc_html__( 'Input typography', 'flowbie-wp' ),
				'selector' => '{{WRAPPER}} .fbs__input',
			)
		);

		$this->add_responsive_control(
			'input_padding',
			array(
				'label'      => esc_html__( 'Input padding', 'flowbie-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'selectors'  => array(
					'{{WRAPPER}} .fbs__input' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}} !important;',
				),
			)
		);

		$this->add_control(
			'button_icon_size',
			array(
				'label'     => esc_html__( 'Button icon size (px)', 'flowbie-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array(
					'px' => array(
						'min' => 12,
						'max' => 28,
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .fbs__btn-icon svg' => 'width: {{SIZE}}{{UNIT}} !important; height: {{SIZE}}{{UNIT}} !important;',
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_dropdown_controls(): void {
		$this->start_controls_section(
			'section_style_dropdown',
			array(
				'label'     => esc_html__( 'Dropdown', 'flowbie-wp' ),
				'tab'       => Controls_Manager::TAB_STYLE,
				'condition' => array(
					'use_global_settings!' => 'yes',
				),
			)
		);

		$this->add_control(
			'dropdown_bg',
			array(
				'label' => esc_html__( 'Background color', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'text_muted_color',
			array(
				'label' => esc_html__( 'Muted text color', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'hover_color',
			array(
				'label' => esc_html__( 'Result hover background', 'flowbie-wp' ),
				'type'  => Controls_Manager::COLOR,
			)
		);

		$this->add_control(
			'dropdown_radius',
			array(
				'label' => esc_html__( 'Border radius (px)', 'flowbie-wp' ),
				'type'  => Controls_Manager::SLIDER,
				'range' => array(
					'px' => array(
						'min' => 0,
						'max' => 50,
					),
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'dropdown_box_shadow',
				'selector' => '{{WRAPPER}} .fbs__dropdown, {{WRAPPER}} .fbs__status',
			)
		);

		$this->end_controls_section();
	}

	private function register_behavior_controls(): void {
		$this->start_controls_section(
			'section_behavior',
			array(
				'label' => esc_html__( 'Behavior & display', 'flowbie-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'show_ai_banner',
			array(
				'label'        => esc_html__( 'Show AI banner', 'flowbie-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'flowbie-wp' ),
				'label_off'    => esc_html__( 'Hide', 'flowbie-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'show_relevance_scores',
			array(
				'label'        => esc_html__( 'Show relevance scores', 'flowbie-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'flowbie-wp' ),
				'label_off'    => esc_html__( 'Hide', 'flowbie-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'show_powered_by',
			array(
				'label'        => esc_html__( 'Show "Powered by Flowbie"', 'flowbie-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'flowbie-wp' ),
				'label_off'    => esc_html__( 'Hide', 'flowbie-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'min_query',
			array(
				'label'   => esc_html__( 'Minimum characters', 'flowbie-wp' ),
				'type'    => Controls_Manager::NUMBER,
				'min'     => 1,
				'max'     => 5,
				'step'    => 1,
				'default' => 2,
			)
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from render_instance().
		echo Flowbie_Wp_Search::render_instance( self::map_settings( $settings ) );
	}

	/**
	 * @param array<string,mixed> $settings Elementor widget settings.
	 * @return array<string,mixed>
	 */
	public static function map_settings( array $settings ): array {
		$instance = array(
			'use_global_settings'   => isset( $settings['use_global_settings'] ) ? (string) $settings['use_global_settings'] : 'yes',
			'layout_preset'       => isset( $settings['layout_preset'] ) ? (string) $settings['layout_preset'] : 'default',
			'full_width'          => isset( $settings['full_width'] ) ? (string) $settings['full_width'] : '',
			'show_ai_banner'      => isset( $settings['show_ai_banner'] ) ? (string) $settings['show_ai_banner'] : 'yes',
			'show_relevance_scores' => isset( $settings['show_relevance_scores'] ) ? (string) $settings['show_relevance_scores'] : 'yes',
			'show_powered_by'     => isset( $settings['show_powered_by'] ) ? (string) $settings['show_powered_by'] : 'yes',
			'min_query'           => isset( $settings['min_query'] ) ? (int) $settings['min_query'] : 2,
		);

		if ( empty( $settings['use_global_settings'] ) || $settings['use_global_settings'] !== 'yes' ) {
			if ( ! empty( $settings['placeholder'] ) ) {
				$instance['placeholder'] = (string) $settings['placeholder'];
			}
			if ( ! empty( $settings['button_label'] ) ) {
				$instance['button_label'] = (string) $settings['button_label'];
			}
			if ( isset( $settings['max_results'] ) && $settings['max_results'] !== '' ) {
				$instance['max_results'] = (int) $settings['max_results'];
			}

			self::map_color_setting( $instance, $settings, 'primary_color' );
			self::map_color_setting( $instance, $settings, 'bg_color' );
			self::map_color_setting( $instance, $settings, 'text_color' );
			self::map_color_setting( $instance, $settings, 'text_muted_color' );
			self::map_color_setting( $instance, $settings, 'border_color' );
			self::map_color_setting( $instance, $settings, 'hover_color' );
			self::map_color_setting( $instance, $settings, 'dropdown_bg' );

			self::map_slider_setting( $instance, $settings, 'border_radius' );
			self::map_slider_setting( $instance, $settings, 'font_size' );
			self::map_slider_setting( $instance, $settings, 'dropdown_radius' );
		}

		self::map_responsive_max_width( $instance, $settings );

		return $instance;
	}

	/**
	 * @param array<string,mixed> $instance
	 * @param array<string,mixed> $settings
	 */
	private static function map_color_setting( array &$instance, array $settings, string $key ): void {
		if ( ! empty( $settings[ $key ] ) ) {
			$instance[ $key ] = (string) $settings[ $key ];
		}
	}

	/**
	 * @param array<string,mixed> $instance
	 * @param array<string,mixed> $settings
	 */
	private static function map_slider_setting( array &$instance, array $settings, string $key ): void {
		if ( isset( $settings[ $key ]['size'] ) && $settings[ $key ]['size'] !== '' ) {
			$instance[ $key ] = (int) $settings[ $key ]['size'];
		}
	}

	/**
	 * @param array<string,mixed> $instance
	 * @param array<string,mixed> $settings
	 */
	private static function map_responsive_max_width( array &$instance, array $settings ): void {
		$value = null;
		if ( isset( $settings['max_width'] ) && is_array( $settings['max_width'] ) && isset( $settings['max_width']['size'] ) && $settings['max_width']['size'] !== '' ) {
			$value = $settings['max_width'];
		} elseif ( isset( $settings['max_width_tablet'] ) && is_array( $settings['max_width_tablet'] ) && isset( $settings['max_width_tablet']['size'] ) && $settings['max_width_tablet']['size'] !== '' ) {
			$value = $settings['max_width_tablet'];
		} elseif ( isset( $settings['max_width_mobile'] ) && is_array( $settings['max_width_mobile'] ) && isset( $settings['max_width_mobile']['size'] ) && $settings['max_width_mobile']['size'] !== '' ) {
			$value = $settings['max_width_mobile'];
		}

		if ( is_array( $value ) ) {
			$unit = isset( $value['unit'] ) ? (string) $value['unit'] : 'px';
			$instance['max_width'] = (string) $value['size'] . $unit;
		}
	}
}

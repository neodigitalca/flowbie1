<?php
/**
 * Elementor NEO Pulse Search widget.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Group_Control_Typography;
use Elementor\Widget_Base;

class Neo_Pulse_Wp_Search_Elementor_Widget extends Widget_Base {

	public function get_name(): string {
		return 'neo-pulse_search';
	}

	public function get_title(): string {
		return esc_html__( 'NEO Pulse Search', 'neo-pulse-wp' );
	}

	public function get_icon(): string {
		return 'eicon-search';
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
		return array( 'search', 'ai', 'neo-pulse', 'site search' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_style_depends(): array {
		return array( 'neo-pulse-search', 'neo-pulse-ai-sidebar-shell', 'neo-pulse-ai-sidebar-unify' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_script_depends(): array {
		return array( 'neo-pulse-ai-sidebar-shell', 'neo-pulse-ai-sidebar-unify', 'neo-pulse-search', 'neo-pulse-search-elementor-preview' );
	}

	protected function register_controls(): void {
		$this->register_content_controls();
		$this->register_layout_controls();
		$this->register_sidebar_controls();
		$this->register_insights_controls();
		$this->register_style_launcher_controls();
		$this->register_style_form_controls();
		$this->register_style_button_controls();
		$this->register_style_dropdown_controls();
		$this->register_style_insights_controls();
		$this->register_style_panel_controls();
		$this->register_style_backdrop_powered_controls();
		$this->register_behavior_controls();
	}

	/**
	 * Elementor style selectors for CSS vars on the search wrap + portaled preview panel.
	 *
	 * @param string $css Custom property declarations.
	 * @return array<string,string>
	 */
	private function wrap_var_selectors( string $css ): array {
		$portal = 'body > .fai-sidebar-panel--elementor-preview[data-neo-pulse-el="{{ID}}"]';

		return array(
			'{{WRAPPER}} .neo-pulse-search-wrap'                          => $css,
			$portal                                                     => $css,
			$portal . ' .neo-pulse-search-wrap--panel-inner'              => $css,
		);
	}

	/**
	 * Elementor style selector for panel content targeted outside {{WRAPPER}} when preview is portaled.
	 *
	 * @param string $inner_selector Selector relative to wrap / portaled panel.
	 */
	private function portal_element_selector( string $inner_selector ): string {
		$portal = 'body > .fai-sidebar-panel--elementor-preview[data-neo-pulse-el="{{ID}}"]';

		return '{{WRAPPER}} ' . $inner_selector . ', ' . $portal . ' ' . $inner_selector;
	}

	private function register_content_controls(): void {
		$this->start_controls_section(
			'section_content',
			array(
				'label' => esc_html__( 'Content', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'use_global_settings',
			array(
				'label'        => esc_html__( 'Use NEO Pulse Design / Site Branding', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Yes', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'No', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => sprintf(
					/* translators: %s: admin settings URL */
					esc_html__( 'Uses shared Chat + Search design tokens (Site Branding from Elementor by default). Configure under %s.', 'neo-pulse-wp' ),
					'<a href="' . esc_url( admin_url( 'admin.php?page=neo-pulse-wp-search&tab=appearance' ) ) . '">' . esc_html__( 'NEO Pulse WP → AI Tools → Search → Appearance', 'neo-pulse-wp' ) . '</a>'
				),
			)
		);

		$this->add_control(
			'placeholder',
			array(
				'label'     => esc_html__( 'Placeholder', 'neo-pulse-wp' ),
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
				'label'     => esc_html__( 'Button label', 'neo-pulse-wp' ),
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
				'label'     => esc_html__( 'Max results', 'neo-pulse-wp' ),
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
				'label' => esc_html__( 'Layout', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'layout_preset',
			array(
				'label'   => esc_html__( 'Layout preset', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'default',
				'options' => array(
					'default'     => esc_html__( 'Default', 'neo-pulse-wp' ),
					'hero'        => esc_html__( 'Hero', 'neo-pulse-wp' ),
					'compact'     => esc_html__( 'Compact', 'neo-pulse-wp' ),
					'header_slot' => esc_html__( 'Header slot', 'neo-pulse-wp' ),
				),
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
				'default'      => 'center',
			)
		);

		$this->add_responsive_control(
			'max_width',
			array(
				'label'      => esc_html__( 'Max width', 'neo-pulse-wp' ),
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
				'label'        => esc_html__( 'Full width', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Yes', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'No', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();
	}

	private function register_sidebar_controls(): void {
		$this->start_controls_section(
			'section_sidebar',
			array(
				'label' => esc_html__( 'Sidebar', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'display_mode',
			array(
				'label'   => esc_html__( 'Display mode', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => array(
					''          => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'inline'    => esc_html__( 'Inline dropdown', 'neo-pulse-wp' ),
					'sidebar'   => esc_html__( 'Full-height sidebar', 'neo-pulse-wp' ),
					'icon_only' => esc_html__( 'Icon only', 'neo-pulse-wp' ),
				),
			)
		);

		$this->add_control(
			'preview_panel',
			array(
				'label'        => esc_html__( 'Preview panel', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Open', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Closed', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => '',
				'description'  => esc_html__( 'Open the sidebar on the canvas while this widget is selected in Elementor. Closed when editing other elements.', 'neo-pulse-wp' ),
				'condition'    => array(
					'display_mode!' => 'inline',
				),
			)
		);

		$icon_options = array( '' => esc_html__( 'Use global default', 'neo-pulse-wp' ) );
		foreach ( Neo_Pulse_Wp_Search_Icons::catalog() as $icon_id => $icon_label ) {
			$icon_options[ $icon_id ] = $icon_label;
		}

		$this->add_control(
			'launcher_icon',
			array(
				'label'     => esc_html__( 'Launcher icon', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => $icon_options,
				'condition' => array(
					'display_mode' => 'icon_only',
				),
			)
		);

		$this->add_control(
			'icon_open_as',
			array(
				'label'     => esc_html__( 'Opens as', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''              => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'sidebar_left'  => esc_html__( 'Sidebar (left)', 'neo-pulse-wp' ),
					'sidebar_right' => esc_html__( 'Sidebar (right)', 'neo-pulse-wp' ),
					'modal_center'  => esc_html__( 'Center modal', 'neo-pulse-wp' ),
					'expand_inline' => esc_html__( 'Expand inline', 'neo-pulse-wp' ),
				),
				'condition' => array(
					'display_mode' => 'icon_only',
				),
			)
		);

		$this->add_control(
			'modal_max_width',
			array(
				'label'     => esc_html__( 'Modal max width (px)', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::NUMBER,
				'min'       => 320,
				'max'       => 720,
				'step'      => 10,
				'default'   => '',
				'condition' => array(
					'display_mode'  => 'icon_only',
					'icon_open_as'  => 'modal_center',
				),
			)
		);

		$this->add_control(
			'launcher_label',
			array(
				'label'       => esc_html__( 'Launcher label (accessibility)', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => esc_html__( 'Open search', 'neo-pulse-wp' ),
				'condition'   => array(
					'display_mode' => 'icon_only',
				),
			)
		);

		$panel_condition = array(
			'display_mode' => array( 'sidebar', 'icon_only' ),
		);
		$panel_not_expand = array(
			'display_mode'  => array( 'sidebar', 'icon_only' ),
			'icon_open_as!' => 'expand_inline',
		);

		$this->add_control(
			'sidebar_side',
			array(
				'label'     => esc_html__( 'Sidebar side', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''      => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'left'  => esc_html__( 'Left', 'neo-pulse-wp' ),
					'right' => esc_html__( 'Right', 'neo-pulse-wp' ),
				),
				'condition' => array(
					'display_mode' => 'sidebar',
				),
			)
		);

		$this->add_control(
			'sidebar_transition',
			array(
				'label'     => esc_html__( 'Transition', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''      => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'slide' => esc_html__( 'Slide', 'neo-pulse-wp' ),
					'fade'  => esc_html__( 'Fade', 'neo-pulse-wp' ),
					'none'  => esc_html__( 'None', 'neo-pulse-wp' ),
				),
				'condition' => $panel_not_expand,
			)
		);

		$this->add_control(
			'sidebar_width',
			array(
				'label'     => esc_html__( 'Sidebar width (px)', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::NUMBER,
				'min'       => 280,
				'max'       => 560,
				'step'      => 10,
				'default'   => '',
				'condition' => $panel_not_expand,
			)
		);

		$this->add_control(
			'sidebar_heading',
			array(
				'label'       => esc_html__( 'Heading (H2)', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => esc_html__( 'Search this site…', 'neo-pulse-wp' ),
				'condition'   => $panel_condition,
			)
		);

		$this->add_control(
			'panel_layout',
			array(
				'label'     => esc_html__( 'Panel layout', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''          => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'compact'   => esc_html__( 'Compact', 'neo-pulse-wp' ),
					'discovery' => esc_html__( 'Discovery', 'neo-pulse-wp' ),
				),
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_subtitle',
			array(
				'label'       => esc_html__( 'Subtitle', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXTAREA,
				'default'     => '',
				'rows'        => 3,
				'condition'   => $panel_condition,
			)
		);

		$this->add_control(
			'panel_offset_top',
			array(
				'label'      => esc_html__( 'Content offset from top', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'vh', '%' ),
				'range'      => array(
					'px' => array( 'min' => 0, 'max' => 400 ),
					'vh' => array( 'min' => 0, 'max' => 80 ),
					'%'  => array( 'min' => 0, 'max' => 80 ),
				),
				'default'    => array(
					'size' => 64,
					'unit' => 'px',
				),
				'condition'  => $panel_condition,
			)
		);

		$this->add_control(
			'panel_content_align',
			array(
				'label'     => esc_html__( 'Panel content alignment', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''       => esc_html__( 'Use global default', 'neo-pulse-wp' ),
					'left'   => esc_html__( 'Left', 'neo-pulse-wp' ),
					'center' => esc_html__( 'Center', 'neo-pulse-wp' ),
				),
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_layout_heading',
			array(
				'label'     => esc_html__( 'Show heading section', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_layout_search',
			array(
				'label'     => esc_html__( 'Show search bar', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_layout_popular_terms',
			array(
				'label'     => esc_html__( 'Show popular searches', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_layout_popular_pages_overseer',
			array(
				'label'     => esc_html__( 'Show general pages', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => $panel_condition,
			)
		);

		$this->add_control(
			'sidebar_layout_popular_topics',
			array(
				'label'     => esc_html__( 'Show popular topics grid', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => array(
					'display_mode'  => array( 'sidebar', 'icon_only' ),
					'panel_layout!' => 'compact',
				),
			)
		);

		$this->add_control(
			'sidebar_layout_popular_pages_search',
			array(
				'label'     => esc_html__( 'Show pages from search', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => $panel_condition,
			)
		);

		$this->end_controls_section();
	}

	private function register_insights_controls(): void {
		$this->start_controls_section(
			'section_insights',
			array(
				'label' => esc_html__( 'Insights', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'show_popular_terms',
			array(
				'label'        => esc_html__( 'Popular searches', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'show_popular_pages_overseer',
			array(
				'label'        => esc_html__( 'General pages (Overseer)', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'show_popular_pages_search',
			array(
				'label'        => esc_html__( 'Pages from search clicks', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();
	}

	private function register_style_launcher_controls(): void {
		$this->start_controls_section(
			'section_style_launcher',
			array(
				'label' => esc_html__( 'Icon launcher', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_launcher_bg',
			array(
				'label'     => esc_html__( 'Background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_launcher_color',
			array(
				'label'     => esc_html__( 'Icon color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-color: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_launcher_hover_bg',
			array(
				'label'     => esc_html__( 'Hover background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-hover-bg: {{VALUE}};' ),
			)
		);

		$this->add_responsive_control(
			'style_launcher_size',
			array(
				'label'      => esc_html__( 'Size', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px' ),
				'range'      => array( 'px' => array( 'min' => 32, 'max' => 72 ) ),
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-size: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_control(
			'style_launcher_radius',
			array(
				'label'     => esc_html__( 'Border radius', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 0, 'max' => 50 ) ),
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-radius: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_control(
			'style_launcher_border',
			array(
				'label'     => esc_html__( 'Border color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-launcher-border: {{VALUE}};' ),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'style_launcher_shadow',
				'selector' => '{{WRAPPER}} .fbs__icon-launcher, {{WRAPPER}} .fai-sidebar-launcher',
			)
		);

		$this->end_controls_section();
	}

	private function register_style_form_controls(): void {
		$this->start_controls_section(
			'section_style_form',
			array(
				'label' => esc_html__( 'Search form', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_input_bg',
			array(
				'label'     => esc_html__( 'Input background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-input-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_input_text',
			array(
				'label'     => esc_html__( 'Input text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-input-text: {{VALUE}}; --fbs-text: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_placeholder',
			array(
				'label'     => esc_html__( 'Placeholder', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-placeholder: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_form_border',
			array(
				'label'     => esc_html__( 'Form border', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-form-border: {{VALUE}}; --fbs-border: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_border_radius',
			array(
				'label'     => esc_html__( 'Border radius', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 0, 'max' => 50 ) ),
				'selectors' => $this->wrap_var_selectors( '--fbs-radius: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'style_input_typography',
				'label'    => esc_html__( 'Input typography', 'neo-pulse-wp' ),
				'selector' => $this->portal_element_selector( '.fbs__input' ),
			)
		);

		$this->add_responsive_control(
			'style_input_padding',
			array(
				'label'      => esc_html__( 'Input padding', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'selectors'  => array(
					$this->portal_element_selector( '.fbs__input' ) => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}} !important;',
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
			'style_button_bg',
			array(
				'label'     => esc_html__( 'Background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-button-bg: {{VALUE}}; --fbs-primary: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_button_text',
			array(
				'label'     => esc_html__( 'Text color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-button-text: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_button_icon',
			array(
				'label'     => esc_html__( 'Icon color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-icon: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_button_hover',
			array(
				'label'     => esc_html__( 'Hover background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-button-hover: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_button_icon_size',
			array(
				'label'     => esc_html__( 'Icon size', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 12, 'max' => 28 ) ),
				'selectors' => array(
					$this->portal_element_selector( '.fbs__btn-icon svg' ) => 'width: {{SIZE}}{{UNIT}} !important; height: {{SIZE}}{{UNIT}} !important;',
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_dropdown_controls(): void {
		$this->start_controls_section(
			'section_style_dropdown',
			array(
				'label' => esc_html__( 'Dropdown and results', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_dropdown_bg',
			array(
				'label'     => esc_html__( 'Dropdown background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-dropdown-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_result_muted',
			array(
				'label'     => esc_html__( 'Muted text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-text-muted: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_result_hover',
			array(
				'label'     => esc_html__( 'Result hover', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-hover: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_result_link',
			array(
				'label'     => esc_html__( 'Link color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-link: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_result_score',
			array(
				'label'     => esc_html__( 'Score color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-score: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_dropdown_radius',
			array(
				'label'     => esc_html__( 'Border radius', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 0, 'max' => 50 ) ),
				'selectors' => $this->wrap_var_selectors( '--fbs-dropdown-radius: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'style_dropdown_shadow',
				'selector' => $this->portal_element_selector( '.fbs__dropdown' ) . ', ' . $this->portal_element_selector( '.fbs__status' ),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_insights_controls(): void {
		$this->start_controls_section(
			'section_style_insights',
			array(
				'label' => esc_html__( 'Insights', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_insight_heading',
			array(
				'label'     => esc_html__( 'Section heading', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-text-muted: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_insight_chip_bg',
			array(
				'label'     => esc_html__( 'Chip background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-insight-chip-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_insight_chip_hover',
			array(
				'label'     => esc_html__( 'Chip hover', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-insight-chip-hover: {{VALUE}};' ),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_panel_controls(): void {
		$this->start_controls_section(
			'section_style_panel',
			array(
				'label' => esc_html__( 'Panel (sidebar / modal)', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_panel_bg',
			array(
				'label'     => esc_html__( 'Background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-panel-bg: {{VALUE}}; --fai-sidebar-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_panel_text',
			array(
				'label'     => esc_html__( 'Text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-panel-text: {{VALUE}}; --fai-sidebar-text: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_panel_muted',
			array(
				'label'     => esc_html__( 'Muted text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-panel-text-muted: {{VALUE}}; --fai-sidebar-text-muted: {{VALUE}};' ),
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'     => 'style_panel_heading_typography',
				'label'    => esc_html__( 'Heading typography', 'neo-pulse-wp' ),
				'selector' => $this->portal_element_selector( '.fai-sidebar-heading' ),
			)
		);

		$this->add_control(
			'style_panel_width',
			array(
				'label'     => esc_html__( 'Sidebar width (px)', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 280, 'max' => 560 ) ),
				'selectors' => $this->wrap_var_selectors( '--fai-sidebar-width: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_control(
			'style_modal_width',
			array(
				'label'     => esc_html__( 'Modal max width (px)', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 320, 'max' => 720 ) ),
				'selectors' => $this->wrap_var_selectors( '--fbs-modal-max-width: {{SIZE}}{{UNIT}};' ),
			)
		);

		$this->add_responsive_control(
			'style_panel_offset_top',
			array(
				'label'      => esc_html__( 'Content offset from top', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'vh', '%' ),
				'range'      => array(
					'px' => array( 'min' => 0, 'max' => 400 ),
					'vh' => array( 'min' => 0, 'max' => 80 ),
					'%'  => array( 'min' => 0, 'max' => 80 ),
				),
				'default'    => array(
					'size' => 64,
					'unit' => 'px',
				),
				'selectors'  => array_merge(
					$this->wrap_var_selectors( '--fbs-panel-offset-top: {{SIZE}}{{UNIT}};' ),
					array(
						'{{WRAPPER}} .fai-sidebar-panel__body' => 'padding-top: {{SIZE}}{{UNIT}} !important;',
						'body > .fai-sidebar-panel--elementor-preview[data-neo-pulse-el="{{ID}}"] .fai-sidebar-panel__body' => 'padding-top: {{SIZE}}{{UNIT}} !important;',
					)
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_backdrop_powered_controls(): void {
		$this->start_controls_section(
			'section_style_backdrop',
			array(
				'label' => esc_html__( 'Backdrop and powered', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'style_backdrop_color',
			array(
				'label'     => esc_html__( 'Backdrop color', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-backdrop-color: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_backdrop_opacity',
			array(
				'label'      => esc_html__( 'Backdrop opacity (%)', 'neo-pulse-wp' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( '%' ),
				'range'      => array(
					'%' => array(
						'min' => 0,
						'max' => 100,
					),
				),
				'default'    => array(
					'size' => 35,
					'unit' => '%',
				),
				'selectors'  => $this->wrap_var_selectors( '--fbs-backdrop-opacity: {{SIZE}}%;' ),
			)
		);

		$this->add_control(
			'style_powered_text',
			array(
				'label'     => esc_html__( 'Powered text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-powered: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_powered_icon',
			array(
				'label'     => esc_html__( 'Powered icon', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-powered-icon: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_banner_bg',
			array(
				'label'     => esc_html__( 'AI banner background', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-banner-bg: {{VALUE}};' ),
			)
		);

		$this->add_control(
			'style_banner_text',
			array(
				'label'     => esc_html__( 'AI banner text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => $this->wrap_var_selectors( '--fbs-banner-text: {{VALUE}};' ),
			)
		);

		$this->end_controls_section();
	}

	private function register_behavior_controls(): void {
		$this->start_controls_section(
			'section_behavior',
			array(
				'label' => esc_html__( 'Behavior & display', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'show_ai_banner',
			array(
				'label'        => esc_html__( 'Show AI banner', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'show_relevance_scores',
			array(
				'label'        => esc_html__( 'Show relevance scores', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'show_powered_by',
			array(
				'label'        => esc_html__( 'Show "Powered by NEO Pulse"', 'neo-pulse-wp' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => esc_html__( 'Show', 'neo-pulse-wp' ),
				'label_off'    => esc_html__( 'Hide', 'neo-pulse-wp' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();
		$instance = self::map_settings( $settings );
		if ( self::is_elementor_editor_context() ) {
			$instance['elementor_edit_context'] = true;
		}
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from render_instance().
		echo Neo_Pulse_Wp_Search::render_instance( $instance );
	}

	public static function is_elementor_editor_context(): bool {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}
		$plugin = \Elementor\Plugin::$instance;
		if ( isset( $plugin->editor ) && $plugin->editor->is_edit_mode() ) {
			return true;
		}
		if ( isset( $plugin->preview ) && $plugin->preview->is_preview_mode() ) {
			return true;
		}
		return false;
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

		if ( isset( $settings['display_mode'] ) && $settings['display_mode'] !== '' ) {
			$instance['display_mode'] = (string) $settings['display_mode'];
		}
		if ( ! empty( $settings['launcher_icon'] ) ) {
			$instance['launcher_icon'] = Neo_Pulse_Wp_Search_Icons::sanitize_id( (string) $settings['launcher_icon'] );
		}
		if ( ! empty( $settings['icon_open_as'] ) ) {
			$instance['icon_open_as'] = (string) $settings['icon_open_as'];
		}
		if ( isset( $settings['modal_max_width'] ) && $settings['modal_max_width'] !== '' ) {
			$instance['modal_max_width'] = (int) $settings['modal_max_width'];
		}
		if ( array_key_exists( 'launcher_label', $settings ) ) {
			$instance['launcher_label'] = (string) $settings['launcher_label'];
		}
		if ( ! empty( $settings['panel_layout'] ) ) {
			$instance['panel_layout'] = (string) $settings['panel_layout'];
		}
		if ( array_key_exists( 'sidebar_subtitle', $settings ) ) {
			$instance['sidebar_subtitle'] = (string) $settings['sidebar_subtitle'];
		}
		if ( isset( $settings['panel_offset_top'] ) && is_array( $settings['panel_offset_top'] ) ) {
			if ( isset( $settings['panel_offset_top']['size'] ) && $settings['panel_offset_top']['size'] !== '' ) {
				$instance['panel_offset_top'] = (int) $settings['panel_offset_top']['size'];
			}
			if ( ! empty( $settings['panel_offset_top']['unit'] ) ) {
				$instance['panel_offset_top_unit'] = (string) $settings['panel_offset_top']['unit'];
			}
		}
		if ( ! empty( $settings['panel_content_align'] ) ) {
			$instance['panel_content_align'] = (string) $settings['panel_content_align'];
		}
		if ( isset( $settings['style_backdrop_opacity'] ) && is_array( $settings['style_backdrop_opacity'] ) && isset( $settings['style_backdrop_opacity']['size'] ) && $settings['style_backdrop_opacity']['size'] !== '' ) {
			$instance['backdrop_opacity'] = (int) $settings['style_backdrop_opacity']['size'];
		}
		if ( ! empty( $settings['sidebar_side'] ) ) {
			$instance['sidebar_side'] = (string) $settings['sidebar_side'];
		}
		if ( ! empty( $settings['sidebar_transition'] ) ) {
			$instance['sidebar_transition'] = (string) $settings['sidebar_transition'];
		}
		if ( isset( $settings['sidebar_width'] ) && $settings['sidebar_width'] !== '' ) {
			$instance['sidebar_width'] = (int) $settings['sidebar_width'];
		}
		if ( array_key_exists( 'sidebar_heading', $settings ) ) {
			$instance['sidebar_heading'] = (string) $settings['sidebar_heading'];
		}
		foreach ( array(
			'show_popular_terms',
			'show_popular_pages_overseer',
			'show_popular_pages_search',
		) as $insight_key ) {
			if ( array_key_exists( $insight_key, $settings ) && $settings[ $insight_key ] !== '' ) {
				$instance[ $insight_key ] = ! empty( $settings[ $insight_key ] ) ? 'yes' : 'no';
			}
		}

		$uses_panel_layout = isset( $settings['display_mode'] )
			&& in_array( (string) $settings['display_mode'], array( 'sidebar', 'icon_only' ), true );

		if ( $uses_panel_layout ) {
			$layout = array();
			if ( ! empty( $settings['sidebar_layout_heading'] ) ) {
				$layout[] = 'heading';
			}
			if ( ! isset( $settings['sidebar_layout_search'] ) || ! empty( $settings['sidebar_layout_search'] ) ) {
				$layout[] = 'search';
			}
			$layout[] = 'results';
			if ( ! empty( $settings['sidebar_layout_popular_terms'] ) ) {
				$layout[] = 'popular_terms';
			}
			if ( ! empty( $settings['sidebar_layout_popular_topics'] ) ) {
				$layout[] = 'popular_topics';
			}
			$instance['sidebar_layout'] = $layout;
		}

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

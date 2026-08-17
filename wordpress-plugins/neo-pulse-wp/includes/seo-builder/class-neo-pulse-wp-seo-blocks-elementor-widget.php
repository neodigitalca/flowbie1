<?php
/**
 * Elementor NEO Pulse SEO Section widget.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Elementor\Widget_Base;

class Neo_Pulse_Wp_Seo_Blocks_Elementor_Widget extends Widget_Base {

	public function get_name(): string {
		return 'neo-pulse_seo_section';
	}

	public function get_title(): string {
		return esc_html__( 'NEO Pulse SEO Section', 'neo-pulse-wp' );
	}

	public function get_icon(): string {
		return 'eicon-text-area';
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
		return array( 'seo', 'content', 'section', 'neo-pulse', 'h2', 'cta' );
	}

	/**
	 * @return array<int,string>
	 */
	public function get_style_depends(): array {
		return array( 'neo-pulse-seo-block' );
	}

	protected function register_controls(): void {
		$this->register_hub_controls();
		$this->register_slot_controls();
		$this->register_intent_controls();
	}

	private function register_hub_controls(): void {
		$this->start_controls_section(
			'section_registry',
			array(
				'label' => esc_html__( 'Agent Hub', 'neo-pulse-wp' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'block_id',
			array(
				'label'   => esc_html__( 'Block registry ID', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->add_control(
			'registry_block_id',
			array(
				'label'       => esc_html__( 'Block from table (ID + H2)', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => Neo_Pulse_Wp_Seo_Blocks_Storage::get_registry_choices(),
				'label_block' => true,
				'description' => esc_html__( 'Pick a row from Agent Hub. All fields below sync from the table.', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'linked_block_summary',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => '<div class="neo-pulse-seo-block-linked-summary">' . esc_html__( 'Select a block to load table data here.', 'neo-pulse-wp' ) . '</div>',
				'content_classes' => 'neo-pulse-seo-block-linked-summary-wrap',
			)
		);

		$this->add_control(
			'hub_link',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => '<p class="neo-pulse-seo-block-hub-link"><a href="' . esc_url( admin_url( 'admin.php?page=neo-pulse-wp-agent-hub' ) ) . '" target="_blank" rel="noopener">' . esc_html__( 'Open Agent Hub table', 'neo-pulse-wp' ) . '</a></p>',
				'content_classes' => 'neo-pulse-seo-block-hub-link',
			)
		);

		$this->end_controls_section();
	}

	private function register_intent_controls(): void {
		$this->start_controls_section(
			'section_seo_intent',
			array(
				'label' => esc_html__( 'SEO Intent', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'focus_keyword',
			array(
				'label'       => esc_html__( 'Focus keyword', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'label_block' => true,
			)
		);

		$this->add_control(
			'topic_focus',
			array(
				'label'       => esc_html__( 'Topic focus', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXTAREA,
				'default'     => '',
				'rows'        => 4,
				'description' => esc_html__( 'Describe the intent, keyword angle, and SERP goal for this block. Used by NEO Pulse AI wands.', 'neo-pulse-wp' ),
			)
		);

		$this->end_controls_section();
	}

	private function register_slot_controls(): void {
		$this->start_controls_section(
			'section_content_slots',
			array(
				'label' => esc_html__( 'Content slots', 'neo-pulse-wp' ),
			)
		);

		$repeater = new Repeater();

		$repeater->add_control(
			'type',
			array(
				'label'   => esc_html__( 'Slot type', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'h2',
				'options' => array(
					'h2'        => esc_html__( 'Heading (H2)', 'neo-pulse-wp' ),
					'paragraph' => esc_html__( 'Paragraph', 'neo-pulse-wp' ),
					'cta'       => esc_html__( 'CTA button', 'neo-pulse-wp' ),
					'image'     => esc_html__( 'Image', 'neo-pulse-wp' ),
					'list'      => esc_html__( 'List', 'neo-pulse-wp' ),
				),
			)
		);

		$repeater->add_control(
			'align_h',
			array(
				'label'   => esc_html__( 'Alignment', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'left',
				'options' => array(
					'left'   => esc_html__( 'Left', 'neo-pulse-wp' ),
					'center' => esc_html__( 'Middle', 'neo-pulse-wp' ),
					'right'  => esc_html__( 'Right', 'neo-pulse-wp' ),
				),
			)
		);

		$repeater->add_control(
			'heading_level',
			array(
				'label'     => esc_html__( 'Heading level', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '2',
				'options'   => array(
					'1' => 'H1',
					'2' => 'H2',
					'3' => 'H3',
					'4' => 'H4',
					'5' => 'H5',
					'6' => 'H6',
				),
				'condition' => array( 'type' => 'h2' ),
			)
		);

		$repeater->add_control(
			'text',
			array(
				'label'     => esc_html__( 'Heading text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array( 'type' => 'h2' ),
			)
		);

		$repeater->add_control(
			'html',
			array(
				'label'     => esc_html__( 'Paragraph HTML', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::WYSIWYG,
				'default'   => '',
				'condition' => array( 'type' => 'paragraph' ),
			)
		);

		$repeater->add_control(
			'label',
			array(
				'label'     => esc_html__( 'Button label', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array( 'type' => 'cta' ),
			)
		);

		$repeater->add_control(
			'url',
			array(
				'label'     => esc_html__( 'Button URL', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::URL,
				'default'   => array( 'url' => '' ),
				'condition' => array( 'type' => 'cta' ),
			)
		);

		$repeater->add_control(
			'style',
			array(
				'label'     => esc_html__( 'CTA style', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'primary',
				'options'   => array(
					'primary'   => esc_html__( 'Primary', 'neo-pulse-wp' ),
					'secondary' => esc_html__( 'Secondary', 'neo-pulse-wp' ),
					'outline'   => esc_html__( 'Outline', 'neo-pulse-wp' ),
				),
				'condition' => array( 'type' => 'cta' ),
			)
		);

		$repeater->add_control(
			'attachment_id',
			array(
				'label'     => esc_html__( 'Image', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::MEDIA,
				'default'   => array(),
				'condition' => array( 'type' => 'image' ),
			)
		);

		$repeater->add_control(
			'alt',
			array(
				'label'     => esc_html__( 'Alt text', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array( 'type' => 'image' ),
			)
		);

		$repeater->add_control(
			'list_style',
			array(
				'label'     => esc_html__( 'List style', 'neo-pulse-wp' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'bullet',
				'options'   => array(
					'bullet' => esc_html__( 'Bulleted', 'neo-pulse-wp' ),
					'number' => esc_html__( 'Numbered', 'neo-pulse-wp' ),
				),
				'condition' => array( 'type' => 'list' ),
			)
		);

		$repeater->add_control(
			'items',
			array(
				'label'       => esc_html__( 'List items (one per line)', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::TEXTAREA,
				'default'     => '',
				'rows'        => 4,
				'condition'   => array( 'type' => 'list' ),
				'description' => esc_html__( 'Enter each list item on its own line.', 'neo-pulse-wp' ),
			)
		);

		$this->add_control(
			'content_slots',
			array(
				'label'       => esc_html__( 'Slots', 'neo-pulse-wp' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(),
				'title_field' => '{{{ type }}} — {{{ text || label || "slot" }}}',
			)
		);

		$this->add_control(
			'layout_config_json',
			array(
				'label'   => esc_html__( 'Layout config', 'neo-pulse-wp' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = self::resolve_block_settings( $this->get_settings_for_display() );
		$slots    = self::settings_to_slots( $settings );
		$layout   = self::settings_to_layout( $settings, $slots );
		$block_id = (string) ( $settings['registry_block_id'] ?? $settings['block_id'] ?? '' );
		echo '<div class="neo-pulse-seo-block" data-block-id="' . esc_attr( $block_id ) . '">';
		echo Neo_Pulse_Wp_Seo_Blocks_Slots::render_html( $slots, $layout ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '</div>';
	}

	/**
	 * Load slots from Agent Hub registry when a block is selected.
	 *
	 * @param array<string,mixed> $settings
	 * @return array<string,mixed>
	 */
	public static function resolve_block_settings( array $settings ): array {
		$registry_id = absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 );
		if ( $registry_id < 1 ) {
			return $settings;
		}

		$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $registry_id );
		if ( ! is_array( $row ) ) {
			return $settings;
		}

		$settings['registry_block_id'] = (string) $registry_id;
		$settings['block_id']          = (string) $registry_id;
		$settings['focus_keyword']     = (string) ( $row['focus_keyword'] ?? '' );
		$settings['topic_focus']       = (string) ( $row['topic_focus'] ?? '' );
		$settings['content_slots']      = self::slots_to_repeater_settings( $row['slots'] ?? array() );
		$settings['layout_config']      = is_array( $row['layout_config'] ?? null ) ? $row['layout_config'] : array();
		$settings['layout_config_json'] = wp_json_encode( $settings['layout_config'] );

		return $settings;
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<string,mixed>|null
	 */
	public static function settings_to_layout( array $settings, ?array $slots = null ): ?array {
		$layout = array();
		if ( ! empty( $settings['layout_config'] ) && is_array( $settings['layout_config'] ) ) {
			$layout = $settings['layout_config'];
		} else {
			$json    = (string) ( $settings['layout_config_json'] ?? '' );
			$decoded = $json !== '' ? json_decode( $json, true ) : null;
			if ( is_array( $decoded ) ) {
				$layout = $decoded;
			}
		}

		$registry_id = absint( $settings['registry_block_id'] ?? $settings['block_id'] ?? 0 );
		if ( empty( $layout['sections'] ) && $registry_id > 0 ) {
			$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $registry_id );
			if ( is_array( $row ) && ! empty( $row['layout_config'] ) && is_array( $row['layout_config'] ) ) {
				$layout = $row['layout_config'];
			}
		}

		if ( empty( $layout['sections'] ) ) {
			return null;
		}

		if ( null === $slots ) {
			$slots = self::settings_to_slots( $settings );
		}

		return Neo_Pulse_Wp_Seo_Blocks_Layout::normalize_config( $layout, $slots );
	}

	/**
	 * @param array<string,mixed> $layout
	 * @return string
	 */
	public static function layout_to_json( array $layout ): string {
		$encoded = wp_json_encode( $layout );
		return is_string( $encoded ) ? $encoded : '{}';
	}

	/**
	 * @param array<string,mixed> $settings
	 * @return array<int,array<string,mixed>>
	 */
	public static function settings_to_slots( array $settings ): array {
		return Neo_Pulse_Wp_Seo_Blocks_Slots::from_elementor_settings( $settings );
	}

	/**
	 * @param array<int,array<string,mixed>> $slots
	 * @return array<int,array<string,mixed>>
	 */
	public static function slots_to_repeater_settings( array $slots ): array {
		$out = array();
		foreach ( Neo_Pulse_Wp_Seo_Blocks_Slots::add_elementor_ids( $slots ) as $slot ) {
			$row = array(
				'type'    => (string) ( $slot['type'] ?? '' ),
				'_id'     => (string) ( $slot['_id'] ?? '' ),
				'align_h' => (string) ( $slot['align_h'] ?? 'left' ),
				'align_v' => 'middle',
			);
			switch ( $row['type'] ) {
				case 'h2':
					$row['text']          = (string) ( $slot['text'] ?? '' );
					$row['heading_level'] = (string) absint( $slot['heading_level'] ?? 2 );
					break;
				case 'paragraph':
					$row['html'] = (string) ( $slot['html'] ?? '' );
					break;
				case 'cta':
					$row['label']  = (string) ( $slot['label'] ?? '' );
					$row['url']    = array( 'url' => (string) ( $slot['url'] ?? '' ) );
					$row['style']  = (string) ( $slot['style'] ?? 'primary' );
					break;
				case 'image':
					$id = absint( $slot['attachment_id'] ?? 0 );
					$row['attachment_id'] = $id > 0 ? array( 'id' => $id, 'url' => (string) wp_get_attachment_url( $id ) ) : array();
					$row['alt']           = (string) ( $slot['alt'] ?? '' );
					break;
				case 'list':
					$row['list_style'] = (string) ( $slot['style'] ?? 'bullet' );
					$row['html']       = (string) ( $slot['html'] ?? '' );
					$row['items']      = implode( "\n", $slot['items'] ?? array() );
					break;
			}
			$out[] = $row;
		}
		return $out;
	}
}

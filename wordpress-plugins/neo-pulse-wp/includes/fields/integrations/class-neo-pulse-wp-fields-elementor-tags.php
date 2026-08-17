<?php
/**
 * Elementor dynamic tag base + tag implementations.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Fields_Elementor_Tag_Resolver_Trait {

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_binding(): ?array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		$resolved = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_from_tag_settings( $this->get_settings() );
		if ( $resolved !== null ) {
			return $resolved;
		}
		$key = (string) $this->get_settings( 'field_name' );
		if ( $key === '' ) {
			return null;
		}
		$parsed = Neo_Pulse_Wp_Fields_Elementor_Registry::parse_field_key( $key );
		if ( ! empty( $parsed['options_slug'] ) ) {
			return array(
				'field_name'   => (string) $parsed['field_name'],
				'options_slug' => (string) $parsed['options_slug'],
			);
		}
		return array(
			'field_name'   => (string) $parsed['field_name'],
			'options_slug' => null,
			'post_type'    => (string) ( $parsed['post_type'] ?? '' ),
		);
	}

	protected function resolve_field_name(): string {
		$binding = $this->resolve_binding();
		return $binding !== null ? (string) ( $binding['field_name'] ?? '' ) : '';
	}

	protected function get_field_value( bool $format = true ) {
		$binding = $this->resolve_binding();
		if ( $binding === null || (string) ( $binding['field_name'] ?? '' ) === '' ) {
			return null;
		}
		if ( ! empty( $binding['options_slug'] ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
			return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $binding, $format );
		}
		$name   = (string) $binding['field_name'];
		$source = $this->resolve_source_id();
		if ( function_exists( 'get_field' ) && Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return get_field( $name, $source, $format );
		}
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Api', false ) && ! Neo_Pulse_Wp_Fields::acf_is_active() ) {
			return Neo_Pulse_Wp_Fields_Api::get_field( $name, $source, $format );
		}
		$field = $this->get_field_config();
		if ( ! $field ) {
			return null;
		}
		$post_id = (int) $source;
		return $post_id > 0 ? Neo_Pulse_Wp_Fields_Values::get_value( $post_id, $field, $format ) : null;
	}

	protected function resolve_source_id() {
		$binding = $this->resolve_binding();
		if ( is_array( $binding ) && ! empty( $binding['options_slug'] ) ) {
			return (string) $binding['options_slug'];
		}
		if ( $this->source_context === 'options' ) {
			$key = (string) $this->get_settings( 'field_name' );
			$parsed = Neo_Pulse_Wp_Fields_Elementor_Registry::parse_field_key( $key );
			if ( ! empty( $parsed['options_slug'] ) ) {
				return (string) $parsed['options_slug'];
			}
			return 'options';
		}
		$custom = (int) $this->get_settings( 'custom_post_id' );
		if ( $custom > 0 ) {
			return $custom;
		}
		$post_id = Neo_Pulse_Wp_Fields_Elementor_Registry::resolve_editor_post_id();
		return $post_id > 0 ? $post_id : get_queried_object_id();
	}
}

abstract class Neo_Pulse_Wp_Fields_Elementor_Tag_Base extends \Elementor\Core\DynamicTags\Tag {

	use Neo_Pulse_Wp_Fields_Elementor_Tag_Resolver_Trait;

	/** @var string post|options */
	protected $source_context = 'post';

	public function get_group(): array {
		return array( 'neo-pulse' );
	}

	/**
	 * @param array<int, string>|null $types
	 */
	protected function add_field_control( ?array $types = null ): void {
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false )
			&& Neo_Pulse_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'neo-pulse-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post (for post fields).', 'neo-pulse-wp' ),
				)
			);
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_unified_field_choices( $types );
		} elseif ( $this->source_context === 'options' ) {
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_field_choices( 'options', '', $types );
		} else {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'neo-pulse-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post.', 'neo-pulse-wp' ),
				)
			);
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_field_choices( 'post', '', $types );
		}

		$this->add_control(
			'field_name',
			array(
				'label'   => esc_html__( 'Field', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'options' => $choices ?: array( '' => esc_html__( 'No fields found', 'neo-pulse-wp' ) ),
			)
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	protected function get_field_config(): ?array {
		$name = $this->resolve_field_name();
		if ( $name === '' ) {
			return null;
		}
		$binding = $this->resolve_binding();
		if ( ! empty( $binding['options_slug'] ) ) {
			return Neo_Pulse_Wp_Fields_Values::find_field( $name );
		}
		$post_id = (int) $this->resolve_source_id();
		return Neo_Pulse_Wp_Fields_Values::find_field( $name, $post_id > 0 ? $post_id : null );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Text extends Neo_Pulse_Wp_Fields_Elementor_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'neo-pulse-options-field' : 'neo-pulse-field';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'NEO Pulse Options Field', 'neo-pulse-wp' )
			: esc_html__( 'NEO Pulse Field', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::TEXT_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_field_control(
			array(
				'text', 'textarea', 'wysiwyg', 'number', 'email', 'url', 'password', 'range',
				'select', 'radio', 'checkbox', 'true_false', 'color_picker',
				'date_picker', 'date_time_picker', 'time_picker', 'oembed',
				'post_object', 'page_link', 'relationship', 'taxonomy', 'user', 'link',
				'google_map', 'image', 'file', 'gallery',
			)
		);
	}

	public function render(): void {
		$value = $this->get_field_value( true );
		$field = $this->get_field_config();
		if ( ! is_array( $field ) ) {
			$name = $this->resolve_field_name();
			if ( $name === '' || ! self::value_present( $value ) ) {
				return;
			}
			echo wp_kses_post( Neo_Pulse_Wp_Fields_Elementor_Registry::format_text_value( $value, array( 'name' => $name, 'type' => 'text' ) ) );
			return;
		}
		$text = Neo_Pulse_Wp_Fields_Elementor_Registry::format_text_value( $value, $field );
		$text = apply_filters( 'neo_pulse_wp_fields_elementor_text_value', $text, $field, $this->resolve_source_id(), $value );
		if ( $text !== '' ) {
			echo wp_kses_post( $text );
		}
	}

	/**
	 * @param mixed $value Value to test.
	 */
	private static function value_present( $value ): bool {
		if ( null === $value || false === $value ) {
			return false;
		}
		if ( is_string( $value ) && $value === '' ) {
			return false;
		}
		if ( is_array( $value ) && empty( $value ) ) {
			return false;
		}
		return true;
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Options_Text extends Neo_Pulse_Wp_Fields_Elementor_Tag_Text {
	protected $source_context = 'options';
}

abstract class Neo_Pulse_Wp_Fields_Elementor_Data_Tag_Base extends \Elementor\Core\DynamicTags\Data_Tag {

	use Neo_Pulse_Wp_Fields_Elementor_Tag_Resolver_Trait;

	/** @var string post|options */
	protected $source_context = 'post';

	public function get_group(): array {
		return array( 'neo-pulse' );
	}

	/**
	 * @param array<int, string>|null $types
	 */
	protected function add_field_control( ?array $types = null ): void {
		if ( class_exists( 'Neo_Pulse_Wp_Fields_Elementor_Settings', false )
			&& Neo_Pulse_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'neo-pulse-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post (for post fields).', 'neo-pulse-wp' ),
				)
			);
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_unified_field_choices( $types );
		} elseif ( $this->source_context === 'options' ) {
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_field_choices( 'options', '', $types );
		} else {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'neo-pulse-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post.', 'neo-pulse-wp' ),
				)
			);
			$choices = Neo_Pulse_Wp_Fields_Elementor_Registry::get_field_choices( 'post', '', $types );
		}

		$this->add_control(
			'field_name',
			array(
				'label'   => esc_html__( 'Field', 'neo-pulse-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'options' => $choices ?: array( '' => esc_html__( 'No fields found', 'neo-pulse-wp' ) ),
			)
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	protected function get_field_config(): ?array {
		$name = $this->resolve_field_name();
		if ( $name === '' ) {
			return null;
		}
		$binding = $this->resolve_binding();
		if ( ! empty( $binding['options_slug'] ) ) {
			return Neo_Pulse_Wp_Fields_Values::find_field( $name );
		}
		$post_id = (int) $this->resolve_source_id();
		return Neo_Pulse_Wp_Fields_Values::find_field( $name, $post_id > 0 ? $post_id : null );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Image extends Neo_Pulse_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'neo-pulse-options-image' : 'neo-pulse-image';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'NEO Pulse Options Image', 'neo-pulse-wp' )
			: esc_html__( 'NEO Pulse Image', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::IMAGE_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_field_control( array( 'image' ) );
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_image_value( $value );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Options_Image extends Neo_Pulse_Wp_Fields_Elementor_Tag_Image {
	protected $source_context = 'options';
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Url extends Neo_Pulse_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'neo-pulse-options-url' : 'neo-pulse-url';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'NEO Pulse Options URL', 'neo-pulse-wp' )
			: esc_html__( 'NEO Pulse URL', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::URL_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_field_control( array( 'url', 'link', 'file', 'page_link', 'email', 'post_object' ) );
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		$field = $this->get_field_config();
		if ( ! is_array( $field ) ) {
			$name = $this->resolve_field_name();
			return is_string( $value ) ? $value : '';
		}
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_url_value( $value, $field );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Options_Url extends Neo_Pulse_Wp_Fields_Elementor_Tag_Url {
	protected $source_context = 'options';
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Gallery extends Neo_Pulse_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'neo-pulse-options-gallery' : 'neo-pulse-gallery';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'NEO Pulse Options Gallery', 'neo-pulse-wp' )
			: esc_html__( 'NEO Pulse Gallery', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::GALLERY_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_field_control( array( 'gallery' ) );
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_gallery_value( $value );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Tag_Options_Gallery extends Neo_Pulse_Wp_Fields_Elementor_Tag_Gallery {
	protected $source_context = 'options';
}

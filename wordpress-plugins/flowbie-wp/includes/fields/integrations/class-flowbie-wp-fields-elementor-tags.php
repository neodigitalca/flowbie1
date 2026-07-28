<?php
/**
 * Elementor dynamic tag base + tag implementations.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Fields_Elementor_Tag_Resolver_Trait {

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_binding(): ?array {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		$resolved = Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_from_tag_settings( $this->get_settings() );
		if ( $resolved !== null ) {
			return $resolved;
		}
		$key = (string) $this->get_settings( 'field_name' );
		if ( $key === '' ) {
			return null;
		}
		$parsed = Flowbie_Wp_Fields_Elementor_Registry::parse_field_key( $key );
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
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
			return Flowbie_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $binding, $format );
		}
		$name   = (string) $binding['field_name'];
		$source = $this->resolve_source_id();
		if ( function_exists( 'get_field' ) && Flowbie_Wp_Fields::acf_is_active() ) {
			return get_field( $name, $source, $format );
		}
		if ( class_exists( 'Flowbie_Wp_Fields_Api', false ) && ! Flowbie_Wp_Fields::acf_is_active() ) {
			return Flowbie_Wp_Fields_Api::get_field( $name, $source, $format );
		}
		$field = $this->get_field_config();
		if ( ! $field ) {
			return null;
		}
		$post_id = (int) $source;
		return $post_id > 0 ? Flowbie_Wp_Fields_Values::get_value( $post_id, $field, $format ) : null;
	}

	protected function resolve_source_id() {
		$binding = $this->resolve_binding();
		if ( is_array( $binding ) && ! empty( $binding['options_slug'] ) ) {
			return (string) $binding['options_slug'];
		}
		if ( $this->source_context === 'options' ) {
			$key = (string) $this->get_settings( 'field_name' );
			$parsed = Flowbie_Wp_Fields_Elementor_Registry::parse_field_key( $key );
			if ( ! empty( $parsed['options_slug'] ) ) {
				return (string) $parsed['options_slug'];
			}
			return 'options';
		}
		$custom = (int) $this->get_settings( 'custom_post_id' );
		if ( $custom > 0 ) {
			return $custom;
		}
		$post_id = Flowbie_Wp_Fields_Elementor_Registry::resolve_editor_post_id();
		return $post_id > 0 ? $post_id : get_queried_object_id();
	}
}

abstract class Flowbie_Wp_Fields_Elementor_Tag_Base extends \Elementor\Core\DynamicTags\Tag {

	use Flowbie_Wp_Fields_Elementor_Tag_Resolver_Trait;

	/** @var string post|options */
	protected $source_context = 'post';

	public function get_group(): array {
		return array( 'flowbie' );
	}

	/**
	 * @param array<int, string>|null $types
	 */
	protected function add_field_control( ?array $types = null ): void {
		if ( class_exists( 'Flowbie_Wp_Fields_Elementor_Settings', false )
			&& Flowbie_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'flowbie-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post (for post fields).', 'flowbie-wp' ),
				)
			);
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_unified_field_choices( $types );
		} elseif ( $this->source_context === 'options' ) {
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_field_choices( 'options', '', $types );
		} else {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'flowbie-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post.', 'flowbie-wp' ),
				)
			);
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_field_choices( 'post', '', $types );
		}

		$this->add_control(
			'field_name',
			array(
				'label'   => esc_html__( 'Field', 'flowbie-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'options' => $choices ?: array( '' => esc_html__( 'No fields found', 'flowbie-wp' ) ),
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
			return Flowbie_Wp_Fields_Values::find_field( $name );
		}
		$post_id = (int) $this->resolve_source_id();
		return Flowbie_Wp_Fields_Values::find_field( $name, $post_id > 0 ? $post_id : null );
	}
}

class Flowbie_Wp_Fields_Elementor_Tag_Text extends Flowbie_Wp_Fields_Elementor_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'flowbie-options-field' : 'flowbie-field';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'Flowbie Options Field', 'flowbie-wp' )
			: esc_html__( 'Flowbie Field', 'flowbie-wp' );
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
			echo wp_kses_post( Flowbie_Wp_Fields_Elementor_Registry::format_text_value( $value, array( 'name' => $name, 'type' => 'text' ) ) );
			return;
		}
		$text = Flowbie_Wp_Fields_Elementor_Registry::format_text_value( $value, $field );
		$text = apply_filters( 'flowbie_wp_fields_elementor_text_value', $text, $field, $this->resolve_source_id(), $value );
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

class Flowbie_Wp_Fields_Elementor_Tag_Options_Text extends Flowbie_Wp_Fields_Elementor_Tag_Text {
	protected $source_context = 'options';
}

abstract class Flowbie_Wp_Fields_Elementor_Data_Tag_Base extends \Elementor\Core\DynamicTags\Data_Tag {

	use Flowbie_Wp_Fields_Elementor_Tag_Resolver_Trait;

	/** @var string post|options */
	protected $source_context = 'post';

	public function get_group(): array {
		return array( 'flowbie' );
	}

	/**
	 * @param array<int, string>|null $types
	 */
	protected function add_field_control( ?array $types = null ): void {
		if ( class_exists( 'Flowbie_Wp_Fields_Elementor_Settings', false )
			&& Flowbie_Wp_Fields_Elementor_Settings::use_unified_field_picker() ) {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'flowbie-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post (for post fields).', 'flowbie-wp' ),
				)
			);
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_unified_field_choices( $types );
		} elseif ( $this->source_context === 'options' ) {
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_field_choices( 'options', '', $types );
		} else {
			$this->add_control(
				'custom_post_id',
				array(
					'label'       => esc_html__( 'Custom Post ID', 'flowbie-wp' ),
					'type'        => \Elementor\Controls_Manager::NUMBER,
					'description' => esc_html__( 'Leave empty to use the current post.', 'flowbie-wp' ),
				)
			);
			$choices = Flowbie_Wp_Fields_Elementor_Registry::get_field_choices( 'post', '', $types );
		}

		$this->add_control(
			'field_name',
			array(
				'label'   => esc_html__( 'Field', 'flowbie-wp' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'options' => $choices ?: array( '' => esc_html__( 'No fields found', 'flowbie-wp' ) ),
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
			return Flowbie_Wp_Fields_Values::find_field( $name );
		}
		$post_id = (int) $this->resolve_source_id();
		return Flowbie_Wp_Fields_Values::find_field( $name, $post_id > 0 ? $post_id : null );
	}
}

class Flowbie_Wp_Fields_Elementor_Tag_Image extends Flowbie_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'flowbie-options-image' : 'flowbie-image';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'Flowbie Options Image', 'flowbie-wp' )
			: esc_html__( 'Flowbie Image', 'flowbie-wp' );
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
		return Flowbie_Wp_Fields_Elementor_Registry::format_image_value( $value );
	}
}

class Flowbie_Wp_Fields_Elementor_Tag_Options_Image extends Flowbie_Wp_Fields_Elementor_Tag_Image {
	protected $source_context = 'options';
}

class Flowbie_Wp_Fields_Elementor_Tag_Url extends Flowbie_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'flowbie-options-url' : 'flowbie-url';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'Flowbie Options URL', 'flowbie-wp' )
			: esc_html__( 'Flowbie URL', 'flowbie-wp' );
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
		return Flowbie_Wp_Fields_Elementor_Registry::format_url_value( $value, $field );
	}
}

class Flowbie_Wp_Fields_Elementor_Tag_Options_Url extends Flowbie_Wp_Fields_Elementor_Tag_Url {
	protected $source_context = 'options';
}

class Flowbie_Wp_Fields_Elementor_Tag_Gallery extends Flowbie_Wp_Fields_Elementor_Data_Tag_Base {

	public function get_name(): string {
		return $this->source_context === 'options' ? 'flowbie-options-gallery' : 'flowbie-gallery';
	}

	public function get_title(): string {
		return $this->source_context === 'options'
			? esc_html__( 'Flowbie Options Gallery', 'flowbie-wp' )
			: esc_html__( 'Flowbie Gallery', 'flowbie-wp' );
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
		return Flowbie_Wp_Fields_Elementor_Registry::format_gallery_value( $value );
	}
}

class Flowbie_Wp_Fields_Elementor_Tag_Options_Gallery extends Flowbie_Wp_Fields_Elementor_Tag_Gallery {
	protected $source_context = 'options';
}

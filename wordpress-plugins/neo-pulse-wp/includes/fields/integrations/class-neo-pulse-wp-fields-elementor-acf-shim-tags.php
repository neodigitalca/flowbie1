<?php
/**
 * Elementor ACF shim tag classes (loaded when Elementor is available).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

abstract class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Base extends \Elementor\Core\DynamicTags\Tag {

	public function get_group(): array {
		return array( 'acf' );
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_field(): ?array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		$settings = $this->get_settings();
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_from_settings(
			is_array( $settings ) ? $settings : array()
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	protected function get_field_config(): ?array {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::get_field_config( $resolved );
	}

	/**
	 * @return mixed
	 */
	protected function get_field_value( bool $format = true ) {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $resolved, $format );
	}
}

abstract class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Data_Base extends \Elementor\Core\DynamicTags\Data_Tag {

	public function get_group(): array {
		return array( 'acf' );
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_field(): ?array {
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		$settings = $this->get_settings();
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::resolve_from_settings(
			is_array( $settings ) ? $settings : array()
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	protected function get_field_config(): ?array {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::get_field_config( $resolved );
	}

	/**
	 * @return mixed
	 */
	protected function get_field_value( bool $format = true ) {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
		return Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $resolved, $format );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Text extends Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Base {

	/** @var string */
	private $tag_name = 'acf-text';

	public function __construct( string $tag_name = 'acf-text' ) {
		$this->tag_name = sanitize_key( $tag_name ) ?: 'acf-text';
	}

	public function get_name(): string {
		return $this->tag_name;
	}

	public function get_title(): string {
		return esc_html__( 'ACF Field', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::TEXT_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function render(): void {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return;
		}
		$field = $this->get_field_config();
		if ( ! is_array( $field ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
			$field = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::stub_field( (string) $resolved['field_name'] );
		}
		$value = $this->get_field_value( true );
		$text  = Neo_Pulse_Wp_Fields_Elementor_Registry::format_text_value( $value, $field );
		if ( $text !== '' ) {
			echo wp_kses_post( $text );
		}
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Url extends Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	/** @var string */
	private $tag_name = 'acf-url';

	public function __construct( string $tag_name = 'acf-url' ) {
		$this->tag_name = sanitize_key( $tag_name ) ?: 'acf-url';
	}

	public function get_name(): string {
		return $this->tag_name;
	}

	public function get_title(): string {
		return esc_html__( 'ACF URL', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::URL_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return '';
		}
		$field = $this->get_field_config();
		if ( ! is_array( $field ) ) {
			require_once NEO_PULSE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-neo-pulse-wp-fields-elementor-acf-resolver.php';
			$field = Neo_Pulse_Wp_Fields_Elementor_Acf_Resolver::stub_field( (string) $resolved['field_name'] );
		}
		$value = $this->get_field_value( true );
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_url_value( $value, $field );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Image extends Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	public function get_name(): string {
		return 'acf-image';
	}

	public function get_title(): string {
		return esc_html__( 'ACF Image', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::IMAGE_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_image_value( $value );
	}
}

class Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Gallery extends Neo_Pulse_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	public function get_name(): string {
		return 'acf-gallery';
	}

	public function get_title(): string {
		return esc_html__( 'ACF Gallery', 'neo-pulse-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::GALLERY_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'neo-pulse-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Neo_Pulse_Wp_Fields_Elementor_Registry::format_gallery_value( $value );
	}
}

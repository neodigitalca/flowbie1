<?php
/**
 * Legacy Elementor ACF dynamic tag shims (when ACF Pro is inactive).
 *
 * Keeps existing acf-text / acf-url tags in Elementor JSON working by resolving
 * values from Flowbie Fields instead of ACF.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

abstract class Flowbie_Wp_Fields_Elementor_Acf_Shim_Base extends \Elementor\Core\DynamicTags\Tag {

	public function get_group(): array {
		return array( 'acf' );
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_field(): ?array {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		$settings = $this->get_settings();
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_from_settings(
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
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::get_field_config( $resolved );
	}

	/**
	 * @return mixed
	 */
	protected function get_field_value( bool $format = true ) {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $resolved, $format );
	}
}

abstract class Flowbie_Wp_Fields_Elementor_Acf_Shim_Data_Base extends \Elementor\Core\DynamicTags\Data_Tag {

	public function get_group(): array {
		return array( 'acf' );
	}

	/**
	 * @return array{field_name: string, options_slug: string|null}|null
	 */
	protected function resolve_field(): ?array {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		$settings = $this->get_settings();
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::resolve_from_settings(
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
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::get_field_config( $resolved );
	}

	/**
	 * @return mixed
	 */
	protected function get_field_value( bool $format = true ) {
		$resolved = $this->resolve_field();
		if ( ! $resolved ) {
			return null;
		}
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
		return Flowbie_Wp_Fields_Elementor_Acf_Resolver::get_field_value( $resolved, $format );
	}
}

class Flowbie_Wp_Fields_Elementor_Acf_Shim_Text extends Flowbie_Wp_Fields_Elementor_Acf_Shim_Base {

	/** @var string */
	private $tag_name = 'acf-text';

	public function __construct( string $tag_name = 'acf-text' ) {
		$this->tag_name = sanitize_key( $tag_name ) ?: 'acf-text';
	}

	public function get_name(): string {
		return $this->tag_name;
	}

	public function get_title(): string {
		return esc_html__( 'ACF Field', 'flowbie-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::TEXT_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'flowbie-wp' ),
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
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
			$field = Flowbie_Wp_Fields_Elementor_Acf_Resolver::stub_field( (string) $resolved['field_name'] );
		}
		$value = $this->get_field_value( true );
		$text  = Flowbie_Wp_Fields_Elementor_Registry::format_text_value( $value, $field );
		if ( $text !== '' ) {
			echo wp_kses_post( $text );
		}
	}
}

class Flowbie_Wp_Fields_Elementor_Acf_Shim_Url extends Flowbie_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	/** @var string */
	private $tag_name = 'acf-url';

	public function __construct( string $tag_name = 'acf-url' ) {
		$this->tag_name = sanitize_key( $tag_name ) ?: 'acf-url';
	}

	public function get_name(): string {
		return $this->tag_name;
	}

	public function get_title(): string {
		return esc_html__( 'ACF URL', 'flowbie-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::URL_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'flowbie-wp' ),
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
			require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-acf-resolver.php';
			$field = Flowbie_Wp_Fields_Elementor_Acf_Resolver::stub_field( (string) $resolved['field_name'] );
		}
		$value = $this->get_field_value( true );
		return Flowbie_Wp_Fields_Elementor_Registry::format_url_value( $value, $field );
	}
}

class Flowbie_Wp_Fields_Elementor_Acf_Shim_Image extends Flowbie_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	public function get_name(): string {
		return 'acf-image';
	}

	public function get_title(): string {
		return esc_html__( 'ACF Image', 'flowbie-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::IMAGE_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'flowbie-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Flowbie_Wp_Fields_Elementor_Registry::format_image_value( $value );
	}
}

class Flowbie_Wp_Fields_Elementor_Acf_Shim_Gallery extends Flowbie_Wp_Fields_Elementor_Acf_Shim_Data_Base {

	public function get_name(): string {
		return 'acf-gallery';
	}

	public function get_title(): string {
		return esc_html__( 'ACF Gallery', 'flowbie-wp' );
	}

	public function get_categories(): array {
		return array( \Elementor\Modules\DynamicTags\Module::GALLERY_CATEGORY );
	}

	protected function register_controls(): void {
		$this->add_control(
			'key',
			array(
				'label' => esc_html__( 'Key', 'flowbie-wp' ),
				'type'  => \Elementor\Controls_Manager::HIDDEN,
			)
		);
	}

	public function get_value( array $options = array() ) {
		unset( $options );
		$value = $this->get_field_value( true );
		return Flowbie_Wp_Fields_Elementor_Registry::format_gallery_value( $value );
	}
}

class Flowbie_Wp_Fields_Elementor_Acf_Shim {

	/** @var bool */
	private static $booted = false;

	public static function init(): void {
		if ( Flowbie_Wp_Fields::acf_is_active() ) {
			return;
		}
		add_action( 'elementor/loaded', array( __CLASS__, 'boot' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'boot' ), 120 );
	}

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		if ( ! class_exists( '\Elementor\Plugin', false ) ) {
			return;
		}
		if ( ! class_exists( '\Elementor\Modules\DynamicTags\Module', false ) ) {
			return;
		}
		add_action( 'elementor/dynamic_tags/register', array( __CLASS__, 'register_tags' ), 5 );
		self::$booted = true;
	}

	public static function register_tags( $dynamic_tags_manager ): void {
		if ( Flowbie_Wp_Fields::acf_is_active() ) {
			return;
		}

		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/fields/integrations/class-flowbie-wp-fields-elementor-registry.php';

		$dynamic_tags_manager->register_group(
			'acf',
			array(
				'title' => esc_html__( 'ACF', 'flowbie-wp' ),
			)
		);

		$tags = array(
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text(),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-number' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-color' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-date-time' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text( 'acf-field' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Text( 'post-custom-field' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Url(),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Url( 'acf-file' ),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Image(),
			new Flowbie_Wp_Fields_Elementor_Acf_Shim_Gallery(),
		);

		foreach ( $tags as $tag ) {
			$dynamic_tags_manager->register( $tag );
		}
	}
}

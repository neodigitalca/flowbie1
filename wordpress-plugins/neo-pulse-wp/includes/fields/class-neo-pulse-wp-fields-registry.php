<?php
/**
 * Field type registry.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Fields_Registry {

	/** @var array<string, Neo_Pulse_Wp_Field_Type_Interface> */
	private static $types = array();

	public static function init(): void {
		if ( ! empty( self::$types ) ) {
			return;
		}
		$classes = array(
			'Neo_Pulse_Wp_Field_Type_Text',
			'Neo_Pulse_Wp_Field_Type_Textarea',
			'Neo_Pulse_Wp_Field_Type_Number',
			'Neo_Pulse_Wp_Field_Type_Email',
			'Neo_Pulse_Wp_Field_Type_Url',
			'Neo_Pulse_Wp_Field_Type_Password',
			'Neo_Pulse_Wp_Field_Type_Range',
			'Neo_Pulse_Wp_Field_Type_Wysiwyg',
			'Neo_Pulse_Wp_Field_Type_Image',
			'Neo_Pulse_Wp_Field_Type_File',
			'Neo_Pulse_Wp_Field_Type_Select',
			'Neo_Pulse_Wp_Field_Type_Checkbox',
			'Neo_Pulse_Wp_Field_Type_Radio',
			'Neo_Pulse_Wp_Field_Type_True_False',
			'Neo_Pulse_Wp_Field_Type_Link',
			'Neo_Pulse_Wp_Field_Type_Post_Object',
			'Neo_Pulse_Wp_Field_Type_Page_Link',
			'Neo_Pulse_Wp_Field_Type_Relationship',
			'Neo_Pulse_Wp_Field_Type_Taxonomy',
			'Neo_Pulse_Wp_Field_Type_User',
			'Neo_Pulse_Wp_Field_Type_Google_Map',
			'Neo_Pulse_Wp_Field_Type_Date_Picker',
			'Neo_Pulse_Wp_Field_Type_Date_Time_Picker',
			'Neo_Pulse_Wp_Field_Type_Time_Picker',
			'Neo_Pulse_Wp_Field_Type_Color_Picker',
			'Neo_Pulse_Wp_Field_Type_Oembed',
			'Neo_Pulse_Wp_Field_Type_Message',
			'Neo_Pulse_Wp_Field_Type_Accordion',
			'Neo_Pulse_Wp_Field_Type_Tab',
			'Neo_Pulse_Wp_Field_Type_Group',
			'Neo_Pulse_Wp_Field_Type_Repeater',
			'Neo_Pulse_Wp_Field_Type_Flexible_Content',
			'Neo_Pulse_Wp_Field_Type_Gallery',
			'Neo_Pulse_Wp_Field_Type_Clone',
		);

		foreach ( $classes as $class ) {
			if ( ! class_exists( $class ) ) {
				continue;
			}
			$instance = new $class();
			if ( $instance instanceof Neo_Pulse_Wp_Field_Type_Interface ) {
				self::$types[ $instance->type() ] = $instance;
			}
		}

		self::$types = apply_filters( 'neo_pulse_wp_fields_register_types', self::$types );
	}

	public static function get( string $type ): ?Neo_Pulse_Wp_Field_Type_Interface {
		self::init();
		return self::$types[ $type ] ?? null;
	}

	/**
	 * @return array<string, Neo_Pulse_Wp_Field_Type_Interface>
	 */
	public static function all(): array {
		self::init();
		return self::$types;
	}

	/**
	 * @return array<string, string> type => label
	 */
	public static function choices(): array {
		$out = array();
		foreach ( self::all() as $type => $handler ) {
			$out[ $type ] = $handler->label();
		}
		asort( $out );
		return $out;
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function render_input( array $field, $value, int $post_id ): void {
		$type = (string) ( $field['type'] ?? 'text' );
		$handler = self::get( $type );
		if ( $handler ) {
			$handler->render_input( $field, $value, $post_id );
			return;
		}
		echo '<p class="description">' . esc_html__( 'Unsupported field type.', 'neo-pulse-wp' ) . '</p>';
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function load_value( $value, array $field, int $post_id ) {
		$handler = self::get( (string) ( $field['type'] ?? '' ) );
		return $handler ? $handler->load_value( $value, $field, $post_id ) : $value;
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function update_value( $value, array $field, int $post_id ) {
		$handler = self::get( (string) ( $field['type'] ?? '' ) );
		return $handler ? $handler->update_value( $value, $field, $post_id ) : $value;
	}

	/**
	 * @param array<string, mixed> $field Field config.
	 */
	public static function format_value( $value, array $field, int $post_id ) {
		$handler = self::get( (string) ( $field['type'] ?? '' ) );
		return $handler ? $handler->format_value( $value, $field, $post_id ) : $value;
	}
}

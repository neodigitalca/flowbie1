<?php
/**
 * Field type registry.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Fields_Registry {

	/** @var array<string, Flowbie_Wp_Field_Type_Interface> */
	private static $types = array();

	public static function init(): void {
		if ( ! empty( self::$types ) ) {
			return;
		}
		$classes = array(
			'Flowbie_Wp_Field_Type_Text',
			'Flowbie_Wp_Field_Type_Textarea',
			'Flowbie_Wp_Field_Type_Number',
			'Flowbie_Wp_Field_Type_Email',
			'Flowbie_Wp_Field_Type_Url',
			'Flowbie_Wp_Field_Type_Password',
			'Flowbie_Wp_Field_Type_Range',
			'Flowbie_Wp_Field_Type_Wysiwyg',
			'Flowbie_Wp_Field_Type_Image',
			'Flowbie_Wp_Field_Type_File',
			'Flowbie_Wp_Field_Type_Select',
			'Flowbie_Wp_Field_Type_Checkbox',
			'Flowbie_Wp_Field_Type_Radio',
			'Flowbie_Wp_Field_Type_True_False',
			'Flowbie_Wp_Field_Type_Link',
			'Flowbie_Wp_Field_Type_Post_Object',
			'Flowbie_Wp_Field_Type_Page_Link',
			'Flowbie_Wp_Field_Type_Relationship',
			'Flowbie_Wp_Field_Type_Taxonomy',
			'Flowbie_Wp_Field_Type_User',
			'Flowbie_Wp_Field_Type_Google_Map',
			'Flowbie_Wp_Field_Type_Date_Picker',
			'Flowbie_Wp_Field_Type_Date_Time_Picker',
			'Flowbie_Wp_Field_Type_Time_Picker',
			'Flowbie_Wp_Field_Type_Color_Picker',
			'Flowbie_Wp_Field_Type_Oembed',
			'Flowbie_Wp_Field_Type_Message',
			'Flowbie_Wp_Field_Type_Accordion',
			'Flowbie_Wp_Field_Type_Tab',
			'Flowbie_Wp_Field_Type_Group',
			'Flowbie_Wp_Field_Type_Repeater',
			'Flowbie_Wp_Field_Type_Flexible_Content',
			'Flowbie_Wp_Field_Type_Gallery',
			'Flowbie_Wp_Field_Type_Clone',
		);

		foreach ( $classes as $class ) {
			if ( ! class_exists( $class ) ) {
				continue;
			}
			$instance = new $class();
			if ( $instance instanceof Flowbie_Wp_Field_Type_Interface ) {
				self::$types[ $instance->type() ] = $instance;
			}
		}

		self::$types = apply_filters( 'flowbie_wp_fields_register_types', self::$types );
	}

	public static function get( string $type ): ?Flowbie_Wp_Field_Type_Interface {
		self::init();
		return self::$types[ $type ] ?? null;
	}

	/**
	 * @return array<string, Flowbie_Wp_Field_Type_Interface>
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
		echo '<p class="description">' . esc_html__( 'Unsupported field type.', 'flowbie-wp' ) . '</p>';
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

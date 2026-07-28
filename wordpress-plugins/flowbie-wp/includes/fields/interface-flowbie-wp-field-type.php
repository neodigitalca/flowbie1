<?php
/**
 * Field type contract.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

interface Flowbie_Wp_Field_Type_Interface {

	public function type(): string;

	public function label(): string;

	/**
	 * @return array<string, mixed>
	 */
	public function defaults(): array;

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Current value.
	 */
	public function render_input( array $field, $value, int $post_id ): void;

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Raw meta value.
	 * @return mixed
	 */
	public function load_value( $value, array $field, int $post_id );

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Submitted value.
	 * @return mixed Sanitized value for storage.
	 */
	public function update_value( $value, array $field, int $post_id );

	/**
	 * @param array<string, mixed> $field Field config.
	 * @param mixed                $value Loaded value.
	 * @return mixed
	 */
	public function format_value( $value, array $field, int $post_id );
}

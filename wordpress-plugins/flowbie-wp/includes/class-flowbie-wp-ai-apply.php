<?php
/**
 * Apply AI wand previews to WordPress fields.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Ai_Apply {

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	public static function apply( int $post_id, string $field, string $value ) {
		if ( ! Flowbie_Wp_Ai_Fields::is_allowed( $field ) ) {
			return new WP_Error( 'flowbie_field', __( 'Invalid field.', 'flowbie-wp' ) );
		}
		if ( ! Flowbie_Wp_Ai_Gate::can_apply( $post_id ) ) {
			$status = Flowbie_Wp_Ai_Gate::get_status( $post_id );
			$msg    = ! empty( $status['reasons'][0] ) ? (string) $status['reasons'][0] : __( 'Apply is not allowed.', 'flowbie-wp' );
			return new WP_Error( 'flowbie_ai_apply', $msg );
		}

		$value = trim( $value );
		if ( $value === '' ) {
			return new WP_Error( 'flowbie_empty', __( 'Value is empty.', 'flowbie-wp' ) );
		}

		if ( $field === 'title' ) {
			$value = Flowbie_Wp_Ai_Seo_Limits::normalize_title( $value );
		} elseif ( $field === 'excerpt' ) {
			$focus = Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id );
			$value = Flowbie_Wp_Ai_Seo_Limits::normalize_description( $value, $focus );
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'flowbie_post', __( 'Post not found.', 'flowbie-wp' ) );
		}

		$applied = self::write_field( $post_id, $field, $value );
		if ( is_wp_error( $applied ) ) {
			return $applied;
		}

		self::stamp_date_modifier( $post_id );

		$client = Flowbie_Wp_Ai_Gate::get_client();
		$usage  = is_array( $client ) ? Flowbie_Wp_Site_Progress::optimization_usage_for_client( $client ) : null;

		return array(
			'ok'           => true,
			'applied'      => $applied,
			'field'        => $field,
			'values'       => Flowbie_Wp_Ai_Context::meta_hub_values( $post_id ),
			'optimization' => is_array( $usage )
				? array(
					'used'      => (int) $usage['used'],
					'cap'       => (int) $usage['cap'],
					'remaining' => (int) $usage['remaining'],
				)
				: null,
		);
	}

	/**
	 * Save meta hub fields without counting as an optimization.
	 *
	 * @param array<string,string> $fields
	 * @return array<string,mixed>|WP_Error
	 */
	public static function save_meta( int $post_id, array $fields ) {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return new WP_Error( 'flowbie_post', __( 'Post not found.', 'flowbie-wp' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error( 'flowbie_forbidden', __( 'You do not have permission to edit this post.', 'flowbie-wp' ) );
		}

		$map = array(
			'seoTitle'        => 'title',
			'metaDescription' => 'excerpt',
			'focusKeyword'    => 'focus_keyword',
			'seoResearch'     => 'seo_research',
			'faq'             => 'faq',
			'pageUrl'         => 'page_url',
		);

		$saved = array();
		foreach ( $map as $key => $field ) {
			if ( ! array_key_exists( $key, $fields ) ) {
				continue;
			}
			$value = trim( (string) $fields[ $key ] );
			if ( $value === '' ) {
				continue;
			}
			if ( $field === 'title' ) {
				$value = Flowbie_Wp_Ai_Seo_Limits::normalize_title( $value );
			} elseif ( $field === 'excerpt' ) {
				$focus = Flowbie_Wp_Ai_Context::read_focus_keyword( $post_id );
				$value = Flowbie_Wp_Ai_Seo_Limits::normalize_description( $value, $focus );
			}
			if ( ! Flowbie_Wp_Ai_Fields::is_allowed( $field ) ) {
				continue;
			}
			$written = self::write_field( $post_id, $field, $value );
			if ( is_wp_error( $written ) ) {
				return $written;
			}
			$saved = array_merge( $saved, $written );
		}

		if ( $saved === array() ) {
			return new WP_Error( 'flowbie_empty', __( 'Nothing to save.', 'flowbie-wp' ) );
		}

		return array(
			'ok'     => true,
			'saved'  => array_values( array_unique( $saved ) ),
			'values' => Flowbie_Wp_Ai_Context::meta_hub_values( $post_id ),
		);
	}

	/**
	 * @return array<int,string>|WP_Error
	 */
	public static function write_field( int $post_id, string $field, string $value ) {
		switch ( $field ) {
			case 'title':
				self::write_title( $post_id, $value );
				return array( 'title' );
			case 'excerpt':
				self::write_excerpt( $post_id, $value );
				return array( 'excerpt' );
			case 'focus_keyword':
				self::write_focus_keyword( $post_id, $value );
				return array( 'focus_keyword' );
			case 'seo_research':
				self::write_acf_or_meta( $post_id, 'seo_research', $value );
				return array( 'seo_research' );
			case 'faq':
				$key = Flowbie_Wp_Ai_Context::resolve_write_key( $post_id, array( 'faq', 'seo_faq' ) );
				self::write_acf_or_meta( $post_id, $key, $value );
				return array( 'faq' );
			case 'page_url':
				self::write_acf_or_meta( $post_id, 'page_url', $value );
				return array( 'page_url' );
			default:
				return new WP_Error( 'flowbie_field', __( 'Invalid field.', 'flowbie-wp' ) );
		}
	}

	public static function write_title( int $post_id, string $value ): void {
		wp_update_post(
			array(
				'ID'         => $post_id,
				'post_title' => $value,
			)
		);
		update_post_meta( $post_id, 'rank_math_title', $value );
	}

	public static function write_excerpt( int $post_id, string $value ): void {
		wp_update_post(
			array(
				'ID'           => $post_id,
				'post_excerpt' => $value,
			)
		);
		update_post_meta( $post_id, 'rank_math_description', $value );
	}

	public static function write_focus_keyword( int $post_id, string $value ): void {
		update_post_meta( $post_id, 'rank_math_focus_keyword', $value );
		self::write_acf_or_meta( $post_id, 'keyword_focus', $value );
	}

	public static function write_acf_or_meta( int $post_id, string $key, string $value ): void {
		if ( function_exists( 'update_field' ) ) {
			update_field( $key, $value, $post_id );
		}
		update_post_meta( $post_id, $key, $value );
	}

	public static function stamp_date_modifier( int $post_id ): void {
		$today = gmdate( 'Y-m-d' );
		if ( function_exists( 'update_field' ) ) {
			update_field( 'date_modifier', $today, $post_id );
		}
		update_post_meta( $post_id, 'date_modifier', $today );
	}
}

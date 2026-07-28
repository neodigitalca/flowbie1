<?php
/**
 * Image SEO AI and filename-based optimization.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Image_Seo_Ai {

	/**
	 * @param array<string,bool>   $fields
	 * @param array<string,mixed>  $config
	 * @return array<string,string>|WP_Error
	 */
	public static function preview_ai( int $attachment_id, int $post_id, array $fields, array $config ) {
		if ( ! Flowbie_Wp_Image_Seo_Gate::can_ai( $post_id ) ) {
			return new WP_Error( 'flowbie_ai', __( 'OpenRouter is not configured.', 'flowbie-wp' ) );
		}

		$meta     = Flowbie_Wp_Image_Seo::read_meta( $attachment_id );
		$filename = Flowbie_Wp_Image_Seo::filename_from_attachment( $attachment_id );
		$context  = self::build_post_context( $post_id, $config );

		$enabled = self::enabled_field_keys( $fields );
		if ( empty( $enabled ) ) {
			return array();
		}

		$system = 'You are an expert WordPress image SEO specialist. Generate optimized attachment metadata from the image filename and any context provided. Return ONLY valid JSON with keys: title, alt, caption, description. Use empty string for fields you should not fill. Alt text must be concise (max 125 characters), descriptive, and keyword-natural. Title should be human-readable. Caption and description are optional supporting text — keep them shorter than body copy. Do not invent brand names or locations not suggested by the filename or context.';

		$user = "Filename: {$filename}\n";
		if ( $meta['title'] !== '' || $meta['alt'] !== '' || $meta['caption'] !== '' || $meta['description'] !== '' ) {
			$user .= "Existing metadata:\n";
			$user .= '- title: ' . $meta['title'] . "\n";
			$user .= '- alt: ' . $meta['alt'] . "\n";
			$user .= '- caption: ' . $meta['caption'] . "\n";
			$user .= '- description: ' . wp_strip_all_tags( $meta['description'] ) . "\n";
		}
		if ( $context !== '' ) {
			$user .= "Page context:\n{$context}\n";
		}
		$user .= 'Generate values for: ' . implode( ', ', $enabled ) . '.';

		$raw = Flowbie_Wp_OpenRouter::complete( $system, $user, 1024, 0.4 );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		return self::parse_ai_json( (string) $raw, $enabled );
	}

	/**
	 * @param array<string,bool> $fields
	 * @return array<string,string>
	 */
	public static function preview_filename( int $attachment_id, array $fields ): array {
		$filename = Flowbie_Wp_Image_Seo::filename_from_attachment( $attachment_id );
		$human    = self::humanize_filename( $filename );
		$out      = array();
		foreach ( Flowbie_Wp_Image_Seo::FIELD_KEYS as $key ) {
			if ( empty( $fields[ $key ] ) ) {
				continue;
			}
			if ( $key === 'alt' || $key === 'title' ) {
				$out[ $key ] = $human;
			} elseif ( $key === 'caption' ) {
				$out[ $key ] = $human;
			} else {
				$out[ $key ] = '';
			}
		}
		return $out;
	}

	/**
	 * @param array<string,bool>|null $fields
	 * @param array<string,mixed>|null $config
	 * @return array{proposed:array<string,string>,merged:array<string,string>,existing:array<string,string>}|WP_Error
	 */
	public static function preview( int $attachment_id, int $post_id = 0, bool $use_ai = true, ?array $fields = null, ?string $overwrite_mode = null, ?array $config = null ) {
		$config = $config ?? Flowbie_Wp_Image_Seo::get_config();
		$fields = $fields ?? ( is_array( $config['fields'] ?? null ) ? $config['fields'] : Flowbie_Wp_Image_Seo::default_config()['fields'] );
		$overwrite_mode = $overwrite_mode ?? (string) ( $config['overwrite_mode'] ?? 'missing_only' );

		if ( $use_ai ) {
			$proposed = self::preview_ai( $attachment_id, $post_id, $fields, $config );
			if ( is_wp_error( $proposed ) ) {
				return $proposed;
			}
		} else {
			$proposed = self::preview_filename( $attachment_id, $fields );
		}

		$existing = Flowbie_Wp_Image_Seo::read_meta( $attachment_id );
		$merged   = Flowbie_Wp_Image_Seo::merge_values( $proposed, $existing, $overwrite_mode, $fields );

		return array(
			'proposed' => $proposed,
			'merged'   => $merged,
			'existing' => array(
				'title'       => $existing['title'],
				'alt'         => $existing['alt'],
				'caption'     => $existing['caption'],
				'description' => $existing['description'],
			),
		);
	}

	/**
	 * @param array<string,string> $values
	 * @return array{ok:bool,values:array<string,string>}|WP_Error
	 */
	public static function apply( int $attachment_id, array $values, ?string $overwrite_mode = null, ?array $fields = null ) {
		$config = Flowbie_Wp_Image_Seo::get_config();
		$fields = $fields ?? ( is_array( $config['fields'] ?? null ) ? $config['fields'] : Flowbie_Wp_Image_Seo::default_config()['fields'] );
		$overwrite_mode = $overwrite_mode ?? (string) ( $config['overwrite_mode'] ?? 'missing_only' );
		$existing = Flowbie_Wp_Image_Seo::read_meta( $attachment_id );
		$merged   = Flowbie_Wp_Image_Seo::merge_values( $values, $existing, $overwrite_mode, $fields );
		if ( empty( $merged ) ) {
			return array(
				'ok'     => true,
				'values' => array(),
				'skipped' => true,
			);
		}
		$result = Flowbie_Wp_Image_Seo::save_meta( $attachment_id, $merged );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array(
			'ok'     => true,
			'values' => $merged,
			'row'    => Flowbie_Wp_Image_Seo::attachment_row( $attachment_id ),
		);
	}

	public static function humanize_filename( string $filename ): string {
		$name = preg_replace( '/\.[^.]+$/', '', $filename );
		$name = str_replace( array( '-', '_', '.' ), ' ', (string) $name );
		$name = preg_replace( '/\s+/', ' ', trim( (string) $name ) );
		if ( $name === '' ) {
			return '';
		}
		return mb_strtoupper( mb_substr( $name, 0, 1 ) ) . mb_substr( $name, 1 );
	}

	/**
	 * @param array<string,bool> $fields
	 * @return array<int,string>
	 */
	private static function enabled_field_keys( array $fields ): array {
		$keys = array();
		foreach ( Flowbie_Wp_Image_Seo::FIELD_KEYS as $key ) {
			if ( ! empty( $fields[ $key ] ) ) {
				$keys[] = $key;
			}
		}
		return $keys;
	}

	/**
	 * @param array<string,mixed> $config
	 */
	private static function build_post_context( int $post_id, array $config ): string {
		if ( $post_id < 1 || empty( $config['context_from_post'] ) ) {
			return '';
		}
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return '';
		}
		$link = get_permalink( $post_id );
		$parts = array(
			'Post title: ' . $post->post_title,
		);
		if ( is_string( $link ) && $link !== '' ) {
			$parts[] = 'URL: ' . $link;
		}
		return implode( "\n", $parts );
	}

	/**
	 * @param array<int,string> $enabled
	 * @return array<string,string>
	 */
	private static function parse_ai_json( string $raw, array $enabled ): array {
		$raw = trim( $raw );
		if ( preg_match( '/\{[\s\S]*\}/', $raw, $m ) ) {
			$raw = $m[0];
		}
		$decoded = json_decode( $raw, true );
		$out     = array();
		if ( ! is_array( $decoded ) ) {
			return $out;
		}
		foreach ( $enabled as $key ) {
			if ( ! isset( $decoded[ $key ] ) ) {
				continue;
			}
			$val = trim( (string) $decoded[ $key ] );
			if ( $key === 'alt' && mb_strlen( $val ) > 125 ) {
				$val = mb_substr( $val, 0, 125 );
			}
			$out[ $key ] = $val;
		}
		return $out;
	}
}

<?php
/**
 * OpenRouter image generation with optional reference image (Nano Banana 2).
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_App_Openrouter_Image {

	const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
	const DEFAULT_MODEL  = 'google/gemini-3.1-flash-image';

	/**
	 * @param array{prompt:string,referenceDataUrl?:string,model?:string,size?:string,apiKey?:string} $opts
	 * @return array{dataUrl:string,mimeType:string}|WP_Error
	 */
	public static function generate_with_reference( array $opts ) {
		$prompt = isset( $opts['prompt'] ) ? trim( (string) $opts['prompt'] ) : '';
		if ( $prompt === '' ) {
			return new WP_Error( 'flowbie_openrouter_image', 'prompt is required' );
		}

		$api_key = self::resolve_key( isset( $opts['apiKey'] ) ? (string) $opts['apiKey'] : '' );
		if ( $api_key === '' ) {
			return new WP_Error( 'flowbie_openrouter_image', 'OpenRouter API key is missing' );
		}

		$model = isset( $opts['model'] ) && trim( (string) $opts['model'] ) !== ''
			? trim( (string) $opts['model'] )
			: self::DEFAULT_MODEL;

		$size = isset( $opts['size'] ) && trim( (string) $opts['size'] ) !== ''
			? trim( (string) $opts['size'] )
			: '1024x1024';

		$content = array(
			array(
				'type' => 'text',
				'text' => $prompt,
			),
		);

		$ref = isset( $opts['referenceDataUrl'] ) ? trim( (string) $opts['referenceDataUrl'] ) : '';
		if ( $ref !== '' && strpos( $ref, 'data:image/' ) === 0 ) {
			$content[] = array(
				'type'      => 'image_url',
				'image_url' => array( 'url' => $ref ),
			);
		}

		$response = wp_remote_post(
			self::OPENROUTER_URL,
			array(
				'timeout' => 180,
				'headers' => Flowbie_App_Openrouter_Attribution::request_headers( $api_key ),
				'body'    => wp_json_encode(
					array(
						'model'      => $model,
						'modalities' => array( 'text', 'image' ),
						'messages'   => array(
							array(
								'role'    => 'user',
								'content' => $content,
							),
						),
						'size'       => $size,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $json )
				? (string) ( $json['error']['message'] ?? $json['message'] ?? 'OpenRouter image error' )
				: 'OpenRouter image error';
			return new WP_Error( 'flowbie_openrouter_image', 'OpenRouter ' . $code . ': ' . $msg );
		}

		if ( ! is_array( $json ) ) {
			return new WP_Error( 'flowbie_openrouter_image', 'OpenRouter returned invalid JSON' );
		}

		$data_url = self::extract_image_data_url( $json );
		if ( $data_url === '' ) {
			return new WP_Error( 'flowbie_openrouter_image', 'OpenRouter returned no image' );
		}

		$mime = 'image/png';
		if ( preg_match( '#^data:(image/[^;]+);base64,#i', $data_url, $m ) ) {
			$mime = strtolower( $m[1] );
		}

		return array(
			'dataUrl'  => $data_url,
			'mimeType' => $mime,
		);
	}

	public static function resolve_key( string $override = '' ): string {
		$key = trim( $override );
		if ( $key !== '' ) {
			return $key;
		}
		$header = isset( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ? trim( (string) wp_unslash( $_SERVER['HTTP_X_OPENROUTER_API_KEY'] ) ) : '';
		if ( $header !== '' ) {
			return $header;
		}
		return trim( Flowbie_App_Secrets::openrouter_api_key() );
	}

	/**
	 * @param array<string,mixed> $json
	 */
	private static function extract_image_data_url( array $json ): string {
		if ( ! empty( $json['data'] ) && is_array( $json['data'] ) ) {
			foreach ( $json['data'] as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				if ( ! empty( $item['b64_json'] ) && is_string( $item['b64_json'] ) ) {
					return 'data:image/png;base64,' . $item['b64_json'];
				}
				if ( ! empty( $item['url'] ) && is_string( $item['url'] ) ) {
					return self::url_to_data_url( $item['url'] );
				}
			}
		}

		$message = $json['choices'][0]['message'] ?? null;
		if ( ! is_array( $message ) ) {
			return '';
		}

		if ( ! empty( $message['images'] ) && is_array( $message['images'] ) ) {
			foreach ( $message['images'] as $image ) {
				if ( ! is_array( $image ) ) {
					continue;
				}
				$url = self::image_url_from_field( $image['image_url'] ?? null );
				if ( $url !== '' ) {
					return self::normalize_image_url( $url );
				}
				$url = self::image_url_from_field( $image['url'] ?? null );
				if ( $url !== '' ) {
					return self::normalize_image_url( $url );
				}
				if ( ! empty( $image['b64_json'] ) && is_string( $image['b64_json'] ) ) {
					return 'data:image/png;base64,' . $image['b64_json'];
				}
			}
		}

		$content = $message['content'] ?? '';
		if ( is_string( $content ) && strpos( $content, 'data:image/' ) === 0 ) {
			return $content;
		}

		return '';
	}

	/**
	 * @param mixed $field
	 */
	private static function image_url_from_field( $field ): string {
		if ( is_string( $field ) ) {
			return $field;
		}
		if ( is_array( $field ) && ! empty( $field['url'] ) && is_string( $field['url'] ) ) {
			return $field['url'];
		}
		return '';
	}

	private static function normalize_image_url( string $url ): string {
		if ( strpos( $url, 'data:image/' ) === 0 ) {
			return $url;
		}
		if ( preg_match( '#^https?://#i', $url ) ) {
			return self::url_to_data_url( $url );
		}
		return '';
	}

	private static function url_to_data_url( string $url ): string {
		if ( strpos( $url, 'data:image/' ) === 0 ) {
			return $url;
		}
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 60,
				'headers' => array( 'Accept' => 'image/*,*/*;q=0.8' ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return '';
		}
		if ( (int) wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return '';
		}
		$raw = wp_remote_retrieve_body( $response );
		if ( $raw === '' ) {
			return '';
		}
		$mime = 'image/png';
		$type = wp_remote_retrieve_header( $response, 'content-type' );
		if ( is_string( $type ) && strpos( strtolower( $type ), 'image/' ) === 0 ) {
			$mime = strtolower( trim( explode( ';', $type )[0] ) );
		}
		return 'data:' . $mime . ';base64,' . base64_encode( $raw );
	}
}

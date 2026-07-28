<?php
/**
 * Checklist + blueprint generation for body harness.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Harness_Blueprint {

	/**
	 * @param array<string,mixed> $ctx
	 * @return array{checklist:array<int,string>,blueprint:array<string,mixed>}|WP_Error
	 */
	public static function build( array $ctx ) {
		$checklist = self::generate_checklist( $ctx );
		if ( is_wp_error( $checklist ) ) {
			return $checklist;
		}
		$blueprint = self::generate_blueprint( $checklist, $ctx );
		if ( is_wp_error( $blueprint ) ) {
			return $blueprint;
		}
		return array(
			'checklist' => $checklist,
			'blueprint' => $blueprint,
		);
	}

	/**
	 * @param array<string,mixed> $ctx
	 * @return array<int,string>|WP_Error
	 */
	private static function generate_checklist( array $ctx ) {
		$raw = Flowbie_Wp_OpenRouter::complete(
			Flowbie_Wp_Harness_Prompts::checklist_system_prompt(),
			Flowbie_Wp_Harness_Prompts::checklist_user_prompt( $ctx ),
			4000,
			1.0
		);
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}
		$lines = array();
		foreach ( preg_split( '/\r\n|\r|\n/', (string) $raw ) as $line ) {
			$line = trim( (string) $line );
			if ( $line === '' ) {
				continue;
			}
			$line = preg_replace( '/^\d+[\.\)]\s*/', '', $line );
			if ( is_string( $line ) && $line !== '' ) {
				$lines[] = $line;
			}
		}
		if ( count( $lines ) < 2 ) {
			return new WP_Error( 'flowbie_body_checklist', __( 'Checklist generation returned too few items.', 'flowbie-wp' ) );
		}
		return $lines;
	}

	/**
	 * @param array<int,string>     $checklist
	 * @param array<string,mixed> $ctx
	 * @return array<string,mixed>|WP_Error
	 */
	private static function generate_blueprint( array $checklist, array $ctx ) {
		$raw = Flowbie_Wp_OpenRouter::complete(
			Flowbie_Wp_Harness_Prompts::blueprint_system_prompt(),
			Flowbie_Wp_Harness_Prompts::blueprint_user_prompt( $checklist, $ctx ),
			8000,
			1.0
		);
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}
		$json = self::extract_json_object( (string) $raw );
		if ( $json === null ) {
			return new WP_Error( 'flowbie_body_blueprint', __( 'Blueprint response was not valid JSON.', 'flowbie-wp' ) );
		}
		$agents = isset( $json['agents'] ) && is_array( $json['agents'] ) ? $json['agents'] : array();
		if ( count( $agents ) < 2 ) {
			return new WP_Error( 'flowbie_body_blueprint', __( 'Blueprint has no agents.', 'flowbie-wp' ) );
		}
		return $json;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function extract_json_object( string $raw ) {
		$raw = trim( $raw );
		$raw = preg_replace( '/^```(?:json)?\s*/i', '', $raw );
		$raw = preg_replace( '/\s*```\s*$/', '', (string) $raw );
		$data = json_decode( trim( (string) $raw ), true );
		if ( is_array( $data ) ) {
			return $data;
		}
		if ( preg_match( '/\{[\s\S]*\}/', $raw, $m ) ) {
			$data = json_decode( $m[0], true );
			return is_array( $data ) ? $data : null;
		}
		return null;
	}

	/**
	 * @return array<int,array{id:int,slug:string,title:string,excerpt:string,link:string,date_gmt:string}>
	 */
	public static function fetch_linkable_posts(): array {
		$client = Flowbie_Wp_Ai_Gate::get_client();
		$types  = array( 'post', 'page' );
		if ( is_array( $client ) ) {
			$entity = Flowbie_Wp_Site_Progress::resolve_entity_post_type_for_client( $client );
			if ( null !== $entity && ! in_array( $entity, $types, true ) ) {
				$types[] = $entity;
			}
		}
		$q = new WP_Query(
			array(
				'post_type'      => $types,
				'post_status'    => 'publish',
				'posts_per_page' => 80,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			)
		);
		$out = array();
		foreach ( $q->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			$link = get_permalink( $post );
			$out[] = array(
				'id'       => (int) $post->ID,
				'slug'     => $post->post_name,
				'title'    => get_the_title( $post ),
				'excerpt'  => has_excerpt( $post ) ? get_the_excerpt( $post ) : '',
				'link'     => is_string( $link ) ? $link : '',
				'date_gmt' => $post->post_date_gmt,
			);
		}
		return $out;
	}
}

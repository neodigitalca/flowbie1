<?php
/**
 * Backend Assist — WordPress content tool handlers
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Tools_Wp {

	public static function tool_create_page( array $params ): array {
		$title  = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		$status = isset( $params['status'] ) ? sanitize_text_field( $params['status'] ) : 'draft';

		if ( $title === '' ) {
			return array( 'success' => false, 'error' => 'Page title is required.' );
		}

		if ( ! in_array( $status, array( 'draft', 'publish', 'private' ), true ) ) {
			$status = 'draft';
		}

		$post_id = wp_insert_post(
			array(
				'post_type'   => 'page',
				'post_title'  => $title,
				'post_status' => $status,
				'post_author' => get_current_user_id(),
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return array( 'success' => false, 'error' => $post_id->get_error_message() );
		}

		$focus_keyword = isset( $params['focus_keyword'] ) ? sanitize_text_field( $params['focus_keyword'] ) : '';
		if ( $focus_keyword !== '' ) {
			update_post_meta( $post_id, '_flowbie_focus_keyword', $focus_keyword );
			update_post_meta( $post_id, 'rank_math_focus_keyword', $focus_keyword );
		}

		return array(
			'success'       => true,
			'post_id'       => $post_id,
			'title'         => $title,
			'status'        => $status,
			'type'          => 'page',
			'focus_keyword' => $focus_keyword,
			'edit_url'      => get_edit_post_link( $post_id, 'raw' ),
			'view_url'      => get_permalink( $post_id ),
		);
	}
	public static function tool_create_post( array $params ): array {
		$title  = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		$status = isset( $params['status'] ) ? sanitize_text_field( $params['status'] ) : 'draft';

		if ( $title === '' ) {
			return array( 'success' => false, 'error' => 'Post title is required.' );
		}

		if ( ! in_array( $status, array( 'draft', 'publish', 'private' ), true ) ) {
			$status = 'draft';
		}

		$post_type = 'post';
		if ( ! empty( $params['post_type'] ) ) {
			$candidate = sanitize_key( $params['post_type'] );
			if ( post_type_exists( $candidate ) ) {
				$post_type = $candidate;
			}
		}

		$post_data = array(
			'post_type'   => $post_type,
			'post_title'  => $title,
			'post_status' => $status,
			'post_author' => get_current_user_id(),
		);

		if ( ! empty( $params['categories'] ) && is_array( $params['categories'] ) ) {
			$cat_ids = array();
			foreach ( $params['categories'] as $cat_name ) {
				$term = get_term_by( 'name', sanitize_text_field( $cat_name ), 'category' );
				if ( $term ) {
					$cat_ids[] = (int) $term->term_id;
				} else {
					$new_term = wp_insert_term( sanitize_text_field( $cat_name ), 'category' );
					if ( ! is_wp_error( $new_term ) ) {
						$cat_ids[] = (int) $new_term['term_id'];
					}
				}
			}
			if ( ! empty( $cat_ids ) ) {
				$post_data['post_category'] = $cat_ids;
			}
		}

		$post_id = wp_insert_post( $post_data, true );

		if ( is_wp_error( $post_id ) ) {
			return array( 'success' => false, 'error' => $post_id->get_error_message() );
		}

		$focus_keyword = isset( $params['focus_keyword'] ) ? sanitize_text_field( $params['focus_keyword'] ) : '';
		if ( $focus_keyword !== '' ) {
			update_post_meta( $post_id, '_flowbie_focus_keyword', $focus_keyword );
			update_post_meta( $post_id, 'rank_math_focus_keyword', $focus_keyword );
		}

		return array(
			'success'       => true,
			'post_id'       => $post_id,
			'title'         => $title,
			'status'        => $status,
			'type'          => $post_type,
			'focus_keyword' => $focus_keyword,
			'edit_url'      => get_edit_post_link( $post_id, 'raw' ),
			'view_url'      => get_permalink( $post_id ),
		);
	}
	public static function tool_list_posts( array $params ): array {
		$post_type = isset( $params['post_type'] ) ? sanitize_text_field( $params['post_type'] ) : 'any';
		$count     = isset( $params['count'] ) ? min( absint( $params['count'] ), 50 ) : 10;
		$status    = isset( $params['status'] ) ? sanitize_text_field( $params['status'] ) : 'any';

		Flowbie_Wp_Site_Inventory::warm( true );
		$filters = array(
			'include_drafts' => true,
			'limit'          => $count,
		);
		if ( $post_type !== 'any' ) {
			$filters['post_type'] = sanitize_key( $post_type );
		}
		if ( $status !== 'any' ) {
			$filters['status'] = sanitize_key( $status );
		}

		$items  = Flowbie_Wp_Site_Inventory::get_items( $filters );
		$result = array();
		$meta   = Flowbie_Wp_Site_Inventory::get_meta();
		$by_type = isset( $meta['by_type'] ) && is_array( $meta['by_type'] ) ? $meta['by_type'] : array();
		$total_available = (int) ( $meta['count'] ?? 0 );
		if ( $post_type !== 'any' && isset( $by_type[ sanitize_key( $post_type ) ] ) ) {
			$total_available = (int) $by_type[ sanitize_key( $post_type ) ];
		}

		foreach ( $items as $item ) {
			$post_id = (int) ( $item['id'] ?? 0 );
			$result[] = array(
				'id'       => $post_id,
				'title'    => (string) ( $item['title'] ?? '' ),
				'type'     => (string) ( $item['type'] ?? '' ),
				'status'   => (string) ( $item['status'] ?? 'publish' ),
				'date'     => (string) ( $item['date_gmt'] ?? '' ),
				'edit_url' => $post_id > 0 ? get_edit_post_link( $post_id, 'raw' ) : '',
				'view_url' => (string) ( $item['url'] ?? '' ),
			);
		}

		return array(
			'success'         => true,
			'count'           => count( $result ),
			'total_available' => $total_available,
			'posts'           => $result,
		);
	}
	public static function tool_get_post( array $params ): array {
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		$title   = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';

		if ( $post_id > 0 ) {
			$post = get_post( $post_id );
		} elseif ( $title !== '' ) {
			$found = get_posts( array(
				'post_type'   => self::get_content_post_types(),
				'post_status' => array( 'publish', 'draft', 'pending', 'private' ),
				's'           => $title,
				'numberposts' => 1,
			) );
			$post = ! empty( $found ) ? $found[0] : null;
		} else {
			return array( 'success' => false, 'error' => 'Provide a post_id or title to search.' );
		}

		if ( ! $post ) {
			return array( 'success' => false, 'error' => 'Post not found.' );
		}

		return array(
			'success'      => true,
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'type'         => $post->post_type,
			'status'       => $post->post_status,
			'date'         => $post->post_date,
			'modified'     => $post->post_modified,
			'author'       => get_the_author_meta( 'display_name', $post->post_author ),
			'word_count'   => str_word_count( wp_strip_all_tags( $post->post_content ) ),
			'excerpt'      => wp_trim_words( wp_strip_all_tags( $post->post_content ), 40 ),
			'edit_url'     => get_edit_post_link( $post->ID, 'raw' ),
			'view_url'     => get_permalink( $post->ID ),
			'categories'   => wp_get_post_categories( $post->ID, array( 'fields' => 'names' ) ),
			'tags'         => wp_get_post_tags( $post->ID, array( 'fields' => 'names' ) ),
		);
	}
	public static function tool_add_content( array $params ): array {
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		$title   = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		$content = isset( $params['content'] ) ? wp_kses_post( $params['content'] ) : '';
		$mode    = isset( $params['mode'] ) ? sanitize_text_field( $params['mode'] ) : 'append';

		if ( $post_id === 0 && $title !== '' ) {
			$found = get_posts( array(
				'post_type'   => self::get_content_post_types(),
				'post_status' => array( 'publish', 'draft', 'pending', 'private' ),
				's'           => $title,
				'numberposts' => 1,
			) );
			if ( ! empty( $found ) ) {
				$post_id = $found[0]->ID;
			}
		}

		if ( $post_id === 0 ) {
			return array( 'success' => false, 'error' => 'Could not find the target page/post. Provide a valid post_id or title.' );
		}

		if ( $content === '' ) {
			return array( 'success' => false, 'error' => 'Content to add is required.' );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return array( 'success' => false, 'error' => 'Post not found.' );
		}

		if ( $mode === 'replace' ) {
			$new_content = $content;
		} else {
			$new_content = trim( $post->post_content ) !== '' ? $post->post_content . "\n\n" . $content : $content;
		}

		$result = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $new_content,
			),
			true
		);

		if ( is_wp_error( $result ) ) {
			return array( 'success' => false, 'error' => $result->get_error_message() );
		}

		return array(
			'success'    => true,
			'post_id'    => $post_id,
			'title'      => $post->post_title,
			'type'       => $post->post_type,
			'mode'       => $mode,
			'word_count' => str_word_count( wp_strip_all_tags( $new_content ) ),
			'edit_url'   => get_edit_post_link( $post_id, 'raw' ),
			'view_url'   => get_permalink( $post_id ),
		);
	}
	public static function tool_get_gsc_context( array $params ): array {
		$post_id = isset( $params['post_id'] ) ? absint( $params['post_id'] ) : 0;
		if ( $post_id < 1 && ! empty( $params['title'] ) ) {
			$found = self::resolve_post_by_title( sanitize_text_field( (string) $params['title'] ) );
			if ( $found > 0 ) {
				$post_id = $found;
			}
		}

		$context = Flowbie_Wp_Gsc_Prompt::get_context(
			array(
				'post_id'       => $post_id,
				'focus_keyword' => isset( $params['focus_keyword'] ) ? (string) $params['focus_keyword'] : '',
				'date_from'     => isset( $params['date_from'] ) ? (string) $params['date_from'] : '',
				'date_to'       => isset( $params['date_to'] ) ? (string) $params['date_to'] : '',
			)
		);

		if ( empty( $context['prompt_block'] ) && empty( $context['queries'] ) ) {
			return array(
				'success' => false,
				'error'   => Flowbie_Wp_Gsc_Prompt::is_available()
					? __( 'No GSC query data found for this range.', 'flowbie-wp' )
					: __( 'Google Search Console is not configured.', 'flowbie-wp' ),
			);
		}

		return array(
			'success'      => true,
			'prompt_block' => (string) $context['prompt_block'],
			'queries'      => $context['queries'],
			'summary'      => (string) $context['prompt_block'],
		);
	}
	public static function resolve_post_by_title( string $title ): int {
		if ( $title === '' ) {
			return 0;
		}
		$found = get_posts(
			array(
				'post_type'   => self::get_content_post_types(),
				'post_status' => array( 'publish', 'draft', 'pending', 'private' ),
				's'           => $title,
				'numberposts' => 1,
			)
		);
		return ! empty( $found[0] ) ? (int) $found[0]->ID : 0;
	}
	public static function get_content_post_types(): array {
		$types = array( 'post', 'page' );
		if ( post_type_exists( 'service-area' ) ) {
			$types[] = 'service-area';
		}
		return $types;
	}
}

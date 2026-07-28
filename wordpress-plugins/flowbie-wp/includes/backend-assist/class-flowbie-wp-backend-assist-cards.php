<?php
/**
 * Backend Assist — semantic card builders for REST responses
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Backend_Assist_Cards {

	public static function normalize_history( array $history ): array {
		return array_map(
			function ( $entry ) {
				return array(
					'role'    => isset( $entry['role'] ) ? sanitize_text_field( $entry['role'] ) : 'user',
					'content' => isset( $entry['content'] ) ? sanitize_textarea_field( $entry['content'] ) : '',
				);
			},
			array_slice( $history, -10 )
		);
	}
	public static function action_card( array $result, string $tool ): array {
		$success = ! empty( $result['success'] );
		$links   = array();

		if ( $success && ! empty( $result['elementor_edit_url'] ) ) {
			$links[] = array(
				'label' => __( 'Edit in Elementor', 'flowbie-wp' ),
				'url'   => $result['elementor_edit_url'],
				'icon'  => 'edit',
			);
		} elseif ( $success && ! empty( $result['edit_url'] ) ) {
			$links[] = array( 'label' => 'Edit', 'url' => $result['edit_url'], 'icon' => 'edit' );
		}
		if ( $success && ! empty( $result['block_edit_url'] ) ) {
			$links[] = array(
				'label' => __( 'Edit SEO block', 'flowbie-wp' ),
				'url'   => $result['block_edit_url'],
				'icon'  => 'post',
			);
		}
		if ( $success && ! empty( $result['view_url'] ) ) {
			$links[] = array( 'label' => 'View', 'url' => $result['view_url'], 'icon' => 'page' );
		}

		$title_label = isset( $result['title'] ) ? $result['title'] : $tool;
		$error_label = isset( $result['error'] ) ? $result['error'] : __( 'Unknown error.', 'flowbie-wp' );

		$body = $success
			? ( ! empty( $result['summary'] )
				? (string) $result['summary']
				: sprintf( __( 'Successfully executed %s.', 'flowbie-wp' ), str_replace( '_', ' ', $tool ) ) )
			: $error_label;

		return array(
			'type'          => 'action',
			'title'         => $success
				? sprintf( __( 'Done: %s', 'flowbie-wp' ), $title_label )
				: __( 'Action failed', 'flowbie-wp' ),
			'body'          => $body,
			'links'         => $links,
			'confidence'    => $success ? 'high' : 'low',
			'action_result' => $result,
		);
	}
	public static function needs_info_card( string $tool, array $missing ): array {
		$prompts = array(
			'create_page' => array(
				'title'       => __( 'Let\'s create your page', 'flowbie-wp' ),
				'body'        => __( 'What **title** would you like for this page? You can also include a **focus keyword** for SEO.', 'flowbie-wp' ),
				'suggestions' => array(
					'About Us (keyword: about our company)',
					'Services (keyword: web design services)',
					'Contact Us',
				),
			),
			'create_post' => array(
				'title'       => __( 'Let\'s create your post', 'flowbie-wp' ),
				'body'        => __( 'What **title** would you like for this post? You can also include a **focus keyword** and **category**.', 'flowbie-wp' ),
				'suggestions' => array(
					'10 Tips for Better SEO (keyword: seo tips)',
					'Our Latest Project Update',
					'Industry News (category: News)',
				),
			),
			'get_post' => array(
				'title'       => __( 'Which post are you looking for?', 'flowbie-wp' ),
				'body'        => __( 'Please provide the **post title** or **ID** to look up.', 'flowbie-wp' ),
				'suggestions' => array(
					'Homepage',
					'About Us',
					'Post ID 42',
				),
			),
			'add_content' => array(
				'title'       => __( 'What content should I add?', 'flowbie-wp' ),
				'body'        => __( 'Tell me **what to write** and **which page/post** to add it to. I can generate content for you — just describe what you need.', 'flowbie-wp' ),
				'suggestions' => array(
					'Add 5 H2 headings to SEO Vs. Ads',
					'Write an intro paragraph for my About page',
					'Add a FAQ section to Services',
				),
			),
			'compose_seo_block' => array(
				'title'       => __( 'Describe your SEO block', 'flowbie-wp' ),
				'body'        => __( 'Tell me **what this block should cover** — topic, keyword, sections, or layout goals.', 'flowbie-wp' ),
				'suggestions' => array(
					'Generate a full block about window treatments in Edmonton',
					'Optimize copy for the focus keyword',
					'Analyze this block for SEO gaps',
				),
			),
			'modify_seo_block_slots' => array(
				'title'       => __( 'Which slot should I change?', 'flowbie-wp' ),
				'body'        => __( 'Describe the **slot to add, remove, or update** (e.g. add H2, remove CTA).', 'flowbie-wp' ),
				'suggestions' => array(
					'Add an H2 about our services',
					'Remove the CTA slot',
					'Update the first heading text',
				),
			),
			'delete_seo_block' => array(
				'title'       => __( 'Which SEO block should I delete?', 'flowbie-wp' ),
				'body'        => __( 'Provide the **block ID** or name from the list.', 'flowbie-wp' ),
				'suggestions' => array(
					'List my SEO blocks',
					'Delete block 3',
				),
			),
			'create_seo_block' => array(
				'title'       => __( 'New SEO block', 'flowbie-wp' ),
				'body'        => __( 'What **title or focus keyword** should the new block use?', 'flowbie-wp' ),
				'suggestions' => array(
					'Window treatments Edmonton',
					'Services hero block',
				),
			),
			'apply_seo_block_to_page' => array(
				'title'       => __( 'Apply SEO block to page', 'flowbie-wp' ),
				'body'        => __( 'Which **page** and **SEO block** should I link? Provide post_id and block_id, or create a page first.', 'flowbie-wp' ),
				'suggestions' => array(
					'Apply block 12 to page 45',
					'Create a page about services with an SEO block',
				),
			),
		);

		$info = isset( $prompts[ $tool ] ) ? $prompts[ $tool ] : array(
			'title'       => __( 'I need a bit more info', 'flowbie-wp' ),
			'body'        => sprintf( __( 'To run **%s**, please provide: %s', 'flowbie-wp' ), str_replace( '_', ' ', $tool ), implode( ', ', $missing ) ),
			'suggestions' => array(),
		);

		return array(
			'type'              => 'prompt',
			'title'             => $info['title'],
			'body'              => $info['body'],
			'links'             => array(),
			'suggested_actions' => $info['suggestions'],
			'confidence'        => 'high',
		);
	}
	public static function error_card( string $message ): array {
		return array(
			'type'       => 'error',
			'title'      => __( 'Something went wrong', 'flowbie-wp' ),
			'body'       => $message,
			'links'      => array(),
			'confidence' => 'low',
		);
	}
}

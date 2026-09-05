<?php
/**
 * Legacy client upload completion for in-flight server runs (pre-worker migration).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Post_Creator_Upload_Complete {

	/**
	 * @param array<string,mixed> $run
	 * @param array<string,mixed> $uploaded_post
	 * @return array<string,mixed>
	 */
	public static function complete_client_upload(
		int $team_id,
		int $run_id,
		int $row_index,
		array $run,
		array $uploaded_post
	): array {
		$result     = is_array( $run['result'] ?? null ) ? $run['result'] : array();
		$checkpoint = is_array( $result['checkpoint'] ?? null ) ? $result['checkpoint'] : array();
		$server     = is_array( $checkpoint['server'] ?? null ) ? $checkpoint['server'] : array();

		$post_url = trim( (string) ( $uploaded_post['url'] ?? '' ) );
		$post_id  = isset( $uploaded_post['postId'] ) ? (int) $uploaded_post['postId'] : 0;
		$title    = trim( (string) ( $uploaded_post['title'] ?? '' ) );

		$uploads = is_array( $result['uploadedPosts'] ?? null ) ? $result['uploadedPosts'] : array();
		foreach ( $uploads as $existing ) {
			if ( ! is_array( $existing ) ) {
				continue;
			}
			if ( isset( $existing['rowIndex'] ) && (int) $existing['rowIndex'] === $row_index ) {
				$updated = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, true );
				return is_array( $updated ) ? $updated : array();
			}
		}

		$uploads[] = array(
			'rowIndex' => $row_index,
			'url'      => $post_url,
			'postId'   => $post_id > 0 ? $post_id : null,
			'title'    => $title,
		);
		$result['uploadedPosts'] = $uploads;
		$result['updated']       = count( $uploads );
		$result['executionMode'] = 'server';

		Neo_Pulse_App_Agent_Runs_Store::patch_run(
			$team_id,
			$run_id,
			array(
				'result' => $result,
				'step'   => array(
					'stepKey' => 'post.' . $row_index . '.upload',
					'label'   => $post_url !== '' ? 'Published · ' . $title : 'Uploaded to WordPress',
					'status'  => 'done',
					'payload' => array(
						'postUrl' => $post_url,
						'postId'  => $post_id > 0 ? $post_id : null,
					),
				),
			)
		);

		$updated = Neo_Pulse_App_Agent_Runs_Store::get_run( $team_id, $run_id, true );
		return is_array( $updated ) ? $updated : array();
	}
}

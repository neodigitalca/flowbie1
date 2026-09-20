<?php
/**
 * Design a new page with Novamira tokens and site Elementor design RAG.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Backend_Assist_Novamira_Page {

	const DESIGN_CRON_HOOK = 'neo_pulse_novamira_page_design';

	/**
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	public static function design( array $params ): array {
		$post_id = absint( $params['post_id'] ?? 0 );
		if ( $post_id < 1 ) {
			return array( 'success' => false, 'error' => __( 'post_id is required.', 'neo-pulse-wp' ) );
		}

		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 300 );
		}
		Neo_Pulse_Wp_OpenRouter::maybe_extend_time_limit();

		if ( isset( $params['engine'] ) && (string) $params['engine'] === 'rag_compose' ) {
			return self::design_via_rag_compose( $params, $post_id );
		}

		$result = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Harness::run( $post_id, $params );
		if ( is_wp_error( $result ) ) {
			return array(
				'success' => false,
				'post_id' => $post_id,
				'error'   => $result->get_error_message(),
			);
		}
		return $result;
	}

	/**
	 * Legacy deterministic RAG compose (tests and explicit engine=rag_compose only).
	 *
	 * @param array<string,mixed> $params
	 * @return array<string,mixed>
	 */
	private static function design_via_rag_compose( array $params, int $post_id ): array {
		$tokens = self::novamira_tokens();
		if ( is_wp_error( $tokens ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $tokens->get_error_message() );
		}

		$collected  = self::collect_blocks_and_slots( $params, $post_id );
		$slots      = $collected['slots'];
		$block_spans = $collected['block_spans'];
		if ( $slots === array() ) {
			return array(
				'success' => false,
				'post_id' => $post_id,
				'error'   => __( 'No saved SEO block slots to design. Compose and save blocks first.', 'neo-pulse-wp' ),
			);
		}

		$digest = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::build( $post_id );
		if ( is_wp_error( $digest ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $digest->get_error_message() );
		}

		$templates = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Design_Rag::section_template_sequence( $post_id );
		if ( is_wp_error( $templates ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $templates->get_error_message() );
		}
		$digest['section_template_sequence'] = $templates;

		$page_title = get_the_title( $post_id );
		$plan       = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::deterministic_layout_plan( $digest, $slots, $block_spans );
		if ( is_wp_error( $plan ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $plan->get_error_message() );
		}

		$elements = Neo_Pulse_Wp_Backend_Assist_Novamira_Page_Compose::materialize( $plan, $digest, $slots, $page_title, $tokens );
		if ( is_wp_error( $elements ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $elements->get_error_message() );
		}

		$saved = self::save_elementor( $post_id, $elements );
		if ( is_wp_error( $saved ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $saved->get_error_message() );
		}

		$slug_update = array(
			'ID'          => $post_id,
			'post_status' => 'publish',
		);
		$name = (string) get_post_field( 'post_name', $post_id );
		if ( $name !== '' && str_contains( $name, 'trashed' ) ) {
			$slug_update['post_name'] = sanitize_title( get_the_title( $post_id ) );
		}
		$published = wp_update_post( $slug_update, true );
		if ( is_wp_error( $published ) ) {
			return array( 'success' => false, 'post_id' => $post_id, 'error' => $published->get_error_message() );
		}

		return array(
			'success'      => true,
			'post_id'      => $post_id,
			'title'        => get_the_title( $post_id ),
			'view_url'     => get_permalink( $post_id ),
			'edit_url'     => get_edit_post_link( $post_id, 'raw' ),
			'section_plan' => self::section_plan_summary( $plan ),
			'summary'      => sprintf(
				/* translators: %s: page title */
				__( 'Designed and published "%s" using site Elementor design RAG and Novamira.', 'neo-pulse-wp' ),
				get_the_title( $post_id )
			),
		);
	}

	/**
	 * @return array<string,mixed>|WP_Error
	 */
	private static function novamira_tokens() {
		if ( ! function_exists( 'wp_get_ability' ) ) {
			return new WP_Error( 'neo-pulse_novamira', __( 'Novamira abilities are not available.', 'neo-pulse-wp' ) );
		}
		$design = self::run_ability( 'novamira/get-active-design', array() );
		if ( is_wp_error( $design ) ) {
			return $design;
		}
		$context = self::run_ability( 'novamira/agent-context', array() );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		return array(
			'design'  => $design,
			'context' => $context,
		);
	}

	/**
	 * @param array<string,mixed> $input
	 * @return array<string,mixed>|WP_Error
	 */
	public static function run_ability( string $name, array $input ) {
		$ability = wp_get_ability( $name );
		if ( ! is_object( $ability ) || ! method_exists( $ability, 'execute' ) ) {
			return new WP_Error(
				'neo-pulse_novamira',
				sprintf(
					/* translators: %s: ability name */
					__( 'Novamira ability %s is missing.', 'neo-pulse-wp' ),
					$name
				)
			);
		}
		$result = $input === array() ? $ability->execute() : $ability->execute( $input );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( ! is_array( $result ) ) {
			return new WP_Error( 'neo-pulse_novamira', __( 'Novamira ability returned an invalid payload.', 'neo-pulse-wp' ) );
		}
		return $result;
	}

	/**
	 * @param array<string,mixed> $params
	 * @return array{slots:array<int,array<string,mixed>>,block_spans:array<int,array{label:string,slot_indexes:array<int,int>}>}
	 */
	public static function collect_blocks_and_slots( array $params, int $post_id ): array {
		$ids = array();
		if ( ! empty( $params['block_ids'] ) && is_array( $params['block_ids'] ) ) {
			foreach ( $params['block_ids'] as $id ) {
				$ids[] = absint( $id );
			}
		} elseif ( ! empty( $params['block_id'] ) ) {
			$ids[] = absint( $params['block_id'] );
		}
		$ids = array_values( array_unique( array_filter( $ids ) ) );

		$rows = array();
		if ( $ids !== array() ) {
			foreach ( $ids as $id ) {
				$row = Neo_Pulse_Wp_Seo_Blocks_Storage::get( $id );
				if ( is_array( $row ) ) {
					$rows[] = $row;
				}
			}
		} else {
			foreach ( Neo_Pulse_Wp_Seo_Blocks_Storage::list_all() as $row ) {
				if ( is_array( $row ) && absint( $row['primary_post_id'] ?? 0 ) === $post_id ) {
					$rows[] = $row;
				}
			}
		}

		$slots       = array();
		$block_spans = array();
		$offset      = 0;

		foreach ( $rows as $row ) {
			$block_slots = isset( $row['slots'] ) && is_array( $row['slots'] ) ? $row['slots'] : array();
			if ( $block_slots === array() ) {
				continue;
			}
			$indexes = array();
			foreach ( $block_slots as $slot ) {
				if ( ! is_array( $slot ) ) {
					continue;
				}
				$slots[]   = $slot;
				$indexes[] = $offset;
				++$offset;
			}
			if ( $indexes === array() ) {
				continue;
			}
			$label = Neo_Pulse_Wp_Seo_Blocks_Storage::first_h2( $block_slots );
			if ( $label === '' ) {
				$label = trim( (string) ( $row['title'] ?? $row['name'] ?? '' ) );
			}
			$block_spans[] = array(
				'label'        => $label,
				'slot_indexes' => $indexes,
			);
		}

		return array(
			'slots'       => $slots,
			'block_spans' => $block_spans,
		);
	}

	/**
	 * @param array<string,mixed> $params
	 * @return array<int,array<string,mixed>>
	 */
	private static function collect_slots( array $params, int $post_id ): array {
		return self::collect_blocks_and_slots( $params, $post_id )['slots'];
	}

	/**
	 * @param array<int,array<string,mixed>> $elements
	 * @return true|WP_Error
	 */
	private static function save_elementor( int $post_id, array $elements ) {
		if ( ! class_exists( '\Elementor\Plugin', false ) ) {
			return new WP_Error( 'neo-pulse_elementor_missing', __( 'Elementor is required to design this page.', 'neo-pulse-wp' ) );
		}
		update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
		$json = wp_json_encode( $elements );
		if ( ! is_string( $json ) ) {
			return new WP_Error( 'neo-pulse_elementor_save', __( 'Could not encode Elementor data.', 'neo-pulse-wp' ) );
		}
		update_post_meta( $post_id, '_elementor_data', wp_slash( $json ) );
		if ( class_exists( 'Neo_Pulse_Wp_Seo_Blocks_Page_Insert', false ) ) {
			Neo_Pulse_Wp_Seo_Blocks_Page_Insert::after_write_elementor_data( $post_id );
		} else {
			if ( defined( 'ELEMENTOR_VERSION' ) ) {
				update_post_meta( $post_id, '_elementor_version', ELEMENTOR_VERSION );
			}
			update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
			delete_post_meta( $post_id, '_elementor_element_cache' );
			delete_post_meta( $post_id, '_elementor_css' );
		}
		return true;
	}

	/**
	 * @param array<string,mixed> $plan
	 * @return array<int,array<string,mixed>>
	 */
	private static function section_plan_summary( array $plan ): array {
		$sections = isset( $plan['sections'] ) && is_array( $plan['sections'] ) ? $plan['sections'] : array();
		$out      = array();
		foreach ( $sections as $i => $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}
			$out[] = array(
				'index'          => $i + 1,
				'label'          => (string) ( $section['label'] ?? '' ),
				'archetype'      => (string) ( $section['archetype'] ?? '' ),
				'template_index' => isset( $section['template_index'] ) ? absint( $section['template_index'] ) : null,
				'slot_indexes'   => isset( $section['slot_indexes'] ) && is_array( $section['slot_indexes'] ) ? array_values( $section['slot_indexes'] ) : array(),
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array{label:string,slot_indexes:array<int,int>}> $block_spans
	 * @return array<int,array<string,mixed>>
	 */
	public static function section_plan_from_block_spans( array $block_spans ): array {
		$out = array();
		foreach ( $block_spans as $i => $span ) {
			if ( ! is_array( $span ) ) {
				continue;
			}
			$out[] = array(
				'index'        => $i + 1,
				'label'        => (string) ( $span['label'] ?? '' ),
				'slot_indexes' => isset( $span['slot_indexes'] ) && is_array( $span['slot_indexes'] ) ? array_values( $span['slot_indexes'] ) : array(),
			);
		}
		return $out;
	}

	public static function register_cron(): void {
		add_action( self::DESIGN_CRON_HOOK, array( __CLASS__, 'run_design_cron' ), 10, 2 );
	}

	/**
	 * Queue Novamira design on wp-cron (avoids HTTP gateway timeouts on long Elementor writes).
	 *
	 * @return true|WP_Error
	 */
	public static function queue_design_cron( int $post_id, string $job_option_key ) {
		if ( $post_id < 1 || $job_option_key === '' ) {
			return new WP_Error( 'neo-pulse_novamira_queue', __( 'Invalid design queue parameters.', 'neo-pulse-wp' ) );
		}
		wp_clear_scheduled_hook( self::DESIGN_CRON_HOOK, array( $post_id, $job_option_key ) );
		$scheduled = wp_schedule_single_event( time(), self::DESIGN_CRON_HOOK, array( $post_id, $job_option_key ) );
		if ( $scheduled === false ) {
			return new WP_Error( 'neo-pulse_novamira_queue', __( 'Could not schedule Novamira design.', 'neo-pulse-wp' ) );
		}
		$cron_url = site_url( 'wp-cron.php' );
		if ( defined( 'ALTERNATE_WP_CRON' ) && ALTERNATE_WP_CRON ) {
			$cron_url = add_query_arg( 'doing_wp_cron', rawurlencode( (string) microtime( true ) ), $cron_url );
		} else {
			$cron_url = add_query_arg( 'doing_wp_cron', rawurlencode( (string) microtime( true ) ), $cron_url );
		}
		wp_remote_get(
			$cron_url,
			array(
				'timeout'   => 0.01,
				'blocking'  => false,
				'sslverify' => apply_filters( 'https_local_ssl_verify', false ),
			)
		);
		return true;
	}

	public static function run_design_cron( int $post_id, string $job_option_key ): void {
		if ( $post_id < 1 || $job_option_key === '' ) {
			return;
		}
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 300 );
		}
		Neo_Pulse_Wp_OpenRouter::maybe_extend_time_limit();
		Neo_Pulse_Wp_Backend_Assist::ensure_dependencies();
		$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
		if ( ! empty( $admins ) ) {
			wp_set_current_user( (int) $admins[0]->ID );
		}
		$result         = self::design( array( 'post_id' => $post_id ) );
		$result['state'] = ! empty( $result['success'] ) ? 'done' : 'error';
		if ( defined( 'NEO_PULSE_WP_VERSION' ) ) {
			$result['plugin'] = NEO_PULSE_WP_VERSION;
		}
		$result['status'] = get_post_status( $post_id );
		update_option( $job_option_key, $result, false );
	}
}

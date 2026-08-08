<?php
/**
 * Settings-related admin_init handlers.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Handlers_Settings {

	public static function handle_save_openrouter(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save AI credentials.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_OPENROUTER, 'flowbie_wp_openrouter_nonce' );

		$raw = isset( $_POST['flowbie_openrouter_api_key'] ) ? wp_unslash( $_POST['flowbie_openrouter_api_key'] ) : '';
		$key = sanitize_text_field( trim( (string) $raw ) );
		if ( $key === '' && Flowbie_Wp_Api::get_agency_openrouter_api_key() !== '' ) {
			self::set_flash(
				array(
					'kind'    => 'openrouter',
					'success' => true,
					'message' => __( 'OpenRouter key unchanged.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_settings( 'openrouter' );
		}

		Flowbie_Wp_Api::save_agency_openrouter_api_key( $key );
		self::set_flash(
			array(
				'kind'    => 'openrouter',
				'success' => true,
				'message' => $key !== ''
					? __( 'OpenRouter key saved for editor AI wands.', 'flowbie-wp' )
					: __( 'OpenRouter key cleared.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_settings( 'openrouter' );
	}

	public static function handle_save_dataforseo(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save research credentials.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_DATAFORSEO, 'flowbie_wp_dataforseo_nonce' );

		$login_raw    = isset( $_POST['flowbie_dataforseo_login'] ) ? wp_unslash( $_POST['flowbie_dataforseo_login'] ) : '';
		$password_raw = isset( $_POST['flowbie_dataforseo_password'] ) ? wp_unslash( $_POST['flowbie_dataforseo_password'] ) : '';
		$login        = sanitize_text_field( trim( (string) $login_raw ) );
		$password     = trim( (string) $password_raw );
		$existing     = Flowbie_Wp_Api::get_agency_dataforseo_credentials();

		if ( $login === '' && $password === '' ) {
			if ( $existing['login'] !== '' || $existing['password'] !== '' ) {
				Flowbie_Wp_Api::save_agency_dataforseo_credentials( '', '' );
				self::set_flash(
					array(
						'kind'    => 'dataforseo',
						'success' => true,
						'message' => __( 'DataForSEO credentials cleared.', 'flowbie-wp' ),
					)
				);
			} else {
				self::set_flash(
					array(
						'kind'    => 'dataforseo',
						'success' => false,
						'message' => __( 'Enter your DataForSEO login and API password.', 'flowbie-wp' ),
					)
				);
			}
			self::redirect_to_settings( 'dataforseo' );
		}

		if ( $login === '' && $existing['login'] !== '' ) {
			$login = $existing['login'];
		}
		if ( $password === '' && $existing['password'] !== '' ) {
			$password = $existing['password'];
		}

		if ( $login === '' || $password === '' ) {
			self::set_flash(
				array(
					'kind'    => 'dataforseo',
					'success' => false,
					'message' => __( 'Both DataForSEO login and API password are required.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_settings( 'dataforseo' );
		}

		$unchanged = $login === $existing['login'] && $password === $existing['password'];
		if ( $unchanged ) {
			self::set_flash(
				array(
					'kind'    => 'dataforseo',
					'success' => true,
					'message' => __( 'DataForSEO credentials unchanged.', 'flowbie-wp' ),
				)
			);
			self::redirect_to_settings( 'dataforseo' );
		}

		Flowbie_Wp_Api::save_agency_dataforseo_credentials( $login, $password );
		self::set_flash(
			array(
				'kind'    => 'dataforseo',
				'success' => true,
				'message' => __( 'DataForSEO credentials saved for SEO research briefs.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_settings( 'dataforseo' );
	}

	public static function handle_save_chat(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save chat settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'flowbie_wp_save_chat', 'flowbie_wp_chat_nonce' );

		$enabled         = ! empty( $_POST['flowbie_chat_enabled'] );
		$logged_in_only  = ! empty( $_POST['flowbie_chat_logged_in_only'] );
		$welcome_raw     = isset( $_POST['flowbie_chat_welcome_message'] ) ? wp_unslash( $_POST['flowbie_chat_welcome_message'] ) : '';
		$welcome_message = sanitize_text_field( trim( (string) $welcome_raw ) );

		$chekkit_enabled        = ! empty( $_POST['flowbie_chat_chekkit_enabled'] );
		$chekkit_teaser_enabled = ! empty( $_POST['flowbie_chat_chekkit_teaser_enabled'] );
		$chekkit_cta_raw = isset( $_POST['flowbie_chat_chekkit_cta_label'] ) ? wp_unslash( $_POST['flowbie_chat_chekkit_cta_label'] ) : '';
		$chekkit_cta_label = sanitize_text_field( trim( (string) $chekkit_cta_raw ) );
		$chekkit_event_raw = isset( $_POST['flowbie_chat_chekkit_event_type'] ) ? wp_unslash( $_POST['flowbie_chat_chekkit_event_type'] ) : '';
		$chekkit_event_type = sanitize_key( trim( (string) $chekkit_event_raw ) );
		if ( $chekkit_event_type === '' ) {
			$chekkit_event_type = 'contact_request';
		}
		$chekkit_webhook_raw = isset( $_POST['flowbie_chat_chekkit_webhook_url'] ) ? wp_unslash( $_POST['flowbie_chat_chekkit_webhook_url'] ) : '';
		$chekkit_webhook_url = esc_url_raw( trim( (string) $chekkit_webhook_raw ) );
		if ( $chekkit_webhook_url === '' ) {
			$chekkit_webhook_url = Flowbie_Wp_Chekkit::DEFAULT_WEBHOOK_URL;
		}

		Flowbie_Wp_Chat::save_settings(
			array(
				'enabled'              => $enabled,
				'logged_in_only'       => $logged_in_only,
				'welcome_message'      => $welcome_message !== '' ? $welcome_message : __( 'Hi! Ask me anything about this website.', 'flowbie-wp' ),
				'chekkit_enabled'        => $chekkit_enabled,
				'chekkit_teaser_enabled' => $chekkit_teaser_enabled,
				'chekkit_cta_label'      => $chekkit_cta_label !== '' ? $chekkit_cta_label : __( 'Send Us A Text', 'flowbie-wp' ),
				'chekkit_event_type'   => $chekkit_event_type,
				'chekkit_webhook_url'  => $chekkit_webhook_url,
			)
		);

		self::set_flash(
			array(
				'kind'    => 'chat',
				'success' => true,
				'message' => $enabled
					? __( 'Chat widget enabled. Chat is available in the AI Search sidebar on the frontend.', 'flowbie-wp' )
					: __( 'Chat widget disabled.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat();
	}

	public static function handle_save_chat_design(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save chat design settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'flowbie_wp_save_chat_design', 'flowbie_wp_chat_design_nonce' );

		$raw = isset( $_POST['flowbie_design'] ) ? (array) wp_unslash( $_POST['flowbie_design'] ) : array();
		Flowbie_Wp_Ai_Widget_Design::save_from_admin_post( $raw, 'chat' );

		$tokens = isset( $raw['tokens'] ) && is_array( $raw['tokens'] ) ? $raw['tokens'] : array();
		$accent = isset( $tokens['accent'] ) ? sanitize_hex_color( (string) $tokens['accent'] ) : '';

		$sidebar_raw = isset( $raw['sidebar'] ) && is_array( $raw['sidebar'] ) ? $raw['sidebar'] : array();
		$sidebar     = Flowbie_Wp_Ai_Widget_Design::sanitize_sidebar_config( $sidebar_raw, 'chat' );

		Flowbie_Wp_Chat::save_settings(
			array_merge(
				$sidebar,
				array(
					'color'             => $accent !== '' && $accent !== null ? $accent : Flowbie_Wp_Chat::get_settings()['color'],
					'voice_enabled'     => ! empty( $_POST['flowbie_chat_voice_enabled'] ),
					'voice_ptt'         => ! empty( $_POST['flowbie_chat_voice_ptt'] ),
					'mic_replaces_send' => ! empty( $_POST['flowbie_chat_mic_replaces_send'] ),
				)
			)
		);

		self::set_flash(
			array(
				'kind'    => 'chat',
				'success' => true,
				'message' => __( 'Chat design settings saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat( 'design' );
	}

	public static function handle_save_chat_training(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save training settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'flowbie_wp_save_chat_training', 'flowbie_wp_chat_training_nonce' );

		$assistant_name = isset( $_POST['flowbie_chat_assistant_name'] )
			? sanitize_text_field( trim( (string) wp_unslash( $_POST['flowbie_chat_assistant_name'] ) ) )
			: 'Flow Assist';
		if ( $assistant_name === '' ) {
			$assistant_name = 'Flow Assist';
		}

		$system_prompt = isset( $_POST['flowbie_chat_system_prompt'] )
			? sanitize_textarea_field( wp_unslash( $_POST['flowbie_chat_system_prompt'] ) )
			: '';

		$greeting_style_raw = isset( $_POST['flowbie_chat_greeting_style'] )
			? sanitize_text_field( wp_unslash( $_POST['flowbie_chat_greeting_style'] ) )
			: 'friendly';
		$greeting_style = in_array( $greeting_style_raw, array( 'professional', 'friendly', 'casual' ), true )
			? $greeting_style_raw
			: 'friendly';

		$indexed_types_raw = isset( $_POST['flowbie_chat_indexed_types'] ) && is_array( $_POST['flowbie_chat_indexed_types'] )
			? $_POST['flowbie_chat_indexed_types'] // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			: array( 'post', 'page' );
		$indexed_types = array_map( 'sanitize_key', $indexed_types_raw );
		if ( empty( $indexed_types ) ) {
			$indexed_types = array( 'post', 'page' );
		}

		$excluded_cats = array();
		if ( isset( $_POST['flowbie_chat_excluded_cats'] ) && is_array( $_POST['flowbie_chat_excluded_cats'] ) ) {
			$excluded_cats = array_map( 'absint', $_POST['flowbie_chat_excluded_cats'] );
		}

		$full_content = ! empty( $_POST['flowbie_chat_full_content'] );
		$lead_conversion_enabled = ! empty( $_POST['flowbie_chat_lead_conversion_enabled'] );

		$lead_forms = array(
			'booking' => isset( $_POST['flowbie_chat_lead_form_booking'] ) ? absint( wp_unslash( $_POST['flowbie_chat_lead_form_booking'] ) ) : 0,
			'contact' => isset( $_POST['flowbie_chat_lead_form_contact'] ) ? absint( wp_unslash( $_POST['flowbie_chat_lead_form_contact'] ) ) : 0,
			'pricing' => isset( $_POST['flowbie_chat_lead_form_pricing'] ) ? absint( wp_unslash( $_POST['flowbie_chat_lead_form_pricing'] ) ) : 0,
		);

		Flowbie_Wp_Chat::save_settings(
			array(
				'assistant_name'            => $assistant_name,
				'system_prompt'             => $system_prompt,
				'greeting_style'            => $greeting_style,
				'indexed_post_types'        => $indexed_types,
				'excluded_categories'       => $excluded_cats,
				'full_content'              => $full_content,
				'lead_conversion_enabled'   => $lead_conversion_enabled,
				'lead_forms'                => $lead_forms,
			)
		);

		Flowbie_Wp_Chat_Rag::invalidate_cache();

		self::set_flash(
			array(
				'kind'    => 'chat',
				'success' => true,
				'message' => __( 'Training settings saved. The RAG cache has been refreshed.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat( 'training' );
	}

	public static function handle_save_chat_knowledge_base(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save knowledge base settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'flowbie_wp_save_chat_knowledge_base', 'flowbie_wp_chat_kb_nonce' );

		$knowledge_base = array();
		if ( isset( $_POST['flowbie_chat_kb'] ) && is_array( $_POST['flowbie_chat_kb'] ) ) {
			foreach ( $_POST['flowbie_chat_kb'] as $entry ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
				$q = isset( $entry['question'] ) ? sanitize_text_field( wp_unslash( $entry['question'] ) ) : '';
				$a = isset( $entry['answer'] ) ? sanitize_textarea_field( wp_unslash( $entry['answer'] ) ) : '';
				$p = isset( $entry['priority'] ) && $entry['priority'] === 'high' ? 'high' : 'normal';
				if ( $q !== '' || $a !== '' ) {
					$knowledge_base[] = array(
						'question' => $q,
						'answer'   => $a,
						'priority' => $p,
					);
				}
			}
		}

		Flowbie_Wp_Chat::save_settings(
			array(
				'knowledge_base' => $knowledge_base,
			)
		);

		Flowbie_Wp_Chat_Rag::invalidate_cache();

		self::set_flash(
			array(
				'kind'    => 'chat',
				'success' => true,
				'message' => __( 'Knowledge base saved. The RAG cache has been refreshed.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_chat( 'knowledge-base' );
	}

	public static function handle_save_comments(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save comment settings.', 'flowbie-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_COMMENTS, 'flowbie_wp_comments_nonce' );

		$enabled = ! empty( $_POST['flowbie_comments_enabled'] );
		Flowbie_Wp_Comments::save_settings(
			array(
				'enabled' => $enabled,
			)
		);

		self::set_flash(
			array(
				'kind'    => 'comments',
				'success' => true,
				'message' => $enabled
					? __( 'Comments enabled site-wide.', 'flowbie-wp' )
					: __( 'Comments disabled site-wide.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_settings( 'comments' );
	}

	public static function handle_save_gmb(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to save GMB credentials.', 'flowbie-wp' ) );
		}
		check_admin_referer( 'flowbie_wp_save_gmb', 'flowbie_wp_gmb_nonce' );

		$client_id     = isset( $_POST['flowbie_gmb_client_id'] ) ? sanitize_text_field( wp_unslash( $_POST['flowbie_gmb_client_id'] ) ) : '';
		$client_secret = isset( $_POST['flowbie_gmb_client_secret'] ) ? trim( (string) wp_unslash( $_POST['flowbie_gmb_client_secret'] ) ) : '';
		$location_id   = isset( $_POST['flowbie_gmb_location_id'] ) ? sanitize_text_field( wp_unslash( $_POST['flowbie_gmb_location_id'] ) ) : '';

		if ( $client_secret === '' ) {
			$client_secret = Flowbie_Wp_Gmb::get_client_secret();
		}

		if ( $client_id !== '' ) {
			Flowbie_Wp_Gmb::save_credentials( $client_id, $client_secret, $location_id );
		} elseif ( $location_id !== '' ) {
			Flowbie_Wp_Gmb::save_location_id( $location_id );
		}

		self::set_flash(
			array(
				'kind'    => 'gmb',
				'success' => true,
				'message' => __( 'GMB credentials saved.', 'flowbie-wp' ),
			)
		);
		self::redirect_to_settings( 'gmb' );
	}
}

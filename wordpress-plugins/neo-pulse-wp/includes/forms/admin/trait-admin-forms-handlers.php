<?php
/**
 * Forms admin POST handlers.
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Forms_Handlers {

	const ACTION_SAVE_FORM       = 'neo_pulse_wp_save_form';
	const ACTION_DELETE_FORM     = 'neo_pulse_wp_delete_form';
	const ACTION_DUPLICATE_FORM  = 'neo_pulse_wp_duplicate_form';
	const ACTION_BULK_FORMS      = 'neo_pulse_wp_bulk_forms';
	const ACTION_BULK_ENTRIES    = 'neo_pulse_wp_bulk_entries';
	const ACTION_EXPORT_ENTRIES       = 'neo_pulse_wp_export_form_entries';

	public static function register_forms_handlers(): void {
		add_action( 'admin_post_' . self::ACTION_SAVE_FORM, array( __CLASS__, 'handle_save_form' ) );
		add_action( 'admin_post_' . self::ACTION_DELETE_FORM, array( __CLASS__, 'handle_delete_form' ) );
		add_action( 'admin_post_' . self::ACTION_DUPLICATE_FORM, array( __CLASS__, 'handle_duplicate_form' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_FORMS, array( __CLASS__, 'handle_bulk_forms' ) );
		add_action( 'admin_post_' . self::ACTION_BULK_ENTRIES, array( __CLASS__, 'handle_bulk_entries' ) );
		add_action( 'admin_post_' . self::ACTION_EXPORT_ENTRIES, array( __CLASS__, 'handle_export_entries' ) );
	}

	public static function handle_save_form(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_SAVE_FORM, 'neo-pulse_forms_save_nonce' );

		$raw = isset( $_POST['form_json'] ) ? wp_unslash( (string) $_POST['form_json'] ) : '';
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Invalid form data.', 'neo-pulse-wp' ) ) );
			self::redirect_to_forms_edit( (int) ( $_POST['form_id'] ?? 0 ) );
		}

		if ( empty( $data['title'] ) ) {
			self::set_flash( array( 'success' => false, 'message' => __( 'Form title is required.', 'neo-pulse-wp' ) ) );
			self::redirect_to_forms_edit( (int) ( $data['ID'] ?? 0 ) );
		}

		$post_id = Neo_Pulse_Wp_Forms_Storage::save_form( $data );
		self::set_flash(
			array(
				'success' => $post_id > 0,
				'message' => $post_id > 0 ? __( 'Form saved.', 'neo-pulse-wp' ) : __( 'Could not save form.', 'neo-pulse-wp' ),
			)
		);
		self::redirect_to_forms_edit( $post_id );
	}

	public static function handle_delete_form(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_DELETE_FORM, 'neo-pulse_forms_nonce' );
		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		if ( $form_id > 0 ) {
			$form = Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id );
			if ( $form ) {
				$form['status'] = 'trash';
				$form['active'] = false;
				Neo_Pulse_Wp_Forms_Storage::save_form( $form );
			}
		}
		self::set_flash( array( 'success' => true, 'message' => __( 'Form moved to trash.', 'neo-pulse-wp' ) ) );
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms' ) );
		exit;
	}

	public static function handle_duplicate_form(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_DUPLICATE_FORM, 'neo-pulse_forms_nonce' );
		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		$copy    = $form_id > 0 ? Neo_Pulse_Wp_Forms_Storage::duplicate_form( $form_id ) : null;
		if ( $copy && ! empty( $copy['ID'] ) ) {
			self::set_flash( array( 'success' => true, 'message' => __( 'Form duplicated.', 'neo-pulse-wp' ) ) );
			self::redirect_to_forms_edit( (int) $copy['ID'] );
		}
		self::set_flash( array( 'success' => false, 'message' => __( 'Could not duplicate form.', 'neo-pulse-wp' ) ) );
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms' ) );
		exit;
	}

	public static function handle_bulk_forms(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_BULK_FORMS, 'neo-pulse_forms_bulk_nonce' );
		$action = isset( $_POST['action'] ) && $_POST['action'] !== '-1' ? sanitize_key( wp_unslash( (string) $_POST['action'] ) ) : '';
		if ( $action === '' && isset( $_POST['action2'] ) && $_POST['action2'] !== '-1' ) {
			$action = sanitize_key( wp_unslash( (string) $_POST['action2'] ) );
		}
		$ids = isset( $_POST['form_ids'] ) && is_array( $_POST['form_ids'] ) ? array_map( 'intval', $_POST['form_ids'] ) : array();
		foreach ( $ids as $id ) {
			if ( $action === 'trash' && $id > 0 ) {
				$form = Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $id );
				if ( $form ) {
					$form['status'] = 'trash';
					$form['active'] = false;
					Neo_Pulse_Wp_Forms_Storage::save_form( $form );
				}
			}
		}
		self::set_flash( array( 'success' => true, 'message' => __( 'Bulk action completed.', 'neo-pulse-wp' ) ) );
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms' ) );
		exit;
	}

	public static function handle_bulk_entries(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_BULK_ENTRIES, 'neo-pulse_forms_entries_bulk_nonce' );
		$form_id = isset( $_POST['form_id'] ) ? (int) $_POST['form_id'] : 0;
		$action  = isset( $_POST['action'] ) && $_POST['action'] !== '-1' ? sanitize_key( wp_unslash( (string) $_POST['action'] ) ) : '';
		if ( $action === '' && isset( $_POST['action2'] ) && $_POST['action2'] !== '-1' ) {
			$action = sanitize_key( wp_unslash( (string) $_POST['action2'] ) );
		}
		$ids = isset( $_POST['entry_ids'] ) && is_array( $_POST['entry_ids'] ) ? array_map( 'intval', $_POST['entry_ids'] ) : array();
		if ( $action === 'delete' ) {
			Neo_Pulse_Wp_Forms_Entries::delete_entries( $ids );
		} elseif ( $action === 'spam' ) {
			Neo_Pulse_Wp_Forms_Entries::update_status( $ids, 'spam' );
		}
		self::set_flash( array( 'success' => true, 'message' => __( 'Entries updated.', 'neo-pulse-wp' ) ) );
		wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms-entries&form_id=' . $form_id ) );
		exit;
	}

	public static function handle_export_entries(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'neo-pulse-wp' ) );
		}
		check_admin_referer( self::ACTION_EXPORT_ENTRIES, 'neo-pulse_forms_export_nonce' );
		$form_id = isset( $_GET['form_id'] ) ? (int) $_GET['form_id'] : 0;
		$form    = $form_id > 0 ? Neo_Pulse_Wp_Forms_Storage::get_form_by_id( $form_id ) : null;
		if ( ! $form ) {
			wp_die( esc_html__( 'Form not found.', 'neo-pulse-wp' ) );
		}
		$csv = Neo_Pulse_Wp_Forms_Entries::export_csv( $form_id, $form['fields'] ?? array() );
		$filename = 'neo-pulse-form-' . $form_id . '-entries-' . gmdate( 'Y-m-d' ) . '.csv';
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo $csv; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	private static function redirect_to_forms_edit( int $form_id ): void {
		if ( $form_id > 0 ) {
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms-edit&form_id=' . $form_id ) );
		} else {
			wp_safe_redirect( admin_url( 'admin.php?page=neo-pulse-wp-forms-edit' ) );
		}
		exit;
	}
}

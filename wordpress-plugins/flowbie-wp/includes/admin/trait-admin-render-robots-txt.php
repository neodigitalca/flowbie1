<?php
/**
 * robots.txt admin page.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Robots_Txt {

	public static function render_robots_txt_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage robots.txt.', 'flowbie-wp' ) );
		}

		$content = Flowbie_Wp_Robots_Txt::get_content();
		$content = $content !== '' ? $content : Flowbie_Wp_Robots_Txt::default_content();
		$form_id  = 'flowbie-wp-robots-txt-form';

		self::flowbie_group_shell_open( 'flowbie-wp-robots-txt', 'flowbie-wp-robots-txt flowbie-wp-panel-page', 'robots-txt' );
		?>
		<h1 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'robots.txt', 'flowbie-wp' ); ?></h1>

		<div class="flowbie-wp-panel-info-box">
			<strong><?php esc_html_e( 'Live URL:', 'flowbie-wp' ); ?></strong>
			<a href="<?php echo esc_url( Flowbie_Wp_Robots_Txt::preview_url() ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( Flowbie_Wp_Robots_Txt::preview_url() ); ?></a>
		</div>

		<?php if ( Flowbie_Wp_Robots_Txt::has_physical_file() ) : ?>
			<div class="notice notice-warning flowbie-wp-acf-shell-notice">
				<p><?php esc_html_e( 'A physical robots.txt file exists in the site root. It overrides Flowbie and WordPress virtual robots.txt output.', 'flowbie-wp' ); ?></p>
			</div>
		<?php endif; ?>

		<form id="<?php echo esc_attr( $form_id ); ?>" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-settings__form flowbie-schema-form">
			<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_ROBOTS_TXT ); ?>" />
			<?php wp_nonce_field( self::ACTION_SAVE_ROBOTS_TXT, 'flowbie_wp_robots_txt_nonce' ); ?>

			<?php
			self::panel_form_group_open();
			self::panel_form_field_textarea(
				'flowbie_robots_txt_content',
				'flowbie_robots_txt_content',
				__( 'Rules', 'flowbie-wp' ),
				$content,
				'full',
				18
			);
			self::panel_form_group_close();
			?>
		</form>

		<?php
		self::panel_footer_save(
			'editor',
			$form_id,
			self::ACTION_RESET_ROBOTS_TXT,
			self::ACTION_RESET_ROBOTS_TXT,
			'flowbie_wp_robots_txt_reset_nonce',
			'flowbie_robots_txt_tab'
		);
		self::flowbie_group_shell_close();
	}
}

<?php
/**
 * Flowbie WP Analytics admin page (tabbed GSC panel).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Analytics {

	public static function render_analytics_page(): void {
		if ( ! current_user_can( self::required_capability() ) ) {
			return;
		}

		$tab         = self::panel_active_tab( 'overview' );
		$dashboard   = admin_url( 'admin.php?page=flowbie-wp' );
		$overview    = null;
		$error       = null;
		$result      = Flowbie_Wp_Gsc::fetch_analytics_overview();
		if ( is_wp_error( $result ) ) {
			$error = $result;
		} else {
			$overview = $result;
		}

		$nav_groups = array(
			array(
				'heading' => __( 'Search Console', 'flowbie-wp' ),
				'tabs'    => array(
					'overview'   => __( 'Overview', 'flowbie-wp' ),
					'queries'    => __( 'Top Queries', 'flowbie-wp' ),
					'pages'      => __( 'Top Pages', 'flowbie-wp' ),
					'connection' => __( 'Connection', 'flowbie-wp' ),
				),
			),
		);
		self::flowbie_group_shell_open( 'flowbie-wp-analytics', 'flowbie-wp-analytics flowbie-wp-panel-page' );

		self::panel_layout_start( 'flowbie-wp-analytics', $nav_groups, $tab, __( 'Analytics sections', 'flowbie-wp' ) );
		if ( $error && in_array( $tab, array( 'overview', 'queries', 'pages' ), true ) ) {
			self::render_analytics_error( $error );
		} elseif ( 'connection' === $tab ) {
			self::render_analytics_section_connection();
		} elseif ( 'queries' === $tab && is_array( $overview ) ) {
			self::render_analytics_tab_queries( $overview, $tab );
		} elseif ( 'pages' === $tab && is_array( $overview ) ) {
			self::render_analytics_tab_pages( $overview, $tab );
		} elseif ( is_array( $overview ) ) {
			self::render_analytics_tab_overview( $overview, $tab );
		} elseif ( $error ) {
			self::render_analytics_error( $error );
		}
		self::panel_layout_end();

		self::flowbie_group_shell_close();
	}

	/**
	 * @param WP_Error $error Error.
	 */
	private static function render_analytics_error( WP_Error $error ): void {
		$settings_url = admin_url( 'admin.php?page=flowbie-wp-settings&tab=gsc' );
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Overview', 'flowbie-wp' ); ?></h2>
		<div class="flowbie-wp-panel-info-box" role="alert">
			<p><?php echo esc_html( $error->get_error_message() ); ?></p>
			<p>
				<a href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Check GSC connection in Settings', 'flowbie-wp' ); ?></a>
			</p>
		</div>
		<?php
	}

	/**
	 * @param array<string,mixed> $overview Overview data.
	 */
	private static function render_analytics_tab_overview( array $overview, string $tab ): void {
		$date_label = ! empty( $overview['dateRange']['label'] ) ? (string) $overview['dateRange']['label'] : '';
		$date_start = ! empty( $overview['dateRange']['start'] ) ? (string) $overview['dateRange']['start'] : '';
		$date_end   = ! empty( $overview['dateRange']['end'] ) ? (string) $overview['dateRange']['end'] : '';
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Overview', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc">
			<?php
			if ( $date_label !== '' ) {
				echo esc_html(
					sprintf(
						/* translators: 1: range label, 2: start date, 3: end date */
						__( '%1$s (%2$s – %3$s)', 'flowbie-wp' ),
						$date_label,
						$date_start,
						$date_end
					)
				);
			} else {
				esc_html_e( 'Summary metrics from Google Search Console.', 'flowbie-wp' );
			}
			?>
		</p>

		<?php if ( $date_label !== '' ) : ?>
			<div class="flowbie-wp-panel-info-box">
				<strong><?php esc_html_e( 'Date range:', 'flowbie-wp' ); ?></strong>
				<?php echo esc_html( $date_label . ' (' . $date_start . ' – ' . $date_end . ')' ); ?>
			</div>
		<?php endif; ?>

		<?php self::render_analytics_summary_section( $overview ); ?>
		<?php self::panel_footer_actions(
			$tab,
			'flowbie_analytics_tab',
			array(
				array(
					'action'       => self::ACTION_REFRESH_ANALYTICS,
					'nonce_action' => self::ACTION_REFRESH_ANALYTICS,
					'nonce_field'  => 'flowbie_wp_analytics_refresh_nonce',
					'label'        => __( 'Refresh data', 'flowbie-wp' ),
					'button_class' => '',
				),
			)
		); ?>
		<?php
	}

	/**
	 * @param array<string,mixed> $overview Overview data.
	 */
	private static function render_analytics_tab_queries( array $overview, string $tab ): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Top Queries', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'Search queries driving traffic to this site.', 'flowbie-wp' ); ?></p>
		<?php self::render_analytics_queries_section( $overview ); ?>
		<?php
		self::panel_footer_actions(
			$tab,
			'flowbie_analytics_tab',
			array(
				array(
					'action'       => self::ACTION_REFRESH_ANALYTICS,
					'nonce_action' => self::ACTION_REFRESH_ANALYTICS,
					'nonce_field'  => 'flowbie_wp_analytics_refresh_nonce',
					'label'        => __( 'Refresh data', 'flowbie-wp' ),
					'button_class' => '',
				),
			)
		);
	}

	/**
	 * @param array<string,mixed> $overview Overview data.
	 */
	private static function render_analytics_tab_pages( array $overview, string $tab ): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Top Pages', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'URLs receiving the most search traffic.', 'flowbie-wp' ); ?></p>
		<?php self::render_analytics_pages_section( $overview ); ?>
		<?php
		self::panel_footer_actions(
			$tab,
			'flowbie_analytics_tab',
			array(
				array(
					'action'       => self::ACTION_REFRESH_ANALYTICS,
					'nonce_action' => self::ACTION_REFRESH_ANALYTICS,
					'nonce_field'  => 'flowbie_wp_analytics_refresh_nonce',
					'label'        => __( 'Refresh data', 'flowbie-wp' ),
					'button_class' => '',
				),
			)
		);
	}

	private static function render_analytics_section_connection(): void {
		?>
		<h2 class="flowbie-wp-panel-content__title"><?php esc_html_e( 'Connection', 'flowbie-wp' ); ?></h2>
		<p class="flowbie-wp-panel-content__desc"><?php esc_html_e( 'Google Search Console service account status for this site.', 'flowbie-wp' ); ?></p>
		<?php self::render_gsc_connection_panel(); ?>
		<?php
	}

	/**
	 * @param array<string,mixed> $overview
	 */
	private static function render_analytics_summary_section( array $overview ): void {
		$summary = isset( $overview['summary'] ) && is_array( $overview['summary'] ) ? $overview['summary'] : array();
		$clicks  = isset( $summary['clicks'] ) ? (int) $summary['clicks'] : 0;
		$impr    = isset( $summary['impressions'] ) ? (int) $summary['impressions'] : 0;
		$kw      = isset( $overview['keywordCount'] ) ? (int) $overview['keywordCount'] : 0;
		$pos     = isset( $summary['avgPosition'] ) ? (float) $summary['avgPosition'] : 0.0;
		?>
		<section class="flowbie-wp-analytics__section flowbie-wp-analytics__section--metrics">
			<h2 class="flowbie-wp-analytics__section-title screen-reader-text"><?php esc_html_e( 'Summary metrics', 'flowbie-wp' ); ?></h2>
			<div class="flowbie-wp-analytics__metrics">
				<div class="flowbie-wp-analytics__metric">
					<span class="flowbie-wp-analytics__metric-value"><?php echo esc_html( number_format_i18n( $clicks ) ); ?></span>
					<span class="flowbie-wp-analytics__metric-label"><?php esc_html_e( 'Search traffic', 'flowbie-wp' ); ?></span>
				</div>
				<div class="flowbie-wp-analytics__metric">
					<span class="flowbie-wp-analytics__metric-value"><?php echo esc_html( number_format_i18n( $impr ) ); ?></span>
					<span class="flowbie-wp-analytics__metric-label"><?php esc_html_e( 'Impressions', 'flowbie-wp' ); ?></span>
				</div>
				<div class="flowbie-wp-analytics__metric">
					<span class="flowbie-wp-analytics__metric-value"><?php echo esc_html( number_format_i18n( $kw ) ); ?></span>
					<span class="flowbie-wp-analytics__metric-label"><?php esc_html_e( 'Keywords', 'flowbie-wp' ); ?></span>
				</div>
				<div class="flowbie-wp-analytics__metric">
					<span class="flowbie-wp-analytics__metric-value"><?php echo esc_html( number_format_i18n( $pos, 1 ) ); ?></span>
					<span class="flowbie-wp-analytics__metric-label"><?php esc_html_e( 'Avg position', 'flowbie-wp' ); ?></span>
				</div>
			</div>
		</section>
		<?php
	}

	/**
	 * @param array<string,mixed> $overview
	 */
	private static function render_analytics_queries_section( array $overview ): void {
		$rows = isset( $overview['topQueries'] ) && is_array( $overview['topQueries'] ) ? $overview['topQueries'] : array();
		?>
		<section class="flowbie-wp-analytics__section flowbie-wp-analytics__section--table">
			<?php if ( empty( $rows ) ) : ?>
				<p class="flowbie-wp-analytics__empty"><?php esc_html_e( 'No query data for this period.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<table class="flowbie-wp-analytics__table">
					<thead>
						<tr>
							<th scope="col"><?php esc_html_e( 'Keyword', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Clicks', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Impressions', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Position', 'flowbie-wp' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $rows as $row ) : ?>
							<tr>
								<td><?php echo esc_html( isset( $row['query'] ) ? (string) $row['query'] : '' ); ?></td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['clicks'] ) ? (int) $row['clicks'] : 0 ) ); ?></td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['impressions'] ) ? (int) $row['impressions'] : 0 ) ); ?></td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['position'] ) ? (float) $row['position'] : 0, 1 ) ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</section>
		<?php
	}

	/**
	 * @param array<string,mixed> $overview
	 */
	private static function render_analytics_pages_section( array $overview ): void {
		$rows = isset( $overview['topPages'] ) && is_array( $overview['topPages'] ) ? $overview['topPages'] : array();
		?>
		<section class="flowbie-wp-analytics__section flowbie-wp-analytics__section--table">
			<?php if ( empty( $rows ) ) : ?>
				<p class="flowbie-wp-analytics__empty"><?php esc_html_e( 'No page data for this period.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<table class="flowbie-wp-analytics__table">
					<thead>
						<tr>
							<th scope="col"><?php esc_html_e( 'URL', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Clicks', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Impressions', 'flowbie-wp' ); ?></th>
							<th scope="col"><?php esc_html_e( 'Position', 'flowbie-wp' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $rows as $row ) : ?>
							<tr>
								<td class="flowbie-wp-analytics__url">
									<a href="<?php echo esc_url( isset( $row['page'] ) ? (string) $row['page'] : '' ); ?>" target="_blank" rel="noopener noreferrer">
										<?php echo esc_html( isset( $row['page'] ) ? (string) $row['page'] : '' ); ?>
									</a>
								</td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['clicks'] ) ? (int) $row['clicks'] : 0 ) ); ?></td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['impressions'] ) ? (int) $row['impressions'] : 0 ) ); ?></td>
								<td><?php echo esc_html( number_format_i18n( isset( $row['position'] ) ? (float) $row['position'] : 0, 1 ) ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</section>
		<?php
	}
}

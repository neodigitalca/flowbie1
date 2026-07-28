<?php
/**
 * Overseer admin pages.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Overseer {

	public static function render_overseer_page(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/admin/class-flowbie-wp-overseer-list-table.php';
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Overseer.', 'flowbie-wp' ) );
		}

		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : 'list';
		switch ( $action ) {
			case 'import-export':
				self::render_overseer_import_export_page();
				return;
			case 'settings':
				self::render_overseer_settings_page();
				return;
			case 'session':
				self::render_overseer_session_page();
				return;
			case 'analysis':
				self::render_overseer_analysis_page();
				return;
			case 'reports':
				self::render_overseer_reports_page();
				return;
			case 'view-report':
				self::render_overseer_view_report_page();
				return;
			case 'tasks':
				self::render_overseer_tasks_page();
				return;
			case 'metrics':
				self::render_overseer_metrics_page();
				return;
			case 'conversions':
				self::render_overseer_conversions_page();
				return;
			default:
				self::render_overseer_list_page();
		}
	}

	/**
	 * @return array<int, array{slug: string, label: string, url: string}>
	 */
	public static function get_overseer_subnav_items(): array {
		return array(
			array(
				'slug'  => 'metrics',
				'label' => __( 'Dashboard', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=metrics' ),
			),
			array(
				'slug'  => 'list',
				'label' => __( 'Events', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer' ),
			),
			array(
				'slug'  => 'conversions',
				'label' => __( 'Conversions', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=conversions' ),
			),
			array(
				'slug'  => 'analysis',
				'label' => __( 'AI Analysis', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=analysis' ),
			),
			array(
				'slug'  => 'reports',
				'label' => __( 'Reports', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=reports' ),
			),
			array(
				'slug'  => 'tasks',
				'label' => __( 'Tasks', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=tasks' ),
			),
			array(
				'slug'  => 'export',
				'label' => __( 'Export', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=import-export' ),
			),
			array(
				'slug'  => 'settings',
				'label' => __( 'Settings', 'flowbie-wp' ),
				'url'   => admin_url( 'admin.php?page=flowbie-wp-overseer&action=settings' ),
			),
		);
	}

	private static function render_overseer_page_shell_open( string $header_active = '' ): void {
		self::flowbie_group_shell_open( 'flowbie-wp-overseer', 'flowbie-wp-overseer flowbie-wp-overseer-app' );
		self::render_overseer_shell_header( $header_active );
		echo '<div class="flowbie-wp-overseer__body">';
	}

	/**
	 * Secondary Overseer section tabs (below the Flowbie AI Tools group header).
	 *
	 * @param string $active Active section slug; empty uses current request action.
	 */
	private static function render_overseer_shell_header( string $active = '' ): void {
		if ( $active === '' ) {
			$active = self::flowbie_overseer_active_section();
		}
		?>
		<nav class="flowbie-wp-overseer__shell-header" aria-label="<?php esc_attr_e( 'Overseer sections', 'flowbie-wp' ); ?>">
			<div class="flowbie-wp-overseer__shell-nav">
				<?php foreach ( self::get_overseer_subnav_items() as $item ) : ?>
					<a
						class="flowbie-wp-overseer__nav-item<?php echo $active === $item['slug'] ? ' is-active' : ''; ?>"
						href="<?php echo esc_url( $item['url'] ); ?>"
					><?php echo esc_html( $item['label'] ); ?></a>
				<?php endforeach; ?>
			</div>
		</nav>
		<?php
	}

	private static function render_overseer_page_shell_close(): void {
		echo '</div>';
		self::flowbie_group_shell_close();
	}

	private static function render_overseer_list_page(): void {
		$list_table = new Flowbie_Wp_Overseer_List_Table();
		$list_table->prepare_items();
		$flash      = self::get_and_clear_flash();
		$session    = isset( $_GET['session_id'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['session_id'] ) ) : '';
		$date_from  = isset( $_GET['date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_from'] ) ) : '';
		$date_to    = isset( $_GET['date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_to'] ) ) : '';
		$total      = Flowbie_Wp_Overseer::count_visits();
		$settings   = Flowbie_Wp_Overseer::get_settings();
		$builtin_id = Flowbie_Wp_Overseer::get_builtin_script_id();
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Events', 'flowbie-wp' ); ?></h1>
			<?php if ( $builtin_id > 0 ) : ?>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager&action=edit&id=' . $builtin_id ) ); ?>" class="page-title-action"><?php esc_html_e( 'Page View Tag', 'flowbie-wp' ); ?></a>
			<?php endif; ?>
			</div>
			<hr class="wp-header-end" />

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<p class="description flowbie-wp-overseer__note">
				<?php
				$tracking_label = ! empty( $settings['tracking_enabled'] )
					? __( 'enabled', 'flowbie-wp' )
					: __( 'disabled', 'flowbie-wp' );
				printf(
					/* translators: 1: total events, 2: tracking on/off */
					esc_html__( 'First-party analytics: pageviews, time on page, scroll depth, and key interactions. Total events: %1$d. Tracking is %2$s.', 'flowbie-wp' ),
					(int) $total,
					esc_html( $tracking_label )
				);
				?>
			</p>

			<?php if ( ! empty( $settings['exclude_admins'] ) ) : ?>
				<div class="notice notice-info inline">
					<p><?php esc_html_e( 'Administrator visits are not recorded while you are logged in. Test in a private window or turn off “exclude admins” in Settings.', 'flowbie-wp' ); ?></p>
				</div>
			<?php endif; ?>

			<div class="flowbie-wp-overseer__list-tools">
				<form method="get" class="flowbie-wp-overseer__filter-form">
					<input type="hidden" name="page" value="flowbie-wp-overseer" />
					<label for="flowbie-overseer-session" class="screen-reader-text"><?php esc_html_e( 'Session', 'flowbie-wp' ); ?></label>
					<input type="search" id="flowbie-overseer-session" name="session_id" value="<?php echo esc_attr( $session ); ?>" placeholder="<?php esc_attr_e( 'Session ID', 'flowbie-wp' ); ?>" />
					<label for="flowbie-overseer-date-from" class="screen-reader-text"><?php esc_html_e( 'From', 'flowbie-wp' ); ?></label>
					<input type="date" id="flowbie-overseer-date-from" name="date_from" value="<?php echo esc_attr( $date_from ); ?>" aria-label="<?php esc_attr_e( 'From', 'flowbie-wp' ); ?>" />
					<label for="flowbie-overseer-date-to" class="screen-reader-text"><?php esc_html_e( 'To', 'flowbie-wp' ); ?></label>
					<input type="date" id="flowbie-overseer-date-to" name="date_to" value="<?php echo esc_attr( $date_to ); ?>" aria-label="<?php esc_attr_e( 'To', 'flowbie-wp' ); ?>" />
					<label for="flowbie-overseer-search" class="screen-reader-text"><?php esc_html_e( 'Search', 'flowbie-wp' ); ?></label>
					<input type="search" id="flowbie-overseer-search" name="s" value="<?php echo isset( $_GET['s'] ) ? esc_attr( sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) ) : ''; ?>" placeholder="<?php esc_attr_e( 'URL, title, IP, session…', 'flowbie-wp' ); ?>" />
					<input type="submit" class="button" value="<?php esc_attr_e( 'Filter', 'flowbie-wp' ); ?>" />
					<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer' ) ); ?>"><?php esc_html_e( 'Reset', 'flowbie-wp' ); ?></a>
				</form>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-overseer__list-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_BULK_OVERSEER_VISITS ); ?>" />
					<?php
					if ( $session !== '' ) {
						echo '<input type="hidden" name="session_id" value="' . esc_attr( $session ) . '" />';
					}
					if ( $date_from !== '' ) {
						echo '<input type="hidden" name="date_from" value="' . esc_attr( $date_from ) . '" />';
					}
					if ( $date_to !== '' ) {
						echo '<input type="hidden" name="date_to" value="' . esc_attr( $date_to ) . '" />';
					}
					if ( isset( $_GET['s'] ) && (string) $_GET['s'] !== '' ) {
						echo '<input type="hidden" name="s" value="' . esc_attr( sanitize_text_field( wp_unslash( (string) $_GET['s'] ) ) ) . '" />';
					}
					?>
					<?php $list_table->display(); ?>
				</form>
			</div>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_session_page(): void {
		$session_id = isset( $_GET['session_id'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['session_id'] ) ) : '';
		$flash      = self::get_and_clear_flash();
		$summary    = Flowbie_Wp_Overseer::get_session_summary( $session_id );
		$timeline   = Flowbie_Wp_Overseer::get_session_timeline( $session_id );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Session Timeline', 'flowbie-wp' ); ?></h1>
			</div>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer' ) ); ?>">&larr; <?php esc_html_e( 'Back to events', 'flowbie-wp' ); ?></a></p>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( ! $summary ) : ?>
				<p><?php esc_html_e( 'Session not found.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<div class="flowbie-wp-overseer__panel">
					<p>
						<strong><?php esc_html_e( 'Session', 'flowbie-wp' ); ?>:</strong> <code><?php echo esc_html( $session_id ); ?></code><br />
						<strong><?php esc_html_e( 'Device', 'flowbie-wp' ); ?>:</strong> <?php echo esc_html( (string) $summary->device ); ?>
						<?php if ( ! empty( $summary->ip_address ) ) : ?>
							· <strong><?php esc_html_e( 'IP', 'flowbie-wp' ); ?>:</strong> <?php echo esc_html( (string) $summary->ip_address ); ?>
						<?php endif; ?>
						<br />
						<strong><?php esc_html_e( 'Events', 'flowbie-wp' ); ?>:</strong> <?php echo (int) $summary->event_count; ?>
						· <strong><?php esc_html_e( 'Pageviews', 'flowbie-wp' ); ?>:</strong> <?php echo (int) $summary->pageviews; ?>
						<?php if ( ! empty( $summary->is_bounce ) ) : ?>
							· <strong><?php esc_html_e( 'Bounce', 'flowbie-wp' ); ?>:</strong> <?php esc_html_e( 'yes', 'flowbie-wp' ); ?>
						<?php endif; ?>
						<br />
						<strong><?php esc_html_e( 'Session duration', 'flowbie-wp' ); ?>:</strong> <?php echo (int) $summary->total_duration_sec; ?>s
						· <strong><?php esc_html_e( 'Active time', 'flowbie-wp' ); ?>:</strong> <?php echo (int) $summary->active_duration_sec; ?>s
						<?php if ( ! empty( $summary->avg_time_per_page_sec ) ) : ?>
							· <strong><?php esc_html_e( 'Avg per page', 'flowbie-wp' ); ?>:</strong> <?php echo (int) $summary->avg_time_per_page_sec; ?>s
						<?php endif; ?>
					</p>
				</div>

				<ol class="flowbie-wp-overseer__timeline">
					<?php foreach ( $timeline as $event ) : ?>
						<?php self::render_timeline_event( $event ); ?>
					<?php endforeach; ?>
				</ol>
			<?php endif; ?>
		<?php
		self::render_overseer_page_shell_close();
	}

	/**
	 * @param object $event Event row.
	 */
	private static function render_timeline_event( $event ): void {
		$type = isset( $event->event_type ) ? (string) $event->event_type : 'pageview';
		$url  = isset( $event->page_url ) ? (string) $event->page_url : '';
		$title = isset( $event->page_title ) ? (string) $event->page_title : '';
		$when = isset( $event->created_at ) ? (string) $event->created_at : '';
		?>
		<li class="flowbie-wp-overseer__timeline-item flowbie-wp-overseer__timeline-item--<?php echo esc_attr( sanitize_html_class( $type ) ); ?>">
			<div class="flowbie-wp-overseer__timeline-meta"><?php echo esc_html( $when ); ?> · <?php echo esc_html( $type ); ?></div>
			<?php if ( in_array( $type, array( 'page_exit', 'page_heartbeat' ), true ) ) : ?>
				<?php
				$sec        = isset( $event->duration_ms ) ? (int) round( (int) $event->duration_ms / 1000 ) : 0;
				$active_sec = isset( $event->active_duration_ms ) ? (int) round( (int) $event->active_duration_ms / 1000 ) : 0;
				$scroll     = isset( $event->scroll_depth_pct ) ? (int) $event->scroll_depth_pct : 0;
				$label      = 'page_heartbeat' === $type ? __( 'Heartbeat', 'flowbie-wp' ) : __( 'Left', 'flowbie-wp' );
				?>
				<div><?php echo esc_html( sprintf( __( '%1$s %2$s — %3$ds on page (%4$ds active, %5$d%% scroll)', 'flowbie-wp' ), $label, Flowbie_Wp_Overseer::normalize_path_url( $url ), $sec, $active_sec, $scroll ) ); ?></div>
			<?php elseif ( 'conversion' === $type ) : ?>
				<div>
					<?php echo esc_html( (string) ( $event->element_text ?? __( 'Conversion', 'flowbie-wp' ) ) ); ?>
					<?php
					$signals = self::parse_conversion_client_meta( $event );
					if ( $signals !== '' ) :
						?>
						— <?php echo esc_html( $signals ); ?>
					<?php endif; ?>
				</div>
			<?php elseif ( in_array( $type, array( 'click', 'outbound_click', 'form_submit' ), true ) ) : ?>
				<div>
					<?php echo esc_html( $title !== '' ? $title : Flowbie_Wp_Overseer::normalize_path_url( $url ) ); ?>
					<?php if ( ! empty( $event->element_text ) ) : ?>
						— <?php echo esc_html( (string) $event->element_text ); ?>
					<?php endif; ?>
					<?php if ( ! empty( $event->element_href ) ) : ?>
						→ <?php echo esc_html( (string) $event->element_href ); ?>
					<?php endif; ?>
				</div>
			<?php else : ?>
				<div>
					<a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $title !== '' ? $title : $url ); ?></a>
				</div>
			<?php endif; ?>
		</li>
		<?php
	}

	/**
	 * @param object $event Event row.
	 * @return string
	 */
	private static function parse_conversion_client_meta( $event ): string {
		$raw = isset( $event->client_meta ) ? (string) $event->client_meta : '';
		if ( $raw === '' ) {
			return '';
		}
		$meta = json_decode( $raw, true );
		if ( ! is_array( $meta ) || empty( $meta['field_signals'] ) || ! is_array( $meta['field_signals'] ) ) {
			return '';
		}
		return Flowbie_Wp_Overseer_Conversions::format_field_signals( $meta['field_signals'] );
	}

	private static function render_overseer_conversions_page(): void {
		$flash       = self::get_and_clear_flash();
		$edit_id     = isset( $_GET['edit'] ) ? sanitize_key( wp_unslash( (string) $_GET['edit'] ) ) : '';
		$picker_form = isset( $_GET['form_id'] ) ? absint( $_GET['form_id'] ) : 0;
		$picker_trigger = isset( $_GET['trigger_type'] ) ? sanitize_key( wp_unslash( (string) $_GET['trigger_type'] ) ) : '';
		$editing     = ( $edit_id !== '' && 'new' !== $edit_id ) ? Flowbie_Wp_Overseer_Conversions::get_goal( $edit_id ) : null;
		$goals       = Flowbie_Wp_Overseer_Conversions::get_goals();
		$forms       = class_exists( 'Flowbie_Wp_Forms_Storage' ) ? Flowbie_Wp_Forms_Storage::get_all_forms( true ) : array();
		$date_to     = gmdate( 'Y-m-d' );
		$date_from   = gmdate( 'Y-m-d', strtotime( '-30 days' ) );

		$form_for_fields = null;
		$selected_form_id = 0;
		if ( $editing ) {
			$selected_form_id = (int) ( $editing['form_id'] ?? 0 );
		} elseif ( $picker_form > 0 ) {
			$selected_form_id = $picker_form;
		}
		if ( $selected_form_id > 0 && class_exists( 'Flowbie_Wp_Forms_Storage' ) ) {
			$form_for_fields = Flowbie_Wp_Forms_Storage::get_form_by_id( $selected_form_id );
		}

		$selected_types = array();
		$selected_field_ids = array();
		$interaction_values = array(
			'page_url_contains' => '',
			'text_contains'     => '',
			'href_contains'     => '',
		);
		$selected_trigger = 'form_success';
		if ( $editing ) {
			$selected_trigger = Flowbie_Wp_Overseer_Conversions::get_trigger_type( $editing );
		} elseif ( $picker_trigger !== '' && array_key_exists( $picker_trigger, Flowbie_Wp_Overseer_Conversions::TRIGGER_TYPES ) ) {
			$selected_trigger = $picker_trigger;
		}
		if ( $editing && ! empty( $editing['rules'] ) && is_array( $editing['rules'] ) ) {
			foreach ( $editing['rules'] as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}
				if ( 'field_type' === ( $rule['type'] ?? '' ) ) {
					$selected_types[] = (string) ( $rule['value'] ?? '' );
				}
				if ( 'field_id' === ( $rule['type'] ?? '' ) ) {
					$selected_field_ids[] = (string) ( $rule['value'] ?? '' );
				}
				$rule_type = isset( $rule['type'] ) ? sanitize_key( (string) $rule['type'] ) : '';
				if ( isset( $interaction_values[ $rule_type ] ) ) {
					$interaction_values[ $rule_type ] = (string) ( $rule['value'] ?? '' );
				}
			}
		}

		$conversions_url = admin_url( 'admin.php?page=flowbie-wp-overseer&action=conversions' );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
				<h1><?php esc_html_e( 'Conversions', 'flowbie-wp' ); ?></h1>
				<?php if ( ! $editing && $edit_id === '' ) : ?>
					<a class="page-title-action" href="<?php echo esc_url( add_query_arg( 'edit', 'new', $conversions_url ) ); ?>"><?php esc_html_e( 'Add goal', 'flowbie-wp' ); ?></a>
				<?php endif; ?>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<p class="description flowbie-wp-overseer__note">
				<?php esc_html_e( 'Choose what counts as a conversion, then configure field signals (email, phone, etc.) for successful form submissions, or URL/text filters for clicks and form attempts. Values are never stored—only which field types were present.', 'flowbie-wp' ); ?>
			</p>

			<?php if ( $edit_id !== '' ) : ?>
				<div class="flowbie-wp-overseer__panel flowbie-wp-overseer__panel--nested">
					<h2><?php echo $editing ? esc_html__( 'Edit conversion goal', 'flowbie-wp' ) : esc_html__( 'Add conversion goal', 'flowbie-wp' ); ?></h2>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="flowbie-conversion-goal-form">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_OVERSEER_CONVERSION ); ?>" />
						<?php wp_nonce_field( self::ACTION_SAVE_OVERSEER_CONVERSION, 'flowbie_wp_overseer_conversion_nonce' ); ?>
						<?php if ( $editing ) : ?>
							<input type="hidden" name="goal_id" value="<?php echo esc_attr( (string) $editing['id'] ); ?>" />
						<?php endif; ?>
						<table class="form-table" role="presentation">
							<tr>
								<th scope="row"><label for="goal_name"><?php esc_html_e( 'Goal name', 'flowbie-wp' ); ?></label></th>
								<td><input name="goal_name" id="goal_name" type="text" class="regular-text" required value="<?php echo esc_attr( $editing ? (string) $editing['name'] : '' ); ?>" /></td>
							</tr>
							<tr>
								<th scope="row"><label for="trigger_type"><?php esc_html_e( 'Conversion trigger', 'flowbie-wp' ); ?></label></th>
								<td>
									<select name="trigger_type" id="trigger_type">
										<?php foreach ( Flowbie_Wp_Overseer_Conversions::TRIGGER_TYPES as $trigger_slug => $trigger_label ) : ?>
											<option value="<?php echo esc_attr( $trigger_slug ); ?>" <?php selected( $selected_trigger, $trigger_slug ); ?>>
												<?php echo esc_html( (string) $trigger_label ); ?>
											</option>
										<?php endforeach; ?>
									</select>
									<p class="description"><?php esc_html_e( 'Pick the event type first, then configure the matching rules below.', 'flowbie-wp' ); ?></p>
								</td>
							</tr>
						</table>

						<div class="flowbie-conversion-panel flowbie-conversion-panel--form" data-trigger-panel="form_success">
							<h3><?php esc_html_e( 'Form & field signals', 'flowbie-wp' ); ?></h3>
							<p class="description"><?php esc_html_e( 'Counts only after a validated Flowbie Forms submission succeeds. Select field types to require (leave all unchecked to count any successful submit).', 'flowbie-wp' ); ?></p>
							<table class="form-table" role="presentation">
							<tr>
								<th scope="row"><?php esc_html_e( 'Form', 'flowbie-wp' ); ?></th>
								<td>
									<select name="form_id" id="form_id" data-form-required="1" onchange="window.location.href=this.options[this.selectedIndex].dataset.url;">
										<option value=""><?php esc_html_e( '— Select form —', 'flowbie-wp' ); ?></option>
										<?php foreach ( $forms as $form ) : ?>
											<?php
											$fid = (int) ( $form['ID'] ?? 0 );
											$pick_url = add_query_arg(
												array(
													'edit'         => $edit_id !== '' ? $edit_id : 'new',
													'form_id'      => $fid,
													'trigger_type' => $selected_trigger,
												),
												$conversions_url
											);
											?>
											<option value="<?php echo esc_attr( (string) $fid ); ?>" data-url="<?php echo esc_url( $pick_url ); ?>" <?php selected( $selected_form_id, $fid ); ?>>
												<?php echo esc_html( (string) ( $form['title'] ?? __( 'Untitled', 'flowbie-wp' ) ) ); ?>
											</option>
										<?php endforeach; ?>
									</select>
									<?php if ( empty( $forms ) ) : ?>
										<p class="description">
											<?php esc_html_e( 'No active forms found. Create one under Flowbie → Forms.', 'flowbie-wp' ); ?>
											<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-forms' ) ); ?>"><?php esc_html_e( 'Open Forms', 'flowbie-wp' ); ?></a>
										</p>
									<?php endif; ?>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'Field types', 'flowbie-wp' ); ?></th>
								<td>
									<?php foreach ( Flowbie_Wp_Overseer_Conversions::QUICK_FIELD_TYPES as $ftype ) : ?>
										<?php
										$label = $ftype;
										if ( class_exists( 'Flowbie_Wp_Forms_Field_Registry' ) ) {
											$choices = Flowbie_Wp_Forms_Field_Registry::choices();
											if ( isset( $choices[ $ftype ] ) ) {
												$label = (string) $choices[ $ftype ];
											}
										}
										?>
										<label style="display:inline-block;margin-right:12px;margin-bottom:6px;">
											<input type="checkbox" name="rules_field_type[]" value="<?php echo esc_attr( $ftype ); ?>" <?php checked( in_array( $ftype, $selected_types, true ) ); ?> />
											<?php echo esc_html( $label ); ?>
										</label>
									<?php endforeach; ?>
								</td>
							</tr>
							<?php if ( $form_for_fields && ! empty( $form_for_fields['fields'] ) && is_array( $form_for_fields['fields'] ) ) : ?>
								<tr>
									<th scope="row"><?php esc_html_e( 'Specific fields', 'flowbie-wp' ); ?></th>
									<td>
										<?php foreach ( $form_for_fields['fields'] as $field ) : ?>
											<?php
											if ( ! is_array( $field ) ) {
												continue;
											}
											$field_id = (string) ( $field['id'] ?? '' );
											$ftype    = (string) ( $field['type'] ?? '' );
											if ( $field_id === '' || ( class_exists( 'Flowbie_Wp_Forms_Field_Registry' ) && in_array( $ftype, Flowbie_Wp_Forms_Field_Registry::display_only_types(), true ) ) ) {
												continue;
											}
											$flabel = (string) ( $field['label'] ?? $field_id );
											?>
											<label style="display:block;margin-bottom:4px;">
												<input type="checkbox" name="rules_field_id[]" value="<?php echo esc_attr( $field_id ); ?>" <?php checked( in_array( $field_id, $selected_field_ids, true ) ); ?> />
												<?php echo esc_html( $flabel ); ?> <span class="description">(<?php echo esc_html( $ftype ); ?>)</span>
											</label>
										<?php endforeach; ?>
									</td>
								</tr>
							<?php endif; ?>
							</table>
						</div>

						<div class="flowbie-conversion-panel flowbie-conversion-panel--interaction" data-trigger-panel="interaction">
							<h3><?php esc_html_e( 'Interaction filters', 'flowbie-wp' ); ?></h3>
							<p class="description"><?php esc_html_e( 'Use page URL and/or link URL filters to narrow matches. Element text is optional.', 'flowbie-wp' ); ?></p>
							<table class="form-table" role="presentation">
								<tr>
									<th scope="row"><label for="rules_page_url"><?php esc_html_e( 'Page URL contains', 'flowbie-wp' ); ?></label></th>
									<td><input name="rules_page_url" id="rules_page_url" type="text" class="regular-text" value="<?php echo esc_attr( $interaction_values['page_url_contains'] ); ?>" placeholder="/contact" /></td>
								</tr>
								<tr>
									<th scope="row"><label for="rules_text"><?php esc_html_e( 'Element text contains', 'flowbie-wp' ); ?> <span class="description"><?php esc_html_e( '(optional)', 'flowbie-wp' ); ?></span></label></th>
									<td>
										<input name="rules_text" id="rules_text" type="text" class="regular-text" value="<?php echo esc_attr( $interaction_values['text_contains'] ); ?>" placeholder="<?php esc_attr_e( 'Get a quote', 'flowbie-wp' ); ?>" />
										<p class="description"><?php esc_html_e( 'Leave blank to match without checking button or link text.', 'flowbie-wp' ); ?></p>
									</td>
								</tr>
								<tr>
									<th scope="row"><label for="rules_href"><?php esc_html_e( 'Link URL contains', 'flowbie-wp' ); ?></label></th>
									<td><input name="rules_href" id="rules_href" type="text" class="regular-text" value="<?php echo esc_attr( $interaction_values['href_contains'] ); ?>" placeholder="tel:" /></td>
								</tr>
							</table>
						</div>

						<table class="form-table" role="presentation">
							<tr>
								<th scope="row"><?php esc_html_e( 'Match mode', 'flowbie-wp' ); ?></th>
								<td>
									<label><input type="radio" name="match_mode" value="all" <?php checked( ! $editing || 'any' !== ( $editing['match_mode'] ?? 'all' ) ); ?> /> <?php esc_html_e( 'All selected rules required', 'flowbie-wp' ); ?></label><br />
									<label><input type="radio" name="match_mode" value="any" <?php checked( $editing && 'any' === ( $editing['match_mode'] ?? '' ) ); ?> /> <?php esc_html_e( 'Any selected rule', 'flowbie-wp' ); ?></label>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'Enabled', 'flowbie-wp' ); ?></th>
								<td>
									<label>
										<input name="goal_enabled" type="checkbox" value="1" <?php checked( ! $editing || ! empty( $editing['enabled'] ) ); ?> />
										<?php esc_html_e( 'Track this goal', 'flowbie-wp' ); ?>
									</label>
								</td>
							</tr>
						</table>
						<?php submit_button( $editing ? __( 'Update goal', 'flowbie-wp' ) : __( 'Create goal', 'flowbie-wp' ) ); ?>
						<a class="button" href="<?php echo esc_url( $conversions_url ); ?>"><?php esc_html_e( 'Cancel', 'flowbie-wp' ); ?></a>
					</form>
					<script>
					(function () {
						var trigger = document.getElementById('trigger_type');
						var formSelect = document.getElementById('form_id');
						var formPanel = document.querySelector('.flowbie-conversion-panel--form');
						var interactionPanel = document.querySelector('.flowbie-conversion-panel--interaction');
						if (!trigger) return;

						function syncPanels() {
							var value = trigger.value;
							var isForm = value === 'form_success';
							if (formPanel) formPanel.hidden = !isForm;
							if (interactionPanel) interactionPanel.hidden = isForm;
							if (formSelect) {
								if (isForm) {
									formSelect.setAttribute('required', 'required');
								} else {
									formSelect.removeAttribute('required');
								}
							}
						}

						trigger.addEventListener('change', function () {
							var url = new URL(window.location.href);
							url.searchParams.set('trigger_type', trigger.value);
							if (trigger.value !== 'form_success') {
								url.searchParams.delete('form_id');
							}
							window.location.href = url.toString();
						});
						syncPanels();
					})();
					</script>
				</div>
			<?php endif; ?>

			<div class="flowbie-wp-overseer__panel">
				<h2><?php esc_html_e( 'Conversion goals', 'flowbie-wp' ); ?></h2>
				<?php if ( empty( $goals ) ) : ?>
					<p><?php esc_html_e( 'No conversion goals yet.', 'flowbie-wp' ); ?></p>
				<?php else : ?>
					<table class="flowbie-wp-overseer__metrics-table">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Goal', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Trigger', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Form', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Rules', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Conversions (30d)', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Status', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Actions', 'flowbie-wp' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ( $goals as $goal ) : ?>
								<?php
								$form_title = '';
								foreach ( $forms as $form ) {
									if ( (int) ( $form['ID'] ?? 0 ) === (int) ( $goal['form_id'] ?? 0 ) ) {
										$form_title = (string) ( $form['title'] ?? '' );
										break;
									}
								}
								$count = Flowbie_Wp_Overseer_Conversions::count_goal_conversions( (string) $goal['id'], $date_from, $date_to );
								$delete_url = wp_nonce_url(
									add_query_arg(
										array(
											'action'  => self::ACTION_DELETE_OVERSEER_CONVERSION,
											'goal_id' => (string) $goal['id'],
										),
										admin_url( 'admin-post.php' )
									),
									self::ACTION_DELETE_OVERSEER_CONVERSION . '_' . (string) $goal['id']
								);
								?>
								<tr>
									<td><?php echo esc_html( (string) $goal['name'] ); ?></td>
									<td><?php echo esc_html( Flowbie_Wp_Overseer_Conversions::format_trigger_label( Flowbie_Wp_Overseer_Conversions::get_trigger_type( $goal ) ) ); ?></td>
									<td><?php echo 'form_success' === Flowbie_Wp_Overseer_Conversions::get_trigger_type( $goal ) ? esc_html( $form_title !== '' ? $form_title : '#' . (int) $goal['form_id'] ) : '—'; ?></td>
									<td><?php echo esc_html( Flowbie_Wp_Overseer_Conversions::summarize_rules( $goal ) ); ?></td>
									<td><?php echo (int) $count; ?></td>
									<td><?php echo ! empty( $goal['enabled'] ) ? esc_html__( 'On', 'flowbie-wp' ) : esc_html__( 'Off', 'flowbie-wp' ); ?></td>
									<td>
										<a href="<?php echo esc_url( add_query_arg( 'edit', (string) $goal['id'], $conversions_url ) ); ?>"><?php esc_html_e( 'Edit', 'flowbie-wp' ); ?></a>
										|
										<a href="<?php echo esc_url( $delete_url ); ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this conversion goal?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete', 'flowbie-wp' ); ?></a>
									</td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>
			</div>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_metrics_page(): void {
		$date_to   = isset( $_GET['date_to'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_to'] ) ) : gmdate( 'Y-m-d' );
		$date_from = isset( $_GET['date_from'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['date_from'] ) ) : gmdate( 'Y-m-d', strtotime( '-7 days' ) );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_from ) ) {
			$date_from = gmdate( 'Y-m-d', strtotime( '-7 days' ) );
		}
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_to ) ) {
			$date_to = gmdate( 'Y-m-d' );
		}

		$summary    = Flowbie_Wp_Overseer::aggregate_summary( $date_from, $date_to );
		$top_pages  = Flowbie_Wp_Overseer::aggregate_by_page( $date_from, $date_to );
		$top_paths  = array_slice( Flowbie_Wp_Overseer::aggregate_paths( $date_from, $date_to ), 0, 10 );
		$top_clicks = array_slice( Flowbie_Wp_Overseer::top_clicked_links( $date_from, $date_to ), 0, 10 );
		$top_goals  = Flowbie_Wp_Overseer_Conversions::aggregate_by_goal( $date_from, $date_to );
		$metrics_url = admin_url( 'admin.php?page=flowbie-wp-overseer&action=metrics' );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Analytics Dashboard', 'flowbie-wp' ); ?></h1>
			</div>

			<form method="get" class="flowbie-wp-overseer__filter-form">
				<input type="hidden" name="page" value="flowbie-wp-overseer" />
				<input type="hidden" name="action" value="metrics" />
				<div class="flowbie-wp-overseer__filter-row">
					<label>
						<?php esc_html_e( 'From', 'flowbie-wp' ); ?>
						<input type="date" name="date_from" value="<?php echo esc_attr( $date_from ); ?>" />
					</label>
					<label>
						<?php esc_html_e( 'To', 'flowbie-wp' ); ?>
						<input type="date" name="date_to" value="<?php echo esc_attr( $date_to ); ?>" />
					</label>
				</div>
				<div class="flowbie-wp-overseer__filter-actions">
					<button type="submit" class="button"><?php esc_html_e( 'Apply', 'flowbie-wp' ); ?></button>
					<a class="button" href="<?php echo esc_url( $metrics_url ); ?>"><?php esc_html_e( 'Last 7 days', 'flowbie-wp' ); ?></a>
				</div>
			</form>

			<?php
			$load_display = (int) $summary['avg_page_load_ms'] > 0 ? ( (int) $summary['avg_page_load_ms'] ) . 'ms' : '—';
			$metric_groups = array(
				array(
					'title' => __( 'Traffic', 'flowbie-wp' ),
					'rows'  => array(
						array( __( 'Sessions', 'flowbie-wp' ), (string) (int) $summary['sessions'] ),
						array( __( 'Pageviews', 'flowbie-wp' ), (string) (int) $summary['pageviews'] ),
						array( __( 'Bounce rate', 'flowbie-wp' ), (int) $summary['bounce_rate_pct'] . '%' ),
						array( __( 'Avg session duration', 'flowbie-wp' ), (int) $summary['avg_session_duration_sec'] . 's' ),
					),
				),
				array(
					'title' => __( 'Engagement', 'flowbie-wp' ),
					'rows'  => array(
						array( __( 'Avg time on page', 'flowbie-wp' ), (int) $summary['avg_time_on_page_sec'] . 's' ),
						array( __( 'Avg active time', 'flowbie-wp' ), (int) $summary['avg_active_time_sec'] . 's' ),
						array( __( 'Avg scroll depth', 'flowbie-wp' ), (int) $summary['avg_scroll_pct'] . '%' ),
						array( __( 'Exit capture rate', 'flowbie-wp' ), (int) $summary['exit_capture_rate_pct'] . '%' ),
					),
				),
				array(
					'title' => __( 'Actions & performance', 'flowbie-wp' ),
					'rows'  => array(
						array( __( 'Avg page load', 'flowbie-wp' ), $load_display ),
						array( __( 'Clicks', 'flowbie-wp' ), (string) (int) $summary['clicks'] ),
						array( __( 'Form submits', 'flowbie-wp' ), (string) (int) $summary['form_submits'] ),
						array( __( 'Conversions', 'flowbie-wp' ), (string) (int) $summary['conversions'] ),
					),
				),
			);
			?>
			<div class="flowbie-wp-overseer__metrics-report">
				<?php foreach ( $metric_groups as $group ) : ?>
					<div class="flowbie-wp-overseer__panel flowbie-wp-overseer__metrics-group">
						<h2><?php echo esc_html( $group['title'] ); ?></h2>
						<dl class="flowbie-wp-overseer__metric-rows">
							<?php foreach ( $group['rows'] as $row ) : ?>
								<div class="flowbie-wp-overseer__metric-row">
									<dt><?php echo esc_html( $row[0] ); ?></dt>
									<dd><?php echo esc_html( $row[1] ); ?></dd>
								</div>
							<?php endforeach; ?>
						</dl>
					</div>
				<?php endforeach; ?>
			</div>

			<div class="flowbie-wp-overseer__panel flowbie-wp-overseer__panel--spaced">
				<h2><?php esc_html_e( 'Conversion goals', 'flowbie-wp' ); ?></h2>
				<?php if ( empty( $top_goals ) ) : ?>
					<p>
						<?php esc_html_e( 'No conversion goals configured.', 'flowbie-wp' ); ?>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=conversions' ) ); ?>"><?php esc_html_e( 'Add a goal', 'flowbie-wp' ); ?></a>
					</p>
				<?php else : ?>
					<table class="flowbie-wp-overseer__metrics-table">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Goal', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Conversions', 'flowbie-wp' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ( $top_goals as $goal_row ) : ?>
								<?php if ( (int) $goal_row['count'] < 1 ) { continue; } ?>
								<tr>
									<td><?php echo esc_html( (string) $goal_row['name'] ); ?></td>
									<td><?php echo (int) $goal_row['count']; ?></td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>
			</div>

			<div class="flowbie-wp-overseer__panel flowbie-wp-overseer__panel--spaced">
				<h2><?php esc_html_e( 'Top pages', 'flowbie-wp' ); ?></h2>
				<?php if ( empty( $top_pages ) ) : ?>
					<p><?php esc_html_e( 'No pageview data for this range.', 'flowbie-wp' ); ?></p>
				<?php else : ?>
					<table class="flowbie-wp-overseer__metrics-table">
						<thead>
							<tr>
								<th><?php esc_html_e( 'Page', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Views', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Avg time', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Avg active', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Scroll', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Exit rate', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Load', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Clicks', 'flowbie-wp' ); ?></th>
								<th><?php esc_html_e( 'Forms', 'flowbie-wp' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ( $top_pages as $row ) : ?>
								<?php
								$avg_ms    = isset( $row->avg_duration_ms ) ? (int) round( (float) $row->avg_duration_ms / 1000 ) : 0;
								$avg_act   = isset( $row->avg_active_ms ) ? (int) round( (float) $row->avg_active_ms / 1000 ) : 0;
								$avg_scroll = isset( $row->avg_scroll_pct ) ? (int) round( (float) $row->avg_scroll_pct ) : 0;
								$avg_load  = isset( $row->avg_page_load_ms ) ? (int) round( (float) $row->avg_page_load_ms ) : 0;
								?>
								<tr>
									<td><?php echo esc_html( Flowbie_Wp_Overseer::normalize_path_url( (string) $row->page_url ) ); ?></td>
									<td><?php echo (int) $row->pageviews; ?></td>
									<td><?php echo $avg_ms > 0 ? esc_html( $avg_ms . 's' ) : '—'; ?></td>
									<td><?php echo $avg_act > 0 ? esc_html( $avg_act . 's' ) : '—'; ?></td>
									<td><?php echo $avg_scroll > 0 ? esc_html( $avg_scroll . '%' ) : '—'; ?></td>
									<td><?php echo isset( $row->exit_rate_pct ) ? esc_html( (int) $row->exit_rate_pct . '%' ) : '—'; ?></td>
									<td><?php echo $avg_load > 0 ? esc_html( $avg_load . 'ms' ) : '—'; ?></td>
									<td><?php echo (int) $row->clicks; ?></td>
									<td><?php echo (int) $row->form_submits; ?></td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>
			</div>

			<div class="flowbie-wp-overseer__panels">
				<div class="flowbie-wp-overseer__panel">
					<h2><?php esc_html_e( 'Top navigation paths', 'flowbie-wp' ); ?></h2>
					<?php if ( empty( $top_paths ) ) : ?>
						<p><?php esc_html_e( 'No multi-page paths yet.', 'flowbie-wp' ); ?></p>
					<?php else : ?>
						<ul>
							<?php foreach ( $top_paths as $path_row ) : ?>
								<li><?php echo esc_html( $path_row['path'] ); ?> — <?php echo (int) $path_row['count']; ?> <?php esc_html_e( 'sessions', 'flowbie-wp' ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>
				</div>
				<div class="flowbie-wp-overseer__panel">
					<h2><?php esc_html_e( 'Top clicked elements', 'flowbie-wp' ); ?></h2>
					<?php if ( empty( $top_clicks ) ) : ?>
						<p><?php esc_html_e( 'No click data for this range.', 'flowbie-wp' ); ?></p>
					<?php else : ?>
						<ul>
							<?php foreach ( $top_clicks as $link ) : ?>
								<li>
									<?php
									echo esc_html(
										sprintf(
											'%s → %s (%d)',
											Flowbie_Wp_Overseer::normalize_path_url( (string) $link->page_url ),
											substr( (string) $link->element_href, 0, 60 ),
											(int) $link->click_count
										)
									);
									?>
								</li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>
				</div>
			</div>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_analysis_page(): void {
		$flash       = self::get_and_clear_flash();
		$date_to     = gmdate( 'Y-m-d' );
		$date_from   = gmdate( 'Y-m-d', strtotime( '-7 days' ) );
		$model       = Flowbie_Wp_Overseer_Analysis::get_model();
		$key_ok      = Flowbie_Wp_OpenRouter::get_body_api_key() !== '';
		$settings    = Flowbie_Wp_Overseer::get_settings();
		$include_gsc = ! empty( $settings['include_gsc'] );
		$gsc_ok      = Flowbie_Wp_Gsc::is_available();
		$gsc_url     = admin_url( 'admin.php?page=flowbie-wp-settings&tab=gsc' );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'AI Analysis', 'flowbie-wp' ); ?></h1>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( ! $key_ok ) : ?>
				<div class="notice notice-warning">
					<p><?php esc_html_e( 'Add an OpenRouter API key in Flowbie WP Settings to run analysis.', 'flowbie-wp' ); ?></p>
				</div>
			<?php endif; ?>

			<p class="description">
				<?php
				printf(
					/* translators: %s: model id */
					esc_html__( 'Generates a markdown report and actionable tasks using %s.', 'flowbie-wp' ),
					esc_html( $model )
				);
				?>
			</p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_RUN_OVERSEER_ANALYSIS ); ?>" />
				<?php wp_nonce_field( self::ACTION_RUN_OVERSEER_ANALYSIS, 'flowbie_wp_overseer_analysis_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="analysis_date_from"><?php esc_html_e( 'From', 'flowbie-wp' ); ?></label></th>
						<td><input type="date" name="analysis_date_from" id="analysis_date_from" value="<?php echo esc_attr( $date_from ); ?>" required /></td>
					</tr>
					<tr>
						<th scope="row"><label for="analysis_date_to"><?php esc_html_e( 'To', 'flowbie-wp' ); ?></label></th>
						<td><input type="date" name="analysis_date_to" id="analysis_date_to" value="<?php echo esc_attr( $date_to ); ?>" required /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Search Console', 'flowbie-wp' ); ?></th>
						<td>
							<p>
								<?php if ( $gsc_ok ) : ?>
									<span class="flowbie-wp-settings__gsc-status flowbie-wp-settings__gsc-status--ok"><?php esc_html_e( 'Connected', 'flowbie-wp' ); ?></span>
								<?php else : ?>
									<span class="flowbie-wp-settings__gsc-status flowbie-wp-settings__gsc-status--error"><?php esc_html_e( 'Not configured', 'flowbie-wp' ); ?></span>
								<?php endif; ?>
							</p>
							<label for="analysis_include_gsc">
								<input name="analysis_include_gsc" id="analysis_include_gsc" type="checkbox" value="1" <?php checked( $include_gsc ); ?> <?php disabled( ! $gsc_ok ); ?> />
								<?php esc_html_e( 'Include Google Search Console data', 'flowbie-wp' ); ?>
							</label>
							<?php if ( ! $gsc_ok ) : ?>
								<p class="description">
									<?php
									printf(
										/* translators: %s: settings URL */
										wp_kses(
											__( 'Connect GSC in <a href="%s">Settings → Search Console</a> to correlate search traffic with on-site engagement.', 'flowbie-wp' ),
											array( 'a' => array( 'href' => array() ) )
										),
										esc_url( $gsc_url )
									);
									?>
								</p>
							<?php else : ?>
								<p class="description"><?php esc_html_e( 'GSC dates are lag-adjusted (~3 days) when merged with Overseer page metrics.', 'flowbie-wp' ); ?></p>
							<?php endif; ?>
						</td>
					</tr>
				</table>
				<p class="submit">
					<button type="submit" class="button button-primary" <?php disabled( ! $key_ok ); ?>>
						<?php esc_html_e( 'Generate report', 'flowbie-wp' ); ?>
					</button>
				</p>
			</form>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_reports_page(): void {
		$flash  = self::get_and_clear_flash();
		$page   = isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1;
		$result = Flowbie_Wp_Overseer_Reports::query( 20, $page );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Reports', 'flowbie-wp' ); ?></h1>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( empty( $result['items'] ) ) : ?>
				<p><?php esc_html_e( 'No reports yet.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<table class="wp-list-table widefat fixed striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Created', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Range', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Sessions', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Events', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Actions', 'flowbie-wp' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $result['items'] as $report ) : ?>
							<tr>
								<td><?php echo esc_html( (string) $report->created_at ); ?></td>
								<td><?php echo esc_html( (string) $report->date_from . ' — ' . (string) $report->date_to ); ?></td>
								<td><?php echo (int) $report->session_count; ?></td>
								<td><?php echo (int) $report->event_count; ?></td>
								<td>
									<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=view-report&id=' . (int) $report->id ) ); ?>"><?php esc_html_e( 'View', 'flowbie-wp' ); ?></a>
									|
									<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=tasks&report_id=' . (int) $report->id ) ); ?>"><?php esc_html_e( 'Tasks', 'flowbie-wp' ); ?></a>
									|
									<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_DELETE_OVERSEER_REPORT . '&id=' . (int) $report->id ), self::ACTION_DELETE_OVERSEER_REPORT . '_' . (int) $report->id ) ); ?>" class="submitdelete" onclick="return confirm('<?php echo esc_js( __( 'Delete this report and its tasks?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete', 'flowbie-wp' ); ?></a>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_view_report_page(): void {
		$id     = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		$report = Flowbie_Wp_Overseer_Reports::get( $id );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Report', 'flowbie-wp' ); ?></h1>
			</div>
			<p>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=reports' ) ); ?>">&larr; <?php esc_html_e( 'Back to reports', 'flowbie-wp' ); ?></a>
				|
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=tasks&report_id=' . $id ) ); ?>"><?php esc_html_e( 'View tasks', 'flowbie-wp' ); ?></a>
			</p>

			<?php if ( ! $report ) : ?>
				<p><?php esc_html_e( 'Report not found.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<div class="flowbie-wp-overseer__panel" style="margin-bottom:1em;">
					<p>
						<strong><?php esc_html_e( 'Date range:', 'flowbie-wp' ); ?></strong>
						<?php echo esc_html( (string) $report->date_from . ' — ' . (string) $report->date_to ); ?>
						&nbsp;|&nbsp;
						<strong><?php esc_html_e( 'Sessions:', 'flowbie-wp' ); ?></strong> <?php echo (int) $report->session_count; ?>
						&nbsp;|&nbsp;
						<strong><?php esc_html_e( 'Events:', 'flowbie-wp' ); ?></strong> <?php echo (int) $report->event_count; ?>
					</p>
					<?php if ( ! empty( $report->gsc_included ) ) : ?>
						<p>
							<strong><?php esc_html_e( 'Google Search Console:', 'flowbie-wp' ); ?></strong>
							<?php
							if ( ! empty( $report->gsc_date_from ) && ! empty( $report->gsc_date_to ) ) {
								printf(
									/* translators: 1: start date, 2: end date */
									esc_html__( 'Included (lag-adjusted range %1$s — %2$s)', 'flowbie-wp' ),
									esc_html( (string) $report->gsc_date_from ),
									esc_html( (string) $report->gsc_date_to )
								);
							} else {
								esc_html_e( 'Included', 'flowbie-wp' );
							}
							?>
						</p>
					<?php endif; ?>
				</div>
				<div class="flowbie-wp-overseer__panel flowbie-wp-overseer__report-body">
					<?php echo Flowbie_Wp_Markdown::render( (string) $report->body ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</div>
			<?php endif; ?>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_tasks_page(): void {
		$flash     = self::get_and_clear_flash();
		$report_id = isset( $_GET['report_id'] ) ? (int) $_GET['report_id'] : 0;
		$result    = Flowbie_Wp_Overseer_Tasks::query(
			array(
				'report_id' => $report_id,
				'per_page'  => 50,
				'page'      => 1,
			)
		);
		$fba_url   = admin_url( 'admin.php?page=flowbie-wp-backend-assist' );
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Tasks', 'flowbie-wp' ); ?></h1>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<?php if ( $report_id > 0 ) : ?>
				<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer&action=view-report&id=' . $report_id ) ); ?>">&larr; <?php esc_html_e( 'Back to report', 'flowbie-wp' ); ?></a></p>
			<?php endif; ?>

			<?php if ( empty( $result['items'] ) ) : ?>
				<p><?php esc_html_e( 'No tasks yet. Run an AI analysis to generate recommendations.', 'flowbie-wp' ); ?></p>
			<?php else : ?>
				<table class="wp-list-table widefat fixed striped">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Priority', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Task', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Category', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Status', 'flowbie-wp' ); ?></th>
							<th><?php esc_html_e( 'Actions', 'flowbie-wp' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $result['items'] as $task ) : ?>
							<tr>
								<td><?php echo (int) $task->priority; ?></td>
								<td>
									<strong><?php echo esc_html( (string) $task->title ); ?></strong>
									<?php if ( ! empty( $task->description ) ) : ?>
										<p class="description"><?php echo esc_html( wp_trim_words( (string) $task->description, 30 ) ); ?></p>
									<?php endif; ?>
								</td>
								<td><?php echo esc_html( (string) $task->category ); ?></td>
								<td><?php echo esc_html( (string) $task->status ); ?></td>
								<td>
									<?php if ( 'pending' === (string) $task->status ) : ?>
										<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_APPROVE_OVERSEER_TASK . '&id=' . (int) $task->id ), self::ACTION_APPROVE_OVERSEER_TASK . '_' . (int) $task->id ) ); ?>"><?php esc_html_e( 'Approve', 'flowbie-wp' ); ?></a>
										|
										<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_DISMISS_OVERSEER_TASK . '&id=' . (int) $task->id ), self::ACTION_DISMISS_OVERSEER_TASK . '_' . (int) $task->id ) ); ?>"><?php esc_html_e( 'Dismiss', 'flowbie-wp' ); ?></a>
									<?php elseif ( in_array( (string) $task->status, array( 'approved', 'running' ), true ) && ! empty( $task->assist_message ) ) : ?>
										<a href="<?php echo esc_url( $fba_url ); ?>" class="flowbie-overseer-run-fba" data-task-id="<?php echo (int) $task->id; ?>" data-prefill="<?php echo esc_attr( (string) $task->assist_message ); ?>"><?php esc_html_e( 'Run in Flow Assist', 'flowbie-wp' ); ?></a>
										|
										<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=' . self::ACTION_DONE_OVERSEER_TASK . '&id=' . (int) $task->id ), self::ACTION_DONE_OVERSEER_TASK . '_' . (int) $task->id ) ); ?>"><?php esc_html_e( 'Mark done', 'flowbie-wp' ); ?></a>
									<?php elseif ( 'done' === (string) $task->status ) : ?>
										<?php esc_html_e( 'Completed', 'flowbie-wp' ); ?>
									<?php else : ?>
										—
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
				<script>
				(function(){
					var links=document.querySelectorAll('.flowbie-overseer-run-fba');
					for(var i=0;i<links.length;i++){
						links[i].addEventListener('click',function(ev){
							try{
								sessionStorage.setItem('flowbie_fba_prefill',this.getAttribute('data-prefill')||'');
								sessionStorage.setItem('flowbie_fba_prefill_task_id',this.getAttribute('data-task-id')||'');
							}catch(e){}
						});
					}
				})();
				</script>
			<?php endif; ?>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_import_export_page(): void {
		$flash = self::get_and_clear_flash();
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Export', 'flowbie-wp' ); ?></h1>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<div class="flowbie-wp-overseer__panels">
				<div class="flowbie-wp-overseer__panel">
					<h2><?php esc_html_e( 'Export CSV', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Download all events including time on page, scroll depth, and interactions.', 'flowbie-wp' ); ?></p>
					<p><code><?php echo esc_html( Flowbie_Wp_Overseer_Csv::HEADER ); ?></code></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_OVERSEER ); ?>" />
						<?php wp_nonce_field( self::ACTION_EXPORT_OVERSEER, 'flowbie_wp_export_overseer_nonce' ); ?>
						<p>
							<label><?php esc_html_e( 'From', 'flowbie-wp' ); ?> <input type="date" name="export_date_from" /></label>
							<label><?php esc_html_e( 'To', 'flowbie-wp' ); ?> <input type="date" name="export_date_to" /></label>
						</p>
						<p><button type="submit" class="button button-secondary"><?php esc_html_e( 'Export CSV', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>

				<div class="flowbie-wp-overseer__panel">
					<h2><?php esc_html_e( 'Clear all visits', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Permanently delete every stored event. This cannot be undone.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('<?php echo esc_js( __( 'Delete all Overseer events?', 'flowbie-wp' ) ); ?>');">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_CLEAR_OVERSEER_VISITS ); ?>" />
						<?php wp_nonce_field( self::ACTION_CLEAR_OVERSEER_VISITS, 'flowbie_wp_clear_overseer_nonce' ); ?>
						<p><button type="submit" class="button button-link-delete"><?php esc_html_e( 'Clear all visits', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>
			</div>
		<?php
		self::render_overseer_page_shell_close();
	}

	private static function render_overseer_settings_page(): void {
		$settings = Flowbie_Wp_Overseer::get_settings();
		$flash    = self::get_and_clear_flash();
		self::render_overseer_page_shell_open();
		?>
			<div class="flowbie-wp-overseer__titlebar">
			<h1><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></h1>
			</div>

			<?php if ( $flash ) : ?>
				<div class="notice notice-<?php echo ! empty( $flash['success'] ) ? 'success' : 'error'; ?> is-dismissible">
					<p><?php echo esc_html( isset( $flash['message'] ) ? (string) $flash['message'] : '' ); ?></p>
				</div>
			<?php endif; ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_OVERSEER_SETTINGS ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_OVERSEER_SETTINGS, 'flowbie_wp_overseer_settings_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Tracking', 'flowbie-wp' ); ?></th>
						<td>
							<label for="tracking_enabled">
								<input name="tracking_enabled" id="tracking_enabled" type="checkbox" value="1" <?php checked( ! empty( $settings['tracking_enabled'] ) ); ?> />
								<?php esc_html_e( 'Record analytics via the Flowbie Page View tag', 'flowbie-wp' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Interactions', 'flowbie-wp' ); ?></th>
						<td>
							<label for="track_interactions">
								<input name="track_interactions" id="track_interactions" type="checkbox" value="1" <?php checked( ! empty( $settings['track_interactions'] ) ); ?> />
								<?php esc_html_e( 'Track clicks, form submits, and outbound links', 'flowbie-wp' ); ?>
							</label>
							<p>
								<label for="track_outbound_only">
									<input name="track_outbound_only" id="track_outbound_only" type="checkbox" value="1" <?php checked( ! empty( $settings['track_outbound_only'] ) ); ?> />
									<?php esc_html_e( 'Only track outbound links and form submits (skip internal clicks)', 'flowbie-wp' ); ?>
								</label>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="retention_days"><?php esc_html_e( 'Retention (days)', 'flowbie-wp' ); ?></label></th>
						<td>
							<input name="retention_days" id="retention_days" type="number" min="1" max="3650" value="<?php echo esc_attr( (string) $settings['retention_days'] ); ?>" />
							<p class="description"><?php esc_html_e( 'Events older than this are deleted automatically.', 'flowbie-wp' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Privacy', 'flowbie-wp' ); ?></th>
						<td>
							<label for="anonymize_ip">
								<input name="anonymize_ip" id="anonymize_ip" type="checkbox" value="1" <?php checked( ! empty( $settings['anonymize_ip'] ) ); ?> />
								<?php esc_html_e( 'Anonymize IP addresses before storage (last IPv4 octet zeroed)', 'flowbie-wp' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'Depending on your region, visitor tracking may require consent under GDPR/CCPA. Form field values are never stored. Conversion events store only which field types were present (email, phone, etc.), not their contents.', 'flowbie-wp' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Administrators', 'flowbie-wp' ); ?></th>
						<td>
							<label for="exclude_admins">
								<input name="exclude_admins" id="exclude_admins" type="checkbox" value="1" <?php checked( ! empty( $settings['exclude_admins'] ) ); ?> />
								<?php esc_html_e( 'Do not record visits from logged-in administrators', 'flowbie-wp' ); ?>
							</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'AI Analysis', 'flowbie-wp' ); ?></th>
						<td>
							<label for="include_gsc">
								<input name="include_gsc" id="include_gsc" type="checkbox" value="1" <?php checked( ! empty( $settings['include_gsc'] ) ); ?> />
								<?php esc_html_e( 'Include Google Search Console data in AI analysis by default', 'flowbie-wp' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'When connected, search clicks and queries are merged with on-site engagement in generated reports.', 'flowbie-wp' ); ?></p>
						</td>
					</tr>
				</table>
				<p class="submit"><button type="submit" class="button button-primary"><?php esc_html_e( 'Save Settings', 'flowbie-wp' ); ?></button></p>
			</form>
		<?php
		self::render_overseer_page_shell_close();
	}
}

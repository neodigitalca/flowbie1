<?php
/**
 * Script Manager admin pages.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Script_Manager {

	public static function render_script_manager_page(): void {
		require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/admin/class-flowbie-wp-script-manager-list-table.php';
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage scripts.', 'flowbie-wp' ) );
		}

		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( (string) $_GET['action'] ) ) : 'list';
		switch ( $action ) {
			case 'new':
			case 'edit':
				self::render_script_edit_page();
				return;
			case 'import-export':
				self::render_script_import_export_page();
				return;
			case 'settings':
				self::render_script_settings_page();
				return;
			default:
				self::render_script_list_page();
		}
	}

	private static function render_script_list_page(): void {
		$list_table = new Flowbie_Wp_Script_Manager_List_Table();
		$list_table->prepare_items();
		$counts   = $list_table->get_status_counts();
		$status   = isset( $_GET['script_status'] ) ? sanitize_key( wp_unslash( (string) $_GET['script_status'] ) ) : 'all';
		if ( $status === '' ) {
			$status = 'all';
		}
		$category = isset( $_GET['script_category'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['script_category'] ) ) : '';
		$search   = isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( (string) $_REQUEST['s'] ) ) : '';
		$base_url = admin_url( 'admin.php?page=flowbie-wp-script-manager' );
		$conflicts = Flowbie_Wp_Script_Manager::conflicting_plugins();
		$hfcm      = self::hfcm_database_import_status();
		self::flowbie_group_shell_open( 'flowbie-wp-script-manager', 'flowbie-wp-script-manager' );
		?>
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Script Manager', 'flowbie-wp' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager&action=new' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add New', 'flowbie-wp' ); ?></a>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager&action=import-export' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Import & Export', 'flowbie-wp' ); ?></a>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager&action=settings' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></a>
			<hr class="wp-header-end" />

			<?php if ( ! empty( $conflicts ) ) : ?>
				<div class="notice notice-warning">
					<p>
						<?php
						echo esc_html(
							sprintf(
								/* translators: %s: comma-separated plugin names */
								__( 'Another script plugin is active (%s). Avoid duplicate pixels or verification tags.', 'flowbie-wp' ),
								implode( ', ', $conflicts )
							)
						);
						?>
					</p>
				</div>
			<?php endif; ?>

			<?php if ( ! empty( $hfcm['available'] ) ) : ?>
				<div class="notice notice-info flowbie-wp-script-manager__hfcm-import">
					<p>
						<?php
						if ( (int) $hfcm['pending_count'] > 0 ) {
							echo esc_html(
								sprintf(
									/* translators: %d: HFCM snippet count not yet imported */
									_n(
										'Header Footer Code Manager has %d snippet ready to import (header, footer, and body locations).',
										'Header Footer Code Manager has %d snippets ready to import (header, footer, and body locations).',
										(int) $hfcm['pending_count'],
										'flowbie-wp'
									),
									(int) $hfcm['pending_count']
								)
							);
						} else {
							esc_html_e( 'Header Footer Code Manager is installed. Click below to import all snippets from the HFCM database.', 'flowbie-wp' );
						}
						?>
					</p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:8px;">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SCRIPTS_HFCM_DB ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_SCRIPTS_HFCM_DB, 'flowbie_wp_import_scripts_hfcm_db_nonce' ); ?>
						<button type="submit" class="button button-primary"><?php esc_html_e( 'Import HFCM Scripts', 'flowbie-wp' ); ?></button>
					</form>
				</div>
			<?php endif; ?>

			<p class="description flowbie-wp-script-manager__note">
				<?php esc_html_e( 'Add tracking pixels, Google Search Console verification meta tags, and other header, footer, or body snippets. Scripts run only on the front end when active and display rules match.', 'flowbie-wp' ); ?>
			</p>

			<div class="flowbie-wp-script-manager__list-tools">
				<ul class="subsubsub">
					<?php
					$view_keys = array( 'all', 'active', 'inactive', 'trash' );
					$labels    = array(
						'all'      => __( 'All', 'flowbie-wp' ),
						'active'   => __( 'Active', 'flowbie-wp' ),
						'inactive' => __( 'Inactive', 'flowbie-wp' ),
						'trash'    => __( 'Trash', 'flowbie-wp' ),
					);
					$parts = array();
					foreach ( $view_keys as $key ) {
						$url   = add_query_arg( 'script_status', $key, $base_url );
						$count = isset( $counts[ $key ] ) ? (int) $counts[ $key ] : 0;
						$text  = $labels[ $key ] . ' (' . $count . ')';
						if ( $status === $key || ( 'all' === $key && ( $status === '' || $status === 'all' ) ) ) {
							$parts[] = '<li class="' . esc_attr( $key ) . '"><a href="' . esc_url( $url ) . '" class="current" aria-current="page">' . esc_html( $text ) . '</a></li>';
						} else {
							$parts[] = '<li class="' . esc_attr( $key ) . '"><a href="' . esc_url( $url ) . '">' . esc_html( $text ) . '</a></li>';
						}
					}
					echo wp_kses_post( implode( ' | ', $parts ) );
					?>
				</ul>

				<form method="get" class="flowbie-wp-script-manager__filter-form">
					<input type="hidden" name="page" value="flowbie-wp-script-manager" />
					<input type="hidden" name="script_status" value="<?php echo esc_attr( $status ); ?>" />
					<?php self::render_script_category_filter( $category ); ?>
					<label for="flowbie-script-search" class="screen-reader-text"><?php esc_html_e( 'Search scripts', 'flowbie-wp' ); ?></label>
					<input type="search" id="flowbie-script-search" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="<?php esc_attr_e( 'Search scripts', 'flowbie-wp' ); ?>" />
					<?php if ( $search !== '' ) : ?>
						<a class="button" href="<?php echo esc_url( remove_query_arg( 's', add_query_arg( array( 'page' => 'flowbie-wp-script-manager', 'script_status' => $status, 'script_category' => $category ), admin_url( 'admin.php' ) ) ) ); ?>"><?php esc_html_e( 'Clear', 'flowbie-wp' ); ?></a>
					<?php endif; ?>
					<input type="submit" class="button" value="<?php esc_attr_e( 'Filter', 'flowbie-wp' ); ?>" />
				</form>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-script-manager__list-form">
					<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_BULK_SCRIPTS ); ?>" />
					<?php wp_nonce_field( 'bulk-scripts' ); ?>
					<input type="hidden" name="script_status" value="<?php echo esc_attr( $status ); ?>" />
					<?php if ( $category !== '' ) : ?>
						<input type="hidden" name="script_category" value="<?php echo esc_attr( $category ); ?>" />
					<?php endif; ?>
					<?php if ( $search !== '' ) : ?>
						<input type="hidden" name="s" value="<?php echo esc_attr( $search ); ?>" />
					<?php endif; ?>
					<?php $list_table->display(); ?>
				</form>
			</div>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * @param string $selected Selected category.
	 */
	private static function render_script_category_filter( string $selected ): void {
		$categories = Flowbie_Wp_Script_Manager::distinct_categories();
		if ( empty( $categories ) ) {
			return;
		}
		?>
		<label for="script_category" class="screen-reader-text"><?php esc_html_e( 'Filter by category', 'flowbie-wp' ); ?></label>
		<select name="script_category" id="script_category">
			<option value=""><?php esc_html_e( 'All categories', 'flowbie-wp' ); ?></option>
			<?php foreach ( $categories as $cat ) : ?>
				<option value="<?php echo esc_attr( $cat ); ?>" <?php selected( $selected, $cat ); ?>><?php echo esc_html( $cat ); ?></option>
			<?php endforeach; ?>
		</select>
		<?php
	}

	private static function render_script_edit_page(): void {
		$id     = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		$is_new = isset( $_GET['action'] ) && 'new' === sanitize_key( wp_unslash( (string) $_GET['action'] ) );
		$row    = $id > 0 ? Flowbie_Wp_Script_Manager::get( $id ) : null;
		if ( $id > 0 && ! $row ) {
			wp_die( esc_html__( 'Script not found.', 'flowbie-wp' ) );
		}

		$settings   = Flowbie_Wp_Script_Manager::get_settings();
		$categories = Flowbie_Wp_Script_Manager::distinct_categories();
		$rules      = $row
			? Flowbie_Wp_Script_Manager_Rules::decode( (string) $row->display_rules )
			: Flowbie_Wp_Script_Manager_Rules::defaults();
		$rules_json = wp_json_encode( $rules );
		$post_types = get_post_types( array( 'public' => true ), 'objects' );

		self::enqueue_script_manager_assets();
		self::flowbie_group_shell_open( 'flowbie-wp-script-manager', 'flowbie-wp-script-manager' );
		?>
			<h1><?php echo $is_new ? esc_html__( 'Add Script', 'flowbie-wp' ) : esc_html__( 'Edit Script', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager' ) ); ?>">&larr; <?php esc_html_e( 'Back to list', 'flowbie-wp' ); ?></a></p>

			<?php if ( $row && class_exists( 'Flowbie_Wp_Overseer', false ) && Flowbie_Wp_Overseer::is_builtin_script_id( (int) $row->id ) ) : ?>
				<div class="notice notice-info">
					<p>
						<?php
						esc_html_e(
							'This is the built-in Flowbie Page View tag for Overseer analytics. Placeholders (%%FLOWBIE_OVERSEER_CONFIG%%, %%FLOWBIE_OVERSEER_JS_URL%%) are replaced with live values on each page load. Do not remove the script tags unless you know what you are doing.',
							'flowbie-wp'
						);
						?>
						<a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-overseer' ) ); ?>"><?php esc_html_e( 'Open Overseer', 'flowbie-wp' ); ?></a>
					</p>
				</div>
			<?php endif; ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="flowbie-wp-script-manager__form" id="flowbie-script-manager-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SCRIPT ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_SCRIPT, 'flowbie_wp_script_nonce' ); ?>
				<input type="hidden" name="script_id" value="<?php echo esc_attr( (string) $id ); ?>" />
				<input type="hidden" name="script_display_rules" id="script_display_rules" value="<?php echo esc_attr( is_string( $rules_json ) ? $rules_json : '{}' ); ?>" />

				<?php self::render_script_meta_fields( $row, $categories, $settings ); ?>

				<section class="flowbie-rules" id="flowbie-script-rules-panel" aria-labelledby="flowbie-rules-heading"
					data-rules="<?php echo esc_attr( is_string( $rules_json ) ? $rules_json : '{}' ); ?>">
					<header class="flowbie-rules__header">
						<h2 id="flowbie-rules-heading" class="flowbie-rules__title"><?php esc_html_e( 'Display rules', 'flowbie-wp' ); ?></h2>
					</header>

					<div class="flowbie-rules__global">
						<?php
						self::render_rules_select_field(
							'rules_mode',
							'mode',
							__( 'Show on', 'flowbie-wp' ),
							array(
								'all'     => __( 'All pages', 'flowbie-wp' ),
								'include' => __( 'Only selected targets', 'flowbie-wp' ),
								'exclude' => __( 'All except selected', 'flowbie-wp' ),
							)
						);
						self::render_rules_select_field(
							'rules_device',
							'device',
							__( 'Device', 'flowbie-wp' ),
							array(
								'all'     => __( 'All devices', 'flowbie-wp' ),
								'mobile'  => __( 'Mobile only', 'flowbie-wp' ),
								'desktop' => __( 'Desktop only', 'flowbie-wp' ),
							)
						);
						self::render_rules_select_field(
							'rules_logged_in',
							'logged_in',
							__( 'Audience', 'flowbie-wp' ),
							array(
								'all'     => __( 'Everyone', 'flowbie-wp' ),
								'only'    => __( 'Logged-in only', 'flowbie-wp' ),
								'exclude' => __( 'Guests only', 'flowbie-wp' ),
							)
						);
						?>
					</div>

					<div class="flowbie-rules__targets" data-flowbie-rules-tabs>
						<div class="flowbie-rules__tabs" role="tablist" aria-label="<?php esc_attr_e( 'Target scope', 'flowbie-wp' ); ?>">
							<button type="button" class="flowbie-rules__tab is-active" role="tab" aria-selected="true" aria-controls="flowbie-rules-panel-include" data-rules-tab="include"><?php esc_html_e( 'Include', 'flowbie-wp' ); ?></button>
							<button type="button" class="flowbie-rules__tab" role="tab" aria-selected="false" aria-controls="flowbie-rules-panel-exclude" data-rules-tab="exclude"><?php esc_html_e( 'Exclude', 'flowbie-wp' ); ?></button>
						</div>
						<div class="flowbie-rules__panel is-active" id="flowbie-rules-panel-include" role="tabpanel" data-rules-group="include">
							<?php self::render_rules_target_fields( 'include', $post_types ); ?>
						</div>
						<div class="flowbie-rules__panel" id="flowbie-rules-panel-exclude" role="tabpanel" data-rules-group="exclude" hidden>
							<?php self::render_rules_target_fields( 'exclude', $post_types ); ?>
						</div>
					</div>
				</section>

				<p class="submit">
					<button type="submit" class="button button-primary"><?php esc_html_e( 'Save Script', 'flowbie-wp' ); ?></button>
					<?php if ( $row ) : ?>
						<a class="button button-link-delete" href="<?php echo self::script_admin_post_nonce_url( self::ACTION_DELETE_SCRIPT, 'flowbie_wp_delete_script_nonce', array( 'id' => (int) $row->id ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_nonce_url() escapes for HTML attributes. ?>" onclick="return confirm('<?php echo esc_js( __( 'Delete this script permanently?', 'flowbie-wp' ) ); ?>');"><?php esc_html_e( 'Delete Permanently', 'flowbie-wp' ); ?></a>
					<?php endif; ?>
				</p>
			</form>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * Script edit form — grid with nested labels and dark fields.
	 *
	 * @param object|null          $row        Script row.
	 * @param array<int, string>   $categories Distinct categories.
	 * @param array<string, mixed> $settings   Plugin settings.
	 */
	private static function render_script_meta_fields( $row, array $categories, array $settings ): void {
		$name_value     = $row ? (string) $row->name : '';
		$priority_value = $row ? (string) (int) $row->priority : '10';
		$category_value = $row ? (string) $row->category : (string) $settings['default_category'];
		$code_value     = $row ? (string) $row->code : '';
		$placement      = $row ? (string) $row->placement : 'header';
		$status         = $row ? (string) $row->status : 'active';

		$placements = array(
			'header' => __( 'Header (wp_head)', 'flowbie-wp' ),
			'body'   => __( 'Body (wp_body_open)', 'flowbie-wp' ),
			'footer' => __( 'Footer (wp_footer)', 'flowbie-wp' ),
		);
		$statuses = array(
			'active'   => __( 'Active', 'flowbie-wp' ),
			'inactive' => __( 'Inactive', 'flowbie-wp' ),
		);
		?>
		<section class="flowbie-script-meta" aria-labelledby="flowbie-script-meta-heading">
			<h2 id="flowbie-script-meta-heading" class="flowbie-script-meta__title screen-reader-text"><?php esc_html_e( 'Script details', 'flowbie-wp' ); ?></h2>
			<div class="flowbie-script-meta__grid">
				<?php
				self::render_meta_text_field(
					'script_name',
					'script_name',
					__( 'Script name', 'flowbie-wp' ),
					$name_value,
					'full',
					'text',
					true
				);
				self::render_meta_select_field(
					'script_placement',
					'script_placement',
					__( 'Placement', 'flowbie-wp' ),
					$placements,
					$placement,
					'half'
				);
				self::render_meta_text_field(
					'script_priority',
					'script_priority',
					__( 'Priority', 'flowbie-wp' ),
					$priority_value,
					'quarter',
					'number'
				);
				self::render_meta_select_field(
					'script_status_field',
					'script_status_field',
					__( 'Status', 'flowbie-wp' ),
					$statuses,
					$status,
					'quarter'
				);
				self::render_meta_text_field(
					'script_category',
					'script_category',
					__( 'Category', 'flowbie-wp' ),
					$category_value,
					'half',
					'text',
					false,
					'',
					'flowbie-wp-script-categories'
				);
				self::render_meta_textarea_field(
					'script_code',
					'script_code',
					__( 'Code', 'flowbie-wp' ),
					$code_value
				);
				?>
			</div>
			<datalist id="flowbie-wp-script-categories">
				<?php foreach ( $categories as $cat ) : ?>
					<option value="<?php echo esc_attr( $cat ); ?>"></option>
				<?php endforeach; ?>
			</datalist>
		</section>
		<?php
	}

	/**
	 * @param string $id       Element id.
	 * @param string $name     Form name.
	 * @param string $label    Label text.
	 * @param string $value    Current value.
	 * @param string $span     Grid span: full|half|quarter.
	 * @param string $type     Input type.
	 * @param bool   $required Required attribute.
	 * @param string $note     Optional note below field.
	 * @param string $list     Optional datalist id.
	 */
	private static function render_meta_text_field(
		string $id,
		string $name,
		string $label,
		string $value = '',
		string $span = 'full',
		string $type = 'text',
		bool $required = false,
		string $note = '',
		string $list = ''
	): void {
		$extra = '';
		if ( 'number' === $type ) {
			$extra = ' min="0" max="9999"';
		}
		?>
		<div class="flowbie-script-meta__cell flowbie-script-meta__cell--<?php echo esc_attr( $span ); ?>">
			<div class="flowbie-field flowbie-field--text flowbie-field--stacked">
				<span class="flowbie-field__label flowbie-field__label--above"><?php echo esc_html( $label ); ?></span>
				<input
					type="<?php echo esc_attr( $type ); ?>"
					name="<?php echo esc_attr( $name ); ?>"
					id="<?php echo esc_attr( $id ); ?>"
					class="flowbie-field__control"
					value="<?php echo esc_attr( $value ); ?>"
					autocomplete="off"
					<?php echo $required ? ' required' : ''; ?>
					<?php echo $list !== '' ? ' list="' . esc_attr( $list ) . '"' : ''; ?>
					<?php echo $extra; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				/>
				<?php if ( $note !== '' ) : ?>
					<p class="flowbie-field__note"><?php echo esc_html( $note ); ?></p>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * @param string               $id       Element id.
	 * @param string               $name     Form name.
	 * @param string               $label    Label above select.
	 * @param array<string,string> $options  Value => label.
	 * @param string               $selected Selected value.
	 * @param string               $span     Grid span.
	 */
	private static function render_meta_select_field(
		string $id,
		string $name,
		string $label,
		array $options,
		string $selected,
		string $span = 'half'
	): void {
		?>
		<div class="flowbie-script-meta__cell flowbie-script-meta__cell--<?php echo esc_attr( $span ); ?>">
			<div class="flowbie-field flowbie-field--select">
				<span class="flowbie-field__label flowbie-field__label--above"><?php echo esc_html( $label ); ?></span>
				<select name="<?php echo esc_attr( $name ); ?>" id="<?php echo esc_attr( $id ); ?>" class="flowbie-field__control">
					<?php foreach ( $options as $value => $text ) : ?>
						<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $selected, $value ); ?>><?php echo esc_html( $text ); ?></option>
					<?php endforeach; ?>
				</select>
			</div>
		</div>
		<?php
	}

	/**
	 * @param string $id    Element id.
	 * @param string $name  Form name.
	 * @param string $label Label above textarea.
	 * @param string $value Code content.
	 * @param string $note  Helper text.
	 */
	private static function render_meta_textarea_field( string $id, string $name, string $label, string $value, string $note = '' ): void {
		$filled = trim( $value ) !== '';
		?>
		<div class="flowbie-script-meta__cell flowbie-script-meta__cell--full">
			<div class="flowbie-field flowbie-field--textarea<?php echo $filled ? ' flowbie-field--filled' : ''; ?>">
				<span class="flowbie-field__label flowbie-field__label--above"><?php echo esc_html( $label ); ?></span>
				<textarea name="<?php echo esc_attr( $name ); ?>" id="<?php echo esc_attr( $id ); ?>" class="flowbie-field__control flowbie-field__control--code" rows="12" required placeholder=" "><?php echo esc_textarea( $value ); ?></textarea>
				<?php if ( $note !== '' ) : ?>
					<p class="flowbie-field__note"><?php echo esc_html( $note ); ?></p>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * @param string               $id         Field id.
	 * @param string               $field_key  data-rule-field value.
	 * @param string               $label      Floating label.
	 * @param array<string,string> $options    Value => label.
	 */
	private static function render_rules_select_field( string $id, string $field_key, string $label, array $options ): void {
		?>
		<div class="flowbie-field flowbie-field--select">
			<span class="flowbie-field__label flowbie-field__label--above"><?php echo esc_html( $label ); ?></span>
			<select id="<?php echo esc_attr( $id ); ?>" class="flowbie-field__control" data-rule-field="<?php echo esc_attr( $field_key ); ?>">
				<?php foreach ( $options as $value => $text ) : ?>
					<option value="<?php echo esc_attr( $value ); ?>"><?php echo esc_html( $text ); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
		<?php
	}

	/**
	 * @param string               $group   include|exclude.
	 * @param string               $target  Target key.
	 * @param string               $label   Field label.
	 * @param array<string,string> $options Value => label.
	 */
	private static function render_rules_multiselect_field( string $group, string $target, string $label, array $options ): void {
		$uid = 'flowbie-ms-' . $group . '-' . $target;
		?>
		<div class="flowbie-field flowbie-field--multiselect" data-flowbie-ms>
			<button type="button" class="flowbie-ms__trigger flowbie-field__control" aria-expanded="false" aria-haspopup="listbox" aria-controls="<?php echo esc_attr( $uid ); ?>-menu" id="<?php echo esc_attr( $uid ); ?>-trigger">
				<span class="flowbie-field__label"><?php echo esc_html( $label ); ?></span>
				<span class="flowbie-ms__summary" aria-live="polite"></span>
			</button>
			<div class="flowbie-ms__menu" id="<?php echo esc_attr( $uid ); ?>-menu" role="listbox" aria-multiselectable="true" hidden>
				<?php foreach ( $options as $value => $text ) : ?>
					<button type="button" class="flowbie-ms__option" role="option" aria-selected="false" data-value="<?php echo esc_attr( $value ); ?>">
						<?php echo esc_html( $text ); ?>
					</button>
				<?php endforeach; ?>
			</div>
			<select class="flowbie-ms__native" data-target="<?php echo esc_attr( $target ); ?>" data-group="<?php echo esc_attr( $group ); ?>" multiple hidden aria-hidden="true" tabindex="-1">
				<?php foreach ( $options as $value => $text ) : ?>
					<option value="<?php echo esc_attr( $value ); ?>"><?php echo esc_html( $text ); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
		<?php
	}

	/**
	 * @param string $group    include|exclude.
	 * @param string $target   Target key.
	 * @param string $label    Floating label.
	 * @param string $hint     Optional hint.
	 * @param string $taxonomy Taxonomy slug when target is taxonomy.
	 */
	private static function render_rules_text_field( string $group, string $target, string $label ): void {
		$title = '';
		if ( 'taxonomies' === $target ) {
			$title = __( 'Example: category:12,34 post_tag:5', 'flowbie-wp' );
		}
		?>
		<div class="flowbie-field flowbie-field--text flowbie-field--stacked">
			<span class="flowbie-field__label flowbie-field__label--above"><?php echo esc_html( $label ); ?></span>
			<input type="text" class="flowbie-field__control" data-target="<?php echo esc_attr( $target ); ?>" data-group="<?php echo esc_attr( $group ); ?>" autocomplete="off"<?php echo $title !== '' ? ' title="' . esc_attr( $title ) . '"' : ''; ?> />
		</div>
		<?php
	}

	/**
	 * @return array<string, string>
	 */
	private static function rules_archive_labels(): array {
		return array(
			'category'          => __( 'Category archives', 'flowbie-wp' ),
			'tag'               => __( 'Tag archives', 'flowbie-wp' ),
			'author'            => __( 'Author archives', 'flowbie-wp' ),
			'date'              => __( 'Date archives', 'flowbie-wp' ),
			'post_type_archive' => __( 'Post type archives', 'flowbie-wp' ),
		);
	}

	/**
	 * @return array<string, string>
	 */
	private static function rules_special_labels(): array {
		return array(
			'front_page' => __( 'Front page', 'flowbie-wp' ),
			'blog'       => __( 'Blog index', 'flowbie-wp' ),
			'search'     => __( 'Search results', 'flowbie-wp' ),
			'404'        => __( '404 page', 'flowbie-wp' ),
			'attachment' => __( 'Attachments', 'flowbie-wp' ),
			'singular'   => __( 'All singular', 'flowbie-wp' ),
			'archive'    => __( 'All archives', 'flowbie-wp' ),
		);
	}

	/**
	 * @param string                      $group      include|exclude.
	 * @param array<string, WP_Post_Type> $post_types Post types.
	 */
	private static function render_rules_target_fields( string $group, array $post_types ): void {
		$post_type_options = array();
		foreach ( $post_types as $pt ) {
			$post_type_options[ $pt->name ] = $pt->labels->singular_name;
		}

		$archive_options = array();
		foreach ( Flowbie_Wp_Script_Manager_Rules::ARCHIVES as $arch ) {
			$labels = self::rules_archive_labels();
			$archive_options[ $arch ] = isset( $labels[ $arch ] ) ? $labels[ $arch ] : $arch;
		}

		$special_options = self::rules_special_labels();
		?>
		<div class="flowbie-rules__stack">
			<?php
			self::render_rules_text_field( $group, 'posts', __( 'Post IDs', 'flowbie-wp' ) );
			self::render_rules_multiselect_field( $group, 'post_types', __( 'Post types', 'flowbie-wp' ), $post_type_options );
			self::render_rules_multiselect_field( $group, 'archives', __( 'Archives', 'flowbie-wp' ), $archive_options );
			self::render_rules_multiselect_field( $group, 'special', __( 'Special pages', 'flowbie-wp' ), $special_options );
			self::render_rules_text_field( $group, 'taxonomies', __( 'Taxonomy terms', 'flowbie-wp' ) );
			?>
		</div>
		<?php
	}

	private static function render_script_import_export_page(): void {
		$hfcm = self::hfcm_database_import_status();
		self::flowbie_group_shell_open( 'flowbie-wp-script-manager', 'flowbie-wp-script-manager' );
		?>
			<h1><?php esc_html_e( 'Import & Export', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager' ) ); ?>">&larr; <?php esc_html_e( 'Back to list', 'flowbie-wp' ); ?></a></p>

			<div class="flowbie-wp-script-manager__panels flowbie-wp-script-manager__panels--quad">
				<?php if ( ! empty( $hfcm['available'] ) ) : ?>
					<div class="flowbie-wp-script-manager__panel flowbie-wp-script-manager__panel--hfcm flowbie-wp-script-manager__panel--hfcm-direct">
						<h2><?php esc_html_e( 'Import from HFCM', 'flowbie-wp' ); ?></h2>
						<p>
							<?php
							if ( (int) $hfcm['pending_count'] > 0 ) {
								echo esc_html(
									sprintf(
										/* translators: %d: snippet count not yet imported */
										_n(
											'Import %d snippet directly from Header Footer Code Manager on this site — no JSON file needed.',
											'Import %d snippets directly from Header Footer Code Manager on this site — no JSON file needed.',
											(int) $hfcm['pending_count'],
											'flowbie-wp'
										),
										(int) $hfcm['pending_count']
									)
								);
							} else {
								esc_html_e( 'Import snippets directly from Header Footer Code Manager on this site — no JSON file needed.', 'flowbie-wp' );
							}
							?>
						</p>
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
							<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SCRIPTS_HFCM_DB ); ?>" />
							<?php wp_nonce_field( self::ACTION_IMPORT_SCRIPTS_HFCM_DB, 'flowbie_wp_import_scripts_hfcm_db_nonce' ); ?>
							<p><button type="submit" class="button button-primary button-hero"><?php esc_html_e( 'Import HFCM Scripts', 'flowbie-wp' ); ?></button></p>
						</form>
					</div>
				<?php endif; ?>

				<div class="flowbie-wp-script-manager__panel flowbie-wp-script-manager__panel--hfcm">
					<h2><?php esc_html_e( 'Import HFCM export file', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Upload the JSON file from Header Footer Code Manager (Tools → Import/Export). Snippets are converted to Flowbie scripts; PHP snippets are skipped.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SCRIPTS_HFCM ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_SCRIPTS_HFCM, 'flowbie_wp_import_scripts_hfcm_nonce' ); ?>
						<p><input type="file" name="script_hfcm_import_file" accept=".json,application/json" required /></p>
						<p><button type="submit" class="button button-primary"><?php esc_html_e( 'Import HFCM JSON', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>

				<div class="flowbie-wp-script-manager__panel">
					<h2><?php esc_html_e( 'Import Flowbie / CSV', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Upload a Flowbie JSON export or CSV. Matching names are updated; others are added.', 'flowbie-wp' ); ?></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_IMPORT_SCRIPTS ); ?>" />
						<?php wp_nonce_field( self::ACTION_IMPORT_SCRIPTS, 'flowbie_wp_import_scripts_nonce' ); ?>
						<p><input type="file" name="script_import_file" accept=".json,.csv,application/json,text/csv" required /></p>
						<p><button type="submit" class="button button-secondary"><?php esc_html_e( 'Import Flowbie file', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>

				<div class="flowbie-wp-script-manager__panel">
					<h2><?php esc_html_e( 'Export JSON', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Download all non-trash scripts as Flowbie JSON for backup or migration.', 'flowbie-wp' ); ?></p>
					<p><code>version, exported_at, scripts[]</code></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_SCRIPTS_JSON ); ?>" />
						<?php wp_nonce_field( self::ACTION_EXPORT_SCRIPTS_JSON, 'flowbie_wp_export_scripts_json_nonce' ); ?>
						<p><button type="submit" class="button button-secondary"><?php esc_html_e( 'Export JSON', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>

				<div class="flowbie-wp-script-manager__panel">
					<h2><?php esc_html_e( 'Export CSV', 'flowbie-wp' ); ?></h2>
					<p><?php esc_html_e( 'Download all non-trash scripts for spreadsheet editing.', 'flowbie-wp' ); ?></p>
					<p><code>id,name,placement,code,status,priority,category,display_rules,created_at,updated_at</code></p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_EXPORT_SCRIPTS ); ?>" />
						<?php wp_nonce_field( self::ACTION_EXPORT_SCRIPTS, 'flowbie_wp_export_scripts_nonce' ); ?>
						<p><button type="submit" class="button button-secondary"><?php esc_html_e( 'Export CSV', 'flowbie-wp' ); ?></button></p>
					</form>
				</div>
			</div>
		<?php
		self::flowbie_group_shell_close();
	}

	private static function render_script_settings_page(): void {
		$settings = Flowbie_Wp_Script_Manager::get_settings();
		self::flowbie_group_shell_open( 'flowbie-wp-script-manager', 'flowbie-wp-script-manager' );
		?>
			<h1><?php esc_html_e( 'Script Manager Settings', 'flowbie-wp' ); ?></h1>
			<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=flowbie-wp-script-manager' ) ); ?>">&larr; <?php esc_html_e( 'Back to list', 'flowbie-wp' ); ?></a></p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION_SAVE_SCRIPT_SETTINGS ); ?>" />
				<?php wp_nonce_field( self::ACTION_SAVE_SCRIPT_SETTINGS, 'flowbie_wp_script_settings_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="default_script_category"><?php esc_html_e( 'Default category', 'flowbie-wp' ); ?></label></th>
						<td>
							<input name="default_script_category" id="default_script_category" type="text" class="regular-text" value="<?php echo esc_attr( (string) $settings['default_category'] ); ?>" />
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Customizer preview', 'flowbie-wp' ); ?></th>
						<td>
							<label for="customizer_preview">
								<input name="customizer_preview" id="customizer_preview" type="checkbox" value="1" <?php checked( ! empty( $settings['customizer_preview'] ) ); ?> />
								<?php esc_html_e( 'Load scripts in the Customizer preview', 'flowbie-wp' ); ?>
							</label>
						</td>
					</tr>
				</table>
				<p class="submit"><button type="submit" class="button button-primary"><?php esc_html_e( 'Save Settings', 'flowbie-wp' ); ?></button></p>
			</form>
		<?php
		self::flowbie_group_shell_close();
	}

	public static function enqueue_script_manager_assets(): void {
		$rel = 'assets/admin/admin-script-manager.js';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		$ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.5.0';
		if ( is_readable( $abs ) ) {
			$ver .= '.' . (string) filemtime( $abs );
		}
		wp_enqueue_script(
			'flowbie-wp-admin-script-manager',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
			array(),
			$ver,
			true
		);
	}
}

<?php
/**
 * Tool Library admin page: MCP / agent tool dictionary.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Tool_Library {

	public static function render_tool_library_page(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'flowbie-wp' ) );
		}

		$dashboard_url = admin_url( 'admin.php?page=flowbie-wp' );
		$grouped       = Flowbie_Wp_Tools_Library::get_entries_by_category();
		$tool_count    = Flowbie_Wp_Tools_Library::tool_count();
		$version       = Flowbie_Wp_Tools::VERSION;
		self::flowbie_group_shell_open( 'flowbie-wp-tool-library', 'flowbie-wp-panel-page flowbie-wp-tool-library' );
		self::panel_page_header(
				__( 'Reference for all agent tools exposed via MCP and the Flowbie tools REST API. Use these names in Cursor, Claude Desktop, or custom automations.', 'flowbie-wp' ),
				$dashboard_url
			); ?>

			<div class="flowbie-wp-tool-library__toolbar">
				<label class="screen-reader-text" for="flowbie-tool-library-search"><?php esc_html_e( 'Search tools', 'flowbie-wp' ); ?></label>
				<input type="search" id="flowbie-tool-library-search" class="flowbie-wp-tool-library__search" placeholder="<?php esc_attr_e( 'Search by name or description…', 'flowbie-wp' ); ?>" autocomplete="off" />
				<p class="flowbie-wp-tool-library__meta">
					<?php
					printf(
						/* translators: 1: tool count, 2: API version */
						esc_html__( '%1$d tools · API version %2$s · Execute via', 'flowbie-wp' ),
						(int) $tool_count,
						esc_html( (string) $version )
					);
					?>
					<code>POST /wp-json/flowbie/v1/tools/execute</code>
				</p>
			</div>

			<div class="flowbie-wp-tool-library__legend" aria-hidden="true">
				<span class="flowbie-wp-tool-library__risk flowbie-wp-tool-library__risk--read"><?php esc_html_e( 'read', 'flowbie-wp' ); ?></span>
				<span class="flowbie-wp-tool-library__risk flowbie-wp-tool-library__risk--write"><?php esc_html_e( 'write', 'flowbie-wp' ); ?></span>
				<span class="flowbie-wp-tool-library__risk flowbie-wp-tool-library__risk--destructive"><?php esc_html_e( 'destructive', 'flowbie-wp' ); ?></span>
				<span class="flowbie-wp-tool-library__confirm-hint"><?php esc_html_e( 'confirm: true required on marked tools', 'flowbie-wp' ); ?></span>
			</div>

			<div class="flowbie-wp-tool-library__mcp">
				<h2 class="flowbie-wp-tool-library__mcp-title"><?php esc_html_e( 'MCP setup (Cursor)', 'flowbie-wp' ); ?></h2>
				<p><?php esc_html_e( 'Use a WordPress Application Password. OpenRouter and other secrets stay on the server.', 'flowbie-wp' ); ?></p>
				<pre class="flowbie-wp-tool-library__code"><code>{
  "mcpServers": {
    "flowbie-wp": {
      "command": "npx",
      "args": ["-y", "@flowbie/flowbie-wp-mcp"],
      "env": {
        "WP_URL": "<?php echo esc_html( home_url( '/' ) ); ?>",
        "WP_APP_USER": "your-username",
        "WP_APP_PASSWORD": "your-application-password"
      }
    }
  }
}</code></pre>
			</div>

			<?php foreach ( $grouped as $cat_slug => $entries ) : ?>
				<?php if ( empty( $entries ) ) { continue; } ?>
				<section class="flowbie-wp-tool-library__section" data-category="<?php echo esc_attr( $cat_slug ); ?>">
					<h2 class="flowbie-wp-tool-library__section-title">
						<?php echo esc_html( Flowbie_Wp_Tools_Library::get_categories()[ $cat_slug ] ?? $cat_slug ); ?>
						<span class="flowbie-wp-tool-library__section-count"><?php echo (int) count( $entries ); ?></span>
					</h2>
					<div class="flowbie-wp-tool-library__grid">
						<?php foreach ( $entries as $tool ) : ?>
							<?php self::render_tool_library_card( $tool ); ?>
						<?php endforeach; ?>
					</div>
				</section>
			<?php endforeach; ?>

			<p class="flowbie-wp-tool-library__empty" id="flowbie-tool-library-empty" hidden>
				<?php esc_html_e( 'No tools match your search.', 'flowbie-wp' ); ?>
			</p>

		<script>
		(function () {
			var input = document.getElementById('flowbie-tool-library-search');
			var empty = document.getElementById('flowbie-tool-library-empty');
			if (!input) return;
			input.addEventListener('input', function () {
				var q = (input.value || '').toLowerCase().trim();
				var any = false;
				document.querySelectorAll('.flowbie-wp-tool-library__card').forEach(function (card) {
					var hay = (card.getAttribute('data-search') || '').toLowerCase();
					var show = !q || hay.indexOf(q) !== -1;
					card.hidden = !show;
					if (show) any = true;
				});
				document.querySelectorAll('.flowbie-wp-tool-library__section').forEach(function (sec) {
					var visible = sec.querySelectorAll('.flowbie-wp-tool-library__card:not([hidden])').length;
					sec.hidden = visible === 0;
				});
				if (empty) empty.hidden = any || !q;
			});
		})();
		</script>
		<?php
		self::flowbie_group_shell_close();
	}

	/**
	 * @param array<string, mixed> $tool Tool entry.
	 */
	private static function render_tool_library_card( array $tool ): void {
		$risk   = isset( $tool['risk'] ) ? (string) $tool['risk'] : 'read';
		$search = strtolower(
			$tool['name'] . ' ' . $tool['description'] . ' ' . $tool['summary'] . ' ' . implode( ' ', array_keys( (array) $tool['params'] ) )
		);
		?>
		<article class="flowbie-wp-tool-library__card" data-search="<?php echo esc_attr( $search ); ?>">
			<header class="flowbie-wp-tool-library__card-head">
				<code class="flowbie-wp-tool-library__name"><?php echo esc_html( $tool['name'] ); ?></code>
				<span class="flowbie-wp-tool-library__risk flowbie-wp-tool-library__risk--<?php echo esc_attr( $risk ); ?>"><?php echo esc_html( $risk ); ?></span>
			</header>
			<p class="flowbie-wp-tool-library__desc"><?php echo esc_html( $tool['summary'] ); ?></p>
			<dl class="flowbie-wp-tool-library__meta-dl">
				<div>
					<dt><?php esc_html_e( 'Capability', 'flowbie-wp' ); ?></dt>
					<dd><code><?php echo esc_html( (string) $tool['capability'] ); ?></code></dd>
				</div>
				<?php if ( ! empty( $tool['requires_confirm'] ) ) : ?>
					<div>
						<dt><?php esc_html_e( 'Confirm', 'flowbie-wp' ); ?></dt>
						<dd><code>confirm: true</code></dd>
					</div>
				<?php endif; ?>
			</dl>
			<?php if ( ! empty( $tool['params'] ) && is_array( $tool['params'] ) ) : ?>
				<details class="flowbie-wp-tool-library__params">
					<summary><?php esc_html_e( 'Parameters', 'flowbie-wp' ); ?></summary>
					<dl class="flowbie-wp-tool-library__params-dl">
						<?php foreach ( $tool['params'] as $param => $help ) : ?>
							<div>
								<dt><code><?php echo esc_html( (string) $param ); ?></code></dt>
								<dd><?php echo esc_html( (string) $help ); ?></dd>
							</div>
						<?php endforeach; ?>
					</dl>
				</details>
			<?php endif; ?>
			<?php if ( ! empty( $tool['example'] ) ) : ?>
				<details class="flowbie-wp-tool-library__example">
					<summary><?php esc_html_e( 'Example', 'flowbie-wp' ); ?></summary>
					<pre><code><?php echo esc_html( (string) $tool['example'] ); ?></code></pre>
				</details>
			<?php endif; ?>
		</article>
		<?php
	}
}

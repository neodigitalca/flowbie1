<?php
/**
 * Flowbie dashboard progress strip for the plugin admin screen.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Progress_Strip {

	private static function progress_number_or_null( $value ): ?int {
		if ( is_int( $value ) ) {
			return $value;
		}
		if ( is_float( $value ) && is_finite( $value ) ) {
			return (int) $value;
		}
		if ( is_string( $value ) && is_numeric( $value ) ) {
			return (int) $value;
		}
		return null;
	}

	private static function progress_period_badge( string $label ): string {
		$label = trim( $label );
		if ( preg_match( '/^(Q[1-4])\s+\d{4}$/i', $label, $m ) ) {
			return strtoupper( $m[1] );
		}
		$parts = preg_split( '/\s+/', $label );
		return is_array( $parts ) && ! empty( $parts[0] ) ? (string) $parts[0] : $label;
	}

	private static function progress_icon( string $name ): string {
		$attrs = 'class="flowbie-wp-progress-strip__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
		if ( 'piggy-bank' === $name ) {
			return '<svg ' . $attrs . '><path d="M19 5c-1.5 0-2.8.8-3.5 2H9a6 6 0 0 0-6 6v2h2l1 3h3l1-2h4l1 2h3l1-3h2v-4h-2.1a6 6 0 0 0-.9-2" /><path d="M2 9v3" /><path d="M6 8V5h4" /><circle cx="16" cy="11" r="1" /></svg>';
		}
		if ( 'map-pin' === $name ) {
			return '<svg ' . $attrs . '><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>';
		}
		if ( 'file-text' === $name ) {
			return '<svg ' . $attrs . '><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>';
		}
		if ( 'crosshair' === $name ) {
			return '<svg ' . $attrs . '><circle cx="12" cy="12" r="10" /><path d="M22 12h-4" /><path d="M6 12H2" /><path d="M12 6V2" /><path d="M12 22v-4" /></svg>';
		}
		return '<svg ' . $attrs . '><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /></svg>';
	}

	/**
	 * @param string $tone     Cell modifier (post-bank, sap-bank, …).
	 * @param string $value    Primary metric display.
	 * @param string $heading  Short column label (shown on full dashboard strip).
	 * @param string $icon     Optional SVG icon key.
	 * @param bool   $muted    Dim unavailable values.
	 * @param bool   $labeled  Stack heading above value (dashboard bar).
	 */
	private static function render_progress_cell(
		string $tone,
		string $value,
		string $heading = '',
		string $icon = '',
		bool $muted = false,
		bool $labeled = false
	): void {
		$classes = 'flowbie-wp-progress-strip__cell flowbie-wp-progress-strip__cell--' . $tone;
		if ( $muted ) {
			$classes .= ' flowbie-wp-progress-strip__cell--muted';
		}
		if ( $labeled && '' !== $heading ) {
			$classes .= ' flowbie-wp-progress-strip__cell--labeled';
		}
		$aria = '' !== $heading ? trim( $heading . ': ' . $value ) : $value;
		?>
		<div class="<?php echo esc_attr( $classes ); ?>" title="<?php echo esc_attr( $aria ); ?>" aria-label="<?php echo esc_attr( $aria ); ?>">
			<?php if ( $labeled && '' !== $heading ) : ?>
				<span class="flowbie-wp-progress-strip__label"><?php echo esc_html( $heading ); ?></span>
			<?php endif; ?>
			<span class="flowbie-wp-progress-strip__metric">
				<?php
				if ( '' !== $icon ) {
					echo self::progress_icon( $icon ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				}
				?>
				<span class="flowbie-wp-progress-strip__value"><?php echo esc_html( $value ); ?></span>
			</span>
		</div>
		<?php
	}

	private static function flowbie_wp_progress_settings_url(): string {
		return admin_url( 'admin.php?page=flowbie-wp-settings' );
	}

	/**
	 * @param array<string,mixed>|null $progress_payload Progress object from plugin dashboard API.
	 * @param string                   $layout           `compact` or `full` (dashboard bar).
	 */
	public static function render_site_progress_strip( ?array $progress_payload = null, string $layout = 'compact' ): void {
		$strip_class = 'flowbie-wp-progress-strip';
		if ( 'full' === $layout ) {
			$strip_class .= ' flowbie-wp-progress-strip--full';
		}
		if ( ! is_array( $progress_payload ) || empty( $progress_payload['ok'] ) ) {
			$error = '';
			if ( is_array( $progress_payload ) && isset( $progress_payload['error'] ) && is_string( $progress_payload['error'] ) ) {
				$error = $progress_payload['error'];
			}
			if ( $error === '' ) {
				$error = __( 'Property metrics are unavailable.', 'flowbie-wp' );
			}
			$settings_url = self::flowbie_wp_progress_settings_url();
			?>
			<div class="flowbie-wp-progress-strip flowbie-wp-progress-strip--notice" role="alert" aria-live="polite">
				<p class="flowbie-wp-progress-strip__message">
					<?php echo esc_html( $error ); ?>
					<a class="flowbie-wp-progress-strip__settings-link" href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Settings', 'flowbie-wp' ); ?></a>
				</p>
			</div>
			<?php
			return;
		}

		$post_bank = self::progress_number_or_null( $progress_payload['postBankPending'] ?? null );
		$sap_bank  = self::progress_number_or_null( $progress_payload['sapBankPending'] ?? null );

		$optimization       = isset( $progress_payload['optimization'] ) && is_array( $progress_payload['optimization'] ) ? $progress_payload['optimization'] : array();
		$total_optimized    = self::progress_number_or_null( $optimization['totalOptimized'] ?? null );
		$optimization_cap   = self::progress_number_or_null( $optimization['cap'] ?? null );
		$optimization_label = ( null !== $total_optimized && null !== $optimization_cap ) ? $total_optimized . '/' . $optimization_cap : '';

		$quarter       = isset( $progress_payload['quarter'] ) && is_array( $progress_payload['quarter'] ) ? $progress_payload['quarter'] : array();
		$posts_live    = self::progress_number_or_null( $quarter['postsLive'] ?? null );
		$posts_sched   = self::progress_number_or_null( $quarter['postsScheduled'] ?? null );
		$posts_total   = ( null !== $posts_live && null !== $posts_sched ) ? $posts_live + $posts_sched : null;
		$entity_live   = self::progress_number_or_null( $quarter['entityLive'] ?? null );
		$entity_sched  = self::progress_number_or_null( $quarter['entityScheduled'] ?? null );
		$entity_cfg    = ! empty( $quarter['entityConfigured'] );
		$entity_total  = ( ! empty( $quarter['entityCountsAvailable'] ) && null !== $entity_live && null !== $entity_sched ) ? $entity_live + $entity_sched : null;
		$quarter_label = isset( $progress_payload['quarterLabel'] ) && is_string( $progress_payload['quarterLabel'] ) ? self::progress_period_badge( $progress_payload['quarterLabel'] ) : '';

		$na_bank     = __( 'N/A', 'flowbie-wp' );
		$na_quarter  = __( '—', 'flowbie-wp' );
		$show_entity = $entity_cfg;
		$labeled     = 'full' === $layout;

		$heading_post_bank    = __( 'Post bank', 'flowbie-wp' );
		$heading_sap_bank     = __( 'SAP bank', 'flowbie-wp' );
		$heading_optimization = __( 'Optimizations', 'flowbie-wp' );
		$heading_quarter      = __( 'Period', 'flowbie-wp' );
		$heading_posts        = __( 'Posts', 'flowbie-wp' );
		$heading_entities     = __( 'Entities', 'flowbie-wp' );

		?>
		<div class="<?php echo esc_attr( $strip_class ); ?>" role="status" aria-label="<?php esc_attr_e( 'Flowbie property metrics for this site (post bank, SAP, optimization, editorial period)', 'flowbie-wp' ); ?>">
			<?php
			if ( null !== $post_bank ) {
				self::render_progress_cell( 'post-bank', (string) $post_bank, $heading_post_bank, 'piggy-bank', false, $labeled );
			} else {
				self::render_progress_cell( 'post-bank', $na_bank, $heading_post_bank, 'piggy-bank', true, $labeled );
			}
			if ( null !== $sap_bank ) {
				self::render_progress_cell( 'sap-bank', (string) $sap_bank, $heading_sap_bank, 'map-pin', false, $labeled );
			} else {
				self::render_progress_cell( 'sap-bank', $na_bank, $heading_sap_bank, 'map-pin', true, $labeled );
			}
			if ( '' !== $optimization_label ) {
				self::render_progress_cell( 'optimization', $optimization_label, $heading_optimization, 'sparkles', false, $labeled );
			} else {
				self::render_progress_cell( 'optimization', $na_bank, $heading_optimization, 'sparkles', true, $labeled );
			}
			if ( '' !== $quarter_label ) {
				self::render_progress_cell( 'quarter', $quarter_label, $heading_quarter, '', false, $labeled );
			} else {
				self::render_progress_cell( 'quarter', $na_quarter, $heading_quarter, '', true, $labeled );
			}
			if ( null !== $posts_total ) {
				self::render_progress_cell( 'posts', (string) $posts_total, $heading_posts, 'file-text', false, $labeled );
			} else {
				self::render_progress_cell( 'posts', '0', $heading_posts, 'file-text', true, $labeled );
			}
			if ( $show_entity ) {
				if ( null !== $entity_total ) {
					self::render_progress_cell( 'entities', (string) $entity_total, $heading_entities, 'crosshair', false, $labeled );
				} else {
					self::render_progress_cell( 'entities', $na_bank, $heading_entities, 'crosshair', true, $labeled );
				}
			}
			?>
		</div>
		<?php
	}
}

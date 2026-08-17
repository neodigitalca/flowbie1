<?php
/**
 * Shared NEO Pulse property detail grid (dashboard + settings).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Neo_Pulse_Wp_Admin_Trait_Render_Property_Grid {

	/**
	 * @param mixed $value
	 */
	protected static function property_grid_display_value( $value ): string {
		if ( is_bool( $value ) ) {
			return $value ? __( 'Yes', 'neo-pulse-wp' ) : __( 'No', 'neo-pulse-wp' );
		}
		$text = trim( (string) $value );
		return $text !== '' ? $text : '—';
	}

	/**
	 * @param array<string,mixed> $client
	 */
	protected static function render_property_detail_grid( array $client ): void {
		$fields = array(
			array(
				'label' => __( 'Site ID', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['siteId'] ?? '' ),
				'mono'  => true,
			),
			array(
				'label' => __( 'Site URL', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['siteUrl'] ?? '' ),
				'link'  => isset( $client['siteUrl'] ) ? (string) $client['siteUrl'] : '',
			),
			array(
				'label' => __( 'Production URL', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['productionSiteUrl'] ?? '' ),
				'link'  => isset( $client['productionSiteUrl'] ) ? (string) $client['productionSiteUrl'] : '',
			),
			array(
				'label' => __( 'Package', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['optimizationPackage'] ?? '' ),
			),
			array(
				'label' => __( 'Editorial period start', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['editorialCountsPeriodStartYmd'] ?? '' ),
			),
			array(
				'label' => __( 'Connection status', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['connectionStatus'] ?? '' ),
			),
			array(
				'label' => __( 'GA4 property', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['ga4PropertyId'] ?? '' ),
				'mono'  => true,
			),
			array(
				'label' => __( 'GBP location', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['gbpLocationId'] ?? '' ),
				'link'  => isset( $client['gbpLocationId'] ) && 0 === strpos( (string) $client['gbpLocationId'], 'http' ) ? (string) $client['gbpLocationId'] : '',
			),
			array(
				'label' => __( 'Semrush project', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['semrushSiteAuditProjectId'] ?? '' ),
				'mono'  => true,
			),
			array(
				'label' => __( 'Entity sitemap', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['entitySitemapUrl'] ?? '' ),
				'link'  => isset( $client['entitySitemapUrl'] ) ? (string) $client['entitySitemapUrl'] : '',
			),
			array(
				'label' => __( 'Manual endpoint', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['manualEndpoint'] ?? '' ),
				'mono'  => true,
			),
			array(
				'label' => __( 'Enabled in NEO Pulse', 'neo-pulse-wp' ),
				'value' => self::property_grid_display_value( $client['enabled'] ?? null ),
			),
		);
		?>
		<div class="neo-pulse-wp-property-grid" role="region" aria-label="<?php esc_attr_e( 'NEO Pulse property details', 'neo-pulse-wp' ); ?>">
			<?php foreach ( $fields as $field ) : ?>
				<div class="neo-pulse-wp-property-grid__cell">
					<div class="neo-pulse-wp-property-grid__label"><?php echo esc_html( (string) $field['label'] ); ?></div>
					<div class="neo-pulse-wp-property-grid__value<?php echo ! empty( $field['mono'] ) ? ' neo-pulse-wp-property-grid__value--mono' : ''; ?>">
						<?php
						$link = isset( $field['link'] ) ? trim( (string) $field['link'] ) : '';
						if ( $link !== '' && $field['value'] !== '—' ) {
							printf(
								'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a>',
								esc_url( $link ),
								esc_html( (string) $field['value'] )
							);
						} else {
							echo esc_html( (string) $field['value'] );
						}
						?>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
		<?php
	}
}

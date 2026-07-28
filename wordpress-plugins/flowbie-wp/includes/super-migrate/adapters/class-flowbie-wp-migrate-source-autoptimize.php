<?php
/**
 * Autoptimize → Flowbie Speed adapter.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

class Flowbie_Wp_Migrate_Source_Autoptimize implements Flowbie_Wp_Migrate_Adapter {

	public function get_id(): string {
		return 'autoptimize';
	}

	public function get_macro_group(): string {
		return 'performance';
	}

	public function get_label(): string {
		return __( 'Autoptimize', 'flowbie-wp' );
	}

	public function is_available(): bool {
		return ! empty( $this->detect()['active'] );
	}

	/**
	 * @return array<string, mixed>
	 */
	public function detect(): array {
		$active = defined( 'AUTOPTIMIZE_PLUGIN_VERSION' ) || class_exists( 'autoptimizeMain', false );
		return array(
			'active'  => $active,
			'version' => defined( 'AUTOPTIMIZE_PLUGIN_VERSION' ) ? AUTOPTIMIZE_PLUGIN_VERSION : '',
		);
	}

	public function get_steps( string $phase ): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		if ( 'crawl' === $phase ) {
			return array(
				array(
					'id'    => 'autoptimize_crawl',
					'label' => __( 'Crawl Autoptimize settings', 'flowbie-wp' ),
					'total' => 1,
				),
			);
		}
		if ( 'apply' === $phase ) {
			return array(
				array(
					'id'    => 'autoptimize_apply',
					'label' => __( 'Apply settings to Flowbie Speed', 'flowbie-wp' ),
					'total' => 1,
				),
			);
		}
		return array();
	}

	/**
	 * @param array<string, mixed> $sheet   Flo Sheet.
	 * @param array<string, mixed> $context Job context.
	 */
	public function run_step( string $step_id, string $phase, array &$sheet, array $context ): array {
		$dry = ! empty( $context['dry_run'] );

		if ( 'autoptimize_crawl' === $step_id ) {
			return $this->crawl( $sheet );
		}
		if ( 'autoptimize_apply' === $step_id ) {
			return $this->apply( $sheet, $dry );
		}

		return array(
			'ok'    => false,
			'error' => __( 'Unknown Autoptimize import step.', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function crawl( array &$sheet ): array {
		$snapshot = array(
			'autoptimize_css'           => get_option( 'autoptimize_css', '' ),
			'autoptimize_js'            => get_option( 'autoptimize_js', '' ),
			'autoptimize_html'          => get_option( 'autoptimize_html', false ),
			'autoptimize_css_aggregate' => get_option( 'autoptimize_css_aggregate', false ),
			'autoptimize_js_aggregate'  => get_option( 'autoptimize_js_aggregate', false ),
			'autoptimize_js_defer'      => get_option( 'autoptimize_js_defer', false ),
			'autoptimize_js_exclude'    => get_option( 'autoptimize_js_exclude', '' ),
			'autoptimize_css_exclude'   => get_option( 'autoptimize_css_exclude', '' ),
		);

		$mapped = array(
			'optimize_css'  => ( 'on' === $snapshot['autoptimize_css'] || '1' === $snapshot['autoptimize_css'] ),
			'optimize_js'   => ( 'on' === $snapshot['autoptimize_js'] || '1' === $snapshot['autoptimize_js'] ),
			'minify_html'   => (bool) $snapshot['autoptimize_html'],
			'aggregate_css' => (bool) $snapshot['autoptimize_css_aggregate'],
			'aggregate_js'  => (bool) $snapshot['autoptimize_js_aggregate'],
			'defer_js'      => (bool) $snapshot['autoptimize_js_defer'],
			'js_exclude'    => is_string( $snapshot['autoptimize_js_exclude'] ) ? $snapshot['autoptimize_js_exclude'] : '',
			'css_exclude'   => is_string( $snapshot['autoptimize_css_exclude'] ) ? $snapshot['autoptimize_css_exclude'] : '',
			'_source'       => 'autoptimize',
			'_raw'          => $snapshot,
		);

		$sheet['sheets']['speed'] = array_merge(
			isset( $sheet['sheets']['speed'] ) && is_array( $sheet['sheets']['speed'] ) ? $sheet['sheets']['speed'] : array(),
			$mapped
		);

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => __( 'Autoptimize settings crawled into Flo Sheet.', 'flowbie-wp' ),
		);
	}

	/**
	 * @param array<string, mixed> $sheet Flo Sheet.
	 */
	private function apply( array $sheet, bool $dry ): array {
		$speed = isset( $sheet['sheets']['speed'] ) && is_array( $sheet['sheets']['speed'] ) ? $sheet['sheets']['speed'] : array();
		if ( empty( $speed['_source'] ) || 'autoptimize' !== $speed['_source'] ) {
			if ( $this->is_available() ) {
				if ( $dry ) {
					return array(
						'ok'      => true,
						'done'    => true,
						'message' => __( 'Dry run: would import Autoptimize settings via Speed helper.', 'flowbie-wp' ),
					);
				}
				Flowbie_Wp_Speed_Settings::maybe_import_autoptimize();
				return array(
					'ok'      => true,
					'done'    => true,
					'message' => __( 'Autoptimize settings imported into Flowbie Speed.', 'flowbie-wp' ),
				);
			}
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'No Autoptimize data in Flo Sheet.', 'flowbie-wp' ),
				'stats'   => array( 'skipped' => 1 ),
			);
		}

		if ( $dry ) {
			return array(
				'ok'      => true,
				'done'    => true,
				'message' => __( 'Dry run: would apply Autoptimize speed mapping.', 'flowbie-wp' ),
			);
		}

		$config = Flowbie_Wp_Speed_Settings::get_config();
		foreach ( array( 'optimize_css', 'optimize_js', 'minify_html', 'aggregate_css', 'aggregate_js', 'defer_js' ) as $key ) {
			if ( array_key_exists( $key, $speed ) ) {
				$config[ $key ] = (bool) $speed[ $key ];
			}
		}
		if ( ! empty( $speed['js_exclude'] ) && is_string( $speed['js_exclude'] ) ) {
			$config['js_exclude'] = Flowbie_Wp_Speed_Settings::sanitize_exclude_lines( $speed['js_exclude'] );
		}
		if ( ! empty( $speed['css_exclude'] ) && is_string( $speed['css_exclude'] ) ) {
			$config['css_exclude'] = Flowbie_Wp_Speed_Settings::sanitize_exclude_lines( $speed['css_exclude'] );
		}
		$config['imported_autoptimize'] = true;
		Flowbie_Wp_Speed_Settings::save_config( $config );

		return array(
			'ok'      => true,
			'done'    => true,
			'message' => __( 'Autoptimize settings applied to Flowbie Speed.', 'flowbie-wp' ),
		);
	}
}

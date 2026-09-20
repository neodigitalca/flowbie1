$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$needles = array( 'Clinic owner', 'Home services owner', 'Retail manager', 'Professional services lead' );
$hits = array();

function nd_walk( $elements, $needles, &$hits ) {
	if ( ! is_array( $elements ) ) {
		return;
	}
	foreach ( $elements as $el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		$settings = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
		$blob = wp_json_encode( $settings );
		foreach ( $needles as $n ) {
			if ( is_string( $blob ) && strpos( $blob, $n ) !== false ) {
				$hits[] = array(
					'id'     => isset( $el['id'] ) ? $el['id'] : '',
					'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : '',
					'needle' => $n,
					'keys'   => array_keys( $settings ),
				);
			}
		}
		if ( ! empty( $el['elements'] ) ) {
			nd_walk( $el['elements'], $needles, $hits );
		}
	}
}

if ( is_array( $data ) ) {
	nd_walk( $data, $needles, $hits );
}

echo wp_json_encode( array( 'ok' => true, 'hits' => $hits ) );

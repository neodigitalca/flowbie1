$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
$hits = array();

function nd_walk( $elements, &$hits, $depth = 0 ) {
	if ( ! is_array( $elements ) ) {
		return;
	}
	foreach ( $elements as $el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		$settings = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
		foreach ( $settings as $key => $val ) {
			if ( ! is_string( $val ) ) {
				continue;
			}
			if ( stripos( $val, 'Edmonton SEO built' ) === false && stripos( $val, 'Edmonton SEO facts' ) === false && stripos( $val, 'Blind Magic case study' ) === false ) {
				continue;
			}
			$hits[] = array(
				'id'     => isset( $el['id'] ) ? $el['id'] : '',
				'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : ( $el['elType'] ?? '' ),
				'key'    => $key,
				'len'    => strlen( $val ),
				'head'   => substr( wp_strip_all_tags( $val ), 0, 180 ),
			);
		}
		if ( ! empty( $el['elements'] ) ) {
			nd_walk( $el['elements'], $hits, $depth + 1 );
		}
	}
}

if ( is_array( $data ) ) {
	nd_walk( $data, $hits );
}
echo wp_json_encode( array( 'ok' => true, 'hits' => $hits ) );

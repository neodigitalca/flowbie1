$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
if ( ! is_array( $data ) ) {
	echo wp_json_encode( array( 'error' => 'no elementor' ) );
	return;
}

$phoenix = 'Phoenix Painting: site clicks 129 to 282, impressions 42,500 to 73,986, average position 51.4 to 28.6 (Search Console, same 12-month compare).';

function nd_walk( &$elements, $phoenix, &$count ) {
	foreach ( $elements as &$el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		if ( isset( $el['id'] ) && $el['id'] === '007e2e5' && isset( $el['settings']['testimonials'] ) && is_array( $el['settings']['testimonials'] ) ) {
			$image = isset( $el['settings']['testimonials'][0]['image'] ) ? $el['settings']['testimonials'][0]['image'] : array( 'url' => '', 'id' => '' );
			$el['settings']['testimonials'][3] = array(
				'name'        => 'Phoenix Painting',
				'job_title'   => 'Edmonton painting',
				'description' => $phoenix,
				'image'       => $image,
				'_id'         => 'phxsc001',
			);
			$count++;
		}
		if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
			foreach ( $el['settings'] as $key => $val ) {
				if ( is_string( $val ) && strpos( $val, 'Edmonton SEO facts (September 2026)' ) !== false && strpos( $val, 'Phoenix Painting' ) === false ) {
					$el['settings'][ $key ] = rtrim( $val ) . ' ' . $phoenix;
					$count++;
				}
			}
		}
		if ( ! empty( $el['elements'] ) ) {
			nd_walk( $el['elements'], $phoenix, $count );
		}
	}
}

$count = 0;
nd_walk( $data, $phoenix, $count );
update_post_meta( 10203, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
if ( class_exists( '\Elementor\Plugin' ) ) {
	$document = \Elementor\Plugin::$instance->documents->get( 10203 );
	if ( $document ) {
		$document->save( array( 'elements' => $data ) );
	}
	\Elementor\Plugin::$instance->files_manager->clear_cache();
}
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
	Neo_Pulse_Wp_Cache_Flush::flush_all();
}
$after = get_post_meta( 10203, '_elementor_data', true );
echo wp_json_encode(
	array(
		'ok'      => true,
		'count'   => $count,
		'phoenix' => is_string( $after ) && strpos( $after, 'Phoenix Painting' ) !== false,
		'clinic'  => is_string( $after ) && strpos( $after, 'Clinic owner' ) !== false,
	)
);

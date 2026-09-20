$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
if ( ! is_array( $data ) ) {
	echo wp_json_encode( array( 'error' => 'no elementor' ) );
	return;
}

$facts = 'Edmonton SEO facts (September 2026): typical retainers sit between $1,500 and $3,500 a month. Google Business Profile and on-page work can move in the first weeks. Competitive local pack terms take a few months. Blind Magic site clicks went from 4,066 to 11,382, impressions 460,723 to 1,163,424, average position 31.5 to 20.0. Phoenix Painting: site clicks 129 to 282, impressions 42,500 to 73,986, average position 51.4 to 28.6. Neo Digital does not run a national city-SEO factory.';

$report = array(
	'stripped' => 0,
	'heading'  => array(),
);

function nd_walk_fix( &$elements, &$report ) {
	foreach ( $elements as &$el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		$widget = isset( $el['widgetType'] ) ? (string) $el['widgetType'] : '';
		if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
			foreach ( $el['settings'] as $key => $val ) {
				if ( ! is_string( $val ) || strpos( $val, 'Edmonton SEO facts (September 2026)' ) === false ) {
					continue;
				}
				$el['settings'][ $key ] = trim( preg_replace( '/\s*Edmonton SEO facts \(September 2026\).*/s', '', $val ) );
				if ( $el['settings'][ $key ] === '' ) {
					$el['settings'][ $key ] = 'Edmonton SEO built for local search.';
				}
				$report['stripped']++;
				$report['heading'][] = array(
					'id'     => isset( $el['id'] ) ? $el['id'] : '',
					'widget' => $widget,
					'key'    => $key,
					'after'  => $el['settings'][ $key ],
				);
			}
		}
		if ( ! empty( $el['elements'] ) ) {
			nd_walk_fix( $el['elements'], $report );
		}
	}
}

nd_walk_fix( $data, $report );

function &nd_find( &$elements, $id ) {
	foreach ( $elements as &$el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		if ( isset( $el['id'] ) && $el['id'] === $id ) {
			return $el;
		}
		if ( ! empty( $el['elements'] ) ) {
			$hit =& nd_find( $el['elements'], $id );
			if ( $hit !== null ) {
				return $hit;
			}
		}
	}
	unset( $el );
	$none = null;
	return $none;
}

$proof =& nd_find( $data, '007e2e5' );
$placed = false;
if ( $proof && isset( $proof['settings']['testimonials'] ) && is_array( $proof['settings']['testimonials'] ) ) {
	$first = $proof['settings']['testimonials'][0]['description'] ?? '';
	if ( is_string( $first ) && strpos( $first, 'Edmonton SEO facts (September 2026)' ) === false ) {
		$proof['settings']['testimonials'][0]['description'] = $facts . ' ' . $first;
		$placed = 'testimonial-0';
	}
}

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
		'ok'            => true,
		'report'        => $report,
		'placed'        => $placed,
		'hero_has_facts'=> is_string( $after ) && preg_match( '/Edmonton SEO built for local search[\s\S]{0,40}Edmonton SEO facts/', $after ) === 1,
		'facts_remain'  => is_string( $after ) && strpos( $after, 'Edmonton SEO facts (September 2026)' ) !== false,
	)
);

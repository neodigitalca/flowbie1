$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );
if ( ! is_array( $data ) ) {
	echo wp_json_encode( array( 'error' => 'no elementor data' ) );
	return;
}

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

function nd_walk_facts( &$elements, &$count ) {
	$facts = 'Edmonton SEO facts (September 2026): typical retainers sit between $1,500 and $3,500 a month. Google Business Profile and on-page work can move in the first weeks. Competitive local pack terms take a few months. Blind Magic site clicks went from 4,066 to 11,382, impressions 460,723 to 1,163,424, average position 31.5 to 20.0. Neo Digital does not run a national city-SEO factory.';
	foreach ( $elements as &$el ) {
		if ( ! is_array( $el ) ) {
			continue;
		}
		if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
			foreach ( $el['settings'] as $key => $val ) {
				if ( ! is_string( $val ) ) {
					continue;
				}
				if ( strpos( $val, 'Clinic owner' ) !== false || strpos( $val, 'Retail manager' ) !== false ) {
					$el['settings'][ $key ] = str_replace(
						array( 'Clinic owner', 'Home services owner', 'Retail manager', 'Professional services lead' ),
						array( 'Blind Magic', 'Blind Magic', 'Blind Magic', 'Blind Magic' ),
						$val
					);
				}
				if ( strpos( $val, 'Edmonton SEO built for local search' ) !== false && strpos( $val, 'Edmonton SEO facts (September 2026)' ) === false ) {
					$el['settings'][ $key ] = rtrim( $val ) . "\n\n" . $facts;
					$count++;
				}
			}
		}
		if ( ! empty( $el['elements'] ) ) {
			nd_walk_facts( $el['elements'], $count );
		}
	}
}

$el =& nd_find( $data, '007e2e5' );
$image = array( 'url' => '', 'id' => '' );
if ( $el && isset( $el['settings']['testimonials'][0]['image'] ) ) {
	$image = $el['settings']['testimonials'][0]['image'];
}
if ( $el ) {
	$el['settings']['testimonials'] = array(
		array(
			'name'        => 'Blind Magic',
			'job_title'   => 'Window coverings, Edmonton',
			'description' => 'Site clicks 4,066 to 11,382, impressions 460,723 to 1,163,424, average position 31.5 to 20.0 (Search Console, 12 months ending August 2026 versus the year before).',
			'image'       => $image,
			'_id'         => 'bmsc001',
		),
		array(
			'name'        => 'Blind Magic',
			'job_title'   => 'alta blinds vs hunter douglas',
			'description' => 'Query position 30.8 to 1.9 after the 2026 rebuild. Published on the Blind Magic case study.',
			'image'       => $image,
			'_id'         => 'bmsc002',
		),
		array(
			'name'        => 'Blind Magic',
			'job_title'   => 'high end blinds edmonton',
			'description' => 'Query position 19.1 to 8.5. Same Search Console compare as the case study table.',
			'image'       => $image,
			'_id'         => 'bmsc003',
		),
		array(
			'name'        => 'Blind Magic',
			'job_title'   => 'plantation shutters edmonton',
			'description' => 'Query position 16.3 to 11.1. No invented ROI. Numbers are Search Console only.',
			'image'       => $image,
			'_id'         => 'bmsc004',
		),
	);
}

$facts_count = 0;
nd_walk_facts( $data, $facts_count );

$encoded = wp_json_encode( $data );
update_post_meta( 10203, '_elementor_data', wp_slash( $encoded ) );
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
		'ok'          => true,
		'facts_count' => $facts_count,
		'after'       => array(
			'personas' => is_string( $after ) && strpos( $after, 'Clinic owner' ) !== false,
			'blind'    => is_string( $after ) && strpos( $after, 'bmsc001' ) !== false,
			'facts'    => is_string( $after ) && strpos( $after, 'Edmonton SEO facts (September 2026)' ) !== false,
			'schema'   => is_string( $after ) && strpos( $after, 'ProfessionalService' ) !== false,
			'nap'      => is_string( $after ) && strpos( $after, '587-416-4130' ) !== false,
		),
	)
);

$raw = get_post_meta( 10203, '_elementor_data', true );
$data = json_decode( $raw, true );

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

$el =& nd_find( $data, '007e2e5' );
$first = array();
if ( $el && isset( $el['settings']['testimonials'][0] ) ) {
	$first = $el['settings']['testimonials'][0];
}
echo wp_json_encode(
	array(
		'ok'    => true,
		'count' => $el && isset( $el['settings']['testimonials'] ) ? count( $el['settings']['testimonials'] ) : 0,
		'keys'  => is_array( $first ) ? array_keys( $first ) : array(),
		'sample'=> $first,
	)
);

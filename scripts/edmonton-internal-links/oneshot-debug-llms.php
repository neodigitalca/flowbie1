$opt = get_option( 'neo_pulse_wp_llms_txt', null );
$file = ABSPATH . 'llms.txt';
$served = class_exists( 'Neo_Pulse_Wp_Llms_Txt' ) ? Neo_Pulse_Wp_Llms_Txt::get_content() : '';
echo wp_json_encode(
	array(
		'ok'           => true,
		'option_type'  => gettype( $opt ),
		'option_head'  => is_string( $opt ) ? substr( $opt, 0, 200 ) : ( is_array( $opt ) ? substr( (string) ( $opt['content'] ?? '' ), 0, 200 ) : null ),
		'file_exists'  => file_exists( $file ),
		'get_head'     => substr( $served, 0, 240 ),
		'has_save'     => class_exists( 'Neo_Pulse_Wp_Llms_Txt' ) && method_exists( 'Neo_Pulse_Wp_Llms_Txt', 'save_content' ),
	)
);

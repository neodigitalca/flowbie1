<?php
$h = file_get_contents( getenv( 'TEMP' ) . '/nd-home-211.html' );
echo 'egallery_src=' . ( preg_match( '/<script[^>]+src=[^>]+e-gallery\.min\.js/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'egallery_delay=' . ( str_contains( $h, 'e-gallery' ) && str_contains( $h, 'data-src=' ) && preg_match( '/data-src="[^"]*e-gallery/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'numerator_src=' . ( preg_match( '/<script[^>]+src=[^>]+jquery-numerator/', $h ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'delayed=' . substr_count( $h, 'data-neo-pulse-delay="1"' ) . PHP_EOL;

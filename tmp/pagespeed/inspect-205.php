<?php
$h = file_get_contents( $argv[1] );
preg_match( '/<head[\s\S]*?<\/head>/i', $h, $hm );
$head = $hm[0] ?? '';
echo 'inline_styles=' . preg_match_all( '/<style data-href=/', $h ) . PHP_EOL;
echo 'head_jquery=' . ( str_contains( $head, 'jquery.min.js' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'body_jquery=' . ( str_contains( $h, 'jquery.min.js' ) ? 'yes' : 'no' ) . PHP_EOL;
preg_match_all( '/<link[^>]+rel=["\']stylesheet["\'][^>]*>/i', $head, $css );
$block = 0;
$defer = 0;
foreach ( $css[0] as $tag ) {
	if ( stripos( $tag, 'media="print"' ) !== false ) {
		$defer++;
	} else {
		$block++;
		if ( preg_match( '/href=["\']([^"\']+)/', $tag, $u ) ) {
			echo 'HEAD_BLOCK ' . $u[1] . PHP_EOL;
		}
	}
}
echo "head_blocking={$block} head_deferred={$defer}\n";
echo 'mobile_sizes=' . ( str_contains( $h, 'sizes="(max-width: 767px) 80px, 80px"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'edmonton_sizes=' . ( str_contains( $h, 'sizes="(max-width: 480px) 92vw, 386px"' ) ? 'yes' : 'no' ) . PHP_EOL;

<?php
$path = getenv( 'TEMP' ) . '/nd-home-200.html';
$html = file_get_contents( $path );
echo 'bytes=' . strlen( $html ) . PHP_EOL;
echo 'plugin_css=' . ( str_contains( $html, 'body.home{color:#e8e8e8}' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'heading_white=' . ( str_contains( $html, '.elementor-element-64f68179 .elementor-heading-title{color:#fff!important}' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'aria_hidden=' . ( str_contains( $html, 'aria-hidden="true">Let’s Work Together</h2>' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'skip_style=' . ( str_contains( $html, 'id="neo-pulse-a11y-skip"' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'old_heading=' . ( str_contains( $html, '<h2 class="elementor-heading-title elementor-size-default">Let’s Work Together</h2>' ) ? 'yes' : 'no' ) . PHP_EOL;
if ( preg_match( '/<h2 class="elementor-heading-title elementor-size-default"[^>]*>Let’s Work Together<\/h2>/u', $html, $m ) ) {
	echo 'HEADING ' . $m[0] . PHP_EOL;
}

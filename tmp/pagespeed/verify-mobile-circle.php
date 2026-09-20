<?php
$path = getenv( 'TEMP' ) . '/nd-home-201.html';
$html = file_get_contents( $path );
echo 'bytes=' . strlen( $html ) . PHP_EOL;
echo 'force_css=' . ( str_contains( $html, 'neo-pulse-chat-mobile-force' ) || str_contains( $html, 'neo-pulse-chat-mobile-critical' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'hides_peek=' . ( str_contains( $html, 'fai-sidebar-root--peek:not(.fai-sidebar-root--open)' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'circle_edge=' . ( str_contains( $html, '#neo-pulse-chat-mobile-launcher.fcw-launcher--edge-tab' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'no_edge_exempt=' . ( str_contains( $html, ':not(.fcw-launcher--edge-tab)' ) ? 'still_has_exempt' : 'cleared' ) . PHP_EOL;
echo 'launcher_edge_class=' . ( preg_match( '/id="neo-pulse-chat-mobile-launcher"[^>]*fcw-launcher--edge-tab/', $html ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'root_edge_class=' . ( str_contains( $html, 'fai-sidebar-root--edge-tab' ) ? 'yes' : 'no' ) . PHP_EOL;
echo 'plugin=0.9.201 css present=' . ( str_contains( $html, 'border-radius:50%' ) ? 'yes' : 'no' ) . PHP_EOL;

<?php
$h = file_get_contents(__DIR__ . '/home-guest2.html');
if (!is_string($h) || $h === '') {
	echo "missing html\n";
	exit(1);
}
echo 'bytes=' . strlen($h) . PHP_EOL;
echo 'version188=' . (str_contains($h, '0.9.188') ? 'yes' : 'no') . PHP_EOL;
echo 'chat-lazy=' . (str_contains($h, 'neo-pulse-chat-lazy') ? 'yes' : 'no') . PHP_EOL;
echo 'chat-widget-js=' . substr_count($h, 'neo-pulse-chat-widget.js') . PHP_EOL;
echo 'lcp-box=' . (str_contains($h, 'neo-pulse-speed-lcp-box') ? 'yes' : 'no') . PHP_EOL;
echo 'hero-preload=' . (str_contains($h, 'hero-line') && str_contains($h, 'preload') ? 'yes' : 'no') . PHP_EOL;
echo 'lato-font=' . (str_contains($h, 'fonts.gstatic.com/s/lato') ? 'yes' : 'no') . PHP_EOL;
echo 'min-height-100=' . (str_contains($h, 'min-height:100') ? 'yes' : 'no') . PHP_EOL;

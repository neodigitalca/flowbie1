<?php
$h = file_get_contents(__DIR__ . '/home-guest.html');
echo 'lato=' . (stripos($h, 'Lato') !== false ? 'yes' : 'no') . PHP_EOL;
echo 'gfonts=' . (stripos($h, 'fonts.googleapis.com') !== false ? 'yes' : 'no') . PHP_EOL;
echo 'chat-widget-js=' . substr_count($h, 'neo-pulse-chat-widget.js') . PHP_EOL;
echo 'chat-lazy=' . (stripos($h, 'neo-pulse-chat-lazy') !== false ? 'yes' : 'no') . PHP_EOL;
echo 'speed-cache=' . (stripos($h, 'cache/neo-pulse-speed') !== false ? 'yes' : 'no') . PHP_EOL;
echo 'nitro-lazy=' . substr_count($h, 'nitro-lazy') . PHP_EOL;
echo 'unsized=';
if (preg_match_all('/<img\b[^>]*>/i', $h, $m)) {
	echo count($m[0]) . PHP_EOL;
	$i = 0;
	foreach ($m[0] as $t) {
		++$i;
		if ($i > 15) {
			break;
		}
		echo $i . ': ' . substr(preg_replace('/\s+/', ' ', $t), 0, 240) . PHP_EOL;
	}
}

<?php
$h = file_get_contents(__DIR__ . '/home-guest2.html');
echo 'speed-cache=' . (str_contains($h, 'cache/neo-pulse-speed') ? 'yes' : 'no') . PHP_EOL;
echo 'widget-script-tag=' . (preg_match('/<script[^>]+neo-pulse-chat-widget\\.js/', $h) ? 'yes' : 'no') . PHP_EOL;
echo 'lazy-script-tag=' . (preg_match('/<script[^>]+neo-pulse-chat-lazy\\.js/', $h) ? 'yes' : 'no') . PHP_EOL;
echo 'lato-enqueue=' . (str_contains($h, 'family=Lato') ? 'yes' : 'no') . PHP_EOL;
$pos = stripos($h, '3560e2e::before');
echo 'before-double=' . ($pos !== false ? 'yes' : 'no') . PHP_EOL;
$pos2 = stripos($h, '3560e2e:before');
echo 'before-single=' . ($pos2 !== false ? 'yes' : 'no') . PHP_EOL;
if (preg_match('/3560e2e.{0,80}before.{0,200}/i', $h, $m)) {
	echo 'snippet=' . $m[0] . PHP_EOL;
}
if (preg_match('/background-image:url\\(([^)]*hero-line[^)]*)\\)/i', $h, $m)) {
	echo 'hero-bg=' . $m[1] . PHP_EOL;
}
echo 'speed-lcp-box count=' . substr_count($h, 'neo-pulse-speed-lcp') . PHP_EOL;
echo 'fetchpriority=' . substr_count($h, 'fetchpriority="high"') . PHP_EOL;

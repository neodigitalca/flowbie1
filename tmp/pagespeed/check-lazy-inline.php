<?php
$h = file_get_contents(__DIR__ . '/home-guest2.html');
echo 'lazy-string=' . (str_contains($h, 'neo-pulse-chat-lazy') ? 'yes' : 'no') . PHP_EOL;
echo 'neoPulseChatLazy=' . (str_contains($h, 'neoPulseChatLazy') ? 'yes' : 'no') . PHP_EOL;
echo 'requestIdleCallback=' . (str_contains($h, 'requestIdleCallback') ? 'yes' : 'no') . PHP_EOL;
echo 'speed-lcp-box-css=' . (str_contains($h, 'min-height:100svh') ? 'yes' : 'no') . PHP_EOL;
if (preg_match('/<link[^>]+rel="preload"[^>]*>/i', $h, $m)) {
	echo 'preload-tag=' . $m[0] . PHP_EOL;
}
echo 'cache-speed-count=' . substr_count($h, 'cache/neo-pulse-speed') . PHP_EOL;

<?php
$h = file_get_contents(__DIR__ . '/home-guest3.html');
echo 'bytes=' . strlen($h) . PHP_EOL;
echo 'abs-img=' . (str_contains($h, 'neo-pulse-speed-abs-img') ? 'yes' : 'no') . PHP_EOL;
echo 'svh=' . (str_contains($h, 'min-height:100svh') ? 'yes' : 'no') . PHP_EOL;
echo 'hero-preload=' . (str_contains($h, 'hero-line') && str_contains($h, 'preload') ? 'yes' : 'no') . PHP_EOL;
echo 'ellipse-220=' . (str_contains($h, 'f656ffb') && (str_contains($h, '220px') || str_contains($h, 'np-hero-ellipse')) ? 'yes' : 'no') . PHP_EOL;
echo 'chat-lazy=' . (str_contains($h, 'neoPulseChatLazy') ? 'yes' : 'no') . PHP_EOL;

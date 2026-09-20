<?php
$h = file_get_contents(__DIR__ . '/home-guest2.html');
$pos = stripos($h, 'f656ffb');
echo 'pos=' . ($pos === false ? 'missing' : (string) $pos) . PHP_EOL;
if ($pos !== false) {
	echo substr($h, $pos, 900) . PHP_EOL;
}

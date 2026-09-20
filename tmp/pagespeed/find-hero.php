<?php
$h = file_get_contents(__DIR__ . '/home-guest.html');
$needle = '3560e2e';
$pos = stripos($h, $needle);
echo 'pos=' . ($pos === false ? 'missing' : (string) $pos) . PHP_EOL;
if ($pos !== false) {
	echo substr($h, max(0, $pos - 200), 1800) . PHP_EOL;
}
echo "--- fonts ---\n";
if (preg_match_all('#https://fonts\.googleapis\.com/[^"\']+#i', $h, $m)) {
	foreach (array_unique($m[0]) as $u) {
		echo $u . PHP_EOL;
	}
}
echo "--- hero-line ---\n";
if (preg_match_all('#hero-line[^"\']*#i', $h, $m)) {
	foreach (array_unique($m[0]) as $u) {
		echo $u . PHP_EOL;
	}
}

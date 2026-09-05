<?php
/**
 * wp_localize_script / inline JS object names must be valid identifiers.
 *
 * A hyphenated slug like neo-pulseChatConfig is invalid JS and the widget never boots.
 *
 * Run: php tests/test-js-object-names.php
 *
 * @package Neo_Pulse_Wp
 */

$plugin_dir = dirname( __DIR__ );
$failed     = false;
$pattern     = '/(?:window\.)?_?neo-pulse[A-Z]/';
$key_pattern = '/(?:^|[^\'"\w])neo-pulse_[A-Za-z0-9_]*\s*:/';

$iterator = new RecursiveIteratorIterator(
	new RecursiveDirectoryIterator( $plugin_dir, FilesystemIterator::SKIP_DOTS )
);

foreach ( $iterator as $file ) {
	if ( ! $file->isFile() ) {
		continue;
	}
	$ext = strtolower( $file->getExtension() );
	if ( $ext !== 'php' && $ext !== 'js' ) {
		continue;
	}
	$rel = str_replace( '\\', '/', substr( $file->getPathname(), strlen( $plugin_dir ) + 1 ) );
	if ( str_starts_with( $rel, 'tests/' ) || str_starts_with( $rel, 'vendor/' ) ) {
		continue;
	}
	$contents = (string) file_get_contents( $file->getPathname() );
	if ( preg_match( $pattern, $contents ) ) {
		fwrite( STDERR, "FAIL: {$rel} has an invalid JS identifier (neo-pulse + capital letter)\n" );
		$failed = true;
	}
	if ( $ext === 'js' && preg_match( $key_pattern, $contents ) ) {
		fwrite( STDERR, "FAIL: {$rel} has an unquoted neo-pulse_ object key (invalid JS)\n" );
		$failed = true;
	}
}

if ( $failed ) {
	exit( 1 );
}

echo "PASS: PHP/JS object names are valid JS identifiers\n";

<?php
/**
 * Copy to flowbie-wp-supabase-config.php (or run scripts/embed-wp-supabase-config.cjs).
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'FLOWBIE_WP_SUPABASE_URL' ) ) {
	define( 'FLOWBIE_WP_SUPABASE_URL', 'https://rlunlzcsesawzyvyxwlo.supabase.co' );
}
if ( ! defined( 'FLOWBIE_WP_SUPABASE_ANON_KEY' ) ) {
	define( 'FLOWBIE_WP_SUPABASE_ANON_KEY', 'PASTE_ANON_KEY_OR_RUN_EMBED_SCRIPT' );
}

/** SEO research — embedded by scripts/embed-wp-supabase-config.mjs from agency .env */
// define( 'FLOWBIE_WP_DATAFORSEO_LOGIN', 'your@login' );
// define( 'FLOWBIE_WP_DATAFORSEO_PASSWORD', 'your-password' );
// define( 'FLOWBIE_WP_SEMRUSH_API_KEY', 'your-semrush-key' );

<?php
/**
 * Copy to flowbie-app-secrets.php (gitignored). Or reuse flowbie-wp constants.
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'FLOWBIE_APP_GSC_SERVICE_ACCOUNT_JSON' ) ) {
	define( 'FLOWBIE_APP_GSC_SERVICE_ACCOUNT_JSON', '' );
}
if ( ! defined( 'FLOWBIE_APP_DATAFORSEO_LOGIN' ) ) {
	define( 'FLOWBIE_APP_DATAFORSEO_LOGIN', '' );
}
if ( ! defined( 'FLOWBIE_APP_DATAFORSEO_PASSWORD' ) ) {
	define( 'FLOWBIE_APP_DATAFORSEO_PASSWORD', '' );
}
if ( ! defined( 'FLOWBIE_APP_SEMRUSH_API_KEY' ) ) {
	define( 'FLOWBIE_APP_SEMRUSH_API_KEY', '' );
}
if ( ! defined( 'FLOWBIE_APP_OPENROUTER_API_KEY' ) ) {
	define( 'FLOWBIE_APP_OPENROUTER_API_KEY', '' );
}
if ( ! defined( 'FLOWBIE_APP_GMB_CLIENT_ID' ) ) {
	define( 'FLOWBIE_APP_GMB_CLIENT_ID', '' );
}
if ( ! defined( 'FLOWBIE_APP_GMB_CLIENT_SECRET' ) ) {
	define( 'FLOWBIE_APP_GMB_CLIENT_SECRET', '' );
}
if ( ! defined( 'FLOWBIE_APP_GMB_REDIRECT_URI' ) ) {
	define( 'FLOWBIE_APP_GMB_REDIRECT_URI', 'https://flowbie.ca/api/gmb/callback' );
}
if ( ! defined( 'FLOWBIE_APP_FRONTEND_URL' ) ) {
	define( 'FLOWBIE_APP_FRONTEND_URL', 'https://flowbie.ca/flowbie/' );
}
if ( ! defined( 'FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL' ) ) {
	define( 'FLOWBIE_APP_CHEKKIT_EVENTS_WEBHOOK_URL', '' );
}
if ( ! defined( 'FLOWBIE_APP_CHEKKIT_FORM_EMAIL' ) ) {
	define( 'FLOWBIE_APP_CHEKKIT_FORM_EMAIL', '' );
}

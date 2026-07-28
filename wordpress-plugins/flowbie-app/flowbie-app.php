<?php
/**
 * Plugin Name:       Flowbie App
 * Description:       Headless FlowbieONE API for https://flowbie.ca/flowbie/ (replaces Node /api/* on WP Engine).
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Flowbie
 * License:           GPL-2.0-or-later
 * Text Domain:       flowbie-app
 *
 * @package Flowbie_App
 */

defined( 'ABSPATH' ) || exit;

define( 'FLOWBIE_APP_VERSION', '1.0.0' );
define( 'FLOWBIE_APP_PLUGIN_FILE', __FILE__ );
define( 'FLOWBIE_APP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

$secrets_file = FLOWBIE_APP_PLUGIN_DIR . 'includes/flowbie-app-secrets.php';
if ( is_readable( $secrets_file ) ) {
	require_once $secrets_file;
}

require_once FLOWBIE_APP_PLUGIN_DIR . 'includes/class-flowbie-app-loader.php';

Flowbie_App_Loader::init();

register_activation_hook( __FILE__, array( 'Flowbie_App_Loader', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Flowbie_App_Loader', 'deactivate' ) );

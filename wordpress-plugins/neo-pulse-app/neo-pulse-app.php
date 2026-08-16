<?php
/**
 * Plugin Name:       NEO Pulse App
 * Description:       Headless NEO Pulse API for https://neodigital.ca/neo-pulse/ (replaces Node /api/* on WP Engine).
 * Version:           1.0.1
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            NEO Pulse
 * License:           GPL-2.0-or-later
 * Text Domain:       neo-pulse-app
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

define( 'NEO_PULSE_APP_VERSION', '1.0.7' );
define( 'NEO_PULSE_APP_PLUGIN_FILE', __FILE__ );
define( 'NEO_PULSE_APP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

$secrets_file = NEO_PULSE_APP_PLUGIN_DIR . 'includes/neo-pulse-app-secrets.php';
if ( is_readable( $secrets_file ) ) {
	require_once $secrets_file;
}

require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/class-neo-pulse-app-loader.php';

require_once NEO_PULSE_APP_PLUGIN_DIR . 'includes/class-neo-pulse-app-migrate-from-flowbie.php';

Neo_Pulse_App_Migrate_From_Flowbie::maybe_run();
Neo_Pulse_App_Loader::init();

register_activation_hook( __FILE__, array( 'Neo_Pulse_App_Loader', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Neo_Pulse_App_Loader', 'deactivate' ) );

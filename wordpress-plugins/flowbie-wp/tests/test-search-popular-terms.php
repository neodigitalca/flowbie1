<?php
/**
 * AI search popular terms curation and sitemap ACF seeds.
 *
 * @package Flowbie_Wp
 */

define( 'ABSPATH', __DIR__ );
define( 'FLOWBIE_WP_VERSION', 'test' );
define( 'FLOWBIE_WP_PLUGIN_FILE', dirname( __DIR__ ) . '/flowbie-wp.php' );
define( 'FLOWBIE_WP_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'HOUR_IN_SECONDS', 3600 );

$GLOBALS['flowbie_test_transients']      = array();
$GLOBALS['flowbie_test_log_rows']        = array();
$GLOBALS['flowbie_test_sitemap_posts']   = array();
$GLOBALS['flowbie_test_post_meta']       = array();
$GLOBALS['flowbie_test_acf_keywords']    = array();

if ( ! class_exists( 'WP_Post' ) ) {
	class WP_Post {
		public $ID = 0;
	}
}

if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $key ) {
		return $GLOBALS['flowbie_test_transients'][ $key ] ?? false;
	}
}

if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $key, $value, $expiration ) {
		unset( $expiration );
		$GLOBALS['flowbie_test_transients'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( $thing ) {
		return is_object( $thing ) && isset( $thing->errors );
	}
}

if ( ! function_exists( 'post_type_exists' ) ) {
	function post_type_exists( $post_type ) {
		return in_array( $post_type, array( 'page', 'post' ), true );
	}
}

if ( ! function_exists( 'get_posts' ) ) {
	function get_posts( $args ) {
		unset( $args );
		return $GLOBALS['flowbie_test_sitemap_posts'];
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key, $single = false ) {
		unset( $single );
		return $GLOBALS['flowbie_test_post_meta'][ $post_id ][ $key ] ?? '';
	}
}

if ( ! class_exists( 'Flowbie_Wp_OpenRouter' ) ) {
	class Flowbie_Wp_OpenRouter {
		public static $api_key = '';
		public static $complete_response = '';

		public static function get_api_key() {
			return self::$api_key;
		}

		public static function complete( $system, $user, $max_tokens = 4096, $temperature = 0.7 ) {
			unset( $system, $user, $max_tokens, $temperature );
			return self::$complete_response;
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Sitemap_Settings' ) ) {
	class Flowbie_Wp_Sitemap_Settings {
		public static function get_config() {
			return array(
				'post_types' => array(
					'page' => array( 'include_xml' => true ),
				),
				'general'    => array( 'exclude_post_ids' => '' ),
			);
		}

		public static function excluded_post_ids( array $config ) {
			unset( $config );
			return array();
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Sitemap_Generator' ) ) {
	class Flowbie_Wp_Sitemap_Generator {
		public static function enabled_post_types( array $config ) {
			unset( $config );
			return array( 'page' );
		}
	}
}

if ( ! class_exists( 'Flowbie_Wp_Ai_Context' ) ) {
	class Flowbie_Wp_Ai_Context {
		public static function read_acf_or_meta( int $post_id, array $keys ) {
			unset( $keys );
			return $GLOBALS['flowbie_test_acf_keywords'][ $post_id ] ?? '';
		}
	}
}

$GLOBALS['wpdb'] = new class() {
	public $prefix = 'wp_';

	public function prepare( $query, ...$args ) {
		unset( $args );
		return $query;
	}

	public function get_results( $query ) {
		unset( $query );
		return $GLOBALS['flowbie_test_log_rows'];
	}
};

require_once FLOWBIE_WP_PLUGIN_DIR . 'includes/class-flowbie-wp-search-logs.php';

function flowbie_assert( $cond, $msg ) {
	if ( ! $cond ) {
		fwrite( STDERR, "FAIL: $msg\n" );
		exit( 1 );
	}
	echo "OK: $msg\n";
}

function flowbie_make_post( int $id ): WP_Post {
	$post     = new WP_Post();
	$post->ID = $id;
	return $post;
}

Flowbie_Wp_OpenRouter::$api_key           = '';
Flowbie_Wp_OpenRouter::$complete_response = '';
$GLOBALS['flowbie_test_transients']       = array();
$GLOBALS['flowbie_test_log_rows']         = array();
$GLOBALS['flowbie_test_sitemap_posts']    = array(
	flowbie_make_post( 101 ),
	flowbie_make_post( 102 ),
);
$GLOBALS['flowbie_test_acf_keywords'] = array(
	101 => 'Corporate Tax',
	102 => 'Personal Tax Returns',
);

$seeded = Flowbie_Wp_Search_Logs::aggregate_popular_terms_curated( 30, 5 );
flowbie_assert( count( $seeded ) === 2, 'returns sitemap ACF seeds when logs are empty' );
flowbie_assert( $seeded[0]['query'] === 'Corporate Tax', 'sitemap seeds preserve ACF keyword_focus order' );
flowbie_assert( (int) $seeded[0]['count'] === 0, 'sitemap seed count is zero' );

$exclude_seed = Flowbie_Wp_Search_Logs::aggregate_popular_terms_from_sitemap( 5, array( 'corporate tax' ) );
flowbie_assert( count( $exclude_seed ) === 1, 'sitemap seeds skip excluded normalized queries' );
flowbie_assert( $exclude_seed[0]['query'] === 'Personal Tax Returns', 'sitemap seeds return next keyword after exclude' );

Flowbie_Wp_OpenRouter::$api_key = 'test-key';
$GLOBALS['flowbie_test_log_rows'] = array(
	(object) array(
		'query'            => 'Contact Page',
		'query_normalized' => 'contact page',
		'search_count'     => 8,
	),
	(object) array(
		'query'            => 'plumbre',
		'query_normalized' => 'plumbre',
		'search_count'     => 6,
	),
);
Flowbie_Wp_OpenRouter::$complete_response = '{"terms":[{"query":"contact page","count":8}]}';
$GLOBALS['flowbie_test_transients']       = array();

$curated = Flowbie_Wp_Search_Logs::aggregate_popular_terms_curated( 30, 5 );
flowbie_assert( count( $curated ) === 3, 'curated logs first then sitemap seeds fill remaining slots' );
flowbie_assert( $curated[0]['query'] === 'Contact Page', 'curated preserves original logged query text' );
flowbie_assert( (int) $curated[0]['count'] === 8, 'curated preserves original search count' );
flowbie_assert( $curated[1]['query'] === 'Corporate Tax', 'sitemap seeds fill after curated logs' );

$ref    = new ReflectionClass( Flowbie_Wp_Search_Logs::class );
$method = $ref->getMethod( 'curate_popular_terms_with_openrouter' );
$method->setAccessible( true );

Flowbie_Wp_OpenRouter::$complete_response = '{"terms":[{"query":"brand new seo term","count":99}]}';
$rejected = $method->invoke(
	null,
	array(
		array( 'query' => 'contact page', 'count' => 3 ),
	),
	5
);
flowbie_assert( $rejected === array(), 'rejects invented queries not in customer logs' );

echo "All search popular terms tests passed.\n";

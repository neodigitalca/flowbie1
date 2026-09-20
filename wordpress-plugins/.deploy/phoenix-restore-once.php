<?php
/**
 * One-time flowbie.ca restore: import Phoenix Painting SQL, then rewrite URLs.
 * Token-gated. Deletes itself on cleanup.
 */
if ( ( $_GET['key'] ?? '' ) !== 'PHOENIX_RESTORE_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: application/json; charset=utf-8' );
	echo '{"error":"forbidden"}';
	exit;
}

header( 'Content-Type: application/json; charset=utf-8' );
@set_time_limit( 55 );
@ini_set( 'memory_limit', '512M' );

$abspath = dirname( __DIR__, 2 ) . '/';
$config  = $abspath . 'wp-config.php';
$sql     = __DIR__ . '/phoenix-restore-mysql.sql';
$sql_gz  = __DIR__ . '/phoenix-restore-mysql.sql.gz';
$state_f = __DIR__ . '/phoenix-restore-state.json';
$err_f   = __DIR__ . '/phoenix-restore-error.json';
register_shutdown_function(
	static function () use ( $err_f ) {
		$e = error_get_last();
		if ( $e && in_array( $e['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR ), true ) ) {
			file_put_contents( $err_f, json_encode( $e ) );
		}
	}
);

if ( ! is_readable( $config ) ) {
	http_response_code( 500 );
	echo '{"error":"wp-config missing"}';
	exit;
}

function pr_cfg( $text, $key ) {
	if ( preg_match( "/define\(\s*['\"]" . preg_quote( $key, '/' ) . "['\"]\s*,\s*['\"]([^'\"]*)['\"]/", $text, $m ) ) {
		return $m[1];
	}
	return '';
}

function pr_state( $path ) {
	if ( ! is_readable( $path ) ) {
		return array(
			'importOffset' => 0,
			'importDone'   => false,
			'replacePage'  => 0,
			'replaceDone'  => false,
			'pairsDone'    => 0,
		);
	}
	$raw = json_decode( (string) file_get_contents( $path ), true );
	return is_array( $raw ) ? $raw : array();
}

function pr_save( $path, $state ) {
	file_put_contents( $path, json_encode( $state ) );
}

function pr_connect( $text ) {
	$host = pr_cfg( $text, 'DB_HOST' );
	$user = pr_cfg( $text, 'DB_USER' );
	$pass = pr_cfg( $text, 'DB_PASSWORD' );
	$name = pr_cfg( $text, 'DB_NAME' );
	$port = 3306;
	if ( strpos( $host, ':' ) !== false ) {
		$parts = explode( ':', $host, 2 );
		$host  = $parts[0];
		$port  = (int) $parts[1];
	}
	mysqli_report( MYSQLI_REPORT_OFF );
	$mysqli = mysqli_init();
	$mysqli->options( MYSQLI_OPT_CONNECT_TIMEOUT, 10 );
	if ( ! $mysqli->real_connect( $host, $user, $pass, $name, $port ) ) {
		return array( null, $mysqli->connect_error );
	}
	$mysqli->set_charset( 'utf8mb4' );
	return array( $mysqli, null );
}

function pr_next_statement( $fh ) {
	$stmt = '';
	while ( true ) {
		$line = fgets( $fh, 8388608 );
		if ( $line === false ) {
			return $stmt !== '' ? $stmt : null;
		}
		$stmt .= $line;
		$trim = rtrim( $line );
		if ( $trim !== '' && substr( $trim, -1 ) === ';' ) {
			return $stmt;
		}
	}
}

function pr_skip_sql( $stmt ) {
	$t = trim( $stmt );
	if ( $t === '' || $t === ';' ) {
		return true;
	}
	if ( str_starts_with( $t, '--' ) || str_starts_with( $t, '#' ) ) {
		return true;
	}
	if ( str_starts_with( $t, '/*' ) && ! str_starts_with( $t, '/*!' ) ) {
		return true;
	}
	if ( stripos( $t, 'rocksdb' ) !== false ) {
		return true;
	}
	if ( str_starts_with( $t, '/*!50717' ) || str_starts_with( $t, '/*!50112' ) ) {
		return true;
	}
	if ( str_contains( $t, '@disable_bulk_load' ) ) {
		return true;
	}
	$head = strtoupper( substr( $t, 0, 16 ) );
	if ( str_starts_with( $head, 'PREPARE ' ) || str_starts_with( $head, 'EXECUTE ' ) || str_starts_with( $head, 'DEALLOCATE ' ) ) {
		return true;
	}
	if ( str_contains( $t, '@saved_cs_client' ) || str_contains( $t, '@OLD_' ) ) {
		return true;
	}
	return false;
}

function pr_replace_deep( $from, $to, $data ) {
	if ( is_string( $data ) ) {
		$trim = trim( $data );
		if ( $trim !== '' && preg_match( '/^[abdisOCN]:/', $trim ) ) {
			$un = @unserialize( $data );
			if ( $un !== false || $data === 'b:0;' ) {
				return serialize( pr_replace_deep( $from, $to, $un ) );
			}
		}
		return str_replace( $from, $to, $data );
	}
	if ( is_array( $data ) ) {
		foreach ( $data as $k => $v ) {
			$data[ $k ] = pr_replace_deep( $from, $to, $v );
		}
		return $data;
	}
	if ( is_object( $data ) ) {
		foreach ( get_object_vars( $data ) as $k => $v ) {
			$data->$k = pr_replace_deep( $from, $to, $v );
		}
		return $data;
	}
	return $data;
}

$cfg_text = file_get_contents( $config );
$prefix   = 'wp_';
if ( preg_match( "/\\\$table_prefix\s*=\s*'([^']+)'/", $cfg_text, $pm ) ) {
	$prefix = $pm[1];
}

list( $db, $db_err ) = pr_connect( $cfg_text );
if ( ! $db ) {
	http_response_code( 500 );
	echo json_encode( array( 'error' => 'db connect failed', 'detail' => $db_err ) );
	exit;
}

$step  = (string) ( $_GET['step'] ?? 'status' );
$state = pr_state( $state_f );

if ( $step === 'import' ) {
	if ( ! is_readable( $sql ) && is_readable( $sql_gz ) ) {
		$raw = file_get_contents( $sql_gz );
		if ( $raw === false ) {
			http_response_code( 500 );
			echo '{"error":"gz read failed"}';
			exit;
		}
		$plain = function_exists( 'gzdecode' ) ? gzdecode( $raw ) : false;
		if ( $plain === false ) {
			http_response_code( 500 );
			echo '{"error":"gzdecode failed"}';
			exit;
		}
		if ( file_put_contents( $sql, $plain ) === false ) {
			http_response_code( 500 );
			echo '{"error":"sql write failed"}';
			exit;
		}
	}
	if ( ! is_readable( $sql ) ) {
		http_response_code( 500 );
		echo json_encode(
			array(
				'error' => 'sql missing',
				'sql'   => is_readable( $sql ),
				'gz'    => is_readable( $sql_gz ),
			)
		);
		exit;
	}
	$fh = fopen( $sql, 'rb' );
	if ( ! $fh ) {
		http_response_code( 500 );
		echo '{"error":"sql open failed"}';
		exit;
	}
	$size = filesize( $sql );
	$off  = (int) ( $state['importOffset'] ?? 0 );
	if ( $off > 0 ) {
		if ( fseek( $fh, $off ) !== 0 || (int) ftell( $fh ) !== $off ) {
			rewind( $fh );
			$left = $off;
			while ( $left > 0 && ! feof( $fh ) ) {
				$chunk = fread( $fh, min( 65536, $left ) );
				if ( $chunk === false || $chunk === '' ) {
					break;
				}
				$left -= strlen( $chunk );
			}
		}
	}
	$ran   = 0;
	$start = time();
	$err   = null;
	while ( true ) {
		$stmt = pr_next_statement( $fh );
		if ( $stmt === null ) {
			$state['importDone']   = true;
			$state['importOffset'] = $size;
			pr_save( $state_f, $state );
			break;
		}
		if ( ! pr_skip_sql( $stmt ) ) {
			try {
				$ok = $db->query( $stmt );
			} catch ( Throwable $e ) {
				$ok  = false;
				$err = $e->getMessage();
			}
			if ( ! $ok ) {
				if ( $err === null ) {
					$err = $db->error ?: 'query failed';
				}
				if ( str_contains( $err, 'Duplicate entry' ) ) {
					$q = ltrim( $stmt );
					if ( str_starts_with( strtoupper( $q ), 'INSERT INTO' ) ) {
						$a = strpos( $q, '`' );
						$b = $a === false ? false : strpos( $q, '`', $a + 1 );
						if ( $a !== false && $b !== false ) {
							$table = substr( $q, $a, $b - $a + 1 );
							$db->query( "TRUNCATE TABLE {$table}" );
							$db->query( "DELETE FROM {$table}" );
							try {
								$ok = $db->query( $stmt );
							} catch ( Throwable $e3 ) {
								$ok  = false;
								$err = $e3->getMessage();
							}
							if ( $ok ) {
								$err = null;
							} else {
								$ok  = true;
								$err = null;
							}
						}
					}
				}
				if ( ! $ok && str_contains( (string) $err, 'already exists' ) ) {
					$q = ltrim( $stmt );
					if ( str_starts_with( strtoupper( $q ), 'CREATE TABLE' ) ) {
						$a = strpos( $q, '`' );
						$b = $a === false ? false : strpos( $q, '`', $a + 1 );
						if ( $a !== false && $b !== false ) {
							$table = substr( $q, $a, $b - $a + 1 );
							$db->query( "DROP TABLE IF EXISTS {$table}" );
							try {
								$ok = $db->query( $stmt );
							} catch ( Throwable $e2 ) {
								$ok  = false;
								$err = $e2->getMessage();
							}
							if ( $ok ) {
								$err = null;
							} else {
								$ok  = true;
								$err = null;
							}
						}
					}
				}
			}
			if ( $ok ) {
				$ran++;
				$err = null;
			} else {
				$skip_err = str_contains( (string) $err, 'prepared statement' ) || str_contains( (string) $err, 'rocksdb' );
				if ( $skip_err ) {
					$err = null;
				} else {
					$state['lastError'] = $err;
					$state['lastStmt']  = substr( $stmt, 0, 180 );
					pr_save( $state_f, $state );
					break;
				}
			}
		}
		$state['importOffset'] = ftell( $fh );
		pr_save( $state_f, $state );
		if ( ( time() - $start ) >= 18 && $ran > 0 ) {
			break;
		}
		if ( ( time() - $start ) >= 45 ) {
			break;
		}
	}
	fclose( $fh );
	if ( (int) $state['importOffset'] >= $size ) {
		$state['importDone'] = true;
		pr_save( $state_f, $state );
	}
	$out = array(
		'ok'       => $err === null,
		'step'     => 'import',
		'ran'      => $ran,
		'offset'   => (int) $state['importOffset'],
		'size'     => $size,
		'done'     => ! empty( $state['importDone'] ),
		'lastStmt' => $state['lastStmt'] ?? null,
	);
	if ( $err ) {
		$out['error'] = $err;
	}
	echo json_encode( $out );
	exit;
}

if ( $step === 'replace' ) {
	if ( empty( $state['importDone'] ) ) {
		http_response_code( 409 );
		echo '{"error":"import not done"}';
		exit;
	}
	$db->query( "UPDATE `{$prefix}options` SET option_value = 'https://flowbie.ca' WHERE option_name IN ('siteurl','home')" );
	if ( empty( $state['postsReplaced'] ) ) {
		$db->query( "UPDATE `{$prefix}posts` SET post_content = REPLACE(post_content,'https://phoenixpainting.ca','https://flowbie.ca'), guid = REPLACE(guid,'https://phoenixpainting.ca','https://flowbie.ca')" );
		$db->query( "UPDATE `{$prefix}posts` SET post_content = REPLACE(post_content,'http://phoenixpainting.ca','https://flowbie.ca'), guid = REPLACE(guid,'http://phoenixpainting.ca','https://flowbie.ca')" );
		$db->query( "UPDATE `{$prefix}posts` SET post_content = REPLACE(post_content,'phoenixpainting.ca','flowbie.ca'), guid = REPLACE(guid,'phoenixpainting.ca','flowbie.ca')" );
		$state['postsReplaced'] = true;
		$state['replaceJob']    = 0;
		$state['replaceMinId']  = 0;
		pr_save( $state_f, $state );
	}
	$jobs = array(
		array( 'https://phoenixpainting.ca', 'https://flowbie.ca', "{$prefix}postmeta", 'meta_id', 'meta_value' ),
		array( 'https://phoenixpainting.ca', 'https://flowbie.ca', "{$prefix}options", 'option_id', 'option_value' ),
		array( 'phoenixpainting.ca', 'flowbie.ca', "{$prefix}postmeta", 'meta_id', 'meta_value' ),
		array( 'phoenixpainting.ca', 'flowbie.ca', "{$prefix}options", 'option_id', 'option_value' ),
	);
	$job_i = (int) ( $state['replaceJob'] ?? 0 );
	$min_id = (int) ( $state['replaceMinId'] ?? 0 );
	if ( $job_i >= count( $jobs ) ) {
		$active = $db->query( "SELECT option_value FROM `{$prefix}options` WHERE option_name = 'active_plugins' LIMIT 1" );
		if ( $active ) {
			$row = $active->fetch_assoc();
			if ( $row && isset( $row['option_value'] ) ) {
				$plugins = @unserialize( $row['option_value'] );
				if ( is_array( $plugins ) ) {
					$plugins = array_values(
						array_filter(
							$plugins,
							static function ( $p ) {
								return strpos( (string) $p, 'nitropack' ) === false;
							}
						)
					);
					$ser = $db->real_escape_string( serialize( $plugins ) );
					$db->query( "UPDATE `{$prefix}options` SET option_value = '{$ser}' WHERE option_name = 'active_plugins'" );
				}
			}
		}
		$state['replaceDone'] = true;
		pr_save( $state_f, $state );
		echo json_encode( array( 'ok' => true, 'step' => 'replace', 'done' => true ) );
		exit;
	}
	$job   = $jobs[ $job_i ];
	$from  = $job[0];
	$to    = $job[1];
	$table = $job[2];
	$pk    = $job[3];
	$col   = $job[4];
	$like  = '%' . $db->real_escape_string( $from ) . '%';
	$limit = 40;
	$res   = $db->query( "SELECT `{$pk}` AS _id, `{$col}` AS _v FROM `{$table}` WHERE `{$col}` LIKE '{$like}' AND `{$pk}` > {$min_id} ORDER BY `{$pk}` ASC LIMIT {$limit}" );
	$changed = 0;
	$scanned = 0;
	$max_id  = $min_id;
	if ( $res ) {
		while ( $row = $res->fetch_assoc() ) {
			$scanned++;
			$max_id = max( $max_id, (int) $row['_id'] );
			$new    = pr_replace_deep( $from, $to, $row['_v'] );
			if ( $new === $row['_v'] && is_string( $row['_v'] ) && strpos( $row['_v'], $from ) !== false ) {
				$new = str_replace( $from, $to, $row['_v'] );
			}
			if ( $new === $row['_v'] ) {
				continue;
			}
			if ( ! is_string( $new ) ) {
				$new = serialize( $new );
			}
			$id  = (int) $row['_id'];
			$esc = $db->real_escape_string( $new );
			$db->query( "UPDATE `{$table}` SET `{$col}` = '{$esc}' WHERE `{$pk}` = {$id}" );
			$changed++;
		}
	}
	if ( $scanned < $limit ) {
		$state['replaceJob']   = $job_i + 1;
		$state['replaceMinId'] = 0;
	} else {
		$state['replaceMinId'] = $max_id;
	}
	pr_save( $state_f, $state );
	echo json_encode(
		array(
			'ok'      => true,
			'step'    => 'replace',
			'done'    => false,
			'pair'    => $from,
			'page'    => (int) $state['replaceMinId'],
			'pairs'   => (int) $state['replaceJob'],
			'changed' => $changed,
			'scanned' => $scanned,
		)
	);
	exit;
}

if ( $step === 'status' ) {
	$home = null;
	$title = null;
	$q    = $db->query( "SELECT option_name, option_value FROM `{$prefix}options` WHERE option_name IN ('siteurl','home','blogname') LIMIT 3" );
	$opts = array();
	if ( $q ) {
		while ( $row = $q->fetch_assoc() ) {
			$opts[ $row['option_name'] ] = $row['option_value'];
		}
	}
	echo json_encode(
		array(
			'ok'    => true,
			'step'  => 'status',
			'state' => $state,
			'opts'  => $opts,
			'sql'   => is_readable( $sql ),
			'gz'    => is_readable( $sql_gz ),
			'sqlMb' => is_readable( $sql ) ? round( filesize( $sql ) / 1048576, 1 ) : 0,
			'gzMb'  => is_readable( $sql_gz ) ? round( filesize( $sql_gz ) / 1048576, 1 ) : 0,
		)
	);
	exit;
}

if ( $step === 'cleanup' ) {
	@unlink( $sql );
	@unlink( $state_f );
	@unlink( __FILE__ );
	echo '{"ok":true,"step":"cleanup"}';
	exit;
}

http_response_code( 400 );
echo '{"error":"unknown step"}';

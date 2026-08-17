<?php
/**
 * Minimal 5-field cron due check (minute hour dom month dow).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Workflow_Cron_Expression {

	public static function is_due( string $expression, string $timezone = 'America/Edmonton' ): bool {
		$parts = preg_split( '/\s+/', trim( $expression ) );
		if ( ! is_array( $parts ) || count( $parts ) !== 5 ) {
			return false;
		}
		try {
			$now = new DateTimeImmutable( 'now', new DateTimeZone( $timezone ) );
		} catch ( Exception $e ) {
			return false;
		}
		$fields = array(
			(int) $now->format( 'i' ),
			(int) $now->format( 'G' ),
			(int) $now->format( 'j' ),
			(int) $now->format( 'n' ),
			(int) $now->format( 'w' ),
		);
		foreach ( $parts as $idx => $part ) {
			if ( ! self::field_matches( (string) $part, $fields[ $idx ] ) ) {
				return false;
			}
		}
		return true;
	}

	private static function field_matches( string $part, int $value ): bool {
		if ( $part === '*' ) {
			return true;
		}
		if ( is_numeric( $part ) ) {
			return (int) $part === $value;
		}
		if ( strpos( $part, ',' ) !== false ) {
			foreach ( explode( ',', $part ) as $segment ) {
				if ( self::field_matches( trim( $segment ), $value ) ) {
					return true;
				}
			}
			return false;
		}
		if ( strpos( $part, '/' ) !== false ) {
			$chunks = explode( '/', $part, 2 );
			$base   = trim( $chunks[0] );
			$step   = (int) ( $chunks[1] ?? 1 );
			if ( $step <= 0 ) {
				return false;
			}
			if ( $base === '*' ) {
				return $value % $step === 0;
			}
			return $value >= (int) $base && ( ( $value - (int) $base ) % $step ) === 0;
		}
		return false;
	}
}

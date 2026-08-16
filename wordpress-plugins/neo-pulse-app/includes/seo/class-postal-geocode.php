<?php
/**
 * Offline postal/city centroid lookup (GeoNames CA + US tab files).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Postal_Geocode {

	/** @var array<string,array{lat:float,lng:float,placeName:string}>|null */
	private static $postal_index = null;

	/** @var bool */
	private static $ready = false;

	public static function is_ready(): bool {
		self::ensure_init();
		return self::$ready;
	}

	/**
	 * @param array{postalCode?:string,city?:string,region?:string,countryCode?:string} $hints
	 * @return array{lat:float,lng:float,placeName:string,source:string}|null
	 */
	public static function lookup( array $hints ): ?array {
		if ( ! self::ensure_init() ) {
			return null;
		}

		$country   = self::normalize_country( $hints['countryCode'] ?? '' );
		$countries = $country !== '' ? array( $country ) : array( 'CA', 'US' );
		$postal    = trim( (string) ( $hints['postalCode'] ?? '' ) );

		if ( $postal !== '' ) {
			foreach ( $countries as $cc ) {
				$key = $cc === 'CA' ? self::normalize_canadian_postal( $postal ) : self::normalize_us_zip( $postal );
				if ( $key === '' ) {
					continue;
				}
				$index_key = $cc . ':' . $key;
				if ( isset( self::$postal_index[ $index_key ] ) ) {
					$hit = self::$postal_index[ $index_key ];
					return array(
						'lat'       => $hit['lat'],
						'lng'       => $hit['lng'],
						'placeName' => $hit['placeName'],
						'source'    => 'postal',
					);
				}
			}
		}

		$city = trim( (string) ( $hints['city'] ?? '' ) );
		if ( $city !== '' ) {
			$region = trim( (string) ( $hints['region'] ?? '' ) );
			$hit    = self::lookup_city( $city, $region, $country );
			if ( $hit ) {
				return $hit;
			}
		}

		return null;
	}

	private static function ensure_init(): bool {
		if ( self::$postal_index !== null ) {
			return self::$ready;
		}
		self::$postal_index = array();
		self::$ready        = false;

		$dir = self::data_dir();
		if ( $dir === null ) {
			return false;
		}

		foreach ( array( 'CA.txt', 'US.txt' ) as $file ) {
			$path = $dir . '/' . $file;
			if ( ! is_readable( $path ) ) {
				continue;
			}
			$handle = fopen( $path, 'r' );
			if ( ! $handle ) {
				continue;
			}
			while ( ( $line = fgets( $handle ) ) !== false ) {
				$parts = explode( "\t", trim( $line ) );
				if ( count( $parts ) < 11 ) {
					continue;
				}
				$cc    = $parts[0];
				$code  = $parts[1];
				$place = $parts[2];
				$lat   = (float) $parts[9];
				$lng   = (float) $parts[10];
				if ( ! is_finite( $lat ) || ! is_finite( $lng ) ) {
					continue;
				}
				$key = $cc . ':' . $code;
				if ( ! isset( self::$postal_index[ $key ] ) ) {
					self::$postal_index[ $key ] = array(
						'lat'       => $lat,
						'lng'       => $lng,
						'placeName' => $place,
					);
				}
			}
			fclose( $handle );
			self::$ready = true;
		}

		return self::$ready;
	}

	private static function data_dir(): ?string {
		if ( defined( 'NEO_PULSE_APP_GEONAMES_DIR' ) && is_dir( NEO_PULSE_APP_GEONAMES_DIR ) ) {
			return rtrim( (string) NEO_PULSE_APP_GEONAMES_DIR, '/\\' );
		}
		$plugin_data = NEO_PULSE_APP_PLUGIN_DIR . 'data/geonames';
		if ( is_dir( $plugin_data ) ) {
			return $plugin_data;
		}
		$repo = dirname( NEO_PULSE_APP_PLUGIN_DIR, 2 ) . '/server/data/geonames';
		return is_dir( $repo ) ? $repo : null;
	}

	private static function normalize_country( string $raw ): string {
		$t = strtoupper( trim( $raw ) );
		if ( in_array( $t, array( 'CA', 'CAN', 'CANADA' ), true ) ) {
			return 'CA';
		}
		if ( in_array( $t, array( 'US', 'USA', 'UNITED STATES' ), true ) ) {
			return 'US';
		}
		return strlen( $t ) === 2 ? $t : '';
	}

	private static function normalize_canadian_postal( string $raw ): string {
		$compact = strtoupper( preg_replace( '/\s+/', '', trim( $raw ) ) );
		if ( ! preg_match( '/^[A-Z]\d[A-Z]/', $compact ) ) {
			return '';
		}
		return substr( $compact, 0, 3 );
	}

	private static function normalize_us_zip( string $raw ): string {
		if ( preg_match( '/\b(\d{5})(?:-\d{4})?\b/', trim( $raw ), $m ) ) {
			return $m[1];
		}
		return '';
	}

	/**
	 * @return array{lat:float,lng:float,placeName:string,source:string}|null
	 */
	private static function lookup_city( string $city, string $region, string $country ): ?array {
		$dir = self::data_dir();
		if ( $dir === null ) {
			return null;
		}
		$city_l = strtolower( $city );
		foreach ( array( 'CA.txt', 'US.txt' ) as $file ) {
			$path = $dir . '/' . $file;
			if ( ! is_readable( $path ) ) {
				continue;
			}
			$handle = fopen( $path, 'r' );
			if ( ! $handle ) {
				continue;
			}
			while ( ( $line = fgets( $handle ) ) !== false ) {
				$parts = explode( "\t", trim( $line ) );
				if ( count( $parts ) < 11 ) {
					continue;
				}
				if ( $country !== '' && $parts[0] !== $country ) {
					continue;
				}
				$place = strtolower( $parts[2] );
				if ( strpos( $place, $city_l ) === false && $place !== $city_l ) {
					continue;
				}
				if ( $region !== '' && ! self::matches_region( $parts[4] ?? '', $parts[3] ?? '', $region ) ) {
					continue;
				}
				fclose( $handle );
				return array(
					'lat'       => (float) $parts[9],
					'lng'       => (float) $parts[10],
					'placeName' => $parts[2],
					'source'    => 'place',
				);
			}
			fclose( $handle );
		}
		return null;
	}

	private static function matches_region( string $code, string $name, string $region ): bool {
		$r = strtolower( trim( $region ) );
		if ( $r === '' ) {
			return true;
		}
		$code_l = strtolower( $code );
		$name_l = strtolower( $name );
		return $code_l === $r || $name_l === $r || strpos( $name_l, $r ) === 0 || strpos( $code_l, $r ) === 0;
	}
}

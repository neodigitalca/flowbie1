<?php
/**
 * JSON-LD LocalBusiness address extraction (Node local-business-schema-extract parity).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Local_Business_Schema_Extract {

	/** @var string[] */
	private static $local_business_types = array(
		'LocalBusiness', 'FoodEstablishment', 'Restaurant', 'Store', 'AutoRepair', 'Dentist', 'Physician',
		'ProfessionalService', 'HomeAndConstructionBusiness', 'LegalService', 'RealEstateAgent', 'FinancialService',
		'HealthAndBeautyBusiness', 'LodgingBusiness', 'MedicalBusiness', 'EmergencyService', 'AutoDealer',
		'AutomotiveBusiness', 'ChildCare', 'Electrician', 'GeneralContractor', 'HVACBusiness', 'HousePainter',
		'Locksmith', 'MovingCompany', 'Plumber', 'RoofingContractor', 'DryCleaningOrLaundry', 'PetStore',
		'GasStation', 'HardwareStore', 'BikeStore', 'BookStore', 'ClothingStore', 'ComputerStore', 'ConvenienceStore',
		'DepartmentStore', 'ElectronicsStore', 'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore',
		'JewelryStore', 'OfficeEquipmentStore', 'OutletStore', 'PawnShop', 'ShoeStore', 'SportingGoodsStore',
		'TireShop', 'ToyStore', 'WholesaleStore', 'BankOrCreditUnion', 'InsuranceAgency', 'AccountingService',
		'AutomotiveRepair', 'BeautySalon', 'DaySpa', 'HealthClub', 'NightClub', 'Massage', 'HairSalon',
		'TravelAgency', 'InternetCafe', 'MedicalClinic', 'Pharmacy', 'VeterinaryCare',
	);

	/** @var string[] */
	private static $location_roots = array(
		'locations', 'location', 'our-locations', 'store-locator', 'find-us', 'showrooms', 'stores',
	);

	/**
	 * @return array{label:string,lat?:float,lng?:float}|null
	 */
	public static function extract_local_business_address_from_html( string $html ): ?array {
		$nodes = self::collect_json_ld_nodes( $html );
		$groups = self::group_nodes( $nodes );
		foreach ( array( 'localBiz', 'orgs', 'other' ) as $key ) {
			foreach ( $groups[ $key ] as $node ) {
				$picked = self::pick_address_from_node( $node );
				if ( $picked && ( $picked['label'] !== '' || ( isset( $picked['lat'] ) && isset( $picked['lng'] ) ) ) ) {
					return $picked;
				}
			}
		}
		return null;
	}

	/**
	 * @return array<int,array{label:string,name:?string}>
	 */
	public static function extract_all_addresses_from_html( string $html ): array {
		$nodes  = self::collect_json_ld_nodes( $html );
		$groups = self::group_nodes( $nodes );
		$seen   = array();
		$out    = array();

		foreach ( array( 'localBiz', 'orgs', 'other' ) as $key ) {
			foreach ( $groups[ $key ] as $node ) {
				$name = self::node_name( $node );
				if ( isset( $node['address'] ) && is_array( $node['address'] ) && array_keys( $node['address'] ) === range( 0, count( $node['address'] ) - 1 ) ) {
					foreach ( $node['address'] as $addr ) {
						$label = self::format_postal_address( $addr );
						self::push_unique_address( $out, $seen, $label, $name );
					}
				} else {
					$picked = self::pick_address_from_node( $node );
					if ( $picked && $picked['label'] !== '' ) {
						self::push_unique_address( $out, $seen, $picked['label'], $name );
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @return string[]
	 */
	public static function extract_area_served_labels_from_html( string $html ): array {
		$nodes  = self::collect_json_ld_nodes( $html );
		$groups = self::group_nodes( $nodes );
		$seen   = array();
		$out    = array();
		foreach ( array( 'localBiz', 'orgs' ) as $key ) {
			foreach ( $groups[ $key ] as $node ) {
				foreach ( array( 'areaServed', 'serviceArea' ) as $field ) {
					if ( ! isset( $node[ $field ] ) ) {
						continue;
					}
					foreach ( self::area_served_to_strings( $node[ $field ] ) as $label ) {
						$k = strtolower( preg_replace( '/\s+/', ' ', trim( $label ) ) );
						if ( $k === '' || isset( $seen[ $k ] ) ) {
							continue;
						}
						$seen[ $k ] = true;
						$out[]      = trim( $label );
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @return string[]
	 */
	public static function extract_loose_service_area_headings_from_html( string $html ): array {
		$out  = array();
		$seen = array();
		if ( preg_match_all( '/based\s+in\s*<\/[^>]+>\s*<[^>]+>([^<]{2,160})</i', $html, $matches ) ) {
			foreach ( $matches[1] as $raw ) {
				$t = trim( str_replace( array( '&amp;', '&nbsp;' ), array( '&', ' ' ), $raw ) );
				if ( $t === '' || preg_match( '/^(submit|read more|contact us)$/i', $t ) ) {
					continue;
				}
				$k = strtolower( preg_replace( '/\s+/', ' ', $t ) );
				if ( isset( $seen[ $k ] ) ) {
					continue;
				}
				$seen[ $k ] = true;
				$out[]      = $t;
			}
		}
		return $out;
	}

	public static function is_location_style_path( string $path_only ): bool {
		$normalized = rtrim( $path_only, '/' );
		if ( $normalized === '' ) {
			$normalized = '/';
		}
		$parts = array_values( array_filter( explode( '/', $normalized ) ) );
		if ( count( $parts ) < 2 ) {
			return false;
		}
		return in_array( strtolower( $parts[0] ), self::$location_roots, true );
	}

	/**
	 * @return array<int,array{path:string,href:string}>
	 */
	public static function extract_location_child_page_links( string $html, string $page_url_absolute ): array {
		$parsed = wp_parse_url( $page_url_absolute );
		if ( empty( $parsed['scheme'] ) || empty( $parsed['host'] ) ) {
			return array();
		}
		$site_origin = $parsed['scheme'] . '://' . $parsed['host'];
		$seen        = array();
		$out         = array();

		if ( preg_match_all( '/href\s*=\s*["\']([^"\']+)["\']/i', $html, $href_matches ) ) {
			foreach ( $href_matches[1] as $href ) {
				self::push_location_url_if_same_origin( $href, $site_origin, $page_url_absolute, $seen, $out );
			}
		}
		if ( preg_match_all( '/(?:data-href|data-url|data-link|data-permalink)\s*=\s*["\']([^"\']+)["\']/i', $html, $data_matches ) ) {
			foreach ( $data_matches[1] as $href ) {
				self::push_location_url_if_same_origin( $href, $site_origin, $page_url_absolute, $seen, $out );
			}
		}

		$esc_origin = preg_quote( $site_origin, '/' );
		if ( preg_match_all( '/' . $esc_origin . '(\/(?:location|locations|showrooms|our-locations|store-locator|find-us|stores)\/[^\s"\'<>?#]+)/i', $html, $abs_matches ) ) {
			foreach ( $abs_matches[0] as $href ) {
				self::push_location_url_if_same_origin( $href, $site_origin, $page_url_absolute, $seen, $out );
			}
		}
		if ( preg_match_all( '/(?:["\'`\s>])(\/(?:location|locations|showrooms|our-locations|store-locator|find-us|stores)\/[a-zA-Z0-9\-._~%!$&\'()*+,;=:@]+)\/?(?:["\'`\s?#<>]|$)/i', $html, $rel_matches ) ) {
			foreach ( $rel_matches[1] as $href ) {
				self::push_location_url_if_same_origin( $href, $site_origin, $page_url_absolute, $seen, $out );
			}
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $out
	 * @param array<string,bool>             $seen
	 */
	private static function push_location_url_if_same_origin( string $href_or_path, string $site_origin, string $page_url_absolute, array &$seen, array &$out ): void {
		$raw = trim( $href_or_path );
		if ( $raw === '' || strpos( $raw, 'mailto:' ) === 0 || strpos( $raw, 'tel:' ) === 0 || strpos( $raw, 'javascript:' ) === 0 || strpos( $raw, '#' ) === 0 ) {
			return;
		}
		$resolved = wp_parse_url( $raw, PHP_URL_SCHEME ) ? $raw : wp_parse_url( $page_url_absolute, PHP_URL_SCHEME ) . '://' . wp_parse_url( $page_url_absolute, PHP_URL_HOST ) . ( strpos( $raw, '/' ) === 0 ? $raw : '/' . $raw );
		$parts    = wp_parse_url( $resolved );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return;
		}
		if ( $parts['scheme'] . '://' . $parts['host'] !== $site_origin ) {
			return;
		}
		$path_only = rtrim( (string) ( $parts['path'] ?? '/' ), '/' );
		if ( $path_only === '' ) {
			$path_only = '/';
		}
		if ( ! self::is_location_style_path( $path_only ) ) {
			return;
		}
		$key = $path_only . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
		if ( isset( $seen[ $key ] ) ) {
			return;
		}
		$seen[ $key ] = true;
		$href         = $parts['scheme'] . '://' . $parts['host'] . $path_only . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
		$out[]        = array( 'path' => $key, 'href' => $href );
	}

	/**
	 * @param array<int,array{label:string,name:?string}> $out
	 * @param array<string,bool>                          $seen
	 */
	private static function push_unique_address( array &$out, array &$seen, ?string $label, ?string $name ): void {
		if ( ! is_string( $label ) || trim( $label ) === '' ) {
			return;
		}
		$key = strtolower( preg_replace( '/\s+/', ' ', trim( $label ) ) );
		if ( isset( $seen[ $key ] ) ) {
			return;
		}
		$seen[ $key ] = true;
		$out[]        = array( 'label' => trim( $label ), 'name' => $name ?: null );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function collect_json_ld_nodes( string $html ): array {
		$all = array();
		if ( ! preg_match_all( '/<script[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/i', $html, $matches ) ) {
			return $all;
		}
		foreach ( $matches[1] as $raw ) {
			$raw = trim( $raw );
			if ( $raw === '' ) {
				continue;
			}
			$parsed = json_decode( $raw, true );
			if ( ! is_array( $parsed ) ) {
				continue;
			}
			self::collect_nodes( $parsed, $all );
		}
		return $all;
	}

	/**
	 * @param mixed                         $node
	 * @param array<int,array<string,mixed>> $out
	 */
	private static function collect_nodes( $node, array &$out ): void {
		if ( $node === null ) {
			return;
		}
		if ( is_array( $node ) && array_keys( $node ) === range( 0, count( $node ) - 1 ) ) {
			foreach ( $node as $item ) {
				self::collect_nodes( $item, $out );
			}
			return;
		}
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( isset( $node['@graph'] ) && is_array( $node['@graph'] ) ) {
			foreach ( $node['@graph'] as $g ) {
				self::collect_nodes( $g, $out );
			}
			return;
		}
		$out[] = $node;
	}

	/**
	 * @param array<int,array<string,mixed>> $nodes
	 * @return array{localBiz:array,orgs:array,other:array}
	 */
	private static function group_nodes( array $nodes ): array {
		$local = array();
		$orgs  = array();
		$other = array();
		foreach ( $nodes as $node ) {
			$types = self::normalize_types( $node['@type'] ?? null );
			if ( self::is_local_businessish( $types ) ) {
				$local[] = $node;
			} elseif ( self::is_organization( $types ) ) {
				$orgs[] = $node;
			} else {
				$other[] = $node;
			}
		}
		return array( 'localBiz' => $local, 'orgs' => $orgs, 'other' => $other );
	}

	/** @param mixed $value @return string[] */
	private static function normalize_types( $value ): array {
		if ( $value === null ) {
			return array();
		}
		if ( is_array( $value ) ) {
			$out = array();
			foreach ( $value as $v ) {
				$out = array_merge( $out, self::normalize_types( $v ) );
			}
			return $out;
		}
		return is_string( $value ) ? array( $value ) : array();
	}

	/** @param string[] $types */
	private static function is_local_businessish( array $types ): bool {
		foreach ( $types as $t ) {
			if ( ! is_string( $t ) ) {
				continue;
			}
			if ( in_array( $t, self::$local_business_types, true ) ) {
				return true;
			}
			if ( $t === 'LocalBusiness' || substr( $t, -13 ) === 'LocalBusiness' ) {
				return true;
			}
			if ( preg_match( '/Business$/i', $t ) && strlen( $t ) > 8 ) {
				return true;
			}
		}
		return false;
	}

	/** @param string[] $types */
	private static function is_organization( array $types ): bool {
		foreach ( $types as $t ) {
			if ( $t === 'Organization' || $t === 'Corporation' ) {
				return true;
			}
		}
		return false;
	}

	/** @param array<string,mixed> $node */
	private static function node_name( array $node ): ?string {
		if ( isset( $node['name'] ) && is_string( $node['name'] ) ) {
			return trim( $node['name'] ) ?: null;
		}
		if ( isset( $node['name'] ) && is_array( $node['name'] ) && isset( $node['name'][0] ) && is_string( $node['name'][0] ) ) {
			return trim( $node['name'][0] ) ?: null;
		}
		return null;
	}

	/** @param mixed $addr */
	private static function format_postal_address( $addr ): ?string {
		if ( $addr === null ) {
			return null;
		}
		if ( is_string( $addr ) ) {
			$s = trim( $addr );
			return $s !== '' ? $s : null;
		}
		if ( ! is_array( $addr ) ) {
			return null;
		}
		$types = self::normalize_types( $addr['@type'] ?? null );
		if ( $types && ! in_array( 'PostalAddress', $types, true ) && ! in_array( 'VirtualLocation', $types, true ) && isset( $addr['address'] ) ) {
			return self::format_postal_address( $addr['address'] );
		}
		$street = trim( implode( ', ', array_filter( array(
			isset( $addr['streetAddress'] ) && is_string( $addr['streetAddress'] ) ? trim( $addr['streetAddress'] ) : '',
			isset( $addr['streetAddress2'] ) && is_string( $addr['streetAddress2'] ) ? trim( $addr['streetAddress2'] ) : '',
		) ) ) );
		$city   = isset( $addr['addressLocality'] ) && is_string( $addr['addressLocality'] ) ? trim( $addr['addressLocality'] ) : '';
		$region = isset( $addr['addressRegion'] ) && is_string( $addr['addressRegion'] ) ? trim( $addr['addressRegion'] ) : '';
		$zip    = isset( $addr['postalCode'] ) && is_string( $addr['postalCode'] ) ? trim( $addr['postalCode'] ) : '';
		$country = isset( $addr['addressCountry'] ) && is_string( $addr['addressCountry'] ) ? trim( $addr['addressCountry'] ) : '';
		$city_state = trim( implode( ', ', array_filter( array( $city, $region ) ) ) );
		$line_parts = array_filter( array(
			$street ?: null,
			trim( implode( ' ', array_filter( array( $city_state, $zip ) ) ) ) ?: null,
			$country ?: null,
		) );
		$out = trim( implode( ', ', $line_parts ) );
		return $out !== '' ? $out : null;
	}

	/** @param array<string,mixed> $node @return array{lat?:float,lng?:float}|null */
	private static function geo_coords_from_node( array $node ): ?array {
		if ( isset( $node['geo'] ) && is_array( $node['geo'] ) ) {
			$lat = isset( $node['geo']['latitude'] ) ? (float) $node['geo']['latitude'] : NAN;
			$lng = isset( $node['geo']['longitude'] ) ? (float) $node['geo']['longitude'] : NAN;
			if ( is_finite( $lat ) && is_finite( $lng ) ) {
				return array( 'lat' => $lat, 'lng' => $lng );
			}
		}
		$lat = isset( $node['latitude'] ) ? (float) $node['latitude'] : NAN;
		$lng = isset( $node['longitude'] ) ? (float) $node['longitude'] : NAN;
		if ( is_finite( $lat ) && is_finite( $lng ) ) {
			return array( 'lat' => $lat, 'lng' => $lng );
		}
		return null;
	}

	/** @param array<string,mixed> $node @return array{label:string,lat?:float,lng?:float}|null */
	private static function pick_address_from_node( array $node ): ?array {
		$geo = self::geo_coords_from_node( $node );
		if ( isset( $node['address'] ) && is_array( $node['address'] ) && ! self::is_list( $node['address'] ) ) {
			$inner = $node['address'];
			$types = self::normalize_types( $inner['@type'] ?? null );
			if ( in_array( 'PostalAddress', $types, true ) || ! empty( $inner['streetAddress'] ) || ! empty( $inner['addressLocality'] ) ) {
				$label = self::format_postal_address( $inner );
				if ( $label ) {
					return array_merge( array( 'label' => $label ), $geo ?: array() );
				}
			}
		}
		if ( isset( $node['address'] ) && is_array( $node['address'] ) && self::is_list( $node['address'] ) ) {
			foreach ( $node['address'] as $addr ) {
				$label = self::format_postal_address( $addr );
				if ( $label ) {
					return array_merge( array( 'label' => $label ), $geo ?: array() );
				}
			}
		} else {
			$label = self::format_postal_address( $node['address'] ?? null );
			if ( $label ) {
				return array_merge( array( 'label' => $label ), $geo ?: array() );
			}
		}
		if ( isset( $node['location'] ) && is_array( $node['location'] ) ) {
			$loc_geo = self::geo_coords_from_node( $node['location'] );
			$label   = self::format_postal_address( $node['location']['address'] ?? $node['location'] );
			if ( $label ) {
				return array_merge( array( 'label' => $label ), $loc_geo ?: ( $geo ?: array() ) );
			}
		}
		if ( $geo ) {
			return array_merge( array( 'label' => '' ), $geo );
		}
		return null;
	}

	/** @param mixed $value @return string[] */
	private static function area_served_to_strings( $value ): array {
		if ( $value === null ) {
			return array();
		}
		if ( is_string( $value ) ) {
			$s = trim( $value );
			return $s !== '' ? array( $s ) : array();
		}
		if ( is_array( $value ) && self::is_list( $value ) ) {
			$out = array();
			foreach ( $value as $v ) {
				$out = array_merge( $out, self::area_served_to_strings( $v ) );
			}
			return $out;
		}
		if ( is_array( $value ) ) {
			$out = array();
			if ( ! empty( $value['name'] ) && is_string( $value['name'] ) && trim( $value['name'] ) !== '' ) {
				$out[] = trim( $value['name'] );
			}
			if ( ! empty( $value['description'] ) && is_string( $value['description'] ) && trim( $value['description'] ) !== '' ) {
				$out[] = trim( $value['description'] );
			}
			return $out;
		}
		return array();
	}

	/** @param array<mixed> $arr */
	private static function is_list( array $arr ): bool {
		return array_keys( $arr ) === range( 0, count( $arr ) - 1 );
	}
}

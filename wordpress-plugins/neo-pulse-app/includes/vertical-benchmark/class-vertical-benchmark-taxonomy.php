<?php
/**
 * Industry vertical taxonomy for portfolio benchmarks.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Vertical_Benchmark_Taxonomy {

	/** @var array<int,array{id:string,label:string}> */
	const TAXONOMY = array(
		array( 'id' => 'uncategorized', 'label' => 'Uncategorized' ),
		array( 'id' => 'window_treatments', 'label' => 'Window treatments' ),
		array( 'id' => 'hvac', 'label' => 'HVAC' ),
		array( 'id' => 'plumbing', 'label' => 'Plumbing' ),
		array( 'id' => 'electrical', 'label' => 'Electrical' ),
		array( 'id' => 'roofing', 'label' => 'Roofing' ),
		array( 'id' => 'landscaping', 'label' => 'Landscaping' ),
		array( 'id' => 'dental', 'label' => 'Dental' ),
		array( 'id' => 'legal', 'label' => 'Legal' ),
		array( 'id' => 'real_estate', 'label' => 'Real estate' ),
		array( 'id' => 'automotive', 'label' => 'Automotive' ),
		array( 'id' => 'cleaning', 'label' => 'Cleaning' ),
		array( 'id' => 'pest_control', 'label' => 'Pest control' ),
		array( 'id' => 'moving', 'label' => 'Moving' ),
		array( 'id' => 'fitness', 'label' => 'Fitness' ),
		array( 'id' => 'beauty_salon', 'label' => 'Beauty / salon' ),
		array( 'id' => 'veterinary', 'label' => 'Veterinary' ),
		array( 'id' => 'insurance', 'label' => 'Insurance' ),
		array( 'id' => 'accounting', 'label' => 'Accounting' ),
		array( 'id' => 'home_renovation', 'label' => 'Home renovation' ),
		array( 'id' => 'flooring', 'label' => 'Flooring' ),
		array( 'id' => 'painting', 'label' => 'Painting' ),
		array( 'id' => 'fencing', 'label' => 'Fencing' ),
		array( 'id' => 'garage_doors', 'label' => 'Garage doors' ),
		array( 'id' => 'pool_spa', 'label' => 'Pool / spa' ),
		array( 'id' => 'interior_design', 'label' => 'Interior design' ),
		array( 'id' => 'solar_energy', 'label' => 'Solar energy' ),
		array( 'id' => 'waste_removal', 'label' => 'Waste removal' ),
		array( 'id' => 'event_rentals', 'label' => 'Event rentals' ),
		array( 'id' => 'digital_marketing', 'label' => 'Digital marketing' ),
		array( 'id' => 'outdoor_living', 'label' => 'Outdoor living' ),
		array( 'id' => 'health_wellness', 'label' => 'Health / wellness' ),
	);

	/** @var array<string,string> */
	const LEGACY_ALIASES = array(
		'other_local_service' => 'uncategorized',
		'otherlocalservice'   => 'uncategorized',
		'local_service'       => 'uncategorized',
		'localservice'        => 'uncategorized',
	);

	public static function normalize( string $raw ): string {
		$s = strtolower( trim( $raw ) );
		$s = preg_replace( '/\s+/', '_', $s );
		$s = preg_replace( '/[^a-z0-9_]/', '', (string) $s );
		if ( $s === '' ) {
			return 'uncategorized';
		}
		if ( isset( self::LEGACY_ALIASES[ $s ] ) ) {
			return self::LEGACY_ALIASES[ $s ];
		}
		foreach ( self::TAXONOMY as $row ) {
			if ( $row['id'] === $s ) {
				return $s;
			}
		}
		return 'uncategorized';
	}

	public static function label( string $id ): string {
		$norm = self::normalize( $id );
		foreach ( self::TAXONOMY as $row ) {
			if ( $row['id'] === $norm ) {
				return $row['label'];
			}
		}
		return 'Uncategorized';
	}

	public static function list_for_prompt(): string {
		$lines = array();
		foreach ( self::TAXONOMY as $row ) {
			if ( $row['id'] === 'uncategorized' ) {
				continue;
			}
			$lines[] = $row['id'] . ': ' . $row['label'];
		}
		return implode( "\n", $lines );
	}

	public static function classify_rules(): string {
		return 'Rules:
- Use only ids from the list. Never use other_local_service, local_service, or any id containing "other" or "local".
- Pick the most specific vertical for each business (never a generic catch-all).
- interior_design: interior design studios, décor, staging (not window blind installers unless design-first).
- window_treatments: blinds, shades, drapery installers (e.g. Blind Magic, Advance Blinds).
- solar_energy: solar installers (e.g. Ridgeline Solar).
- waste_removal: junk removal, dumpster, hauling (e.g. You Junk It).
- event_rentals: tent, party, event equipment rental (e.g. Superior Tent Rentals).
- digital_marketing: SEO, web, digital agencies (e.g. Neo Digital, neoblueprint).
- outdoor_living: patios, outdoor kitchens, pergolas (e.g. Posh Outdoors).
- health_wellness: chiropractic, medical practice homepages (e.g. Dr. Rebecca-Jane McAllister).
- landscaping: lawn, landscape design (when clearly landscaping-first).
- Use uncategorized only when truly unclear after reviewing name and URL.';
	}
}

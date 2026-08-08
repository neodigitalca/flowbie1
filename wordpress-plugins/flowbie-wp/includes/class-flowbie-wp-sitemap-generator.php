<?php
/**
 * Sitemap XML and HTML generation.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

/**
 * Builds sitemap index, child XML, and HTML output.
 */
class Flowbie_Wp_Sitemap_Generator {

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function build_index( array $config ): string {
		$entries = self::index_entries( $config );
		$xml     = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$xml    .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

		foreach ( $entries as $entry ) {
			$xml .= "\t<sitemap>\n";
			$xml .= "\t\t<loc>" . esc_url( $entry['loc'] ) . "</loc>\n";
			if ( ! empty( $entry['lastmod'] ) ) {
				$xml .= "\t\t<lastmod>" . esc_html( $entry['lastmod'] ) . "</lastmod>\n";
			}
			$xml .= "\t</sitemap>\n";
		}

		$xml .= '</sitemapindex>';
		return $xml;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, array{loc:string,lastmod?:string}>
	 */
	public static function index_entries( array $config ): array {
		$entries = array();
		$now     = gmdate( 'c' );

		foreach ( self::enabled_post_types( $config ) as $slug ) {
			$pages = self::post_type_page_count( $slug, $config );
			for ( $page = 1; $page <= $pages; $page++ ) {
				$entries[] = array(
					'loc'     => Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug, $page ),
					'lastmod' => $now,
				);
			}
		}

		foreach ( self::enabled_taxonomies( $config ) as $slug ) {
			$pages = self::taxonomy_page_count( $slug, $config );
			for ( $page = 1; $page <= $pages; $page++ ) {
				$entries[] = array(
					'loc'     => Flowbie_Wp_Sitemap_Settings::child_sitemap_url( $slug, $page ),
					'lastmod' => $now,
				);
			}
		}

		return $entries;
	}

	/**
	 * All published posts from every XML-enabled post type (full sitemap inventory).
	 *
	 * @param array<string, mixed>|null $config Optional sitemap config; loads saved config when null.
	 * @return array<int, array{post:WP_Post,type:string}>
	 */
	public static function collect_all_posts( ?array $config = null ): array {
		$config = null !== $config ? $config : Flowbie_Wp_Sitemap_Settings::get_config();
		$out    = array();

		foreach ( self::enabled_post_types( $config ) as $post_type ) {
			$page_count = self::post_type_page_count( $post_type, $config );
			for ( $page = 1; $page <= $page_count; $page++ ) {
				foreach ( self::query_posts( $post_type, $page, $config ) as $post ) {
					if ( $post instanceof WP_Post ) {
						$out[] = array(
							'post' => $post,
							'type' => $post_type,
						);
					}
				}
			}
		}

		return $out;
	}

	/**
	 * Post type slugs included in the XML sitemap (for chat index debug).
	 *
	 * @param array<string, mixed>|null $config Optional sitemap config.
	 * @return array<int, string>
	 */
	public static function sitemap_index_post_types( ?array $config = null ): array {
		$config = null !== $config ? $config : Flowbie_Wp_Sitemap_Settings::get_config();
		return self::enabled_post_types( $config );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function build_post_type_sitemap( string $post_type, int $page, array $config ): string {
		$posts = self::query_posts( $post_type, $page, $config );
		return self::build_urlset_from_posts( $posts, $post_type, $config );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function build_taxonomy_sitemap( string $taxonomy, int $page, array $config ): string {
		$terms = self::query_terms( $taxonomy, $page, $config );
		return self::build_urlset_from_terms( $terms );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, string>
	 */
	public static function enabled_post_types( array $config ): array {
		$out = array();
		if ( empty( $config['post_types'] ) || ! is_array( $config['post_types'] ) ) {
			return $out;
		}
		foreach ( $config['post_types'] as $slug => $settings ) {
			if ( ! empty( $settings['include_xml'] ) ) {
				$out[] = sanitize_key( (string) $slug );
			}
		}
		return $out;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, string>
	 */
	public static function enabled_taxonomies( array $config ): array {
		$out = array();
		if ( empty( $config['taxonomies'] ) || ! is_array( $config['taxonomies'] ) ) {
			return $out;
		}
		foreach ( $config['taxonomies'] as $slug => $settings ) {
			if ( ! empty( $settings['include_xml'] ) ) {
				$out[] = sanitize_key( (string) $slug );
			}
		}
		return $out;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function post_type_page_count( string $post_type, array $config ): int {
		$per_page = self::links_per_sitemap( $config );
		$total    = self::count_posts( $post_type, $config );
		if ( $total < 1 ) {
			return 1;
		}
		return (int) ceil( $total / $per_page );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function taxonomy_page_count( string $taxonomy, array $config ): int {
		$per_page = self::links_per_sitemap( $config );
		$total    = self::count_terms( $taxonomy );
		if ( $total < 1 ) {
			return 1;
		}
		return (int) ceil( $total / $per_page );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function links_per_sitemap( array $config ): int {
		$links = (int) ( $config['general']['links_per_sitemap'] ?? 200 );
		return max( 1, min( 50000, $links ) );
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 */
	private static function count_posts( string $post_type, array $config ): int {
		$query = new WP_Query(
			array(
				'post_type'              => $post_type,
				'post_status'            => 'publish',
				'posts_per_page'         => 1,
				'fields'                 => 'ids',
				'no_found_rows'          => false,
				'update_post_meta_cache' => false,
				'update_post_term_cache'=> false,
				'post__not_in'           => Flowbie_Wp_Sitemap_Settings::excluded_post_ids( $config ),
			)
		);
		$total = (int) $query->found_posts;
		wp_reset_postdata();
		return $total;
	}

	private static function count_terms( string $taxonomy ): int {
		$terms = wp_count_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => true,
			)
		);
		return is_wp_error( $terms ) ? 0 : (int) $terms;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, WP_Post>
	 */
	private static function query_posts( string $post_type, int $page, array $config ): array {
		$per_page = self::links_per_sitemap( $config );
		$query    = new WP_Query(
			array(
				'post_type'              => $post_type,
				'post_status'            => 'publish',
				'posts_per_page'         => $per_page,
				'paged'                  => max( 1, $page ),
				'orderby'                => 'modified',
				'order'                  => 'DESC',
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
				'post__not_in'           => Flowbie_Wp_Sitemap_Settings::excluded_post_ids( $config ),
			)
		);
		$posts = is_array( $query->posts ) ? $query->posts : array();
		wp_reset_postdata();

		$filtered = array();
		foreach ( $posts as $post ) {
			if ( $post instanceof WP_Post && ! self::is_post_noindex( $post->ID ) ) {
				$filtered[] = $post;
			}
		}
		return $filtered;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, WP_Term>
	 */
	private static function query_terms( string $taxonomy, int $page, array $config ): array {
		$per_page = self::links_per_sitemap( $config );
		$offset   = ( max( 1, $page ) - 1 ) * $per_page;
		$terms    = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => true,
				'number'     => $per_page,
				'offset'     => $offset,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);
		if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
			return array();
		}
		return $terms;
	}

	/**
	 * @param array<int, WP_Post>  $posts Posts.
	 * @param array<string, mixed> $config Settings config.
	 */
	private static function build_urlset_from_posts( array $posts, string $post_type, array $config ): string {
		$include_images = ! empty( $config['general']['include_images'] );
		$meta_keys      = array();
		if ( $include_images && isset( $config['post_types'][ $post_type ]['image_meta'] ) ) {
			$meta_keys = Flowbie_Wp_Sitemap_Settings::parse_meta_lines( (string) $config['post_types'][ $post_type ]['image_meta'] );
		}

		$xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

		foreach ( $posts as $post ) {
			$url = get_permalink( $post );
			if ( ! $url ) {
				continue;
			}
			$xml .= "\t<url>\n";
			$xml .= "\t\t<loc>" . esc_url( $url ) . "</loc>\n";
			$xml .= "\t\t<lastmod>" . esc_html( gmdate( 'c', strtotime( $post->post_modified_gmt ) ) ) . "</lastmod>\n";

			if ( $include_images ) {
				$images = self::post_images( $post, $meta_keys );
				foreach ( $images as $image_url ) {
					$xml .= "\t\t<image:image>\n";
					$xml .= "\t\t\t<image:loc>" . esc_url( $image_url ) . "</image:loc>\n";
					$xml .= "\t\t</image:image>\n";
				}
			}

			$xml .= "\t</url>\n";
		}

		$xml .= '</urlset>';
		return $xml;
	}

	/**
	 * @param array<int, WP_Term> $terms Terms.
	 */
	private static function build_urlset_from_terms( array $terms ): string {
		$xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

		foreach ( $terms as $term ) {
			if ( ! ( $term instanceof WP_Term ) ) {
				continue;
			}
			$url = get_term_link( $term );
			if ( is_wp_error( $url ) || ! $url ) {
				continue;
			}
			$xml .= "\t<url>\n";
			$xml .= "\t\t<loc>" . esc_url( $url ) . "</loc>\n";
			$xml .= "\t</url>\n";
		}

		$xml .= '</urlset>';
		return $xml;
	}

	/**
	 * @param array<int, string> $meta_keys Custom field keys.
	 * @return array<int, string>
	 */
	private static function post_images( WP_Post $post, array $meta_keys ): array {
		$images = array();

		$thumb_id = get_post_thumbnail_id( $post->ID );
		if ( $thumb_id ) {
			$src = wp_get_attachment_image_url( $thumb_id, 'full' );
			if ( is_string( $src ) && $src !== '' ) {
				$images[] = $src;
			}
		}

		foreach ( $meta_keys as $key ) {
			$value = get_post_meta( $post->ID, $key, true );
			if ( is_string( $value ) && filter_var( $value, FILTER_VALIDATE_URL ) ) {
				$images[] = $value;
			} elseif ( is_numeric( $value ) ) {
				$src = wp_get_attachment_image_url( (int) $value, 'full' );
				if ( is_string( $src ) && $src !== '' ) {
					$images[] = $src;
				}
			}
		}

		return array_values( array_unique( $images ) );
	}

	private static function is_post_noindex( int $post_id ): bool {
		$rm = get_post_meta( $post_id, 'rank_math_robots', true );
		if ( is_array( $rm ) && in_array( 'noindex', $rm, true ) ) {
			return true;
		}
		if ( is_string( $rm ) && stripos( $rm, 'noindex' ) !== false ) {
			return true;
		}

		$yoast = get_post_meta( $post_id, '_yoast_wpseo_meta-robots-noindex', true );
		if ( (string) $yoast === '1' ) {
			return true;
		}

		return false;
	}

	/**
	 * Build HTML sitemap markup.
	 *
	 * @param array<string, mixed> $config Settings config.
	 */
	public static function build_html( array $config ): string {
		if ( empty( $config['html']['enabled'] ) ) {
			return '';
		}

		$sort = isset( $config['html']['sort_order'] ) ? (string) $config['html']['sort_order'] : 'title';
		$html = '<div class="flowbie-wp-html-sitemap">';

		foreach ( $config['post_types'] as $slug => $settings ) {
			if ( empty( $settings['include_html'] ) ) {
				continue;
			}
			$obj = get_post_type_object( $slug );
			if ( ! $obj ) {
				continue;
			}
			$posts = self::query_html_posts( $slug, $config, $sort );
			if ( empty( $posts ) ) {
				continue;
			}
			$html .= '<section class="flowbie-wp-html-sitemap__group">';
			$html .= '<h2 class="flowbie-wp-html-sitemap__title">' . esc_html( $obj->labels->name ) . '</h2>';
			$html .= '<ul class="flowbie-wp-html-sitemap__list">';
			foreach ( $posts as $post ) {
				$url = get_permalink( $post );
				if ( ! $url ) {
					continue;
				}
				$html .= '<li><a href="' . esc_url( $url ) . '">' . esc_html( get_the_title( $post ) ) . '</a></li>';
			}
			$html .= '</ul></section>';
		}

		foreach ( $config['taxonomies'] as $slug => $settings ) {
			if ( empty( $settings['include_html'] ) ) {
				continue;
			}
			$tax = get_taxonomy( $slug );
			if ( ! $tax ) {
				continue;
			}
			$terms = get_terms(
				array(
					'taxonomy'   => $slug,
					'hide_empty' => true,
					'orderby'    => 'name',
					'order'      => 'ASC',
				)
			);
			if ( is_wp_error( $terms ) || empty( $terms ) ) {
				continue;
			}
			$html .= '<section class="flowbie-wp-html-sitemap__group">';
			$html .= '<h2 class="flowbie-wp-html-sitemap__title">' . esc_html( $tax->labels->name ) . '</h2>';
			$html .= '<ul class="flowbie-wp-html-sitemap__list">';
			foreach ( $terms as $term ) {
				if ( ! ( $term instanceof WP_Term ) ) {
					continue;
				}
				$url = get_term_link( $term );
				if ( is_wp_error( $url ) || ! $url ) {
					continue;
				}
				$html .= '<li><a href="' . esc_url( $url ) . '">' . esc_html( $term->name ) . '</a></li>';
			}
			$html .= '</ul></section>';
		}

		$html .= '</div>';
		return $html;
	}

	/**
	 * @param array<string, mixed> $config Settings config.
	 * @return array<int, WP_Post>
	 */
	private static function query_html_posts( string $post_type, array $config, string $sort ): array {
		$orderby = 'title';
		$order   = 'ASC';
		if ( 'date' === $sort ) {
			$orderby = 'date';
			$order   = 'DESC';
		} elseif ( 'menu_order' === $sort ) {
			$orderby = 'menu_order';
			$order   = 'ASC';
		}

		$query = new WP_Query(
			array(
				'post_type'              => $post_type,
				'post_status'            => 'publish',
				'posts_per_page'         => 500,
				'orderby'                => $orderby,
				'order'                  => $order,
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'post__not_in'           => Flowbie_Wp_Sitemap_Settings::excluded_post_ids( $config ),
			)
		);
		$posts = is_array( $query->posts ) ? $query->posts : array();
		wp_reset_postdata();

		$filtered = array();
		foreach ( $posts as $post ) {
			if ( $post instanceof WP_Post && ! self::is_post_noindex( $post->ID ) ) {
				$filtered[] = $post;
			}
		}
		return $filtered;
	}
}

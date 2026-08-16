<?php
/**
 * Automation recipe catalog loaded from recipes/*.json.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Automation_Recipe_Registry {

	/** @var array<string,array<string,mixed>>|null */
	private static $recipes = null;

	public static function recipes_dir(): string {
		return NEO_PULSE_APP_PLUGIN_DIR . 'recipes';
	}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	public static function all(): array {
		if ( is_array( self::$recipes ) ) {
			return self::$recipes;
		}

		self::$recipes = array();
		$dir           = self::recipes_dir();
		if ( ! is_dir( $dir ) ) {
			return self::$recipes;
		}

		$files = glob( $dir . '/*.json' );
		if ( ! is_array( $files ) ) {
			return self::$recipes;
		}

		foreach ( $files as $file ) {
			if ( ! is_string( $file ) || ! is_readable( $file ) ) {
				continue;
			}
			$raw = file_get_contents( $file );
			if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
				continue;
			}
			$data = json_decode( $raw, true );
			if ( ! is_array( $data ) ) {
				continue;
			}
			$recipe = self::normalize_recipe( $data );
			if ( $recipe === null ) {
				continue;
			}
			$kw = sanitize_title( (string) ( $recipe['keyword'] ?? '' ) );
			if ( $kw === '' ) {
				continue;
			}
			self::$recipes[ $kw ] = $recipe;
		}

		ksort( self::$recipes );
		return self::$recipes;
	}

	/**
	 * @param array<string,mixed> $data
	 * @return array<string,mixed>|null
	 */
	private static function normalize_recipe( array $data ): ?array {
		$keyword = sanitize_title( (string) ( $data['keyword'] ?? '' ) );
		$name    = sanitize_text_field( (string) ( $data['name'] ?? '' ) );
		if ( $keyword === '' || $name === '' ) {
			return null;
		}
		if ( empty( $data['defaultTasks'] ) || ! is_array( $data['defaultTasks'] ) ) {
			return null;
		}

		$default_tasks = array();
		foreach ( $data['defaultTasks'] as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$title = sanitize_text_field( (string) ( $task['title'] ?? '' ) );
			if ( $title === '' ) {
				continue;
			}
			$default_tasks[] = $task;
		}
		if ( count( $default_tasks ) === 0 ) {
			return null;
		}

		$filters = is_array( $data['filters'] ?? null ) ? $data['filters'] : array();

		return array(
			'keyword'        => $keyword,
			'kind'           => 'template',
			'name'           => $name,
			'description'    => sanitize_textarea_field( (string) ( $data['description'] ?? '' ) ),
			'notes'          => self::sanitize_notes_list( $data['notes'] ?? array() ),
			'isAutomation'   => true,
			'category'       => sanitize_key( (string) ( $data['category'] ?? 'reactive' ) ),
			'verticals'      => self::sanitize_string_list( $data['verticals'] ?? array() ),
			'tags'           => self::sanitize_string_list( $data['tags'] ?? array() ),
			'prerequisites'  => self::sanitize_string_list( $data['prerequisites'] ?? array() ),
			'filters'        => array(
				'executionKinds'  => self::sanitize_string_list( $filters['executionKinds'] ?? array() ),
				'targetBuckets'   => self::sanitize_string_list( $filters['targetBuckets'] ?? array() ),
				'triggerSignals'  => self::sanitize_string_list( $filters['triggerSignals'] ?? array() ),
				'actionCount'     => max( 1, (int) ( $filters['actionCount'] ?? count( $default_tasks ) ) ),
			),
			'triggerBlock'   => is_array( $data['triggerBlock'] ?? null ) ? $data['triggerBlock'] : self::derive_trigger_block( $default_tasks[0] ),
			'actionBlock'    => is_array( $data['actionBlock'] ?? null ) ? $data['actionBlock'] : self::derive_action_block( $default_tasks[0] ),
			'actionBlocks'   => is_array( $data['actionBlocks'] ?? null ) ? $data['actionBlocks'] : ( count( $default_tasks ) > 1 ? array_map( array( __CLASS__, 'derive_action_block' ), $default_tasks ) : null ),
			'defaultTasks'   => $default_tasks,
		);
	}

	/**
	 * @param array<string,mixed> $task
	 * @return array<string,mixed>
	 */
	private static function derive_trigger_block( array $task ): array {
		$mode = Neo_Pulse_App_Tasks_Store::sanitize_schedule_mode( $task['scheduleMode'] ?? 'trigger' );
		if ( $mode === 'calendar' ) {
			$rule = Neo_Pulse_App_Tasks_Store::sanitize_recurrence_rule( $task['recurrenceRule'] ?? 'none' );
			$freq = $rule === 'none' ? 'once' : $rule;
			return array(
				'keyword'   => 'schedule-' . $freq,
				'kind'      => 'calendar',
				'frequency' => $freq,
				'startDate' => substr( (string) ( $task['dueDate'] ?? '' ), 0, 10 ),
				'time'      => Neo_Pulse_App_Tasks_Store::sanitize_due_time( $task['dueTime'] ?? '' ),
			);
		}
		$config = is_array( $task['triggerConfig'] ?? null ) ? $task['triggerConfig'] : array();
		return array(
			'keyword'       => 'gsc-custom',
			'kind'          => 'gsc',
			'source'        => 'gsc',
			'triggerConfig' => $config,
		);
	}

	/**
	 * @param array<string,mixed> $task
	 * @return array<string,mixed>
	 */
	private static function derive_action_block( array $task ): array {
		return array(
			'keyword'           => 'action-' . sanitize_key( (string) ( $task['executionKind'] ?? 'content_optimizer' ) ),
			'executionKind'     => (string) ( $task['executionKind'] ?? 'content_optimizer' ),
			'executionPayload'  => is_array( $task['executionPayload'] ?? null ) ? $task['executionPayload'] : array(),
			'title'             => sanitize_text_field( (string) ( $task['title'] ?? '' ) ),
		);
	}

	/**
	 * @param mixed $list
	 * @return array<int,string>
	 */
	private static function sanitize_string_list( $list ): array {
		if ( ! is_array( $list ) ) {
			return array();
		}
		$out = array();
		foreach ( $list as $item ) {
			$s = sanitize_key( (string) $item );
			if ( $s !== '' ) {
				$out[] = $s;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param mixed $list
	 * @return array<int,string>
	 */
	private static function sanitize_notes_list( $list ): array {
		if ( ! is_array( $list ) ) {
			return array();
		}
		$out = array();
		foreach ( $list as $item ) {
			$s = sanitize_textarea_field( (string) $item );
			if ( $s !== '' ) {
				$out[] = $s;
			}
		}
		return array_values( $out );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get_by_keyword( string $keyword ): ?array {
		$keyword = sanitize_title( $keyword );
		if ( $keyword === '' ) {
			return null;
		}
		$all = self::all();
		return $all[ $keyword ] ?? null;
	}

	public static function is_automation_keyword( string $keyword ): bool {
		return self::get_by_keyword( $keyword ) !== null;
	}

	/**
	 * Template rows for Tasks_Store::default_templates merge.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public static function as_task_templates(): array {
		$out = array();
		foreach ( self::all() as $recipe ) {
			$out[] = array(
				'keyword'      => (string) $recipe['keyword'],
				'kind'         => 'template',
				'name'         => (string) $recipe['name'],
				'defaultTasks' => $recipe['defaultTasks'],
			);
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $query
	 * @return array<int,array<string,mixed>>
	 */
	public static function list_for_api( array $query = array() ): array {
		$include_tasks = ! empty( $query['includeTasks'] );
		$category      = sanitize_key( (string) ( $query['category'] ?? '' ) );
		$bucket        = sanitize_key( (string) ( $query['bucket'] ?? '' ) );
		$execution     = sanitize_key( (string) ( $query['execution'] ?? '' ) );
		$signal        = sanitize_key( (string) ( $query['signal'] ?? '' ) );
		$vertical      = sanitize_key( (string) ( $query['vertical'] ?? '' ) );
		$q             = strtolower( trim( (string) ( $query['q'] ?? '' ) ) );

		$out = array();
		foreach ( self::all() as $recipe ) {
			if ( $category !== '' && sanitize_key( (string) ( $recipe['category'] ?? '' ) ) !== $category ) {
				continue;
			}
			if ( $vertical !== '' ) {
				$verticals = is_array( $recipe['verticals'] ?? null ) ? $recipe['verticals'] : array();
				if ( ! in_array( $vertical, $verticals, true ) ) {
					continue;
				}
			}
			if ( $bucket !== '' ) {
				$buckets = is_array( $recipe['filters']['targetBuckets'] ?? null ) ? $recipe['filters']['targetBuckets'] : array();
				if ( ! in_array( $bucket, $buckets, true ) ) {
					continue;
				}
			}
			if ( $signal !== '' ) {
				$signals = is_array( $recipe['filters']['triggerSignals'] ?? null ) ? $recipe['filters']['triggerSignals'] : array();
				if ( ! in_array( $signal, $signals, true ) ) {
					continue;
				}
			}
			if ( $execution !== '' ) {
				$kinds = is_array( $recipe['filters']['executionKinds'] ?? null ) ? $recipe['filters']['executionKinds'] : array();
				if ( $execution === 'meta-only' && ! in_array( 'content_optimizer_meta', $kinds, true ) ) {
					continue;
				}
				if ( $execution === 'full-aiseo' && ! in_array( 'content_optimizer', $kinds, true ) ) {
					continue;
				}
			}
			if ( $q !== '' && ! self::matches_search( $recipe, $q ) ) {
				continue;
			}

			$item = self::catalog_item_from_recipe( $recipe, $include_tasks );
			$out[] = $item;
		}

		return $out;
	}

	/**
	 * @param array<string,mixed> $recipe
	 */
	private static function matches_search( array $recipe, string $q ): bool {
		$hay = strtolower(
			(string) ( $recipe['keyword'] ?? '' ) . ' '
			. (string) ( $recipe['name'] ?? '' ) . ' '
			. (string) ( $recipe['description'] ?? '' ) . ' '
			. implode( ' ', is_array( $recipe['tags'] ?? null ) ? $recipe['tags'] : array() ) . ' '
			. implode( ' ', is_array( $recipe['notes'] ?? null ) ? $recipe['notes'] : array() )
		);
		return str_contains( $hay, $q );
	}

	/**
	 * @param array<string,mixed> $recipe
	 * @return array<string,mixed>
	 */
	public static function catalog_item_from_recipe( array $recipe, bool $include_tasks = false ): array {
		$item = array(
			'keyword'       => (string) ( $recipe['keyword'] ?? '' ),
			'name'          => (string) ( $recipe['name'] ?? '' ),
			'description'   => (string) ( $recipe['description'] ?? '' ),
			'notes'         => is_array( $recipe['notes'] ?? null ) ? $recipe['notes'] : array(),
			'isAutomation'  => true,
			'category'      => (string) ( $recipe['category'] ?? '' ),
			'verticals'     => is_array( $recipe['verticals'] ?? null ) ? $recipe['verticals'] : array(),
			'tags'          => is_array( $recipe['tags'] ?? null ) ? $recipe['tags'] : array(),
			'prerequisites' => is_array( $recipe['prerequisites'] ?? null ) ? $recipe['prerequisites'] : array(),
			'filters'       => is_array( $recipe['filters'] ?? null ) ? $recipe['filters'] : array(),
		);
		if ( $include_tasks ) {
			$item['defaultTasks'] = is_array( $recipe['defaultTasks'] ?? null ) ? $recipe['defaultTasks'] : array();
		}
		if ( is_array( $recipe['triggerBlock'] ?? null ) ) {
			$item['triggerBlock'] = $recipe['triggerBlock'];
		}
		if ( is_array( $recipe['actionBlock'] ?? null ) ) {
			$item['actionBlock'] = $recipe['actionBlock'];
		}
		if ( is_array( $recipe['actionBlocks'] ?? null ) ) {
			$item['actionBlocks'] = $recipe['actionBlocks'];
		}
		return $item;
	}

	/**
	 * @return array<int,array<string,string>>
	 */
	public static function filter_options_for_api(): array {
		$categories = array();
		$verticals  = array();
		$buckets    = array();
		$signals    = array();
		foreach ( self::all() as $recipe ) {
			$cat = sanitize_key( (string) ( $recipe['category'] ?? '' ) );
			if ( $cat !== '' ) {
				$categories[ $cat ] = true;
			}
			foreach ( is_array( $recipe['verticals'] ?? null ) ? $recipe['verticals'] : array() as $v ) {
				$verticals[ sanitize_key( (string) $v ) ] = true;
			}
			foreach ( is_array( $recipe['filters']['targetBuckets'] ?? null ) ? $recipe['filters']['targetBuckets'] : array() as $b ) {
				$buckets[ sanitize_key( (string) $b ) ] = true;
			}
			foreach ( is_array( $recipe['filters']['triggerSignals'] ?? null ) ? $recipe['filters']['triggerSignals'] : array() as $s ) {
				$signals[ sanitize_key( (string) $s ) ] = true;
			}
		}
		return array(
			'categories' => array_keys( $categories ),
			'verticals'  => array_keys( $verticals ),
			'buckets'    => array_keys( $buckets ),
			'signals'    => array_keys( $signals ),
		);
	}
}

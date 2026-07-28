<?php
/**
 * Load all field type classes.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

$flowbie_field_types_dir = __DIR__ . '/';
require_once $flowbie_field_types_dir . 'class-field-scalar.php';
require_once $flowbie_field_types_dir . 'class-field-wysiwyg.php';
require_once $flowbie_field_types_dir . 'class-field-media.php';
require_once $flowbie_field_types_dir . 'class-field-choice.php';
require_once $flowbie_field_types_dir . 'class-field-relational.php';
require_once $flowbie_field_types_dir . 'class-field-misc.php';
require_once $flowbie_field_types_dir . 'class-field-layout.php';

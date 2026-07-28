const LIST_ARRAY_POLYFILL = `
/**
 * PHP 7.4 compatible list-array check (array_is_list is PHP 8.1+).
 */
function hello_elementor_child_is_list_array( $array ) {
	if ( ! is_array( $array ) ) {
		return false;
	}

	$expected = 0;
	foreach ( $array as $key => $_value ) {
		if ( $key !== $expected ) {
			return false;
		}
		$expected++;
	}

	return true;
}
`.trim();

/**
 * Sanitize model output before paste/deploy. Prevents common fatals on PHP 7.4/8.0 hosts.
 */
export function normalizeFunctionsPhpOutput(php: string): string {
	let out = php.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trimStart();

	// Model often emits "<?php/**" with no newline; normalize for Theme File Editor.
	out = out.replace(/^<\?php[ \t]*(?=\S)/, "<?php\n");

	// array_is_list() fatals on PHP < 8.1.
	out = out.replace(/\barray_is_list\s*\(/g, 'hello_elementor_child_is_list_array(');

	if (
		out.includes('hello_elementor_child_is_list_array(') &&
		!out.includes('function hello_elementor_child_is_list_array')
	) {
		const anchor = out.indexOf('function hello_elementor_child_get_schema_field');
		if (anchor !== -1) {
			const closeBrace = out.indexOf("\n}\n", anchor);
			if (closeBrace !== -1) {
				const insertAt = closeBrace + 3;
				out = `${out.slice(0, insertAt)}\n\n${LIST_ARRAY_POLYFILL}\n${out.slice(insertAt)}`;
			}
		}
	}

	return out;
}

import { describe, expect, it } from 'vitest';
import { normalizeFunctionsPhpOutput } from '../normalize-functions-php';

describe('normalizeFunctionsPhpOutput', () => {
  it('inserts newline after <?php when missing', () => {
    const input = '<?php/** header */';
    expect(normalizeFunctionsPhpOutput(input)).toBe("<?php\n/** header */");
  });

  it('replaces array_is_list and injects polyfill', () => {
    const input = [
      '<?php',
      'function hello_elementor_child_get_schema_field() {',
      '  return "";',
      '}',
      '$nodes = array_is_list( $decoded ) ? $decoded : array( $decoded );',
    ].join('\n');

    const out = normalizeFunctionsPhpOutput(input);
    expect(out).not.toMatch(/\barray_is_list\s*\(/);
    expect(out).toContain('function hello_elementor_child_is_list_array');
    expect(out).toContain('hello_elementor_child_is_list_array( $decoded )');
  });
});

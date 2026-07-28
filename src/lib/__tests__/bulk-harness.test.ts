import { describe, expect, it } from 'vitest';
import { stitchHarnessSections } from '@/lib/bulk/bulk-harness-outline';
import { stripFooterElementsFromHarnessSectionHtml } from '@/lib/bulk/harness-html-strip-footer';
import { generateSingleSectionPrompt, generateSectionsPrompt } from '@/lib/prompt-builders';
import type { AgentConfig } from '@/types/agent-config';

describe('stitchHarnessSections', () => {
  it('preserves input order and joins with blank line', () => {
    const a = '<h2>First</h2><p>a</p>';
    const b = '<h2>Second</h2><p>b</p>';
    expect(stitchHarnessSections([a, b])).toBe(`${a}\n\n${b}`);
  });

  it('strips outer whitespace on pieces and drops empties', () => {
    expect(stitchHarnessSections(['  <p>x</p>  ', '', '  '])).toBe('<p>x</p>');
  });
});

describe('stripFooterElementsFromHarnessSectionHtml', () => {
  it('unwraps footer inner HTML into the section', () => {
    const input =
      '<h2>Topic</h2><p>Body</p><footer><p>Wrap-up line.</p></footer>';
    expect(stripFooterElementsFromHarnessSectionHtml(input)).toBe(
      '<h2>Topic</h2><p>Body</p><p>Wrap-up line.</p>',
    );
  });

  it('removes multiple footer blocks', () => {
    const input = '<p>a</p><footer><p>b</p></footer><p>c</p><footer><p>d</p></footer>';
    expect(stripFooterElementsFromHarnessSectionHtml(input)).toBe('<p>a</p><p>b</p><p>c</p><p>d</p>');
  });

  it('leaves sections without footer unchanged', () => {
    const input = '<h2>Only</h2><p>Paragraph.</p>';
    expect(stripFooterElementsFromHarnessSectionHtml(input)).toBe(input);
  });
});

describe('generateSingleSectionPrompt', () => {
  const agentA: AgentConfig = {
    id: 'a',
    step: 1,
    title: 'Alpha Topic',
    description: 'About alpha',
    features: ['[LIST] bullets'],
  };
  const agentB: AgentConfig = {
    id: 'b',
    step: 2,
    title: 'Beta Topic',
    description: 'About beta only',
    features: ['[TABLE] comparison'],
  };

  it('does not embed the other agent title or description', () => {
    const one = generateSingleSectionPrompt(agentA, 'html');
    expect(one).toContain('Alpha Topic');
    expect(one).not.toContain('Beta Topic');
    expect(one).not.toContain('About beta');
    const two = generateSingleSectionPrompt(agentB, 'html');
    expect(two).toContain('Beta Topic');
    expect(two).not.toContain('Alpha Topic');
    expect(two).not.toContain('About alpha');
  });

  it('generateSectionsPrompt equals per-agent prompts joined', () => {
    const agents = [agentA, agentB];
    expect(generateSectionsPrompt(agents, 'html')).toBe(
      [generateSingleSectionPrompt(agentA, 'html'), generateSingleSectionPrompt(agentB, 'html')].join('\n\n'),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { stitchHarnessSections } from '@/lib/bulk/bulk-harness-outline';
import { stripFooterElementsFromHarnessSectionHtml } from '@/lib/bulk/harness-html-strip-footer';
import { generateSingleSectionPrompt, generateSectionsPrompt } from '@/lib/prompt-builders';
import { buildSystemPrompt, buildBulkHarnessSectionUserPrompt } from '@/lib/prompt-builders/system-user';
import type { AgentConfig } from '@/types/agent-config';
import { BLOG_HARNESS_SUMMARY_AGENT_ID } from '@/lib/bulk/blog-harness-summary-agent';

describe('stitchHarnessSections', () => {
  it('preserves input order and joins with blank line', () => {
    const a = '## First\n\nParagraph a.';
    const b = '## Second\n\nParagraph b.';
    expect(stitchHarnessSections([a, b])).toBe(`${a}\n\n${b}`);
  });

  it('strips outer whitespace on pieces and drops empties', () => {
    expect(stitchHarnessSections(['  ## x\n\nBody  ', '', '  '])).toBe('## x\n\nBody');
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
    const one = generateSingleSectionPrompt(agentA, 'markdown');
    expect(one).toContain('Alpha Topic');
    expect(one).not.toContain('Beta Topic');
    expect(one).not.toContain('About beta');
    const two = generateSingleSectionPrompt(agentB, 'markdown');
    expect(two).toContain('Beta Topic');
    expect(two).not.toContain('Alpha Topic');
    expect(two).not.toContain('About alpha');
  });

  it('generateSectionsPrompt equals per-agent prompts joined', () => {
    const agents = [agentA, agentB];
    expect(generateSectionsPrompt(agents, 'markdown')).toBe(
      [generateSingleSectionPrompt(agentA, 'markdown'), generateSingleSectionPrompt(agentB, 'markdown')].join('\n\n'),
    );
  });

  it('excludes [FORBIDDEN_WORDS] metadata from section prompt text', () => {
    const agent: AgentConfig = {
      id: 'c',
      step: 3,
      title: '5 New PST Categories',
      description: 'PST rules',
      features: ['[LIST] bullets', '[FORBIDDEN_WORDS — MANDATORY GLOBAL]: compact policy tag'],
    };
    const prompt = generateSingleSectionPrompt(agent, 'markdown');
    expect(prompt).not.toMatch(/WORD BLACKLIST \(mandatory/i);
    expect(prompt).not.toMatch(/\[FORBIDDEN_WORDS/i);
    expect(prompt).toContain('5 New PST Categories');
  });
});

describe('buildSystemPrompt', () => {
  it('prepends WORD BLACKLIST once in system prompt', async () => {
    const prompt = await buildSystemPrompt('', 'test-key');
    expect(prompt).toMatch(/WORD BLACKLIST \(mandatory/i);
    expect(prompt.match(/WORD BLACKLIST \(mandatory/g)?.length).toBe(1);
  });

  it('harness_section mode uses single-section contract not full-article first paragraph rule', async () => {
    const prompt = await buildSystemPrompt(
      '',
      'test-key',
      { name: 'Site', siteUrl: 'https://example.com' },
      undefined,
      undefined,
      undefined,
      undefined,
      'dentist ebbers edmonton',
      undefined,
      undefined,
      undefined,
      undefined,
      'harness_section',
    );
    expect(prompt).toContain('HARNESS MODE');
    expect(prompt).toContain('exactly ONE section');
    expect(prompt).not.toContain('FIRST PARAGRAPH RULE');
    expect(prompt).toContain('EXACT PRIMARY IN THIS SECTION');
    expect(prompt).not.toMatch(/CRITICAL_LINK_RULE|You MUST include exactly.*internal links/i);
    expect(prompt).toContain('Per-section link rules');
    expect(prompt).toContain('MARKDOWN ONLY');
  });

  it('includes keyword punctuation block when primaryKeyword has xray', async () => {
    const prompt = await buildSystemPrompt(
      '',
      'test-key',
      { name: 'Site', siteUrl: 'https://example.com' },
      undefined,
      undefined,
      undefined,
      undefined,
      'dental xray safety',
    );
    expect(prompt).toContain('KEYWORD PUNCTUATION');
    expect(prompt).toContain('dental X-ray safety');
  });
});

describe('buildBulkHarnessSectionUserPrompt', () => {
  it('starts with read-only WORD BLACKLIST RAG block', () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      'Article Title',
      'Focused guide (max 2000 words) about topic',
      '## Section\n\nBody',
      '=== OUTLINE ===',
      ['Other Section'],
      1,
      3,
      { name: 'Site', siteUrl: 'https://example.com' },
      undefined,
      undefined,
      true,
      'https://example.com/post/',
    );
    expect(prompt.startsWith('=== WORD BLACKLIST (READ ONLY')).toBe(true);
    expect(prompt).toMatch(/WORD BLACKLIST \(mandatory/i);
  });

  it('uses H2 plan block instead of full outline when allSectionTitles provided', () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      'Article Title',
      'Focused guide (max 2000 words) about topic',
      '## Alpha Topic\n\nBody',
      'legacy outline should not appear',
      ['Beta Topic'],
      1,
      3,
      { name: 'Site', siteUrl: 'https://example.com' },
      undefined,
      undefined,
      true,
      'https://example.com/post/',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Alpha Topic',
      'topic keyword',
      ['Overview', 'Alpha Topic', 'Beta Topic'],
    );
    expect(prompt).toContain('ARTICLE H2 PLAN');
    expect(prompt).toContain('YOU WRITE THIS ONE ONLY');
    expect(prompt).toContain('FORBIDDEN IN YOUR OUTPUT');
    expect(prompt).toContain('Any ## heading except "Alpha Topic"');
    expect(prompt).not.toContain('FULL ARTICLE OUTLINE');
    expect(prompt).not.toContain('legacy outline should not appear');
    expect(prompt).toContain('- Beta Topic');
    expect(prompt).toContain('These must NOT appear as ## heading text in your output');
  });

  it('Overview section requires contextual bullet list from model', () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      'Article Title',
      'Focused guide (max 2000 words) about topic',
      '## Overview\n\nLead\n\n- **Label**: Context with [care options](#body-section).',
      '',
      ['Body Section'],
      0,
      2,
      { name: 'Site', siteUrl: 'https://example.com' },
      'Edmonton, AB',
      undefined,
      true,
      'https://example.com/post/',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '=== OVERVIEW SCROLL-LINK TARGETS ===\nSection 1 → #body-section → "Body Section"\n=== END ===',
      'https://en.wikipedia.org/wiki/Edmonton',
    );
    expect(prompt).toContain('bullet list');
    expect(prompt).toMatch(/never "see below"/i);
    expect(prompt).not.toContain('inserted automatically');
    expect(prompt).toContain('Stop after the bullet list');
  });

  it('body section harness prompt uses 1-2 link placeholders', () => {
    const prompt = buildBulkHarnessSectionUserPrompt(
      'Article Title',
      'Focused guide (max 2000 words) about topic',
      '## Alpha Topic\n\nBody',
      'legacy outline',
      ['Beta Topic'],
      1,
      3,
      { name: 'Site', siteUrl: 'https://example.com' },
      undefined,
      undefined,
      true,
      'https://example.com/post/',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Alpha Topic',
      'topic keyword',
      ['Overview', 'Alpha Topic', 'Beta Topic'],
    );
    expect(prompt).toContain('1–2 [[LINK:');
    expect(prompt).not.toContain('3–5 [[LINK:');
  });
});

describe('generateSingleSectionPrompt harness contract', () => {
  it('includes exact ## lock and length contract for body sections', () => {
    const agent: AgentConfig = {
      id: 'body-1',
      step: 3,
      title: 'Dental Services Offered',
      description: 'List services',
      features: ['[TABLE] services'],
    };
    const prompt = generateSingleSectionPrompt(agent, 'markdown');
    expect(prompt).toContain('NON-NEGOTIABLE OUTPUT CONTRACT');
    expect(prompt).toContain('Dental Services Offered');
    expect(prompt).toContain('never nest ## inside ##');
    expect(prompt).toContain('STOP: after your last');
    expect(prompt).not.toContain('Beta Topic');
  });

  it('Overview agent prompt requires contextual scroll-link bullets', () => {
    const agent: AgentConfig = {
      id: BLOG_HARNESS_SUMMARY_AGENT_ID,
      step: 4,
      title: 'Overview',
      description: 'Summary',
      features: [],
    };
    const prompt = generateSingleSectionPrompt(agent, 'markdown');
    expect(prompt).toContain('bullet list');
    expect(prompt).toContain('exactly ONE');
    expect(prompt).toContain('FORBIDDEN per bullet: two links');
    expect(prompt).toContain('em dashes (Unicode');
    expect(prompt).toContain('WORD BLACKLIST');
    expect(prompt).toContain('Stop after the bullet list');
  });
});

export const mapFeatureToInstruction = (feature: string, format: 'markdown' | 'html' = 'html'): string => {
  const normalizedFeature = feature.toLowerCase().trim();
  const useMarkdown = format === 'markdown';

  // 0. Preserve [CUSTOM] table data - do not replace with generic instruction
  const trimmed = feature.trimStart();
  if (trimmed.toLowerCase().startsWith('[custom]:') && feature.includes('|')) {
    const hasSeparator = /\|[\s\-:]+\|/.test(feature);
    if (hasSeparator) {
      return `[CRITICAL: OUTPUT THIS EXACT TABLE VERBATIM. Do not change columns, headers, or data. Do not add/remove rows. Do not invent values.] ${feature}`;
    }
  }

  // 1. Check for table-like instructions (e.g., user supplies column headers)
  if (feature.includes('|')) {
    return useMarkdown
      ? `[CRITICAL: Markdown table ONLY. Use | Col1 | Col2 |, newline, | --- | --- |, newline, | A | B |. Links as [text](url) in cells. NEVER HTML <table>.]`
      : `[CRITICAL: HTML table ONLY. NEVER markdown (| col | or |---|). Use <table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>...</td><td>...</td></tr></tbody></table>. Integrate links as <a href="url" title="Page Title">text</a> in the first column - title attribute REQUIRED on every internal link.]`;
  }
  
  // 2. Check for FAQ feature — body FAQ is appended later as flo-faq Question/Answer table (Content Opt parity).
  if (normalizedFeature.includes('[faq]') || normalizedFeature.includes('faq')) {
    return useMarkdown
      ? `[FAQ: Do NOT write an FAQ section in this body. FAQ is appended later as H2 "FAQ" + intro + Question/Answer table. Omit FAQ headings, tables, and Q/A pairs here.]`
      : `[FAQ: Do NOT write an FAQ section in this body. FAQ is appended later as flo-faq with H2 id="faq" "FAQ" + intro + HTML Question/Answer table. Omit FAQ headings, tables, and Q/A pairs here.]`;
  }
  
  // 3. Original switch for predefined features
  switch(normalizedFeature) {
    case 'i need an image':
      // The AI should treat this as a placeholder for an image/figure
      return '[Insert: Image, specify format e.g. PNG, JPEG, or embed a Markdown link to a figurative image/chart/gif/etc in the generated text]';
    case 'i need 3-5 links':
      // Detailed instruction for proper SEO linking as per user request. User specified 3-5 links.
      return '[Insert: Page Links (e.g., internal/external links related to the topic). CRITICAL: Ensure at least 3, but no more than 5, high-quality, relevant links are included. Ensure links are naturally woven into the prose, never ending a sentence with an anchor, and are surrounded by optimize SEO text.]';
    case 'i need a video':
       // New feature case for video
       return '[Insert: Video, specify an embed or a link to a relevant video in the generated text]';
    // Add more cases for other media types as needed (e.g., tables, lists)
    default:
      return feature;
  }
};

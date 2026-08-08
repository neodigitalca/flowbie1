function parseImageFeature(feature: string): { alt: string; url: string } | null {
  const trimmed = feature.trim();
  const md = trimmed.match(/^\[IMAGE\]\s*:\s*!\[([^\]]*)\]\(([^)]+)\)/i);
  if (md) return { alt: (md[1] ?? "").trim(), url: (md[2] ?? "").trim() };
  const html = trimmed.match(/^\[IMAGE\]\s*:\s*<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/i);
  if (html) return { alt: (html[2] ?? "").trim(), url: (html[1] ?? "").trim() };
  return null;
}

export const mapFeatureToInstruction = (feature: string, format: 'markdown' | 'html' = 'html'): string => {
  const normalizedFeature = feature.toLowerCase().trim();
  const useMarkdown = format === 'markdown';

  const imageFeature = parseImageFeature(feature);
  if (imageFeature?.url) {
    const safeAlt = imageFeature.alt.replace(/"/g, "&quot;");
    const safeUrl = imageFeature.url.replace(/"/g, "&quot;");
    if (useMarkdown) {
      return `[IMAGE EMBED - MANDATORY]: After the first paragraph in this section, output exactly: ![${imageFeature.alt.replace(/[\[\]]/g, "")}](${imageFeature.url}). NEVER use [text](${imageFeature.url}). The image must render inline, not as a keyword link. NEVER omit this image.`;
    }
    return `[IMAGE EMBED - MANDATORY]: After the first <p> in this section, output exactly: <figure class="wp-block-image size-full"><img src="${safeUrl}" alt="${safeAlt}" loading="lazy" /></figure>. NEVER use <a href="${safeUrl}">. Images must display as <img>, not text links to the PNG/JPEG. NEVER append a standalone link-only <p> at the section or article end.`;
  }

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
  
  // 3. Link placeholders (harness internal links)
  if (normalizedFeature.startsWith("[link]")) {
    return useMarkdown
      ? "[LINK: Use 3–5 [[LINK:sitemap search phrase|anchor text]] placeholders woven into sentences. No raw https:// internal URLs.]"
      : "[LINK: Use 3–5 [[LINK:sitemap search phrase|anchor text]] placeholders woven into sentences. No raw https:// internal URLs in body HTML.]";
  }

  // 4. Original switch for predefined features
  switch(normalizedFeature) {
    case 'i need an image':
      return '[Insert: Image, specify format e.g. PNG, JPEG, or embed a Markdown link to a figurative image/chart/gif/etc in the generated text]';
    case 'i need 3-5 links':
      return '[Insert: Page Links (e.g., internal/external links related to the topic). CRITICAL: Ensure at least 3, but no more than 5, high-quality, relevant links are included. Ensure links are naturally woven into the prose, never ending a sentence with an anchor, and are surrounded by optimize SEO text.]';
    case 'i need a video':
       return '[Insert: Video, specify an embed or a link to a relevant video in the generated text]';
    default:
      return feature;
  }
};

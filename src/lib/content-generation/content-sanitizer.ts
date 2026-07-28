/**
 * Content Sanitizer
 * Cleans content before WordPress upload to remove placeholder artifacts
 * and enforce image-per-section limits
 */

import { stripPlaceholderDomainLinks } from "../placeholder-link-domains";
import { isMediaAssetUrl } from "@/lib/content-optimization/images-extract";

// Placeholder patterns to strip - these break live pages if they slip through
const PLACEHOLDER_PATTERNS = [
  /\[table\]/gi,
  /\[\/table\]/gi,
  /\[list\]/gi,
  /\[\/list\]/gi,
  /\[image\]/gi,
  /\[\/image\]/gi,
  /\[img\]/gi,
  /\[\/img\]/gi,
  /\[caption\]/gi,
  /\[\/caption\]/gi,
  /\[code\]/gi,
  /\[\/code\]/gi,
  /\[quote\]/gi,
  /\[\/quote\]/gi,
  /\[video\]/gi,
  /\[\/video\]/gi,
  /\[embed\]/gi,
  /\[\/embed\]/gi,
  /\[gallery\]/gi,
  /\[\/gallery\]/gi,
  /\[button\]/gi,
  /\[\/button\]/gi,
  /\[link\]/gi,
  /\[\/link\]/gi,
  /\[divider\]/gi,
  /\[\/divider\]/gi,
  /\[spacer\]/gi,
  /\[\/spacer\]/gi,
  /\[section\]/gi,
  /\[\/section\]/gi,
  /\[column\]/gi,
  /\[\/column\]/gi,
  /\[row\]/gi,
  /\[\/row\]/gi,
  /\[widget\]/gi,
  /\[\/widget\]/gi,
  /\[shortcode\]/gi,
  /\[\/shortcode\]/gi,
  // Dynamic placeholder patterns
  /\[placeholder[^\]]*\]/gi,
  /\[insert[^\]]*\]/gi,
  /\[add[^\]]*\]/gi,
  /\[TODO[^\]]*\]/gi,
  /\[FIXME[^\]]*\]/gi,
  /\[NOTE[^\]]*\]/gi,
  /\[EDIT[^\]]*\]/gi,
  /\[REMOVE[^\]]*\]/gi,
  /\[DELETE[^\]]*\]/gi,
  /\[REPLACE[^\]]*\]/gi,
  /\[UPDATE[^\]]*\]/gi,
  /\[CHANGE[^\]]*\]/gi,
  /\[FIX[^\]]*\]/gi,
  // Common AI artifacts
  /\[insert image here\]/gi,
  /\[insert link here\]/gi,
  /\[insert table here\]/gi,
  /\[add content here\]/gi,
  /\[your content here\]/gi,
  /\[content placeholder\]/gi,
  /\[image placeholder\]/gi,
  /\[table placeholder\]/gi,
];

/** Single combined regex for all placeholder patterns - one pass instead of 40+ */
const COMBINED_PLACEHOLDER_RE = new RegExp(
  PLACEHOLDER_PATTERNS.map((p) => `(?:${p.source})`).join('|'),
  'gi'
);

/**
 * Sanitize placeholder artifacts from content
 * MUST be called before any WordPress upload to prevent broken pages
 * First step: remove generic bracket placeholders (e.g. [city name]); do not strip markdown link text [text](url)
 */
export function sanitizePlaceholders(content: string): string {
  if (!content) return content;

  let sanitized = content;
  let removedCount = 0;

  const genericBracketPlaceholder = /\[[^\]]+\](?!\s*\()/g;
  const genericMatches = sanitized.match(genericBracketPlaceholder);
  if (genericMatches) removedCount += genericMatches.length;
  sanitized = sanitized.replace(genericBracketPlaceholder, ' ');
  sanitized = sanitized.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const placeholderMatches = sanitized.match(COMBINED_PLACEHOLDER_RE);
  if (placeholderMatches) removedCount += placeholderMatches.length;
  sanitized = sanitized.replace(COMBINED_PLACEHOLDER_RE, '');
  
  // Clean up empty paragraphs left behind
  sanitized = sanitized.replace(/<p>\s*<\/p>/gi, '');
  sanitized = sanitized.replace(/<p>&nbsp;<\/p>/gi, '');
  
  // Clean up multiple consecutive empty lines (more than 2)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Clean up empty divs
  sanitized = sanitized.replace(/<div>\s*<\/div>/gi, '');
  
  // Clean up empty spans
  sanitized = sanitized.replace(/<span>\s*<\/span>/gi, '');
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} placeholder artifact(s) from content`);
  }
  
  return sanitized.trim();
}

// Feature label types (prompt/checklist markers) that must not appear in published content
const FEATURE_LABEL_TYPES = 'LIST|TABLE|LINK|STRUCTURE|CUSTOM|BLOCKQUOTE|IMAGE|FAQ';

/**
 * Remove feature-label artifacts from content
 * Strips prompt/checklist markers like [LIST]: ..., [TABLE]: ... that the AI sometimes
 * outputs literally. Removes whole blocks that are only a label, and inline occurrences.
 */
export function removeFeatureLabelArtifacts(content: string): string {
  if (!content) return content;

  let sanitized = content;
  let removedCount = 0;

  // Whole-block removal: <p>...</p> or <div>...</div> that contain only optional whitespace + [TYPE]: description
  const blockPattern = new RegExp(
    `<p>\\s*\\[(${FEATURE_LABEL_TYPES})\\]\\s*:\\s*[^<]*</p>`,
    'gi'
  );
  sanitized = sanitized.replace(blockPattern, () => {
    removedCount++;
    return '';
  });

  const divBlockPattern = new RegExp(
    `<div[^>]*>\\s*\\[(${FEATURE_LABEL_TYPES})\\]\\s*:\\s*[^<]*</div>`,
    'gi'
  );
  sanitized = sanitized.replace(divBlockPattern, () => {
    removedCount++;
    return '';
  });

  // Inline removal: [TYPE]: description (description stops at <, ], or newline)
  const inlinePattern = new RegExp(
    `\\s*\\[(${FEATURE_LABEL_TYPES})\\]\\s*:\\s*[^<\\]\\n]*`,
    'gi'
  );
  const beforeInline = sanitized.length;
  sanitized = sanitized.replace(inlinePattern, '');
  if (sanitized.length !== beforeInline) {
    removedCount += (beforeInline - sanitized.length) > 0 ? 1 : 0;
  }

  // Normalize spaces left after inline removal (double space, space before period)
  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  sanitized = sanitized.replace(/\s+\./g, '.');

  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} feature-label artifact(s) ([LIST]:, [TABLE]:, etc.)`);
  }

  return sanitized;
}

/**
 * Remove all colons from content and replace with periods
 * Colons break markdown table syntax and should never appear in generated content
 * CRITICAL: Preserves colons in URLs (http://, https://, and markdown image/link syntax)
 * Single-pass: match either URL/link (keep) or colon (replace with period).
 */
export function removeColons(content: string): string {
  if (!content) return content;

  const urlOrColonRe =
    /(https?:\/\/[^\s\)"<>]+|!\[[^\]]*\]\([^\)]+\)|\[[^\]]*\]\([^\)]+\)|<img[^>]*src=["']https?:\/\/[^"']+["'][^>]*>|<a[^>]*href=["']https?:\/\/[^"']+["'][^>]*>)|:/gi;
  let colonCount = 0;
  const sanitized = content.replace(urlOrColonRe, (match) => {
    if (match === ':') {
      colonCount++;
      return '.';
    }
    return match;
  });

  if (colonCount > 0) {
    console.log(
      `[Content Sanitizer] Removed ${colonCount} colon(s) from content (replaced with periods, preserved URLs)`
    );
  }

  return sanitized;
}

/**
 * Remove all em dashes from content and replace with comma and space
 * Em dashes can cause formatting issues and should be replaced
 * CRITICAL: Preserves em dashes in URLs (though unlikely, but safe)
 */
export function removeEmDashes(content: string): string {
  if (!content) return content;
  
  // Count em dashes before removal (both - and - Unicode characters)
  const emDashPattern = / - | - /g;
  
  // Preserve URLs by temporarily replacing them with placeholders
  // Pattern matches: markdown images/links, HTML img/href attributes, and standalone URLs
  const urlPattern = /(https?:\/\/[^\s\)"<>]+|!\[[^\]]*\]\([^\)]+\)|\[[^\]]*\]\([^\)]+\)|<img[^>]*src=["']https?:\/\/[^"']+["'][^>]*>|<a[^>]*href=["']https?:\/\/[^"']+["'][^>]*>)/gi;
  const urlPlaceholders: string[] = [];
  let placeholderIndex = 0;
  
  // Replace URLs with placeholders
  const contentWithPlaceholders = content.replace(urlPattern, (match) => {
    const placeholder = `__URL_PLACEHOLDER_${placeholderIndex}__`;
    urlPlaceholders.push(match);
    placeholderIndex++;
    return placeholder;
  });
  
  // Count em dashes in content (excluding URLs)
  const urlMatches: string[] = content.match(urlPattern) || [];
  const contentWithoutUrls = urlMatches.reduce((acc: string, url: string) => acc.replace(url, ''), content);
  const emDashCount = (contentWithoutUrls.match(emDashPattern) || []).length;
  
  // Replace em dashes in content (excluding URLs)
  let sanitized = contentWithPlaceholders.replace(emDashPattern, ', ');
  
  // Restore URLs
  urlPlaceholders.forEach((url, index) => {
    sanitized = sanitized.replace(`__URL_PLACEHOLDER_${index}__`, url);
  });
  
  if (emDashCount > 0) {
    console.log(`[Content Sanitizer] Removed ${emDashCount} em dash(es) from content (replaced with comma and space, preserved URLs)`);
  }
  
  return sanitized;
}

/**
 * Enforce maximum 1 image per H2 section
 * Prevents image bloat during re-optimization
 */
export function enforceOneImagePerSection(html: string): string {
  if (!html) return html;
  
  // Split by H2 tags while preserving them
  const h2Regex = /(<h2[^>]*>)/gi;
  const parts = html.split(h2Regex);
  
  let totalRemoved = 0;
  
  const processedParts = parts.map((part, index) => {
    // H2 tags themselves (odd indices after split) should be preserved as-is
    if (index > 0 && h2Regex.test(parts[index - 1])) {
      // Reset regex lastIndex
      h2Regex.lastIndex = 0;
    }
    
    // For content sections (not H2 tags themselves)
    // Check if this part starts with an H2 tag or is content after an H2
    if (!part.match(/^<h2[^>]*>/i)) {
      // This is content, not an H2 tag
      // Count images in this section
      const imgRegex = /<img[^>]*>/gi;
      const images = part.match(imgRegex);
      
      if (images && images.length > 1) {
        // Keep only the first image
        let imageCount = 0;
        const cleaned = part.replace(imgRegex, (match) => {
          imageCount++;
          if (imageCount === 1) {
            return match; // Keep first image
          }
          totalRemoved++;
          return ''; // Remove subsequent images
        });
        return cleaned;
      }
    }
    
    return part;
  });
  
  if (totalRemoved > 0) {
    console.log(`[Content Sanitizer] Removed ${totalRemoved} extra image(s) to enforce 1 image per section rule`);
  }
  
  return processedParts.join('');
}

/**
 * Remove forbidden section headings
 * Detects and removes entire sections with forbidden headings like "External Resources"
 * CRITICAL: Prevents sections that should never appear in published content
 */
export function removeForbiddenSections(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let removedCount = 0;
  
  // Patterns to match forbidden section headings (case-insensitive)
  const forbiddenPatterns = [
    /external\s+resource/i,           // "External Resources", "external resources", etc.
    /external\s+link/i,               // "External Links", "external links", etc.
    /external\s+reference/i,         // "External References", etc.
    /external\s+site/i,               // "External Sites", etc.
    /external\s+website/i,            // "External Websites", etc.
    /additional\s+resource/i,        // "Additional Resources" (often used for external links)
    /helpful\s+resource/i,           // "Helpful Resources" (often external)
    /useful\s+resource/i,            // "Useful Resources" (often external)
    /related\s+resource/i,          // "Related Resources" (often external)
  ];
  
  const lines = fixed.split('\n');
  const fixedLines: string[] = [];
  let skipSection = false;
  let skipSectionLevel = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      
      // Check if this heading matches any forbidden pattern
      const isForbidden = forbiddenPatterns.some(pattern => pattern.test(text));
      
      if (isForbidden) {
        // Start skipping this section
        skipSection = true;
        skipSectionLevel = level;
        removedCount++;
        console.log(`[Content Sanitizer] Removing forbidden section: "${line.trim()}"`);
        continue; // Skip this heading line
      } else if (skipSection) {
        // We're in a forbidden section - check if we've reached a heading of same or higher level
        if (level <= skipSectionLevel) {
          // We've reached the next section at same or higher level - stop skipping
          skipSection = false;
          skipSectionLevel = 0;
          // Re-check this heading in case it's also forbidden (shouldn't happen, but be safe)
          if (!isForbidden) {
            fixedLines.push(line);
          }
        } else {
          // Still in the forbidden section (sub-heading) - continue skipping
          continue;
        }
      } else {
        // Normal heading, not forbidden - include it
        fixedLines.push(line);
      }
    } else {
      // Not a heading
      if (skipSection) {
        // Still in forbidden section - skip this line
        continue;
      } else {
        // Normal content - include it
        fixedLines.push(line);
      }
    }
  }
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} forbidden section(s) (e.g., "External Resources")`);
  }
  
  return fixedLines.join('\n');
}

/**
 * Remove duplicate consecutive headings
 * Detects and removes headings that appear consecutively with identical text
 * Example: "## Heading\n## Heading" -> "## Heading"
 * CRITICAL: Prevents duplicate headings from appearing in published content
 */
export function removeDuplicateHeadings(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let removedCount = 0;
  
  // Pattern to match markdown headings (##, ###, ####, etc.)
  // Matches: heading level (#), optional space, heading text, optional trailing spaces
  const headingPattern = /^(#{1,6})\s+(.+?)\s*$/gm;
  
  const lines = fixed.split('\n');
  const fixedLines: string[] = [];
  let previousHeading: { level: string; text: string } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    
    if (headingMatch) {
      const level = headingMatch[1];
      const text = headingMatch[2].trim();
      
      // Check if this heading is a duplicate of the previous one
      if (previousHeading && 
          previousHeading.level === level && 
          previousHeading.text.toLowerCase() === text.toLowerCase()) {
        // This is a duplicate - skip it
        removedCount++;
        console.log(`[Content Sanitizer] Removed duplicate heading: "${line.trim()}"`);
        continue; // Skip this line
      }
      
      // Not a duplicate - keep it and update previous heading
      previousHeading = { level, text };
      fixedLines.push(line);
    } else {
      // Not a heading - reset previous heading tracking and keep the line
      // Only reset if this line has actual content (not just whitespace)
      if (line.trim().length > 0) {
        previousHeading = null;
      }
      fixedLines.push(line);
    }
  }
  
  fixed = fixedLines.join('\n');
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} duplicate heading(s)`);
  }
  
  return fixed;
}

/**
 * Remove empty markdown tables
 * Detects and removes tables that have headers but no data rows
 * Also removes tables with only empty data rows (whitespace-only cells)
 * 
 * SCENARIOS HANDLED:
 * 1. Table with only header and separator (no data rows):
 *    | Service/Product Name | Description |
 *    |----------------------|-------------|
 *    -> REMOVED (empty table)
 * 
 * 2. Table with header, separator, and empty data rows:
 *    | Header | Header |
 *    |--------|--------|
 *    |       |        |
 *    -> REMOVED (empty data rows)
 * 
 * 3. Table with header, separator, and valid data:
 *    | Header | Header |
 *    |--------|--------|
 *    | Data 1 | Data 2 |
 *    -> KEPT (valid table)
 * 
 * CRITICAL: Prevents empty tables from appearing in published content
 */

/** Regex: markdown table separator row. Allows |---|, |----|, |---- (no trailing pipe), |:---|:---| */
const TABLE_SEPARATOR_ROW_REGEX = /^\s*\|[\s\-:]+\|?\s*$/;

export function removeEmptyTables(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let removedCount = 0;
  
  // Pattern to match markdown tables
  // A table consists of:
  // 1. Header row: | Header | Header |
  // 2. Separator row: |---|---| or |---- or |:---|---:|
  // 3. Data rows: | Data | Data | (optional, but required for valid table)
  
  const lines = fixed.split('\n');
  const fixedLines: string[] = [];
  let inTable = false;
  let tableStartIndex = -1;
  let tableLines: string[] = [];
  let dataRows: string[] = [];
  let hasSeparator = false;
  
  // Helper function to check if a table row is empty (only whitespace in cells)
  const isEmptyDataRow = (row: string): boolean => {
    // Remove leading/trailing pipes and split by pipe
    const cells = row.trim().split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
    // Check if all cells are empty or whitespace-only
    return cells.length === 0 || cells.every(cell => cell.trim().length === 0);
  };

  /** Normalize separator row to always end with pipe for consistent structure */
  const normalizeSeparatorLine = (raw: string): string => {
    const t = raw.trim();
    return t.endsWith('|') ? t : t + '|';
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparatorRow = TABLE_SEPARATOR_ROW_REGEX.test(line.trim());
    
    if (isTableRow && !isSeparatorRow) {
      // This is a table row (header or data)
      if (!inTable) {
        // Starting a new table
        inTable = true;
        tableStartIndex = i;
        tableLines = [line];
        dataRows = [];
        hasSeparator = false;
      } else {
        // Continuing existing table
        tableLines.push(line);
        // Check if this is a data row (we've seen separator, so this is data, not header)
        if (hasSeparator) {
          // We've seen header + separator, so this is a data row
          // Check if it's not empty
          if (!isEmptyDataRow(line)) {
            dataRows.push(line);
          }
        }
      }
    } else if (isSeparatorRow && inTable) {
      // This is the separator row (|---|---| or |----); normalize to end with pipe
      tableLines.push(normalizeSeparatorLine(line));
      hasSeparator = true;
    } else {
      // Not a table row - end current table if we're in one
      if (inTable) {
        // Check if table has valid data rows
        // A valid table should have: header + separator + at least one non-empty data row
        const hasValidDataRows = dataRows.length > 0;
        
        if (!hasValidDataRows && tableLines.length >= 2) {
          // Empty table (no data rows or only empty data rows) - remove it
          removedCount++;
          const tablePreview = tableLines[0]?.substring(0, 60) || 'unknown';
          console.log(`[Content Sanitizer] Removed empty table starting at line ${tableStartIndex + 1}: "${tablePreview}..." (had ${tableLines.length} lines, ${dataRows.length} data rows)`);
          // Don't add these lines to fixedLines
        } else {
          // Valid table with data - keep it
          fixedLines.push(...tableLines);
        }
        // Reset table state
        inTable = false;
        tableStartIndex = -1;
        tableLines = [];
        dataRows = [];
        hasSeparator = false;
      }
      // Add the current non-table line
      fixedLines.push(line);
    }
  }
  
  // Handle table at end of content
  if (inTable) {
    const hasValidDataRows = dataRows.length > 0;
    if (!hasValidDataRows && tableLines.length >= 2) {
      // Empty table at end - remove it
      removedCount++;
      const tablePreview = tableLines[0]?.substring(0, 60) || 'unknown';
      console.log(`[Content Sanitizer] Removed empty table at end of content: "${tablePreview}..." (had ${tableLines.length} lines, ${dataRows.length} data rows)`);
    } else {
      // Valid table - keep it
      fixedLines.push(...tableLines);
    }
  }
  
  fixed = fixedLines.join('\n');
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} empty table(s) (tables with headers but no valid data rows)`);
  }
  
  return fixed;
}

/**
 * Remove "Article Title" labels and similar metadata text from content
 * Removes lines like "Article Title: ..." or "**Article Title.** ..." that shouldn't appear in published content
 * CRITICAL: Prevents metadata labels from appearing in the main content body
 */
export function removeArticleTitleLabels(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let removedCount = 0;
  
  // Patterns to match "Article Title" labels in various formats
  const articleTitlePatterns = [
    /^\s*\*\*Article Title[\.:]\*\*\s*.+$/i,  // **Article Title.** or **Article Title:**
    /^\s*\*\*Article Title\*\*\s*[\.:]\s*.+$/i,  // **Article Title** : or **Article Title** .
    /^\s*Article Title[\.:]\s*.+$/i,  // Article Title: or Article Title.
    /^\s*\*\*Article Title\*\*\s*$/i,  // **Article Title** (standalone)
    /^\s*Article Title\s*$/i,  // Article Title (standalone)
  ];
  
  const lines = fixed.split('\n');
  const fixedLines = lines.filter((line, index) => {
    for (const pattern of articleTitlePatterns) {
      if (pattern.test(line.trim())) {
        removedCount++;
        console.log(`[Content Sanitizer] Removed "Article Title" label at line ${index + 1}: "${line.trim().substring(0, 50)}"`);
        return false; // Remove this line
      }
    }
    return true; // Keep this line
  });
  
  fixed = fixedLines.join('\n');
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} "Article Title" label(s)`);
  }
  
  return fixed;
}

/**
 * Fix malformed link formats
 * Detects and removes links that use incorrect formats like [URL: ...] 
 * These formats indicate links are appended rather than contextually integrated
 * CRITICAL: Links must be in proper markdown format [anchor text](url) and integrated contextually for better SEO
 */
export function fixMalformedLinks(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let removedCount = 0;
  
  // Pattern 1: [URL: https://...] or [URL:http://...] format - REMOVE these entirely
  // They're not properly integrated and should be removed rather than converted
  // The AI should integrate links contextually, not append them
  const urlPattern1 = /\[URL:\s*(https?:\/\/[^\]]+)\]/gi;
  fixed = fixed.replace(urlPattern1, (match) => {
    removedCount++;
    console.log(`[Content Sanitizer] Removed malformed link format [URL: ...]: "${match.substring(0, 60)}..." (links must be integrated contextually, not appended)`);
    return ''; // Remove entirely - links should be integrated by AI, not appended
  });
  
  // Pattern 2: [url: ...] (lowercase) - REMOVE these entirely
  const urlPattern2 = /\[url:\s*(https?:\/\/[^\]]+)\]/gi;
  fixed = fixed.replace(urlPattern2, (match) => {
    removedCount++;
    console.log(`[Content Sanitizer] Removed malformed link format [url: ...]: "${match.substring(0, 60)}..." (links must be integrated contextually, not appended)`);
    return ''; // Remove entirely
  });
  
  // Pattern 3: Links appended at end of sentences/descriptions
  // Pattern: text ending with period/full stop, then space, then [URL: ...] or [url: ...]
  // This indicates a link was appended rather than integrated
  const appendedLinkPattern = /\.\s+\[(?:URL|url):\s*(https?:\/\/[^\]]+)\]/gi;
  fixed = fixed.replace(appendedLinkPattern, (match) => {
    removedCount++;
    console.log(`[Content Sanitizer] Removed appended link at end of sentence: "${match.substring(0, 60)}..." (links must be integrated contextually)`);
    return '.'; // Keep the period, remove the appended link
  });
  
  // Pattern 4: Links in table cells that are just appended (not integrated)
  // Look for table cells ending with [URL: ...] or [url: ...]
  // Match: | content [URL: https://...] |
  const tableCellAppendedPattern = /\|\s*([^|]*?)\s*\[(?:URL|url):\s*(https?:\/\/[^\]]+)\]\s*\|/gi;
  fixed = fixed.replace(tableCellAppendedPattern, (match, cellContent) => {
    removedCount++;
    console.log(`[Content Sanitizer] Removed appended link from table cell: "[URL: ...]" (links must be integrated into cell content, not appended)`);
    // Remove the [URL: ...] part, keep the cell content
    return `| ${cellContent.trim()} |`;
  });
  
  // Pattern 5: Links appended without period before them
  // Match: text [URL: https://...] (no period before)
  const appendedLinkNoPeriodPattern = /([^\s])\s+\[(?:URL|url):\s*(https?:\/\/[^\]]+)\]/gi;
  fixed = fixed.replace(appendedLinkNoPeriodPattern, (match, beforeChar) => {
    removedCount++;
    console.log(`[Content Sanitizer] Removed appended link: "[URL: ...]" (links must be integrated contextually, not appended)`);
    return beforeChar; // Keep the character before, remove the appended link
  });
  
  // Clean up any double spaces or trailing spaces left after removal
  fixed = fixed.replace(/\s{2,}/g, ' '); // Replace multiple spaces with single space
  fixed = fixed.replace(/\s+\./g, '.'); // Remove spaces before periods
  fixed = fixed.replace(/\|\s+\|/g, '| |'); // Fix empty table cells with extra spaces
  
  if (removedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${removedCount} malformed/appended link(s) - links must be integrated contextually into content, not appended as [URL: ...]`);
  }
  
  return fixed;
}

/** Stats for convertAllMarkdownToHtml debugging */
interface MarkdownConversionStats {
  images: number;
  links: number;
  bold: number;
  italic: number;
  strikethrough: number;
  inlineCode: number;
  codeBlocks: number;
  headings: number;
  blockquotes: number;
  horizontalRules: number;
  unorderedListItems: number;
  orderedListItems: number;
  tables: number;
}

/**
 * Convert EVERY markdown link [text](url) to HTML. Runs in a loop until none left.
 * Use this as a final safety net so entity/Wikipedia links can never slip through.
 */
export function forceConvertMarkdownLinks(content: string): string {
  if (!content || !content.trim()) return content;
  let out = content;
  let prev = '';
  let iterations = 0;
  const maxIterations = 50;
  // Match [text](url) - URL is https?:// then any chars except ); anchor can contain ]
  const markdownLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  while (out !== prev && iterations < maxIterations) {
    prev = out;
    out = out.replace(markdownLinkRegex, (_, text: string, url: string) => {
      const u = url.trim().replace(/"/g, '&quot;').replace(/&/g, '&amp;');
      const t = (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<a href="${u}">${t}</a>`;
    });
    iterations++;
  }
  if (iterations > 1 && out !== content) {
    console.log(`[Content Sanitizer] forceConvertMarkdownLinks: ran ${iterations} pass(es)`);
  }
  return out;
}

/**
 * Convert ALL remaining markdown syntax to HTML. No exceptions.
 * Used before WordPress upload so that zero markdown appears on published pages.
 * Safe to run on already-HTML content (no-op when no markdown patterns found).
 */
export function convertAllMarkdownToHtml(content: string): string {
  if (!content || !content.trim()) return content;

  const stats: MarkdownConversionStats = {
    images: 0,
    links: 0,
    bold: 0,
    italic: 0,
    strikethrough: 0,
    inlineCode: 0,
    codeBlocks: 0,
    headings: 0,
    blockquotes: 0,
    horizontalRules: 0,
    unorderedListItems: 0,
    orderedListItems: 0,
    tables: 0,
  };

  let out = content;

  // 0. CRITICAL: Convert ALL markdown links first (entity/Wikipedia etc.) - no exceptions
  out = forceConvertMarkdownLinks(out);

  // 1. Code blocks (before inline code / other patterns so we don't alter content inside)
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    stats.codeBlocks++;
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`;
  });

  // 2. Markdown images ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, alt, url) => {
    stats.images++;
    const safeUrl = (url || '').trim().replace(/"/g, '&quot;');
    const safeAlt = (alt || '').replace(/"/g, '&quot;');
    return `<img src="${safeUrl}" alt="${safeAlt}">`;
  });

  // 3. Markdown links [text](url) again (in case any appeared inside code blocks or after other edits)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, text, url) => {
    stats.links++;
    const safeUrl = (url || '').trim().replace(/"/g, '&quot;').replace(/&/g, '&amp;');
    const safeText = (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${safeUrl}">${safeText}</a>`;
  });
  // Final link pass so nothing survives
  out = forceConvertMarkdownLinks(out);

  // 4. Bold ***text*** and ___text___
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, (_, t) => {
    stats.bold++;
    stats.italic++;
    return `<strong><em>${t}</em></strong>`;
  });
  out = out.replace(/___([^_]+)___/g, (_, t) => {
    stats.bold++;
    stats.italic++;
    return `<strong><em>${t}</em></strong>`;
  });

  // 5. Bold **text** and __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, t) => {
    stats.bold++;
    return `<strong>${t}</strong>`;
  });
  out = out.replace(/__([^_]+)__/g, (_, t) => {
    stats.bold++;
    return `<strong>${t}</strong>`;
  });

  // 6. Strikethrough ~~text~~
  out = out.replace(/~~([^~]+)~~/g, (_, t) => {
    stats.strikethrough++;
    return `<del>${t}</del>`;
  });

  // 7. Italic *text* and _text_ (single; avoid matching ** or __)
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, t) => {
    stats.italic++;
    return `<em>${t}</em>`;
  });
  out = out.replace(/(?<!_)_([^_]+)_(?!_)/g, (_, t) => {
    stats.italic++;
    return `<em>${t}</em>`;
  });

  // 8. Inline code `code`
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    stats.inlineCode++;
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<code>${escaped}</code>`;
  });

  // 9. Headings (line-based)
  const lines = out.split('\n');
  const newLines = lines.map((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      stats.headings++;
      return `<h${level}>${match[2]}</h${level}>`;
    }
    return line;
  });
  out = newLines.join('\n');

  // 10. Horizontal rules (standalone ---, ***, ___)
  out = out.replace(/^(---|\*\*\*|___)\s*$/gm, () => {
    stats.horizontalRules++;
    return '<hr>';
  });

  // 11. Blockquotes > line
  out = out.replace(/^>\s?(.*)$/gm, (_, t) => {
    stats.blockquotes++;
    return `<blockquote>${t}</blockquote>`;
  });

  // 12. Markdown tables: pipe-delimited blocks -> HTML table
  const tableBlockRegex = /^(\s*)\|.+\|\s*$/gm;
  let tableStart: number;
  const lineArray = out.split('\n');
  const resultLines: string[] = [];
  let i = 0;
  while (i < lineArray.length) {
    const line = lineArray[i];
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lineArray.length && /^\s*\|.+\|\s*$/.test(lineArray[j])) {
        tableLines.push(lineArray[j]);
        j++;
      }
      const sepCount = tableLines.filter((l) => /^\s*\|[\s\-:]+\|\s*$/.test(l.trim())).length;
      if (tableLines.length >= 2 && sepCount >= 1) {
        const headerRow = tableLines[0].trim();
        const sepRow = tableLines[1].trim();
        const dataRows = tableLines.slice(2);
        const parseCells = (row: string) =>
          row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());
        const headers = parseCells(headerRow);
        let html = '<table><thead><tr>';
        headers.forEach((h) => {
          html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        dataRows.forEach((row) => {
          const cells = parseCells(row.trim());
          if (cells.some((c) => c)) {
            html += '<tr>';
            cells.forEach((c) => {
              html += `<td>${c}</td>`;
            });
            html += '</tr>';
          }
        });
        html += '</tbody></table>';
        resultLines.push(html);
        stats.tables++;
        i = j;
        continue;
      }
    }
    resultLines.push(line);
    i++;
  }
  out = resultLines.join('\n');

  // 13. Unordered list items (line starting with - or * or + followed by space)
  out = out.replace(/^(\s*)([-*+])\s+(.+)$/gm, (_, indent, bullet, rest) => {
    stats.unorderedListItems++;
    return `${indent}<ul><li>${rest}</li></ul>`;
  });

  // 14. Ordered list items
  out = out.replace(/^(\s*)\d+\.\s+(.+)$/gm, (_, indent, rest) => {
    stats.orderedListItems++;
    return `${indent}<ol><li>${rest}</li></ol>`;
  });

  const total =
    stats.images +
    stats.links +
    stats.bold +
    stats.italic +
    stats.strikethrough +
    stats.inlineCode +
    stats.codeBlocks +
    stats.headings +
    stats.blockquotes +
    stats.horizontalRules +
    stats.unorderedListItems +
    stats.orderedListItems +
    stats.tables;
  if (total > 0) {
    console.log(
      `[Content Sanitizer] convertAllMarkdownToHtml: converted ${total} markdown pattern(s)`,
      stats
    );
  }

  return out;
}

/**
 * Fix orphaned <li> elements that aren't wrapped in <ul> or <ol>.
 * AI sometimes outputs bare <li>...</li> blocks or leaves stray </ol>/<ul> closers
 * without matching openers, producing broken list markup on the live page.
 */
export function fixOrphanedListItems(content: string): string {
  if (!content) return content;

  let fixed = content;
  let fixCount = 0;

  // Step 1: Remove stray closing </ol> and </ul> that have no matching opener
  for (const listTag of ['ol', 'ul']) {
    const parts = fixed.split(new RegExp(`(</?${listTag}(?:\\s[^>]*)?>)`, 'gi'));
    let depth = 0;
    const out: string[] = [];
    for (const part of parts) {
      if (new RegExp(`^<${listTag}[\\s>]`, 'i').test(part)) {
        depth++;
        out.push(part);
      } else if (new RegExp(`^</${listTag}>$`, 'i').test(part)) {
        if (depth > 0) { depth--; out.push(part); }
        else { fixCount++; }
      } else {
        out.push(part);
      }
    }
    fixed = out.join('');
  }

  // Step 2: Wrap orphaned <li>...</li> sequences in <ul>
  // Matches one or more consecutive <li>...</li> blocks (with optional whitespace between)
  const liSequenceRegex = /(<li[\s>][\s\S]*?<\/li>(?:\s*<li[\s>][\s\S]*?<\/li>)*)/gi;
  const originalFixed = fixed;

  fixed = fixed.replace(liSequenceRegex, (match, _group, offset) => {
    const before = originalFixed.substring(0, offset);
    const ulOpens = (before.match(/<ul[\s>]/gi) || []).length;
    const ulCloses = (before.match(/<\/ul>/gi) || []).length;
    const olOpens = (before.match(/<ol[\s>]/gi) || []).length;
    const olCloses = (before.match(/<\/ol>/gi) || []).length;
    const listDepth = (ulOpens - ulCloses) + (olOpens - olCloses);

    if (listDepth > 0) return match;

    fixCount++;
    return `<ul>${match}</ul>`;
  });

  if (fixCount > 0) {
    console.log(`[Content Sanitizer] fixOrphanedListItems: fixed ${fixCount} orphaned list issue(s)`);
  }

  return fixed;
}

/**
 * Remove link columns from tables
 * Detects tables with dedicated link columns (like "Relevant Internal Links", "Links", etc.)
 * and removes those columns entirely
 * CRITICAL: Links must be contextually integrated into content columns for better SEO, not in separate columns
 */
export function removeLinkColumnsFromTables(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let fixedCount = 0;
  
  // Patterns to match link column headers (case-insensitive)
  const linkColumnKeywords = [
    'relevant internal links',
    'relevant links',
    'internal links',
    'links',
    'link',
    'direct link',
    'view product',
    'related links',
    'product links',
    'service links',
  ];
  
  const lines = fixed.split('\n');
  const fixedLines: string[] = [];
  let inTable = false;
  let tableStartIndex = -1;
  let linkColumnIndex = -1;
  let headerCells: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparatorRow = /^\s*\|[\s\-:]+\|\s*$/.test(line.trim());
    
    if (isTableRow && !isSeparatorRow) {
      if (!inTable) {
        // Starting a new table - check header for link column
        inTable = true;
        tableStartIndex = i;
        linkColumnIndex = -1;
        
        // Parse header cells
        headerCells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        
        // Check each cell to see if it's a link column
        for (let j = 0; j < headerCells.length; j++) {
          const cellLower = headerCells[j].toLowerCase();
          if (linkColumnKeywords.some(keyword => cellLower.includes(keyword))) {
            linkColumnIndex = j;
            fixedCount++;
            console.log(`[Content Sanitizer] Detected link column "${headerCells[j]}" at index ${j} in table starting at line ${tableStartIndex + 1}`);
            break;
          }
        }
        
        // If we found a link column, remove it from header
        if (linkColumnIndex >= 0) {
          const newHeaderCells = [...headerCells];
          newHeaderCells.splice(linkColumnIndex, 1);
          fixedLines.push('| ' + newHeaderCells.join(' | ') + ' |');
        } else {
          fixedLines.push(line);
        }
      } else {
        // Data row - remove link column if detected
        if (linkColumnIndex >= 0) {
          const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
          if (cells.length > linkColumnIndex) {
            const newCells = [...cells];
            newCells.splice(linkColumnIndex, 1);
            fixedLines.push('| ' + newCells.join(' | ') + ' |');
          } else {
            fixedLines.push(line);
          }
        } else {
          fixedLines.push(line);
        }
      }
    } else if (isSeparatorRow && inTable) {
      // Separator row - adjust for removed column
      if (linkColumnIndex >= 0) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length > linkColumnIndex) {
          const newCells = [...cells];
          newCells.splice(linkColumnIndex, 1);
          const separator = '| ' + newCells.map(() => '---').join(' | ') + ' |';
          fixedLines.push(separator);
        } else {
          fixedLines.push(line);
        }
      } else {
        fixedLines.push(line);
      }
    } else {
      // Not a table row - end current table
      if (inTable) {
        inTable = false;
        linkColumnIndex = -1;
        headerCells = [];
      }
      fixedLines.push(line);
    }
  }
  
  // Handle table at end
  if (inTable) {
    inTable = false;
  }
  
  fixed = fixedLines.join('\n');
  
  if (fixedCount > 0) {
    console.log(`[Content Sanitizer] Removed ${fixedCount} link column(s) from table(s) - links should be integrated into content columns for better SEO`);
  }
  
  return fixed;
}

/**
 * Fix malformed markdown table headers and rows
 * Removes leading periods, colons, or other characters before the first pipe in table rows
 * Normalizes separator rows and data rows that are missing a trailing pipe
 * Example: ". | Header | Header |" -> "| Header | Header |"
 * Example: ": | Header | Header |" -> "| Header | Header |"
 * CRITICAL: Markdown tables MUST start with | not . | or : |
 */
export function fixMalformedMarkdownTables(content: string): string {
  if (!content) return content;
  
  let fixed = content;
  let fixedCount = 0;
  
  // Split content into lines to process each line individually
  const lines = fixed.split('\n');
  let prevHeaderColCount: number | null = null;

  const fixedLines = lines.map((line, idx) => {
    const trimmed = line.trim();
    // Dashes-only line (no pipes): WRONG separator - replace with proper |---||---|
    const dashesOnly = /^[\s\-]+$/.test(trimmed) && trimmed.replace(/\s/g, '').length >= 2;
    if (dashesOnly && prevHeaderColCount != null && prevHeaderColCount >= 1) {
      const properSeparator = '|' + '---|'.repeat(prevHeaderColCount);
      fixedCount++;
      prevHeaderColCount = null;
      return line.replace(trimmed, properSeparator);
    }
    if (!trimmed.includes('|')) {
      prevHeaderColCount = null;
      return line;
    }

    // Period inside separator cells: |.------ | -> |------ | (AI outputs period after pipe in separator)
    if (trimmed.includes('|.') && trimmed.includes('-') && /^\s*\|[\s\-\.:|]+\|?\s*$/.test(trimmed)) {
      const fixed = trimmed.replace(/\|\./g, '|');
      if (fixed !== trimmed) {
        fixedCount++;
        return line.replace(trimmed, fixed);
      }
    }

    // Separator row: fix truncated form (e.g. |-- for 2-col table -> |---|---|)
    if (TABLE_SEPARATOR_ROW_REGEX.test(trimmed)) {
      const hyphenSegments = (trimmed.match(/-+/g) || []).length;
      const requiredCols = prevHeaderColCount ?? 2;
      if (hyphenSegments < requiredCols && prevHeaderColCount != null && prevHeaderColCount >= 1) {
        const properSeparator = '|' + '---|'.repeat(prevHeaderColCount);
        fixedCount++;
        prevHeaderColCount = null;
        return line.replace(trimmed, properSeparator);
      }
      prevHeaderColCount = null;
      if (!trimmed.endsWith('|')) {
        fixedCount++;
        return line.replace(trimmed, trimmed + '|');
      }
      return line;
    }

    // Track header column count for next line (separator fix)
    if (trimmed.startsWith('|') && trimmed.includes('|') && !TABLE_SEPARATOR_ROW_REGEX.test(trimmed)) {
      prevHeaderColCount = (trimmed.match(/\|/g) || []).length - 1;
    }

    // Row has pipes but missing leading | (e.g. "Question | Answer |" -> "| Question | Answer |")
    if (!trimmed.startsWith('|') && (trimmed.match(/\|/g) || []).length >= 2 && !TABLE_SEPARATOR_ROW_REGEX.test(trimmed)) {
      fixedCount++;
      const lead = (line.match(/^\s*/) || [''])[0];
      return lead + '| ' + trimmed;
    }

    // Table data/header row that starts with | and has at least one more | but no trailing pipe
    if (trimmed.startsWith('|') && trimmed.length > 1 && /\|/.test(trimmed.slice(1)) && !trimmed.endsWith('|')) {
      fixedCount++;
      return line.replace(trimmed, trimmed + '|');
    }

    // Check for malformed table row patterns (leading punctuation before first pipe)
    // Pattern 1: Leading period before pipe: ". |" or ".|"
    if (/^\s*\.\s*\|/.test(line)) {
      fixedCount++;
      const fixed = line.replace(/^\s*\.\s*\|/, '|');
      prevHeaderColCount = Math.max((fixed.match(/\|/g) || []).length - 1, 1);
      return fixed;
    }
    
    // Pattern 2: Leading colon before pipe: ": |" or ":|"
    if (/^\s*:\s*\|/.test(line)) {
      fixedCount++;
      const fixed = line.replace(/^\s*:\s*\|/, '|');
      prevHeaderColCount = Math.max((fixed.match(/\|/g) || []).length - 1, 1);
      return fixed;
    }
    
    // Pattern 3: Leading dash before pipe: "- |" or "-|"
    if (/^\s*-\s*\|/.test(line)) {
      fixedCount++;
      const fixed = line.replace(/^\s*-\s*\|/, '|');
      prevHeaderColCount = Math.max((fixed.match(/\|/g) || []).length - 1, 1);
      return fixed;
    }
    
    // Pattern 4: Leading plus before pipe: "+ |" or "+|"
    if (/^\s*\+\s*\|/.test(line)) {
      fixedCount++;
      const fixed = line.replace(/^\s*\+\s*\|/, '|');
      prevHeaderColCount = Math.max((fixed.match(/\|/g) || []).length - 1, 1);
      return fixed;
    }
    
    // Pattern 5: Any other single punctuation character before pipe
    if (/^\s*[\.\:\-\+\*]\s*\|/.test(line)) {
      fixedCount++;
      const fixed = line.replace(/^\s*[\.\:\-\+\*]\s*\|/, '|');
      prevHeaderColCount = Math.max((fixed.match(/\|/g) || []).length - 1, 1);
      return fixed;
    }
    
    return line;
  });
  
  fixed = fixedLines.join('\n');
  
  if (fixedCount > 0) {
    console.log(`[Content Sanitizer] Fixed ${fixedCount} malformed markdown table row(s) (removed leading punctuation before pipes)`);
  }
  
  return fixed;
}

/**
 * Normalize URL for deduplication: same page = same key (lowercase origin + pathname, no trailing slash).
 */
function normalizeUrlForDedupe(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.origin.toLowerCase()}${path}`;
  } catch {
    return url;
  }
}

/**
 * Ensure each link URL appears at most once in markdown content.
 * Keeps the first occurrence as [text](url); replaces subsequent same-URL links with plain text only.
 * Used for SEO extra content so we never link to the same page more than once.
 */
export function deduplicateInternalLinksInMarkdown(content: string): string {
  if (!content) return content;
  const seen = new Set<string>();
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  return content.replace(markdownLinkPattern, (match, text: string, url: string) => {
    const key = normalizeUrlForDedupe(url);
    if (seen.has(key)) return text;
    seen.add(key);
    return match;
  });
}

/**
 * Ensure each internal link URL appears at most once in HTML content.
 * Keeps the first occurrence; replaces subsequent same-URL links with anchor text only.
 */
export function deduplicateInternalLinksInHtml(content: string): string {
  if (!content) return content;
  const seen = new Set<string>();
  let out = content;
  out = out.replace(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url: string, text: string) => {
    const key = normalizeUrlForDedupe(url);
    if (seen.has(key)) return text;
    seen.add(key);
    return match;
  });
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, text: string, url: string) => {
    const key = normalizeUrlForDedupe(url);
    if (seen.has(key)) return text;
    seen.add(key);
    return match;
  });
  return out;
}

/**
 * Ensure no internal link ends in a period: (1) move trailing period from anchor text to after </a>;
 * (2) where </a> is immediately followed by a period (link at end of sentence), insert a short phrase so the link is wrapped in words. Never use "here" - use "for more" to avoid the disallowed "link → here" pattern.
 */
export function ensureNoLinkEndsInPeriod(html: string): string {
  if (!html) return html;
  let out = html;
  // Move period from inside anchor to outside: <a ...>text.</a> -> <a ...>text</a>.
  out = out.replace(/<a([^>]*)>([^<]*?)\.<\/a>/gi, (_, attrs, text) => `<a${attrs}>${text}</a>.`);
  // If link is immediately followed by period (no word after), add wording so link doesn't end in period. Do NOT use "here".
  out = out.replace(/<\/a>\s*\./gi, "</a> for more.");
  return out;
}

/**
 * Remove internal links that are NOT in the WordPress posts list.
 * When wordPressPosts is provided: only allow links from the list.
 * When wordPressPosts is empty: leave content unchanged (cannot validate; ensureLinks adds from API).
 */
export function removeInvalidInternalLinks(content: string, wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>, connectedSiteUrl?: string): string {
  if (!content) return content;
  
  // Extract connected site domain for internal-link detection
  let connectedSiteDomain = '';
  let baseOrigin = '';
  if (connectedSiteUrl) {
    try {
      const urlObj = new URL(connectedSiteUrl.startsWith('http') ? connectedSiteUrl : `https://${connectedSiteUrl}`);
      connectedSiteDomain = urlObj.hostname.replace('www.', '').toLowerCase();
      baseOrigin = urlObj.origin;
    } catch {
      // Invalid URL, ignore
    }
  }

  // No WordPress posts list: leave content unchanged (removeNonWikipediaExternalLinks still strips example.com etc.)
  if (!wordPressPosts || wordPressPosts.length === 0) {
    return content;
  }

  // Build valid set from WordPress API - include www/non-www and trailing-slash variants for matching
  const validInternalLinks = new Set<string>();
  const addUrlVariants = (raw: string) => {
    if (!raw?.trim()) return;
    const trimmed = raw.trim();
    validInternalLinks.add(trimmed);
    if (trimmed.endsWith('/')) validInternalLinks.add(trimmed.slice(0, -1));
    else validInternalLinks.add(trimmed + '/');
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const pathPart = u.pathname.replace(/\/+$/, '') || '/';
      const pathWithSlash = pathPart === '/' ? '/' : pathPart + '/';
      // Add www and non-www forms for same path (AI may generate different host variant)
      const hostNoWww = u.hostname.replace(/^www\./, '').toLowerCase();
      validInternalLinks.add(`${u.protocol}//${hostNoWww}${pathPart}`);
      validInternalLinks.add(`${u.protocol}//${hostNoWww}${pathWithSlash}`);
      validInternalLinks.add(`${u.protocol}//www.${hostNoWww}${pathPart}`);
      validInternalLinks.add(`${u.protocol}//www.${hostNoWww}${pathWithSlash}`);
    } catch {}
  };
  wordPressPosts.forEach(post => {
    if (post.link?.trim()) addUrlVariants(post.link);
  });

  console.log(`[Link Sanitizer] Valid internal links: from WordPress API only (${validInternalLinks.size} variants from ${wordPressPosts.length} posts)`);

  // Pattern: markdown [text](url), HTML absolute href, HTML relative href="/path"
  const linkPattern = /(\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]*)<\/a>|<a[^>]*href=["'](\/[^"']*)["'][^>]*>([^<]*)<\/a>)/gi;

  let sanitized = content;
  let removedCount = 0;

  sanitized = sanitized.replace(linkPattern, (match, _fullMatch, markdownText, markdownUrl, htmlAbsUrl, htmlAbsText, relativePath, htmlRelText) => {
    let url: string | null = markdownUrl || htmlAbsUrl || null;
    if (url == null && relativePath != null && relativePath !== '' && baseOrigin) {
      try {
        url = relativePath.startsWith('/') ? `${baseOrigin}${relativePath}` : new URL(relativePath, baseOrigin).href;
      } catch {
        url = null;
      }
    }
    const anchorText = markdownText ?? htmlAbsText ?? htmlRelText ?? '';

    if (!url) return match; // Keep if no URL found

    try {
      const urlObj = new URL(url);
      const linkDomain = urlObj.hostname.replace('www.', '').toLowerCase();

      // Check if it's an external link (not connected site)
      const isExternal = connectedSiteDomain && linkDomain !== connectedSiteDomain;

      // If external, allow only Wikipedia (handled by removeNonWikipediaExternalLinks)
      if (isExternal) {
        const isWikipedia = linkDomain === 'wikipedia.org' ||
                           linkDomain === 'en.wikipedia.org' ||
                           linkDomain.includes('wikipedia.org');
        if (isWikipedia) {
          return match; // Keep Wikipedia links
        }
        // External non-Wikipedia links will be removed by removeNonWikipediaExternalLinks
        return match;
      }

      // Same-site media assets (uploads / image / video files) are not post URLs — keep them.
      if (isMediaAssetUrl(url)) {
        return match;
      }
      // For internal links, allow only if URL matches one from WordPress API (www/non-www, trailing slash variants)
      const urlTrimmed = url.trim();
      const normalized = urlTrimmed.replace(/\/+$/, '') || '/';
      const withSlash = normalized === '/' ? normalized : normalized + '/';
      let isValidInternalLink =
        validInternalLinks.has(urlTrimmed) ||
        validInternalLinks.has(normalized) ||
        validInternalLinks.has(withSlash);
      if (!isValidInternalLink && urlObj) {
        // Check www/non-www variant (content URL may differ from API)
        const hostRaw = urlObj.hostname;
        const hostNoWww = hostRaw.replace(/^www\./i, '').toLowerCase();
        const pathPart = urlObj.pathname.replace(/\/+$/, '') || '/';
        const pathWithSlash = pathPart === '/' ? '/' : pathPart + '/';
        const alt1 = `${urlObj.protocol}//${hostNoWww}${pathPart}`;
        const alt2 = `${urlObj.protocol}//${hostNoWww}${pathWithSlash}`;
        const alt3 = `${urlObj.protocol}//www.${hostNoWww}${pathPart}`;
        const alt4 = `${urlObj.protocol}//www.${hostNoWww}${pathWithSlash}`;
        isValidInternalLink = validInternalLinks.has(alt1) || validInternalLinks.has(alt2) || validInternalLinks.has(alt3) || validInternalLinks.has(alt4);
      }

      if (!isValidInternalLink) {
        removedCount++;
        console.warn(`[Link Sanitizer] REMOVED invalid internal link (not in WordPress posts): ${url}`);
        // Remove the link but keep the text
        return anchorText;
      }

      return match; // Keep valid internal links
    } catch {
      // Invalid URL, keep as-is
      return match;
    }
  });
  
  if (removedCount > 0) {
    console.warn(`[Link Sanitizer] Removed ${removedCount} invalid internal link(s) (only links from WordPress posts are allowed)`);
  }
  
  return sanitized;
}

/**
 * Remove external links except: (1) connected site, (2) optionally the entity's Wikipedia page only.
 * CRITICAL: Wikipedia ONLY for entity - when allowedWikipediaUrl is provided, only that URL is kept.
 * When allowedWikipediaUrl is NOT provided, ALL Wikipedia links are stripped (no topic/product Wikipedia).
 */
export function removeNonWikipediaExternalLinks(
  content: string,
  connectedSiteUrl?: string,
  allowedWikipediaUrl?: string,
  allowedExternalUrls?: string[]
): string {
  if (!content) return content;

  let connectedSiteDomain = '';
  if (connectedSiteUrl) {
    try {
      const urlObj = new URL(connectedSiteUrl.startsWith('http') ? connectedSiteUrl : `https://${connectedSiteUrl}`);
      connectedSiteDomain = urlObj.hostname.replace('www.', '').toLowerCase();
    } catch {
      /* ignore */
    }
  }

  const normUrl = (u: string) => {
    try {
      const o = new URL(u);
      return `${o.hostname.replace('www.', '').toLowerCase()}${o.pathname.replace(/\/+$/, '').toLowerCase()}`;
    } catch {
      return u.toLowerCase();
    }
  };
  /** Same host+path keys as allowlist building - tolerant of &amp; vs &, http/https. */
  const normUrlForExternalAllowlist = (u: string) => {
    try {
      const cleaned = u.replace(/&amp;/gi, '&').trim();
      const o = new URL(cleaned);
      const host = o.hostname.replace(/^www\./, '').toLowerCase();
      const path = o.pathname.replace(/\/+$/, '') || '';
      return `${host}${path.toLowerCase()}`;
    } catch {
      return u.trim().toLowerCase();
    }
  };
  const expandAllowedExternalNorms = (urls: string[]): Set<string> => {
    const set = new Set<string>();
    for (const raw of urls) {
      if (!raw?.trim()) continue;
      const t = raw.trim().replace(/&amp;/gi, '&');
      set.add(normUrlForExternalAllowlist(t));
      try {
        const o = new URL(t);
        const alt = new URL(t);
        alt.protocol = o.protocol === 'https:' ? 'http:' : 'https:';
        set.add(normUrlForExternalAllowlist(alt.href));
      } catch {
        /* ignore */
      }
    }
    return set;
  };
  const hrefMatchesAllowedExternal = (href: string, allowedNorms: Set<string>): boolean => {
    if (allowedNorms.size === 0) return false;
    const candidates = [href, href.replace(/&amp;/gi, '&')];
    try {
      candidates.push(decodeURIComponent(href.replace(/&amp;/gi, '&')));
    } catch {
      /* ignore */
    }
    for (const c of candidates) {
      if (allowedNorms.has(normUrlForExternalAllowlist(c))) return true;
      try {
        const noHash = c.split('#')[0] ?? c;
        if (noHash !== c && allowedNorms.has(normUrlForExternalAllowlist(noHash))) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  };
  const normWiki = normUrl;
  const allowedNorm = allowedWikipediaUrl ? normWiki(allowedWikipediaUrl) : null;

  const allowedExternalNorms = expandAllowedExternalNorms(allowedExternalUrls ?? []);

  const linkPattern = /(\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]*)<\/a>)/gi;
  let sanitized = content;
  let removedCount = 0;
  let keptExternalCount = 0;

  sanitized = sanitized.replace(linkPattern, (match, _fullMatch, markdownText, markdownUrl, htmlUrl, htmlText) => {
    const url = markdownUrl || htmlUrl;
    if (!url) return match;

    try {
      const urlObj = new URL(url);
      const linkDomain = urlObj.hostname.replace('www.', '').toLowerCase();
      const isConnectedSite = connectedSiteDomain && linkDomain === connectedSiteDomain;
      if (isConnectedSite) return match;

      if (allowedExternalNorms.size > 0 && hrefMatchesAllowedExternal(url, allowedExternalNorms)) {
        keptExternalCount++;
        return match;
      }

      const isWikipedia = linkDomain.includes('wikipedia.org');
      if (isWikipedia) {
        if (allowedNorm && normWiki(url) === allowedNorm) return match;
        removedCount++;
        console.warn(`[Link Sanitizer] REMOVED non-entity Wikipedia link (only entity Wikipedia allowed): ${url}`);
        return markdownText || htmlText || '';
      }

      removedCount++;
      console.warn(`[Link Sanitizer] REMOVED forbidden external link: ${url}`);
      return markdownText || htmlText || '';
    } catch {
      return match;
    }
  });

  if (keptExternalCount > 0) {
    console.log(`[Link Sanitizer] Kept ${keptExternalCount} allowlisted external link(s) (e.g. Semrush-approved)`);
  }
  if (removedCount > 0) {
    console.warn(`[Link Sanitizer] Removed ${removedCount} external link(s) (only connected site, entity Wikipedia, and pre-validated external links allowed)`);
  }
  return sanitized;
}

function normalizeWikiHrefForCompare(u: string): string {
  const decoded = u.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  return decoded
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

/**
 * Entity pages: ensure every blockquote links the target entity to its Wikipedia URL
 * (first occurrence in the quote, or a leading linked entity name if the name does not appear).
 */
export function linkWikipediaEntityInBlockquotes(
  html: string,
  entityName: string,
  wikipediaUrl: string
): string {
  if (!html?.trim() || !entityName?.trim() || !wikipediaUrl?.trim()) return html;
  const label = entityName.trim();
  const safeHref = wikipediaUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const targetNorm = normalizeWikiHrefForCompare(wikipediaUrl);

  const isInsideAnchor = (fragment: string, index: number): boolean => {
    const before = fragment.slice(0, index);
    const openA = (before.match(/<a\b/gi) || []).length;
    const closeA = (before.match(/<\/a>/gi) || []).length;
    return openA > closeA;
  };

  const alreadyHasThisWikiLink = (inner: string): boolean => {
    const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      const h = m[1];
      if (!/wikipedia\.org/i.test(h)) continue;
      if (normalizeWikiHrefForCompare(h) === targetNorm) return true;
    }
    return false;
  };

  const entityEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entityReGlobal = new RegExp(entityEscaped, 'gi');

  return html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_full, inner: string) => {
    if (alreadyHasThisWikiLink(inner)) {
      return `<blockquote>${inner}</blockquote>`;
    }
    let m: RegExpExecArray | null;
    entityReGlobal.lastIndex = 0;
    while ((m = entityReGlobal.exec(inner)) !== null) {
      const offset = m.index;
      if (isInsideAnchor(inner, offset)) continue;
      const matched = m[0];
      const linked =
        inner.slice(0, offset) +
        `<a href="${safeHref}">${matched}</a>` +
        inner.slice(offset + matched.length);
      return `<blockquote>${linked}</blockquote>`;
    }
    const safeLabel = label
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<blockquote><a href="${safeHref}">${safeLabel}</a> - ${inner}</blockquote>`;
  });
}

/**
 * Full content sanitization pipeline
 * Applies all sanitization rules before WordPress upload
 */
export function sanitizeContentForUpload(
  content: string,
  connectedSiteUrl?: string,
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  allowedWikipediaUrl?: string,
  allowedExternalUrls?: string[],
  wikipediaEntityLabel?: string
): string {
    if (!content) return content;
  let sanitized = content;

  // Step 0: Strip example.com / reserved placeholder hrefs (defense in depth; preserves Wikipedia)
  sanitized = stripPlaceholderDomainLinks(sanitized);
  
  // Step 1: Remove placeholder artifacts
  sanitized = sanitizePlaceholders(sanitized);
  
  // Step 1.05: Remove feature-label artifacts ([LIST]: ..., [TABLE]: ..., etc.)
  sanitized = removeFeatureLabelArtifacts(sanitized);
  
  // Step 1.1: Remove "Article Title" labels (must be first to catch metadata)
  sanitized = removeArticleTitleLabels(sanitized);
  
  // Step 1.15: Remove forbidden sections (like "External Resources") - must be before duplicate heading removal
  sanitized = removeForbiddenSections(sanitized);
  
  // Step 1.2: Remove duplicate consecutive headings (must be early in pipeline)
  sanitized = removeDuplicateHeadings(sanitized);
  
  // Step 1.3: Remove empty tables (must be before fixing malformed tables)
  sanitized = removeEmptyTables(sanitized);
  // Step 1.45: Remove link columns from tables (links must be integrated into content columns)
  sanitized = removeLinkColumnsFromTables(sanitized);
  
  // Step 1.46: Fix malformed link formats (like [URL: ...] to proper markdown)
  sanitized = fixMalformedLinks(sanitized);
  
  // Step 1.47: Convert ALL remaining markdown to HTML - no exceptions
  sanitized = convertAllMarkdownToHtml(sanitized);
  
  // Step 1.48: Fix orphaned <li> elements (bare <li> without <ul>/<ol> wrapper, stray closers)
  sanitized = fixOrphanedListItems(sanitized);

  // Step 1.49: Entity pages - link blockquotes to the entity Wikipedia URL (first entity mention or leading link)
  if (allowedWikipediaUrl && wikipediaEntityLabel?.trim()) {
    sanitized = linkWikipediaEntityInBlockquotes(
      sanitized,
      wikipediaEntityLabel.trim(),
      allowedWikipediaUrl
    );
  }
  
  // Bulk: no colon/em-dash transforms - preserve HTML exactly
  // Step 2: Remove invalid internal links (CRITICAL - only allow links from WordPress posts)
  // Same-site media asset URLs (uploads / image / video) are kept via isMediaAssetUrl.
  const beforeInternalLen = sanitized.length;
  sanitized = removeInvalidInternalLinks(sanitized, wordPressPosts, connectedSiteUrl);
  const afterInternalLen = sanitized.length;
  
  // Step 5: Remove external links (only connected site + entity Wikipedia + pre-validated DFS external links + preserved media)
  const beforeExternalLen = sanitized.length;
  sanitized = removeNonWikipediaExternalLinks(sanitized, connectedSiteUrl, allowedWikipediaUrl, allowedExternalUrls);
  const afterExternalLen = sanitized.length;

  // Step 6: Enforce one image per section
  sanitized = enforceOneImagePerSection(sanitized);
  
  // Step 7: Final cleanup
  sanitized = sanitized.trim();
  
  // Step 8: Final link pass - ensure ZERO markdown links survive (entity/Wikipedia etc.)
  sanitized = forceConvertMarkdownLinks(sanitized);
  
  return sanitized;
}

/**
 * Strip pipe or dash separator and any suffix (e.g. " | Florida Living", " – Site Name")
 * so the title is a single short phrase with no separator.
 */
export function stripTitleSeparatorSuffix(title: string): string {
  if (!title || !title.trim()) return title;
  const t = title.trim();
  const pipeIdx = t.indexOf(" | ");
  const dashIdx = t.indexOf(" – ");
  const hyphenIdx = t.indexOf(" - ");
  let cut = t.length;
  if (pipeIdx > 0) cut = Math.min(cut, pipeIdx);
  if (dashIdx > 0) cut = Math.min(cut, dashIdx);
  if (hyphenIdx > 0) cut = Math.min(cut, hyphenIdx);
  return (cut < t.length ? t.substring(0, cut) : t).trim();
}

/**
 * Truncate title to maximum 50 characters for optimal SEO (Content Optimizer module requirement)
 * Preserves word boundaries when possible to avoid cutting words in half
 */
export function truncateTitleForSEO(title: string, maxLength: number = 50): string {
  if (!title) return title;
  
  const trimmed = title.trim();
  
  // If title is already within limit, return as-is
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  
  // Try to truncate at word boundary (space or punctuation)
  const truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf(','),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
    truncated.lastIndexOf(':'),
    truncated.lastIndexOf(';')
  );
  
  // Use the later of space or punctuation for a clean cut
  const cutPoint = Math.max(lastSpace, lastPunctuation);
  
  if (cutPoint > maxLength * 0.7) {
    // Only use word boundary if it's not too early (at least 70% of max length)
    return truncated.substring(0, cutPoint).trim();
  }
  
  // If no good word boundary, truncate at max length and add ellipsis if needed
  return truncated.trim();
}

/**
 * Validate content before upload
 * Returns warnings if content has issues (but doesn't block upload)
 */
export function validateContentForUpload(content: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!content || content.trim().length === 0) {
    return { valid: false, warnings: ['Content is empty'] };
  }
  
  // Check for remaining placeholder patterns (shouldn't happen after sanitization)
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(`Found placeholder pattern: ${pattern.source}`);
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
  }
  
  // Check for suspiciously short content
  const textContent = content.replace(/<[^>]*>/g, '').trim();
  if (textContent.length < 100) {
    warnings.push('Content is very short (less than 100 characters of text)');
  }
  
  // Check for missing closing tags (basic check)
  const openTags = (content.match(/<[a-z][a-z0-9]*[^>]*(?<!\/)\s*>/gi) || []).length;
  const closeTags = (content.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  if (Math.abs(openTags - closeTags) > 5) {
    warnings.push('Possible HTML tag mismatch detected');
  }
  
  return { valid: true, warnings };
}

/**
 * Export Generator harness prompt fragments for server PHP post creator.
 * Run: node scripts/export-post-creator-server-prompts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const systemUserPath = path.join(root, "src/lib/prompt-builders/system-user.ts");
const outPath = path.join(
  root,
  "wordpress-plugins/neo-pulse-app/includes/agent-runs/prompts/post-creator-exported-prompts.php",
);

const src = fs.readFileSync(systemUserPath, "utf8");

function extractConst(name) {
  const re = new RegExp(
    `const ${name} = \`([\\s\\S]*?)\`;`,
    "m",
  );
  const m = src.match(re);
  if (!m) throw new Error(`Missing ${name} in system-user.ts`);
  return m[1];
}

const harnessLengthMarkdown = extractConst("HARNESS_SECTION_LENGTH_RULE_MARKDOWN");
const harnessScopeMarkdown = extractConst("HARNESS_SECTION_SCOPE_RULE_MARKDOWN");

const php = `<?php
/**
 * Generator-aligned prompt fragments (exported from TypeScript).
 * DO NOT EDIT BY HAND — run: node scripts/export-post-creator-server-prompts.mjs
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Agent_Run_Exported_Prompts {

\tpublic static function harness_section_length_rule_markdown(): string {
\t\treturn <<<'PROMPT'
${harnessLengthMarkdown.replace(/'/g, "\\'")}
PROMPT;
\t}

\tpublic static function harness_section_scope_rule_markdown(): string {
\t\treturn <<<'PROMPT'
${harnessScopeMarkdown.replace(/'/g, "\\'")}
PROMPT;
\t}

\tpublic static function checklist_system_prompt(): string {
\t\treturn 'You are an expert blog content strategist and blueprint architect. Output ONLY a numbered checklist (one item per line). Each checklist item becomes exactly one H2 harness pass. Require minimum ~1.0% focus keyword density, exact primary keyword once per H2 body, moderately short paragraphs (~2-4 sentences). Never create FAQ body H2s.';
\t}

\tpublic static function blueprint_system_prompt(): string {
\t\treturn 'You are an SEO content architect. Return valid JSON only. One agent per checklist item. Do NOT add Overview or FAQ agents. Rename Introduction/Intro titles to SEO-friendly H2 text (never drop intro sections).';
\t}

\tpublic static function harness_body_system_prompt(): string {
\t\treturn 'You write SEO blog sections in Markdown for a harnessed generator. Follow section word budget and harness length rules. No FAQ sections. Output exactly one ## section.';
\t}

\tpublic static function checklist_structure_requirements( string $primary_keyword ): string {
\t\t$kw = $primary_keyword !== '' ? $primary_keyword : 'primary keyword';
\t\treturn "Requirements (NON-NEGOTIABLE):\\n"
\t\t\t. "1. Create 5-6 checklist items maximum: introduction-style first H2, 3-4 body topics, conclusion.\\n"
\t\t\t. "2. Each item must include [STRUCTURE], [EXACT PRIMARY PER H2], [FOCUS KEYWORD DENSITY], [PARAGRAPH LENGTH], and [LINK]: 3-5 internal links via [[LINK:phrase|anchor]].\\n"
\t\t\t. "3. Include at least one [TABLE], one [LIST]: bullet, and one [LIST]: number across the article (max 2 [TABLE] total).\\n"
\t\t\t. "4. First H2: NEVER title it Introduction or Intro — use SEO-friendly active title. Exact primary keyword ({$kw}) once in body.\\n"
\t\t\t. "5. Conclusion H2 with exact primary keyword once in body.\\n"
\t\t\t. "6. **[FORBIDDEN]**: FAQ, Q&A, Frequently Asked Questions body sections.\\n"
\t\t\t. "7. One checklist line = one H2 = one harness pass (~" . (int) floor( Neo_Pulse_App_Agent_Run_Article_Length_Policy::ARTICLE_MAX_WORDS / 6 ) . " words target per section).\\n"
\t\t\t. "8. Include [REAL-WORLD EXAMPLE] in at least one section.";
\t}

\tpublic static function rename_intro_agent_title( string $title, string $keyword ): string {
\t\t$lower = strtolower( trim( $title ) );
\t\tif ( ! in_array( $lower, array( 'introduction', 'intro' ), true ) ) {
\t\t\treturn trim( $title );
\t\t}
\t\t$topic = trim( $keyword ) !== '' ? trim( $keyword ) : 'This Topic';
\t\treturn 'Why ' . $topic . ' Matters';
\t}
}
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, php.replace(/\r\n/g, "\n"), "utf8");
console.log("Wrote", outPath);

import type { ElementorSectionHeader } from "@/lib/elementor-page-content/parse-elementor-section-outline";

export function buildElementorHeadersHarnessHtml(args: {
  sections: ElementorSectionHeader[];
  focusKeyword: string;
  seoResearch?: string;
}): string {
  const outline = args.sections
    .map((section) => {
      const title = section.title?.trim();
      if (!title) {
        throw new Error("Elementor headers contract failed: empty section title");
      }
      return `<h2>${title}</h2>`;
    })
    .join("\n");
  return [
    `<p>Rewrite every section heading for SEO. Focus keyword: ${args.focusKeyword}</p>`,
    args.seoResearch?.trim()
      ? `<p>Research brief:\n${args.seoResearch.trim().slice(0, 2500)}</p>`
      : "",
    outline,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildElementorSectionHeaderHarnessHtml(args: {
  section: ElementorSectionHeader;
  focusKeyword: string;
}): string {
  const title = args.section.title?.trim() || "Section";
  return [
    `<h2>${title}</h2>`,
    `<p>Rewrite only the heading in Elementor band ${args.section.id} for keyword ${args.focusKeyword}. Do not change body widgets.</p>`,
  ].join("\n");
}

export function buildElementorSectionContentHarnessHtml(args: {
  section: ElementorSectionHeader;
  focusKeyword: string;
  seoResearch?: string;
}): string {
  const title = args.section.title?.trim() || "Section";
  const body = args.section.bodyText?.trim() || "Section body.";
  return [
    `<h2>${title}</h2>`,
    `<div>${body}</div>`,
    `<p>Rewrite body copy in Elementor band ${args.section.id} for keyword ${args.focusKeyword}. Keep the section heading unless it is empty.</p>`,
    args.seoResearch?.trim()
      ? `<p>Research brief:\n${args.seoResearch.trim().slice(0, 2000)}</p>`
      : "",
  ].join("\n");
}

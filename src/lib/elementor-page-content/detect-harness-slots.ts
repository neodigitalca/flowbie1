import { elementorTreePlainText } from "@/lib/elementor-page-content/parse-elementor-section-outline";

export type ElementorHarnessSlots = {
  answer: boolean;
  overview: boolean;
  scenario: boolean;
};

function textHasAnswerBlock(text: string): boolean {
  return (
    /<h2[^>]*>\s*answer\s*<\/h2>/i.test(text) ||
    /\banswer\b/i.test(text)
  );
}

function textHasOverviewBlock(text: string): boolean {
  return /\boverview\b/i.test(text) && /(<h2[^>]*>\s*overview|overview section)/i.test(text);
}

function textHasScenarioBlock(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /<h2[^>]*>\s*scenario\s*:/i.test(text) ||
    lower.includes("local homeowner example") ||
    lower.includes("realistic local") ||
    lower.includes("local situation") ||
    lower.includes("local scenario") ||
    /recommendation\s*:/i.test(text)
  );
}

/** Detect harness-shaped content inside Elementor widget text. */
export function detectHarnessSlotsFromElementor(elementorData: unknown): ElementorHarnessSlots {
  const text = elementorTreePlainText(elementorData);
  return {
    answer: textHasAnswerBlock(text),
    overview: textHasOverviewBlock(text),
    scenario: textHasScenarioBlock(text),
  };
}

export type ElementorHarnessKind =
  | "answer"
  | "overview"
  | "scenario"
  | "links"
  | "wikipedia"
  | "headers"
  | "section-header"
  | "section-content"
  | "full-page"
  | "section";

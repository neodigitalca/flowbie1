export const SCENARIO_HARNESS_SECTION_TITLES = ["Persona", "Scenario section"] as const;

export const SCENARIO_STEP_PERSONA = 0;
export const SCENARIO_STEP_SECTION = 1;

export function formatScenarioSectionMarkdown(scenarioHtml: string, h2Title?: string): string {
  const html = scenarioHtml.trim();
  if (!html) return "Scenario HTML: empty.";
  const title = h2Title?.trim() ? `# ${h2Title.trim()}` : "# Scenario section";
  return [title, "", "```html", html, "```"].join("\n");
}

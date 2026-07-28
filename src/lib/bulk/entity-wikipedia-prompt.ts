export type EntityWikipediaPromptInput = {
  entity: string;
  wikipediaUrl: string;
  wikipediaTitle?: string;
};

export function formatMandatoryEntityWikipediaForPrompt(input: EntityWikipediaPromptInput): string {
  const entity = input.entity.trim();
  const url = input.wikipediaUrl.trim();
  const title = input.wikipediaTitle?.trim() || entity;
  if (!entity || !url) return "";

  return `
=== MANDATORY ENTITY WIKIPEDIA (COPY EXACTLY) ===
Entity: ${entity}
Wikipedia article title: ${title}
Wikipedia URL: ${url}

Rules:
- Link the entity place name "${entity}" to this **exact** Wikipedia URL in the **Overview** section, the intro section, and in at least one body H2 section.
- Use short anchor text (the entity name or a natural phrase containing it). Copy the href character-for-character: ${url}
- This is the **only** allowed external link unless Semrush approved URLs or imported draft links are also specified in this prompt.
- Do NOT invent, substitute, or omit this Wikipedia link on entity/service-area pages.
=== END MANDATORY ENTITY WIKIPEDIA ===
`;
}

export function injectEntityWikipediaIntoChecklist(
  checklist: string[],
  input: EntityWikipediaPromptInput,
): string[] {
  const entity = input.entity.trim();
  const url = input.wikipediaUrl.trim();
  const title = input.wikipediaTitle?.trim() || entity;
  if (!entity || !url || checklist.length === 0) return checklist;

  const line = `[EXTERNAL_WIKI]: Link "${entity}" to ${url} (article: ${title}) in the Overview, the intro agent, and at least one body H2 section. Use exact href.`;
  if (checklist.some((item) => item.includes(url))) return checklist;
  return [line, ...checklist];
}

type BlueprintAgent = {
  step?: number;
  title?: string;
  features?: string[];
};

export function injectEntityWikipediaIntoBlueprintAgents<T extends BlueprintAgent>(
  agents: T[],
  input: EntityWikipediaPromptInput,
): T[] {
  const entity = input.entity.trim();
  const url = input.wikipediaUrl.trim();
  if (!entity || !url || agents.length === 0) return agents;

  const feature = `[EXTERNAL_WIKI]: href=${url} | anchor=${entity}`;
  const entityLower = entity.toLowerCase();

  return agents.map((agent) => {
    const features = Array.isArray(agent.features) ? [...agent.features] : [];
    if (features.some((f) => f.includes(url))) return agent;

    const titleNorm = (agent.title ?? "").trim().toLowerCase();
    const isIntro = agent.step === 1;
    const isWeCare =
      titleNorm.includes("we care about") ||
      (entityLower.length > 2 && titleNorm.includes(entityLower.split(",")[0]!.trim().toLowerCase()));

    if (!isIntro && !isWeCare) return agent;
    return { ...agent, features: [...features, feature] };
  });
}

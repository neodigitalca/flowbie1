import { CRITICAL_LINK_RULE } from "./core";

export const buildFlowAssistSystemPrompt = (
  flowTitle: string,
  flowPurpose: string,
  currentPlan: string,
  knowledgeBaseContext: string,
  sectionStructure?: string,
  connectedSiteContext?: string
): string => {
  return `You are NEO Pulse, an expert AI Flow Assistant specializing in plan modification and optimization. Your role is to help users modify execution plans for content generation.

Current Flow Context:
- Title: ${flowTitle || "Untitled Article"}
- Purpose: ${flowPurpose || "Not specified"}

Current Plan:
${currentPlan}

${sectionStructure ? `\n=== DOCUMENT STRUCTURE (for section identification) ===\n${sectionStructure}\n=== END STRUCTURE ===` : ""}

${knowledgeBaseContext ? `\n=== KNOWLEDGE BASE CONTEXT ===\n${knowledgeBaseContext}\n=== END KNOWLEDGE BASE ===` : ""}

${connectedSiteContext ? `\n=== CONNECTED SITE (WordPress Posts) ===\n${connectedSiteContext}\n=== END CONNECTED SITE ===` : ""}

CRITICAL: CONTENT CONFLICT PREVENTION
- When generating new blog posts or content, you MUST ensure the content does NOT conflict with or duplicate existing posts in the knowledge base
- If the user instructions mention existing knowledge base posts, analyze them to ensure uniqueness
- The generated content must be unique and add value without overlapping with existing content
- Avoid creating similar titles, topics, or content structures that already exist in the knowledge base

CRITICAL: ALL context must come from the Knowledge Base and Connected Site above. NEVER invent business names, URLs, or details not present in those sections.

Your task is to:
1. Understand user modification requests
2. Identify which specific sections or agents are affected by the request
3. Generate a clear, actionable checklist with the MINIMUM number of steps needed to fulfill the request -- do NOT over-engineer simple requests (1-2 steps is fine for simple changes, only use more for complex multi-part requests)
4. Ensure the checklist addresses all aspects of the user's request
5. Include explicit section/agent references in checklist items when applicable
6. Present the checklist in a clear, numbered format
7. If generating new content, ensure it does not conflict with existing knowledge base posts

When generating checklists, be specific and actionable. Match the number of steps to the complexity of the request -- a simple request should have 1-2 steps, not 5.
For section-specific modifications, include section references in the format: [Section: ## Header Name] or [Agent: agent-id]`;
};

export const buildChecklistGenerationPrompt = (userInstructions: string, sectionStructure?: string): string => {
  return `The user wants to modify the document with the following instructions:

${userInstructions}

${sectionStructure ? `\n=== AVAILABLE SECTIONS/AGENTS ===\n${sectionStructure}\n=== END SECTIONS ===\n\nIMPORTANT: When the modification request targets specific sections or agents, you MUST include explicit references in your checklist items using one of these formats:
- For markdown sections: [Section: ## Header Name] or [Section: ### Subsection Name]
- For blueprint agents: [Agent: agent-id] or [Agent: agent-title]

If the request affects the entire document or multiple sections, you can omit section references, but be as specific as possible about which parts need changes.` : ""}

Generate a checklist to update the document based on these instructions. CRITICAL RULES:
- Use the MINIMUM number of steps needed. If the user asks for one thing, generate 1-2 steps. Only generate 3+ steps for genuinely complex multi-part requests.
- Do NOT pad with unnecessary steps or over-engineer simple requests.
- Each step must be clear, specific, and actionable.
- Include section/agent references when applicable.
- ALL information (business names, URLs, details) must come from the Knowledge Base and Connected Site context provided. NEVER invent or assume details.

Format your response as a numbered list. Do not include any other text, just the checklist items.`;
};

export const buildPlanModificationPrompt = (
  checklist: string[],
  originalPlan: string,
  flowTitle: string,
  flowPurpose: string,
  sectionsPrompt: string,
  isPartialContent: boolean = false,
  contextInfo?: string
): string => {
  const partialInstructions = isPartialContent ? `
--- IMPORTANT: PARTIAL CONTENT MODIFICATION ---
You are ONLY modifying specific sections of the plan. The content provided below represents ONLY the sections that need to be changed, along with minimal context from surrounding sections.

${contextInfo ? `Context Information:\n${contextInfo}\n` : ""}

CRITICAL:
- Only modify the sections provided below
- Maintain the exact structure and format of the provided sections
- Do NOT add new sections unless explicitly requested in the checklist
- Output ONLY the modified sections in the same format as provided
- Preserve all section headers exactly as they appear
- If modifying "Target Semantic Triples" or "Target Links" sections, maintain the grouping by heading structure
- **ABSOLUTELY CRITICAL LINK RULES**:
  ${CRITICAL_LINK_RULE}
  - All links MUST be displayed in markdown format with optimized anchor text AND full target URLs: \`[optimized anchor text](full-target-url)\`
  - NEVER use placeholders or incomplete URLs
  - Always show the complete, real target link with its optimized anchor text
  - DO NOT add new links unless they exist in the Knowledge Base
  - Any link not from the Knowledge Base MUST be removed
- **TABLES**: Output as Markdown only. NEVER HTML. Use | Col1 | Col2 |, newline, | --- | --- |, newline, | A | B |. No <table>, <tr>, <td>.
` : "";

  return `You are the **Lead SEO Content Strategist**. Your task is to modify the existing execution plan based on the provided checklist.

--- Article Goal and Structure ---
# ${flowTitle || "Untitled Article"}
**Purpose**: ${flowPurpose}

Content Structure (The final output MUST strictly adhere to this exact structure):
${sectionsPrompt}

--- Modification Checklist ---
${checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${partialInstructions}

--- ${isPartialContent ? "Sections to Modify" : "Original Plan"} ---
${originalPlan}

--- Modification Instructions (CRITICAL) ---
1. Review the modification checklist above.
2. Update the ${isPartialContent ? "provided sections" : "original plan"} according to each checklist item.
3. Maintain all critical sections: Target Semantic Triples, Target Links, and Detailed Feature Implementation.

**ABSOLUTELY CRITICAL LINK RULES WHEN MODIFYING**:
${CRITICAL_LINK_RULE}
- When modifying or maintaining links, ensure they are always displayed in markdown format with optimized anchor text AND full target URLs: \`[optimized anchor text](full-target-url)\`
- NEVER use placeholders or incomplete URLs
- Always show the complete, real target link with its optimized anchor text
- DO NOT add new links unless they exist in the Knowledge Base
- If modifying the 'Target Links' section, only include links that come from the Knowledge Base
- Any link not from the Knowledge Base MUST be removed
4. Ensure the modified plan still follows the same structure and format as the original.
5. ${isPartialContent ? "Output ONLY the modified sections. Maintain exact section boundaries and headers." : "The modified plan must be complete and ready for the Drafting AI."}
6. Output ONLY the modified ${isPartialContent ? "sections" : "plan"}. Do not include any explanations or notes.

Generate the modified ${isPartialContent ? "sections" : "plan"} now:`;
};

export const buildFinalReportModificationPrompt = (
  checklist: string[],
  originalFinal: string,
  flowTitle: string,
  flowPurpose: string,
  sectionsPrompt: string,
  isPartialContent: boolean = false,
  contextInfo?: string
): string => {
  const partialInstructions = isPartialContent ? `
--- IMPORTANT: PARTIAL CONTENT MODIFICATION ---
You are ONLY modifying specific sections of the final report. The content provided below represents ONLY the sections that need to be changed, along with minimal context from surrounding sections.

${contextInfo ? `Context Information:\n${contextInfo}\n` : ""}

CRITICAL:
- Only modify the sections provided below
- Maintain the exact heading structure (##, ###, etc.) as provided
- Do NOT add new sections unless explicitly requested in the checklist
- Output ONLY the modified sections with their headers
- Preserve all markdown formatting
- Ensure smooth transitions if context sections are provided
` : "";

  return `You are the **Ultimate Quality Assurance AI / SEO Strategist**. Your task is to modify the existing final report based on the provided checklist.

*** CRITICAL: OUTPUT MARKDOWN ONLY. NEVER HTML. ***
If the report contains ANY HTML (<table>, <tr>, <td>, <a href>), you MUST convert to Markdown. Tables: | Col | Col |, newline | --- | --- |. Links: [text](url). Zero HTML tags in output.

--- Article Goal and Structure ---
# ${flowTitle || "Untitled Article"}
**Purpose**: ${flowPurpose}

Content Structure (The final output MUST strictly adhere to this exact structure):
${sectionsPrompt}

--- Modification Checklist ---
${checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${partialInstructions}

--- ${isPartialContent ? "Sections to Modify" : "Original Final Report"} ---
${originalFinal}

--- Modification Instructions (CRITICAL) ---
1. Review the modification checklist above.
2. Update the ${isPartialContent ? "provided sections" : "original final report"} according to each checklist item.
3. Maintain the exact heading structure and order as specified above.
4. Ensure all modifications maintain SEO best practices, flow, tone, and grammatical correctness.
5. ${isPartialContent ? "Ensure the modified sections read naturally and maintain consistency with the overall document style." : "Ensure the modified report reads as a cohesive, single document."}
6. **ABSOLUTELY CRITICAL LINK RULES WHEN MODIFYING**:
${CRITICAL_LINK_RULE}
- All links MUST be displayed in markdown format with optimized anchor text AND full target URLs: \`[optimized anchor text](full-target-url)\`
- NEVER use placeholders or incomplete URLs
- Always show the complete, real target link with its optimized anchor text
- DO NOT add new links unless they exist in the Knowledge Base
- If the Execution Plan contains a 'Target Links' section, ONLY use links from that section
- REMOVE any links that are not in the 'Target Links' section of the plan
- Any fabricated or made-up links MUST be removed immediately
7. Output ONLY the modified ${isPartialContent ? "sections in Markdown format" : "final report in Markdown format"}. Do not include any explanations, notes, or the checklist.

Generate the modified ${isPartialContent ? "sections" : "final report"} now:`;
};

export const buildDraftReportModificationPrompt = (
  checklist: string[],
  originalDraft: string,
  flowTitle: string,
  flowPurpose: string,
  sectionsPrompt: string,
  plan: string,
  isPartialContent: boolean = false,
  contextInfo?: string
): string => {
  const partialInstructions = isPartialContent ? `
--- IMPORTANT: PARTIAL CONTENT MODIFICATION ---
You are ONLY modifying specific sections of the draft report. The content provided below represents ONLY the sections that need to be changed, along with minimal context from surrounding sections.

${contextInfo ? `Context Information:\n${contextInfo}\n` : ""}

CRITICAL:
- Only modify the sections provided below
- Maintain the exact heading structure (##, ###, etc.) as provided
- Do NOT add new sections unless explicitly requested in the checklist
- Output ONLY the modified sections with their headers
- Preserve all markdown formatting
- Ensure smooth transitions if context sections are provided
` : "";

  return `You are the **Drafting AI / Master Content Writer**. Your task is to modify the existing draft report based on the provided checklist.

*** CRITICAL: OUTPUT MARKDOWN ONLY. NEVER HTML. ***
If the draft contains ANY HTML (<table>, <tr>, <td>, <a href>), you MUST convert to Markdown. Tables: | Col | Col |. Links: [text](url). Zero HTML tags in output.

--- Article Goal and Structure ---
# ${flowTitle || "Untitled Article"}
**Purpose**: ${flowPurpose}

Content Structure (The final output MUST strictly adhere to this exact structure):
${sectionsPrompt}

--- Execution Plan (Reference) ---
${plan}

--- Modification Checklist ---
${checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${partialInstructions}

--- ${isPartialContent ? "Sections to Modify" : "Original Draft Report"} ---
${originalDraft}

--- Modification Instructions (CRITICAL) ---
1. Review the modification checklist above.
2. Update the ${isPartialContent ? "provided sections" : "original draft report"} according to each checklist item.
3. Maintain the exact heading structure and order as specified above.
4. Ensure all modifications maintain SEO best practices, flow, tone, and grammatical correctness.
5. ${isPartialContent ? "Ensure the modified sections read naturally and maintain consistency with the overall document style." : "Ensure the modified draft reads as a cohesive, single document."}
6. Continue to follow the Execution Plan while incorporating the modifications.
7. **ABSOLUTELY CRITICAL LINK RULES WHEN MODIFYING**:
${CRITICAL_LINK_RULE}
- All links MUST be displayed in markdown format with optimized anchor text AND full target URLs: \`[optimized anchor text](full-target-url)\`
- NEVER use placeholders or incomplete URLs
- Always show the complete, real target link with its optimized anchor text exactly as specified in the Execution Plan
- DO NOT add new links unless they exist in the Knowledge Base
- If the Execution Plan contains a 'Target Links' section, ONLY use links from that section
- REMOVE any links that are not in the 'Target Links' section of the plan
- Any fabricated or made-up links MUST be removed immediately
8. Output ONLY the modified ${isPartialContent ? "sections in Markdown format" : "draft report in Markdown format"}. Do not include any explanations, notes, or the checklist.

Generate the modified ${isPartialContent ? "sections" : "draft report"} now:`;
};

export const buildBlueprintModificationPrompt = (
  checklist: string[],
  originalBlueprint: string,
  flowTitle: string,
  flowPurpose: string,
  isPartialContent: boolean = false,
  contextInfo?: string,
  connectedSiteContext?: string
): string => {
  const partialInstructions = isPartialContent ? `
--- IMPORTANT: PARTIAL CONTENT MODIFICATION ---
You are ONLY modifying specific agents in the blueprint. The JSON provided below represents ONLY the agents that need to be changed, along with minimal context from surrounding agents.

${contextInfo ? `Context Information:\n${contextInfo}\n` : ""}

CRITICAL:
- Only modify the agents provided in the "agents" array below
- Maintain the exact structure of all agent objects
- Do NOT add new agents unless explicitly requested in the checklist
- Preserve all agent IDs exactly as provided
- Maintain step ordering relative to the provided agents
- Output ONLY the modified agents array as valid JSON
` : "";

  return `You are the **Blueprint Architect AI**. Your task is to modify the existing blueprint based on the checklist below.

ABSOLUTE RULE #1: FOLLOW THE CHECKLIST EXACTLY. Create ONLY the agents needed to fulfill the checklist -- nothing more. If the checklist asks for one thing, create ONE agent. Do NOT pad with extra agents, blog sections, FAQ sections, or any content the checklist did not ask for. The "agents" array MUST NEVER be empty -- always include at least one agent containing the requested content/information.

ABSOLUTE RULE #2: ALL business names, URLs, contact details, and factual information MUST come from the Knowledge Base and Connected Site context in the system message. NEVER invent or hallucinate any details.

ABSOLUTE RULE #3: If the original blueprint has existing agents, preserve them unchanged unless the checklist specifically asks to modify them. Only add/change what the checklist requests.

--- Flow Context ---
Title: ${flowTitle || "Untitled Article"}
Purpose: ${flowPurpose || "Not specified"}

--- Modification Checklist ---
${checklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${partialInstructions}

--- ${isPartialContent ? "Agents to Modify" : "Original Blueprint"} ---
${originalBlueprint}

--- Output Rules ---
1. Do EXACTLY what the checklist says. Nothing more, nothing less.
2. The number of agents must be the MINIMUM needed to fulfill the checklist (at least 1, never 0). If one agent covers it, output one agent.
3. Do NOT create blog content, FAQ sections, or extra agents unless the checklist explicitly asks for them.
4. ALL requested information (business details, NAP data, contact info, etc.) MUST go into agent descriptions and features -- NOT only into the top-level title/purpose fields.
5. Every agent object MUST use this structure:
   {
     "id": "unique-id",
     "step": 1,
     "title": "Descriptive title for this section",
     "description": "What this agent covers",
     "features": ["[TYPE]: description"],
     "h2Count": 1,
     "h3Count": 0,
     "h3Enabled": false,
     "headingLevel": 1,
     "maxTokens": 2000
   }
   Feature types: [LIST], [LINK], [IMAGE], [CUSTOM]. Use "title" NOT "name".
6. For internal links: use FULL URLs from the Connected Site or Knowledge Base. NEVER invent URLs.
7. If the checklist asks to update "title" or "purpose", include them at the top level of the JSON (same level as "agents").
8. Output ONLY valid JSON. No explanations, no markdown, no notes.

Generate the ${isPartialContent ? "modified agents array" : "blueprint JSON"} now:`;
};

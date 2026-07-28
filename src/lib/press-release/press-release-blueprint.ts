import type { AgentConfig } from "@/types/agent-config";



export type PressReleaseBlueprint = {

  title: string;

  purpose: string;

  agents: AgentConfig[];

};



/**

 * Static harness blueprint: AP-style press release sections (Markdown per agent).

 */

export function buildPressReleaseBlueprint(opts: {

  seedKeyword: string;

  /** Optional override for the release headline/title line in prompts */

  headlineHint?: string;

}): PressReleaseBlueprint {

  const kw = opts.seedKeyword.trim();

  const headline = (opts.headlineHint?.trim() || kw).slice(0, 200);



  const agents: AgentConfig[] = [

    {

      id: "pr-headline-dateline",

      step: 1,

      title: "Section 1",

      description:

        "Open with a topical ## headline tied to the keyword (not a launch or grand-opening angle unless the user supplied that). First paragraph only: wire dateline from ACF when listed, then a lead about the business and keyword topic.",

      features: [

        "The ## line names the subject (service, topic, or expertise), not a fake news event.",

        "Dateline appears once here only; never bracket placeholders.",

        "Weave the keyword naturally; no keyword stuffing.",

      ],

      headingLevel: 1,

    },

    {

      id: "pr-lead",

      step: 2,

      title: "Section 2",

      description:

        "Continue the story: who the business is and why the keyword topic matters to readers. Neutral, factual tone. No calendar date in this block.",

      features: [

        "## names the angle (expertise, service, or customer need), not an announcement.",

        "2–3 short paragraphs maximum (blank line between paragraphs).",

        "Do not repeat the wire dateline or open with a date.",

        "No invented launches, expansions, or \"today announced\" framing.",

      ],

      headingLevel: 1,

    },

    {

      id: "pr-body",

      step: 3,

      title: "Section 3",

      description:

        "Practical context about the keyword topic and how the business helps. Factual; short paragraphs. Best section for the single required external citation link when listed in the system prompt.",

      features: [

        "## names this block's substance (guidance, options, process, or benefits).",

        "No calendar date prefix. No fake news events.",

        "Optional - bullet list for 2–4 factual bullets if it fits.",

      ],

      headingLevel: 1,

    },

    {

      id: "pr-quote",

      step: 4,

      title: "Section 4",

      description:

        "If user-supplied quote or speaker attribution exists in ACF/prompt context, use it verbatim in a blockquote with attribution. If none supplied, write one short neutral sentence about the topic or service without inventing a person's name.",

      features: [

        "## reflects the topic (expertise, quality, or customer focus), not a product launch.",

        "Use blockquote (> lines) with attribution on the next line, or one factual paragraph if no quote provided.",

        "No calendar date prefix.",

      ],

      headingLevel: 1,

    },

    {

      id: "pr-boilerplate",

      step: 5,

      title: "Section 5",

      description:

        "Boilerplate for the issuing organization using TARGET SITE name and what they do (2–3 sentences).",

      features: [

        "## names the organization or its line of business (e.g. About Acme Solar).",

        "One tight paragraph aligned with the connected site.",

        "No calendar date prefix.",

      ],

      headingLevel: 1,

    },

    {

      id: "pr-media",

      step: 6,

      title: "Section 6",

      description:

        "Closing contact block. If contact lines were supplied in ACF/prompt, use them. Otherwise reference site contact from TARGET SITE without inventing phone/email.",

      features: [

        "## is a short topical line (e.g. How to reach Acme Solar).",

        "Paragraph lines for contact; do not invent email/phone unless provided in context.",

        "No calendar date prefix.",

      ],

      headingLevel: 1,

    },

  ];



  return {

    title: headline,

    purpose: `Editorial press release centered on: ${kw}. Describe the connected business naturally; use the keyword sparingly and prefer everyday wording. Do not invent grand openings, expansions, or "today announced" events unless the user supplied them. Wire dateline only in section 1. One approved external reference link is required body-wide per system prompt when listed.`,

    agents,

  };

}


import programBriefRaw from "@/lib/ppc/flowbie-meta-program-brief.md?raw";

export const FLOWBIE_META_PROGRAM_BRIEF_MAX_CHARS = 4000;

export function getFlowbieMetaProgramBrief(): string {
  return programBriefRaw.trim();
}

export function getFlowbieMetaProgramBriefMarkdown(): string {
  const body = getFlowbieMetaProgramBrief();
  if (body.startsWith("# ")) return body;
  return `# FlowbieONE program brief\n\n${body}`;
}

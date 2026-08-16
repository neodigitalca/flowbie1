import programBriefRaw from "@/lib/ppc/neo-pulse-meta-program-brief.md?raw";

export const NEO_PULSE_META_PROGRAM_BRIEF_MAX_CHARS = 4000;

export function getNeoPulseMetaProgramBrief(): string {
  return programBriefRaw.trim();
}

export function getNeoPulseMetaProgramBriefMarkdown(): string {
  const body = getNeoPulseMetaProgramBrief();
  if (body.startsWith("# ")) return body;
  return `# NEO Pulse program brief\n\n${body}`;
}

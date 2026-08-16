export type PlatformDataSliceTeamEntry = {
  id: string;
  slice: string;
  role: string;
};

export type PlatformDataSliceEntityInput = {
  title?: string;
  url?: string;
  slug?: string;
  meta?: string;
  focus_keyword?: string;
  body?: string;
  [key: string]: unknown;
};

export type PlatformDataSliceReport = {
  id: string;
  slice: string;
  role: string;
  model?: string;
  ms?: number;
  input?: {
    entities?: PlatformDataSliceEntityInput[];
    [key: string]: unknown;
  };
  output?: {
    findings?: string[];
    score?: number | null;
    notes?: string;
    byUrl?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: string;
};

export type PlatformDataLeadSynthesis = {
  output?: {
    summary?: string;
    score?: number;
    findings?: string[];
    recommendations?: string[];
    byUrl?: Record<string, unknown>;
    [key: string]: unknown;
  };
  model?: string;
  ms?: number;
};

export type PlatformDataResearchArtifacts = {
  plan?: unknown;
  fetchedData?: unknown;
  sliceReports?: PlatformDataSliceReport[];
  leadSynthesis?: PlatformDataLeadSynthesis;
  researchedBlock?: string;
};

export type PlatformDataResearchMeta = {
  researchedDataToolIds?: string[];
  dataToolClassifierReason?: string;
  researchedDataBlock?: string;
  inventorySource?: string;
  acfComplete?: boolean;
  sliceTeam?: PlatformDataSliceTeamEntry[];
  leadAgentUsed?: boolean;
  intentSummary?: string;
  researchArtifacts?: PlatformDataResearchArtifacts | null;
  actionPlanTools?: Array<{ tool?: string; args?: Record<string, unknown> }>;
  actionExecuted?: boolean;
};

export type PlatformDataCardTurn = {
  kind: "card";
  card: unknown;
} & PlatformDataResearchMeta;

export type AgentPanelRow = {
  id: string;
  kind: "slice" | "lead";
  label: string;
  slice?: string;
  target: string;
  ms?: number;
  error?: string;
  downloadName: string;
  downloadPayload: unknown;
};

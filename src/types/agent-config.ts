export interface AgentConfig {
  id: string;
  step: number;
  title: string;
  description: string;
  features: string[];
  h2Count?: number;
  h3Count?: number;
  h3Enabled?: boolean;
  headingLevel?: number;
  maxTokens?: number;
}

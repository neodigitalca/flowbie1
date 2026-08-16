export type AssistAppModule = {
  id: string;
  label: string;
  menuPath: string;
  section: string;
  hash: string;
  pulseNav: string;
  managerTab?: string;
  dashboardCluster?: string;
  generatorSection?: string;
  description: string;
  aliases?: string[];
  features?: string[];
  uiNotes?: string;
  relatedModules?: string[];
};

export type AssistFeaturePlaybook = {
  id: string;
  moduleId: string;
  label: string;
  question: string;
  aliases: string[];
  steps: string[];
  pulseNav: string;
};

export type AssistAppCatalog = {
  version: number;
  generatedAt: string;
  modules: AssistAppModule[];
  featurePlaybooks: AssistFeaturePlaybook[];
};

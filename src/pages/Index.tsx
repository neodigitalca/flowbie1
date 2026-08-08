import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_BLUEPRINT_RESET_SUCCESSFUL_READY_FOR_A_N, NOTIFY_DRAFT_IS_INVALID_OR_USES_A_RETIRED_FORMA, NOTIFY_DRAFT_RECOVERED_SUCCESSFULLY, NOTIFY_WORKSPACE_RESET_SUCCESSFUL_ALL_CACHE_CLE, notifyXAttachedFileSMissingUploadViaKb } from "@/lib/notify-messages";
import {
  loadApiKey,
  saveApiKey,
  GenerationResult,
} from "../lib/api";
import { useBlueprintManagement, BlueprintData } from "../hooks/use-blueprint-management";
import { useFlowFreeformGeneration } from "../hooks/use-flow-freeform-generation";
import { flowFreeformSectionsToAgents } from "@/lib/flow-freeform/flow-freeform-types";
import type { FlowFreeformClarifyQuestion, FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";
import { ManagerWorkspace } from "@/components/manager/ManagerWorkspace";
import type { WordPressSite } from "@/components/integrations/types";
import type { GeneratorFreeFlowBindings } from "@/components/generator/generator-free-flow-bindings";
import { FlowbieAppBrand } from "@/components/manager/FlowbieAppBrand";
import { ManagerAppFooter } from "@/components/manager/ManagerAppFooter";
import {
  readStoredManagerSettingsCluster,
  writeStoredManagerSettingsCluster,
  type ManagerSettingsClusterId,
} from "@/components/manager/manager-settings-cluster";
import { reassembleChunkedFiles } from "../lib/utils";
import { DEFAULT_THEME_PRIMARY_HEX } from "../lib/theme-defaults";
import { StoredFile } from "../components/KnowledgeBaseTab";
import { useAutosave, loadDraft, clearDraft, hasDraft } from "../hooks/use-autosave";
import { applyPrimaryHexToDocument, initPrimaryColorFromStorage } from "../hooks/use-persisted-color";
import { CONTENT_OPTIMIZER_SECTION_STORAGE_KEY } from "@/components/content-optimizer/content-optimizer-sections";
import {
  BLOG_GENERATOR_SECTION_STORAGE_KEY,
  type BlogGeneratorSectionId,
  writeStoredBlogGeneratorSection,
} from "@/components/blog-generator/blog-generator-sections";
import {
  writeStoredResearchSection,
  isLegacyResearchManagerTab,
  normalizeLegacyResearchSection,
  LEGACY_SITEMAP_RESEARCH_SECTION_ID,
} from "@/components/research/research-workspace-sections";
import { writeStoredSitemapOptimizerSection } from "@/components/research/sitemap-optimizer/sitemap-optimizer-sections";
import { DraftRecoveryDialog } from "../components/DraftRecoveryDialog";
import { useGenerationProgress } from "../hooks/use-generation-progress";
import { GenerationProgress } from "../components/GenerationProgress";
// Import to ensure NAP auto-trigger initializes on page load
import "@/lib/knowledge-graph-auto-trigger";
import {
  FLOWBIE_LLM_MAX_TOKENS_KEY,
  FLOWBIE_LLM_MODEL_KEY,
  FLOWBIE_LLM_TEMPERATURE_KEY,
  FLOWBIE_LLM_TOP_P_KEY,
  readStoredLlmModelForIndex,
  readStoredLlmNumberForIndex,
} from "@/lib/manager-cloud-settings-snapshot";
import { FLOWBIE_OPEN_MASTER_RULES_EVENT } from "@/lib/open-master-rules-settings";
import { isApiTabHash } from "@/lib/api-docs/api-docs-hash";

const OPENROUTER_API_KEY_STORAGE_KEY = "openrouter-api-key";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 1.57;
// Keep this comfortably under typical OpenRouter/model context limits
const DEFAULT_MAX_TOKENS = 5000000;
const DEFAULT_TOP_P = 0.90;

const INITIAL_GENERATION_RESULT: GenerationResult = {
  plan: "",
  draft: "",
  final: "",
  currentStage: "idle",
  isGenerating: false,
  planApproved: undefined,
};

const LEGACY_WORKSPACE_STORAGE_KEY = "flowbie-workspace";
const MANAGER_TAB_STORAGE_KEY = "flowbie-manager-tab";

const VALID_MANAGER_TABS = new Set([
  "integrations",
  "knowledge",
  "generator",
  "dashboard",
  "free-flow",
  "content-optimizer",
  "communication",
  "chat",
  "tasks",
  "research",
  "gsc-reporting",
  "sitemap-optimizer",
  "grid-local",
  "gbp-post",
  "vertical-benchmarks",
  "ppc-google",
  "api",
  /** Legacy tab ids (hash / stored); normalized to `generator` at runtime */
  "blog-generator",
  "sap-generator",
]);

function redirectContentOptimizerToGeneratorOpt(): "generator" {
  try {
    writeStoredBlogGeneratorSection("opt");
    sessionStorage.setItem(CONTENT_OPTIMIZER_SECTION_STORAGE_KEY, "content");
    localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
  } catch {
    /* ignore */
  }
  return "generator";
}

function redirectPressReleaseTabToGenerator(): "generator" {
  try {
    writeStoredBlogGeneratorSection("bulk-press-release");
    localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
  } catch {
    /* ignore */
  }
  return "generator";
}

function normalizeLegacyGeneratorTab(tab: string): string {
  if (tab === "content-optimizer") {
    return redirectContentOptimizerToGeneratorOpt();
  }
  if (tab === "blog-generator" || tab === "keyword-research" || tab === "bulk-blog-generation" || tab === "auto-blog-generate") {
    return "generator";
  }
  if (tab === "sap-generator") {
    try {
      writeStoredBlogGeneratorSection("entity");
    } catch {
      /* ignore */
    }
    return "generator";
  }
  if (tab === "free-flow") {
    try {
      writeStoredBlogGeneratorSection("flow");
    } catch {
      /* ignore */
    }
    return "generator";
  }
  if (tab === "api-docs") {
    return "api";
  }
  return tab;
}

const Index = () => {
  const [apiKey, setApiKey] = useState<string>(loadApiKey());
  // const [showApiDialog, setShowApiDialog] = useState(false); // Removed
  // const [showKnowledgeBase, setShowKnowledgeBase] = useState(false); // Removed
  const [managerTab, setManagerTab] = useState<string>(() => {
    try {
      const hashTab = window.location.hash.replace(/^#/, "").trim();
      if (isApiTabHash(hashTab)) {
        return "api";
      }
      if (hashTab === "settings") {
        return "dashboard";
      }
      if (hashTab === "press-release-generator") {
        return redirectPressReleaseTabToGenerator();
      }
      if (hashTab === "url-optimizer") {
        try {
          writeStoredSitemapOptimizerSection("url_optimizer");
        } catch {
          /* ignore */
        }
        return "sitemap-optimizer";
      }
      if (hashTab && VALID_MANAGER_TABS.has(hashTab)) {
        return normalizeLegacyGeneratorTab(hashTab);
      }
      const t = localStorage.getItem(MANAGER_TAB_STORAGE_KEY);
      if (t === "keyword-research") return "generator";
      if (t === "press-release" || t === "press-release-generator") {
        return redirectPressReleaseTabToGenerator();
      }
      try {
        const blogSection = sessionStorage.getItem(BLOG_GENERATOR_SECTION_STORAGE_KEY);
        if (blogSection === "press-release") {
          writeStoredBlogGeneratorSection("bulk-press-release");
          try {
            localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
          } catch {
            /* ignore */
          }
          return "generator";
        }
      } catch {
        /* ignore */
      }
      if (t === "knowledge-graph") return "integrations";
      if (t === "inspect-blueprint") {
        try {
          writeStoredBlogGeneratorSection("flow");
        } catch {
          /* ignore */
        }
        return "generator";
      }
      if (t === "elementor-optimizer" || t === "overview" || t === "content-optimizer") {
        return redirectContentOptimizerToGeneratorOpt();
      }
      if (t === "bulk-blog-generation") {
        try {
          writeStoredBlogGeneratorSection("bulk-csv");
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
        } catch {
          /* ignore */
        }
        return "generator";
      }
      if (t === "auto-blog-generate") {
        try {
          writeStoredBlogGeneratorSection("bulk-csv");
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
        } catch {
          /* ignore */
        }
        return "generator";
      }
      if (t === "settings") {
        try {
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "dashboard");
        } catch {
          /* ignore */
        }
        return "dashboard";
      }
      if (t === "communication-activity") {
        try {
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "integrations");
        } catch {
          /* ignore */
        }
        return "integrations";
      }
      if (t === LEGACY_SITEMAP_RESEARCH_SECTION_ID) {
        try {
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "sitemap-optimizer");
        } catch {
          /* ignore */
        }
        return "sitemap-optimizer";
      }
      if (t === "url-optimizer") {
        try {
          writeStoredSitemapOptimizerSection("url_optimizer");
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "sitemap-optimizer");
        } catch {
          /* ignore */
        }
        return "sitemap-optimizer";
      }
      if (t && isLegacyResearchManagerTab(t)) {
        try {
          writeStoredResearchSection(normalizeLegacyResearchSection(t));
          localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "research");
        } catch {
          /* ignore */
        }
        return "research";
      }
      if (t === "api-docs") return "api";
      if (t && VALID_MANAGER_TABS.has(t)) return normalizeLegacyGeneratorTab(t);
      const w = localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
      if (w === "freeflow") {
        localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
        try {
          writeStoredBlogGeneratorSection("flow");
        } catch {
          /* ignore */
        }
        return "generator";
      }
    } catch {
      /* ignore */
    }
    return "integrations";
  });

  const [managerDashboardCluster, setManagerDashboardCluster] = useState<ManagerSettingsClusterId>(() =>
    readStoredManagerSettingsCluster(),
  );

  const handleManagerDashboardClusterChange = useCallback((id: ManagerSettingsClusterId) => {
    setManagerDashboardCluster(id);
    writeStoredManagerSettingsCluster(id);
  }, []);

  useEffect(() => {
    const onOpenMasterRules = () => {
      setManagerTab("dashboard");
      handleManagerDashboardClusterChange("master-rules");
    };
    window.addEventListener(FLOWBIE_OPEN_MASTER_RULES_EVENT, onOpenMasterRules as EventListener);
    return () => {
      window.removeEventListener(FLOWBIE_OPEN_MASTER_RULES_EVENT, onOpenMasterRules as EventListener);
    };
  }, [handleManagerDashboardClusterChange]);

  /** Remount BlogGeneratorShell when mega menu changes blog section while already on blog-generator */
  const [blogGeneratorShellKey, setBlogGeneratorShellKey] = useState(0);

  const handleManagerTabChange = useCallback(
    (tab: string) => {
      const normalized = normalizeLegacyGeneratorTab(tab);
      if (normalized === "generator") {
        const alreadyOnGenerator = managerTab === "generator";
        setManagerTab("generator");
        if (alreadyOnGenerator) setBlogGeneratorShellKey((k) => k + 1);
      } else {
        setManagerTab(normalized);
      }
      try {
        let hash: string;
        if (normalized === "dashboard") {
          hash = "settings";
        } else if (normalized === "api") {
          const current = window.location.hash.replace(/^#/, "").trim();
          hash = current.startsWith("api") ? current : "api";
        } else {
          hash = normalized;
        }
        if (window.location.hash.replace(/^#/, "") !== hash) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
        }
      } catch {
        /* ignore */
      }
    },
    [managerTab]
  );

  const handleNavigateToSapGenerator = useCallback(
    (_site: WordPressSite, _sitemapUrl: string) => {
      try {
        writeStoredBlogGeneratorSection("entity");
      } catch {
        /* ignore */
      }
      setManagerTab("generator");
      setBlogGeneratorShellKey((k) => k + 1);
      try {
        if (window.location.hash.replace(/^#/, "") !== "generator") {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#generator`);
        }
        localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
      } catch {
        /* ignore */
      }
    },
    []
  );

  const navigateToGeneratorSection = useCallback(
    (section: BlogGeneratorSectionId) => {
      try {
        writeStoredBlogGeneratorSection(section);
        localStorage.setItem(MANAGER_TAB_STORAGE_KEY, "generator");
      } catch {
        /* ignore */
      }
      const alreadyOnGenerator = managerTab === "generator";
      setManagerTab("generator");
      if (alreadyOnGenerator) setBlogGeneratorShellKey((k) => k + 1);
      try {
        if (window.location.hash.replace(/^#/, "") !== "generator") {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#generator`);
        }
      } catch {
        /* ignore */
      }
    },
    [managerTab],
  );

  const [knowledgeFiles, setKnowledgeFiles] = useState<StoredFile[]>([]);
  const [manualKnowledgeText, setManualKnowledgeText] = useState(""); // Manual from KB profiles
  const [activeKnowledgeBaseText, setActiveKnowledgeBaseText] = useState(""); // Combined for RAG
  const [flowTitle, setFlowTitle] = useState("");
  const [flowFreeformUserPrompt, setFlowFreeformUserPrompt] = useState("");
  const [flowFreeformClarificationAnswers, setFlowFreeformClarificationAnswers] = useState<Record<string, string>>({});
  const [flowFreeformSections, setFlowFreeformSections] = useState<FlowFreeformSectionPlan[]>([]);
  const [flowFreeformClarifyQuestions, setFlowFreeformClarifyQuestions] = useState<FlowFreeformClarifyQuestion[] | null>(null);
  const [flowSectionBodies, setFlowSectionBodies] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState(() => readStoredLlmModelForIndex(DEFAULT_MODEL));
  const [temperature, setTemperature] = useState(() =>
    readStoredLlmNumberForIndex(FLOWBIE_LLM_TEMPERATURE_KEY, DEFAULT_TEMPERATURE),
  );
  const [maxTokens, setMaxTokens] = useState(() =>
    readStoredLlmNumberForIndex(FLOWBIE_LLM_MAX_TOKENS_KEY, DEFAULT_MAX_TOKENS),
  );
  const [topP, setTopP] = useState(() => readStoredLlmNumberForIndex(FLOWBIE_LLM_TOP_P_KEY, DEFAULT_TOP_P));
  const agentsForOutput = flowFreeformSectionsToAgents(flowFreeformSections);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [draftToRecover, setDraftToRecover] = useState<ReturnType<typeof loadDraft>>(null);
  // Removed: const [showInspectBlueprint, setShowInspectBlueprint] = useState(false);

  const [generationResult, setGenerationResult] = useState<GenerationResult>(
    INITIAL_GENERATION_RESULT
  );
  const currentAbortController = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // Initialize the color state and set the CSS variable globally

  const handleResetBlueprint = () => {
    setFlowTitle("");
    setFlowFreeformUserPrompt("");
    setFlowFreeformClarificationAnswers({});
    setFlowFreeformSections([]);
    setFlowFreeformClarifyQuestions(null);
    setFlowSectionBodies({});

    setGenerationResult(INITIAL_GENERATION_RESULT);
    setIsGenerating(false);

    notify.success(NOTIFY_BLUEPRINT_RESET_SUCCESSFUL_READY_FOR_A_N);
  };

  const handleResetWorkspace = () => {
    // Clear all AI-related cache from localStorage
    localStorage.removeItem("kb_files");
    localStorage.removeItem("kb_profiles");
    localStorage.removeItem("primaryColor");
    
    // Reset core state
    setFlowTitle("");
    setFlowFreeformUserPrompt("");
    setFlowFreeformClarificationAnswers({});
    setFlowFreeformSections([]);
    setFlowFreeformClarifyQuestions(null);
    setFlowSectionBodies({});

    // Reset Knowledge Base state
    setKnowledgeFiles([]);
    setManualKnowledgeText("");
    setActiveKnowledgeBaseText("");

    // Reset LLM parameters to default
    setSelectedModel(DEFAULT_MODEL);
    setTemperature(DEFAULT_TEMPERATURE);
    setMaxTokens(DEFAULT_MAX_TOKENS);
    setTopP(DEFAULT_TOP_P);

    // Reset Generation state
    setGenerationResult(INITIAL_GENERATION_RESULT);
    setIsGenerating(false);

    // Reset API key state (keeps loaded key from local storage)
    setApiKey(loadApiKey());

    applyPrimaryHexToDocument(DEFAULT_THEME_PRIMARY_HEX);

    notify.success(NOTIFY_WORKSPACE_RESET_SUCCESSFUL_ALL_CACHE_CLE);
  };

  const {
    generateBlueprint,
  } = useBlueprintManagement({
    flowTitle,
    knowledgeFiles,
    activeKnowledgeBaseText: manualKnowledgeText,
    flowFreeformUserPrompt,
    flowFreeformClarificationAnswers,
    flowFreeformSections,
    setFlowTitle,
    setKnowledgeFiles,
    setActiveKnowledgeBaseText: setManualKnowledgeText,
    setFlowFreeformUserPrompt,
    setFlowFreeformClarificationAnswers,
    setFlowFreeformSections,
  });

  useLayoutEffect(() => {
    initPrimaryColorFromStorage();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FLOWBIE_LLM_MODEL_KEY, selectedModel);
      localStorage.setItem(FLOWBIE_LLM_TEMPERATURE_KEY, String(temperature));
      localStorage.setItem(FLOWBIE_LLM_MAX_TOKENS_KEY, String(maxTokens));
      localStorage.setItem(FLOWBIE_LLM_TOP_P_KEY, String(topP));
    } catch {
      /* ignore */
    }
  }, [selectedModel, temperature, maxTokens, topP]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("workspace") === "freeflow") {
      navigateToGeneratorSection("flow");
    }
  }, [navigateToGeneratorSection]);

  useEffect(() => {
    try {
      localStorage.setItem(MANAGER_TAB_STORAGE_KEY, managerTab);
    } catch {
      /* ignore */
    }
  }, [managerTab]);

  // Load knowledge base files from localStorage on mount and when updated externally
  useEffect(() => {
const loadKBFiles = () => {
      try {
        const storedFilesString = localStorage.getItem('kb_files') || '[]';
        const storedFiles = JSON.parse(storedFilesString) as StoredFile[];
        setKnowledgeFiles(storedFiles);
} catch (error) {
        console.error('Error loading knowledge base files:', error);
}
    };

    // Load on mount
    loadKBFiles();

    // Listen for custom event when files are added from IntegrationsTab or other components
    const handleKBFilesUpdate = (e: CustomEvent) => {
      if (e.detail?.files) {
        setKnowledgeFiles(e.detail.files);
      } else {
        // If no files in event, reload from localStorage
        loadKBFiles();
      }
    };

    // Listen for storage events (from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kb_files' && e.newValue) {
        try {
          const storedFiles = JSON.parse(e.newValue) as StoredFile[];
          setKnowledgeFiles(storedFiles);
        } catch (error) {
          console.error('Error parsing files from storage event:', error);
        }
      }
    };

    window.addEventListener('kb-files-updated', handleKBFilesUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('kb-files-updated', handleKBFilesUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useAutosave({
    flowTitle,
    draftStructureKey: flowFreeformSections.length,
    knowledgeFiles,
    activeKnowledgeBaseText: manualKnowledgeText,
    generateBlueprint,
    enabled: !isGenerating,
  });

  useEffect(() => {
    if (hasDraft() && flowFreeformSections.length === 0) {
      const draft = loadDraft();
      if (draft) {
        const secCount = draft.blueprint?.flowFreeform?.sections?.length ?? 0;
        if (secCount > 0 || (draft.blueprint?.flowFreeform?.userPrompt?.trim()?.length ?? 0) > 0) {
          setDraftToRecover(draft);
          setShowDraftRecovery(true);
        } else {
          clearDraft();
        }
      }
    }
  }, []);

  // Combine manual + files for full RAG (triggers on load after setKnowledgeFiles + setManualKnowledgeText(''))
  useEffect(() => {
    // Use the reassembly function to correctly group and order file contents before joining
    const fileContents = reassembleChunkedFiles(knowledgeFiles);
    const combined = [manualKnowledgeText, fileContents].filter(Boolean).join('\n\n---\n\n');
    setActiveKnowledgeBaseText(combined); // On load: '' + file contents = files for RAG
  }, [manualKnowledgeText, knowledgeFiles]);

  const flowFreeformGen = useFlowFreeformGeneration({
    apiKey,
    selectedModel,
    flowTitle,
    flowPurpose: "",
    activeKnowledgeBaseText,
    userGoalPrompt: flowFreeformUserPrompt,
    clarificationAnswers: flowFreeformClarificationAnswers,
    setFlowTitle,
    setUserGoalPrompt: setFlowFreeformUserPrompt,
    setClarificationQuestions: setFlowFreeformClarifyQuestions,
    setSections: setFlowFreeformSections,
    setSectionBodies: setFlowSectionBodies,
    currentAbortController,
    setIsGenerating,
    setGenerationResult,
  });

  // Generation progress tracking
  const progressMetrics = useGenerationProgress({
    currentStage: generationResult.currentStage,
    isGenerating,
  });

  const handleRecoverDraft = useCallback(() => {
    if (!draftToRecover) return;

    const { blueprint } = draftToRecover;

    if (!blueprint || blueprint.blueprintVersion !== 2 || !blueprint.flowFreeform) {
      notify.error(NOTIFY_DRAFT_IS_INVALID_OR_USES_A_RETIRED_FORMA);
      clearDraft();
      setShowDraftRecovery(false);
      setDraftToRecover(null);
      return;
    }

    const recoveredBlueprint = blueprint as BlueprintData;

    const storedFilesString = localStorage.getItem("kb_files") || "[]";
    const storedFiles = JSON.parse(storedFilesString) as StoredFile[];
    const blueprintRefs = recoveredBlueprint.knowledgeFiles || [];
    let missingFiles = 0;
    const matchedFiles = blueprintRefs.map((ref) => {
      const stored = storedFiles.find((f) => f.name === ref.name);
      if (!stored) {
        missingFiles++;
        return { ...ref, content: "" };
      }
      return stored;
    });
    setKnowledgeFiles(matchedFiles);

    if (missingFiles > 0) {
      notify.warning(notifyXAttachedFileSMissingUploadViaKb(missingFiles));
    }

    const fileContents = matchedFiles.map((f) => f.content).filter(Boolean).join("\n\n---\n\n");
    setActiveKnowledgeBaseText(fileContents);

    setFlowTitle(recoveredBlueprint.title || "");
    setFlowFreeformUserPrompt(recoveredBlueprint.flowFreeform.userPrompt || "");
    setFlowFreeformClarificationAnswers(recoveredBlueprint.flowFreeform.clarificationAnswers || {});
    setFlowFreeformSections(recoveredBlueprint.flowFreeform.sections || []);

    clearDraft();
    setShowDraftRecovery(false);
    setDraftToRecover(null);
    navigateToGeneratorSection("flow");
    notify.success(NOTIFY_DRAFT_RECOVERED_SUCCESSFULLY);
  }, [draftToRecover, setKnowledgeFiles, setActiveKnowledgeBaseText, setFlowTitle, navigateToGeneratorSection]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftRecovery(false);
    setDraftToRecover(null);
  }, []);

  // This useEffect is now redundant and removed since KnowledgeBaseManager handles combination
  // and processImportedBlueprint (in use-blueprint-management.ts) sets activeKnowledgeBaseText directly.
try {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Draft Recovery Dialog */}
      <DraftRecoveryDialog
        open={showDraftRecovery}
        draft={draftToRecover}
        onRecover={handleRecoverDraft}
        onDiscard={handleDiscardDraft}
      />

      <ManagerWorkspace
        variant="embedded"
        embeddedTopBarStart={
          <FlowbieAppBrand
            variant="compact"
            showVersion
            onClick={() => {
              writeStoredManagerSettingsCluster("properties");
              setManagerDashboardCluster("properties");
              handleManagerTabChange("dashboard");
            }}
          />
        }
        embeddedFooter={
          <ManagerAppFooter
            currentTab={managerTab}
            onTabChange={handleManagerTabChange}
            onDashboardBrandClick={() => {
              writeStoredManagerSettingsCluster("properties");
              setManagerDashboardCluster("properties");
              handleManagerTabChange("dashboard");
            }}
          />
        }
        embeddedTopBarProgress={
          isGenerating && !flowFreeformGen.isClarifying ? (
            <GenerationProgress progress={progressMetrics} compact />
          ) : undefined
        }
        onResetBlueprint={handleResetBlueprint}
        onResetWorkspace={handleResetWorkspace}
        managerTab={managerTab}
        onManagerTabChange={handleManagerTabChange}
        onNavigateToSapGenerator={handleNavigateToSapGenerator}
        managerDashboardCluster={managerDashboardCluster}
        onManagerDashboardClusterChange={handleManagerDashboardClusterChange}
        blogGeneratorShellKey={blogGeneratorShellKey}
        currentKBFiles={knowledgeFiles}
        onFilesUpdate={setKnowledgeFiles}
        onManualContentUpdate={setManualKnowledgeText}
        apiKey={apiKey}
        setApiKey={setApiKey}
        saveApiKey={saveApiKey}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        topP={topP}
        setTopP={setTopP}
        flowPurpose=""
        freeFlowBindings={{
          flowTitle,
          setFlowTitle,
          apiKey,
          agents: agentsForOutput,
          selectedModel,
          temperature,
          maxTokens,
          topP,
          activeKnowledgeBaseText,
          userGoalPrompt: flowFreeformUserPrompt,
          onUserGoalPromptChange: setFlowFreeformUserPrompt,
          clarificationQuestions: flowFreeformClarifyQuestions,
          clarificationAnswers: flowFreeformClarificationAnswers,
          onClarificationAnswersChange: setFlowFreeformClarificationAnswers,
          flowSections: flowFreeformSections,
          setFlowSections: setFlowFreeformSections,
          isGenerating: isGenerating || flowFreeformGen.isClarifying,
          generationResult,
          onAbort: flowFreeformGen.handleAbort,
          onRunClarify: () => void flowFreeformGen.runClarifyOnly(),
          onEnhancePromptAuto: () => flowFreeformGen.runEnhanceGoalPrompt({ silent: true }),
          onRunOutline: () => void flowFreeformGen.runOutlineOnly(),
          onRunFullReport: () => void flowFreeformGen.runFullPipeline(),
          onRunAllSections: () => void flowFreeformGen.runAllSections(flowFreeformSections),
          onRebuildSection: (plan) => void flowFreeformGen.rebuildOneSection(plan, flowFreeformSections),
          onRebuildAll: () => void flowFreeformGen.rebuildAllSections(flowFreeformSections),
          setGenerationResult,
        } satisfies GeneratorFreeFlowBindings}
      />
      </div>
    );
  } catch (error) {
throw error;
  }
};

export default Index;

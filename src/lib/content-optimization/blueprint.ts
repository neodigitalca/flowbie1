import { notify } from "@/lib/app-notifications";
import { NOTIFY_GENERATING_OPTIMIZED_BLUEPRINT_THIS_STEP, notifyBlueprintCreatedXSectionsStartingCo, notifyChecklistCreatedXItemsBuildingBluep } from "@/lib/notify-messages";
import { getMuteOptimizationToasts } from "@/hooks/content-optimization/optimization-toast-mute";
import { loadApiKey } from "@/lib/api";
import { generateChecklistFromSelections } from "@/lib/blog-template-builder";
import { generateBlueprintFromTemplate, type BlogTemplateContext } from "@/lib/blog-template-builder";
import type { KeywordData } from "@/lib/keyword-types";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import type { WordPressSite } from "@/components/integrations/types";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { truncateTitleForSEO } from "@/lib/content-generation/content-sanitizer";
import { extractGeographicEntityWithAI } from "./entity";
import { cleanTitleForNonEntity } from "./title-cleaning";
import { analyzeEntityWithAI } from "./keyword-research";
import type { SemrushClusterScatterPlan } from "@/lib/semrush-cluster-scatter";
import { buildSemrushScatterContextJson } from "@/lib/semrush-cluster-scatter";
import { extractMediaFromContent } from "./images-extract";
import {
  buildForcedMediaUserPrompt,
  mergeForcedMediaIntoChecklist,
} from "./media-checklist-force";

export async function generateOptimizedBlueprint(
  selectedKeywords: string[],
  selectedH2Sections: string[],
  selectedPeopleAlsoAsk: string[],
  selectedResearchLinks: string[],
  existingTitle: string,
  primaryKeyword: string,
  primaryKeywordData: KeywordData,
  paaRawResponse: any,
  site: WordPressSite,
  fileManager: OptimizationFileManager,
  setProgress: (progress: { step: string; progress: number; message?: string }) => void,
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  wordPressPagesForOfferTable?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  currentPageUrl?: string,
  existingPost?: any,
  hasEntityOverride?: boolean,
  semrushForBlueprint?: {
    keywordsRag?: string;
    clusterScatter?: SemrushClusterScatterPlan;
    externalUrls?: string[];
    anchorPhrases?: string[];
  },
  /** Original post HTML — used to force existing image/video URLs into checklist + blueprint. */
  existingContent?: string,
): Promise<{ blueprintResult: any; checklist: string[] }> {
  const openRouterApiKey = loadApiKey();
  if (!openRouterApiKey?.trim()) throw new Error("OpenRouter API key not found. Please set it in settings.");

  if (!getMuteOptimizationToasts()) notify.info(NOTIFY_GENERATING_OPTIMIZED_BLUEPRINT_THIS_STEP);
  setProgress({ step: "Generating optimized blueprint...", progress: 60, message: "Extracting and analyzing entity from title/origin..." });

  let extractedEntity: string | undefined;
  let entityAnalysis: string | undefined;

  try {
    const slug = currentPageUrl
      ? (() => {
          try {
            const p = new URL(currentPageUrl).pathname.split("/").filter(Boolean);
            return p[p.length - 1] ?? "";
          } catch {
            return "";
          }
        })()
      : "";

    const origin = await extractGeographicEntityWithAI(
      { title: existingTitle, url: currentPageUrl, excerpt: existingPost?.excerpt, slug: slug || undefined },
      openRouterApiKey,
      {
        siteUrl: site.siteUrl,
        siteName: site.name,
        locations: site.locations,
        napAddress: site.napInfo?.address,
      }
    );
    if (origin?.trim()) {
      extractedEntity = origin.trim();
      console.log("[Optimize Content] Extracted entity (agentic AI):", extractedEntity);
    }

    if (hasEntityOverride === false) {
      extractedEntity = "N/A";
      console.log("[Optimize Content] Entity mode MANUALLY DISABLED by user - treating as regular blog post");
    } else if (hasEntityOverride === true && !extractedEntity?.trim()) {
      extractedEntity = existingTitle || primaryKeyword;
      console.log("[Optimize Content] Entity mode MANUALLY ENABLED by user, using title as entity:", extractedEntity);
    } else if (!extractedEntity?.trim()) {
      extractedEntity = "N/A";
      console.log("[Optimize Content] No entity found in post - treating as regular blog post (N/A)");
    }

    if (extractedEntity && extractedEntity !== "N/A" && extractedEntity.trim()) {
      setProgress({ step: "Generating optimized blueprint...", progress: 62, message: `Analyzing entity "${extractedEntity}" with AI...` });
      entityAnalysis = await analyzeEntityWithAI(extractedEntity, openRouterApiKey, undefined);
      if (entityAnalysis) console.log("[Optimize Content] Entity analysis complete:", entityAnalysis.substring(0, 100) + "...");
    }
  } catch (error) {
    console.warn("[Optimize Content] Error during entity extraction/analysis:", error);
    if (hasEntityOverride === false) extractedEntity = "N/A";
  }

  setProgress({ step: "Generating optimized blueprint...", progress: 65, message: "From keywords and H2 sections" });
  const researchModel = getResearchModel(site.id);

  const bodyHtml =
    (typeof existingContent === "string" && existingContent.trim()) ||
    (typeof existingPost?.content === "string" ? existingPost.content : "") ||
    "";
  let existingMedia: Awaited<ReturnType<typeof extractMediaFromContent>> = [];
  if (bodyHtml.trim()) {
    setProgress({
      step: "Generating optimized blueprint...",
      progress: 64,
      message: "Reading existing image/video URLs for checklist…",
    });
    existingMedia = await extractMediaFromContent(bodyHtml, openRouterApiKey, researchModel);
  }
  const forcedMediaPrompt = buildForcedMediaUserPrompt(existingMedia);

  const semrushScatterStr = buildSemrushScatterContextJson(semrushForBlueprint?.clusterScatter);
  const semrushKeywordsCtx =
    semrushForBlueprint?.keywordsRag && semrushForBlueprint.keywordsRag.trim().length > 0
      ? semrushForBlueprint.keywordsRag
      : undefined;

  let checklist = await generateChecklistFromSelections(
    selectedKeywords,
    selectedH2Sections,
    existingTitle || primaryKeyword,
    primaryKeywordData,
    {
      apiKey: openRouterApiKey,
      model: researchModel,
      temperature: 1.0,
      maxTokens: 4000,
      topP: 0.9,
      serpData: paaRawResponse,
      selectedPeopleAlsoAsk,
      selectedResearchLinks,
      connectedSite: { name: site.name, siteUrl: site.siteUrl },
      wordPressPosts,
      wordPressPagesForOfferTable,
      currentPageUrl,
      entity: extractedEntity === "N/A" ? undefined : extractedEntity,
      entityAnalysis: extractedEntity === "N/A" ? undefined : entityAnalysis,
      runExternalResearch: true,
      locationName: "United States",
      languageCode: "en",
      siteId: site.id,
      primaryKeyword,
      setProgress,
      semrushKeywordsContext: semrushKeywordsCtx,
      semrushScatterContext: semrushScatterStr,
      semrushApprovedExternalUrls: semrushForBlueprint?.externalUrls,
      semrushAnchorPhrases: semrushForBlueprint?.anchorPhrases,
      ...(forcedMediaPrompt ? { userPrompt: forcedMediaPrompt } : {}),
    } as any
  );

  if (!checklist.length) throw new Error("Failed to generate checklist");

  checklist = mergeForcedMediaIntoChecklist(checklist, existingMedia);

  const checklistFileName = OptimizationFileManager.generateFilename("checklist", primaryKeyword, "txt");
  fileManager.addFile(
    checklistFileName,
    checklist.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "text/plain"
  );

  if (!getMuteOptimizationToasts()) notify.success(notifyChecklistCreatedXItemsBuildingBluep(checklist.length), { duration: 4000 });
  setProgress({ step: "Generating optimized blueprint...", progress: 70, message: "Converting checklist to blueprint structure..." });

  const blueprintContext: BlogTemplateContext = {
    flowTitle: existingTitle || primaryKeyword,
    flowPurpose: `Comprehensive guide about ${primaryKeyword}`,
    keywordData: primaryKeywordData,
    ...(forcedMediaPrompt ? { userPrompt: forcedMediaPrompt } : {}),
  };

  const entityForTemplate = extractedEntity === "N/A" ? undefined : extractedEntity;
  const blueprintResult = await generateBlueprintFromTemplate(checklist, blueprintContext, {
    apiKey: openRouterApiKey,
    model: researchModel,
    temperature: 1.0,
    maxTokens: 8000,
    topP: 0.9,
    connectedSite: { name: site.name, siteUrl: site.siteUrl },
    wordPressPosts,
    currentPageUrl,
    siteId: site.id,
    primaryKeyword,
    entity: entityForTemplate,
    semrushKeywordsContext: semrushKeywordsCtx,
    semrushScatterContext: semrushScatterStr,
    semrushApprovedExternalUrls: semrushForBlueprint?.externalUrls,
    semrushAnchorPhrases: semrushForBlueprint?.anchorPhrases,
    ...(forcedMediaPrompt ? { userPrompt: forcedMediaPrompt } : {}),
  } as any);

  if (!blueprintResult.agents?.length) throw new Error("Failed to generate blueprint");

  const entityForBlueprint = extractedEntity === "N/A" ? undefined : extractedEntity;
  (blueprintResult as any).entity = entityForBlueprint;
  (blueprintResult as any).entityAnalysis = entityForBlueprint ? entityAnalysis : undefined;

  if (extractedEntity === "N/A" && blueprintResult.title) {
    const cleaned = cleanTitleForNonEntity(blueprintResult.title, extractedEntity);
    if (cleaned !== blueprintResult.title) {
      console.log("[Optimize Content] Cleaned location mentions from blueprint title:", { original: blueprintResult.title, cleaned, entity: extractedEntity });
      blueprintResult.title = cleaned;
    }
  }

  // Entity page: enforce "near" in title. If AI omitted it, fix it.
  if (entityForBlueprint && blueprintResult.title && !/near\s/i.test(blueprintResult.title)) {
    const keywordOnly = primaryKeyword.replace(/\s+(in|near)\s+.*$/i, '').trim();
    const fixedTitle = `${keywordOnly} Near ${entityForBlueprint}`.replace(/\s+/g, ' ');
    console.log("[Optimize Content] Blueprint title missing 'near' - enforcing:", { original: blueprintResult.title, fixed: fixedTitle });
    blueprintResult.title = truncateTitleForSEO(fixedTitle, 50);
  }

  if (blueprintResult.title) {
    const originalLength = blueprintResult.title.length;
    blueprintResult.title = truncateTitleForSEO(blueprintResult.title, 50);
    if (originalLength > 50) {
      console.log("[Optimize Content] Truncated blueprint title to 50 characters (Content Optimizer module requirement):", {
        originalLength,
        truncatedLength: blueprintResult.title.length,
      });
    }
  }

  console.log("[Optimize Content] Stored entity in blueprint:", {
    hasEntity: !!entityForBlueprint,
    entity: entityForBlueprint || "N/A (regular blog post)",
    blueprintTitle: blueprintResult.title,
  });

  if (!getMuteOptimizationToasts()) notify.success(notifyBlueprintCreatedXSectionsStartingCo(blueprintResult.agents.length), { duration: 4000 });

  const blueprintFileName = OptimizationFileManager.generateFilename("blueprint", primaryKeyword, "json");
  fileManager.addFile(blueprintFileName, JSON.stringify(blueprintResult, null, 2), "application/json");

  return { blueprintResult, checklist };
}

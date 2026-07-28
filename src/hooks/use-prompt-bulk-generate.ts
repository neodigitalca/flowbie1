import { useState, useCallback, useRef, useEffect } from 'react';
import { notify } from "@/lib/app-notifications";
import { NOTIFY_ALL_BLOG_IDEAS_ARE_ALREADY_SELECTED_PLEA, NOTIFY_COULD_NOT_PARSE_BLOG_IDEAS_FROM_THE_RESP, NOTIFY_FAILED_TO_GENERATE_CHECKLIST_PLEASE_TRY_, NOTIFY_FETCHING_FULL_WORDPRESS_INVENTORY_POSTS_, NOTIFY_INVALID_TARGET_SITE_EXAMPLE_COM_IS_NOT_A, NOTIFY_KNOWLEDGE_BASE_IS_EMPTY_BLOG_IDEAS_WILL_, NOTIFY_PLEASE_DESELECT_AT_LEAST_ONE_BLOG_IDEA_T, NOTIFY_PLEASE_ENSURE_API_KEYS_ARE_SET, NOTIFY_READING_KNOWLEDGE_BASE, notifyGeneratedXBlogIdeax, notifyRegeneratedXBlogIdeaxKeptXSelected, notifyWordpressSiteNotFoundX } from "@/lib/notify-messages";
import { loadApiKey, streamChatCompletion } from '@/lib/api';
import { buildBulkBlogIdeasSystemPrompt, buildBulkBlogIdeasUserPrompt } from '@/lib/prompt-builders';
import { parseBlogIdeasChecklist, type CSVRow } from '@/lib/bulk-auto-generate';
import { parseTitleTemplate } from '@/lib/title-template-parser';
import type { Message } from '@/lib/api';
import { loadKnowledgeBaseForBulkIdeas } from '@/lib/kb-for-bulk-ideas';
import {
  loadBulkSitemapInventoryForSite,
  revokeBulkSitemapInventoryLinks,
  type LoadBulkSitemapInventoryResult,
} from '@/lib/bulk/bulk-sitemap-inventory-session';
import type { PromptBulkSitemapInventoryBuckets, PromptBulkSitemapInventoryLink } from '@/lib/bulk/prompt-bulk-sitemap-inventory';
import { getStoredSites, type WordPressSite } from '@/components/IntegrationsTab';
import type { ConnectedSiteSummary } from '@/components/integrations/types';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import type { KeywordAIAnalysis } from '@/lib/keyword-types';
import { scrapePromptBulkSiteKwJson, revokePromptBulkSiteKwHostedLink, type PromptBulkSiteKwHostedLink } from '@/lib/bulk/prompt-bulk-site-kw-scrape';
import {
  buildPromptBulkKwConnectedSiteContext,
  selectPromptBulkLowHangingKeywords,
} from '@/lib/bulk/prompt-bulk-kw-research-agent';
import { aiRejectBrandOrBlockedTexts } from '@/lib/content-brand-ai-gate';

export interface UsePromptBulkGenerateProps {
  apiKey?: string;
  openRouterApiKey?: string;
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  flowPurpose?: string;
  // Blog generation settings - count is required; use the amount the user picked (no default/fallback).
  numberOfBlogs: number;
  entityMode?: 'auto' | 'manual' | 'blank';
  entityValue?: string;
  keywordMode?: 'same' | 'per-blog' | 'gsc-keywords';
  keywordValue?: string;
  gscExactKeywords?: string[]; // Exact GSC keywords to use
  optionalPrompt?: string;
  titleTemplate?: string; // Title template with variables like [Entity], [Keyword]
  entityList?: string; // Comma or newline-separated list of entity values
  keywordList?: string; // Comma or newline-separated list of keyword values
  locationList?: string; // Comma or newline-separated list of location values
  numberList?: string; // Comma or newline-separated list of number values
  featuredImagePerBlog?: boolean;
  // Connected WordPress site (for target topic)
  connectedSite?: ConnectedSiteSummary;
  // Progress callback for sub-step tracking
  onProgress?: (step: string, progress: number) => void;
  // Keyword analysis results from Content Optimizer module
  keywordAnalysisResults?: Map<string, KeywordAIAnalysis>;
}

export function usePromptBulkGenerate({
  apiKey,
  openRouterApiKey,
  selectedModel = getResearchModel(),
  temperature = 1.0,
  maxTokens = 4000,
  topP = 0.9,
  flowPurpose,
  numberOfBlogs,
  entityMode = 'blank',
  entityValue = '',
  keywordMode = 'per-blog',
  keywordValue = '',
  optionalPrompt = '',
  titleTemplate = '',
  entityList = '',
  keywordList = '',
  locationList = '',
  numberList = '',
  featuredImagePerBlog = true,
  connectedSite,
  gscExactKeywords = [],
  onProgress,
  keywordAnalysisResults,
}: UsePromptBulkGenerateProps) {
  const [userInput, setUserInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [hasGeneratedChecklist, setHasGeneratedChecklist] = useState(false);
  const [generatedRows, setGeneratedRows] = useState<CSVRow[]>([]);
  const [wordPressPostsMetadata, setWordPressPostsMetadata] = useState<Array<{ id: number; slug: string; title: string; link: string }>>([]);
  const [sitemapInventoryLinks, setSitemapInventoryLinks] = useState<PromptBulkSitemapInventoryLink[]>([]);
  const [siteKwHostedLink, setSiteKwHostedLink] = useState<PromptBulkSiteKwHostedLink | null>(null);
  /** Total URLs sent to AI across Posts + Pages + SAP buckets (null = not yet loaded). */
  const [lastInventorySentToAiCount, setLastInventorySentToAiCount] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sitemapLinksRef = useRef<PromptBulkSitemapInventoryLink[]>([]);
  const siteKwLinkRef = useRef<PromptBulkSiteKwHostedLink | null>(null);

  useEffect(() => {
    return () => {
      revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
      revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
    };
  }, []);

  /**
   * Generate checklist from settings (no user prompt required)
   * @param keepIndices Optional array of indices to keep from existing generatedRows
   */
  const handleGenerateChecklist = useCallback(async (keepIndices?: number[]): Promise<CSVRow[] | undefined> => {
    const effectiveOpenRouterKey = openRouterApiKey?.trim() || loadApiKey()?.trim() || "";
    if (!effectiveOpenRouterKey) {
      notify.error(NOTIFY_PLEASE_ENSURE_API_KEYS_ARE_SET);
      return undefined;
    }

    setIsGeneratingChecklist(true);
    setLastInventorySentToAiCount(null);

    const allSlotKeywords = generatedRows
      .slice(0, numberOfBlogs)
      .map((r) => r.keyword?.trim() ?? "");
    const allSlotModifiers = generatedRows
      .slice(0, numberOfBlogs)
      .map((r) => r.modifier?.trim() ?? "");
    
    // Calculate how many new blogs to generate
    const keptCount = keepIndices ? keepIndices.length : 0;
    const blogsToGenerate = numberOfBlogs - keptCount;

    const slotKeywordsForGeneration =
      keepIndices && keepIndices.length > 0
        ? allSlotKeywords.filter((_, i) => !keepIndices.includes(i))
        : allSlotKeywords.slice(0, blogsToGenerate);

    const slotModifiersForGeneration =
      keepIndices && keepIndices.length > 0
        ? allSlotModifiers.filter((_, i) => !keepIndices.includes(i))
        : allSlotModifiers.slice(0, blogsToGenerate);
    
    if (blogsToGenerate <= 0) {
      notify.error(NOTIFY_ALL_BLOG_IDEAS_ARE_ALREADY_SELECTED_PLEA);
      setIsGeneratingChecklist(false);
      return undefined;
    }
    
    // Build a prompt from the settings
    const userMessage = `Generate ${blogsToGenerate} blog post ideas${optionalPrompt ? ` with the following characteristics: ${optionalPrompt}` : ''}`;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      let siteInventoryBuckets: PromptBulkSitemapInventoryBuckets | undefined;
      let matchedWpSite: WordPressSite | null = null;
      let siteKwJsonText: string | undefined;
      let lowHangingKeywords: string[] = [];

      if (connectedSite) {
        notify.info(NOTIFY_FETCHING_FULL_WORDPRESS_INVENTORY_POSTS_);
        const sites = getStoredSites();

        const normalizeDomain = (url: string): string =>
          url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

        const connectedDomain = normalizeDomain(connectedSite.siteUrl);
        if (connectedDomain === 'example.com' || connectedDomain.endsWith('.example.com')) {
          notify.error(NOTIFY_INVALID_TARGET_SITE_EXAMPLE_COM_IS_NOT_A);
          setIsGeneratingChecklist(false);
          return undefined;
        }

        const wordPressSite = sites.find(s => {
          const normalize = (url: string) => url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
          return normalize(s.siteUrl) === normalize(connectedSite.siteUrl);
        }) ?? null;
        matchedWpSite = wordPressSite;

        if (!wordPressSite) {
          notify.error(notifyWordpressSiteNotFoundX(connectedSite.siteUrl));
          setIsGeneratingChecklist(false);
          return undefined;
        }

        if (!wordPressSite.username?.trim() || !wordPressSite.appPassword?.trim()) {
          notify.error('WordPress username and application password are required to load sitemap inventory for idea generation.');
          setIsGeneratingChecklist(false);
          return undefined;
        }

        onProgress?.('Loading Posts, Pages, and SAP sitemap inventory…', 10);
        const inventory: LoadBulkSitemapInventoryResult = await loadBulkSitemapInventoryForSite(
          wordPressSite,
          (msg) => onProgress?.(msg, 12),
        );

        revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
        sitemapLinksRef.current = inventory.links;
        setSitemapInventoryLinks(inventory.links);
        siteInventoryBuckets = inventory.buckets;
        setLastInventorySentToAiCount(inventory.totalRows);

        setWordPressPostsMetadata(inventory.postsMetadata);

        onProgress?.(
          `Inventory loaded: ${inventory.buckets.posts.rowCount} posts, ${inventory.buckets.pages.rowCount} pages, ${inventory.buckets.sap.rowCount} SAP (${inventory.totalRows} total URLs)`,
          18,
        );

        onProgress?.('Loading GSC and Semrush keywords...', 20);
        const kwScrape = await scrapePromptBulkSiteKwJson(wordPressSite);
        revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
        siteKwLinkRef.current = kwScrape.hostedLink;
        setSiteKwHostedLink(kwScrape.hostedLink);

        const hasSiteKwRows = kwScrape.json.gsc.length > 0 || kwScrape.json.semrush.length > 0;
        if (hasSiteKwRows) {
          siteKwJsonText = kwScrape.keywordsJsonText;
          onProgress?.('Research agent selecting low-hanging keywords...', 24);
          lowHangingKeywords = await selectPromptBulkLowHangingKeywords({
            apiKey: effectiveOpenRouterKey,
            siteId: wordPressSite.id,
            keywordsJsonText: kwScrape.keywordsJsonText,
            numberOfBlogs: blogsToGenerate,
            topic: flowPurpose,
            modifier: optionalPrompt,
            inventoryUrlCount: inventory.totalRows,
            connectedSite: buildPromptBulkKwConnectedSiteContext(wordPressSite),
          });
        }
      } else {
        setWordPressPostsMetadata([]);
        revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
        sitemapLinksRef.current = [];
        setSitemapInventoryLinks([]);
        revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
        siteKwLinkRef.current = null;
        setSiteKwHostedLink(null);
      }

      onProgress?.('Generating blog ideas with AI…', 28);
      const { activeKnowledgeBaseText } = loadKnowledgeBaseForBulkIdeas();
      if (activeKnowledgeBaseText && activeKnowledgeBaseText.trim().length > 0) {
        onProgress?.('📚 Reading knowledge base for ideas...', 24);
        console.log("[Bulk ideas] KB chars:", activeKnowledgeBaseText.length);
        notify.info(NOTIFY_READING_KNOWLEDGE_BASE);
      } else if (!siteInventoryBuckets) {
        notify.warning(NOTIFY_KNOWLEDGE_BASE_IS_EMPTY_BLOG_IDEAS_WILL_);
      }

      const limitedKnowledgeBaseText =
        activeKnowledgeBaseText.length > 5000
          ? `${activeKnowledgeBaseText.substring(0, 5000)}\n\n[Knowledge base truncated for token optimization...]`
          : activeKnowledgeBaseText;

      const effectiveGscKeywords =
        lowHangingKeywords.length > 0
          ? lowHangingKeywords
          : keywordMode === 'gsc-keywords'
            ? gscExactKeywords
            : [];
      const effectiveKeywordMode =
        effectiveGscKeywords.length > 0 ? 'gsc-keywords' : keywordMode;

      const systemPrompt = buildBulkBlogIdeasSystemPrompt(
        flowPurpose || '',
        limitedKnowledgeBaseText,
        blogsToGenerate,
        entityMode,
        entityValue,
        effectiveKeywordMode,
        keywordValue,
        optionalPrompt,
        titleTemplate,
        featuredImagePerBlog,
        connectedSite,
        undefined,
        effectiveGscKeywords.length > 0 ? effectiveGscKeywords : undefined,
        keywordAnalysisResults,
        'content_blog',
        siteInventoryBuckets,
        slotKeywordsForGeneration,
        slotModifiersForGeneration,
      );
      const userPrompt = buildBulkBlogIdeasUserPrompt(
        userMessage,
        blogsToGenerate,
        optionalPrompt,
        undefined,
        effectiveGscKeywords.length > 0 ? effectiveGscKeywords : undefined,
        flowPurpose || undefined,
        'content_blog',
        siteInventoryBuckets,
        siteKwJsonText,
      );

      let inventoryUrlCountForAi: number | null = null;
      if (siteInventoryBuckets) {
        inventoryUrlCountForAi =
          siteInventoryBuckets.posts.rowCount +
          siteInventoryBuckets.pages.rowCount +
          siteInventoryBuckets.sap.rowCount;
      }

      const checklistResearchModel = getResearchModel(matchedWpSite?.id);

      let checklistContent = '';
      try {
        const safeMaxTokens = Math.min(maxTokens || 4000, 16000);

        onProgress?.('🤖 Streaming AI response (research model — blog ideas)...', 35);
        await streamChatCompletion({
          apiKey: effectiveOpenRouterKey,
          model: checklistResearchModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          maxTokens: safeMaxTokens,
          topP,
          onContentChunk: (chunk) => {
            checklistContent += chunk;
            setChatMessages(prev => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content = checklistContent;
              } else {
                newMessages.push({ role: 'assistant', content: checklistContent });
              }
              return newMessages;
            });
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Blog ideas generation error:', error);
        
        // Provide more specific error messages
        if (errorMessage.includes('400') || errorMessage.includes('Request too large')) {
          throw new Error('Request too large. The knowledge base or prompt is too long. Try reducing the knowledge base content or simplifying your prompt.');
        }
        if (errorMessage.includes('401') || errorMessage.includes('Invalid API key')) {
          throw new Error('Invalid OpenRouter API key. Please check your API key in settings.');
        }
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        
        throw new Error(`Failed to generate blog ideas: ${errorMessage}`);
      }

      setLastInventorySentToAiCount(inventoryUrlCountForAi);

      // Parse checklist into CSVRow[]
      const companyNameForGate = connectedSite?.name ?? matchedWpSite?.name ?? null;
      let parsedRows = parseBlogIdeasChecklist(
        checklistContent, 
        titleTemplate,
        entityList,
        keywordList,
        locationList,
        numberList,
        companyNameForGate,
      );

      if (companyNameForGate?.trim() && parsedRows.length > 0) {
        const rejected = await aiRejectBrandOrBlockedTexts({
          apiKey: effectiveOpenRouterKey,
          model: getResearchModel(matchedWpSite?.id),
          companyName: companyNameForGate,
          candidates: parsedRows.flatMap((r) => [r.keyword, r.title].filter(Boolean) as string[]),
          kind: "keyword",
        });
        if (rejected.length > 0) {
          const rejectKeys = new Set(
            rejected.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")),
          );
          parsedRows = parsedRows.filter((r) => {
            const kw = (r.keyword ?? "").trim().toLowerCase().replace(/\s+/g, " ");
            const title = (r.title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
            return !rejectKeys.has(kw) && !rejectKeys.has(title);
          });
        }
      }

      if (parsedRows.length === 0) {
        notify.error(NOTIFY_COULD_NOT_PARSE_BLOG_IDEAS_FROM_THE_RESP);
        setChatMessages(prev => prev.slice(0, -1));
        return undefined;
      }

      const cappedParsedRows = parsedRows.slice(0, blogsToGenerate);

      cappedParsedRows.forEach((row, i) => {
        const slotRow = generatedRows[i];
        const userKw = slotKeywordsForGeneration[i]?.trim();
        if (userKw) row.keyword = userKw;
        const userMod = slotModifiersForGeneration[i]?.trim();
        if (userMod) row.modifier = userMod;
        if (slotRow) {
          if (slotRow.title?.trim()) row.title = slotRow.title.trim();
          if (slotRow.meta_description?.trim()) row.meta_description = slotRow.meta_description.trim();
          if (slotRow.entity?.trim()) row.entity = slotRow.entity.trim();
          if (slotRow.target_slug?.trim()) row.target_slug = slotRow.target_slug.trim();
          if (slotRow.modifier_links_json?.trim()) {
            row.modifier_links_json = slotRow.modifier_links_json.trim();
          }
          if (slotRow.publish_date_gmt?.trim()) row.publish_date_gmt = slotRow.publish_date_gmt.trim();
          if (slotRow.featuredImage?.trim()) row.featuredImage = slotRow.featuredImage.trim();
          if (slotRow.wikipedia_url?.trim()) row.wikipedia_url = slotRow.wikipedia_url.trim();
          if (slotRow.wikipedia_title?.trim()) row.wikipedia_title = slotRow.wikipedia_title.trim();
        }
      });

      // Helper function to parse list strings (split by newlines or commas)
      const parseListString = (list: string): string[] => {
        if (!list || !list.trim()) return [];
        return list
          .split(/[\n,]/)
          .map(item => item.trim())
          .filter(item => item.length > 0);
      };

      // CRITICAL: If entityMode is manual, assign entities to rows
      // This should happen BEFORE title template processing so entities are available for templates
      if (entityMode === 'manual') {
        // Try entityList first, then fallback to entityValue
        const entitySource = (entityList && entityList.trim()) ? entityList : entityValue;
        
        console.log(`[Entity Assignment] Manual mode detected. EntityList: "${entityList}", EntityValue: "${entityValue}", Using: "${entitySource}"`);
        
        if (entitySource && entitySource.trim()) {
          const entityValues = parseListString(entitySource);
          console.log(`[Entity Assignment] Parsed ${entityValues.length} entities:`, entityValues);
          
          if (entityValues.length > 0) {
            cappedParsedRows.forEach((row, index) => {
              // Assign entity from list (one per row, cycling if list is shorter)
              const entityIndex = Math.min(index, entityValues.length - 1);
              row.entity = entityValues[entityIndex] || '';
              console.log(`[Entity Assignment] Row ${index + 1}: Assigned entity "${row.entity}" (from index ${entityIndex})`);
            });
          } else {
            console.warn(`[Entity Assignment] No entities parsed from source: "${entitySource}"`);
          }
        } else {
          console.warn(`[Entity Assignment] No entity source available. EntityList: "${entityList}", EntityValue: "${entityValue}"`);
        }
      }

      // CRITICAL: If title template is provided, ensure ALL titles follow the template
      if (titleTemplate && titleTemplate.trim()) {
        const entityValues = parseListString(entityList || '');
        const keywordValues = parseListString(keywordList || '');
        const locationValues = parseListString(locationList || '');
        const numberValues = parseListString(numberList || '');
        
        cappedParsedRows.forEach((row, index) => {
          const getListValue = (list: string[], fallback: string): string => {
            if (list.length > 0) {
              return list[Math.min(index, list.length - 1)] || fallback;
            }
            return fallback;
          };
          
          const variables: Record<string, string> = {
            Keyword: getListValue(keywordValues, row.keyword || ''),
            Entity: getListValue(entityValues, row.entity || ''),
            Location: getListValue(locationValues, ''),
            Number: getListValue(numberValues, String(index + 1)),
          };
          
          // FORCE template application - override any AI-generated title
          const templateTitle = parseTitleTemplate(titleTemplate, variables);
          if (templateTitle && templateTitle.trim()) {
            row.title = templateTitle.trim();
            console.log(`[Title Template] FORCED template for row ${index + 1}: "${row.title}"`);
          }
          // Sync entity to row when template provided an Entity (so Origin ACF gets set from entity)
          if (variables.Entity && variables.Entity.trim() && variables.Entity.trim() !== 'N/A') {
            row.entity = variables.Entity.trim();
          }
        });
      }

      // Determine final rows (merged or new)
      let finalRows: CSVRow[];
      if (keepIndices && keepIndices.length > 0) {
        const keptRows = keepIndices.map(idx => generatedRows[idx]).filter(Boolean);
        finalRows = [...keptRows, ...cappedParsedRows].slice(0, numberOfBlogs);
        notify.success(notifyRegeneratedXBlogIdeaxKeptXSelected(cappedParsedRows.length, cappedParsedRows.length !== 1 ? 's' : '', keptRows.length));
      } else {
        finalRows = cappedParsedRows;
        notify.success(notifyGeneratedXBlogIdeax(cappedParsedRows.length, cappedParsedRows.length !== 1 ? 's' : ''));
      }

      setGeneratedRows(finalRows);

      onProgress?.('✅ Generation complete!', 100);
      setHasGeneratedChecklist(true);
      return finalRows;
    } catch (error) {
      console.error('Checklist generation error:', error);
      onProgress?.('Generation failed', 0);
      const msg = error instanceof Error ? error.message : NOTIFY_FAILED_TO_GENERATE_CHECKLIST_PLEASE_TRY_;
      notify.error(msg);
      setChatMessages(prev => prev.slice(0, -1));
      return undefined;
    } finally {
      setIsGeneratingChecklist(false);
    }
  }, [
    openRouterApiKey,
    temperature,
    maxTokens,
    topP,
    flowPurpose,
    numberOfBlogs,
    entityMode,
    entityValue,
    keywordMode,
    keywordValue,
    optionalPrompt,
    titleTemplate,
    entityList,
    keywordList,
    locationList,
    numberList,
    featuredImagePerBlog,
    connectedSite,
    gscExactKeywords,
    generatedRows,
    onProgress,
    keywordAnalysisResults,
  ]);

  /**
   * Reset the prompt generation state
   */
  const resetPromptGeneration = useCallback(() => {
    setUserInput('');
    setChatMessages([]);
    setHasGeneratedChecklist(false);
    setGeneratedRows([]);
    setWordPressPostsMetadata([]);
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = [];
    setSitemapInventoryLinks([]);
    revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
    siteKwLinkRef.current = null;
    setSiteKwHostedLink(null);
    setLastInventorySentToAiCount(null);
  }, []);

  /**
   * Modify the checklist (regenerate with modifications)
   */
  const handleModifyChecklist = useCallback(() => {
    setHasGeneratedChecklist(false);
    setGeneratedRows([]);
    // Keep chat messages for context
  }, []);

  /**
   * Regenerate unselected blog ideas, keeping selected ones
   * Returns the new indices of the kept items (they will be at the beginning of the array)
   */
  const handleRegenerateUnselected = useCallback(async (selectedIndices: Set<number>): Promise<Set<number>> => {
    if (selectedIndices.size >= generatedRows.length) {
      notify.error(NOTIFY_PLEASE_DESELECT_AT_LEAST_ONE_BLOG_IDEA_T);
      return new Set();
    }

    // Convert Set to sorted array for consistent ordering
    const keepIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    await handleGenerateChecklist(keepIndices);
    
    // Return the new indices - kept items are always at the beginning (0, 1, 2, ...)
    return new Set(keepIndices.map((_, idx) => idx));
  }, [handleGenerateChecklist, generatedRows.length]);

  return {
    // State
    userInput,
    setUserInput,
    chatMessages,
    isGeneratingChecklist,
    hasGeneratedChecklist,
    generatedRows,
    setGeneratedRows,
    wordPressPostsMetadata,
    sitemapInventoryLinks,
    siteKwHostedLink,
    lastInventorySentToAiCount,
    chatEndRef,
    
    // Actions
    handleGenerateChecklist,
    resetPromptGeneration,
    handleModifyChecklist,
    handleRegenerateUnselected,
  };
}


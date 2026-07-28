import { streamChatCompletion } from "@/lib/api";
import {
  buildImageChecklistSystemPrompt,
  buildImageChecklistUserPrompt,
  parseImageChecklist,
  type ImageChecklistItem,
} from "@/lib/image-checklist-builder";
import type { ImageGeneratorOptions, ImageGeneratorRunContext } from "@/lib/image-generator/image-generator-options";
import {
  resolveEffectiveSourceMode,
  resolveSelectedSectionObj,
} from "@/lib/image-generator/image-generator-options";

export async function runImageChecklist(
  options: ImageGeneratorOptions,
  context: ImageGeneratorRunContext,
): Promise<ImageChecklistItem[]> {
  const effectiveMode = resolveEffectiveSourceMode(
    options.imageSourceMode,
    options.selectedSection,
  );
  if (effectiveMode === "solo") return [];

  const selectedSectionObj = resolveSelectedSectionObj(
    effectiveMode,
    options.selectedSection,
    context.availableSections,
  );

  const systemPrompt = buildImageChecklistSystemPrompt(
    context.flowTitle,
    context.flowPurpose,
    effectiveMode === "featured" ? context.finalOutput : undefined,
    selectedSectionObj,
    options.userPrompt.trim() || undefined,
  );

  const userPromptText = buildImageChecklistUserPrompt({
    flowTitle: context.flowTitle,
    flowPurpose: context.flowPurpose,
    agents: context.agents,
    finalOutput: effectiveMode === "featured" ? context.finalOutput : undefined,
    selectedSection: selectedSectionObj,
    userPrompt: options.userPrompt.trim() || undefined,
    includeText: options.includeText,
    includePeople: options.includePeople,
    includeAnimals: options.includeAnimals,
    includeCars: options.includeCars,
    isInfographic: options.isInfographic,
    aspectRatio: options.aspectRatio,
    style: options.style,
    colorScheme: options.colorScheme,
    colorForeground: options.colorForeground.trim() || undefined,
    colorBackground: options.colorBackground.trim() || undefined,
  });

  let checklistContent = "";
  await streamChatCompletion({
    apiKey: context.apiKey,
    model: context.selectedModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptText },
    ],
    temperature: context.temperature,
    maxTokens: context.maxTokens,
    topP: context.topP,
    onContentChunk: (chunk) => {
      checklistContent += chunk;
    },
  });

  return parseImageChecklist(checklistContent);
}

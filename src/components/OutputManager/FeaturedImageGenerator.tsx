import { ImageGeneratorBody } from "@/components/generator/image/ImageGeneratorBody";
import { useImageGenerator } from "@/components/generator/image/useImageGenerator";
import type { FeaturedImageGeneratorState } from "@/components/generator/image/image-generator-types";
import { FeaturedImageGeneratorProps } from "./types";

export type { FeaturedImageGeneratorState } from "@/components/generator/image/image-generator-types";

export const FeaturedImageGenerator = ({
  apiKey = "",
  flowTitle = "",
  flowPurpose = "",
  agents = [],
  finalOutput = "",
  selectedModel = "google/gemini-2.5-flash",
  temperature = 1.57,
  maxTokens = 5000000,
  topP = 0.9,
  onImageStateChange,
  hideHeader = false,
}: FeaturedImageGeneratorProps & { onImageStateChange?: (state: FeaturedImageGeneratorState) => void }) => {
  const generator = useImageGenerator({
    apiKey,
    flowTitle,
    flowPurpose,
    agents,
    finalOutput,
    selectedModel,
    temperature,
    maxTokens,
    topP,
    onImageStateChange,
  });

  return <ImageGeneratorBody generator={generator} hideHeader={hideHeader} />;
};

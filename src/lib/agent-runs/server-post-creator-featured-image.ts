import type { WordPressSite } from "@/components/integrations/types";
import { loadApiKey } from "@/lib/api";
import { generateFeaturedImage, generateImageChecklist } from "@/lib/bulk/bulk-image-generator";
import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { generateSEOImageFilename } from "@/lib/image-filename-generator";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { uploadWordPressMedia } from "@/lib/wordpress-api";

export type ServerPostCreatorFeaturedImageResult = {
  featuredImageId: number;
  imageFileName: string;
  imageBase64: string;
  imageDataUrl: string;
  checklistJson: string;
};

export async function generateServerPostCreatorFeaturedImage(args: {
  site: WordPressSite;
  title: string;
  keyword: string;
  markdownContent: string;
  blueprintPurpose?: string;
}): Promise<ServerPostCreatorFeaturedImageResult> {
  const apiKey = loadApiKey()?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key required for featured image.");
  }

  const flowTitle = args.title.trim() || args.keyword.trim();
  const flowPurpose = args.blueprintPurpose?.trim() || buildFocusedArticlePurpose(args.keyword);
  const model = getResearchModel(args.site.id);

  const imageChecklist = await generateImageChecklist(flowTitle, flowPurpose, args.markdownContent, {
    apiKey,
    model,
  });

  const imageResult = await generateFeaturedImage(
    flowTitle,
    flowPurpose,
    args.markdownContent,
    imageChecklist,
    { apiKey, model },
  );

  let imageBase64 = imageResult.imageBase64;
  if (imageBase64.includes(",")) {
    imageBase64 = imageBase64.split(",")[1] ?? imageBase64;
  }

  const imageFileName = await generateSEOImageFilename(flowTitle, apiKey, model, "featured");
  const fileNameWithoutExt = imageFileName.replace(/\.(png|jpg|jpeg)$/i, "");
  const finalImageFileName = `${fileNameWithoutExt}.png`;
  const imageDataUrl = `data:image/png;base64,${imageBase64}`;

  const uploadResult = await uploadWordPressMedia(
    args.site.siteUrl,
    args.site.username,
    args.site.appPassword,
    imageBase64,
    finalImageFileName,
    flowTitle,
  );

  if (!uploadResult.success || !uploadResult.mediaId) {
    throw new Error(uploadResult.error || "Featured image upload failed.");
  }

  const checklistJson = JSON.stringify(
    {
      title: flowTitle,
      purpose: flowPurpose,
      keyword: args.keyword,
      imageChecklist: imageChecklist.map((item) => ({
        title: item.title,
        description: item.description,
      })),
      mediaId: uploadResult.mediaId,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  return {
    featuredImageId: uploadResult.mediaId,
    imageFileName: finalImageFileName,
    imageBase64,
    imageDataUrl,
    checklistJson,
  };
}

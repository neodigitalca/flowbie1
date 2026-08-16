#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const UI_FILE_MAP = {
  "MetaAdsCampaignWorkspace.tsx": "SocialCreatorCampaignWorkspace.tsx",
  "MetaAdsWorkspaceHeader.tsx": "SocialCreatorWorkspaceHeader.tsx",
  "MetaAdsCampaignsSection.tsx": "SocialCreatorCampaignsSection.tsx",
  "MetaAdsAdRowCompact.tsx": "SocialCreatorPostRowCompact.tsx",
  "MetaAdsAdRowDetails.tsx": "SocialCreatorPostRowDetails.tsx",
  "MetaAdsGenerateToolbar.tsx": "SocialCreatorGenerateToolbar.tsx",
  "MetaAdsInstagramPreview.tsx": "SocialCreatorInstagramPreview.tsx",
  "MetaAdsContextSourceField.tsx": "SocialCreatorContextSourceField.tsx",
  "MetaAdsRowVisualDialog.tsx": "SocialCreatorRowVisualDialog.tsx",
  "MetaAdsRowVisualSettingsInline.tsx": "SocialCreatorRowVisualSettingsInline.tsx",
  "MetaAdsVisualSettingsPanel.tsx": "SocialCreatorVisualSettingsPanel.tsx",
  "MetaAdsVisualToolPaletteField.tsx": "SocialCreatorVisualToolPaletteField.tsx",
  "MetaAdsVisualToolThemeField.tsx": "SocialCreatorVisualToolThemeField.tsx",
  "MetaAdsColorPaletteField.tsx": "SocialCreatorColorPaletteField.tsx",
  "MetaAdsWorkspaceDefaultsDialog.tsx": "SocialCreatorWorkspaceDefaultsDialog.tsx",
  "MetaAdsToolbarKeywordsMenu.tsx": "SocialCreatorToolbarKeywordsMenu.tsx",
  "MetaAdsToolbarExportMenu.tsx": "SocialCreatorToolbarExportMenu.tsx",
  "MetaAdsResearchSectionsPanel.tsx": "SocialCreatorResearchSectionsPanel.tsx",
  "MetaAdsImageReferencesSection.tsx": "SocialCreatorImageReferencesSection.tsx",
  "MetaAdsDarkSelect.tsx": "SocialCreatorDarkSelect.tsx",
  "meta-ads-row-constants.ts": "social-creator-row-constants.ts",
  "meta-ads-visual-settings-layout.ts": "social-creator-visual-settings-layout.ts",
};

const LIB_FILE_MAP = {
  "meta-ads-types.ts": "social-creator-types.ts",
  "meta-ads-session-cache.ts": "social-creator-session-cache.ts",
  "meta-ads-field-limits.ts": "social-creator-field-limits.ts",
  "sync-meta-ad-rows.ts": "sync-social-creator-rows.ts",
  "meta-ads-progress-types.ts": "social-creator-progress-types.ts",
  "meta-ads-bulk-generator-bindings.ts": "social-creator-bulk-generator-bindings.ts",
  "meta-ad-generate-config-defaults.ts": "social-creator-generate-config-defaults.ts",
  "run-ppc-meta-ad-generate.ts": "run-social-creator-generate.ts",
  "run-ppc-meta-ad-generate-batch.ts": "run-social-creator-generate-batch.ts",
  "export-meta-ads-creative-zip.ts": "export-social-creator-zip.ts",
  "meta-ads-keyword-template.ts": "social-creator-keyword-template.ts",
  "export-meta-ads-csv.ts": "export-social-creator-csv.ts",
};

const REPLACEMENTS = [
  [/MetaAdsAdRowCompact/g, "SocialCreatorPostRowCompact"],
  [/MetaAdsAdRowDetails/g, "SocialCreatorPostRowDetails"],
  [/MetaAdsCampaignWorkspace/g, "SocialCreatorCampaignWorkspace"],
  [/MetaAdsWorkspaceHeader/g, "SocialCreatorWorkspaceHeader"],
  [/MetaAdsCampaignsSection/g, "SocialCreatorCampaignsSection"],
  [/MetaAdsGenerateToolbar/g, "SocialCreatorGenerateToolbar"],
  [/MetaAdsInstagramPreview/g, "SocialCreatorInstagramPreview"],
  [/MetaAdsContextSourceField/g, "SocialCreatorContextSourceField"],
  [/MetaAdsRowVisualDialog/g, "SocialCreatorRowVisualDialog"],
  [/MetaAdsRowVisualSettingsInline/g, "SocialCreatorRowVisualSettingsInline"],
  [/MetaAdsVisualSettingsPanel/g, "SocialCreatorVisualSettingsPanel"],
  [/MetaAdsVisualToolPaletteField/g, "SocialCreatorVisualToolPaletteField"],
  [/MetaAdsVisualToolThemeField/g, "SocialCreatorVisualToolThemeField"],
  [/MetaAdsColorPaletteField/g, "SocialCreatorColorPaletteField"],
  [/MetaAdsWorkspaceDefaultsDialog/g, "SocialCreatorWorkspaceDefaultsDialog"],
  [/MetaAdsToolbarKeywordsMenu/g, "SocialCreatorToolbarKeywordsMenu"],
  [/MetaAdsToolbarExportMenu/g, "SocialCreatorToolbarExportMenu"],
  [/MetaAdsResearchSectionsPanel/g, "SocialCreatorResearchSectionsPanel"],
  [/MetaAdsImageReferencesSection/g, "SocialCreatorImageReferencesSection"],
  [/MetaAdsDarkSelect/g, "SocialCreatorDarkSelect"],
  [/usePpcMetaWorkspace/g, "useSocialCreatorWorkspace"],
  [/PpcMetaWorkspaceController/g, "SocialCreatorWorkspaceController"],
  [/runPpcMetaAdGenerateBatch/g, "runSocialCreatorGenerateBatch"],
  [/runPpcMetaAdGenerate/g, "runSocialCreatorGenerate"],
  [/RunPpcMetaAdGenerate/g, "RunSocialCreatorGenerate"],
  [/MetaAdRow/g, "SocialCreatorRow"],
  [/MetaGenerateConfig/g, "SocialGenerateConfig"],
  [/MetaGenerateProgressState/g, "SocialGenerateProgressState"],
  [/metaRowHasGenerateInput/g, "socialRowHasGenerateInput"],
  [/metaRowPatchFromGenerated/g, "socialRowPatchFromGenerated"],
  [/metaRowUserInputPreserve/g, "socialRowUserInputPreserve"],
  [/createIdleMetaAdRow/g, "createIdleSocialCreatorRow"],
  [/clampMetaAdCount/g, "clampSocialPostCount"],
  [/META_AD_COUNT_MIN/g, "SOCIAL_POST_COUNT_MIN"],
  [/META_AD_COUNT_MAX/g, "SOCIAL_POST_COUNT_MAX"],
  [/syncMetaAdRowsToCount/g, "syncSocialCreatorRowsToCount"],
  [/getPpcMetaAdsSessionCache/g, "getSocialCreatorSessionCache"],
  [/setPpcMetaAdsSessionCache/g, "setSocialCreatorSessionCache"],
  [/clearPpcMetaAdsSessionCache/g, "clearSocialCreatorSessionCache"],
  [/readMetaGenerateConfig/g, "readSocialGenerateConfig"],
  [/writeMetaGenerateConfig/g, "writeSocialGenerateConfig"],
  [/ppcMetaGridRowCount/g, "socialCreatorGridRowCount"],
  [/PPC_META_PLACEHOLDER_ROW_COUNT/g, "SOCIAL_CREATOR_PLACEHOLDER_ROW_COUNT"],
  [/meta-ads-row-constants/g, "social-creator-row-constants"],
  [/meta-ads-visual-settings-layout/g, "social-creator-visual-settings-layout"],
  [/meta-ads-types/g, "social-creator-types"],
  [/meta-ads-session-cache/g, "social-creator-session-cache"],
  [/meta-ads-field-limits/g, "social-creator-field-limits"],
  [/meta-ads-progress-types/g, "social-creator-progress-types"],
  [/meta-ads-bulk-generator-bindings/g, "social-creator-bulk-generator-bindings"],
  [/meta-ad-generate-config-defaults/g, "social-creator-generate-config-defaults"],
  [/run-ppc-meta-ad-generate-batch/g, "run-social-creator-generate-batch"],
  [/run-ppc-meta-ad-generate/g, "run-social-creator-generate"],
  [/export-meta-ads-creative-zip/g, "export-social-creator-zip"],
  [/meta-ads-keyword-template/g, "social-creator-keyword-template"],
  [/export-meta-ads-csv/g, "export-social-creator-csv"],
  [/sync-meta-ad-rows/g, "sync-social-creator-rows"],
  [/@\/components\/ppc\/meta\//g, "@/components/social/creator/"],
  [/@\/hooks\/ppc\/use-ppc-meta-workspace/g, "@/hooks/social/use-social-creator-workspace"],
  [/PpcPlatformPills/g, "SocialPlatformPills"],
  [/ppc-google \| ppc-meta/g, "gbp-post | content-calendar | social-creator"],
  [/"ppc-google" \| "ppc-meta"/g, '"gbp-post" | "content-calendar" | "social-creator"'],
  [/onPlatformChange: \(tab: "ppc-google" \| "ppc-meta"\)/g, 'onPlatformChange: (tab: SocialPlatformTab)'],
  [/loadPpcPageBucketContext/g, "loadContentCreatorLandingPages"],
  [/createPpcPageBucketHostedLink/g, "createSocialCreatorHostedLink"],
  [/revokePpcPageBucketHostedLink/g, "revokeSocialCreatorHostedLink"],
  [/neo-pulse-ppc-meta-ads-v3/g, "neo-pulse-social-creator-v1"],
  [/neo-pulse-ppc-meta-generate-config/g, "neo-pulse-social-creator-generate-config"],
  [/Meta ads/g, "Social Creator"],
  [/Meta ad/g, "Social post"],
  [/Meta Ads/g, "Social Creator"],
  [/Delete ad/g, "Delete post"],
  [/Ad name/g, "Post title"],
  [/Generate Meta ad/g, "Generate post"],
  [/htmlFor="meta-ads-toolbar-ads"/g, 'htmlFor="social-creator-toolbar-posts"'],
  [/id="meta-ads-toolbar-ads"/g, 'id="social-creator-toolbar-posts"'],
  [/MetaBulkMicroSnapshot/g, "MetaBulkMicroSnapshot"],
  [/adCount/g, "postCount"],
  [/adName/g, "postTitle"],
  [/handleGenerateAds/g, "handleGeneratePosts"],
  [/handleGenerateAdRow/g, "handleGeneratePostRow"],
  [/handleDeleteAdRow/g, "handleDeletePostRow"],
  [/handleClearAllAds/g, "handleClearAllPosts"],
  [/displayAds/g, "displayPosts"],
  [/wpAds/g, "wpPosts"],
  [/wpAdsLoading/g, "wpPostsLoading"],
  [/buildMetaBulkGeneratorDetailsProps/g, "buildSocialCreatorBulkGeneratorDetailsProps"],
  [/metaDetailsCanOpen/g, "socialCreatorDetailsCanOpen"],
  [/neo-pulse-meta-ads-/g, "neo-pulse-social-creator-"],
  [/title="PPC"/g, 'title="Creator"'],
  [/Megaphone/g, "TrendingUp"],
  [/from "@\/lib\/ppc\/ppc-page-bucket-inventory"/g, 'from "@/lib/social/content-creator-landing-pages"'],
];

const LABEL_REPLACEMENTS = [
  [/>\s*Ads\s*</g, ">Posts<"],
  [/label:\s*"Ads"/g, 'label: "Posts"'],
];

function transform(content, extra = []) {
  let out = content;
  for (const [pattern, replacement] of [...REPLACEMENTS, ...extra]) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyMapped(srcDir, destDir, map) {
  ensureDir(destDir);
  for (const [srcName, destName] of Object.entries(map)) {
    const srcPath = path.join(srcDir, srcName);
    if (!fs.existsSync(srcPath)) {
      console.warn("skip missing", srcPath);
      continue;
    }
    const destPath = path.join(destDir, destName);
    const content = transform(fs.readFileSync(srcPath, "utf8"));
    fs.writeFileSync(destPath, content, "utf8");
    console.log("wrote", destPath);
  }
}

copyMapped(path.join(root, "src/components/ppc/meta"), path.join(root, "src/components/social/creator"), UI_FILE_MAP);
copyMapped(path.join(root, "src/lib/ppc"), path.join(root, "src/lib/social"), LIB_FILE_MAP);

const hookSrc = path.join(root, "src/hooks/ppc/use-ppc-meta-workspace.ts");
const hookDest = path.join(root, "src/hooks/social/use-social-creator-workspace.ts");
fs.writeFileSync(hookDest, transform(fs.readFileSync(hookSrc, "utf8")), "utf8");
console.log("wrote", hookDest);

console.log("fork complete");

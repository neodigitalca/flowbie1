#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (
      /social-creator|use-social-creator|run-social-creator|export-social-creator|sync-social-creator/.test(
        full.replace(/\\/g, "/"),
      )
    ) {
      files.push(full);
    }
  }
}

walk(path.join(root, "src/components/social/creator"));
walk(path.join(root, "src/lib/social"));
walk(path.join(root, "src/hooks/social"));

const REPLACEMENTS = [
  [/@\/lib\/ppc\/social-creator-/g, "@/lib/social/social-creator-"],
  [/@\/components\/ppc\/SocialPlatformPills/g, "@/components/social/SocialPlatformPills"],
  [/buildMetaAdsBulkGeneratorDetailsProps/g, "buildSocialCreatorBulkGeneratorDetailsProps"],
  [/metaAdsDetailsCanOpen/g, "socialCreatorDetailsCanOpen"],
  [/metaAdsHeaderProgressFromRun/g, "socialCreatorHeaderProgressFromRun"],
  [/buildMetaAdsBulkMicroSnapshot/g, "buildSocialCreatorBulkMicroSnapshot"],
  [/buildMetaAdsExportCsv/g, "buildSocialCreatorExportCsv"],
  [/exportMetaAdsCreativeZip/g, "exportSocialCreatorZip"],
  [/canExportMetaAdsCsv/g, "canExportSocialCreatorCsv"],
  [/canExportMetaAdsZip/g, "canExportSocialCreatorZip"],
  [/active="ppc-meta"/g, 'active="social-creator"'],
  [/detailsPanelId="ppc-meta-generate-details"/g, 'detailsPanelId="social-creator-generate-details"'],
  [/ppc-meta-toolbar-/g, "social-creator-toolbar-"],
  [/neo-pulse-ppc-meta-ad-/g, "neo-pulse-social-creator-"],
  [/createSocialCreatorHostedLink/g, "createPpcPageBucketHostedLink"],
  [/revokeSocialCreatorHostedLink/g, "revokePpcPageBucketHostedLink"],
  [/`ppc-meta-ad-/g, "`social-creator-"],
  [/\bctrl\.ads\b/g, "ctrl.posts"],
  [/ads: ctrl\.posts/g, "posts: ctrl.posts"],
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  for (const [pattern, replacement] of REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    console.log("fixed", file);
  }
}

const hookPath = path.join(root, "src/hooks/social/use-social-creator-workspace.ts");
let hook = fs.readFileSync(hookPath, "utf8");
hook = hook
  .replace(/const \[ads, setAds\]/g, "const [posts, setPosts]")
  .replace(/\bsetAds\b/g, "setPosts")
  .replace(/([^a-zA-Z])ads([^a-zA-Z])/g, "$1posts$2")
  .replace(/updateAd\b/g, "updatePost")
  .replace(/handleDeleteAdRow/g, "handleDeletePostRow");
fs.writeFileSync(hookPath, hook, "utf8");
console.log("fixed hook");

console.log("done");

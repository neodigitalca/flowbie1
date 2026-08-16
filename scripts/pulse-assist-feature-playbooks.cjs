#!/usr/bin/env node
/**
 * Pulse Assist feature playbooks — step-by-step UI docs per module feature.
 * Sourced from actual UI labels in the React app.
 */

/** @param {string} id @param {string} moduleId @param {string} label @param {string} question @param {string} pulseNav @param {string[]} steps @param {string[]} [aliases] */
function pb(id, moduleId, label, question, pulseNav, steps, aliases = []) {
  return { id, moduleId, label, question, pulseNav, steps, aliases };
}

/** @type {import("../src/lib/pulse-assist/app-module-catalog.types").AssistFeaturePlaybook[]} */
const FEATURE_PLAYBOOKS = [
  // dashboard/properties
  pb(
    "dashboard/properties/add-property",
    "dashboard/properties",
    "Add property",
    "How do I add a property?",
    "pulse:nav/dashboard/properties",
    [
      "Open [Dashboard → Properties](pulse:nav/dashboard/properties).",
      "Click **Add property** (or connect a new WordPress site).",
      "Enter site URL, credentials, and save.",
    ],
    ["add property", "connect site", "new client"],
  ),
  pb(
    "dashboard/properties/enable-site",
    "dashboard/properties",
    "Enable site",
    "How do I enable a property?",
    "pulse:nav/dashboard/properties",
    [
      "Open [Dashboard → Properties](pulse:nav/dashboard/properties).",
      "Find the property in the roster.",
      "Toggle the enable switch next to the property name (green = enabled).",
    ],
    ["enable property", "enable site", "how to enable a property"],
  ),
  pb(
    "dashboard/properties/site-credentials",
    "dashboard/properties",
    "Site credentials",
    "How do I edit site credentials?",
    "pulse:nav/dashboard/properties",
    [
      "Open [Dashboard → Properties](pulse:nav/dashboard/properties).",
      "Select the property tile.",
      "Update username, app password, or site URL in the property panel and save.",
    ],
    ["credentials", "app password", "wordpress credentials"],
  ),
  pb(
    "dashboard/properties/multi-site",
    "dashboard/properties",
    "Multi-site roster",
    "How do I manage multiple properties?",
    "pulse:nav/dashboard/properties",
    [
      "Open [Dashboard → Properties](pulse:nav/dashboard/properties).",
      "Each connected WordPress site appears as a property tile.",
      "Use the header property picker to switch the active workspace property.",
    ],
    ["multi-site", "multiple clients", "property roster"],
  ),

  // dashboard/api-keys
  pb(
    "dashboard/api-keys/openrouter-key",
    "dashboard/api-keys",
    "OpenRouter key",
    "How do I add my OpenRouter API key?",
    "pulse:nav/dashboard/api-keys",
    [
      "Open [Dashboard → API Keys](pulse:nav/dashboard/api-keys).",
      "Paste your OpenRouter API key in the **OpenRouter** field.",
      "Click **Test and save**.",
    ],
    ["openrouter", "openrouter key", "api key openrouter"],
  ),
  pb(
    "dashboard/api-keys/dataforseo-key",
    "dashboard/api-keys",
    "DataForSEO key",
    "How do I add my DataForSEO API key?",
    "pulse:nav/dashboard/api-keys",
    [
      "Open [Dashboard → API Keys](pulse:nav/dashboard/api-keys).",
      "Enter DataForSEO login and password.",
      "Click **Test and save**.",
    ],
    ["dataforseo", "dataforseo key"],
  ),

  // dashboard/master-rules
  pb(
    "dashboard/master-rules/per-site-rules",
    "dashboard/master-rules",
    "Per-site rules",
    "How do I edit master rules for a site?",
    "pulse:nav/dashboard/master-rules",
    [
      "Open [Dashboard → Master Rules](pulse:nav/dashboard/master-rules).",
      "Select the property from the roster.",
      "Edit client instructions in the **Master Rules** editor and save.",
    ],
    ["master rules", "client rules", "instructions"],
  ),
  pb(
    "dashboard/master-rules/supabase-sync",
    "dashboard/master-rules",
    "Supabase sync",
    "How do master rules sync to Supabase?",
    "pulse:nav/dashboard/master-rules",
    [
      "Open [Dashboard → Master Rules](pulse:nav/dashboard/master-rules).",
      "Saved rules sync to Supabase for the selected property automatically on save.",
    ],
    ["supabase sync", "supabase rules"],
  ),

  // dashboard/ai-generation
  pb(
    "dashboard/ai-generation/default-model",
    "dashboard/ai-generation",
    "Default model",
    "How do I change the default AI model?",
    "pulse:nav/dashboard/ai-generation",
    [
      "Open [Dashboard → AI & Models](pulse:nav/dashboard/ai-generation).",
      "Pick the default OpenRouter model from the model selector.",
      "Save settings.",
    ],
    ["default model", "change model", "ai model"],
  ),
  pb(
    "dashboard/ai-generation/temperature",
    "dashboard/ai-generation",
    "Temperature",
    "How do I adjust AI temperature?",
    "pulse:nav/dashboard/ai-generation",
    [
      "Open [Dashboard → AI & Models](pulse:nav/dashboard/ai-generation).",
      "Adjust the **Temperature** slider.",
      "Save settings.",
    ],
    ["temperature", "generation temperature"],
  ),
  pb(
    "dashboard/ai-generation/max-tokens",
    "dashboard/ai-generation",
    "Max tokens",
    "How do I change max tokens?",
    "pulse:nav/dashboard/ai-generation",
    [
      "Open [Dashboard → AI & Models](pulse:nav/dashboard/ai-generation).",
      "Set **Max tokens** for generation output.",
      "Save settings.",
    ],
    ["max tokens", "token limit"],
  ),

  // dashboard/google
  pb(
    "dashboard/google/gsc",
    "dashboard/google",
    "GSC connection",
    "How do I connect Google Search Console?",
    "pulse:nav/dashboard/google",
    [
      "Open [Dashboard → Google Services](pulse:nav/dashboard/google).",
      "Configure **Google Search Console** credentials for the property.",
      "Test connection and save.",
    ],
    ["gsc", "search console", "connect gsc"],
  ),
  pb(
    "dashboard/google/ga4",
    "dashboard/google",
    "GA4 connection",
    "How do I connect Google Analytics?",
    "pulse:nav/dashboard/google",
    [
      "Open [Dashboard → Google Services](pulse:nav/dashboard/google).",
      "Configure **Google Analytics 4** credentials.",
      "Test connection and save.",
    ],
    ["ga4", "analytics", "google analytics"],
  ),
  pb(
    "dashboard/google/gbp-credentials",
    "dashboard/google",
    "GBP credentials",
    "How do I connect Google Business Profile?",
    "pulse:nav/dashboard/google",
    [
      "Open [Dashboard → Google Services](pulse:nav/dashboard/google).",
      "Configure **Google Business Profile** OAuth and location settings.",
      "Save credentials.",
    ],
    ["gbp", "business profile", "google business profile settings"],
  ),

  // users
  pb(
    "users/invite-user",
    "users",
    "Invite user",
    "How do I invite a team member?",
    "pulse:nav/users",
    [
      "Open [Teams → Users](pulse:nav/users).",
      "In **Add member**, enter **Email**, **Display name**, and **Password**.",
      "Choose **Access role** and **Job title**.",
      "Click **Add member**.",
    ],
    ["invite user", "add member", "invite someone", "add team member"],
  ),
  pb(
    "users/roles",
    "users",
    "Access roles",
    "How do user roles work?",
    "pulse:nav/users",
    [
      "Open [Teams → Users](pulse:nav/users).",
      "When adding a member, set **Access role** (owner, admin, member, etc.).",
      "Roles control Teams module write access.",
    ],
    ["roles", "access role", "permissions"],
  ),
  pb(
    "users/member-profiles",
    "users",
    "Member profiles",
    "How do I view team member profiles?",
    "pulse:nav/users",
    [
      "Open [Teams → Users](pulse:nav/users).",
      "Browse the member roster for display names, emails, and job titles.",
    ],
    ["member profiles", "team members", "user list"],
  ),

  // chat
  pb(
    "chat/create-channel",
    "chat",
    "Create a channel",
    "How do I create a channel?",
    "pulse:nav/chat",
    [
      "Open [Teams → Chat](pulse:nav/chat).",
      "Under **Channels**, click **New channel** (+).",
      "Enter **Name**, choose **Visibility** (Public or Private).",
      "For private channels, select **Members**.",
      "Click **Create**.",
    ],
    ["create channel", "new channel", "add channel"],
  ),
  pb(
    "chat/send-dm",
    "chat",
    "Send a direct message",
    "How do I send a direct message?",
    "pulse:nav/chat",
    [
      "Open [Teams → Chat](pulse:nav/chat).",
      "Under **DMs**, click **New direct message** (+).",
      "Select a team member and start typing in the composer.",
    ],
    ["direct message", "dm", "new direct message", "private message"],
  ),
  pb(
    "chat/use-threads",
    "chat",
    "Threads",
    "How do threads work in Chat?",
    "pulse:nav/chat",
    [
      "Open [Teams → Chat](pulse:nav/chat).",
      "Open a channel or DM.",
      "Click **Reply in thread** on a message to open the thread panel.",
      "Send replies in the thread composer.",
    ],
    ["threads", "reply in thread", "thread reply"],
  ),
  pb(
    "chat/upload-file",
    "chat",
    "Upload a file",
    "How do I upload a file in Chat?",
    "pulse:nav/chat",
    [
      "Open [Teams → Chat](pulse:nav/chat).",
      "Open a channel or DM.",
      "Use the attachment control in the message composer to upload a file.",
    ],
    ["file uploads", "upload file", "attach file", "attachment"],
  ),
  pb(
    "chat/mentions",
    "chat",
    "Mentions",
    "How do mentions work in Chat?",
    "pulse:nav/chat",
    [
      "Open [Teams → Chat](pulse:nav/chat).",
      "In the composer, type **@** followed by a team member name to mention them.",
      "Check **Mentions** in the sidebar for messages where you were mentioned.",
    ],
    ["mentions", "@mention", "notify user"],
  ),

  // tasks
  pb(
    "tasks/projects",
    "tasks",
    "Projects",
    "How do I create a project in Tasks?",
    "pulse:nav/tasks",
    [
      "Open [Teams → Tasks](pulse:nav/tasks).",
      "Click **New project** in the projects sidebar.",
      "Name the project and start adding sections and tasks.",
    ],
    ["projects", "new project", "create project"],
  ),
  pb(
    "tasks/tasks",
    "tasks",
    "Tasks",
    "How do I add a task?",
    "pulse:nav/tasks",
    [
      "Open [Teams → Tasks](pulse:nav/tasks).",
      "Select a project and section.",
      "Click **Add task** and enter the task title.",
    ],
    ["tasks", "add task", "create task"],
  ),
  pb(
    "tasks/sections",
    "tasks",
    "Sections",
    "How do I organize task sections?",
    "pulse:nav/tasks",
    [
      "Open [Teams → Tasks](pulse:nav/tasks).",
      "Inside a project, add or rename **Sections** to group tasks.",
    ],
    ["sections", "task sections", "kanban columns"],
  ),

  // generator/opt
  pb(
    "generator/opt/sitemap-pills",
    "generator/opt",
    "Pages Posts SAP pills",
    "How do I switch between Pages, Posts, and SAP?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "On the black toolbar, click **Pages**, **Posts**, or **SAP** sitemap source pills.",
    ],
    ["pages posts sap", "sitemap source", "sitemap pills"],
  ),
  pb(
    "generator/opt/aiseo-bulk-meta",
    "generator/opt",
    "AISEO bulk meta",
    "How do I bulk-optimize meta on Overview?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "Select rows with checkboxes.",
      "Open the **AISEO** flyout on the black toolbar → **Meta** → **All Meta** or **MD**.",
      "Run the bulk job on selected rows.",
    ],
    ["bulk meta", "bulk optimize meta", "aiseo bulk", "all meta"],
  ),
  pb(
    "generator/opt/row-expansion",
    "generator/opt",
    "Row expansion",
    "How do I expand an Overview row?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "Click a row in the grid to expand row details.",
      "Use row actions such as **AI meta** for single-page optimization.",
    ],
    ["row expansion", "expand row", "row details"],
  ),
  pb(
    "generator/opt/ai-meta",
    "generator/opt",
    "AI meta",
    "How do I run AI meta on one page?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "Expand the page row.",
      "Click **AI meta** in row details (pages: meta + FAQs; posts: **AI title** then meta).",
    ],
    ["ai meta", "single page meta", "optimize one page"],
  ),
  pb(
    "generator/opt/page-title",
    "generator/opt",
    "Optimize page title",
    "How do I optimize a page title?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "Use **Pages**, **Posts**, or **SAP** pills to find the URL.",
      "Expand the row and edit **SEO title** (posts: use **AI title** or **AI meta**).",
      "Click **Save**.",
    ],
    ["page title", "optimize title", "seo title", "title tag", "optimizae"],
  ),
  pb(
    "generator/opt",
    "Multi-site pill",
    "How do I use multi-site Overview?",
    "pulse:nav/generator/opt",
    [
      "Open [SEO → Generator → Opt](pulse:nav/generator/opt) (Overview).",
      "Switch the content optimizer section to **Multi-site** when available.",
      "Compare or bulk work across connected properties from the multi-site grid.",
    ],
    ["multi-site", "multi site overview"],
  ),

  // generator bulk sections
  pb(
    "generator/bulk-csv/csv-upload",
    "generator/bulk-csv",
    "CSV upload",
    "How do I bulk generate from CSV?",
    "pulse:nav/generator/bulk-csv",
    [
      "Open [SEO → Generator → CSV](pulse:nav/generator/bulk-csv).",
      "Upload a CSV with blog generation columns.",
      "Configure options and run **Bulk generate**.",
    ],
    ["csv upload", "bulk csv", "upload csv"],
  ),
  pb(
    "generator/bulk-csv/bulk-generate",
    "generator/bulk-csv",
    "Bulk generate",
    "How do I run CSV bulk generation?",
    "pulse:nav/generator/bulk-csv",
    [
      "Open [SEO → Generator → CSV](pulse:nav/generator/bulk-csv).",
      "After CSV upload, start the bulk generation run from the toolbar.",
    ],
    ["bulk generate", "run csv bulk"],
  ),
  pb(
    "generator/bulk-prompt/overview",
    "generator/bulk-prompt",
    "Prompt bulk",
    "How do I bulk generate from prompts?",
    "pulse:nav/generator/bulk-prompt",
    [
      "Open [SEO → Generator → Prompt](pulse:nav/generator/bulk-prompt).",
      "Configure prompt templates and run bulk generation.",
    ],
    ["prompt bulk", "bulk prompt"],
  ),
  pb(
    "generator/bulk-blog-import/overview",
    "generator/bulk-blog-import",
    "Blog import",
    "How do I import blog posts?",
    "pulse:nav/generator/bulk-blog-import",
    [
      "Open [SEO → Generator → Import](pulse:nav/generator/bulk-blog-import).",
      "Import existing WordPress posts for optimization workflows.",
    ],
    ["blog import", "import posts"],
  ),
  pb(
    "generator/bulk-press-release/overview",
    "generator/bulk-press-release",
    "Press release bulk",
    "How do I generate press releases in bulk?",
    "pulse:nav/generator/bulk-press-release",
    [
      "Open [SEO → Generator → PR](pulse:nav/generator/bulk-press-release).",
      "Configure press release rows and run the bulk PR generator.",
    ],
    ["press release", "pr generator"],
  ),
  pb(
    "generator/entity/overview",
    "generator/entity",
    "Entity SAP generator",
    "How do I generate SAP entity pages?",
    "pulse:nav/generator/entity",
    [
      "Open [SEO → Generator → Entity](pulse:nav/generator/entity).",
      "Configure entity/location pages and run SAP generation.",
    ],
    ["entity", "sap", "location pages"],
  ),
  pb(
    "generator/competitor/overview",
    "generator/competitor",
    "Competitor generator",
    "How do I run competitor content generation?",
    "pulse:nav/generator/competitor",
    [
      "Open [SEO → Generator → Competitor](pulse:nav/generator/competitor).",
      "Configure competitor research inputs and generate content.",
    ],
    ["competitor generator", "competitor content"],
  ),
  pb(
    "generator/flow/overview",
    "generator/flow",
    "Free Flow",
    "How do I use Free Flow?",
    "pulse:nav/generator/flow",
    [
      "Open [SEO → Generator → Flow](pulse:nav/generator/flow).",
      "Enter a freeform prompt and generate sectioned content in the Flow workspace.",
    ],
    ["free flow", "flow", "freeform writing"],
  ),
  pb(
    "generator/image/overview",
    "generator/image",
    "AI images",
    "How do I generate AI images?",
    "pulse:nav/generator/image",
    [
      "Open [SEO → Generator → Image](pulse:nav/generator/image).",
      "Enter image prompts and generate assets for content.",
    ],
    ["image generator", "ai images"],
  ),

  // generator/research
  pb(
    "generator/research/proposal",
    "generator/research",
    "Proposal research",
    "How do I run proposal research?",
    "pulse:nav/generator/research",
    [
      "Open [SEO → Generator → Research](pulse:nav/generator/research).",
      "Select the **Proposal** research section.",
      "Configure inputs and run the proposal research pipeline.",
    ],
    ["proposal", "proposal research"],
  ),
  pb(
    "generator/research/citation",
    "generator/research",
    "Citation research",
    "How do I run citation research?",
    "pulse:nav/generator/research",
    [
      "Open [SEO → Generator → Research](pulse:nav/generator/research).",
      "Select the **Citation** research section.",
      "Run citation discovery for the active property.",
    ],
    ["citation", "citation research"],
  ),
  pb(
    "generator/research/backlinking",
    "generator/research",
    "Backlinking research",
    "How do I run backlinking research?",
    "pulse:nav/generator/research",
    [
      "Open [SEO → Generator → Research](pulse:nav/generator/research).",
      "Select the **Backlinking** research section.",
      "Run backlink opportunity research.",
    ],
    ["backlinking", "backlink research"],
  ),
  pb(
    "generator/report/overview",
    "generator/report",
    "GSC reporting",
    "How do I view GSC reports?",
    "pulse:nav/generator/report",
    [
      "Open [SEO → Generator → Report](pulse:nav/generator/report).",
      "Select a connected property with GSC configured.",
      "Browse performance reporting tabs and date ranges.",
    ],
    ["gsc report", "reporting", "gsc reporting"],
  ),

  // sitemap-optimizer
  pb(
    "sitemap-optimizer/plan-mode",
    "sitemap-optimizer",
    "Plan mode",
    "How do I use Sitemap plan mode?",
    "pulse:nav/sitemap-optimizer",
    [
      "Open [SEO → Sitemap](pulse:nav/sitemap-optimizer).",
      "Select **Plan** mode in the workspace header.",
      "Cluster and plan URL groups before running optimization.",
    ],
    ["plan mode", "sitemap plan"],
  ),
  pb(
    "sitemap-optimizer/legacy-redirects",
    "sitemap-optimizer",
    "Legacy redirects",
    "How do I match legacy redirects?",
    "pulse:nav/sitemap-optimizer",
    [
      "Open [SEO → Sitemap](pulse:nav/sitemap-optimizer).",
      "Open the **Legacy redirects** section.",
      "Import or match old URLs to new sitemap URLs.",
    ],
    ["legacy redirects", "redirect match"],
  ),
  pb(
    "sitemap-optimizer/url-optimizer",
    "sitemap-optimizer",
    "URL optimizer",
    "How do I run the URL optimizer?",
    "pulse:nav/sitemap-optimizer",
    [
      "Open [SEO → Sitemap](pulse:nav/sitemap-optimizer).",
      "Open the **URL optimizer** section.",
      "Configure and run URL optimization on sitemap clusters.",
    ],
    ["url optimizer", "optimize urls"],
  ),
  pb(
    "vertical-benchmarks/overview",
    "vertical-benchmarks",
    "Industry verticals",
    "How do I use Industry verticals benchmarks?",
    "pulse:nav/vertical-benchmarks",
    [
      "Open [SEO → Industry verticals](pulse:nav/vertical-benchmarks).",
      "Select a property and vertical benchmark package.",
      "Export or run bulk CSV benchmark workflows.",
    ],
    ["vertical benchmarks", "industry verticals"],
  ),

  // social
  pb(
    "gbp-post/overview",
    "gbp-post",
    "GBP posts",
    "How do I publish a GBP post?",
    "pulse:nav/gbp-post",
    [
      "Open [Social → GBP](pulse:nav/gbp-post).",
      "Select a property with GBP connected.",
      "Configure post copy and publish to Google Business Profile.",
    ],
    ["gbp", "google business profile post", "publish gbp"],
  ),
  pb(
    "content-calendar/overview",
    "content-calendar",
    "Content calendar",
    "How do I use the content calendar?",
    "pulse:nav/content-calendar",
    [
      "Open [Social → Calendar](pulse:nav/content-calendar).",
      "Generate or edit AI content calendar rows for the active property.",
    ],
    ["content calendar", "calendar"],
  ),
  pb(
    "social-creator/overview",
    "social-creator",
    "Social creator",
    "How do I create social posts?",
    "pulse:nav/social-creator",
    [
      "Open [Social → Creator](pulse:nav/social-creator).",
      "Configure post copy and visuals, then generate organic social posts.",
    ],
    ["social creator", "organic posts", "social posts"],
  ),

  // ppc
  pb(
    "ppc-google/overview",
    "ppc-google",
    "Google PPC",
    "How do I build Google Search campaigns?",
    "pulse:nav/ppc-google",
    [
      "Open [PPC → Google](pulse:nav/ppc-google).",
      "Select a property and seed campaigns from WordPress pages and GSC queries.",
    ],
    ["google ads", "ppc google", "search campaigns"],
  ),
  pb(
    "ppc-meta/overview",
    "ppc-meta",
    "Meta PPC",
    "How do I build Meta feed ads?",
    "pulse:nav/ppc-meta",
    [
      "Open [PPC → Meta](pulse:nav/ppc-meta).",
      "Select a property and generate Meta ads from page copy and creatives.",
    ],
    ["meta ads", "facebook ads", "instagram ads"],
  ),

  // standalone
  pb(
    "integrations/connect-site",
    "integrations",
    "Connect WordPress",
    "How do I connect a WordPress site?",
    "pulse:nav/integrations",
    [
      "Open [Integrations](pulse:nav/integrations).",
      "Add or select a WordPress site tile.",
      "Enter site URL and application credentials, then save.",
    ],
    ["integrations", "wordpress connect", "connect site"],
  ),
  pb(
    "knowledge/upload-files",
    "knowledge",
    "Knowledge Base files",
    "How do I upload knowledge base files?",
    "pulse:nav/knowledge",
    [
      "Open [Knowledge Base](pulse:nav/knowledge).",
      "Upload files or paste manual text for RAG knowledge used in generation.",
    ],
    ["knowledge base", "upload files", "rag", "kb"],
  ),
  pb(
    "api/browse-docs",
    "api",
    "API docs",
    "How do I browse API documentation?",
    "pulse:nav/api",
    [
      "Open [API Docs](pulse:nav/api).",
      "Browse endpoint groups in the API documentation browser.",
    ],
    ["api docs", "api documentation", "endpoints"],
  ),
];

module.exports = { FEATURE_PLAYBOOKS };

---
title: Feature index
slug: god-mode/feature-index
section: God Mode
order: 5
---

<!-- manual -->

Exhaustive checklist of Flowbie Chat **God Mode** capabilities (Backend Assist). Use this page to review coverage. See linked pages for detail.

## A. Access and mode switching

1. **Visitor mode** — default public chat (RAG visitor pipeline)
2. **God Mode toggle** — toolbar Visitor / God Mode buttons
3. **Login gate** — God Mode only when `canBackendMode` (`is_user_logged_in()`)
4. **Default God Mode in wp-admin** — `defaultAdminMode: backend`
5. **Mode persistence** — `sessionStorage` key `flowbie_chat_admin_mode`
6. **Root CSS state** — `fcw--super-admin-mode` on widget root

## B. Ask / Plan / Build submodes

7. **Ask** — read-only; write tools blocked with Read-only mode card + `submode_switch: build`
8. **Plan** — write tools show plan preview; no execution
9. **Build** — full Backend Assist pipeline execution
10. **Submode pill UI** — composer chip cycles Ask → Plan → Build
11. **Shift+Tab shortcut** — cycle submodes
12. **Submode persistence** — `sessionStorage` key `flowbie_chat_admin_submode`
13. **Submode-specific greeting sublines** — empty-state copy changes per submode
14. **Stream status labels** — Analyzing… / Planning… / Working…
15. **Submode switch CTAs** — Switch to Build/Plan/Ask mode chips on cards
16. **Text switch commands** — "switch to build mode" etc. return composer guidance card
17. **Auto-rerun on Build switch** — pending message resent after switching from blocked card
18. **Classifier submode hints** — Ask/Plan/Build injected into classify prompt

## C. Chat UI (God Mode only or God Mode behavior)

19. **Backend conversation starters** (replace visitor starters):
    - What are visitors asking that we do not cover?
    - Top search queries this month
    - Pages with traffic but low engagement
    - GSC quick wins for this site (`manage_options` only)
20. **Site inventory CSV download** — toolbar link, includes drafts
21. **Site inventory warm on entry** — cache preloaded via REST
22. **Copy debug log** — logged-in users (`canCopyLog`)
23. **God Mode chat history persist** — `localStorage` `flowbie_godmode_chat_{userId}`, max 20 turns (WP Admin + God Mode)
24. **Debug log persist** — `localStorage` `flowbie_godmode_debug_log_{userId}`
25. **Source pills shown** even when UI setting hides them in Visitor mode
26. **CTA buttons not suppressed** in God Mode
27. **Prefetch disabled** in God Mode (suggestions/chips)
28. **Related topic chips** — from card `relatedTopics` / `suggested_actions`
29. **Undo link** on write action cards → `restore_post_revision`
30. **Edit / View links** on action cards when URLs returned

## D. Response card types

31. **answer** — read-only Q&A formatted card
32. **action** — write tool result with title/body/links
33. **plan** — proposed plan with steps (single-step or workflow)
34. **prompt** — needs-info / missing params card
35. **error / not-found** — failure cards
36. **Workflow plan cards** — multi-step decomposed workflows with step status
37. **Blocked read-only card** — Ask mode intercept for write tools
38. **Submode switch card** — composer pill guidance

## E. Pipeline and intelligence

39. **Intent classification** — action / needs_info / question
40. **Tool param planning** — `phase_plan` for copy generation
41. **Tool execution** — `phase_execute` via registry
42. **Result reasoning** — `phase_reason_action` / `phase_reason_question`
43. **Card formatting** — `phase_format` JSON cards
44. **Workflow decomposition** — multi-step create+content, create+SEO block, etc.
45. **Plan cache** — Plan/Build parity for body ops
46. **God Mode copy style rules** — LLM prompt constraints
47. **History-aware targeting** — `[post_id=X]` metadata + follow-up heading edits
48. **Current post context injection** — post_id, title, URL, type, status from widget body (Page scope)
49. **Page / Site target scope toggle** — God Mode toolbar; Site skips auto current-page binding (`target_scope`)
50. **Agent Hub SEO block builder context** — when editing a block in builder
51. **Site blog inventory summary** — injected for content-gap / ideation requests
52. **Early intent reroutes** in content prep:
    - Date modifier → `save_post_meta`
    - Clear ACF meta field → `save_post_meta`
    - SEO research brief → `run_seo_research_brief`
    - FAQ schema-only → `save_post_meta`
    - FAQ table-only → `add_content`
    - Undo/correction → `restore_post_revision`
    - Field instruction misroute → restore revision

## F. Read-only tools (11)

| # | Tool | Capability |
| --- | --- | --- |
| 52 | `get_chat_insights` | Visitor chat log summary, knowledge gaps (30d, admin) |
| 53 | `get_search_insights` | Site search popular + zero-result queries |
| 54 | `get_overseer_summary` | Behavioral analytics (sessions, pageviews, engagement) |
| 55 | `list_overseer_tasks` | Open Overseer actionable tasks |
| 56 | `get_site_inventory` | Full cached site content inventory |
| 57 | `analyze_content_gaps` | Blog inventory vs chat gaps → new content ideas |
| 58 | `grade_post_library_seo` | Full post library SEO grading audit |
| 59 | `get_gsc_context` | GSC keyword/query data for post or site |
| 60 | `list_posts` | Sample post list (not full inventory) |
| 61 | `get_post` | Single post details by id or title |
| 62 | `list_seo_blocks` | Agent Hub SEO blocks list |

## G. Write tools (13)

| # | Tool | Capability |
| --- | --- | --- |
| 63 | `create_page` | New WordPress page (draft default) |
| 64 | `create_post` | New WordPress post |
| 65 | `add_content` | Append/replace body HTML, or mode ops deterministic edits |
| 66 | `update_post` | post_title, status, excerpt, slug (not body, not SEO meta) |
| 67 | `save_post_meta` | focusKeyword, metaDescription, seoTitle, faq, seoResearch, dateModifier; clear fields |
| 68 | `run_seo_research_brief` | DataForSEO + GSC + Semrush → SeoContentBriefV1 → auto-save ACF |
| 69 | `restore_post_revision` | Undo last agent body edit snapshot |
| 70 | `compose_seo_block` | Generate/optimize/analyze full Agent Hub SEO block manifest |
| 71 | `modify_seo_block_slots` | Add/remove/update individual block slots |
| 72 | `create_seo_block` | New draft SEO block |
| 73 | `delete_seo_block` | Delete block by id |
| 74 | `save_seo_block` | Persist block manifest |
| 75 | `apply_seo_block_to_page` | Insert Elementor flowbie_seo_section widget on page |

## H. Compound / special runners (Build only)

76. **FAQ compound** — FAQ schema (ACF) + visible FAQ HTML table in one request  
77. **Body schema cleanup** — strip JSON-LD from body + save FAQ schema to meta  
78. **FAQ table append** — deterministic table append response path  
79. **Multi-step workflows** — saved workflow id, step execution, status polling  
80. **Elementor SEO block workflow** — compose → save → apply chain  
81. **Create + body content workflow** — create post/page then add_content steps  

## I. Body operations (14 deterministic ops via add_content mode ops)

82. `remove_section`  
83. `truncate_after_table`  
84. `remove_sections_after`  
85. `convert_section_to_table`  
86. `insert_table_in_section`  
87. `convert_list_in_section`  
88. `remove_table_in_section`  
89. `replace_section_html`  
90. `strip_json_ld`  
91. `wrap` (strong/em/link emphasis)  
92. `replace_text`  
93. `replace_heading` (history-aware intro H2 follow-ups)  
94. `add_internal_links`  
95. `insert_overview_links`  

## J. Classifier routing highlights (natural language → tool)

96. Post title rename → `update_post`  
97. SEO title → `save_post_meta.seoTitle`  
98. Focus keyword / meta description → `save_post_meta`  
99. Date modifier / set date today → `save_post_meta.dateModifier`  
100. Clear seo research / meta fields → `save_post_meta` clear  
101. Run/build SEO research brief → `run_seo_research_brief`  
102. FAQ schema only → `save_post_meta.faq`  
103. FAQ table in body → `add_content` append  
104. In-place body edits → `add_content` mode ops  
105. Publish/draft/status → `update_post.status`  
106. Slug change → `update_post.slug`  
107. Undo/revert → `restore_post_revision`  
108. GSC keywords → `get_gsc_context`  
109. Blog ideas / content gaps → `analyze_content_gaps`  
110. Post library SEO audit → `grade_post_library_seo`  
111. Visitor questions → `get_chat_insights`  
112. Site search analytics → `get_search_insights`  
113. Apply SEO block to page → `apply_seo_block_to_page`  

## K. Endpoints and integration

114. **Primary stream** — `POST admin-ajax.php?action=flowbie_chat_stream` with `admin_mode: backend`, `admin_submode`, `target_scope`, `message`, `history`, page context fields  
115. **`POST /flowbie/v1/backend-assist`** — direct pipeline (OpenRouter required)  
116. **`POST /flowbie/v1/backend-assist/step`** — workflow step execution  
117. **`GET /flowbie/v1/backend-assist/workflow/{id}/status`** — workflow status  
118. **`POST /flowbie/v1/backend-assist/undo`** — card undo  
119. **`GET/POST/DELETE /flowbie/v1/backend-assist/sessions`** — session persistence API  
120. **`GET /flowbie/v1/chat/site-inventory`** — inventory warm + CSV export  
121. **MCP wrappers** — `wp_assist_chat`, `wp_assist_workflow_status`, `wp_assist_workflow_step`  

## L. Permissions

122. **`edit_posts`** — Backend Assist REST + God Mode writes  
123. **`manage_options`** — chat insights, GSC quick wins starter  
124. **`edit_post` per post** — individual post edits  

## M. Related surfaces (same pipeline, different UI)

125. **Backend Assist admin page** — wp-admin standalone UI  
126. **Agent Hub agent tab** — SEO block workflow from builder  

## See also

- [Overview](overview)
- [Ask / Plan / Build](ask-plan-build)
- [Tools reference](tools)
- [Body operations](body-ops)
- [Endpoints](endpoints)

import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-pulse-edmonton-seo-type2");
let id = 2;

const search = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, search_text: "search." },
  id++,
);
const hero = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "2bbef65" },
  id++,
);
const body = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "c28b26d" },
  id++,
);
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, summary: true, max_depth: 1 },
  id++,
);
const htmlWidgets = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "html" },
  id++,
);
const cssWidgets = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "css" },
  id++,
);
const classes = await callTool(session, "emcp-tools-list-global-classes", {}, id++);

const heroSettings = hero.data?.settings || hero.data || {};
const bodySettings = body.data?.settings || body.data || {};

process.stdout.write(
  `${JSON.stringify(
    {
      search,
      heroKeys: Object.keys(heroSettings),
      heroTypo: Object.fromEntries(
        Object.entries(heroSettings).filter(([key]) => /font|typo|header|title|size|css|class/i.test(key)),
      ),
      bodyKeys: Object.keys(bodySettings),
      bodyTypo: Object.fromEntries(
        Object.entries(bodySettings).filter(([key]) => /font|typo|css|class|align/i.test(key)),
      ),
      structureTop: structure.data,
      htmlWidgets: htmlWidgets.data,
      cssWidgets: cssWidgets.data,
      classCount: Array.isArray(classes.data) ? classes.data.length : Object.keys(classes.data || {}).length,
      classSample: Array.isArray(classes.data) ? classes.data.slice(0, 8) : classes.data,
    },
    null,
    2,
  )}\n`,
);

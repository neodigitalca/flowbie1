import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const FIRST = "c28b26d";
const CLEAR_TYPO = {
  typography_typography: "",
  typography_font_family: "",
  typography_font_weight: "",
  typography_font_size: { size: "", unit: "px" },
  typography_line_height: { size: "", unit: "em" },
  typography_letter_spacing: { size: "", unit: "px" },
  __globals__: { typography_typography: "" },
};
const CLEAR_IDS = [
  "ba7052d",
  "e2ce6fe",
  "9474c98",
  "7364af0",
  "87b6a1e",
  "57f245d",
  "7589027",
  "c39f660",
  "83e5dc0",
  "8aa7d6a",
  "70e07df",
  "4ba13e3",
  "31623fb",
  "d223b97",
  "04beb11",
  "a6be487",
  "2d32259",
  "a6643f1",
  "125d61b",
  "6386b7f",
  "1c9e7eb",
];

const session = await openEmcp("neo-pulse-edmonton-seo-revert-one");
let n = 2;

await callTool(
  session,
  "emcp-tools-update-page-settings",
  { post_id: POST_ID, settings: { custom_css: "" } },
  n++,
);

await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "2bbef65",
    settings: {
      ...CLEAR_TYPO,
      __globals__: { typography_typography: "globals/typography?id=98b283e" },
    },
  },
  n++,
);

await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "4f337d2",
    settings: {
      typography_typography: "custom",
      typography_font_family: "",
      typography_font_weight: "500",
      typography_font_size: { size: 16, unit: "px" },
      typography_line_height: { size: "", unit: "em" },
      typography_letter_spacing: { size: "", unit: "px" },
      __globals__: { typography_typography: "", title_color: "globals/colors?id=ygency_secondary" },
    },
  },
  n++,
);

await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "79b72fd",
    settings: {
      ...CLEAR_TYPO,
      __globals__: {
        title_color: "globals/colors?id=ygency_dark",
        typography_typography: "globals/typography?id=text",
      },
    },
  },
  n++,
);

const cleared = [];
for (const element_id of CLEAR_IDS) {
  const res = await callTool(
    session,
    "emcp-tools-update-element",
    { post_id: POST_ID, element_id, settings: CLEAR_TYPO },
    n++,
  );
  cleared.push({ element_id, success: res.data?.success === true });
}

const first = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: FIRST,
    settings: {
      typography_typography: "custom",
      typography_font_family: "Lato",
      typography_font_size: { size: 1, unit: "rem" },
      typography_font_weight: "400",
      typography_line_height: { size: 1.5, unit: "em" },
      typography_letter_spacing: { size: 0, unit: "px" },
      __globals__: { typography_typography: "" },
    },
  },
  n++,
);

const afterFirst = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: FIRST },
  n++,
);
const afterHero = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "2bbef65" },
  n++,
);
const firstSettings = afterFirst.data?.settings || afterFirst.data || {};
const heroSettings = afterHero.data?.settings || afterHero.data || {};

process.stdout.write(
  `${JSON.stringify(
    {
      clearedOk: cleared.filter((row) => row.success).length,
      first: first.data,
      firstFamily: firstSettings.typography_font_family || null,
      firstSize: firstSettings.typography_font_size || null,
      heroTitle: heroSettings.title || null,
      heroGlobals: heroSettings.__globals__ || null,
      heroFamily: heroSettings.typography_font_family || null,
    },
    null,
    2,
  )}\n`,
);

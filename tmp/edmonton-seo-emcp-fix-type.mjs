import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const TEXT_IDS = [
  "c28b26d",
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
const P_HEADING_IDS = ["4f337d2", "79b72fd"];
const P_TYPO = {
  typography_typography: "custom",
  typography_font_family: "Lato",
  typography_font_size: { size: 1, unit: "rem" },
  typography_font_weight: "400",
  typography_line_height: { size: 1.5, unit: "em" },
  typography_letter_spacing: { size: 0, unit: "px" },
  __globals__: { typography_typography: "" },
};
const H1_TYPO = {
  typography_typography: "custom",
  typography_font_family: "Lato",
  typography_font_size: { size: 2, unit: "rem" },
  typography_font_weight: "700",
  typography_line_height: { size: 1.25, unit: "em" },
  typography_letter_spacing: { size: 0, unit: "px" },
  __globals__: { typography_typography: "" },
};
const PAGE_CSS = `selector p {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
  font-weight: 400 !important;
}
selector .elementor-heading-title {
  font-family: "Lato", sans-serif !important;
  letter-spacing: 0 !important;
}`;

const session = await openEmcp("neo-pulse-edmonton-seo-fix-type");
let id = 2;
const updated = [];

const page = await callTool(
  session,
  "emcp-tools-update-page-settings",
  { post_id: POST_ID, settings: { custom_css: PAGE_CSS } },
  id++,
);
updated.push({ kind: "page", data: page.data });

const hero = await callTool(
  session,
  "emcp-tools-update-element",
  { post_id: POST_ID, element_id: "2bbef65", settings: H1_TYPO },
  id++,
);
updated.push({ kind: "h1", id: "2bbef65", data: hero.data });

for (const element_id of [...TEXT_IDS, ...P_HEADING_IDS]) {
  const res = await callTool(
    session,
    "emcp-tools-update-element",
    { post_id: POST_ID, element_id, settings: P_TYPO },
    id++,
  );
  updated.push({ kind: "p", id: element_id, success: res.data?.success === true });
}

const afterHero = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "2bbef65" },
  id++,
);
const afterBody = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "c28b26d" },
  id++,
);
const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/?nonitro=1", max_bytes: 200000 },
  id++,
);
const blob = JSON.stringify(html.data);
const heroSettings = afterHero.data?.settings || afterHero.data || {};
const bodySettings = afterBody.data?.settings || afterBody.data || {};

process.stdout.write(
  `${JSON.stringify(
    {
      page,
      heroSuccess: hero.data,
      pUpdated: updated.filter((row) => row.kind === "p").filter((row) => row.success).length,
      pFailed: updated.filter((row) => row.kind === "p").filter((row) => !row.success).map((row) => row.id),
      heroFamily: heroSettings.typography_font_family || null,
      heroSize: heroSettings.typography_font_size || null,
      heroGlobals: heroSettings.__globals__ || null,
      bodyFamily: bodySettings.typography_font_family || null,
      bodySize: bodySettings.typography_font_size || null,
      htmlHasLato: blob.includes("Lato"),
      htmlHasHeading: blob.includes("Edmonton SEO built for local search."),
    },
    null,
    2,
  )}\n`,
);

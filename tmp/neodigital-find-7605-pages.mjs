import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-find-template-usage");
const pages = [
  "7581", // Webflow Development
  "7368", // Window Coverings Marketing
  "4017", // Website Design
  "10398", // Webflow Development 
  "10396", // Shopify Development
  "10401", // Google Ads
  "10439", // Local SEO
  "10403", // Graphic Design
  "131", // Our Services
];

for (const p of pages) {
  const f = await callTool(
    session,
    "emcp-tools-find-element",
    { post_id: Number(p), text: "Have Any Projects" },
    2,
  );
  if (f.data?.matches && f.data.matches.length > 0) {
    console.log(`Page ${p} has text match directly`);
  } else {
    // check if it has a template widget referencing 7605
    const struct = await callTool(
      session,
      "emcp-tools-get-page-structure",
      { post_id: Number(p), max_depth: 6 },
      3,
    );
    const s = JSON.stringify(struct.data || {});
    if (s.includes("7605")) {
      console.log(`Page ${p} embeds template 7605!`);
    }
  }
}

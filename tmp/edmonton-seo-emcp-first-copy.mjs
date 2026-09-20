import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const FIRST = "c28b26d";
const EDITOR = [
  "<p>\"Neo Digital helped us show up for the Edmonton searches that actually fill the calendar.\"</p>",
  "<p>Proof is the <a href=\"https://neodigital.ca/our-work/blind-magic/\">Blind Magic</a> case study: site clicks 4,066 to 11,382, impressions 460k to 1.16M, average position 31.5 to 20.0.</p>",
  "<p>Most local sites still need <a href=\"https://neodigital.ca/website-design/\">website design</a> first. <a href=\"https://neodigital.ca/contact/\">Contact Neo Digital</a> to start the Edmonton program.</p>",
  "<p>The program starts with <a href=\"https://neodigital.ca/local-seo/\">maps and Google Business Profile</a>, then <a href=\"https://neodigital.ca/blog/local-digital-presence-that-converts/\">citations and NAP cleanup</a> so Name, Address, and Phone match everywhere a buyer checks.</p>",
  "<p>We add <a href=\"https://neodigital.ca/blog/build-digital-presence/\">Edmonton link building</a> and run a <a href=\"https://neodigital.ca/blog/local-seo-2/\">local pack checklist</a> so map ranks are earned, not guessed. Owners who want a longer retainer can take the <a href=\"https://neodigital.ca/blog/edmonton-seo-partner/\">small business partner path</a>.</p>",
].join("");

const session = await openEmcp("neo-pulse-edmonton-seo-first-copy");
const updated = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: FIRST,
    settings: {
      editor: EDITOR,
      typography_typography: "custom",
      typography_font_family: "Lato",
      typography_font_size: { size: 1, unit: "rem" },
      typography_font_weight: "400",
      typography_line_height: { size: 1.5, unit: "em" },
      typography_letter_spacing: { size: 0, unit: "px" },
      __globals__: { typography_typography: "" },
    },
  },
  2,
);
const after = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: FIRST },
  3,
);
const editor = after.data?.settings?.editor || after.data?.editor || "";
process.stdout.write(
  `${JSON.stringify(
    {
      update: updated.data,
      hasRelatedLabel: String(editor).includes("Related reading"),
      linkCount: String(editor).split("<a ").length - 1,
      editor,
    },
    null,
    2,
  )}\n`,
);

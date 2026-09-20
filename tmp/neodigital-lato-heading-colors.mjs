import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const session = await openEmcp("neo-pulse-heading-colors");
const before = await callTool(session, "emcp-tools-get-global-settings", {}, 2);
const s = before.data?.settings || {};
const colorKeys = [
  "body_color",
  "h1_color",
  "h2_color",
  "h3_color",
  "h4_color",
  "h5_color",
  "h6_color",
  "h1_typography_font_family",
  "h2_typography_font_family",
  "h3_typography_font_family",
];
const current = Object.fromEntries(colorKeys.map((key) => [key, s[key]]));

const WHITE = "#FFFFFF";
const updated = await callTool(
  session,
  "emcp-tools-update-page-settings",
  {
    post_id: KIT_ID,
    settings: {
      h1_color: WHITE,
      h2_color: WHITE,
      h3_color: WHITE,
      h4_color: WHITE,
      h5_color: WHITE,
      h6_color: WHITE,
    },
  },
  3,
);

const after = await callTool(session, "emcp-tools-get-global-settings", {}, 4);
const a = after.data?.settings || {};

process.stdout.write(
  `${JSON.stringify(
    {
      current,
      updated: updated.data,
      after: {
        h1: a.h1_color,
        h2: a.h2_color,
        h3: a.h3_color,
        h4: a.h4_color,
        body: a.body_color,
        h1Family: a.h1_typography_font_family,
        h2Family: a.h2_typography_font_family,
      },
    },
    null,
    2,
  )}\n`,
);

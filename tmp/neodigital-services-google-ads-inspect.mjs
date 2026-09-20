import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-google-ads-inspect");
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "a4c0ff0" },
  2,
);
const s = settings.data?.settings || {};
process.stdout.write(
  `${JSON.stringify(
    {
      title_text: s.title_text,
      title_tag: s.title_tag,
      icon_position: s.icon_position,
      icon_inline: s.icon_inline,
      title_typography: {
        family: s.title_typography_font_family,
        size: s.title_typography_font_size,
        weight: s.title_typography_font_weight,
      },
    },
    null,
    2,
  )}\n`,
);

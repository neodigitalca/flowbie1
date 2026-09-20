import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-lato-tokens");
const replaced = await callTool(
  session,
  "emcp-tools-replace-system-typography",
  {
    typography: {
      primary: {
        title: "Primary",
        font_family: "Roboto",
        font_weight: "600",
      },
      secondary: {
        title: "Secondary",
        font_family: "Roboto Slab",
        font_weight: "400",
      },
      text: {
        title: "Text",
        font_family: "Lato",
        font_weight: "400",
        font_size: { size: 1, unit: "rem" },
        line_height: { size: 1.5, unit: "em" },
      },
      accent: {
        title: "Accent",
        font_family: "Poppins",
        font_weight: "700",
        font_size: { size: 1.125, unit: "rem" },
        line_height: { size: 1, unit: "em" },
      },
    },
  },
  2,
);

const after = await callTool(session, "emcp-tools-get-global-settings", {}, 3);
const settings = after.data?.settings || {};

process.stdout.write(
  `${JSON.stringify(
    {
      replaced: replaced.data,
      typography: after.data?.typography,
      bodyFamily: settings.body_typography_font_family,
      bodySize: settings.body_typography_font_size,
      customCssHasLato: String(settings.custom_css || "").includes("Lato"),
    },
    null,
    2,
  )}\n`,
);

import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-edmonton-seo-check-css");
const css = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/wp-content/uploads/elementor/css/post-10203.css", max_bytes: 220000 },
  2,
);
const page = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/?nonitro=1", max_bytes: 80000 },
  3,
);
const cssBlob = JSON.stringify(css.data);
const pageBlob = JSON.stringify(page.data);
const cssAt = cssBlob.indexOf("c28b26d");
const latoAt = cssBlob.indexOf("Lato");
const pageLato = pageBlob.indexOf("Lato");
process.stdout.write(
  `${JSON.stringify(
    {
      cssTarget: css.data?.target || null,
      cssHasWidget: cssAt >= 0,
      cssHasLato: latoAt >= 0,
      widgetCss: cssAt >= 0 ? cssBlob.slice(cssAt, cssAt + 500) : cssBlob.slice(0, 400),
      latoCss: latoAt >= 0 ? cssBlob.slice(Math.max(0, latoAt - 80), latoAt + 80) : "",
      pageHasLato: pageLato >= 0,
      pageLatoCtx: pageLato >= 0 ? pageBlob.slice(Math.max(0, pageLato - 80), pageLato + 80) : "",
    },
    null,
    2,
  )}\n`,
);

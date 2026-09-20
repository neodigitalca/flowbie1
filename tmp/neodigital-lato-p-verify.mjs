import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-lato-verify");
let id = 2;

const g = await callTool(session, "emcp-tools-get-global-settings", {}, id++);
const s = g.data?.settings || {};
const home = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/?nonitro=1", max_bytes: 220000 },
  id++,
);
const homeBlob = JSON.stringify(home.data);
const cssUrls = [];
const re = /https:\/\/neodigital\.ca\/wp-content\/uploads\/elementor\/css\/[^"'\\]+/g;
let match;
while ((match = re.exec(homeBlob)) && cssUrls.length < 12) cssUrls.push(match[0]);

const latoAt = homeBlob.indexOf("Lato");
const floorAt = homeBlob.indexOf("max(1rem");
const pAt = homeBlob.indexOf(".elementor-widget p");

process.stdout.write(
  `${JSON.stringify(
    {
      typography: g.data?.typography,
      bodyFamily: s.body_typography_font_family,
      bodySize: s.body_typography_font_size,
      customCssLen: String(s.custom_css || "").length,
      customCssHasLato: String(s.custom_css || "").includes("Lato"),
      homeLatoAt: latoAt,
      homeFloorAt: floorAt,
      homePAt: pAt,
      homeLatoCtx: latoAt >= 0 ? homeBlob.slice(Math.max(0, latoAt - 40), latoAt + 80) : "",
      cssUrls,
    },
    null,
    2,
  )}\n`,
);

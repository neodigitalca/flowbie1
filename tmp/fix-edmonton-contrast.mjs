import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const KIT_ID = 5564;
const session = await openEmcp("fix-edmonton-contrast");

const globals = await callTool(session, "emcp-tools-get-global-settings", {}, 1);
let customCss = globals.data?.custom_css || globals.data?.settings?.custom_css || "";
if (!customCss) throw new Error("Kit custom_css missing");

const oldBlock = `background-color: rgba(132, 189, 0, 0.65) !important;
  border: 2px solid #84BD00 !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;`;

const newBlock = `background-color: #84BD00 !important;
  border: 2px solid #84BD00 !important;`;

if (!customCss.includes("rgba(132, 189, 0, 0.65)")) {
  console.log("Kit CTA already opaque or pattern changed");
} else {
  customCss = customCss.replace(oldBlock, newBlock);
  const kit = await callTool(
    session,
    "emcp-tools-update-page-settings",
    { post_id: KIT_ID, settings: { custom_css: customCss } },
    2,
  );
  console.log("Kit update:", kit.data);
}

const footerRes = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 163, element_id: "6769ac6" },
  3,
);
let footerHtml = footerRes.data?.settings?.html || "";
if (!footerHtml) throw new Error("Footer HTML missing");

footerHtml = footerHtml
  .replace(/\.neo-footer-legal \{\s*\n[^}]*color: #6c727d !important;/, `.neo-footer-legal {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  color: #c5cad3 !important;`)
  .replace(/font-size: 0\.875rem !important;\s*\n  color: #6c727d !important;/, `font-size: 1rem !important;
  color: #c5cad3 !important;`)
  .replace(/\.neo-footer-heading \{\s*\n[^}]*font-size: 0\.875rem !important;/, (m) =>
    m.replace("0.875rem", "1rem"),
  );

const footerUpdate = await callTool(
  session,
  "emcp-tools-update-element",
  { post_id: 163, element_id: "6769ac6", settings: { html: footerHtml } },
  4,
);
console.log("Footer strip update:", footerUpdate.data);

const btnUpdate = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: 10203,
    element_id: "249a4df",
    settings: {
      button_bg: "#84BD00",
      button_color: "#02050A",
      border_color: "#84BD00",
      __globals__: {
        button_bg: "",
        button_color: "",
        border_color: "",
        button_hover_bg: "globals/colors?id=ygency_tertiary",
        button_hover_color: "globals/colors?id=ygency_secondary",
        hover_border_color: "globals/colors?id=ygency_secondary",
        typography_typography: "globals/typography?id=accent",
      },
    },
  },
  5,
);
console.log("Hero button update:", btnUpdate.data);

const phpFlush = `
if ( class_exists( '\\Elementor\\Plugin' ) ) {
    \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok' => true));
`;
console.log("Flush:", await runNeodigitalPhp(phpFlush, "flush-after-contrast"));

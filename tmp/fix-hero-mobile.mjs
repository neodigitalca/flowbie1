import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;

async function run() {
  const session = await openEmcp("neo-fix-hero-mobile");
  let seq = 1;

  const mobileHeroCss = `selector .elementor-widget-image img {
  max-width: 100%;
  height: auto;
  max-height: 220px;
  object-fit: cover;
  border-radius: 8px;
}
selector .elementor-element-355952b img {
  max-height: 48px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}
@media (max-width: 767px) {
  selector {
    flex-direction: column !important;
  }
  selector > .e-con {
    width: 100% !important;
    max-width: 100% !important;
  }
}`;

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "afa170d",
      settings: {
        padding: { unit: "px", top: "100", right: "0", bottom: "48", left: "0", isLinked: false },
        padding_mobile: { unit: "px", top: "88", right: "0", bottom: "32", left: "0", isLinked: false },
        margin_mobile: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "9806fc2",
      settings: {
        padding_mobile: { unit: "px", top: "0", right: "16", bottom: "0", left: "16", isLinked: false },
        flex_gap_mobile: { unit: "px", size: 20, column: "20", row: "20", isLinked: true },
        width_mobile: { unit: "%", size: 100, sizes: [] },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "8912c61",
      settings: {
        align: "left",
        align_mobile: "left",
        title_color: "#FFFFFF",
        typography_typography: "custom",
        typography_font_size_mobile: { unit: "px", size: 28, sizes: [] },
        typography_line_height_mobile: { unit: "em", size: 1.2, sizes: [] },
        typography_font_weight: "700",
        _margin_mobile: { unit: "px", top: "0", right: "0", bottom: "8", left: "0", isLinked: false },
        __globals__: { title_color: "" },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "4101a06",
      settings: {
        flex_direction_mobile: "column",
        flex_align_items_mobile: "stretch",
        flex_gap_mobile: { unit: "px", size: 24, column: "24", row: "24", isLinked: true },
        padding_mobile: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
        width_mobile: { unit: "%", size: 100, sizes: [] },
        custom_css: mobileHeroCss,
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "e8af43f",
      settings: {
        width_mobile: { unit: "%", size: 100, sizes: [] },
        padding_mobile: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
        flex_gap_mobile: { unit: "px", size: 16, column: "16", row: "16", isLinked: true },
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "bb9c5ef",
      settings: {
        width_mobile: { unit: "%", size: 100, sizes: [] },
        padding_mobile: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
        flex_align_items_mobile: "center",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "355952b",
      settings: {
        width: { unit: "px", size: 160, sizes: [] },
        width_mobile: { unit: "px", size: 140, sizes: [] },
        align_mobile: "left",
      },
    },
    seq++,
  );

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "f51d2a0",
      settings: {
        flex_direction_mobile: "column",
        width_mobile: { unit: "%", size: 100, sizes: [] },
        custom_css: `@media (max-width: 767px) {
  selector > .e-con {
    flex-direction: column !important;
    max-width: 100% !important;
  }
  selector > .e-con > .elementor-widget-image {
    flex: 0 1 auto;
    max-width: 100% !important;
    width: 100% !important;
  }
  selector > .e-con > .elementor-widget-image img {
    max-height: 200px;
  }
}`,
      },
    },
    seq++,
  );

  for (const rowId of ["4c1e062", "f7b6948", "e997763", "2d20944", "c8ba8a3", "b79ecfb", "d65ad74", "e0a0811", "069484a"]) {
    await callTool(
      session,
      "emcp-tools-update-element",
      {
        post_id: POST_ID,
        element_id: rowId,
        settings: {
          flex_direction_mobile: "column",
          width_mobile: { unit: "%", size: 100, sizes: [] },
          margin_mobile: { unit: "px", top: "0", right: "0", bottom: "28", left: "0", isLinked: false },
        },
      },
      seq++,
    );
  }

  await runNeodigitalPhp(
    `if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok'=>true));`,
    "oneshot-flush-mobile",
  );
  console.log("Mobile hero + steps layout updated.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

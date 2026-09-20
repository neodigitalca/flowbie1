import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 10203;

const IMAGE_IDS = [
  "61debcc",
  "3a00fb0",
  "ba18a21",
  "a0adeba",
  "7c91a12",
  "eb020ed",
  "7c91a14",
  "0299b5a",
  "8e67bb9",
];

const ROW_IDS = [
  "4c1e062",
  "f7b6948",
  "e997763",
  "2d20944",
  "c8ba8a3",
  "b79ecfb",
  "d65ad74",
  "e0a0811",
  "069484a",
];

const F51_CSS = `selector > .e-con > .e-con.e-child {
  flex: 1 1 55%;
  min-width: 0;
  max-width: 62%;
}
selector > .e-con > .elementor-widget-image {
  flex: 0 1 360px;
  max-width: min(38%, 360px);
  width: 100%;
  align-self: center;
}
selector > .e-con > .elementor-widget-image img {
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: cover;
  object-position: center;
  display: block;
  border-radius: 8px;
}`;

const IMAGE_SETTINGS = {
  image_size: "medium_large",
  width: { unit: "%", size: 100, sizes: [] },
  _element_width: "initial",
  _element_custom_width: { unit: "px", size: 360, sizes: [] },
  _transform_rotateZ_effect: { unit: "deg", size: 0, sizes: [] },
  _transform_rotateZ_effect_tablet: { unit: "deg", size: 0, sizes: [] },
  _transform_rotateZ_effect_mobile: { unit: "deg", size: 0, sizes: [] },
  _transform_translateX_effect: { unit: "px", size: 0, sizes: [] },
  _transform_translateY_effect: { unit: "px", size: 0, sizes: [] },
  align: "center",
};

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const session = await openEmcp("neo-fix-f51-scale-v2");
  let seq = 1;

  console.log("Update f51d2a0 CSS + boxed width");
  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: POST_ID,
      element_id: "f51d2a0",
      settings: {
        content_width: "boxed",
        width: { unit: "px", size: 1140, sizes: [] },
        flex_direction: "column",
        flex_align_items: "center",
        custom_css: F51_CSS,
      },
    },
    seq++,
  );

  for (const id of IMAGE_IDS) {
    console.log("Image", id);
    await callTool(
      session,
      "emcp-tools-update-element",
      { post_id: POST_ID, element_id: id, settings: IMAGE_SETTINGS },
      seq++,
    );
    await sleep(400);
  }

  for (const id of ROW_IDS) {
    console.log("Row", id);
    await callTool(
      session,
      "emcp-tools-update-element",
      {
        post_id: POST_ID,
        element_id: id,
        settings: {
          max_width: { unit: "px", size: 1140, sizes: [] },
          flex_align_items: "center",
          flex_gap: { unit: "px", size: 32, column: "32", row: "32", isLinked: true },
          padding: { unit: "px", top: "24", right: "24", bottom: "24", left: "24", isLinked: true },
          margin: { unit: "px", top: "0", right: "0", bottom: "32", left: "0", isLinked: false },
        },
      },
      seq++,
    );
    await sleep(300);
  }

  await runNeodigitalPhp(
    `if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok'=>true));`,
    "oneshot-flush-f51-scale-v2",
  );
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const GRID = "86db9e8";
const PEOPLE = [
  {
    title_text: "Matt Dimopoulos",
    description_text: "Co-Founder",
    image: {
      url: "https://neodigital.ca/wp-content/uploads/2025/09/Matt-Neo.jpg",
      id: 7539,
      source: "library",
    },
  },
  {
    title_text: "Bob Runcer",
    description_text: "Co-Founder",
    image: {
      url: "https://neodigital.ca/wp-content/uploads/2026/03/Bob-Runcer-New.jpg",
      id: 7923,
      source: "library",
    },
  },
  {
    title_text: "Sean Craig",
    description_text: "Lead AI & SEO Developer",
    image: {
      url: "https://neodigital.ca/wp-content/uploads/2026/03/Sean-Craig-Photo.jpg",
      id: 7922,
      source: "library",
    },
  },
  {
    title_text: "Cathleen Kelly",
    description_text: "Accounting",
    image: {
      url: "https://neodigital.ca/wp-content/uploads/2026/03/Cathleen.jpg",
      id: 7924,
      source: "library",
    },
  },
  {
    title_text: "Joe",
    description_text: "Neo Mascot",
    image: {
      url: "https://neodigital.ca/wp-content/uploads/2026/03/Joe.jpg",
      id: 7926,
      source: "library",
    },
  },
];
const WRAPPERS = ["94135cd", "750d915", "f38b8d3", "2cf7772", "b0adc17"];

const session = await openEmcp("neo-pulse-about-team-widgets");
let id = 2;
const added = [];
for (let i = 0; i < PEOPLE.length; i++) {
  const person = PEOPLE[i];
  const res = await callTool(
    session,
    "emcp-tools-add-free-widget",
    {
      post_id: POST_ID,
      parent_id: GRID,
      position: i,
      widget_type: "image-box",
      settings: {
        image: person.image,
        title_text: person.title_text,
        description_text: person.description_text,
        title_size: "h3",
        position: "top",
        title_color: "#FFFFFF",
        description_color: "#C8C8C8",
        align: "center",
      },
    },
    id++,
  );
  added.push({ title: person.title_text, ok: res.data });
}

const removed = [];
for (const element_id of WRAPPERS) {
  const res = await callTool(
    session,
    "emcp-tools-remove-element",
    { post_id: POST_ID, element_id },
    id++,
  );
  removed.push({ id: element_id, ok: res.data?.success === true });
}

const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "image-box" },
  id++,
);
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 6 },
  id++,
);
const blob = JSON.stringify(structure.data);
const gridAt = blob.indexOf("86db9e8");

process.stdout.write(
  `${JSON.stringify(
    {
      added,
      removed,
      boxes: found.data?.matches || found.data,
      stillHasWrappers: WRAPPERS.some((w) => blob.includes(`"${w}"`)),
      gridSlice: gridAt >= 0 ? blob.slice(gridAt, gridAt + 1600) : "",
    },
    null,
    2,
  )}\n`,
);

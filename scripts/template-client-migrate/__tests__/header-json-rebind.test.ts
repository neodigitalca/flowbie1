import { describe, expect, it } from "vitest";
import {
  BLIND_MAGIC_REPLACEMENTS,
  rebindHeaderJson,
  replaceStrings,
} from "../lib/header-json-rebind.mjs";

const tree = [
  {
    id: "top",
    elType: "container",
    elements: [
      {
        id: "logo",
        elType: "widget",
        widgetType: "image",
        settings: {
          image: { id: 99, url: "https://blindswebsitet.wpenginepowered.com/logo-drc.png", alt: "DRC logo" },
        },
      },
      {
        id: "nav",
        elType: "widget",
        widgetType: "nav-menu",
        settings: { menu: "12" },
      },
      {
        id: "mobile",
        elType: "widget",
        widgetType: "jet-mobile-menu",
        settings: { menu: "12", mobile_menu: "12" },
      },
      {
        id: "mega",
        elType: "widget",
        widgetType: "jet-mega-menu",
        settings: { menu: "60", "mobile-menu": "60" },
      },
      {
        id: "sale",
        elType: "widget",
        widgetType: "icon-list",
        settings: {
          icon_list: [
            {
              text: "See What's On Sale",
              link: { url: "https://blindswebsitet.wpenginepowered.com/promotion/" },
            },
          ],
        },
      },
      {
        id: "phone",
        elType: "widget",
        widgetType: "heading",
        settings: { title: "Call or Text: (800) 610-0331" },
      },
    ],
  },
];

describe("rebindHeaderJson", () => {
  it("binds menu 39, logo, promotions URL, and strips DRC strings", () => {
    const out = rebindHeaderJson(tree, {
      menuId: 39,
      logo: { id: 555, url: "https://blindmagic.com/wp-content/uploads/logo.png" },
      promotionsUrl: "https://blindmagic.com/promotions/",
      replacements: BLIND_MAGIC_REPLACEMENTS,
    });
    const json = JSON.stringify(out);
    expect(json).toContain('"menu":"39"');
    expect(json).toContain('"mobile_menu":"39"');
    expect(json).toContain('"id":555');
    expect(json).toContain("https://blindmagic.com/promotions/");
    expect(json).toContain("(780) 484-2390");
    expect(json).not.toContain("610-0331");
    expect(json).not.toContain("blindswebsitet.wpenginepowered.com");
  });
});

describe("replaceStrings", () => {
  it("replaces longest leftover phrases first", () => {
    const out = replaceStrings("info@drcentre.ca on blindswebsitet.wpenginepowered.com", BLIND_MAGIC_REPLACEMENTS);
    expect(out).toBe("hello@blindmagic.com on blindmagic.com");
  });
});

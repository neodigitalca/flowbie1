import { describe, expect, it } from "vitest";
import { restAcfFromFullPost } from "../fields-client";

describe("restAcfFromFullPost", () => {
  it("reads flowbie_fields when acf is absent", () => {
    const post = {
      id: 1,
      flowbie_fields: {
        keyword_focus: "window blinds",
        seo_research: "brief",
      },
    };
    const fields = restAcfFromFullPost(post);
    expect(fields.keyword_focus).toBe("window blinds");
    expect(fields.seo_research).toBe("brief");
  });

  it("prefers acf over flowbie_fields when both present", () => {
    const post = {
      acf: { keyword_focus: "from acf" },
      flowbie_fields: { keyword_focus: "from flowbie" },
    };
    expect(restAcfFromFullPost(post).keyword_focus).toBe("from acf");
  });

  it("returns empty object when neither key is set", () => {
    expect(restAcfFromFullPost({ id: 2 })).toEqual({});
    expect(restAcfFromFullPost(null)).toEqual({});
  });
});

describe("flowbie_fields-only REST inventory shape", () => {
  it("inventory row acf can be sourced from flowbie_fields via restAcfFromFullPost", () => {
    const wpRestPost = {
      id: 42,
      link: "https://example.com/services/",
      title: { rendered: "Services" },
      flowbie_fields: {
        keyword_focus: "local seo",
        meta_description: "Meta from fields",
      },
    };
    const acf = restAcfFromFullPost(wpRestPost);
    expect(acf.keyword_focus).toBe("local seo");
    expect(acf.meta_description).toBe("Meta from fields");
    expect(wpRestPost.acf).toBeUndefined();
  });
});

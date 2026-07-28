import { describe, expect, it } from "vitest";
import { parseUrlOptimizerInputCsv } from "@/lib/url-optimizer/parse-url-optimizer-input-csv";

describe("parseUrlOptimizerInputCsv", () => {
  it("preserves row order and ignores prefilled new_url column", () => {
    const csv = `Top pages,new_url,Clicks,Impressions,CTR,Position
https://www.kwbllp.com/a/,,0,100,0%,10
https://www.kwbllp.com/b/,https://www.kwbllp.com/blog/ignore-me/,0,200,0%,20`;

    const parsed = parseUrlOptimizerInputCsv(csv);
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.page).toBe("https://www.kwbllp.com/a/");
    expect(parsed.rows[0]?.csvUploadRow).toBe(1);
    expect(parsed.rows[1]?.page).toBe("https://www.kwbllp.com/b/");
    expect(parsed.rows[1]?.impressions).toBe(200);
  });
});

import { describe, expect, it } from "vitest";
import { isWorkerProgressNoise } from "../../../../scripts/post-creator-server-jobs.mjs";

describe("isWorkerProgressNoise", () => {
  it("drops NODE_TLS_REJECT_UNAUTHORIZED warnings", () => {
    expect(
      isWorkerProgressNoise(
        "(node:30860) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification. (Use `node --trace-warnings ...` to show where the warning was created)",
      ),
    ).toBe(true);
  });

  it("keeps real worker progress", () => {
    expect(isWorkerProgressNoise("Post creator server job started")).toBe(false);
    expect(isWorkerProgressNoise("1 post URLs loaded, KW JSON (496 keywords)")).toBe(false);
  });
});

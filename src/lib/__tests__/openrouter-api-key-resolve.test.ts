import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { loadApiKey, saveApiKey } from "@/lib/api";
import {
  resolveOpenRouterApiKeyForHarness,
  resolveOpenRouterApiKeyFromSettingsPlugin,
} from "@/lib/openrouter-api-key-resolve";

vi.mock("@/lib/api", () => ({
  loadApiKey: vi.fn(),
  saveApiKey: vi.fn(),
}));

describe("resolveOpenRouterApiKeyForHarness", () => {
  beforeEach(() => {
    vi.mocked(loadApiKey).mockReturnValue("");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the Settings plugin key and ignores Dashboard localStorage", async () => {
    vi.mocked(loadApiKey).mockReturnValue("client-key");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, key: "plugin-key" }),
    } as Response);
    await expect(resolveOpenRouterApiKeyFromSettingsPlugin()).resolves.toBe("plugin-key");
    expect(saveApiKey).not.toHaveBeenCalled();
  });

  it("throws when the Settings plugin key is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, key: "" }),
    } as Response);
    await expect(resolveOpenRouterApiKeyFromSettingsPlugin()).rejects.toThrow(
      "Add an OpenRouter API key in Settings.",
    );
  });

  it("returns the client key when localStorage has one", async () => {
    vi.mocked(loadApiKey).mockReturnValue("client-key");
    await expect(resolveOpenRouterApiKeyForHarness()).resolves.toBe("client-key");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the Settings server key when local is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, key: "server-key" }),
    } as Response);
    await expect(resolveOpenRouterApiKeyForHarness()).resolves.toBe("server-key");
    expect(saveApiKey).toHaveBeenCalledWith("server-key");
  });

  it("throws when neither client nor server key is available", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, key: "" }),
    } as Response);
    await expect(resolveOpenRouterApiKeyForHarness()).rejects.toThrow(
      "Add an OpenRouter API key in Settings.",
    );
  });
});

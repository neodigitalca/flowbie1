import { BACKEND_API_BASE, BACKEND_CONNECTION_ERROR } from "@/lib/wordpress-api/connection";

export type GridLocalDfsPinResult = {
  index: number;
  locationCoordinate: string;
  apiStatus: string | null;
  apiError: string | null;
  taskJson: unknown | null;
};

export type GridLocalDfsBatchResponse = {
  keyword: string;
  pinCount: number;
  pins: GridLocalDfsPinResult[];
};

/** One request to Flowbie API → server runs 49 parallel Maps live calls (1 task each). */
export async function fetchGridLocalMapsSerpBatch(args: {
  keyword: string;
  pins: Array<{ lat: number; lng: number }>;
  language_code?: string;
  depth?: number;
  signal?: AbortSignal;
}): Promise<GridLocalDfsBatchResponse> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const url = `${base}/api/grid-local/maps-serp-batch`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: args.keyword,
        pins: args.pins,
        language_code: args.language_code ?? "en",
        depth: args.depth,
      }),
      signal: args.signal,
    });

    const json = (await res.json()) as GridLocalDfsBatchResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || `Grid Local batch failed (${res.status})`);
    }
    return json;
  } catch (err) {
    const isNetwork =
      err instanceof TypeError &&
      (err.message.includes("fetch") ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError"));
    if (isNetwork) {
      throw new Error(BACKEND_CONNECTION_ERROR);
    }
    throw err;
  }
}

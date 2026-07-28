---
name: Sub-metro entity OpenRouter only
overview: One dedicated OpenRouter function. Required RAG blocks (grid MD, full CSV, Wikipedia pool). No optional wiki. No sanitize ladders as the fix.
todos:
  - id: openrouter-entity-pass
    content: Implement single dedicated function/route that calls OpenRouter once with system + user; user message always includes grid markdown, full grid CSV, and Wikipedia granular pool (same order as suggest); plus seed list JSON
    status: pending
  - id: wire-suggest-pipeline
    content: After keyword/SAP clusters exist, call only that function to set seed entityHints; propagate to members; no parallel fallback chains for entity column
    status: pending
  - id: parse-validate
    content: Parse JSON output (clusterId to entityHint); throw on invalid JSON; retry with fix message only if parse fails
    status: pending
  - id: tests-openrouter-entity
    content: Contract tests for dedicated function input shape and parser; no sanitize-city tests as primary gate
    status: pending
isProject: false
---

# Sub-metro entity hints: one dedicated OpenRouter route

## User direction (authoritative)

- **One dedicated function** (one code path). No lazy branching that treats Wikipedia or grid as skippable extras.
- **Nothing "optional"** in the spec: the entity OpenRouter call **always** receives the full user payload in a **fixed shape**: structured seeds plus **grid markdown**, **full CSV**, and **Wikipedia granular pool markdown** in the same attachment order used elsewhere. If a block is literally empty (e.g. no file yet), the route still sends an explicit empty section so the model sees the contract; the product flow that triggers suggest should require grid + wiki build before entity resolution when that is the intended UX.
- **Do not** use sanitize / trim / backfill ladders as the primary mechanism for fixing city-level hints.

## Problem

Post-processing and conditional backfills do not replace a wrong non-empty **City, ST** when wiki exists. The fix is **model output from a dedicated call**, not regex pipelines.

## Design

### Single exported function

- Example name: `resolveSubMetroEntityHintsOpenRouter` (exact name in implementation).
- **Responsibility:** Given `apiKey`, `siteId`, `seeds: { clusterId, keyword }[]`, and **required** context strings `gridSummaryMarkdown`, `uploadedGridCsvFull`, `wikipediaGranularEntityPoolMarkdown`, build `messages: [{ role, content }]` and `POST` to OpenRouter once.
- **System prompt:** Sub-metro only (neighbourhood, district, street corridor, landmark, quarter). Forbid whole-city **City, ST** as the sole geography when RAG contains finer anchors.
- **User message:** Concatenate in **fixed** order (mirror suggest): compact JSON of seeds first, then `--- Grid markdown ---`, then `--- Grid CSV ---`, then `--- Wikipedia granular candidates ---` (verbatim markdown with `###` lines). No `if (hasWikiPool)` that **omits** the Wikipedia section from the request; the section is always present.

### Pipeline

1. Run existing flow until seed rows exist (keywords, SAP, cluster IDs).
2. Call `**resolveSubMetroEntityHintsOpenRouter` only** to obtain `entityHint` per `clusterId`.
3. Merge onto seeds; `propagateSeedEntityHintsToMembers` as today.
4. **Do not** chain `sanitizeEntityHintForKeywordTarget` + `backfillEntityHintFromWikipediaPool` + `backfillEntityHintFromGridPlaceHints` as the way entity gets its final value (minimal parse/trim only if needed).

### What this is not

- Not a second-class optional wiki step.
- Not multiple OpenRouter variants (one for wiki off, one on). **One route.**

## Files

- New module: e.g. `[src/lib/local-analysis-entity-openrouter.ts](src/lib/local-analysis-entity-openrouter.ts)` with the single function, or colocated in `[src/lib/local-analysis-suggest-from-inventory.ts](src/lib/local-analysis-suggest-from-inventory.ts)` if you prefer one file (still **one** function).

## Acceptance

- Entity strings for seeds come from **that one OpenRouter call** and the **full** three-block RAG user message.
- Plan wording does not describe Wikipedia or grid as optional inputs to that call.

## Example: what gets called (names and shapes)

This is the contract the implementation should follow. Exact file path may be `src/lib/local-analysis-entity-openrouter.ts` exporting **one** function.

### 1) Function signature (illustrative)

```typescript
export type SubMetroEntitySeed = { clusterId: string; keyword: string };

export async function resolveSubMetroEntityHintsOpenRouter(args: {
  apiKey: string;
  siteId?: string;
  seeds: SubMetroEntitySeed[];
  gridSummaryMarkdown: string;
  uploadedGridCsvFull: string;
  wikipediaGranularEntityPoolMarkdown: string;
}): Promise<Map<string, string>>; // clusterId -> entityHint
```

**Call site (illustrative):** after `repairRoughSapTotals` / rotation, collect **seed** rows only:

```typescript
const seeds = repaired
  .filter((r) => r.clusterRole === "seed")
  .map((r) => ({ clusterId: r.clusterId, keyword: r.keyword }));

const hintsByCluster = await resolveSubMetroEntityHintsOpenRouter({
  apiKey,
  siteId: options?.siteId,
  seeds,
  gridSummaryMarkdown: mdRaw,
  uploadedGridCsvFull: csvRaw,
  wikipediaGranularEntityPoolMarkdown: wikiPoolRaw,
});

// merge: repaired.map seed row -> entityHint = hintsByCluster.get(clusterId) ?? row.entityHint
```

### 2) OpenRouter request (one POST)

- **URL:** `https://openrouter.ai/api/v1/chat/completions` (same as existing suggest).
- **Body:** `{ model: getResearchModel(siteId), messages: [system, user], temperature: 0.2, max_tokens: 4096, stream: false }`.

### 3) User message content (fixed order, always all three blocks)

Abbreviated example:

```text
Return JSON only: {"hints":[{"clusterId":"...","entityHint":"..."},...]}

--- Seeds (service keywords only, no geography) ---
[{"clusterId":"c1","keyword":"custom window treatments"},{"clusterId":"c2","keyword":"motorized shade installation"}]

--- Grid scan (full markdown) ---
## Local grid scan
...

--- Uploaded grid CSV (full file) ---
Scan Date,Latitude,...,Address,...
"Apr 8, 2026...",...,"2932 Canton Rd Suite 130, Marietta, GA 30066",...

--- Wikipedia granular place candidates ---
### Some Neighbourhood, Marietta, Georgia
...
```

Sections are **always** present; if a string is empty, still emit the header and a line like `(none)` so the contract does not branch.

### 4) Model response (parsed)

```json
{
  "hints": [
    { "clusterId": "c1", "entityHint": "East Cobb, Marietta, Georgia" },
    { "clusterId": "c2", "entityHint": "Canton Road corridor, Marietta, Georgia" }
  ]
}
```

Parser maps `hints[]` to `Map<clusterId, entityHint>`. Invalid JSON or missing cluster: throw or one retry with a fix user message (per todos).
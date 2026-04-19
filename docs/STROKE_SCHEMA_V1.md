# Stroke schema v1 (`page.strokesData`)

Persisted as **JSONB** on the `page` row (`strokesData`). The editor only commits **pen** and **highlighter** strokes; the eraser mutates this array by removing strokes (see app logic).

## Stroke object

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `tool` | `"pen"` \| `"hl"` | yes | Highlighter uses multiply blend when rendered. |
| `color` | `string` | yes | CSS color, e.g. `#1f1c15`. |
| `width` | `number` | yes | Logical width; canvas scales with surface width. |
| `pts` | `[number, number][]` | yes | **Normalized** coordinates: `x ∈ [0,1]`, `y ∈ [0,1]` relative to the drawing surface width/height so ink survives resize. |

## Validation

Server actions should run `parseStrokes()` (`src/lib/ink/types.ts`) before writing to Postgres so invalid entries from older clients are dropped.

## Versioning

Bump to **v2** when adding pressure (`p` per point), tilt, or stroke-level UUIDs for CRDT/liveblocks reconciliation.

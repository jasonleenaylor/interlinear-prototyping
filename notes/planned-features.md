# Planned Prototype Features

Each feature is implemented and committed individually.

---

## F-01 · Remove interlinear header, keep legend

**Status:** done
`components/interlinearizer.tsx`. The legend (unapproved / approved colour swatches)
stays, right-aligned.

**Files:** `components/interlinearizer.tsx`

---

## F-02 · Settings panel with drag-and-drop row reorder

**Status:** done
interlinear strip.

### Behaviour
Clicking renders an inline panel that appears on the left edge of the strip container.
The panel shows labelled drag handles for each reorderable row:

| Handle label | Model field |
|---|---|
| `gloss` | `Analysis.glossText` |
| `morphemes` | `Analysis.morphemeBundles[].form` |

The surface-text row is always first and is **not** draggable.

Dragging a row live-updates the order inside every visible `OccurrenceBox`.
At the bottom of the panel: ✓ (save) and ✗ (cancel) icon buttons.
Saving persists the order to `localStorage` key `interlinear-row-order`.

**New files:** `components/row-order-settings.tsx`, `hooks/use-row-order.ts`  
**Changed files:** `components/interlinearizer.tsx`, `components/occurrence-box.tsx`

---

## F-03 · Click non-active occurrence to scroll it into view

**Status:** done (right-edge bug fixed under F-04)
it to the pin position (`ACTIVE_LEFT_PX = 340`).

Alignment rule (revised after bug discovery):
- Both left **and** right clicks use **left-edge alignment** (`ACTIVE_LEFT_PX - el.offsetLeft`).
- The original right-edge formula (`ACTIVE_LEFT_PX - (el.offsetLeft + el.offsetWidth)`) conflicted
  with `recalcTranslate`, which always applies left-edge alignment on every re-render.
  The mismatch caused a `transition-transform` correction animation that appeared as the click
  "not working" for elements far to the right.

Normal ← → navigation always left-aligns (unchanged).

**Files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-04 · Click word in chapter text → fade interlinear to new position

**Status:** done — committed

Clicking a word span in the chapter-text area:
1. Fades the interlinear strip out (opacity 0, CSS transition).
2. Repositions to the clicked word's occurrence group (position snaps while invisible).
3. Fades back in with the new group at the default left-edge pin position.

Only text-area clicks use the fade; ← → navigation keeps the existing slide.

### Bugs found & fixed

**Bug A — right-edge alignment conflicts with `recalcTranslate`** (present in F-03 work)
- Fixed: `clickGroup` now always uses left-edge alignment, matching `recalcTranslate`.

**Bug B — position animates during fade-in** ("seeing scrolling")
- Fixed: `transition-none` applied to the strip when `isFading = true`. Position jumps
  instantly while invisible; only opacity animates on fade-in.

**Bug C — wrong group / sliding into view** (root cause confirmed)
- React 18 automatically batches state updates inside `setTimeout`. `goToGroup(gi)` and
  `setIsFading(false)` were in the same timeout callback → single render where
  `activeGroupIndex = new` AND `isFading = false` simultaneously → `transition-transform`
  immediately active → strip slid visibly from old position to new.
- **Fix:** `setTranslateX(correct)` and `goToGroup(gi)` are batched together inside
  `setTimeout` while `isFading=true`. A single RAF then calls `setIsFading(false)` after
  the browser has painted the new (invisible) position. `translateX` is unchanged in
  that render so no slide animation fires.
- Additionally: source text rebuilt to iterate canonical `segments[].occurrences` with a
  memoized `occurrenceGroupMap: Map<occurrenceId, groupIndex>` for O(1) click lookup,
  replacing a positional `findIndex` that could drift under React 18 batching.

### Known issue (post-feature cleanup)
> Occasional glitch where the strip briefly shows at the wrong position before snapping.
> Likely a race between the RAF and React's async `useEffect` scheduler under load.
> Low priority — fix after F-05 and F-06 are complete.

**Files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-05 · Text-area config: literal / free translation lines

**Status:** done (awaiting manual verification before commit)

### Header changes
- Removed the "Source Text" label.
- Added `SlidersHorizontal` config icon button (right-aligned). Clicking toggles an
  inline config panel below the button.

### Config panel
Two checkboxes: **Literal translation** / **Free translation**.
Settings persisted to `localStorage` key `interlinear-text-config` via
`hooks/use-text-config.ts` (new file).

### Text-area layout
Source text is now rendered segment-by-segment. Each segment:
1. A `<p>` of inline token spans (click-to-navigate behaviour unchanged).
2. *(if showLiteral)* A compact `<Textarea>` pre-seeded from
   `Segment.literalTranslation["en"]`, editable, stored in `segmentTranslations` state.
3. *(if showFree)* A compact `<Textarea>` pre-seeded from
   `Segment.freeTranslation["en"]`, editable, stored in `segmentTranslations` state.

Segments have a subtle `mb-1` gap between them; no explicit verse labels.
The text is visually seamless when translation inputs are hidden.

**New files:** `hooks/use-text-config.ts`  
**Changed files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-06 · Link adjacent verse segments

**Status:** done (awaiting manual verification before commit)

### UI
The link icon appears **between segment blocks** in the text area — below the last
translation input of one segment (or below its token line if no inputs are shown) and
above the token line of the next. Clicking it merges the two segments.
Only adjacent, in-order merges are allowed (no gaps). No split/unlink control is part
of this feature.

### Behaviour
Merging is a **model-only operation** — it has no visual effect on the token flow or the
interlinear strip. What changes:
- The two canonical `Segment` objects are collapsed into one in the hook's `segments`
  state. Their occurrences are concatenated.
- Merge state is represented by updating segment reference range fields (BCVF start/end),
  not by introducing a `linkedSegmentRefs` field.
- On merge, each merged occurrence is rewritten to the merged segment ID and re-indexed
  within that merged segment.
- Translation inputs (literal / free) become one shared textarea for the merged segment.
- The interlinear strip is unaffected: occurrence order and group indices do not change.

### Model impact
Replace `Segment.segmentRef: string` with explicit BCVF range fields in both model files.

Planned shape (subject to final naming pass):
- `segmentStartRef` (BCVF)
- `segmentEndRef` (BCVF)

Do **not** add `linkedSegmentRefs`.

### Progress saved
- ✅ UI interaction direction agreed: link control between segment blocks; model-only merge.
- ✅ Removed `linkedSegmentRefs` from both model files.
- ✅ Replaced `segmentRef` with BCVF range fields (`startRef`, `endRef`) in both model files.
- ✅ Updated sample data to emit BCVF refs.
- ✅ Updated hook merge/split logic to use BCVF range plus occurrence `segmentId`
  boundaries instead of `linkedSegmentRefs`.
- ✅ Updated UI merge button disable/split icon visibility to infer merged state from
  mixed source `segmentId`s in `seg.occurrences`.
- ✅ Updated merge implementation so all merged occurrences are rewritten to the merged
  segment ID (and re-indexed).
- ✅ Removed split handling from F-06 by request; reversibility is deferred to the later
  arbitrary split feature.

**Files:** `results/interlinear-model.ts`, `lib/interlinear-model.ts`,
`components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-07 · Contiguous text flow when no translation lines are shown

**Status:** pending

When both **Show literal translation** and **Show free translation** are disabled, the
segment-by-segment `<div>` blocks introduced in F-05 leave a small visual gap between
verses. This feature removes that gap so the text reads as a single seamless paragraph,
matching the pre-F-05 appearance.

### Behaviour
- When both translation toggles are off, render all token spans in a **single `<p>`**
  (same as pre-F-05), with inter-segment spacing handled by the existing look-ahead logic.
- When at least one translation toggle is on, keep the per-segment `<div>` layout so
  each segment's translation inputs remain anchored below their own token line.
- The switch between modes must not disrupt click-to-navigate behaviour — the
  `occurrenceGroupMap` lookup is unchanged in both paths.

**Files:** `components/interlinearizer.tsx`

---

## F-08 · Copy glosses into literal translation

**Status:** pending

### UI
When **Show literal translation** is enabled, each segment's literal translation textarea
has a small icon button (e.g. `ClipboardCopy`) at its right edge. Clicking it populates
the textarea with the glosses for that segment's occurrences joined by spaces, skipping
punctuation tokens that have no gloss.

### Behaviour
- Gloss text is read from the `occurrences` state (already in the hook) by matching each
  canonical occurrence ID to its UI occurrence's `gloss` field.
- Punctuation occurrences (those whose `isPunctuation` is true) are skipped.
- The filled text is treated as a normal edit — it updates `segmentTranslations` state
  via the existing `updateLiteralTranslation` callback, so it is immediately editable.
- The icon is only shown when literal translation is visible; it is not shown on the free
  translation textarea.

**Files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-09 · Double-click between occurrences to split a segment

**Status:** pending

### UI
The user double-clicks on a **word token span** in the text area. The segment that
contains that token is split immediately **before** the double-clicked token, creating
two segments: one containing all tokens up to (but not including) the clicked token, and
one containing the clicked token and all tokens after it.

### Behaviour
- Only word tokens are splittable (double-clicking punctuation is a no-op).
- A segment cannot be split at its first token (there would be nothing in the left half).
- The new left segment inherits the original `segmentRef`; the right segment gets a
  derived ref (e.g. `GEN 1:1` → `GEN 1:1a` / `GEN 1:1b`) or a placeholder until a
  future editing feature allows renaming.
- Existing `literalTranslation` and `freeTranslation` values are copied to the left
  segment; the right segment starts with empty translations.
- Splitting a merged segment (one with `linkedSegmentRefs`) is not allowed — the user
  must unlink it first.
- This is the inverse operation of F-06 merging, but implemented independently (F-06
  uses explicit link/unlink icons; F-09 uses double-click on a token boundary).

**Files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

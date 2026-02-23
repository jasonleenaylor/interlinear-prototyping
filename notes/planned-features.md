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

**Status:** done — committed

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

**Status:** done — committed

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

**Status:** done — committed

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

**Status:** done — committed

### UI
The user double-clicks on a **word token span** in the text area. The segment that
contains that token is split immediately **before** the double-clicked token, creating
two segments: one containing all tokens up to (but not including) the clicked token, and
one containing the clicked token and all tokens after it.

### Behaviour
- Only word tokens are splittable (double-clicking punctuation is a no-op).
- A segment cannot be split at its first token (there would be nothing in the left half).
- The split occurs immediately before the double-clicked token.
- For single-verse ranges, BCVF fragment markers are used (`a` for left end, `b` for
  right start/end). For multi-verse ranges, placeholder refs are used (left collapses to
  `startRef`, right collapses to `endRef`) until a future ref-editing feature.
- Existing `literalTranslation` and `freeTranslation` values stay on the left segment;
  the right segment starts with empty translations.
- All right-side occurrences are reassigned to the new right segment ID and re-indexed;
  left-side occurrences are re-indexed under the original segment ID.
- This is the inverse operation of F-06 merging, but implemented independently (F-06
  uses explicit link/unlink icons; F-09 uses double-click on a token boundary).

**Files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## B-01 · Cannot merge merged segment forward

**Type:** bug  
**Status:** done (will commit with next verified batch)

### Description
After merging two adjacent segments (A + B), the newly merged segment cannot be merged
again with the following segment (C). The merge button remains disabled, which prevents
building a longer contiguous merged range (A + B + C).

### Expected
A merged segment should still be eligible to merge with its immediate next segment,
as long as order remains adjacent and in sequence.

### Resolution
- Merge button now remains enabled when the current segment is already merged.
- Only the case where the *next* segment is already merged remains disabled.
- Hook merge guard now allows extending a merged segment forward (A+B)+C.

**Likely files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-10 · Render punctuation as plain text in interlinear flow

**Status:** done (awaiting manual verification before commit)

### Goal
Punctuation occurrences should remain visible in the source text flow but should not
render as full analysis boxes. Instead, show punctuation as plain text separators
between non-punctuation occurrences.

### Behaviour
- In the interlinear strip, punctuation occurrences render as plain text only
  (no gloss row, no morpheme editor, no approve control).
- Linking actions skip punctuation boundaries. A link operation between two words should
  bridge across any punctuation occurrences between them.
- Punctuation still appears visually between neighbouring non-punctuation words so token
  order remains faithful to the source text.
- Word click navigation and fade behaviour remain unchanged.

**Files:** `components/interlinearizer.tsx`, `components/occurrence-box.tsx`,
`hooks/use-interlinear.ts`, `lib/interlinear-types.ts`

---

## E-01 · Align joined-occurrence divider with morpheme split

**Type:** enhancement  
**Status:** done — committed

### Goal
When occurrences are joined into a group, the divider line visible in the first (surface)
row should vertically align with the divider between corresponding morpheme boxes below.

### Behaviour
- Surface-row divider should share the same x-position as the morpheme-row split.
- Alignment should hold for any row order and for grouped occurrences of mixed widths.
- Hover affordances for unlink remain available without shifting divider alignment.

### Resolution
- Surface row now uses the same per-occurrence flex partitioning as morpheme cells,
  so occurrence boundaries match across rows.
- Unlink control is positioned absolutely on the shared boundary, so hover/click
  affordance remains available without consuming layout width.

**Likely files:** `components/occurrence-box.tsx`

---

## E-02 · Reduce visual density of joined-occurrence analysis view

**Type:** enhancement  
**Status:** done — committed

### Goal
Reduce vertical and horizontal space used by joined occurrence analysis so larger groups
fit on screen with less scrolling while preserving readability and editability.

### Candidate adjustments
- Tighten padding and gap values in grouped surface/morpheme rows.
- Reduce link-divider footprint between joined occurrences.
- Compact literal/free input heights when multiple groups are visible.
- Preserve accessible hit targets for controls after compaction.

### Resolution
- Surface and morpheme rows now use tighter padding and gap values.
- Root cause of excessive box width was the HTML `size` attribute defaulting to 20
  characters on both gloss (`Input`) and morpheme inputs — fixed with `size={1}`.
- Non-active gloss centering corrected by adding `w-full` to the static display div.
- Morpheme cells now grow to fit content (`min-w-0` removed) while still splitting evenly.
- Hit targets for controls remain accessible.

**Likely files:** `components/occurrence-box.tsx`, `components/interlinearizer.tsx`

---

## F-11 · Link disjoint occurrences without auto-linking intermediates

**Status:** done (awaiting manual verification before commit)

### Goal
Allow users to link two non-adjacent occurrences directly without forcing all
intermediate occurrences into the same link chain.

### Behaviour
- Linking two disjoint occurrences creates a direct pair link only between the selected
  occurrences.
- Intermediate occurrences remain unlinked unless the user explicitly links them.
- A curved connector is rendered between the two linked occurrences.
- The connector should attach to the nearest facing corners/edges of the two occurrence
  boxes and remain visually stable while scrolling and fading.
- Existing adjacent linking/unlinking behaviour remains supported.

### Resolution
- Added `disjointLinks: Set<string>` state (pairs encoded as `"leftOccIdx:rightOccIdx"`).
- Non-adjacent `toggleLink` now creates/removes a disjoint link instead of bridging intermediates.
- An SVG overlay inside the strip container draws cubic Bézier arcs between the
  nearest edges of the two linked groups.
- Active-group arcs render in sky-500; inactive arcs render in slate-400 dashed.

**Likely files:** `lib/interlinear-types.ts`, `hooks/use-interlinear.ts`,
`components/interlinearizer.tsx`, `components/occurrence-box.tsx`
---

## F-12 · Link button above punctuation to create cross-punctuation disjoint link

**Status:** done — committed

### Goal
When two word groups are separated by one or more punctuation occurrences, a link button
should appear horizontally inline with the other link buttons, positioned above the
punctuation. Clicking it creates a disjoint link between the two flanking word groups,
skipping over the punctuation entirely.

### Behaviour
- A link button is rendered above every punctuation occurrence (or run of punctuation)
  that sits between two non-punctuation word groups.
- Visually it aligns horizontally with the existing `<>` link buttons so it is obvious
  which words it would join.
- Clicking creates (or removes) a disjoint link between the last occurrence of the
  left word group and the first occurrence of the right word group — identical to the
  result of a non-adjacent `toggleLink` call.
- Existing punctuation rendering (plain muted text, not navigable) is unchanged.

**Likely files:** `components/interlinearizer.tsx`, `hooks/use-interlinear.ts`

---

## F-13 · Auto-group adjacent occurrence when linking into an existing disjoint set

**Status:** done — committed

### Goal
If a user creates an adjacent link between an occurrence and an occurrence that is
already part of a disjoint set, the two occurrences should be merged into the same
group automatically (i.e. treated as an adjacent link), rather than creating a
second overlapping disjoint link.

### Behaviour
- When `toggleLink` is called for an adjacent pair and either occurrence belongs to an
  existing disjoint link, the adjacent merge proceeds as normal (the two groups join).
- The disjoint link entry that referenced that occurrence is updated or removed so the
  data model stays consistent: the merged group now spans both occurrences and no
  dangling disjoint key points into the middle of a group.
- Inverse: unlinking a group that was formed this way should restore the disjoint link
  if the original cross-punctuation relationship still makes sense.

**Likely files:** `hooks/use-interlinear.ts`, `components/interlinearizer.tsx`
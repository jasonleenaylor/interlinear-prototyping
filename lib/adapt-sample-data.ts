/**
 * Adapter — converts canonical model data into the flat v0 UI types
 * (`Occurrence`, `LinkedGroup`) consumed by the existing components.
 *
 * This is a thin, read-once bridge.  When the UI is eventually
 * rewritten to work directly against the canonical model, this file
 * can be deleted.
 */

import {
  type Interlinearization,
  type Occurrence as CanonicalOccurrence,
  type Analysis,
  type Segment,
  OccurrenceType,
  AssignmentStatus,
} from "./interlinear-model";
import type { Occurrence as UiOccurrence } from "./interlinear-types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten an `Interlinearization` into a flat array of v0 `Occurrence`
 * objects the existing UI can render.
 *
 * Only the first book's first segment is used for now (verse 1).
 * Pass `{ allSegments: true }` to flatten every segment.
 *
 * `analysisLookup` may be keyed by *any* string (local name, etc.).
 * The function internally re-indexes by `analysis.id` so that
 * `AnalysisAssignment.analysisId` resolves correctly.
 */
export function adaptToUiOccurrences(
  interlinearization: Interlinearization,
  analysisLookup: Record<string, Analysis>,
  opts: { allSegments?: boolean } = {},
): UiOccurrence[] {
  const book = interlinearization.books[0];
  if (!book) return [];

  // Re-index analyses by their `id` field so assignment lookups work
  // regardless of how the caller keyed the record.
  const byId: Record<string, Analysis> = {};
  for (const a of Object.values(analysisLookup)) {
    byId[a.id] = a;
  }

  const segments = opts.allSegments ? book.segments : book.segments.slice(0, 1);

  // First pass: collect all groupIds that span multiple occurrences
  // so we can set `linkedWithNext` on adjacent members.
  const groupMembers = collectGroupMembers(segments);

  // Second pass: convert each canonical occurrence → UI occurrence
  const uiOccurrences: UiOccurrence[] = [];

  for (const seg of segments) {
    for (const occ of seg.occurrences) {
      uiOccurrences.push(
        adaptOne(occ, byId, groupMembers, uiOccurrences.length),
      );
    }
  }

  // Third pass: set `linkedWithNext` for group members that are
  // adjacent in the flat list.
  markLinkedWithNext(uiOccurrences, groupMembers);

  return uiOccurrences;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Map from groupId → ordered list of canonical occurrence IDs. */
type GroupMap = Map<string, string[]>;

function collectGroupMembers(segments: Segment[]): GroupMap {
  const map: GroupMap = new Map();

  for (const seg of segments) {
    for (const occ of seg.occurrences) {
      const groupId = occ.assignment?.groupId;
      if (groupId) {
        let list = map.get(groupId);
        if (!list) {
          list = [];
          map.set(groupId, list);
        }
        if (!list.includes(occ.id)) {
          list.push(occ.id);
        }
      }
    }
  }

  return map;
}

function adaptOne(
  occ: CanonicalOccurrence,
  analysisLookup: Record<string, Analysis>,
  _groupMembers: GroupMap,
  _flatIndex: number,
): UiOccurrence {
  const isPunctuation = occ.type === OccurrenceType.Punctuation;

  // Resolve the assignment's analysis (if any)
  const analysis = occ.assignment
    ? analysisLookup[occ.assignment.analysisId]
    : undefined;

  // Gloss: from the analysis. For grouped phrases the same analysis
  // (and therefore the same glossText) is on every member; the hook
  // only reads the gloss from the first group member, so this is fine.
  // Take the first available language's value from the MultiString.
  const gloss = Object.values(analysis?.glossText ?? {})[0] ?? "";

  // Morpheme text: if the analysis has morphemeBundles, join their
  // forms with spaces (which the MorphemeEditor will split back into
  // boxes). Otherwise fall back to the surface text.
  const morphemeText =
    analysis?.morphemeBundles && analysis.morphemeBundles.length > 0
      ? analysis.morphemeBundles.map((mb) => mb.form).join(" ")
      : occ.surfaceText;

  // Approved: true when the assignment has status Approved
  const approved = occ.assignment?.status === AssignmentStatus.Approved;

  return {
    id: occ.id,
    text: occ.surfaceText,
    isPunctuation,
    gloss,
    morphemeText,
    approved,
    linkedWithNext: false, // set in the third pass
  };
}

/**
 * Walk the flat occurrence list and, for each group whose members are
 * adjacent, set `linkedWithNext = true` on all but the last member.
 */
function markLinkedWithNext(
  uiOccs: UiOccurrence[],
  groupMembers: GroupMap,
): void {
  // Build an id→flatIndex lookup
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < uiOccs.length; i++) {
    idToIndex.set(uiOccs[i].id, i);
  }

  for (const memberIds of groupMembers.values()) {
    if (memberIds.length < 2) continue;

    // Get the flat indices of all group members
    const indices = memberIds
      .map((id) => idToIndex.get(id))
      .filter((idx): idx is number => idx !== undefined)
      .sort((a, b) => a - b);

    // Link consecutive pairs that are truly adjacent in the flat list
    for (let k = 0; k < indices.length - 1; k++) {
      if (indices[k + 1] === indices[k] + 1) {
        uiOccs[indices[k]].linkedWithNext = true;
      }
    }
  }
}

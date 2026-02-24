"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { type Occurrence, buildLinkedGroups } from "@/lib/interlinear-types";
import { type Segment as CanonicalSegment } from "@/lib/interlinear-model";
import { sampleInterlinearization, sampleAnalyses } from "@/lib/sample-data";
import { adaptToUiOccurrences } from "@/lib/adapt-sample-data";

/** Build initial UI occurrences from the canonical sample data (all verses). */
function buildInitialOccurrences(): Occurrence[] {
  return adaptToUiOccurrences(sampleInterlinearization, sampleAnalyses, {
    allSegments: true,
  });
}

/** Seed translation state from canonical segment data. */
function buildInitialTranslations(): Record<
  string,
  { literal: string; free: string }
> {
  const book = sampleInterlinearization.books[0];
  if (!book) return {};
  const result: Record<string, { literal: string; free: string }> = {};
  for (const seg of book.segments) {
    result[seg.id] = {
      literal: seg.literalTranslation?.["en"] ?? "",
      free: seg.freeTranslation?.["en"] ?? "",
    };
  }
  return result;
}

function sameRef(
  a: CanonicalSegment["startRef"],
  b: CanonicalSegment["startRef"],
): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.verse === b.verse &&
    (a.fragment ?? "") === (b.fragment ?? "")
  );
}

function sameBcv(
  a: CanonicalSegment["startRef"],
  b: CanonicalSegment["startRef"],
): boolean {
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

function isMergedSegment(seg: CanonicalSegment): boolean {
  return !sameBcv(seg.startRef, seg.endRef);
}

export function useInterlinear() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>(
    buildInitialOccurrences,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // Disjoint (non-contiguous) links stored as "leftLastOccIdx:rightFirstOccIdx" strings.
  // The linked occurrence is shown inside the active group's OccurrenceBox (grayed out,
  // non-analyzable — like punctuation), and a curved arc connects it visually in the strip.
  const [disjointLinks, setDisjointLinks] = useState<Set<string>>(
    () => new Set(),
  );

  const [segmentTranslations, setSegmentTranslations] = useState<
    Record<string, { literal: string; free: string }>
  >(buildInitialTranslations);

  // Memoized so dependent values (occurrenceGroupMap) only rebuild when occurrences change
  const linkedGroups = useMemo(
    () => buildLinkedGroups(occurrences),
    [occurrences],
  );

  // Keep a ref to linkedGroups to avoid stale closures
  const linkedGroupsRef = useRef(linkedGroups);
  useEffect(() => {
    linkedGroupsRef.current = linkedGroups;
  }, [linkedGroups]);

  // Keep a ref to disjointLinks so navigation callbacks can read current links
  // without becoming stale.
  const disjointLinksRef = useRef(disjointLinks);
  useEffect(() => {
    disjointLinksRef.current = disjointLinks;
  }, [disjointLinks]);

  // Stable ref to occurrences — allows toggleLink to read current occurrence
  // data without closing over the occurrences array.
  const occurrencesRef = useRef(occurrences);
  useEffect(() => {
    occurrencesRef.current = occurrences;
  }, [occurrences]);

  // The set of startIndex values that are disjoint RIGHT-endpoint groups.
  // These groups are treated like punctuation: visible but not navigable.
  const disjointRightStarts = useMemo(
    () => new Set([...disjointLinks].map((k) => parseInt(k.split(":")[1], 10))),
    [disjointLinks],
  );

  // Find which group the active index belongs to
  const activeGroupIndex = linkedGroups.findIndex(
    (g) =>
      activeIndex >= g.startIndex &&
      activeIndex < g.startIndex + g.occurrences.length,
  );

  // Stable ref to activeGroupIndex — allows toggleApprove and toggleLink to be
  // fully stable useCallback references (no activeGroupIndex in their dep arrays).
  const activeGroupIndexRef = useRef(activeGroupIndex);
  useEffect(() => {
    activeGroupIndexRef.current = activeGroupIndex;
  }, [activeGroupIndex]);

  // Segments as mutable state — can be merged/split at runtime
  const [segments, setSegments] = useState<CanonicalSegment[]>(
    () => sampleInterlinearization.books[0]?.segments ?? [],
  );
  const splitIdCounterRef = useRef(0);

  // O(1) lookup: canonical occurrence ID → group index.
  // Used by the source text click handlers — eliminates positional findIndex drift.
  const occurrenceGroupMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let gi = 0; gi < linkedGroups.length; gi++) {
      for (const occ of linkedGroups[gi].occurrences) {
        map.set(occ.id, gi);
      }
    }
    return map;
  }, [linkedGroups]);

  const moveForward = useCallback(() => {
    setActiveIndex((prev) => {
      const groups = linkedGroupsRef.current;
      const links = disjointLinksRef.current;
      const rightStarts = new Set(
        [...links].map((k) => parseInt(k.split(":")[1], 10)),
      );
      const currentGroupIdx = groups.findIndex(
        (g) =>
          prev >= g.startIndex && prev < g.startIndex + g.occurrences.length,
      );
      // Skip forward over punctuation-only and disjoint right-endpoint groups
      let nextIdx = currentGroupIdx + 1;
      while (
        nextIdx < groups.length &&
        (groups[nextIdx].occurrences.every((o) => o.isPunctuation) ||
          rightStarts.has(groups[nextIdx].startIndex))
      ) {
        nextIdx++;
      }
      return nextIdx < groups.length ? groups[nextIdx].startIndex : prev;
    });
  }, []);

  const moveBackward = useCallback(() => {
    setActiveIndex((prev) => {
      const groups = linkedGroupsRef.current;
      const links = disjointLinksRef.current;
      const rightStarts = new Set(
        [...links].map((k) => parseInt(k.split(":")[1], 10)),
      );
      const currentGroupIdx = groups.findIndex(
        (g) =>
          prev >= g.startIndex && prev < g.startIndex + g.occurrences.length,
      );
      // Skip backward over punctuation-only and disjoint right-endpoint groups
      let prevIdx = currentGroupIdx - 1;
      while (
        prevIdx >= 0 &&
        (groups[prevIdx].occurrences.every((o) => o.isPunctuation) ||
          rightStarts.has(groups[prevIdx].startIndex))
      ) {
        prevIdx--;
      }
      return prevIdx >= 0 ? groups[prevIdx].startIndex : prev;
    });
  }, []);

  const toggleApprove = useCallback(() => {
    const group = linkedGroupsRef.current[activeGroupIndexRef.current];
    if (!group) return;

    const allApproved = group.occurrences.every((o) => o.approved);
    const newStatus = !allApproved;

    setOccurrences((prev) => {
      const next = [...prev];
      for (
        let i = group.startIndex;
        i < group.startIndex + group.occurrences.length;
        i++
      ) {
        next[i] = { ...next[i], approved: newStatus };
      }
      return next;
    });

    // Auto-advance only when approving, not when unapproving
    if (newStatus) {
      moveForward();
    }
  }, [moveForward]);

  const updateGloss = useCallback((groupStartIndex: number, gloss: string) => {
    // For a linked group, we store the gloss on the first occurrence
    setOccurrences((prev) => {
      const next = [...prev];
      next[groupStartIndex] = { ...next[groupStartIndex], gloss };
      return next;
    });
  }, []);

  const updateMorphemeText = useCallback(
    (occIndex: number, morphemeText: string) => {
      setOccurrences((prev) => {
        const next = [...prev];
        next[occIndex] = { ...next[occIndex], morphemeText };
        return next;
      });
    },
    [],
  );

  const toggleLink = useCallback(
    (occIndex: number, rightOccIndex?: number) => {
      const occs = occurrencesRef.current;

      // Cross-punctuation disjoint link: caller supplies explicit right occ index.
      // Bypass the punctuation guard and directly toggle the disjoint link.
      if (rightOccIndex !== undefined) {
        const key = `${occIndex}:${rightOccIndex}`;
        setDisjointLinks((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });
        return;
      }

      // Skip punctuation boundaries for linking.
      if (occs[occIndex]?.isPunctuation || occs[occIndex + 1]?.isPunctuation) {
        return;
      }

      // If already linked here (adjacent chain), just unlink.
      if (occs[occIndex].linkedWithNext) {
        setOccurrences((prev) => {
          const next = [...prev];
          next[occIndex] = { ...next[occIndex], linkedWithNext: false };
          return next;
        });
        return;
      }

      const groups = linkedGroupsRef.current;
      const activeGroup = groups[activeGroupIndexRef.current];
      if (!activeGroup) {
        // Fallback: simple adjacent link
        setOccurrences((prev) => {
          const next = [...prev];
          next[occIndex] = { ...next[occIndex], linkedWithNext: true };
          return next;
        });
        return;
      }

      const activeEnd =
        activeGroup.startIndex + activeGroup.occurrences.length - 1;

      // Adjacent link — set the flag and update any disjoint link keys that
      // referenced the boundaries now being merged.
      if (occIndex === activeEnd || occIndex + 1 === activeGroup.startIndex) {
        // Determine the boundary indices of the two groups being merged.
        // Key format: "leftGroupLastOcc:rightGroupFirstOcc".
        const leftLastOcc = occIndex; // last occ of the left group (l1)
        const rightFirstOcc = occIndex + 1; // first occ of the right group (s2)

        // Find the left and right group objects to know the full new extent.
        const leftGroup = groups.find(
          (g) => g.startIndex + g.occurrences.length - 1 === leftLastOcc,
        );
        const rightGroup = groups.find((g) => g.startIndex === rightFirstOcc);
        // After merge: merged group startIndex = s1 (left group's start),
        //              merged group lastOcc     = l2 (right group's last occ).
        const mergedStart = leftGroup?.startIndex ?? leftLastOcc;
        const mergedEnd =
          rightGroup !== undefined
            ? rightGroup.startIndex + rightGroup.occurrences.length - 1
            : rightFirstOcc;

        // Update or remove any disjoint link keys that cross the merged boundary.
        // Three cases:
        //   1. Cross-boundary key "l1:s2"         → remove (groups become one)
        //   2. Key "l1:X" (X ≠ s2)               → update to "l2:X"
        //      (left group was a disjoint-left endpoint; its lastOcc grew to l2)
        //   3. Key "Y:s2" (Y ≠ l1)               → update to "Y:s1"
        //      (right group was a disjoint-right endpoint; its startIndex shrank to s1)
        const links = disjointLinksRef.current;
        if (links.size > 0) {
          let changed = false;
          const updated = new Set<string>();
          for (const key of links) {
            const colonIdx = key.indexOf(":");
            const l = parseInt(key.slice(0, colonIdx), 10);
            const r = parseInt(key.slice(colonIdx + 1), 10);
            if (l === leftLastOcc && r === rightFirstOcc) {
              // Case 1: direct cross-boundary link — superseded by adjacent merge.
              changed = true;
            } else if (l === leftLastOcc) {
              // Case 2: left group was a disjoint-left endpoint.
              updated.add(`${mergedEnd}:${r}`);
              changed = true;
            } else if (r === rightFirstOcc) {
              // Case 3: right group was a disjoint-right endpoint.
              updated.add(`${l}:${mergedStart}`);
              changed = true;
            } else {
              updated.add(key);
            }
          }
          if (changed) {
            setDisjointLinks(updated);
          }
        }

        setOccurrences((prev) => {
          const next = [...prev];
          next[occIndex] = { ...next[occIndex], linkedWithNext: true };
          return next;
        });
        return;
      }

      // Non-contiguous: create/remove a disjoint link between the two groups.
      // Key: last occ index of left group : first occ index of right group
      const leftLastOcc =
        occIndex < activeGroup.startIndex ? occIndex : activeEnd;
      const rightFirstOcc =
        occIndex < activeGroup.startIndex
          ? activeGroup.startIndex
          : occIndex + 1;
      const key = `${leftLastOcc}:${rightFirstOcc}`;

      setDisjointLinks((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  const updateLiteralTranslation = useCallback(
    (segmentId: string, text: string) => {
      setSegmentTranslations((prev) => ({
        ...prev,
        [segmentId]: { ...prev[segmentId], literal: text },
      }));
    },
    [],
  );

  const updateFreeTranslation = useCallback(
    (segmentId: string, text: string) => {
      setSegmentTranslations((prev) => ({
        ...prev,
        [segmentId]: { ...prev[segmentId], free: text },
      }));
    },
    [],
  );

  /** Copy segment glosses into the segment's literal translation field. */
  const copyGlossesToLiteral = useCallback(
    (segmentId: string) => {
      const seg = segments.find((s) => s.id === segmentId);
      if (!seg) return;

      const byId = new Map(occurrences.map((o) => [o.id, o]));
      const literal = seg.occurrences
        .map((occ) => byId.get(occ.id))
        .filter((occ): occ is Occurrence => !!occ && !occ.isPunctuation)
        .map((occ) => occ.gloss.trim())
        .filter(Boolean)
        .join(" ");

      setSegmentTranslations((prev) => ({
        ...prev,
        [segmentId]: { ...prev[segmentId], literal },
      }));
    },
    [segments, occurrences],
  );

  /** Merge two adjacent segments into one. No-op if either is already merged. */
  const mergeSegments = useCallback((segId1: string, segId2: string) => {
    setSegments((prev) => {
      const i1 = prev.findIndex((s) => s.id === segId1);
      if (i1 === -1 || i1 + 1 >= prev.length) return prev;
      if (prev[i1 + 1].id !== segId2) return prev;
      const a = prev[i1];
      const b = prev[i1 + 1];
      if (isMergedSegment(b)) {
        return prev; // allow extending a merged segment forward, but avoid merging into already-merged next segment
      }
      const mergedId = a.id;
      const mergedOccurrences = [...a.occurrences, ...b.occurrences].map(
        (occ, idx) => ({
          ...occ,
          segmentId: mergedId,
          index: idx,
        }),
      );
      const merged: CanonicalSegment = {
        ...a,
        startRef: a.startRef,
        endRef: b.endRef,
        occurrences: mergedOccurrences,
      };
      return [...prev.slice(0, i1), merged, ...prev.slice(i1 + 2)];
    });
  }, []);

  /**
   * Split a segment immediately before the given occurrence.
   * - punctuation targets split at the next word (so users can split after punctuation)
   * - no-op when occurrence is first in segment
   */
  const splitSegmentAtOccurrence = useCallback(
    (segmentId: string, occurrenceId: string) => {
      let createdRightId: string | null = null;

      setSegments((prev) => {
        const segIndex = prev.findIndex((s) => s.id === segmentId);
        if (segIndex === -1) return prev;

        const seg = prev[segIndex];
        const clickedIndex = seg.occurrences.findIndex(
          (o) => o.id === occurrenceId,
        );
        if (clickedIndex < 0) return prev;

        let splitAt = clickedIndex;
        if (seg.occurrences[clickedIndex].type !== "word") {
          // Double-click on punctuation means "split after punctuation":
          // move to the next word occurrence and split before it.
          splitAt = seg.occurrences.findIndex(
            (o, i) => i > clickedIndex && o.type === "word",
          );
          if (splitAt === -1) return prev;
        }

        if (splitAt <= 0) return prev;

        const leftOcc = seg.occurrences.slice(0, splitAt).map((o, i) => ({
          ...o,
          segmentId: seg.id,
          index: i,
        }));

        const rightId = `${seg.id}~split~${++splitIdCounterRef.current}`;
        createdRightId = rightId;
        const rightOcc = seg.occurrences.slice(splitAt).map((o, i) => ({
          ...o,
          segmentId: rightId,
          index: i,
        }));

        const sameVerseRange = sameBcv(seg.startRef, seg.endRef);
        const leftEnd = sameVerseRange
          ? { ...seg.startRef, fragment: "a" }
          : seg.startRef;
        const rightStart = sameVerseRange
          ? { ...seg.startRef, fragment: "b" }
          : seg.endRef;
        const rightEnd = sameVerseRange
          ? { ...seg.endRef, fragment: "b" }
          : seg.endRef;

        const leftSeg: CanonicalSegment = {
          ...seg,
          endRef: leftEnd,
          occurrences: leftOcc,
        };

        const rightSeg: CanonicalSegment = {
          ...seg,
          id: rightId,
          startRef: rightStart,
          endRef: rightEnd,
          occurrences: rightOcc,
          literalTranslation: undefined,
          freeTranslation: undefined,
        };

        return [
          ...prev.slice(0, segIndex),
          leftSeg,
          rightSeg,
          ...prev.slice(segIndex + 1),
        ];
      });

      // Keep left translation values; right starts empty.
      if (createdRightId) {
        const rightId = createdRightId;
        setSegmentTranslations((prev) => ({
          ...prev,
          [rightId]: { literal: "", free: "" },
        }));
      }
    },
    [],
  );

  const canGoBack = linkedGroups
    .slice(0, activeGroupIndex)
    .some(
      (g) =>
        !g.occurrences.every((o) => o.isPunctuation) &&
        !disjointRightStarts.has(g.startIndex),
    );
  const canGoForward = linkedGroups
    .slice(activeGroupIndex + 1)
    .some(
      (g) =>
        !g.occurrences.every((o) => o.isPunctuation) &&
        !disjointRightStarts.has(g.startIndex),
    );

  /** Jump directly to a group by its group index. */
  const goToGroup = useCallback((groupIndex: number) => {
    const groups = linkedGroupsRef.current;
    const target = groups[groupIndex];
    if (target) setActiveIndex(target.startIndex);
  }, []);

  return {
    occurrences,
    activeIndex,
    activeGroupIndex,
    linkedGroups,
    disjointLinks,
    segments,
    occurrenceGroupMap,
    segmentTranslations,
    updateLiteralTranslation,
    updateFreeTranslation,
    copyGlossesToLiteral,
    mergeSegments,
    splitSegmentAtOccurrence,
    moveForward,
    moveBackward,
    toggleApprove,
    updateGloss,
    updateMorphemeText,
    toggleLink,
    goToGroup,
    canGoBack,
    canGoForward,
  };
}
